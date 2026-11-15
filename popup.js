'use strict';

const DEFAULTS = { enabled: true, language: 'en', position: 'top', scale: 1 };
// stesse pagine dei "matches" in manifest.json
const SUPPORTED = [
  /^https?:\/\/www\.netflix\.com\//,
  /^https?:\/\/([\w-]+\.)*primevideo\.com\//,
  /^https?:\/\/([\w-]+\.)*disneyplus\.com\//,
  /^https?:\/\/www\.amazon\.[a-z.]+\/(.*\/)?gp\/video\//
];

const $ = (id) => document.getElementById(id);
const enabledBox = $('enabled');
const languageSelect = $('language');
const scaleInput = $('scale');
const statusEl = $('status');
const positions = document.querySelectorAll('input[name="position"]');

let settings = { ...DEFAULTS };

function t(key, subs) {
  return chrome.i18n.getMessage(key, subs) || key;
}

function save(patch) {
  settings = { ...settings, ...patch };
  chrome.storage.local.set({ settings });
  renderControls();
}

// stato della scheda attiva, chiesto a content.js
async function getPageState() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  // tab.url e' visibile solo sui siti dei permessi host
  const supported = Boolean(tab && tab.url && SUPPORTED.some((re) => re.test(tab.url)));
  if (!supported) return { supported, state: null };
  try {
    return { supported, state: (await chrome.tabs.sendMessage(tab.id, { type: 'get-state' })) || null };
  } catch (e) {
    return { supported, state: null };
  }
}

// "en" oppure "en:cc"
function trackValue(track) {
  return track.language + (track.isClosedCaptions ? ':cc' : '');
}

function trackLabel(track) {
  let label = track.label;
  if (track.isClosedCaptions && !/\bCC\b/.test(label)) label += ' ' + t('trackClosedCaptions');
  if (!track.usable) label += ' ' + t('trackImageOnly');
  return label;
}

function addOption(value, label, disabled) {
  const opt = document.createElement('option');
  opt.value = value;
  opt.textContent = label;
  opt.disabled = disabled;
  languageSelect.appendChild(opt);
}

function renderLanguages(state) {
  // una voce per lingua e tipo, preferendo quella utilizzabile
  const byValue = new Map();
  for (const track of state ? state.tracks : []) {
    const prev = byValue.get(trackValue(track));
    if (!prev || (!prev.usable && track.usable)) byValue.set(trackValue(track), track);
  }
  const tracks = [...byValue.values()].sort((a, b) => a.label.localeCompare(b.label));

  languageSelect.textContent = '';
  for (const track of tracks) addOption(trackValue(track), trackLabel(track), !track.usable);
  // la lingua salvata resta selezionata anche se il titolo non ce l'ha
  if (!tracks.some((tr) => trackValue(tr) === settings.language && tr.usable)) {
    addOption(settings.language, t('savedLanguageUnavailable', [settings.language]), false);
  }
  languageSelect.value = settings.language;
}

function renderControls() {
  enabledBox.checked = settings.enabled;
  document.body.classList.toggle('disabled', !settings.enabled);
  for (const radio of positions) radio.checked = radio.value === settings.position;
  scaleInput.value = settings.scale;
  $('scale-value').textContent = Math.round(settings.scale * 100) + '%';
}

function statusText({ supported, state }) {
  if (!supported) return [t('statusOpenTitle')];
  if (!state) return [t('statusNotResponding'), true];
  const s = state.status;
  if (!s || s.state === 'idle') return [t('statusOpenTitle')];
  if (!settings.enabled) return [t('statusDisabled')];
  switch (s.state) {
    case 'loading': return [t('statusLoading')];
    case 'loaded': return [t('statusLoaded', [String(s.cueCount)])];
    case 'unavailable': return [t('statusUnavailable'), true];
    case 'error': return [t('statusError'), true];
    default: return [t('statusWaitingTitle')];
  }
}

async function refresh() {
  const page = await getPageState();
  renderLanguages(page.state);
  const [text, warning] = statusText(page);
  statusEl.textContent = text;
  statusEl.classList.toggle('warning', Boolean(warning));
}

enabledBox.addEventListener('change', () => {
  save({ enabled: enabledBox.checked });
  refresh();
});
languageSelect.addEventListener('change', () => save({ language: languageSelect.value }));
scaleInput.addEventListener('input', () => save({ scale: Number(scaleInput.value) }));
for (const radio of positions) radio.addEventListener('change', () => save({ position: radio.value }));

// content.js avvisa quando arrivano tracce nuove o cambia lo stato
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'state-changed') refresh();
});

for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
for (const el of document.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
$('version').textContent = 'v' + chrome.runtime.getManifest().version;

chrome.storage.local.get('settings').then((stored) => {
  settings = { ...DEFAULTS, ...stored.settings };
  renderControls();
  refresh();
});

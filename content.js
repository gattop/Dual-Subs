// Ponte tra page.js (mondo MAIN, via postMessage) e popup/storage.
(function () {
  'use strict';

  const SOURCE = 'dual-subs';
  const DEFAULTS = { enabled: true, language: 'en', position: 'top', scale: 1 };

  // per titolo, perche' Netflix carica anche manifest di altri titoli in anteprima
  const tracksByTitle = new Map();
  let lastTitle = null;
  let status = null;

  function toPage(type, payload) {
    window.postMessage({ source: SOURCE, from: 'content', type, payload }, '*');
  }

  async function sendSettings() {
    try {
      const stored = await chrome.storage.local.get('settings');
      toPage('settings', { ...DEFAULTS, ...stored.settings });
    } catch (err) {
      console.warn('[DualSubs] could not read settings:', err);
    }
  }

  function notifyPopup() {
    try {
      chrome.runtime.sendMessage({ type: 'state-changed' }).catch(() => {});
    } catch (e) {
      // estensione ricaricata: questo script non e' piu' collegato
    }
  }

  window.addEventListener('message', (event) => {
    const data = event.data;
    if (event.source !== window || !data || data.source !== SOURCE || data.from !== 'page') return;
    if (data.type === 'page-ready') {
      sendSettings();
    } else if (data.type === 'tracks') {
      tracksByTitle.set(data.payload.movieId, data.payload.tracks);
      lastTitle = data.payload.movieId;
      notifyPopup();
    } else if (data.type === 'status') {
      status = data.payload;
      notifyPopup();
    }
  });

  chrome.runtime.onMessage.addListener((msg, sender, reply) => {
    if (!msg || msg.type !== 'get-state') return;
    const movieId = status ? status.movieId : lastTitle;
    reply({ movieId, tracks: tracksByTitle.get(movieId) || [], status });
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) sendSettings();
  });

  sendSettings();
})();

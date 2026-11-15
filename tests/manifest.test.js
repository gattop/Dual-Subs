'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const LOCALES = fs.readdirSync(path.join(root, '_locales'));
const messages = Object.fromEntries(
  LOCALES.map((locale) => [locale, JSON.parse(read('_locales/' + locale + '/messages.json'))])
);

// file citati nel manifest
function referencedFiles(m) {
  const files = [m.action.default_popup];
  files.push(...Object.values(m.icons), ...Object.values(m.action.default_icon));
  for (const cs of m.content_scripts) files.push(...(cs.js || []), ...(cs.css || []));
  return files;
}

test('manifest V3 con permessi minimi', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.ok(manifest.host_permissions.includes('*://www.netflix.com/*'));
  assert.ok(manifest.host_permissions.includes('*://*.primevideo.com/*'));
  assert.ok(manifest.host_permissions.includes('*://*.disneyplus.com/*'));
  // su Amazon solo le pagine video, mai l'intero negozio
  for (const pattern of manifest.host_permissions.filter((p) => p.includes('amazon'))) {
    assert.match(pattern, /^\*:\/\/www\.amazon\.[a-z.]+\/\*gp\/video\/\*$/);
  }
});

test('content script: MAIN per la pagina, ISOLATED per content.js, a document_start', () => {
  const [main, isolated] = manifest.content_scripts;
  assert.equal(main.world, 'MAIN');
  // l'ordine conta: page.js usa i moduli caricati prima
  assert.deepEqual(main.js, [
    'vtt-parser.js', 'ttml-parser.js', 'hls.js', 'tracks.js',
    'platforms/netflix.js', 'platforms/prime.js', 'platforms/disney.js', 'overlay.js', 'page.js'
  ]);
  assert.equal(isolated.world, undefined);
  assert.deepEqual(isolated.js, ['content.js']);
  for (const cs of manifest.content_scripts) {
    assert.equal(cs.run_at, 'document_start');
    assert.deepEqual(cs.matches, manifest.host_permissions, 'matches diversi dai permessi host');
  }
});

test('i domini del manifest sono riconosciuti dagli adattatori e dal popup', () => {
  const { adapter: netflix } = require('../platforms/netflix.js');
  const { adapter: prime } = require('../platforms/prime.js');
  const { adapter: disney } = require('../platforms/disney.js');
  const popup = read('popup.js');
  const supported = Array.from(popup.matchAll(/^\s+(\/\^https.*\/),?$/gm), (m) => eval(m[1]));
  assert.equal(supported.length, 4, 'SUPPORTED_URLS non trovato in popup.js');
  for (const pattern of manifest.host_permissions) {
    const host = pattern.split('/')[2].replace('*.', 'www.');
    assert.ok(netflix.matches(host) || prime.matches(host) || disney.matches(host), 'dominio senza adattatore: ' + host);
    const sample = 'https://' + host + (host.includes('amazon') ? '/gp/video/detail/X' : '/watch/1');
    assert.ok(supported.some((re) => re.test(sample)), 'il popup non riconosce ' + sample);
  }
});

test('la versione in page.js coincide con quella del manifest', () => {
  const m = /BUILD_VERSION = '([^']+)'/.exec(read('page.js'));
  assert.ok(m, 'BUILD_VERSION non trovata in page.js');
  assert.equal(m[1], manifest.version);
});

test('tutti i file citati nel manifest esistono', () => {
  for (const file of referencedFiles(manifest)) {
    assert.ok(fs.existsSync(path.join(root, file)), 'manca ' + file);
  }
});

test('i file JavaScript sono sintatticamente validi', () => {
  const files = ['vtt-parser.js', 'ttml-parser.js', 'hls.js', 'tracks.js', 'platforms/netflix.js', 'platforms/disney.js',
    'platforms/prime.js', 'overlay.js', 'page.js', 'content.js', 'popup.js',
    'scripts/pack.js', 'scripts/make-icons.js'];
  for (const file of files) {
    assert.doesNotThrow(() => new Function(read(file)), file);
  }
});

test('traduzioni: lingua predefinita presente e stesse chiavi in tutte le lingue', () => {
  assert.ok(LOCALES.includes(manifest.default_locale));
  const reference = Object.keys(messages[manifest.default_locale]).sort();
  for (const locale of LOCALES) {
    assert.deepEqual(Object.keys(messages[locale]).sort(), reference, 'chiavi diverse in ' + locale);
  }
});

test('traduzioni: nome e descrizione entro i limiti dello store', () => {
  for (const locale of LOCALES) {
    assert.ok(messages[locale].extName.message.length <= 75, 'nome troppo lungo in ' + locale);
    assert.ok(messages[locale].extDescription.message.length <= 132, 'descrizione troppo lunga in ' + locale);
  }
});

test('ogni chiave usata da popup.html e popup.js esiste nelle traduzioni', () => {
  const html = read('popup.html');
  const js = read('popup.js');
  const keys = new Set([
    ...Array.from(html.matchAll(/data-i18n(?:-title)?="([^"]+)"/g), (m) => m[1]),
    ...Array.from(js.matchAll(/\bt\('([A-Za-z]+)'/g), (m) => m[1])
  ]);
  assert.ok(keys.size > 10);
  for (const key of keys) {
    assert.ok(messages[manifest.default_locale][key], 'chiave mancante: ' + key);
  }
});

test('i messaggi __MSG_x__ del manifest esistono', () => {
  const used = Array.from(JSON.stringify(manifest).matchAll(/__MSG_(\w+)__/g), (m) => m[1]);
  for (const key of used) assert.ok(messages[manifest.default_locale][key], 'chiave mancante: ' + key);
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  WEBVTT_PROFILE, isProfileList, injectWebvttProfile, firstUrl, extractManifest, adapter
} = require('../platforms/netflix.js');

// nomi dei campi 2026
function newManifest() {
  return {
    result: {
      movieId: 70021641,
      textTracks: [
        {
          id: 'T1', language: 'en', languageDescription: 'English', rawTrackType: 'subtitles',
          downloadables: { [WEBVTT_PROFILE]: { urls: [{ url: 'https://cdn/en.vtt' }] } }
        },
        {
          id: 'T2', language: 'en', languageDescription: 'English [CC]', rawTrackType: 'closedcaptions',
          downloadables: { [WEBVTT_PROFILE]: { urls: [{ url: 'https://cdn/en-cc.vtt' }] } }
        },
        {
          id: 'T3', language: 'ja', languageDescription: 'Japanese', rawTrackType: 'subtitles',
          downloadables: { 'nflx-cmisc': { urls: [{ url: 'https://cdn/ja.img' }] } }
        },
        { id: 'T4', language: 'it', isForcedNarrative: true, downloadables: {} },
        { id: 'T5', isNoneTrack: true }
      ]
    }
  };
}

// nomi dei campi vecchi
function oldManifest() {
  return {
    result: {
      movieId: '80000001',
      timedtexttracks: [
        {
          new_track_id: 'OLD1', language: 'fr', languageDescription: 'Français', rawTrackType: 'subtitles',
          ttDownloadables: { [WEBVTT_PROFILE]: { urls: { cdn1: 'https://cdn/fr.vtt' } } }
        }
      ]
    }
  };
}

test('adattatore: riconosce solo i domini Netflix', () => {
  assert.ok(adapter.matches('www.netflix.com'));
  assert.ok(!adapter.matches('www.netflix.com.example.org'));
  assert.ok(!adapter.matches('www.primevideo.com'));
});

test('isProfileList riconosce la lista dei profili per contenuto', () => {
  assert.ok(isProfileList(['heaac-2-dash', 'playready-h264mpl30-dash']));
  assert.ok(isProfileList(['qualcosa-di-nuovo-dash']));
  assert.ok(!isProfileList(['ciao', 'mondo']));
  assert.ok(!isProfileList(['heaac-2-dash', 3]));
  assert.ok(!isProfileList([]));
});

test('injectWebvttProfile aggiunge il profilo in testa, una sola volta', () => {
  const request = { version: 2, params: { nomeCambiato: ['heaac-2-dash', 'simplesdh'] } };
  assert.equal(injectWebvttProfile(request), '$.params.nomeCambiato');
  assert.deepEqual(request.params.nomeCambiato, [WEBVTT_PROFILE, 'heaac-2-dash', 'simplesdh']);
  assert.equal(injectWebvttProfile(request), null);
  assert.equal(request.params.nomeCambiato.length, 3);
});

test('injectWebvttProfile ignora oggetti senza profili, primitivi e cicli', () => {
  const cyclic = { a: { b: 1 } };
  cyclic.a.self = cyclic;
  assert.equal(injectWebvttProfile(cyclic), null);
  assert.equal(injectWebvttProfile('stringa'), null);
  assert.equal(injectWebvttProfile(null), null);
  assert.equal(injectWebvttProfile({ tags: ['a', 'b'] }), null);
});

test('firstUrl gestisce array di oggetti, oggetti e valori mancanti', () => {
  assert.equal(firstUrl([{ url: 'u1' }, { url: 'u2' }]), 'u1');
  assert.equal(firstUrl({ x: 'u1' }), 'u1');
  assert.equal(firstUrl({ x: { url: 'u1' } }), 'u1');
  assert.equal(firstUrl([]), null);
  assert.equal(firstUrl(undefined), null);
});

test('extractManifest con i campi nuovi: filtra forzate e "nessuna"', () => {
  const manifest = extractManifest(newManifest());
  assert.equal(manifest.movieId, '70021641');
  assert.deepEqual(manifest.tracks.map((t) => t.id), ['T1', 'T2', 'T3']);
  assert.equal(manifest.tracks[0].url, 'https://cdn/en.vtt');
  assert.equal(manifest.tracks[0].format, 'vtt');
  assert.equal(manifest.tracks[1].isClosedCaptions, true);
  assert.equal(manifest.tracks[2].url, null);
  assert.deepEqual(manifest.tracks[2].formats, ['nflx-cmisc']);
});

test('extractManifest con i campi vecchi', () => {
  const manifest = extractManifest(oldManifest());
  assert.equal(manifest.movieId, '80000001');
  assert.equal(manifest.tracks[0].id, 'OLD1');
  assert.equal(manifest.tracks[0].url, 'https://cdn/fr.vtt');
});

test('extractManifest: tracce non trovate e oggetti estranei', () => {
  const manifest = extractManifest({ result: { movieId: 1, altroNome: [] } });
  assert.equal(manifest.tracks, null);
  assert.deepEqual(manifest.resultKeys, ['movieId', 'altroNome']);
  assert.equal(extractManifest({ result: {} }), null);
  assert.equal(extractManifest([1, 2]), null);
  assert.equal(extractManifest(null), null);
  assert.equal(extractManifest(42), null);
});

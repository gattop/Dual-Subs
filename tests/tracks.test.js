'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { languageScore, pickTrack, publicTracks } = require('../tracks.js');

const TRACKS = [
  { id: 'T1', language: 'en', label: 'English', isClosedCaptions: false, url: 'https://cdn/en.vtt', format: 'vtt' },
  { id: 'T2', language: 'en', label: 'English [CC]', isClosedCaptions: true, url: 'https://cdn/en-cc.vtt', format: 'vtt' },
  { id: 'T3', language: 'ja', label: 'Japanese', isClosedCaptions: false, url: null, format: 'vtt' }
];

test('languageScore: identica, stesso prefisso, maiuscole, diversa', () => {
  assert.equal(languageScore('en', 'en'), 2);
  assert.equal(languageScore('en-us', 'en'), 1);
  assert.equal(languageScore('en-US', 'en-us'), 2);
  assert.equal(languageScore('it-it', 'en'), 0);
});

test('pickTrack: normale, CC, prefisso di lingua, traccia non utilizzabile', () => {
  assert.equal(pickTrack(TRACKS, 'en').id, 'T1');
  assert.equal(pickTrack(TRACKS, 'en:cc').id, 'T2');
  assert.equal(pickTrack(TRACKS, 'en-GB').id, 'T1');
  assert.equal(pickTrack(TRACKS, 'ja'), null); // senza URL
  assert.equal(pickTrack(TRACKS, 'de'), null);
  assert.equal(pickTrack([], 'en'), null);
});

test('pickTrack preferisce la lingua esatta al prefisso', () => {
  const tracks = [
    { id: 'A', language: 'pt', isClosedCaptions: false, url: 'a' },
    { id: 'B', language: 'pt-BR', isClosedCaptions: false, url: 'b' }
  ];
  assert.equal(pickTrack(tracks, 'pt-BR').id, 'B');
  assert.equal(pickTrack(tracks, 'pt').id, 'A');
});

test('pickTrack: una lingua salvata su Netflix ("en") funziona su Prime ("en-us")', () => {
  const prime = [{ id: 'P', language: 'en-us', isClosedCaptions: false, url: 'p' }];
  assert.equal(pickTrack(prime, 'en').id, 'P');
});

test('publicTracks non espone gli URL', () => {
  const pub = publicTracks(TRACKS);
  assert.deepEqual(pub[0], { id: 'T1', language: 'en', label: 'English', isClosedCaptions: false, usable: true });
  assert.equal(pub[2].usable, false);
  assert.ok(pub.every((t) => !('url' in t)));
});

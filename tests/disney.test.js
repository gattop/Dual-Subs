'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readMasterUrl, routeId, extractPlayback, adapter } = require('../platforms/disney.js');

const MASTER = 'https://vod.example.net/ps01/disney/abc/ctr-all-hdri.m3u8?a=1';

test('adattatore: riconosce solo i domini Disney+', () => {
  assert.ok(adapter.matches('www.disneyplus.com'));
  assert.ok(adapter.matches('disneyplus.com'));
  assert.ok(!adapter.matches('www.disneyplus.com.evil.example'));
  assert.ok(!adapter.matches('www.netflix.com'));
});

test('readMasterUrl: nella risposta o sotto "data"', () => {
  assert.equal(readMasterUrl({ stream: { sources: [{ complete: { url: MASTER } }] } }), MASTER);
  assert.equal(readMasterUrl({ data: { stream: { sources: [{ complete: { url: MASTER } }] } } }), MASTER);
});

test('readMasterUrl ignora oggetti estranei o incompleti', () => {
  assert.equal(readMasterUrl({ stream: { sources: [] } }), null);
  assert.equal(readMasterUrl({ stream: { sources: [{ complete: {} }] } }), null);
  assert.equal(readMasterUrl({ result: { movieId: 1 } }), null);
  assert.equal(readMasterUrl([1]), null);
  assert.equal(readMasterUrl(null), null);
  assert.equal(readMasterUrl('stream'), null);
});

test('routeId: /play/<id> e /video/<id>, con decodifica', () => {
  assert.equal(routeId('/it-it/play/2a3b-4c5d'), '2a3b-4c5d');
  assert.equal(routeId('/video/abc%20def/'), 'abc def');
  assert.equal(routeId('/it-it/home'), null);
  assert.equal(routeId(''), null);
});

test('extractPlayback: id dal percorso, o dalla playlist se il percorso non lo contiene', () => {
  const value = { stream: { sources: [{ complete: { url: MASTER } }] } };
  assert.deepEqual(extractPlayback(value, '/play/xyz'), { movieId: 'xyz', masterUrl: MASTER });
  assert.equal(extractPlayback(value, '/home').movieId,
    'disney:https://vod.example.net/ps01/disney/abc/ctr-all-hdri.m3u8');
  assert.equal(extractPlayback({}, '/play/xyz'), null);
});

const { createProgramClock } = require('../platforms/disney.js');

test('orologio: senza playhead usa il tempo del video', () => {
  const clock = createProgramClock();
  assert.equal(clock.time(null, 12.5), 12.5);
});

test('orologio: avanza in modo continuo anche se il playhead è aggiornato a scatti', () => {
  const clock = createProgramClock();
  // programma = video + 30, playhead aggiornato una volta al secondo
  assert.equal(clock.time(130, 100), 130);
  assert.equal(clock.time(130, 100.4), 130.4); // playhead fermo, il tempo avanza col video
  assert.equal(clock.time(130, 100.9), 130.9);
  assert.equal(clock.time(131, 101), 131);
  assert.equal(clock.getOffset(), 30);
});

test('orologio: un primo campione "vecchio" viene corretto dai successivi', () => {
  const clock = createProgramClock();
  assert.equal(clock.time(129.3, 100), 129.3); // playhead letto in ritardo di 0,7 s
  assert.equal(clock.time(131, 101), 131); // campione fresco: scarto vero 30
  assert.equal(clock.time(131, 101.5), 131.5);
});

test('orologio: dopo un salto aspetta il playhead invece di mostrare la scena vecchia', () => {
  const clock = createProgramClock();
  clock.time(50, 50);
  assert.equal(clock.time(50, 600), null); // il video è saltato, il playhead no
  assert.equal(clock.time(50.2, 600.2), null);
  assert.equal(clock.time(600.5, 600.5), 600.5); // playhead aggiornato: si riparte
  assert.equal(clock.time(600.5, 600.8), 600.8);
});

test('orologio: al rientro da una pubblicità riparte con il nuovo scarto', () => {
  const clock = createProgramClock();
  clock.time(300, 300);
  // dopo la pubblicità il video è 60 s avanti
  assert.equal(clock.time(300.1, 360.1), null);
  assert.equal(clock.time(300.7, 360.7), 300.7);
  assert.equal(clock.getOffset(), -60);
  assert.ok(Math.abs(clock.time(300.7, 361) - 301) < 1e-9);
});

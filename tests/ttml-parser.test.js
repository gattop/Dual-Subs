'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseTtml, parseTimeExpression } = require('../ttml-parser.js');

const BASE = { frameRate: 25, tickRate: 10000000 };

// come i TTMLv2 di Prime Video
const PRIME_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling"
    xmlns:ttp="http://www.w3.org/ns/ttml#parameter" ttp:frameRate="25" xml:lang="en-US">
  <head>
    <styling><style xml:id="s1" tts:fontStyle="italic"/></styling>
    <layout><region xml:id="bottom" tts:origin="10% 80%"/></layout>
  </head>
  <body>
    <div>
      <p begin="00:00:05.005" end="00:00:07.007" region="bottom">Hello there.</p>
      <p begin="00:00:08.100" end="00:00:10.500" region="bottom">
        <span style="s1">First line</span><br/>
        - Second &amp; last
      </p>
      <p begin="00:00:11.000" end="00:00:12.000"/>
      <p begin="00:00:13.000" end="00:00:14.000">Third</p>
    </div>
  </body>
</tt>`;

test('espressioni di tempo: orologio, frame e offset', () => {
  assert.equal(parseTimeExpression('00:00:05.005', BASE), 5.005);
  assert.equal(parseTimeExpression('01:02:03.5', BASE), 3723.5);
  assert.equal(parseTimeExpression('00:00:01:05', BASE), 1.2); // 5 frame a 25 fps
  assert.equal(parseTimeExpression('12.5s', BASE), 12.5);
  assert.equal(parseTimeExpression('500ms', BASE), 0.5);
  assert.equal(parseTimeExpression('2m', BASE), 120);
  assert.equal(parseTimeExpression('25f', BASE), 1);
  assert.equal(parseTimeExpression('25000000t', BASE), 2.5);
  assert.ok(Number.isNaN(parseTimeExpression('', BASE)));
  assert.ok(Number.isNaN(parseTimeExpression('domani', BASE)));
});

test('file in stile Prime Video: testo, a capo, entità, <p/> vuoto ignorato', () => {
  assert.deepEqual(parseTtml(PRIME_SAMPLE), [
    { start: 5.005, end: 7.007, text: 'Hello there.' },
    { start: 8.1, end: 10.5, text: 'First line\n- Second & last' },
    { start: 13, end: 14, text: 'Third' }
  ]);
});

test('namespace con prefisso (tt:p, tt:br) e tickRate dichiarato', () => {
  const xml = '<tt:tt xmlns:tt="x" ttp:tickRate="1000">' +
    '<tt:body><tt:p begin="1000t" end="2500t">A<tt:br/>B</tt:p></tt:body></tt:tt>';
  assert.deepEqual(parseTtml(xml), [{ start: 1, end: 2.5, text: 'A\nB' }]);
});

test('durata al posto della fine', () => {
  const xml = '<tt><body><p begin="10s" dur="1.5s">Ciao</p></body></tt>';
  assert.deepEqual(parseTtml(xml), [{ start: 10, end: 11.5, text: 'Ciao' }]);
});

test('battute fuori ordine vengono ordinate; tempi non validi scartati', () => {
  const xml = '<tt><body>' +
    '<p begin="5s" end="6s">B</p><p begin="1s" end="2s">A</p><p begin="x" end="y">Z</p>' +
    '</body></tt>';
  assert.deepEqual(parseTtml(xml).map((c) => c.text), ['A', 'B']);
});

test('input non valido restituisce lista vuota', () => {
  assert.deepEqual(parseTtml(''), []);
  assert.deepEqual(parseTtml(null), []);
  assert.deepEqual(parseTtml('{"json": true}'), []);
});

test('frameRateMultiplier: 30 fotogrammi nominali diventano 29,97', () => {
  const xml = '<tt ttp:frameRate="30" ttp:frameRateMultiplier="1000 1001"><body>' +
    '<p begin="3000f" end="6000f">Ciao</p></body></tt>';
  const [cue] = parseTtml(xml);
  // 3000 frame a 30000/1001 fps = 100.1 s
  assert.ok(Math.abs(cue.start - 100.1) < 1e-9, 'inizio ' + cue.start);
  assert.ok(Math.abs(cue.end - 200.2) < 1e-9, 'fine ' + cue.end);
});

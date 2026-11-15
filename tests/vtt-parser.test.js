'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseVtt, parseTimestamp, decodeEntities, findActiveCues
} = require('../vtt-parser.js');

// come i webvtt-lssdh-ios8 di Netflix
const NETFLIX_SAMPLE = [
  'WEBVTT',
  '',
  'NOTE Netflix',
  '',
  'STYLE',
  '::cue(.yellow) { color: yellow; }',
  '',
  '1',
  '00:00:05.005 --> 00:00:07.007 position:50.00%,middle align:middle size:80.00% line:84.67%',
  '<c.bg_transparent>&lrm;Ciao.</c.bg_transparent>',
  '',
  '2',
  '00:00:08.100 --> 00:00:10.500 position:50.00%,middle align:middle size:80.00% line:79.33%',
  '<c.bg_transparent><i>Prima riga</i></c.bg_transparent>',
  '<c.bg_transparent>-Seconda riga</c.bg_transparent>',
  ''
].join('\n');

test('timestamp con e senza ore', () => {
  assert.equal(parseTimestamp('00:00:05.005'), 5.005);
  assert.equal(parseTimestamp('01:02:03.400'), 3723.4);
  assert.equal(parseTimestamp('02:03.400'), 123.4);
  assert.equal(parseTimestamp('100:00:00.000'), 360000);
  assert.equal(parseTimestamp('00:01,5'), 1.5);
  assert.ok(Number.isNaN(parseTimestamp('abc')));
});

test('file in stile Netflix: salta intestazione, NOTE e STYLE', () => {
  const cues = parseVtt(NETFLIX_SAMPLE);
  assert.equal(cues.length, 2);
  assert.deepEqual(cues[0], { start: 5.005, end: 7.007, text: '‎Ciao.' });
});

test('battute multilinea con tag <c.xxx> e <i>', () => {
  const cues = parseVtt(NETFLIX_SAMPLE);
  assert.equal(cues[1].text, 'Prima riga\n-Seconda riga');
});

test('impostazioni di posizione sulla riga dei tempi vengono ignorate', () => {
  const vtt = 'WEBVTT\n\n00:01.000 --> 00:02.000 line:10% align:start\nTesto\n';
  assert.deepEqual(parseVtt(vtt), [{ start: 1, end: 2, text: 'Testo' }]);
});

test('entità HTML nominate e numeriche', () => {
  assert.equal(decodeEntities('Tom &amp; Jerry &lt;3 &quot;ok&quot; &#233; &#xE8;'),
    'Tom & Jerry <3 "ok" é è');
  assert.equal(decodeEntities('&nbsp;'), ' ');
  assert.equal(decodeEntities('&sconosciuta;'), '&sconosciuta;');
});

test('entità che sembrano tag restano testo', () => {
  const vtt = 'WEBVTT\n\n00:01.000 --> 00:02.000\n&lt;i&gt; non è un tag\n';
  assert.equal(parseVtt(vtt)[0].text, '<i> non è un tag');
});

test('CRLF, BOM e identificatori di battuta', () => {
  const vtt = '﻿WEBVTT\r\n\r\nabc-1\r\n00:00:01.000 --> 00:00:02.000\r\nUno\r\n\r\n';
  assert.deepEqual(parseVtt(vtt), [{ start: 1, end: 2, text: 'Uno' }]);
});

test('battute vuote dopo la pulizia vengono scartate', () => {
  const vtt = 'WEBVTT\n\n00:01.000 --> 00:02.000\n<c.x>&lrm;</c.x>\n\n00:03.000 --> 00:04.000\nOk\n';
  assert.deepEqual(parseVtt(vtt).map((c) => c.text), ['Ok']);
});

test('battute fuori ordine vengono ordinate per inizio', () => {
  const vtt = 'WEBVTT\n\n00:05.000 --> 00:06.000\nB\n\n00:01.000 --> 00:02.000\nA\n';
  assert.deepEqual(parseVtt(vtt).map((c) => c.text), ['A', 'B']);
});

test('input non valido restituisce lista vuota', () => {
  assert.deepEqual(parseVtt(''), []);
  assert.deepEqual(parseVtt(null), []);
  assert.deepEqual(parseVtt('<html>errore</html>'), []);
});

test('findActiveCues: ricerca binaria con confini e pause', () => {
  const cues = parseVtt(NETFLIX_SAMPLE);
  assert.deepEqual(findActiveCues(cues, 0), []);
  assert.equal(findActiveCues(cues, 5.005)[0].text, '‎Ciao.');
  assert.deepEqual(findActiveCues(cues, 7.007), []); // la fine è esclusa
  assert.deepEqual(findActiveCues(cues, 7.5), []);
  assert.equal(findActiveCues(cues, 9)[0].text, 'Prima riga\n-Seconda riga');
  assert.deepEqual(findActiveCues(cues, 99), []);
  assert.deepEqual(findActiveCues([], 1), []);
});

test('findActiveCues: battute sovrapposte, in ordine di inizio', () => {
  const cues = parseVtt(
    'WEBVTT\n\n00:01.000 --> 00:05.000\nLunga\n\n00:02.000 --> 00:03.000\nBreve\n'
  );
  assert.deepEqual(findActiveCues(cues, 2.5).map((c) => c.text), ['Lunga', 'Breve']);
  assert.deepEqual(findActiveCues(cues, 4).map((c) => c.text), ['Lunga']);
});

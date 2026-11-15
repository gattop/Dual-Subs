'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseAttributes, parseMasterSubtitles, parseMediaPlaylist, mergeCues, loadVttPlaylist
} = require('../hls.js');

const MASTER_URL = 'https://cdn.example/ps01/master.m3u8?token=x';
const MASTER = [
  '#EXTM3U',
  '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aac",NAME="English",LANGUAGE="en",URI="a/en.m3u8"',
  '#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="sub-main",NAME="English",LANGUAGE="en",AUTOSELECT=YES,FORCED=NO,URI="r/sub_en.m3u8"',
  '#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="sub-main",NAME="English [CC]",LANGUAGE="en",FORCED=NO,' +
    'CHARACTERISTICS="public.accessibility.transcribes-spoken-dialog,public.accessibility.describes-music-and-sound",URI="r/sub_en_cc.m3u8"',
  '#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="sub-main",NAME="Italiano",LANGUAGE="it",FORCED=NO,URI="r/sub_it.m3u8"',
  '#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="sub-forced",NAME="Italiano [Forced]",LANGUAGE="it",FORCED=YES,URI="r/forced_it.m3u8"',
  '#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="sub-alt",NAME="English",LANGUAGE="en",FORCED=NO,URI="r/sub_en.m3u8"',
  '#EXT-X-STREAM-INF:BANDWIDTH=1000,SUBTITLES="sub-main",AUDIO="aac"',
  'v/1080.m3u8'
].join('\r\n');

test('parseAttributes: valori tra virgolette con virgole e valori semplici', () => {
  assert.deepEqual(parseAttributes('TYPE=SUBTITLES,NAME="A, B",FORCED=NO'), {
    TYPE: 'SUBTITLES', NAME: 'A, B', FORCED: 'NO'
  });
});

test('parseMasterSubtitles: solo sottotitoli, niente forzati né doppioni, URL assoluti', () => {
  const tracks = parseMasterSubtitles(MASTER, MASTER_URL);
  assert.deepEqual(tracks.map((t) => t.label), ['English', 'English [CC]', 'Italiano']);
  assert.equal(tracks[0].url, 'https://cdn.example/ps01/r/sub_en.m3u8');
  assert.equal(tracks[0].format, 'hls-vtt');
  assert.equal(tracks[0].isClosedCaptions, false);
  assert.equal(tracks[1].isClosedCaptions, true);
  assert.equal(tracks[2].language, 'it');
});

test('parseMediaPlaylist: segmenti in ordine, relativi e assoluti, righe vuote e CRLF', () => {
  const playlist = '#EXTM3U\r\n#EXT-X-TARGETDURATION:6\r\n#EXTINF:6.0,\r\nseg1.vtt\r\n\r\n' +
    '#EXTINF:6.0,\r\nhttps://other.example/seg2.vtt\r\n#EXT-X-ENDLIST';
  assert.deepEqual(parseMediaPlaylist(playlist, 'https://cdn.example/r/sub_en.m3u8'), [
    'https://cdn.example/r/seg1.vtt',
    'https://other.example/seg2.vtt'
  ]);
});

test('mergeCues: toglie i doppioni tra segmenti e ordina', () => {
  const a = [{ start: 5, end: 7, text: 'B' }, { start: 1, end: 2, text: 'A' }];
  const b = [{ start: 5, end: 7, text: 'B' }, { start: 8, end: 9, text: 'C' }];
  assert.deepEqual(mergeCues([a, b]).map((c) => c.text), ['A', 'B', 'C']);
});

// fetchText finto: url -> testo
function fakeFetch(files, calls) {
  return async (url) => {
    if (calls) calls.push(url);
    if (!(url in files)) throw new Error('404 ' + url);
    return { text: files[url], url };
  };
}

test('loadVttPlaylist: scarica e unisce i segmenti, ignora l\'intestazione X-TIMESTAMP-MAP', async () => {
  const base = 'https://cdn.example/r/';
  const files = {
    [base + 'sub_en.m3u8']: '#EXTM3U\n#EXTINF:6,\nseg1.vtt\n#EXTINF:6,\nseg2.vtt\n#EXT-X-ENDLIST',
    [base + 'seg1.vtt']: 'WEBVTT\nX-TIMESTAMP-MAP=MPEGTS:900000,LOCAL:00:00:00.000\n\n' +
      '00:00:01.000 --> 00:00:02.000\nUno\n\n00:00:05.000 --> 00:00:07.000\nA cavallo',
    [base + 'seg2.vtt']: 'WEBVTT\nX-TIMESTAMP-MAP=MPEGTS:900000,LOCAL:00:00:00.000\n\n' +
      '00:00:05.000 --> 00:00:07.000\nA cavallo\n\n00:00:08.000 --> 00:00:09.000\nTre'
  };
  const cues = await loadVttPlaylist(base + 'sub_en.m3u8', fakeFetch(files));
  assert.deepEqual(cues, [
    { start: 1, end: 2, text: 'Uno' },
    { start: 5, end: 7, text: 'A cavallo' },
    { start: 8, end: 9, text: 'Tre' }
  ]);
});

test('loadVttPlaylist: un segmento mancante lascia un buco, tutti mancanti è un errore', async () => {
  const base = 'https://cdn.example/r/';
  const files = {
    [base + 'p.m3u8']: '#EXTM3U\nok.vtt\nmissing.vtt',
    [base + 'ok.vtt']: 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nOk'
  };
  assert.deepEqual((await loadVttPlaylist(base + 'p.m3u8', fakeFetch(files))).map((c) => c.text), ['Ok']);
  const broken = { [base + 'q.m3u8']: '#EXTM3U\nx.vtt\ny.vtt' };
  await assert.rejects(loadVttPlaylist(base + 'q.m3u8', fakeFetch(broken)), /no segment could be downloaded/);
});

test('loadVttPlaylist: un URL che punta già a un WebVTT viene letto direttamente', async () => {
  const url = 'https://cdn.example/full.vtt';
  const calls = [];
  const files = { [url]: 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nDiretto' };
  const cues = await loadVttPlaylist(url, fakeFetch(files, calls));
  assert.equal(cues[0].text, 'Diretto');
  assert.deepEqual(calls, [url]);
});

test('loadVttPlaylist: concorrenza limitata a 6 richieste', async () => {
  const base = 'https://cdn.example/r/';
  const names = Array.from({ length: 20 }, (_, i) => 's' + i + '.vtt');
  let active = 0;
  let maxActive = 0;
  const fetchText = async (url) => {
    if (url.endsWith('.m3u8')) return { text: '#EXTM3U\n' + names.join('\n'), url };
    active++;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 2));
    active--;
    return { text: 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n' + url.slice(-7), url };
  };
  const cues = await loadVttPlaylist(base + 'p.m3u8', fetchText);
  assert.equal(cues.length, 20);
  assert.ok(maxActive <= 6, 'richieste contemporanee: ' + maxActive);
});

const { selectMainSegments, timestampOrigin, parseSegments } = require('../hls.js');

test('parseMasterSubtitles scarta le tracce forzate marcate solo nel nome', () => {
  const master = '#EXTM3U\n' +
    '#EXT-X-MEDIA:TYPE=SUBTITLES,NAME="Italiano--forced--",LANGUAGE="it",URI="f.m3u8"\n' +
    '#EXT-X-MEDIA:TYPE=SUBTITLES,NAME="Italiano",LANGUAGE="it",URI="n.m3u8"';
  assert.deepEqual(parseMasterSubtitles(master, 'https://cdn.example/m.m3u8').map((t) => t.label), ['Italiano']);
});

test('selectMainSegments: tiene il contenuto principale, senza sigle e schede doppiatori', () => {
  const urls = [
    'https://cdn.example/x_BUMPER_1/seg_0.vtt',
    'https://cdn.example/x-MAIN/seg_0.vtt?domain=1',
    'https://cdn.example/x-MAIN/seg_1.vtt',
    'https://cdn.example/x_DUB_CARD_1/seg_0.vtt'
  ];
  assert.deepEqual(selectMainSegments(urls), [urls[1], urls[2]]);
  const plain = ['https://cdn.example/a/seg_0.vtt', 'https://cdn.example/a/seg_1.vtt'];
  assert.deepEqual(selectMainSegments(plain), plain); // nessuna marcatura: tutti
  assert.deepEqual(selectMainSegments([urls[1], urls[2]]), [urls[1], urls[2]]); // tutti principali
  // "MAIN" dentro un'altra parola o nella query non conta
  const tricky = ['https://cdn.example/domain/a.vtt?x=-MAIN/', 'https://cdn.example/remainder/b.vtt'];
  assert.deepEqual(selectMainSegments(tricky), tricky);
});

test('timestampOrigin: origine dei tempi dichiarata dal segmento', () => {
  assert.equal(timestampOrigin('WEBVTT\nX-TIMESTAMP-MAP=MPEGTS:900000,LOCAL:00:00:00.000\n'), 10);
  assert.equal(timestampOrigin('WEBVTT\nX-TIMESTAMP-MAP=LOCAL:00:00:02.000,MPEGTS:900000\n'), 8);
  assert.equal(timestampOrigin('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nx'), null);
});

test('parseSegments: stessa origine = tempi invariati', () => {
  const head = 'WEBVTT\nX-TIMESTAMP-MAP=MPEGTS:900000,LOCAL:00:00:00.000\n\n';
  const lists = parseSegments([
    head + '00:00:01.000 --> 00:00:02.000\nA',
    head + '00:00:07.000 --> 00:00:08.000\nB'
  ]);
  assert.deepEqual(lists.map((l) => l[0].start), [1, 7]);
});

test('parseSegments: origine diversa = battute riportate sull\'origine del primo segmento', () => {
  const lists = parseSegments([
    'WEBVTT\nX-TIMESTAMP-MAP=MPEGTS:900000,LOCAL:00:00:00.000\n\n00:00:01.000 --> 00:00:02.000\nA',
    // tempi locali al segmento, che inizia 6 secondi dopo
    'WEBVTT\nX-TIMESTAMP-MAP=MPEGTS:1440000,LOCAL:00:00:00.000\n\n00:00:01.000 --> 00:00:02.000\nB'
  ]);
  assert.deepEqual(lists[0][0], { start: 1, end: 2, text: 'A' });
  assert.deepEqual(lists[1][0], { start: 7, end: 8, text: 'B' });
});

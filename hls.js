// sottotitoli WebVTT a segmenti dentro playlist HLS (Disney+)
(function (root) {
  'use strict';

  const Vtt = typeof module === 'object' && module.exports ? require('./vtt-parser.js') : root.DualSubsVtt;

  const MAX_PARALLEL = 6;
  const MAX_SEGMENTS = 5000;
  const CC_TAG = 'public.accessibility.describes-music-and-sound';
  // la playlist contiene anche sigle e schede doppiatori, in altre cartelle
  const MAIN_SEGMENT = /(^|[-_/])MAIN([-_/]|$)/i;

  // CHIAVE=valore,CHIAVE="valore, con virgole"
  function parseAttributes(list) {
    const attrs = {};
    for (const m of list.matchAll(/([A-Z0-9-]+)=("[^"]*"|[^,]*)/g)) {
      attrs[m[1]] = m[2].startsWith('"') ? m[2].slice(1, -1) : m[2];
    }
    return attrs;
  }

  function absolute(ref, base) {
    try {
      return new URL(ref, base).href;
    } catch (e) {
      return null;
    }
  }

  function lines(text) {
    return String(text).split(/\r?\n/).map((l) => l.trim());
  }

  // tracce di sottotitoli della playlist principale, senza quelle forzate
  function parseMasterSubtitles(text, baseUrl) {
    const tracks = [];
    const seen = new Set();
    for (const line of lines(text)) {
      if (!line.startsWith('#EXT-X-MEDIA:')) continue;
      const a = parseAttributes(line.slice(13));
      const name = a.NAME || a.LANGUAGE || '?';
      if (a.TYPE !== 'SUBTITLES' || !a.URI || a.FORCED === 'YES' || /forced/i.test(name)) continue;
      const url = absolute(a.URI, baseUrl);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      tracks.push({
        id: url,
        language: a.LANGUAGE || '',
        label: name,
        isClosedCaptions: (a.CHARACTERISTICS || '').includes(CC_TAG) || /\b(CC|SDH)\b/.test(name),
        url,
        format: 'hls-vtt',
        formats: [a['GROUP-ID'] || 'hls']
      });
    }
    return tracks;
  }

  function parseMediaPlaylist(text, baseUrl) {
    const urls = [];
    for (const line of lines(text)) {
      if (!line || line[0] === '#') continue;
      const url = absolute(line, baseUrl);
      if (url) urls.push(url);
      if (urls.length > MAX_SEGMENTS) throw new Error('too many segments in the playlist');
    }
    return urls;
  }

  // se solo alcuni segmenti sono marcati MAIN tiene quelli
  function selectMainSegments(urls) {
    const main = urls.filter((url) => MAIN_SEGMENT.test(url.split('?')[0]));
    return main.length && main.length < urls.length ? main : urls;
  }

  // origine dei tempi del segmento (X-TIMESTAMP-MAP) in secondi, null se manca
  function timestampOrigin(text) {
    const map = /X-TIMESTAMP-MAP=([^\r\n]*)/.exec(text.slice(0, 500));
    if (!map) return null;
    const mpegts = /MPEGTS:(\d+)/.exec(map[1]);
    const local = /LOCAL:([\d:.]+)/.exec(map[1]);
    if (!mpegts || !local) return null;
    const origin = mpegts[1] / 90000 - Vtt.parseTimestamp(local[1]);
    return Number.isNaN(origin) ? null : origin;
  }

  // di solito tutti i segmenti hanno la stessa origine e non cambia niente
  function parseSegments(texts) {
    let first = null;
    return texts.map((text) => {
      const cues = Vtt.parseVtt(text);
      const origin = timestampOrigin(text);
      if (origin === null) return cues;
      if (first === null) first = origin;
      const shift = origin - first;
      if (Math.abs(shift) < 0.001) return cues;
      return cues.map((c) => ({ start: c.start + shift, end: c.end + shift, text: c.text }));
    });
  }

  // una battuta a cavallo di due segmenti compare in entrambi
  function mergeCues(lists) {
    const seen = new Set();
    const merged = [];
    for (const cue of lists.flat()) {
      const key = cue.start + '|' + cue.end + '|' + cue.text;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(cue);
    }
    return merged.sort((a, b) => a.start - b.start);
  }

  // un segmento che fallisce lascia un buco, se falliscono tutti e' un errore
  async function fetchSegments(urls, fetchText) {
    const texts = new Array(urls.length).fill(null);
    let next = 0;
    async function worker() {
      while (next < urls.length) {
        const i = next++;
        try {
          texts[i] = (await fetchText(urls[i])).text;
        } catch (e) {
          // buco
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(MAX_PARALLEL, urls.length) }, worker));
    const ok = texts.filter((t) => t !== null);
    if (urls.length && !ok.length) throw new Error('no segment could be downloaded');
    return ok;
  }

  // fetchText(url) -> Promise<{ text, url }>
  async function loadVttPlaylist(url, fetchText) {
    const playlist = await fetchText(url);
    if (/^﻿?WEBVTT/.test(playlist.text)) return Vtt.parseVtt(playlist.text);
    const urls = selectMainSegments(parseMediaPlaylist(playlist.text, playlist.url || url));
    return mergeCues(parseSegments(await fetchSegments(urls, fetchText)));
  }

  const api = {
    parseAttributes, parseMasterSubtitles, parseMediaPlaylist, selectMainSegments,
    timestampOrigin, parseSegments, mergeCues, loadVttPlaylist
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DualSubsHls = api;
})(globalThis);

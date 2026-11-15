// WebVTT -> [{ start, end, text }]
(function (root) {
  'use strict';

  const TIMING = /^\s*(\S+)\s+-->\s+(\S+)/;
  const TIMESTAMP = /^(?:(\d+):)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})$/;
  const ENTITIES = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'',
    nbsp: ' ', lrm: '‎', rlm: '‏'
  };
  // quante battute indietro guardare per quelle sovrapposte
  const MAX_OVERLAP = 20;

  // "01:02:03.456" o "02:03.456" -> secondi
  function parseTimestamp(str) {
    const m = TIMESTAMP.exec(str);
    if (!m) return NaN;
    const ms = Number(m[4].padEnd(3, '0'));
    return Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + ms / 1000;
  }

  function decodeEntities(str) {
    return str.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => {
      if (code[0] !== '#') {
        const name = code.toLowerCase();
        return Object.hasOwn(ENTITIES, name) ? ENTITIES[name] : match;
      }
      const hex = code[1] === 'x' || code[1] === 'X';
      const n = parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10);
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : match;
    });
  }

  // toglie i tag (<c.xxx>, <i>, ...) e le righe vuote
  function cleanCueText(raw) {
    return decodeEntities(raw.replace(/<[^>]*>/g, ''))
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.replace(/[‎‏]/g, '') !== '')
      .join('\n');
  }

  function parseBlock(block) {
    const lines = block.split('\n');
    const i = lines.findIndex((line) => line.includes('-->'));
    if (i < 0 || /^NOTE\b/.test(lines[0])) return null;
    const m = TIMING.exec(lines[i]);
    if (!m) return null;
    const start = parseTimestamp(m[1]);
    const end = parseTimestamp(m[2]);
    const text = cleanCueText(lines.slice(i + 1).join('\n'));
    if (Number.isNaN(start) || Number.isNaN(end) || !text) return null;
    return { start, end, text };
  }

  function parseVtt(vtt) {
    if (typeof vtt !== 'string') return [];
    return vtt
      .replace(/^﻿/, '')
      .replace(/\r\n?/g, '\n')
      .split(/\n\s*\n/)
      .map(parseBlock)
      .filter(Boolean)
      .sort((a, b) => a.start - b.start);
  }

  // battute attive al tempo dato; cues deve essere ordinato per start
  function findActiveCues(cues, time) {
    let lo = 0;
    let hi = cues.length - 1;
    let last = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (cues[mid].start <= time) {
        last = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    const active = [];
    for (let i = last; i >= 0 && last - i < MAX_OVERLAP; i--) {
      if (cues[i].end > time) active.unshift(cues[i]);
    }
    return active;
  }

  const api = { parseVtt, parseTimestamp, decodeEntities, cleanCueText, findActiveCues };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DualSubsVtt = api;
})(globalThis);

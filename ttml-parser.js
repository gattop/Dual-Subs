// TTML/DFXP (Prime Video) -> [{ start, end, text }]
// niente DOMParser, cosi' gira anche in Node per i test
(function (root) {
  'use strict';

  const Vtt = typeof module === 'object' && module.exports ? require('./vtt-parser.js') : root.DualSubsVtt;

  // <p ...>...</p> anche con prefisso (<tt:p>), esclusi i <p/>
  const PARAGRAPH = /<((?:[\w-]+:)?p)\b([^>]*?)(?<!\/)>([\s\S]*?)<\/\1\s*>/g;
  const BR = /<(?:[\w-]+:)?br\b[^>]*>/gi;
  const CLOCK = /^(\d+):(\d{2}):(\d{2})(?:\.(\d+))?$/;
  const CLOCK_FRAMES = /^(\d+):(\d{2}):(\d{2}):(\d+(?:\.\d+)?)$/;
  const OFFSET = /^(\d+(?:\.\d+)?)(h|m|s|ms|f|t)$/;

  function attr(attrs, name) {
    const m = new RegExp('(?:^|\\s)(?:[\\w-]+:)?' + name + '\\s*=\\s*"([^"]*)"').exec(attrs);
    return m ? m[1].trim() : null;
  }

  // frameRate e tickRate della radice <tt>, servono per le unita' "f" e "t"
  function readTimeBase(xml) {
    const tt = /<(?:[\w-]+:)?tt\b([^>]*)>/.exec(xml);
    const attrs = tt ? tt[1] : '';
    // "1000 1001" porta 30 fps a 29.97
    const mult = /^(\d+)\s+(\d+)$/.exec(attr(attrs, 'frameRateMultiplier') || '');
    const ratio = mult && Number(mult[2]) > 0 ? Number(mult[1]) / Number(mult[2]) : 1;
    return {
      frameRate: (Number(attr(attrs, 'frameRate')) || 30) * ratio,
      tickRate: Number(attr(attrs, 'tickRate')) || 10000000
    };
  }

  // "01:02:03.456", "01:02:03:12" (frame), "12.5s", "500ms", "30f", "12345t"
  function parseTimeExpression(str, timeBase) {
    if (!str) return NaN;
    let m = CLOCK.exec(str);
    if (m) return m[1] * 3600 + m[2] * 60 + Number(m[3]) + Number('0.' + (m[4] || '0'));
    m = CLOCK_FRAMES.exec(str);
    if (m) return m[1] * 3600 + m[2] * 60 + Number(m[3]) + m[4] / timeBase.frameRate;
    m = OFFSET.exec(str);
    if (!m) return NaN;
    const unit = { h: 3600, m: 60, s: 1, ms: 0.001, f: 1 / timeBase.frameRate, t: 1 / timeBase.tickRate };
    return m[1] * unit[m[2]];
  }

  function parseTtml(xml) {
    if (typeof xml !== 'string') return [];
    const timeBase = readTimeBase(xml);
    const cues = [];
    for (const [, , attrs, inner] of xml.matchAll(PARAGRAPH)) {
      const start = parseTimeExpression(attr(attrs, 'begin'), timeBase);
      let end = parseTimeExpression(attr(attrs, 'end'), timeBase);
      if (Number.isNaN(end)) end = start + parseTimeExpression(attr(attrs, 'dur'), timeBase);
      const text = Vtt.cleanCueText(inner.replace(/\s+/g, ' ').replace(BR, '\n'));
      if (!Number.isNaN(start) && !Number.isNaN(end) && text) cues.push({ start, end, text });
    }
    return cues.sort((a, b) => a.start - b.start);
  }

  const api = { parseTtml, parseTimeExpression };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DualSubsTtml = api;
})(globalThis);

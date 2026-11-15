// traccia: { id, language, label, isClosedCaptions, url, format, formats }
(function (root) {
  'use strict';

  // 2 = stessa lingua, 1 = stesso prefisso ("en" e "en-us"), 0 = diversa
  function languageScore(a, b) {
    a = a.toLowerCase();
    b = b.toLowerCase();
    if (a === b) return 2;
    return a.split('-')[0] === b.split('-')[0] ? 1 : 0;
  }

  // choice: "en" oppure "en:cc"
  function pickTrack(tracks, choice) {
    const [wanted, kind] = String(choice).split(':');
    let best = null;
    let bestScore = 0;
    for (const t of tracks) {
      const lang = t.url ? languageScore(t.language, wanted) : 0;
      if (!lang) continue;
      const score = lang * 2 + (t.isClosedCaptions === (kind === 'cc') ? 1 : 0);
      if (score > bestScore) {
        best = t;
        bestScore = score;
      }
    }
    return best;
  }

  // senza url, per il popup
  function publicTracks(tracks) {
    return tracks.map((t) => ({
      id: t.id,
      language: t.language,
      label: t.label,
      isClosedCaptions: t.isClosedCaptions,
      usable: Boolean(t.url)
    }));
  }

  const api = { languageScore, pickTrack, publicTracks };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DualSubsTracks = api;
})(globalThis);

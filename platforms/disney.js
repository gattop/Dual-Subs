// Disney+: la risposta di riproduzione contiene l'url della playlist HLS
// principale (stream.sources[0].complete.url), da cui si leggono le tracce.
// video.currentTime non e' il tempo del programma (pubblicita' e sigle lo
// spostano): la posizione giusta la espone il player.
(function (root) {
  'use strict';

  const Hls = typeof module === 'object' && module.exports ? require('../hls.js') : root.DualSubsHls;

  const PLAYER_UI = 'disney-web-player-ui';
  const CONTROLS = 'main-app-controls-overlay';

  function readMasterUrl(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const box = value.data && typeof value.data === 'object' ? value.data : value;
    const sources = box.stream && box.stream.sources;
    const source = Array.isArray(sources) ? sources[0] : null;
    const url = source && source.complete && source.complete.url;
    return typeof url === 'string' && url ? url : null;
  }

  // /play/<id> o /video/<id>
  function routeId(pathname) {
    const m = /\/(?:video|play)\/([^/?#]+)\/?$/.exec(pathname || '');
    if (!m) return null;
    try {
      return decodeURIComponent(m[1]);
    } catch (e) {
      return m[1];
    }
  }

  function extractPlayback(value, pathname) {
    const masterUrl = readMasterUrl(value);
    if (!masterUrl) return null;
    return { movieId: routeId(pathname) || 'disney:' + masterUrl.split('?')[0], masterUrl };
  }

  // le tracce vanno lette scaricando la playlist
  function extract(value) {
    const found = extractPlayback(value, root.location.pathname);
    if (!found) return null;
    return {
      movieId: found.movieId,
      resultKeys: [],
      loadKey: found.movieId + '|' + found.masterUrl,
      loadTracks: async (fetchText) => {
        const master = await fetchText(found.masterUrl);
        return Hls.parseMasterSubtitles(master.text, master.url || found.masterUrl);
      }
    };
  }

  // ci sono piu' video (anche le anteprime): vince quello che sta andando
  function videoScore(v) {
    const area = v.clientWidth * v.clientHeight;
    if (!v.isConnected || !area) return -1;
    return Math.min(area / 10000, 100) +
      (v.readyState >= 2 ? 40 : 0) +
      (!v.paused && !v.ended ? 30 : 0) +
      (v.currentTime > 0 ? 10 : 0);
  }

  function findVideo() {
    let best = null;
    let bestScore = -1;
    for (const v of root.document.querySelectorAll('video')) {
      const score = videoScore(v);
      if (score > bestScore) {
        best = v;
        bestScore = score;
      }
    }
    return best;
  }

  function currentTitle() {
    return findVideo() ? routeId(root.location.pathname) : null;
  }

  // Il playhead del player si aggiorna a scatti, currentTime e' continuo ma ha
  // un'altra origine: si usa currentTime + (playhead - currentTime).
  function createProgramClock() {
    let offset = null;
    let lastPlayhead = null;

    function reset(playhead, media) {
      offset = playhead - media;
      lastPlayhead = playhead;
      return playhead;
    }

    // ritorna null quando i due orologi non sono d'accordo (dopo un salto)
    function time(playhead, media) {
      if (playhead === null) return offset === null ? media : media + offset;
      if (offset === null) return reset(playhead, media);
      const measured = playhead - media;
      if (Math.abs(measured - offset) <= 1.5) {
        // un playhead letto in ritardo da' uno scarto piu' piccolo del vero
        if (measured > offset) offset = measured;
        lastPlayhead = playhead;
        return media + offset;
      }
      // il video e' saltato ma il playhead non ancora: meglio niente che la scena vecchia
      if (Math.abs(playhead - lastPlayhead) < 0.5) return null;
      return reset(playhead, media);
    }

    return { time, getOffset: () => offset };
  }

  const clock = createProgramClock();
  const hosts = {};
  let warned = false;

  // proprieta' che il player appende ai suoi custom element
  function hostProp(selector, prop) {
    let el = hosts[selector];
    if (!el || !el.isConnected) el = hosts[selector] = root.document.querySelector(selector);
    return el ? el[prop] : undefined;
  }

  function readPlayhead() {
    const api = hostProp(PLAYER_UI, 'mediaPlayerApi');
    const ms = api && api.timeline && api.timeline.info && api.timeline.info.playheadPositionMs;
    return typeof ms === 'number' && Number.isFinite(ms) && ms >= 0 ? ms / 1000 : null;
  }

  // null durante pubblicita' e interruzioni
  function getTime(video) {
    let playhead = null;
    try {
      const store = hostProp(CONTROLS, 'store');
      if (store && store.interstitials && store.interstitials.isInterstitialPlaying) return null;
      playhead = readPlayhead();
    } catch (e) {
      // struttura del player cambiata, si usa il tempo del video
    }
    if (playhead === null && !warned && video.currentTime > 5) {
      warned = true;
      console.warn('[DualSubs] Disney+: program position not found, subtitles may be out of sync');
    }
    return clock.time(playhead, video.currentTime);
  }

  function debugInfo() {
    const offset = clock.getOffset();
    return ', program-video offset ' + (offset === null ? 'unknown' : offset.toFixed(2) + ' s');
  }

  const adapter = {
    name: 'disney',
    matches: (host) => /(^|\.)disneyplus\.com$/.test(host),
    beforeStringify: null,
    extract,
    currentTitle,
    findVideo,
    getTime,
    debugInfo,
    containerSelectors: [] // basta il genitore del video
  };

  if (typeof module === 'object' && module.exports) {
    module.exports = { readMasterUrl, routeId, extractPlayback, createProgramClock, adapter };
  } else {
    (root.DualSubsPlatforms = root.DualSubsPlatforms || []).push(adapter);
  }
})(globalThis);

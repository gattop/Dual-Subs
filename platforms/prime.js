// Prime Video: il player chiede GetVodPlaybackResources e la risposta contiene
// timedTextUrls.result.subtitleUrls, un file TTML per lingua. Si legge solo
// la risposta, la richiesta non viene toccata.
(function (root) {
  'use strict';

  // selettori non verificati sul sito
  const PLAYER_SELECTORS = ['.webPlayerSDKContainer', '.webPlayerContainer', '#dv-web-player', '[id^="dv-web-player"]'];
  const TIME_INDICATOR = '.atvwebplayersdk-timeindicator-text';
  // stessi domini di manifest.json
  const AMAZON_HOST = /(^|\.)amazon\.(com|co\.uk|de|it|fr|es|co\.jp|ca|com\.au|com\.br|com\.mx|in|nl|se|pl)$/;

  // type: Subtitle, Sdh, SubtitleMachineGenerated, ForcedNarrative
  function isUsable(sub) {
    return Boolean(sub && typeof sub === 'object' && sub.languageCode) &&
      sub.type !== 'ForcedNarrative' &&
      (!sub.subtype || sub.subtype === 'Dialog');
  }

  function normalizeTrack(sub) {
    const auto = sub.type === 'SubtitleMachineGenerated' ? ' [auto]' : '';
    return {
      id: sub.timedTextTrackId || sub.trackGroupId || sub.url,
      language: sub.languageCode,
      label: (sub.displayName || sub.languageCode) + auto,
      isClosedCaptions: sub.type === 'Sdh',
      url: typeof sub.url === 'string' ? sub.url : null,
      format: 'ttml',
      formats: [sub.format || '?']
    };
  }

  // titleId della richiesta, altrimenti id del catalogo, altrimenti dal primo url
  function titleIdOf(value, subs, requestUrl) {
    const m = /[?&]titleId=([^&#]+)/.exec(requestUrl || '');
    if (m) return decodeURIComponent(m[1]);
    const catalog = value.catalogMetadata && value.catalogMetadata.catalog;
    if (catalog && catalog.id) return String(catalog.id);
    const first = subs.find((s) => s && s.url);
    return first ? 'prime:' + first.url.split('?')[0].split('/').slice(-2).join('/') : 'prime:unknown';
  }

  function extractPlaybackResources(value, requestUrl) {
    if (!value || typeof value !== 'object' || !('timedTextUrls' in value)) return null;
    const result = value.timedTextUrls && value.timedTextUrls.result;
    const subs = result && Array.isArray(result.subtitleUrls) ? result.subtitleUrls : null;
    return {
      movieId: titleIdOf(value, subs || [], requestUrl),
      tracks: subs ? subs.filter(isUsable).map(normalizeTrack) : null,
      resultKeys: Object.keys(result || value.timedTextUrls || {})
    };
  }

  function biggestVideo(scope) {
    let best = null;
    let bestArea = 0;
    for (const v of scope.querySelectorAll('video')) {
      const area = v.clientWidth * v.clientHeight;
      if (v.isConnected && area > bestArea) {
        best = v;
        bestArea = area;
      }
    }
    return best;
  }

  // fuori dai contenitori noti vale solo un video largo almeno il 60% della finestra
  function findVideo() {
    for (const sel of PLAYER_SELECTORS) {
      const box = root.document.querySelector(sel);
      const v = box && biggestVideo(box);
      if (v) return v;
    }
    const v = biggestVideo(root.document);
    return v && v.clientWidth >= root.innerWidth * 0.6 ? v : null;
  }

  // il player si apre sopra la pagina del titolo senza cambiare url:
  // il titolo corrente e' l'ultimo arrivato, se il player e' visibile
  function currentTitle(ctx) {
    return findVideo() ? ctx.lastCapturedMovieId : null;
  }

  // per confrontare il tempo del video con quello mostrato dal player
  function debugInfo() {
    const el = root.document.querySelector(TIME_INDICATOR);
    return ', time shown by the player: ' + (el && el.textContent ? el.textContent.trim() : 'not found');
  }

  const adapter = {
    name: 'prime',
    matches: (host) => /(^|\.)primevideo\.com$/.test(host) || AMAZON_HOST.test(host),
    beforeStringify: null,
    extract: extractPlaybackResources,
    currentTitle,
    findVideo,
    debugInfo,
    containerSelectors: PLAYER_SELECTORS
  };

  if (typeof module === 'object' && module.exports) {
    module.exports = { extractPlaybackResources, adapter };
  } else {
    (root.DualSubsPlatforms = root.DualSubsPlatforms || []).push(adapter);
  }
})(globalThis);

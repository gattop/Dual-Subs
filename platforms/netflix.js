// Netflix: aggiunge il profilo WebVTT alla richiesta del manifest e legge le
// tracce dalla risposta. Tecnica presa da Subadub (MIT, Russel Simmons),
// vedi THIRD_PARTY_NOTICES.md.
(function (root) {
  'use strict';

  const WEBVTT_PROFILE = 'webvtt-lssdh-ios8';
  const KNOWN_PROFILES = [
    'heaac-2-dash', 'heaac-2hq-dash',
    'playready-h264mpl30-dash', 'playready-h264mpl31-dash',
    'playready-h264hpl30-dash', 'playready-h264hpl31-dash',
    'vp9-profile0-L30-dash-cenc', 'vp9-profile0-L31-dash-cenc',
    'dfxp-ls-sdh', 'simplesdh', 'nflx-cmisc', 'imsc1.1', 'BIF240', 'BIF320'
  ];
  // per quando Netflix aggiunge profili nuovi
  const PROFILE_LIKE = /(-dash|dfxp|simplesdh|imsc|webvtt|nflx-cmisc|^BIF\d)/i;

  // la lista si riconosce dal contenuto: il nome della proprieta' cambia spesso
  function isProfileList(value) {
    return Array.isArray(value) && value.length > 0 &&
      value.every((v) => typeof v === 'string') &&
      value.some((v) => KNOWN_PROFILES.includes(v) || PROFILE_LIKE.test(v));
  }

  function findProfileList(obj, path, depth, seen) {
    if (!obj || typeof obj !== 'object' || depth > 8 || seen.has(obj)) return null;
    seen.add(obj);
    if (isProfileList(obj)) return { list: obj, path };
    for (const key of Object.keys(obj)) {
      const found = findProfileList(obj[key], path + '.' + key, depth + 1, seen);
      if (found) return found;
    }
    return null;
  }

  // ritorna il percorso della lista modificata, o null
  function injectWebvttProfile(value) {
    if (!value || typeof value !== 'object') return null;
    const found = findProfileList(value, '$', 0, new WeakSet());
    if (!found || found.list.includes(WEBVTT_PROFILE)) return null;
    found.list.unshift(WEBVTT_PROFILE);
    return found.path;
  }

  // urls e' un array di { url } (formato nuovo) o un oggetto (vecchio)
  function firstUrl(urls) {
    if (!urls) return null;
    const first = Array.isArray(urls) ? urls[0] : Object.values(urls)[0];
    if (!first) return null;
    return typeof first === 'string' ? first : first.url || null;
  }

  // gestisce sia i nomi dei campi del 2026 sia quelli vecchi
  function normalizeTrack(t) {
    const downloads = t.downloadables || t.ttDownloadables || {};
    const webvtt = downloads[WEBVTT_PROFILE];
    return {
      id: t.id != null ? t.id : t.new_track_id,
      language: t.language || '',
      label: t.languageDescription || t.language || '?',
      isClosedCaptions: t.rawTrackType === 'closedcaptions',
      url: webvtt ? firstUrl(webvtt.urls) : null,
      format: 'vtt',
      formats: Object.keys(downloads)
    };
  }

  function extractManifest(value) {
    const result = value && value.result;
    if (!result || typeof result !== 'object' || !result.movieId) return null;
    const raw = result.textTracks || result.timedtexttracks;
    return {
      movieId: String(result.movieId),
      tracks: Array.isArray(raw)
        ? raw.filter((t) => t && !t.isForcedNarrative && !t.isNoneTrack).map(normalizeTrack)
        : null,
      resultKeys: Object.keys(result)
    };
  }

  function currentTitle() {
    const m = /\/watch\/(\d+)/.exec(root.location.pathname);
    return m ? m[1] : null;
  }

  const adapter = {
    name: 'netflix',
    matches: (host) => /(^|\.)netflix\.com$/.test(host),
    beforeStringify: injectWebvttProfile,
    extract: extractManifest,
    currentTitle,
    findVideo: () => root.document.querySelector('video'),
    containerSelectors: ['.watch-video--player-view', '[data-uia="player"]', '.watch-video']
  };

  if (typeof module === 'object' && module.exports) {
    module.exports = { WEBVTT_PROFILE, isProfileList, injectWebvttProfile, firstUrl, extractManifest, adapter };
  } else {
    (root.DualSubsPlatforms = root.DualSubsPlatforms || []).push(adapter);
  }
})(globalThis);

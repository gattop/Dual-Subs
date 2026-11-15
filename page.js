// Gira nella pagina (mondo MAIN): intercetta l'elenco dei sottotitoli, segue
// il cambio di titolo, scarica la traccia scelta e la passa all'overlay.
// Comunica con content.js via postMessage.
// Hook su JSON.parse/stringify come in Subadub (MIT, Russel Simmons),
// vedi THIRD_PARTY_NOTICES.md.
(function () {
  'use strict';

  // deve coincidere con la versione in manifest.json
  const BUILD_VERSION = '1.2.3';
  const SOURCE = 'dual-subs';
  // se l'id del titolo non corrisponde a nessun elenco, dopo questo tempo si usa l'ultimo
  const FALLBACK_DELAY = 8000;
  const RETRY_DELAY = 5000;
  const MAX_RETRIES = 3;

  const platform = (window.DualSubsPlatforms || []).find((p) => p.matches(location.hostname));
  if (!platform) return;

  const { DualSubsTracks: Tracks, DualSubsOverlay: Overlay } = window;
  const LOADERS = {
    vtt: async (url) => window.DualSubsVtt.parseVtt((await fetchText(url)).text),
    ttml: async (url) => window.DualSubsTtml.parseTtml((await fetchText(url)).text),
    'hls-vtt': (url) => window.DualSubsHls.loadVttPlaylist(url, fetchText)
  };

  let debug = false;
  try {
    // si attiva dalla console con localStorage.dualSubsDebug = '1'
    debug = localStorage.getItem('dualSubsDebug') === '1';
  } catch (e) {
    // storage non disponibile
  }

  let settings = null;
  const tracksByTitle = new Map();
  const cueCache = new Map(); // url -> battute
  const trackLoads = new Set(); // playlist Disney+ gia' richieste
  let lastCaptured = null;

  let titleId = null; // null fuori dal player
  let titleSince = 0;
  let warnedFallback = null;
  let activeKey = null; // "titolo|lingua" caricato o in caricamento
  let loadToken = 0;
  let loadStatus = null;
  let lastStatus = null;
  let retryKey = null;
  let retries = 0;

  function log(...args) {
    if (debug) console.log('[DualSubs]', ...args);
  }

  function warn(...args) {
    console.warn('[DualSubs]', ...args);
  }

  async function fetchText(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url.split('?')[0]);
    return { text: await res.text(), url: res.url || url };
  }

  function post(type, payload) {
    window.postMessage({ source: SOURCE, from: 'page', type, payload }, '*');
  }

  function postStatus(movieId, state, cueCount = 0) {
    const json = JSON.stringify({ movieId, state, cueCount });
    if (json === lastStatus) return;
    lastStatus = json;
    post('status', { movieId, state, cueCount });
  }


  function onParsed(value, via, url) {
    const found = platform.extract(value, url);
    if (!found) return;
    if (found.loadTracks) {
      if (trackLoads.has(found.loadKey)) return;
      trackLoads.add(found.loadKey);
      log('playback response for', found.movieId, '(' + via + '), loading track list');
      found.loadTracks(fetchText).then(
        (tracks) => storeTracks(found.movieId, tracks, via),
        (err) => {
          trackLoads.delete(found.loadKey);
          warn('could not load the track list for', found.movieId, err);
        }
      );
    } else if (found.tracks) {
      storeTracks(found.movieId, found.tracks, via);
    } else {
      warn('no text tracks in response for', found.movieId, '- keys:', found.resultKeys.join(', '));
    }
  }

  function storeTracks(movieId, tracks, via) {
    tracksByTitle.set(movieId, tracks);
    lastCaptured = movieId;
    // elenco nuovo dopo un errore: riprova
    if (loadStatus && loadStatus.movieId === movieId && ['unavailable', 'error'].includes(loadStatus.state)) {
      activeKey = null;
      retryKey = null;
    }
    if (debug) {
      log(platform.name, movieId, tracks.length, 'tracks (' + via + ')');
      console.table(tracks.map((t) => ({
        id: t.id,
        language: t.language,
        label: t.label,
        cc: t.isClosedCaptions,
        usable: Boolean(t.url),
        formats: t.formats.join(', ')
      })));
    }
    post('tracks', { movieId, tracks: Tracks.publicTracks(tracks) });
    update();
  }

  function hookJson() {
    if (platform.beforeStringify) {
      const stringify = JSON.stringify;
      JSON.stringify = function (value) {
        try {
          const path = platform.beforeStringify(value);
          if (path) log('WebVTT profile added at', path);
        } catch (err) {
          warn('JSON.stringify hook:', err);
        }
        return stringify.apply(this, arguments);
      };
    }

    const parse = JSON.parse;
    JSON.parse = function () {
      const value = parse.apply(this, arguments);
      try {
        onParsed(value, 'JSON.parse');
      } catch (err) {
        warn('JSON.parse hook:', err);
      }
      return value;
    };

    // fetch().json() e XHR con responseType "json" non passano da JSON.parse
    const json = Response.prototype.json;
    Response.prototype.json = function () {
      const url = this.url;
      const p = json.apply(this, arguments);
      p.then((value) => {
        try {
          if (/PlaybackResources/i.test(url)) log('response', url.split('?')[0], Object.keys(value || {}));
          onParsed(value, 'Response.json', url);
        } catch (err) {
          warn('Response.json hook:', err);
        }
      }, () => {});
      return p;
    };

    const send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function () {
      this.addEventListener('load', onXhrLoad);
      return send.apply(this, arguments);
    };
  }

  function onXhrLoad() {
    try {
      if (this.responseType === 'json') onParsed(this.response, 'XHR', this.responseURL);
    } catch (err) {
      warn('XHR hook:', err);
    }
  }


  async function load(movieId) {
    const key = movieId + '|' + settings.language;
    if (key !== retryKey) {
      retryKey = key;
      retries = 0;
    }
    activeKey = key;
    const token = ++loadToken;
    Overlay.setCues([]);

    const track = Tracks.pickTrack(tracksByTitle.get(movieId) || [], settings.language);
    if (!track) {
      log('language', settings.language, 'not available for', movieId);
      return setLoadStatus(movieId, 'unavailable');
    }
    if (cueCache.has(track.url)) return showCues(movieId, cueCache.get(track.url));

    log('loading', track.label, track.format, 'for', movieId);
    setLoadStatus(movieId, 'loading');
    try {
      const cues = await LOADERS[track.format](track.url);
      if (token !== loadToken) return;
      if (cues.length) cueCache.set(track.url, cues);
      else warn('no subtitle lines found (' + track.format + ')');
      showCues(movieId, cues);
    } catch (err) {
      if (token !== loadToken) return;
      warn('subtitle download failed:', err);
      setLoadStatus(movieId, 'error');
      // gli url scadono e la rete puo' avere problemi momentanei
      if (retries < MAX_RETRIES) {
        retries++;
        setTimeout(() => {
          if (activeKey !== key) return;
          activeKey = null;
          tick();
        }, RETRY_DELAY);
      }
    }
  }

  function showCues(movieId, cues) {
    if (cues.length) log(cues.length, 'lines, first at', cues[0].start.toFixed(1) + 's:', cues[0].text);
    Overlay.setCues(cues);
    setLoadStatus(movieId, 'loaded', cues.length);
  }

  function setLoadStatus(movieId, state, cueCount) {
    loadStatus = { movieId, state, cueCount };
    postStatus(movieId, state, cueCount);
  }

  function reset() {
    loadToken++;
    activeKey = null;
    retryKey = null;
    loadStatus = null;
    Overlay.setCues([]);
  }


  function checkTitle() {
    const id = platform.currentTitle({ lastCapturedMovieId: lastCaptured });
    if (id === titleId) return;
    log(id ? 'title ' + titleId + ' -> ' + id : 'left the player');
    titleId = id;
    titleSince = Date.now();
    reset();
    if (id) {
      Overlay.start();
      postStatus(null, 'waiting');
    } else {
      Overlay.stop();
      postStatus(null, 'idle');
    }
  }

  function resolveTitle() {
    if (tracksByTitle.has(titleId)) return titleId;
    if (!lastCaptured || Date.now() - titleSince < FALLBACK_DELAY) return null;
    if (warnedFallback !== titleId) {
      warnedFallback = titleId;
      warn('no track list for ' + titleId + ', using ' + lastCaptured);
    }
    return lastCaptured;
  }

  function update() {
    checkTitle();
    if (!settings || !titleId) return;
    const movieId = resolveTitle();
    if (!movieId) return postStatus(null, 'waiting');
    if (!settings.enabled) return postStatus(movieId, 'disabled');
    if (movieId + '|' + settings.language !== activeKey) return load(movieId);
    if (loadStatus) postStatus(loadStatus.movieId, loadStatus.state, loadStatus.cueCount);
  }

  function tick() {
    try {
      update();
    } catch (err) {
      warn(err);
    }
  }

  function hookHistory() {
    for (const name of ['pushState', 'replaceState']) {
      const original = history[name];
      history[name] = function () {
        const result = original.apply(this, arguments);
        tick();
        return result;
      };
    }
    window.addEventListener('popstate', tick);
  }

  window.addEventListener('message', (event) => {
    const data = event.data;
    if (event.source !== window || !data || data.source !== SOURCE) return;
    if (data.from !== 'content' || data.type !== 'settings') return;
    settings = data.payload;
    log('settings', settings);
    Overlay.setSettings(settings);
    tick();
  });

  hookJson();
  hookHistory();
  Overlay.init({
    log,
    warn,
    findVideo: platform.findVideo,
    getTime: platform.getTime || ((video) => video.currentTime),
    debugInfo: platform.debugInfo || (() => ''),
    containerSelectors: platform.containerSelectors
  });
  setInterval(tick, 1000);
  log('page.js ' + BUILD_VERSION + ' on ' + platform.name);
  post('page-ready', null);
})();

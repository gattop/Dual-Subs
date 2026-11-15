// Il <div> del secondo sottotitolo dentro il player. Si aggiorna a ogni frame
// (timeupdate arriva solo ~4 volte al secondo) e un MutationObserver lo
// rimette a posto se il sito ricrea il video o il player.
(function (root) {
  'use strict';

  const s = {
    active: false,
    video: null,
    box: null,
    text: null,
    cues: [],
    settings: null,
    lastText: null,
    lastTime: undefined,
    observer: null,
    checkTimer: null,
    frame: null,
    errorShown: false,
    // dall'adattatore della piattaforma
    findVideo: () => null,
    getTime: (video) => video.currentTime, // null = non mostrare niente
    debugInfo: () => '',
    containerSelectors: [],
    log: () => {},
    warn: () => {}
  };

  function init(options) {
    Object.assign(s, options);
    document.addEventListener('fullscreenchange', () => setTimeout(attach, 50));
  }

  function start() {
    if (s.active) return;
    s.active = true;
    s.observer = s.observer || new MutationObserver(onMutations);
    s.observer.observe(document.documentElement, { childList: true, subtree: true });
    attach();
    s.frame = requestAnimationFrame(onFrame);
  }

  function stop() {
    if (!s.active) return;
    s.active = false;
    s.observer.disconnect();
    cancelAnimationFrame(s.frame);
    bindVideo(null);
    if (s.box) s.box.remove();
    s.cues = [];
    s.lastText = null;
    s.lastTime = undefined;
  }

  function setCues(cues) {
    s.cues = cues;
    render(true);
  }

  function setSettings(settings) {
    s.settings = settings;
    applyStyle();
    render(true);
  }

  function applyStyle() {
    if (!s.box || !s.settings) return;
    s.box.className = s.settings.position === 'bottom' ? 'dual-subs-bottom' : 'dual-subs-top';
    s.box.style.setProperty('--dual-subs-scale', String(s.settings.scale));
  }

  // a schermo intero il div deve stare dentro l'elemento fullscreen
  function findContainer(video) {
    let box = null;
    for (const sel of s.containerSelectors) {
      box = video.closest(sel);
      if (box) break;
    }
    box = box || video.parentElement;
    const fs = document.fullscreenElement;
    if (fs && fs.contains(video) && !fs.contains(box)) box = fs;
    return box;
  }

  function bindVideo(video) {
    if (s.video) {
      s.video.removeEventListener('timeupdate', onTimeUpdate);
      s.video.removeEventListener('seeked', onSeeked);
    }
    s.video = video;
    if (!video) return;
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('seeked', onSeeked);
  }

  function attach() {
    if (!s.active) return;
    const video = s.findVideo();
    if (!video) return;
    if (video !== s.video) bindVideo(video);
    if (!s.box) {
      s.box = document.createElement('div');
      s.box.id = 'dual-subs-overlay';
      s.box.hidden = true;
      s.text = document.createElement('span');
      s.text.className = 'dual-subs-text';
      s.box.appendChild(s.text);
      applyStyle();
    }
    const container = findContainer(video);
    if (!container || s.box.parentElement === container) return;
    container.appendChild(s.box);
    s.log('overlay in', container.tagName.toLowerCase() + '.' + (container.classList[0] || ''));
    render(true);
  }

  // questi siti toccano il DOM di continuo: un controllo ogni 250 ms al massimo
  function onMutations() {
    if (!s.active || s.checkTimer) return;
    s.checkTimer = setTimeout(() => {
      s.checkTimer = null;
      const video = s.video;
      const ok = video && video.isConnected && s.findVideo() === video &&
        s.box.parentElement === findContainer(video);
      if (!ok) attach();
    }, 250);
  }

  function textAt(time) {
    if (time === null || !s.settings || !s.settings.enabled || !s.cues.length) return '';
    return root.DualSubsVtt.findActiveCues(s.cues, time).map((c) => c.text).join('\n');
  }

  function render(force) {
    if (!s.box) return;
    const time = s.video ? s.getTime(s.video) : null;
    if (!force && time === s.lastTime) return;
    s.lastTime = time;
    const text = textAt(time);
    if (!force && text === s.lastText) return;
    s.lastText = text;
    s.text.textContent = text;
    s.box.hidden = !text;
  }

  function safeRender() {
    try {
      render(false);
    } catch (err) {
      if (!s.errorShown) s.warn('overlay:', err);
      s.errorShown = true;
    }
  }

  function onFrame() {
    if (!s.active) return;
    safeRender();
    s.frame = requestAnimationFrame(onFrame);
  }

  // con la scheda in background i frame si fermano, timeupdate no
  function onTimeUpdate() {
    safeRender();
  }

  function onSeeked() {
    render(true);
    const v = s.video;
    const t = s.lastTime;
    s.log('seek: video ' + v.currentTime.toFixed(2) + 's, used ' +
      (typeof t === 'number' ? t.toFixed(2) + 's' : 'none') + s.debugInfo() + ', line:', s.lastText || '-');
  }

  root.DualSubsOverlay = { init, start, stop, setCues, setSettings };
})(globalThis);

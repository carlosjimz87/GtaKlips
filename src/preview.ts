// Clips have no interactive API. A floating cover settles before Twitch mounts.
export const previewScript = `
(() => {
  const owners = [...document.querySelectorAll('[data-preview]')];
  const hero = owners.find(el => el.hasAttribute('data-preview-hero'));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = matchMedia('(hover: hover) and (pointer: fine)');
  const wide = matchMedia('(min-width: 432px)');
  let active = null, hoverTimer = null, hoverOwner = null, leaveTimer = null, closing = null, observedHero = false, fullscreenSession = false;
  const autoAllowed = () => desktop.matches && !reduced.matches && !navigator.connection?.saveData;
  const clearHover = () => { clearTimeout(hoverTimer); hoverTimer = hoverOwner = null; };
  const clearLeave = () => { clearTimeout(leaveTimer); leaveTimer = null; };
  const clearTimers = () => { clearHover(); clearLeave(); };
  const inside = (root, target) => target instanceof Node && !!root?.contains(target);
  const headerBottom = () => Math.max(0, document.querySelector('header')?.getBoundingClientRect().bottom || 0);
  const viewportWidth = () => document.documentElement.clientWidth;
  const visible = el => {
    const box = el.getBoundingClientRect();
    return box.width >= 400 && box.height >= 300 && box.left >= -.5 && box.right <= viewportWidth() + .5 && box.top >= headerBottom() - .5 && box.bottom <= innerHeight + .5;
  };
  const ownerVisible = el => {
    const box = el.getBoundingClientRect(), rail = el.closest('.catalog-rail').getBoundingClientRect();
    return box.right > Math.max(0, rail.left) && box.left < Math.min(viewportWidth(), rail.right) && box.bottom > headerBottom() && box.top < innerHeight;
  };
  const discardClosing = () => {
    if (!closing) return;
    closing.animation.cancel(); closing.layer.remove(); closing = null;
  };
  const mark = (el, playing) => {
    el.classList.toggle('previewing', playing);
    const button = el.querySelector('[data-preview-toggle]');
    button.textContent = playing ? 'Detener vista previa' : 'Vista previa';
    button.setAttribute('aria-pressed', String(playing));
    if (el !== hero) {
      button.setAttribute('aria-expanded', String(playing));
      if (playing) button.setAttribute('aria-controls', 'clip-preview-layer');
      else button.removeAttribute('aria-controls');
    }
  };
  const stop = ({animate = true, restoreFocus = true, preserveHover = false} = {}) => {
    if (!preserveHover || hoverOwner === active?.el) clearHover();
    clearLeave();
    if (!active) return;
    const previous = active; active = null;
    const focused = previous.layer?.contains(document.activeElement);
    previous.animation?.cancel();
    previous.stage.querySelector('iframe')?.remove();
    mark(previous.el, false);
    previous.el.querySelector('.preview-status').textContent = 'Vista previa detenida.';
    if (!previous.layer) return;
    const layer = previous.layer;
    if (focused && restoreFocus) previous.el.querySelector('[data-preview-toggle]').focus({preventScroll: true});
    layer.setAttribute('aria-hidden', 'true'); layer.inert = true;
    if (animate && !reduced.matches && !document.hidden && layer.dataset.phase === 'ready') {
      layer.dataset.phase = 'closing';
      const animation = layer.animate([{opacity: 1}, {opacity: 0}], {duration: 140, easing: 'ease-out'});
      closing = {layer, animation};
      animation.finished.then(() => { layer.remove(); if (closing?.layer === layer) closing = null; }).catch(() => layer.remove());
    } else layer.remove();
  };
  const iframe = el => {
    const url = new URL('https://clips.twitch.tv/embed');
    url.searchParams.set('clip', el.dataset.preview);
    url.searchParams.set('parent', location.hostname);
    url.searchParams.set('autoplay', 'true'); url.searchParams.set('muted', 'true');
    const frame = document.createElement('iframe');
    frame.src = url.href; frame.title = 'Vista previa de ' + el.dataset.previewTitle;
    frame.allow = 'autoplay; fullscreen'; frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    return frame;
  };
  const finish = entry => {
    if (active !== entry) return;
    entry.animation?.cancel(); entry.animation = null;
    if (document.hidden || !wide.matches || !visible(entry.stage) || (entry.layer && !ownerVisible(entry.el))) {
      stop({animate: false}); return;
    }
    if (entry.layer) entry.layer.dataset.phase = 'ready';
    entry.stage.append(iframe(entry.el));
    entry.el.querySelector('.preview-status').textContent = 'Inicio sin sonido. Twitch puede pedir confirmación; si no arranca, abre el original en Twitch.';
  };
  const handoff = (event, el, layer) => {
    if (event.pointerType !== 'mouse' || document.fullscreenElement || fullscreenSession) return;
    if (inside(el, event.relatedTarget) || inside(layer, event.relatedTarget)) return;
    // Entering a cross-origin frame can report no related target.
    if (!event.relatedTarget && layer) {
      const box = layer.getBoundingClientRect();
      if (event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom) return;
    }
    if (hoverOwner === el) clearHover();
    if (active?.el !== el) return;
    clearLeave();
    leaveTimer = setTimeout(() => { if (active?.el === el) stop({preserveHover: true}); }, 130);
  };
  const makeLayer = el => {
    const width = Math.min(460, viewportWidth() - 24);
    if (width < 402 || !ownerVisible(el)) return null;
    const layer = document.createElement('section');
    layer.className = 'card-preview-layer'; layer.id = 'clip-preview-layer';
    layer.dataset.previewOwner = el.id; layer.dataset.phase = 'opening';
    layer.setAttribute('role', 'region');
    layer.setAttribute('aria-label', 'Vista previa de ' + el.dataset.previewTitle);
    layer.innerHTML = '<div class="layer-heading"><div><p class="eyebrow">VISTA PREVIA</p><h2></h2><p class="layer-creator"></p></div><button type="button" data-preview-close>Cerrar vista previa</button></div><div class="preview-stage"><span class="preview-placeholder">Vista previa · Twitch</span></div><div class="layer-footer"><a class="button primary" target="_blank" rel="noopener noreferrer">Ver en Twitch</a><p>Inicio sin sonido. Twitch puede pedir confirmación.</p></div>';
    layer.querySelector('h2').textContent = el.dataset.previewTitle;
    layer.querySelector('.layer-creator').textContent = 'Por ' + (el.querySelector('.creator strong')?.textContent || '') + ' · Twitch';
    layer.querySelector('a').href = 'https://clips.twitch.tv/' + el.dataset.preview;
    const stage = layer.querySelector('.preview-stage');
    const poster = el.querySelector('.poster img');
    if (poster?.naturalWidth) {
      const cover = poster.cloneNode(false); cover.alt = ''; cover.hidden = false;
      cover.removeAttribute('data-poster'); cover.removeAttribute('loading');
      cover.addEventListener('error', () => { cover.hidden = true; });
      stage.prepend(cover);
    }
    layer.style.width = width + 'px'; layer.style.top = (headerBottom() + 12) + 'px';
    el.after(layer);
    const height = layer.getBoundingClientRect().height, top = headerBottom() + 12;
    if (height > innerHeight - top - 12) { layer.remove(); return null; }
    const anchor = el.querySelector('.poster').getBoundingClientRect();
    layer.style.left = Math.max(12, Math.min(anchor.left + (anchor.width - width) / 2, viewportWidth() - width - 12)) + 'px';
    layer.style.top = Math.max(top, Math.min(anchor.top - 8, innerHeight - height - 12)) + 'px';
    layer.querySelector('[data-preview-close]').addEventListener('click', () => stop());
    layer.addEventListener('pointerenter', () => { if (active?.el === el) clearLeave(); });
    layer.addEventListener('pointerleave', event => handoff(event, el, layer));
    layer.addEventListener('focusout', event => {
      if (!inside(layer, event.relatedTarget) && !inside(el, event.relatedTarget) && active?.el === el) stop({restoreFocus: false});
    });
    return {layer, stage, anchor};
  };
  const start = (el, manual = false) => {
    clearTimers();
    if (active?.el === el) return;
    if (document.hidden || !wide.matches || (!manual && !autoAllowed()) || !/^[A-Za-z0-9_-]{1,100}$/.test(el.dataset.preview)) return;
    stop({animate: false, restoreFocus: false}); discardClosing();
    if (el === hero) {
      const stage = el.querySelector('.preview-stage');
      if (manual && !visible(stage)) stage.scrollIntoView({block: 'center', inline: 'nearest', behavior: 'instant'});
      if (!visible(stage)) return;
      active = {el, stage, layer: null, animation: null}; mark(el, true); finish(active); return;
    }
    const floating = makeLayer(el);
    if (!floating) {
      el.querySelector('.preview-status').textContent = 'No hay espacio para el reproductor completo. Abre el original en Twitch.'; return;
    }
    const {layer, stage, anchor} = floating;
    const entry = {el, layer, stage, animation: null}; active = entry; mark(el, true);
    el.querySelector('.preview-status').textContent = 'Abriendo vista previa.';
    if (manual) layer.querySelector('[data-preview-close]').focus({preventScroll: true});
    if (reduced.matches) { finish(entry); return; }
    const box = layer.getBoundingClientRect();
    const dx = anchor.left + anchor.width / 2 - box.left - box.width / 2;
    const dy = anchor.top + anchor.height / 2 - box.top - box.height / 2;
    entry.animation = layer.animate([
      {opacity: 0, transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + anchor.width / box.width + ',' + anchor.height / box.height + ')'},
      {opacity: 1, transform: 'translate(0px,0px) scale(1,1)'}
    ], {duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)'});
    entry.animation.finished.then(() => finish(entry)).catch(() => {});
  };
  for (const el of owners) {
    el.querySelector('.preview-toolbar').hidden = false;
    el.querySelector('[data-preview-toggle]').addEventListener('click', () => active?.el === el ? stop() : start(el, true));
    if (el !== hero) {
      el.querySelector('[data-preview-toggle]').setAttribute('aria-expanded', 'false');
      el.addEventListener('pointerenter', event => {
        if (active?.el === el) clearLeave();
        if (event.pointerType !== 'mouse' || !autoAllowed()) return;
        clearHover(); hoverOwner = el;
        hoverTimer = setTimeout(() => { hoverTimer = hoverOwner = null; start(el); }, 550);
      });
      el.addEventListener('pointerleave', event => handoff(event, el, active?.el === el ? active.layer : null));
      el.addEventListener('focusout', event => {
        if (active?.el === el && !inside(el, event.relatedTarget) && !inside(active.layer, event.relatedTarget)) stop({restoreFocus: false});
      });
    }
  }
  const check = () => {
    if (document.fullscreenElement || fullscreenSession) return;
    if (active && (!wide.matches || (active.layer ? !ownerVisible(active.el) || (active.layer.dataset.phase === 'ready' && !visible(active.stage)) : !visible(active.stage)))) stop({animate: false});
  };
  const observer = new IntersectionObserver(() => {
    check();
    if (hero && !observedHero && !active && visible(hero.querySelector('.preview-stage')) && autoAllowed() && !document.hidden) {
      observedHero = true; start(hero);
    }
  }, {threshold: [0, .5, 1]});
  for (const el of owners) observer.observe(el);
  addEventListener('scroll', () => { if (document.fullscreenElement || fullscreenSession) return; clearTimers(); if (active?.layer) stop({animate: false}); else check(); }, {passive: true, capture: true});
  addEventListener('resize', () => { if (document.fullscreenElement || fullscreenSession) return; clearTimers(); if (active?.layer) stop({animate: false}); else check(); });
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) { fullscreenSession = true; clearTimers(); }
    else requestAnimationFrame(() => requestAnimationFrame(() => { fullscreenSession = false; check(); }));
  });
  addEventListener('pagehide', () => { stop({animate: false, restoreFocus: false}); discardClosing(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { stop({animate: false, restoreFocus: false}); discardClosing(); } });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') stop(); });
  reduced.addEventListener('change', () => { if (reduced.matches) { stop({animate: false}); discardClosing(); } });
  navigator.connection?.addEventListener('change', () => { if (navigator.connection.saveData) stop({animate: false}); });
})();
`;

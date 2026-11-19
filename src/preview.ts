// Clips expose no interactive player API. Removing the iframe stops its playback.
export const previewScript = `
(() => {
  const players = [...document.querySelectorAll('[data-preview]')];
  const hero = players.find(el => el.hasAttribute('data-preview-hero'));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = matchMedia('(hover: hover) and (pointer: fine)');
  const wide = matchMedia('(min-width: 432px)');
  let active = null, timer = null, observedHero = false;
  const autoAllowed = () => desktop.matches && !reduced.matches && !navigator.connection?.saveData;
  const clearTimer = () => { clearTimeout(timer); timer = null; };
  const visible = el => {
    const box = el.getBoundingClientRect();
    const rail = el.closest('.catalog-rail')?.getBoundingClientRect();
    const headerBottom = document.querySelector('header')?.getBoundingClientRect().bottom || 0;
    const left = Math.max(0, rail?.left || 0);
    const right = Math.min(innerWidth, rail?.right ?? innerWidth);
    const top = Math.max(0, headerBottom, rail?.top || 0);
    const bottom = Math.min(innerHeight, rail?.bottom ?? innerHeight);
    return box.width >= 400 && box.height >= 300 && box.left >= left - .5 && box.right <= right + .5 && box.top >= top - .5 && box.bottom <= bottom + .5;
  };
  const stop = () => {
    clearTimer();
    if (!active) return;
    const el = active;
    active = null;
    el.querySelector('iframe')?.remove();
    el.classList.remove('previewing');
    el.querySelector('[data-preview-toggle]').textContent = 'Vista previa';
    el.querySelector('[data-preview-toggle]').setAttribute('aria-pressed', 'false');
    el.querySelector('.preview-status').textContent = 'Vista previa detenida.';
    if (el !== hero) el.querySelector('.preview-stage').hidden = true;
  };
  const start = (el, manual = false) => {
    clearTimer();
    if (active === el) return;
    if (document.hidden || !wide.matches || (!manual && !autoAllowed())) return;
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(el.dataset.preview)) return;
    stop();
    const stage = el.querySelector('.preview-stage');
    el.classList.add('previewing');
    stage.hidden = false;
    if (el !== hero) {
      const rail = el.closest('.catalog-rail');
      const bounds = rail.getBoundingClientRect();
      const box = stage.getBoundingClientRect();
      if (box.right > bounds.right) rail.scrollLeft += box.right - bounds.right + 4;
      else if (box.left < bounds.left) rail.scrollLeft -= bounds.left - box.left + 4;
    }
    if (manual && !visible(stage)) stage.scrollIntoView({block: 'center', inline: 'nearest', behavior: 'instant'});
    if (!visible(stage)) {
      el.classList.remove('previewing');
      if (el !== hero) stage.hidden = true;
      el.querySelector('.preview-status').textContent = 'Abre el original en Twitch o desplaza la tarjeta para ver el reproductor completo.';
      return;
    }
    const url = new URL('https://clips.twitch.tv/embed');
    url.searchParams.set('clip', el.dataset.preview);
    url.searchParams.set('parent', location.hostname);
    url.searchParams.set('autoplay', 'true');
    url.searchParams.set('muted', 'true');
    const iframe = document.createElement('iframe');
    iframe.src = url.href;
    iframe.title = 'Vista previa de ' + el.dataset.previewTitle;
    iframe.allow = 'autoplay; fullscreen';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    stage.append(iframe);
    active = el;
    el.querySelector('[data-preview-toggle]').textContent = 'Detener vista previa';
    el.querySelector('[data-preview-toggle]').setAttribute('aria-pressed', 'true');
    el.querySelector('.preview-status').textContent = 'Inicio sin sonido. Twitch puede pedir confirmación; si no arranca, abre el original en Twitch.';
  };
  for (const el of players) {
    const toolbar = el.querySelector('.preview-toolbar');
    toolbar.hidden = false;
    el.querySelector('[data-preview-toggle]').addEventListener('click', () => active === el ? stop() : start(el, true));
    if (el !== hero) {
      el.addEventListener('pointerenter', e => {
        if (e.pointerType !== 'mouse' || !autoAllowed()) return;
        clearTimer();
        timer = setTimeout(() => start(el), 550);
      });
      el.addEventListener('pointerleave', e => { if (e.pointerType !== 'mouse') return; clearTimer(); if (active === el) stop(); });
      el.addEventListener('focusout', e => { if (!el.contains(e.relatedTarget) && active === el) stop(); });
    }
  }
  const observer = new IntersectionObserver(() => {
    if (active && !visible(active.querySelector('.preview-stage'))) stop();
    if (hero && !observedHero && !active && visible(hero.querySelector('.preview-stage')) && autoAllowed() && !document.hidden) {
      observedHero = true;
      start(hero);
    }
  }, {threshold: [0, .5, 1]});
  for (const el of players) observer.observe(el);
  const check = () => { if (active && (!wide.matches || !visible(active.querySelector('.preview-stage')))) stop(); };
  addEventListener('scroll', check, {passive: true, capture: true});
  addEventListener('resize', check);
  addEventListener('pagehide', stop);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') stop(); });
  reduced.addEventListener('change', () => { if (reduced.matches) stop(); });
  navigator.connection?.addEventListener('change', () => { if (navigator.connection.saveData) stop(); });
})();
`;

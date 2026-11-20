// One active media session; provider scripts mount only after the fixed cover settles.
export const previewScript = `
(() => {
  const owners = [...document.querySelectorAll('[data-preview]')];
  const hero = owners.find(el => el.hasAttribute('data-preview-hero'));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = matchMedia('(hover: hover) and (pointer: fine)');
  const wide = matchMedia('(min-width: 432px)');
  let active = null, hoverTimer = null, hoverOwner = null, leaveTimer = null, closing = null, observedHero = false, fullscreenSession = false;
  const provider = el => el.dataset.provider || 'twitch';
  const name = el => provider(el) === 'youtube' ? 'YouTube' : provider(el) === 'x' ? 'X' : 'Twitch';
  const fits = el => provider(el) !== 'twitch' || wide.matches;
  const autoAllowed = () => desktop.matches && !reduced.matches && !navigator.connection?.saveData;
  const clearHover = () => { clearTimeout(hoverTimer); hoverTimer = hoverOwner = null; };
  const clearLeave = () => { clearTimeout(leaveTimer); leaveTimer = null; };
  const clearTimers = () => { clearHover(); clearLeave(); };
  const inside = (root, target) => target instanceof Node && !!root?.contains(target);
  const headerBottom = () => Math.max(0, document.querySelector('header')?.getBoundingClientRect().bottom || 0);
  const viewportWidth = () => document.documentElement.clientWidth;
  const visible = el => {
    const box = el.getBoundingClientRect();
    return box.width >= (el.dataset.provider === 'twitch' || !el.dataset.provider ? 400 : 200) && box.height >= (el.dataset.provider === 'twitch' || !el.dataset.provider ? 300 : 200) && box.left >= -.5 && box.right <= viewportWidth() + .5 && box.top >= headerBottom() - .5 && box.bottom <= innerHeight + .5;
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
    previous.player?.destroy?.(); previous.mount?.remove();
    previous.stage.querySelectorAll('iframe').forEach(frame => frame.remove());
    previous.playButton?.remove(); clearTimeout(previous.timeout);
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
  const scripts = new Map();
  const load = (key, url, ready) => {
    if (ready()) return Promise.resolve();
    if (scripts.has(key)) return scripts.get(key);
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = url; script.async = true;
      const timeout = setTimeout(() => { script.remove(); scripts.delete(key); reject(Error('timeout')); }, 8000);
      const done = () => { clearTimeout(timeout); resolve(); };
      script.onerror = () => { clearTimeout(timeout); scripts.delete(key); script.remove(); reject(Error('unavailable')); };
      if (key === 'youtube') window.onYouTubeIframeAPIReady = done;
      else script.onload = done;
      document.head.append(script);
    }); scripts.set(key, promise); return promise;
  };
  const finish = async entry => {
    if (active !== entry) return;
    entry.animation?.cancel(); entry.animation = null;
    entry.stage.dataset.provider = provider(entry.el);
    if (document.hidden || !fits(entry.el) || !visible(entry.stage) || (entry.layer && !ownerVisible(entry.el))) {
      stop({animate: false}); return;
    }
    if (entry.layer) entry.layer.dataset.phase = 'ready';
    const status = entry.el.querySelector('.preview-status');
    status.textContent = 'Inicio sin sonido. ' + name(entry.el) + ' puede pedir confirmación; si no arranca, abre el original en ' + name(entry.el) + '.';
    if (provider(entry.el) === 'twitch') { entry.stage.append(iframe(entry.el)); return; }
    const mount = document.createElement('div'); entry.mount = mount; entry.stage.append(mount);
    try {
      if (provider(entry.el) === 'youtube') {
        await load('youtube','https://www.youtube.com/iframe_api',() => !!window.YT?.Player);
        if (active !== entry) return;
        const frame = document.createElement('iframe');
        const url = new URL('https://www.youtube.com/embed/' + entry.el.dataset.preview);
        for (const [key,value] of Object.entries({enablejsapi:'1',origin:location.origin,playsinline:'1',controls:'1',autoplay:'1',mute:'1'})) url.searchParams.set(key,value);
        frame.src=url.href; frame.title='YouTube · '+entry.el.dataset.previewTitle; frame.allow='autoplay; fullscreen'; frame.allowFullscreen=true; frame.referrerPolicy='strict-origin-when-cross-origin'; mount.append(frame);
        const button = document.createElement('button'); entry.playButton = button; button.type='button'; button.textContent='Reproducir en YouTube';
        (entry.layer?.querySelector('.layer-footer') || entry.el.querySelector('.preview-toolbar')).append(button);
        button.onclick=()=>entry.player?.playVideo();
        entry.player=new window.YT.Player(frame,{events:{onReady:()=>{if(active!==entry)return;entry.player.mute();entry.player.playVideo();},onStateChange:event=>{if(active!==entry)return;if(event.data===1){button.hidden=true;status.textContent='Reproducción iniciada en YouTube. Controles disponibles en el vídeo.';}},onError:()=>{if(active!==entry)return;status.textContent='YouTube no disponible. Abre el original en YouTube.';button.hidden=false;}}});
      } else {
        status.textContent='Cargando publicación completa de X. Sin reproducción automática; abre el original si no está disponible.';
        await load('x','https://platform.twitter.com/widgets.js',()=>!!window.twttr?.widgets?.createTweet);
        if(active!==entry)return;
        let timer;
        const result=await Promise.race([window.twttr.widgets.createTweet(entry.el.dataset.preview,mount,{theme:'dark',dnt:true,conversation:'all',width:Math.floor(entry.stage.clientWidth)}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),8000);})]).finally(()=>clearTimeout(timer));
        if(active!==entry){mount.remove();return;}
        if(!result)throw Error('unavailable');
        status.textContent='Publicación de X. Usa sus controles; no se garantiza reproducción ni disponibilidad.';
      }
    } catch { if(active===entry){mount.remove();status.textContent=name(entry.el)+' no disponible. Abre el original.';} }
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
  const focusHandoff = (event, el, layer) => {
    const expected = active;
    if (expected?.el !== el) return;
    const left = target => !inside(el, target) && !inside(layer, target);
    if (event.relatedTarget) { if (left(event.relatedTarget)) stop({restoreFocus: false}); return; }
    // Cross-origin iframe focus can have a null relatedTarget. Check the settled
    // parent focus instead of destroying the player during its own play click.
    setTimeout(() => { if (active === expected && left(document.activeElement)) stop({restoreFocus: false}); }, 0);
  };
  const makeLayer = el => {
    const width = Math.min(460, viewportWidth() - 24);
    if (width < (provider(el) === 'twitch' ? 402 : 222) || !ownerVisible(el)) return null;
    const layer = document.createElement('section');
    layer.className = 'card-preview-layer'; layer.id = 'clip-preview-layer';
    layer.dataset.previewOwner = el.id; layer.dataset.phase = 'opening';
    layer.setAttribute('role', 'region');
    layer.setAttribute('aria-label', 'Vista previa de ' + el.dataset.previewTitle);
    layer.innerHTML = '<div class="layer-heading"><div><p class="eyebrow">VISTA PREVIA</p><h2></h2><p class="layer-creator"></p></div><button type="button" data-preview-close>Cerrar vista previa</button></div><div class="preview-stage"><span class="preview-placeholder">Vista previa · Twitch</span></div><div class="layer-footer"><a class="button primary" target="_blank" rel="noopener noreferrer">Ver en Twitch</a><p>Inicio sin sonido. Twitch puede pedir confirmación.</p></div>';
    layer.dataset.provider = provider(el);
    layer.querySelector('.preview-placeholder').textContent = 'Vista previa · ' + name(el);
    layer.querySelector('a').textContent = 'Ver en ' + name(el);
    layer.querySelector('.layer-footer p').textContent = provider(el) === 'x' ? 'Publicación completa; activa el vídeo desde X.' : 'Inicio sin sonido. El proveedor puede pedir confirmación.';
    layer.querySelector('h2').textContent = el.dataset.previewTitle;
    layer.querySelector('.layer-creator').textContent = 'Por ' + (el.querySelector('.creator strong')?.textContent || '') + ' · ' + name(el);
    layer.querySelector('a').href = el.dataset.sourceUrl || 'https://clips.twitch.tv/' + el.dataset.preview;
    const stage = layer.querySelector('.preview-stage'); stage.dataset.provider = provider(el); stage.dataset.orientation = el.dataset.orientation || 'auto';
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
    layer.addEventListener('focusout', event => focusHandoff(event, el, layer));
    return {layer, stage, anchor};
  };
  const start = (el, manual = false) => {
    clearTimers();
    if (active?.el === el) return;
    if (document.hidden || !fits(el) || (!manual && (!autoAllowed() || provider(el) === 'x')) || !/^[A-Za-z0-9_-]{1,100}$/.test(el.dataset.preview)) return;
    stop({animate: false, restoreFocus: false}); discardClosing();
    if (el === hero) {
      const stage = el.querySelector('.preview-stage'); stage.dataset.provider = provider(el); stage.dataset.orientation = el.dataset.orientation || 'auto';
      if (manual && !visible(stage)) stage.scrollIntoView({block: 'center', inline: 'nearest', behavior: 'instant'});
      if (!visible(stage)) return;
      active = {el, stage, layer: null, animation: null}; mark(el, true); finish(active); return;
    }
    const floating = makeLayer(el);
    if (!floating) {
      el.querySelector('.preview-status').textContent = 'No hay espacio para el reproductor completo. Abre el original.'; return;
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
    const stage=el.querySelector('.preview-stage'); if(stage)stage.dataset.provider=provider(el);
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
      el.addEventListener('focusout', event => focusHandoff(event, el, active?.el === el ? active.layer : null));
    }
  }
  const check = () => {
    if (document.fullscreenElement || fullscreenSession) return;
    if (active && (!fits(active.el) || (active.layer ? !ownerVisible(active.el) || (active.layer.dataset.phase === 'ready' && !visible(active.stage)) : !visible(active.stage)))) stop({animate: false});
  };
  const observer = new IntersectionObserver(() => {
    check();
    if (hero && !observedHero && !active && visible(hero.querySelector('.preview-stage')) && autoAllowed() && !document.hidden) {
      observedHero = true; start(hero);
    }
  }, {threshold: [0, .5, 1]});
  for (const el of owners) observer.observe(el);
  addEventListener('scroll', event => { if (active && provider(active.el) === 'x' && inside(active.stage,event.target)) return; if (document.fullscreenElement || fullscreenSession) return; clearTimers(); if (active?.layer) stop({animate: false}); else check(); }, {passive: true, capture: true});
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

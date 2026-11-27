// One shared screen. Provider frames are mounted only after explicit intent.
export const previewScript = `
(() => {
  const screen = document.querySelector('[data-preview-hero]');
  if (!screen) return;
  const stage = screen.querySelector('.preview-stage');
  const status = screen.querySelector('.preview-status');
  const toggle = screen.querySelector('[data-preview-toggle]');
  const cards = [...document.querySelectorAll('.catalog-card[data-preview]')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = matchMedia('(hover:hover) and (pointer:fine)');
  const initial = {...screen.dataset};
  let selected = screen, active = null, hoverTimer, focusReturn = null;
  const scripts = new Map();
  const name = () => ({youtube:'YouTube',twitch:'Twitch',x:'X'}[screen.dataset.provider] || 'source');
  const state = (value, message) => { screen.dataset.playback=value; status.textContent=message; };
  const enoughRoom = () => stage.clientWidth >= (screen.dataset.provider==='twitch'?400:200) && (screen.dataset.provider==='x' || stage.clientHeight >= (screen.dataset.provider==='twitch'?300:200));
  const visible = () => { const b=stage.getBoundingClientRect(); return b.bottom>80 && b.top<innerHeight*.8; };
  const stop = (message='Ready to watch.') => {
    clearTimeout(hoverTimer);
    const old=active; active=null;
    if(old){clearTimeout(old.timeout);old.player?.destroy?.();old.mount.remove();}
    screen.classList.remove('previewing');
    toggle.textContent='Play';toggle.setAttribute('aria-pressed','false');
    cards.forEach(c=>{c.classList.remove('previewing');const b=c.querySelector('[data-preview-toggle]');if(b)b.setAttribute('aria-pressed','false');});
    state('idle',message);
  };
  const load = (key,url,ready) => {
    if(ready())return Promise.resolve();
    if(scripts.has(key))return scripts.get(key);
    const promise=new Promise((resolve,reject)=>{
      const script=document.createElement('script'); script.src=url; script.async=true;
      const fail=()=>{clearTimeout(timer);script.remove();scripts.delete(key);reject(Error('unavailable'));};
      const timer=setTimeout(fail,8000);
      const done=()=>{clearTimeout(timer);resolve();};
      script.onerror=fail;
      if(key==='youtube'){const previous=window.onYouTubeIframeAPIReady;window.onYouTubeIframeAPIReady=()=>{try{previous?.();}finally{done();}};}
      else script.onload=done;
      document.head.append(script);
    }); scripts.set(key,promise);return promise;
  };
  const select = el => {
    if(selected===el)return;
    stop(); selected=el;
    const data=el===screen?initial:el.dataset;
    for(const key of ['provider','sourceUrl','orientation','preview','previewTitle'])screen.dataset[key]=data[key]||'';
    stage.dataset.provider=data.provider;stage.dataset.orientation=data.orientation||'auto';
    const set=(selector,text)=>{const node=screen.querySelector(selector);if(node)node.textContent=text||'';};
    set('[data-cinema-title]',data.previewTitle);
    set('[data-cinema-credit]',data.previewCredit||el.querySelector('.creator strong')?.textContent);
    set('[data-cinema-context]',data.previewContext||el.querySelector('.clip-caption')?.textContent);
    const source=screen.querySelector('.preview-source');source.href=data.sourceUrl;source.textContent='Open original on '+name();
    stage.querySelectorAll('img').forEach(img=>img.remove());
    const poster=data.previewPoster||el.querySelector('.poster img')?.getAttribute('src');
    if(poster){const img=document.createElement('img');img.src=poster;img.alt='';img.decoding='async';img.onerror=()=>img.remove();stage.prepend(img);}
    cards.forEach(c=>{const chosen=c===el;c.classList.toggle('is-selected',chosen);if(chosen)c.setAttribute('aria-current','true');else c.removeAttribute('aria-current');});
    state('idle','Ready to watch on '+name()+'.');
    document.dispatchEvent(new CustomEvent('gtaklips:selection',{detail:{id:el.id}}));
  };
  const start = async (el,manual=true) => {
    clearTimeout(hoverTimer);
    if(document.hidden)return;
    if(!manual && (active?.manual || reduced.matches || navigator.connection?.saveData || !desktop.matches || !visible() || el.dataset.provider==='x'))return;
    if(!/^[A-Za-z0-9_-]{1,100}$/.test(el.dataset.preview||''))return;
    if(active && selected===el){if(manual)active.manual=true;return;}
    select(el); stop();
    if(manual && !visible())screen.scrollIntoView({block:'start',behavior:reduced.matches?'instant':'smooth'});
    if(!enoughRoom()){state('unavailable','The full '+name()+' player does not fit here. Open the original.');return;}
    focusReturn=el.querySelector('[data-preview-toggle]');
    const mount=document.createElement('div');mount.className='cinema-mount';stage.append(mount);
    const entry={mount,manual,player:null,timeout:null};active=entry;
    screen.classList.add('previewing');stage.dataset.provider=screen.dataset.provider;
    toggle.textContent='Stop';toggle.setAttribute('aria-pressed','true');
    state('loading','Loading '+name()+'…');
    const fail=()=>{if(active!==entry)return;clearTimeout(entry.timeout);entry.player?.destroy?.();mount.replaceChildren();state('error',name()+' is unavailable. Open the original or stop and retry.');};
    try{
      if(screen.dataset.provider==='x'){
        await load('x','https://platform.twitter.com/widgets.js',()=>!!window.twttr?.widgets?.createTweet);
        if(active!==entry)return;
        let timer;
        const result=await Promise.race([window.twttr.widgets.createTweet(screen.dataset.preview,mount,{theme:'dark',dnt:true,conversation:'all',width:Math.min(550,Math.floor(stage.clientWidth))}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),10000);})]).finally(()=>clearTimeout(timer));
        if(active!==entry){mount.remove();return;}
        if(!result)throw Error('unavailable');
        state('ready','Post loaded. Use the controls in the original X post.');
      }else{
        const youtube=screen.dataset.provider==='youtube';
        if(youtube)await load('youtube','https://www.youtube.com/iframe_api',()=>!!window.YT?.Player);
        if(active!==entry)return;
        const frame=document.createElement('iframe');
        const url=new URL(youtube?'https://www.youtube.com/embed/'+screen.dataset.preview:'https://clips.twitch.tv/embed');
        const params=youtube?{enablejsapi:'1',origin:location.origin,playsinline:'1',controls:'1',autoplay:'1',mute:'1'}:{clip:screen.dataset.preview,parent:location.hostname,autoplay:'true',muted:'true'};
        for(const [key,value]of Object.entries(params))url.searchParams.set(key,value);
        frame.src=url.href;frame.title=name()+' — '+screen.dataset.previewTitle;frame.allow='autoplay; fullscreen';frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';
        frame.onerror=fail;
        frame.onload=()=>{if(active!==entry)return;if(!youtube){clearTimeout(entry.timeout);state('ready','Player loaded. Use its controls to play or enable sound.');}};
        mount.append(frame);entry.timeout=setTimeout(()=>{if(active===entry)state('blocked','If playback has not started, use the player controls or open the original.');},10000);
        if(youtube)entry.player=new window.YT.Player(frame,{events:{onReady:()=>{if(active!==entry)return;state('ready','Player ready. Starts muted; use its controls for sound.');entry.player.mute();entry.player.playVideo();},onStateChange:event=>{if(active!==entry)return;if(event.data===1){clearTimeout(entry.timeout);state('playing','Playing on YouTube.');}else if(event.data===2){clearTimeout(entry.timeout);state('paused','Paused.');}else if(event.data===0){clearTimeout(entry.timeout);state('ended','Finished. Choose another clip below.');}},onError:fail}});
      }
    }catch{fail();}
  };
  screen.querySelector('.preview-toolbar').hidden=false;
  toggle.textContent='Play';
  toggle.addEventListener('click',()=>active?stop():start(selected));
  for(const card of cards){
    const button=card.querySelector('[data-preview-toggle]');
    if(button){card.querySelector('.preview-toolbar').hidden=false;button.textContent='Play';button.addEventListener('click',()=>start(card));}
    card.querySelector('.clip-link')?.addEventListener('click',event=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();start(card);});
    card.addEventListener('pointerenter',event=>{if(event.pointerType!=='mouse')return;clearTimeout(hoverTimer);hoverTimer=setTimeout(()=>start(card,false),650);});
    card.addEventListener('pointerleave',()=>{clearTimeout(hoverTimer);if(active&&!active.manual&&selected===card)stop();});
  }
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&active){stop();focusReturn?.focus({preventScroll:true});}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  addEventListener('pagehide',()=>stop());
  addEventListener('resize',()=>{if(active&&!document.fullscreenElement&&!enoughRoom())stop('Player no longer fits. Open the original.');});
  reduced.addEventListener('change',()=>{if(reduced.matches&&active&&!active.manual)stop();});
  navigator.connection?.addEventListener('change',()=>{if(navigator.connection.saveData&&active&&!active.manual)stop();});
  document.addEventListener('gtaklips:filter',()=>{clearTimeout(hoverTimer);if(active&&!active.manual)stop();});
  const observer=new IntersectionObserver(()=>{if(active&&!visible()&&!document.fullscreenElement)stop();},{threshold:0});observer.observe(stage);
})();
`;

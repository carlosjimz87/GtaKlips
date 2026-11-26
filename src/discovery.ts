/** Progressive enhancement: stable card nodes, local discovery, shareable URL state. */
export const discoveryScript = `
(() => {
const root = document.querySelector('[data-discovery]');
if (!root) return;
const grid = root.querySelector('.catalog-grid');
const cards = [...grid.querySelectorAll('.catalog-card')];
const input = root.querySelector('#clip-search');
const form = root.querySelector('.catalog-search');
const sort = root.querySelector('[name=sort]');
const links = [...root.querySelectorAll('.filters a')];
const count = root.querySelector('.result-count');
const empty = root.querySelector('.empty-results');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const normalize = s => s.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLocaleLowerCase('en');
let category = new URL(location.href).searchParams.get('categoria') || '';
let revision = 0;
let pending;
const animations = new Set();
const animate = (node, frames, options) => {
 if (motion.matches || !node.animate) return;
 const animation = node.animate(frames, options);
 animations.add(animation);
 animation.finished.catch(() => {}).finally(() => animations.delete(animation));
};
function update(writeHistory = true) {
 const current = ++revision;
 for (const animation of animations) animation.cancel();
 animations.clear();
 const q = normalize(input.value.trim().slice(0,80));
 const wanted = cards.filter(c => (!category || c.dataset.category === category) && (!q || c.dataset.search.includes(q)));
 wanted.sort((a,b) => sort.value === 'title' ? a.dataset.previewTitle.localeCompare(b.dataset.previewTitle) : sort.value === 'duration' ? (Number(a.dataset.duration) || Infinity) - (Number(b.dataset.duration) || Infinity) : Number(a.dataset.order) - Number(b.dataset.order));
 const before = new Map(cards.filter(c => !c.hidden).map(c => [c,c.getBoundingClientRect()]));
 const leaving = cards.filter(c => !c.hidden && !wanted.includes(c));
 const commit = () => {
  if (current !== revision) return;
  for (const c of cards) c.hidden = !wanted.includes(c);
  for (const c of wanted) grid.append(c);
  for (const c of wanted) {
   const old = before.get(c), rect = c.getBoundingClientRect();
   if (old) {
    const x=old.left-rect.left, y=old.top-rect.top;
    if (x || y) animate(c,[{transform:'translate('+x+'px,'+y+'px)'},{transform:'none'}],{duration:260,easing:'cubic-bezier(.2,.7,.2,1)'});
   } else animate(c,[{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'none'}],{duration:220,easing:'ease-out'});
  }
  empty.hidden = !!wanted.length;
  count.textContent = wanted.length + (wanted.length === 1 ? ' clip' : ' clips');
  grid.dispatchEvent(new CustomEvent('gtaklips:filter',{bubbles:true,detail:{visibleIds:wanted.map(c=>c.id)}}));
 };
 for (const c of leaving) animate(c,[{opacity:1},{opacity:0}],{duration:140,fill:'forwards'});
 clearTimeout(pending);
 if (leaving.length && !motion.matches) pending=setTimeout(commit,140); else commit();
 for (const link of links) {
  if (link.dataset.category === category) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current');
 }
 const hiddenCategory = form.querySelector('[name=categoria]');
 if (hiddenCategory) hiddenCategory.value=category;
 if (writeHistory) {
  const url = new URL(location.href);
  for (const [key,value] of [['categoria',category],['q',input.value.trim()],['sort',sort.value === 'editorial' ? '' : sort.value]]) {
   if (value) url.searchParams.set(key,value); else url.searchParams.delete(key);
  }
  history.pushState({discovery:true},'',url);
 }
}
root.querySelector('.catalog-sort').hidden=false;
for (const link of links) link.addEventListener('click',event=>{
 if(event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
 event.preventDefault(); category=link.dataset.category; update();
});
form.addEventListener('submit',event=>{event.preventDefault();update();});
let searchTimer;
input.addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>update(),180);});
sort.addEventListener('change',()=>update());
root.querySelector('[data-clear-filters]').addEventListener('click',event=>{event.preventDefault();category='';input.value='';sort.value='editorial';update();});
function restore(){const params=new URL(location.href).searchParams; category=params.get('categoria') || '';input.value=(params.get('q') || '').slice(0,80);sort.value=['title','duration'].includes(params.get('sort')) ? params.get('sort') : 'editorial';update(false);}
addEventListener('popstate',restore);
restore();
motion.addEventListener('change',()=>{for(const animation of animations) animation.cancel();});
const share=document.querySelector('[data-share-edition]');
if(share && navigator.clipboard?.writeText){share.hidden=false;share.addEventListener('click',async()=>{const status=document.querySelector('.share-status');try{await navigator.clipboard.writeText(location.href);status.textContent='Edition link copied.';}catch{status.textContent='Copy the address from your browser to share.';}});}
for(const link of document.querySelectorAll('a[href="#buscar"]')) link.addEventListener('click',()=>requestAnimationFrame(()=>input.focus({preventScroll:true})));
if(location.hash==='#buscar')requestAnimationFrame(()=>input.focus({preventScroll:true}));
for(const image of document.querySelectorAll('img[data-poster]')){const fallback=()=>{image.hidden=true;image.parentElement.classList.add('image-unavailable');};image.addEventListener('error',fallback);if(image.complete && !image.naturalWidth)fallback();}
})();
`;

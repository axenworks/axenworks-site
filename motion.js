/* Axencraft motion: the tape measure, things that slide in as you reach them,
   the flying basket dot and the short messages (toasts). Safe to load on any page. */
(function(){
  var root=document.documentElement;
  root.classList.add('js');
  var still=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* tape measure along the top of the window */
  function tape(){
    if(document.body.hasAttribute('data-no-tape'))return;
    var t=document.createElement('div');t.className='tapebar';t.setAttribute('aria-hidden','true');document.body.appendChild(t);
    var tick=false;
    function set(){tick=false;var h=root.scrollHeight-innerHeight;t.style.setProperty('--p',h>0?Math.min(1,scrollY/h):0)}
    addEventListener('scroll',function(){if(!tick){tick=true;requestAnimationFrame(set)}},{passive:true});
    addEventListener('resize',set);set();
  }

  /* slide in when reached. Children of [data-stagger] get a growing delay. */
  function reveal(scope){
    (scope||document).querySelectorAll('[data-stagger]').forEach(function(g){
      Array.prototype.forEach.call(g.children,function(c,i){if(!c.hasAttribute('data-reveal'))c.setAttribute('data-reveal',g.getAttribute('data-stagger')||'');c.style.setProperty('--i',i%8)});
    });
    var els=(scope||document).querySelectorAll('[data-reveal]:not(.in)');
    if(still||!('IntersectionObserver' in window)){els.forEach(function(e){e.classList.add('in')});return}
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{rootMargin:'0px 0px -8% 0px',threshold:.08});
    els.forEach(function(e){io.observe(e)});
  }

  /* a coloured dot that flies from what you tapped into the basket */
  function fly(from,colour){
    var to=document.querySelector('.shopbar.on button')||document.querySelector('[data-basket]');
    if(!from||!to)return;
    var targets=Array.prototype.filter.call(document.querySelectorAll('[data-basket]'),function(b){return b.offsetParent!==null});
    if(document.querySelector('.shopbar.on'))to=document.querySelector('.shopbar.on button');else if(targets.length)to=targets[0];
    var count=to.querySelector&&to.querySelector('.bk-count');
    function bump(){document.querySelectorAll('.bk-count').forEach(function(c){c.classList.remove('bump');void c.offsetWidth;c.classList.add('bump')})}
    if(still||!to.getBoundingClientRect){bump();return}
    var a=from.getBoundingClientRect(),b=(count||to).getBoundingClientRect();
    var x0=a.left+a.width/2,y0=a.top+a.height/2,x1=b.left+b.width/2,y1=b.top+b.height/2;
    var d=document.createElement('div');d.className='fly';if(colour)d.style.setProperty('--c',colour);document.body.appendChild(d);
    var lift=Math.min(160,Math.abs(y1-y0)/2+60);
    var an=d.animate([
      {transform:'translate('+x0+'px,'+y0+'px) scale(.6)',opacity:0},
      {transform:'translate('+x0+'px,'+(y0-30)+'px) scale(1)',opacity:1,offset:.15},
      {transform:'translate('+((x0+x1)/2)+'px,'+(Math.min(y0,y1)-lift)+'px) scale(.85)',opacity:1,offset:.55},
      {transform:'translate('+x1+'px,'+y1+'px) scale(.3)',opacity:.6}
    ],{duration:780,easing:'cubic-bezier(.45,0,.2,1)'});
    an.onfinish=function(){d.remove();bump()};
  }

  /* short message, e.g. "Added to your basket", with one optional button */
  var box;
  function toast(title,detail,action){
    if(!box){box=document.createElement('div');box.className='toasts';box.setAttribute('role','status');box.setAttribute('aria-live','polite');document.body.appendChild(box)}
    var t=document.createElement('div');t.className='toast';
    t.innerHTML='<span class="tk" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5 6.5 12 13 4.5"/></svg></span><span class="tx"><b></b><span></span></span>';
    t.querySelector('b').textContent=title;t.querySelector('.tx span').textContent=detail||'';
    if(action){var b=document.createElement('button');b.type='button';b.textContent=action.label;b.onclick=function(){close();action.run()};t.appendChild(b)}
    while(box.children.length>1)box.firstChild.remove();
    box.appendChild(t);
    var timer=setTimeout(close,4200);
    t.addEventListener('mouseenter',function(){clearTimeout(timer)});
    t.addEventListener('mouseleave',function(){timer=setTimeout(close,2000)});
    function close(){clearTimeout(timer);if(!t.parentNode)return;if(still){t.remove();return}t.classList.add('out');setTimeout(function(){t.remove()},300)}
  }

  window.AXC_FX={fly:fly,toast:toast,reveal:reveal,still:still};
  function ready(){tape();reveal()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready);else ready();
})();

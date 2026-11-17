/* Axencraft shop: one basket shared by Print Studio and Grow Studio.
   The basket lives in this browser only (localStorage). Prices always come from
   shop/catalog.json, and the checkout re-checks every price on the server. */
(function(){
  var FN='https://cvkgnrrskoptdtojcwvz.supabase.co/functions/v1';
  var KEY='axc-basket';
  var catalog=null,loading=null,byId={},listeners=[];

  function money(p){return '£'+(p/100).toFixed(2)}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function read(){try{var v=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(v)?v:[]}catch(_){return []}}
  function write(v){try{localStorage.setItem(KEY,JSON.stringify(v))}catch(_){}listeners.forEach(function(f){f()})}

  function load(){
    if(catalog)return Promise.resolve(catalog);
    if(loading)return loading;
    loading=fetch('shop/catalog.json',{cache:'no-cache'}).then(function(r){if(!r.ok)throw new Error(r.status);return r.json()}).then(function(c){
      catalog=c;
      c.print.categories.forEach(function(g){g.items.forEach(function(it){byId[it.id]=Object.assign({studio:'print',options:['colour']},it)})});
      c.grow.items.forEach(function(it){byId[it.id]=Object.assign({studio:'grow'},it)});
      return c;
    });
    return loading;
  }
  function optName(kind,id){
    var list=kind==='colour'?catalog.colours:kind==='style'?catalog.grow.styles:kind==='seed'?catalog.grow.seeds:[];
    for(var i=0;i<list.length;i++)if(list[i].id===id)return list[i].name;
    return id;
  }
  function describe(line){
    var it=byId[line.id];if(!it)return '';
    return (it.options||[]).map(function(k){return line.opts&&line.opts[k]?optName(k,line.opts[k]):''}).filter(Boolean)
      .concat(it.pack?[it.pack]:[]).join(' · ');
  }
  function sameLine(a,b){return a.id===b.id&&JSON.stringify(a.opts||{})===JSON.stringify(b.opts||{})}

  var basket={
    money:money,load:load,
    item:function(id){return byId[id]},
    lines:function(){return read().filter(function(l){return !catalog||byId[l.id]})},
    count:function(){return read().reduce(function(n,l){return n+l.qty},0)},
    add:function(id,opts,qty){
      var v=read(),line={id:id,opts:opts||{},qty:qty||1},hit=null;
      v.forEach(function(l){if(sameLine(l,line))hit=l});
      if(hit)hit.qty=Math.min(20,hit.qty+line.qty);else v.push(line);
      write(v);
    },
    setQty:function(i,q){var v=read();if(!v[i])return;if(q<1)v.splice(i,1);else v[i].qty=Math.min(20,q);write(v)},
    clear:function(){write([])},
    onChange:function(f){listeners.push(f)},
    describe:describe,
    open:function(){openDrawer()},
  };
  window.AXC_BASKET=basket;

  /* What to suggest beside a grow kit: matching pots first, then a tray and dome. */
  function suggestions(lines){
    if(!catalog)return [];
    var out=[],seen={};
    function has(id){return lines.some(function(l){return l.id===id})}
    lines.forEach(function(l){
      var it=byId[l.id];if(!it||(it.type!=='kit'&&it.type!=='set'))return;
      var style=l.opts.style,colour=l.opts.colour;
      ['pot_5','pot_7_5','pot_10'].forEach(function(pid){
        var opts={style:style,colour:colour},k=pid+style+colour;
        if(seen[k]||lines.some(function(x){return x.id===pid&&x.opts.style===style&&x.opts.colour===colour}))return;
        seen[k]=1;out.push({id:pid,opts:opts,why:'Matches your kit'});
      });
      if(it.type==='kit'){
        if(!has('tray')&&!seen.tray){seen.tray=1;out.push({id:'tray',opts:{colour:colour},why:'Stops water marks'})}
        if(!has('dome')&&!seen.dome){seen.dome=1;out.push({id:'dome',opts:{},why:'Helps seeds sprout'})}
      }
    });
    return out.slice(0,4);
  }
  basket.suggestions=suggestions;

  /* ---------- the drawer ---------- */
  var dr,listEl,sugEl,totEl,msgEl,goBtn,lastFocus;
  function build(){
    if(dr)return;
    dr=document.createElement('div');dr.className='bk';dr.hidden=true;
    dr.innerHTML='<div class="bk-shade" data-close></div>'+
      '<aside class="bk-panel" role="dialog" aria-modal="true" aria-labelledby="bk-title">'+
      '<div class="bk-head"><h2 id="bk-title">Your basket</h2><button type="button" class="bk-x" data-close aria-label="Close basket">×</button></div>'+
      '<div class="bk-body"><ul class="bk-list" id="bk-list"></ul><div class="bk-sug" id="bk-sug"></div></div>'+
      '<div class="bk-foot"><div id="bk-tot"></div>'+
      '<button type="button" class="bk-go" id="bk-go">Go to checkout</button>'+
      '<p class="bk-small" id="bk-msg" role="status"></p></div></aside>';
    document.body.appendChild(dr);
    listEl=dr.querySelector('#bk-list');sugEl=dr.querySelector('#bk-sug');totEl=dr.querySelector('#bk-tot');
    msgEl=dr.querySelector('#bk-msg');goBtn=dr.querySelector('#bk-go');
    dr.addEventListener('click',function(e){if(e.target.closest('[data-close]'))closeDrawer()});
    dr.addEventListener('keydown',function(e){
      if(e.key==='Escape')closeDrawer();
      if(e.key==='Tab'){
        var f=dr.querySelectorAll('button:not([disabled]),a[href]');if(!f.length)return;
        var a=f[0],z=f[f.length-1];
        if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus()}
        else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}
      }
    });
    goBtn.onclick=checkout;
  }
  function render(){
    if(!dr||!catalog)return;
    var lines=read(),sub=0;
    if(!lines.length){
      listEl.innerHTML='<li class="bk-empty">Your basket is empty.</li>';
    }else listEl.innerHTML=lines.map(function(l,i){
      var it=byId[l.id];if(!it)return '';
      sub+=it.price*l.qty;
      return '<li class="bk-line"><div><b>'+esc(it.name)+'</b><span>'+esc(describe(l))+'</span></div>'+
        '<div class="bk-qty"><button type="button" data-q="'+i+'" data-d="-1" aria-label="One fewer '+esc(it.name)+'">−</button>'+
        '<output aria-label="Quantity">'+l.qty+'</output>'+
        '<button type="button" data-q="'+i+'" data-d="1" aria-label="One more '+esc(it.name)+'">+</button></div>'+
        '<b class="bk-price">'+money(it.price*l.qty)+'</b></li>';
    }).join('');
    listEl.querySelectorAll('[data-q]').forEach(function(b){b.onclick=function(){
      var i=+b.dataset.q,v=read();basket.setQty(i,v[i].qty+(+b.dataset.d));
    }});
    var sug=suggestions(lines);
    sugEl.innerHTML=sug.length?'<h3>Goes well with your kit</h3><ul>'+sug.map(function(s,i){
      var it=byId[s.id];
      return '<li><div><b>'+esc(it.name)+'</b><span>'+esc(describe(s))+' · '+esc(s.why)+'</span></div>'+
        '<button type="button" data-s="'+i+'">Add '+money(it.price)+'</button></li>';
    }).join('')+'</ul>':'';
    sugEl.querySelectorAll('[data-s]').forEach(function(b){b.onclick=function(){var s=sug[+b.dataset.s];basket.add(s.id,s.opts,1)}});
    var post=lines.length?catalog.postage.pence:0;
    totEl.innerHTML=lines.length?'<dl class="bk-sum"><dt>Items</dt><dd>'+money(sub)+'</dd><dt>Postage ('+esc(catalog.postage.name)+')</dt><dd>'+money(post)+'</dd>'+
      '<dt class="bk-total">Total</dt><dd class="bk-total">'+money(sub+post)+'</dd></dl>'+
      '<p class="bk-small">Made to order in Devon. Dispatched within '+catalog.dispatchDays+' days, then 2 to 3 working days to arrive. UK only.</p>':'';
    goBtn.hidden=!lines.length;
  }
  function badge(){
    var n=basket.count();
    document.querySelectorAll('[data-basket]').forEach(function(b){
      var c=b.querySelector('.bk-count');if(c)c.textContent=n;
      b.setAttribute('aria-label','Basket, '+n+(n===1?' item':' items'));
    });
  }
  function openDrawer(){
    build();lastFocus=document.activeElement;
    load().then(render);dr.hidden=false;document.documentElement.classList.add('bk-on');
    setTimeout(function(){dr.querySelector('.bk-x').focus()},20);
  }
  function closeDrawer(){
    if(!dr)return;dr.hidden=true;document.documentElement.classList.remove('bk-on');
    if(lastFocus&&lastFocus.focus)lastFocus.focus();
  }
  function checkout(){
    var lines=read();if(!lines.length)return;
    goBtn.disabled=true;msgEl.textContent='Opening secure checkout...';
    fetch(FN+'/shop-checkout',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({items:lines.map(function(l){return {id:l.id,qty:l.qty,opts:l.opts}})})})
    .then(function(r){return r.json().then(function(j){if(!r.ok||!j.url)throw new Error(j.error||'');return j})})
    .then(function(j){location.href=j.url})
    .catch(function(e){msgEl.textContent=e.message||'We couldn’t open checkout. Please try again in a moment.';goBtn.disabled=false});
  }

  basket.onChange(function(){badge();render()});
  window.addEventListener('storage',function(e){if(e.key===KEY){badge();render()}});
  document.addEventListener('click',function(e){var b=e.target.closest('[data-basket]');if(b){e.preventDefault();openDrawer()}});
  function ready(){badge();load().catch(function(){})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready);else ready();
})();

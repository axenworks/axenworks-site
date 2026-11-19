/* Product news sign-up box. Put <div data-news="digital|print|grow"></div> on a page and load this file.
   Saves to the same list as the homepage form. */
(function(){
  var SB_URL="https://cvkgnrrskoptdtojcwvz.supabase.co";
  var SB_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2a2ducnJza29wdGR0b2pjd3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4MTE2OTksImV4cCI6MjEwNzM4NzY5OX0.WsI6YpOpyd6q4wTV0q5FJzbjs0K3qnDTL4FNhfcbwNg";
  var TEXT={
    digital:['Not ready for a website yet?','Get an email when we add new styles or offers. Nothing else, and you can stop any time.'],
    print:['Hear about new prints first','We add new pieces and colours through the year. Leave your email and we’ll tell you. Nothing else, and you can stop any time.'],
    grow:['Hear about new kits and seeds','New pots, kits and seeds through the year, in your inbox. Nothing else, and you can stop any time.']
  };
  var css='.news-box,.news-box *{box-sizing:border-box}.news-box{width:100%;border:1px solid var(--line,#d3d9d0);background:var(--card,#fff);border-radius:12px;padding:22px;max-width:640px;margin:0 auto}'+
    '.news-box h2{font-size:22px;margin:0 0 6px}.news-box p{margin:0 0 14px;color:var(--muted,#55605a)}'+
    '.news-row{display:flex;gap:10px;flex-wrap:wrap}.news-row label{position:absolute;left:-9999px}'+
    '.news-row input[type=email]{flex:1 1 200px;min-width:0;min-height:46px;padding:0 14px;border:1px solid var(--line,#d3d9d0);border-radius:8px;font:inherit;background:transparent;color:inherit}'+
    '.news-row button{min-height:46px;padding:0 20px;border:0;border-radius:8px;background:var(--blue,#14503c);color:#fff;font:inherit;font-weight:700;cursor:pointer}'+
    '.news-row button:disabled{opacity:.6}.news-row input:focus-visible,.news-row button:focus-visible{outline:3px solid #ffb703;outline-offset:2px}'+
    '.news-msg{min-height:1.4em;margin:10px 0 0 !important;font-size:15px}.news-hp{position:absolute;left:-9999px}';
  var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
  document.querySelectorAll('[data-news]').forEach(function(box,n){
    var k=box.getAttribute('data-news');if(!TEXT[k])return;
    var id='news-email-'+n;
    box.className='news-box';
    box.innerHTML='<h2></h2><p></p><form class="news-row" novalidate><label for="'+id+'">Your email</label>'+
      '<input id="'+id+'" type="email" autocomplete="email" placeholder="you@example.com" required>'+
      '<input class="news-hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">'+
      '<button type="submit">Keep me posted</button></form><p class="news-msg" role="status"></p>';
    box.querySelector('h2').textContent=TEXT[k][0];box.querySelector('p').textContent=TEXT[k][1];
    var f=box.querySelector('form'),msg=box.querySelector('.news-msg'),btn=f.querySelector('button'),em=f.querySelector('#'+id);
    f.addEventListener('submit',function(e){
      e.preventDefault();
      if(f.querySelector('.news-hp').value)return;
      var v=em.value.trim();
      if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)){msg.textContent='Please check your email address.';em.focus();return}
      btn.disabled=true;msg.textContent='Saving…';
      fetch(SB_URL+'/rest/v1/waitlist',{method:'POST',
        headers:{'Content-Type':'application/json','apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY,'Prefer':'return=minimal'},
        body:JSON.stringify({email:v,interest:k,source:location.pathname.replace(/^\//,'')||'home'})
      }).then(function(r){if(!r.ok)throw 0;f.reset();msg.textContent='Thanks, you’re on the list.';
        if(window.va)window.va('event',{name:'news_signup',studio:k});
      }).catch(function(){msg.textContent='That didn’t save. Check your connection and try again.'})
        .finally(function(){btn.disabled=false});
    });
  });
})();

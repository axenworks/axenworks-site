/* Grow Studio pot and accessory illustrations, drawn as SVG in the chosen shape and colour.
   Used by grow.html and the home page. */
function shade(hex,amt){var n=parseInt(hex.slice(1),16),r=n>>16,g=n>>8&255,b=n&255;
  function f(c){return Math.max(0,Math.min(255,Math.round(amt<0?c*(1+amt):c+(255-c)*amt)))}
  return 'rgb('+f(r)+','+f(g)+','+f(b)+')'}
var uid=0;
function potSVG(style,hex,opts){
  opts=opts||{};var id='p'+(++uid),s=opts.scale||1,plant=opts.plant!==false;
  var dark=shade(hex,-.28),light=shade(hex,.35),edge=hex.toUpperCase()==='#FFFFFF'?'#c9c4b8':dark;
  var body,extra='';
  if(style==='bulb'){
    body='M78 74 C40 92 38 158 70 172 L130 172 C162 158 160 92 122 74 Z';
  }else if(style==='faceted'){
    body='M48 70 L152 70 L134 172 L66 172 Z';
    extra='<path d="M74 70 L82 172 M100 70 L100 172 M126 70 L118 172" stroke="'+dark+'" stroke-opacity=".45" stroke-width="2.5"/>'+
      '<path d="M74 70 L82 172 L66 172 L48 70Z" fill="#000" fill-opacity=".12"/><path d="M126 70 L152 70 L134 172 L118 172Z" fill="#fff" fill-opacity=".1"/>';
  }else if(style==='twist'){
    body='M50 70 L150 70 L132 172 L68 172 Z';
    for(var i=-3;i<6;i++){var x=40+i*22;extra+='<path d="M'+x+' 70 C'+(x+18)+' 105 '+(x+6)+' 140 '+(x+26)+' 172" stroke="'+dark+'" stroke-opacity=".4" stroke-width="5" fill="none"/>'}
  }else{
    body='M54 82 L146 82 L132 172 L68 172 Z';
    extra='<rect x="44" y="66" width="112" height="18" rx="4" fill="'+hex+'" stroke="'+edge+'" stroke-width="2"/><rect x="44" y="66" width="112" height="18" rx="4" fill="url(#'+id+'g)"/>';
  }
  var soilY=style==='classic'?68:style==='bulb'?76:72;
  var sprout=plant?'<g class="sprout"><g stroke="#2f7a3a" stroke-width="4" stroke-linecap="round" fill="none"><path d="M100 '+soilY+' C100 52 98 40 100 26"/></g>'+
    '<path class="leaf l1" d="M100 38 C84 22 64 26 60 34 C74 46 92 46 100 38Z" fill="#4c9a4a"/><path class="leaf l2" d="M100 30 C112 12 134 12 140 20 C128 34 110 36 100 30Z" fill="#62b25a"/></g>':'';
  return '<svg viewBox="0 0 200 '+(plant?200:200)+'" xmlns="http://www.w3.org/2000/svg" style="transform:scale('+s+');transform-origin:50% 100%">'+
    '<defs><linearGradient id="'+id+'g" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset=".45" stop-color="#fff" stop-opacity=".18"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient>'+
    '<clipPath id="'+id+'c"><path d="'+body+'"/></clipPath></defs>'+
    '<ellipse cx="100" cy="176" rx="62" ry="7" fill="#000" fill-opacity=".14"/>'+
    sprout+
    '<ellipse cx="100" cy="'+soilY+'" rx="'+(style==='bulb'?22:48)+'" ry="5" fill="#5a3f22"/>'+
    '<path d="'+body+'" fill="'+hex+'" stroke="'+edge+'" stroke-width="2"/>'+
    '<g clip-path="url(#'+id+'c)">'+extra.replace(/<rect[^>]*>/g,'')+'<rect x="0" y="0" width="200" height="200" fill="url(#'+id+'g)"/></g>'+
    (style==='classic'?extra:'')+'</svg>';
}
function accSVG(kind,hex){
  var dark=shade(hex,-.28),edge=hex.toUpperCase()==='#FFFFFF'?'#c9c4b8':dark;
  if(kind==='tray')return '<svg viewBox="0 0 200 150"><ellipse cx="100" cy="98" rx="84" ry="26" fill="'+dark+'"/><ellipse cx="100" cy="88" rx="84" ry="26" fill="'+hex+'" stroke="'+edge+'" stroke-width="2"/><ellipse cx="100" cy="86" rx="68" ry="18" fill="#000" fill-opacity=".12"/><ellipse cx="100" cy="86" rx="40" ry="10" fill="none" stroke="'+edge+'" stroke-opacity=".6" stroke-width="2"/></svg>';
  if(kind==='dome')return '<svg viewBox="0 0 200 150"><path d="M30 120 C30 40 170 40 170 120Z" fill="#dff1f5" fill-opacity=".55" stroke="#8fb6c0" stroke-width="3"/><rect x="92" y="34" width="16" height="10" rx="3" fill="#8fb6c0"/><path d="M60 80 C70 62 84 56 96 54" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none" opacity=".8"/></svg>';
  if(kind==='stakes'){var o='';for(var i=0;i<5;i++){var x=40+i*28;o+='<path d="M'+x+' 30 h22 v70 l-11 22 l-11 -22z" fill="'+hex+'" stroke="'+edge+'" stroke-width="2"/>'}return '<svg viewBox="0 0 200 150">'+o+'</svg>'}
  var g='';for(var y=20;y<=110;y+=22)g+='<path d="M60 '+y+' H140" />';for(var x=60;x<=140;x+=20)g+='<path d="M'+x+' 20 V130"/>';
  return '<svg viewBox="0 0 200 150"><g stroke="'+hex+'" stroke-width="7" stroke-linecap="round">'+g+'</g><g stroke="'+edge+'" stroke-width="1" fill="none" opacity=".5">'+g+'</g></svg>';
}


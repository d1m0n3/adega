"use strict";
// ============================================================
// Adega dos Amigos — módulo de Restaurantes
// ============================================================
const CUISINES=['Portuguesa','Tasca','Petiscos','Marisqueira','Churrasqueira','Peixe','Carne / Steakhouse','Italiana / Pizzaria','Japonesa / Sushi','Asiática','Indiana','Brasileira','Mexicana','Hamburgueria','Vegetariana','Gourmet','Outra'];
const SUBS=[['food','Comida'],['service','Serviço'],['ambiance','Ambiente']];
Object.assign(S,{mode:'vinhos',rests:[],rcom:[],rch:[],rmap:false,noRest:false,rrk:'top'});
try{const m=localStorage.getItem('adega.mode');if(m==='restaurantes')S.mode=m}catch(e){}
let lmap=null,mini=null;

// ---------- helpers ----------
const MAPS_RE=/^https:\/\/((www\.)?google\.[a-z.]{2,8}\/maps|maps\.google\.[a-z.]{2,8}|maps\.app\.goo\.gl|goo\.gl\/maps)/i;
function safeMaps(u){u=String(u||'').trim();return MAPS_RE.test(u)?u:''}
function parseCoords(u){u=String(u||'');let m=u.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)||u.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)||u.match(/[?&](?:q|query|ll)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
  if(!m)return null;const lat=+m[1],lng=+m[2];return(Math.abs(lat)<=90&&Math.abs(lng)<=180)?{lat,lng}:null}
function mapsHref(r){if(safeMaps(r.maps))return safeMaps(r.maps);if(r.lat!=null&&r.lng!=null)return`https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}`;
  return`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([r.name,r.city].filter(Boolean).join(' '))}`}
function rScope(){const g=scopeIds();return S.rests.filter(r=>g.has(r.groupId))}
function rcheersOf(id){return S.rch.filter(c=>c.rid===id)}
function rcommentsOf(id){return S.rcom.filter(c=>c.rid===id).sort((a,b)=>a.createdAt-b.createdAt)}
function cuisColor(c){return`hsl(${hue(c||'x')} 42% 38%)`}
function rPhoto(r){return r.photo?photoSrc(r):''}
// mini-mapa (OpenStreetMap) para restaurantes sem foto
function osmThumb(lat,lng,z,rx,ry,small){
  const n=2**z,la=lat*Math.PI/180,xt=(lng+180)/360*n,yt=(1-Math.log(Math.tan(la)+1/Math.cos(la))/Math.PI)/2*n;
  const tx=Math.floor(xt),ty=Math.floor(yt),fx=Math.round((xt-tx)*256),fy=Math.round((yt-ty)*256);let h='<div class="osm">';
  for(let dy=-ry;dy<=ry;dy++)for(let dx=-rx;dx<=rx;dx++){const x=((tx+dx)%n+n)%n,y=ty+dy;if(y<0||y>=n)continue;
    h+=`<img src="https://tile.openstreetmap.org/${z}/${x}/${y}.png" alt="" loading="lazy" style="left:calc(50% + ${dx*256-fx}px);top:calc(50% + ${dy*256-fy}px)">`}
  return h+`<span class="osmpin${small?' sm':''}">🍽️</span>${small?'':'<span class="osmattr">© OpenStreetMap</span>'}</div>`}
function rVisual(r,size){
  if(r.photo)return`<img src="${esc(rPhoto(r))}" loading="lazy" alt="">`;
  if(r.lat!=null&&r.lng!=null)return size==='sm'?osmThumb(r.lat,r.lng,16,1,1,true):osmThumb(r.lat,r.lng,16,2,1,false);
  return size==='sm'?'<div class="ni">🍽️</div>':'<div class="noph">🍽️</div>'}

// ---------- data ----------
async function loadRest(){
  try{
    const [r,c,ch]=await Promise.all([sb.from('restaurants').select('*').order('created_at',{ascending:false}).limit(3000),sb.from('r_comments').select('*').limit(10000),sb.from('r_cheers').select('*').limit(20000)]);
    S.rests=chk(r).map(x=>({id:x.id,groupId:x.group_id,uid:x.user_id,name:x.name,cuisine:x.cuisine||'',city:x.city||'',rating:Number(x.rating),food:x.food,service:x.service,ambiance:x.ambiance,
      pp:x.price_pp==null?null:Number(x.price_pp),dishes:x.dishes||'',comment:x.comment||'',ret:x.would_return,maps:x.maps_url||'',lat:x.lat,lng:x.lng,photo:x.photo_path,createdAt:Date.parse(x.created_at)}));
    S.rcom=chk(c).map(x=>({id:x.id,rid:x.restaurant_id,uid:x.user_id,text:x.text,createdAt:Date.parse(x.created_at)}));
    S.rch=chk(ch).map(x=>({rid:x.restaurant_id,uid:x.user_id}));S.noRest=false;
  }catch(e){S.noRest=true;S.rests=[];S.rcom=[];S.rch=[]}
}

// ---------- mode bar ----------
function renderModeBar(){
  const b=$('#modebar');const show=S.view!=='grupos';b.style.display=show?'flex':'none';if(!show)return;
  b.innerHTML=`<button class="${S.mode==='vinhos'?'on':''}" data-mode="vinhos">🍷 Vinhos</button><button class="${S.mode==='restaurantes'?'on':''}" data-mode="restaurantes">🍽️ Restaurantes</button>`;
  const add=document.querySelector('#tabs .add');if(add)add.setAttribute('aria-label',S.mode==='vinhos'?'Novo vinho':'Novo restaurante');
}
function noRestBanner(){return S.noRest?`<div class="banner">Para ativar os restaurantes, corre o ficheiro <b>restaurantes.sql</b> no SQL Editor do Supabase.</div>`:''}

// ---------- feed ----------
function vRestFeed(){
  if(!myGroupIds().size)return noGroup();
  const all=rScope();let rs=all;
  if(S.rcf)rs=rs.filter(r=>r.cuisine===S.rcf);
  if(S.q){const q=norm(S.q);rs=rs.filter(r=>norm([r.name,r.city,r.cuisine,r.dishes,r.comment,nameOf(r.uid)].join(' ')).includes(q))}
  const so={new:(a,b)=>b.createdAt-a.createdAt,rate:(a,b)=>b.rating-a.rating||b.createdAt-a.createdAt,pa:(a,b)=>(a.pp??1e9)-(b.pp??1e9),pd:(a,b)=>(b.pp??-1)-(a.pp??-1)};
  rs=[...rs].sort(so[S.sort]||so.new);
  let h=noRestBanner();
  h+=`<div class="searchbar"><input class="inp" id="q" placeholder="Procurar restaurante, cidade, prato…" value="${esc(S.q)}" data-in="q"><select class="inp" style="width:auto" data-ch="sort">${[['new','Recentes'],['rate','Melhor nota'],['pa','Preço ↑'],['pd','Preço ↓']].map(([k,l])=>`<option value="${k}"${S.sort===k?' selected':''}>${l}</option>`).join('')}</select></div>`;
  const used=[...new Set(all.map(r=>r.cuisine).filter(Boolean))].sort();
  h+=`<div class="filt"><button class="chip${S.rmap?'':' on'}" data-rview="list">☰ Lista</button><button class="chip${S.rmap?' on':''}" data-rview="map">🗺️ Mapa</button><span style="width:8px;flex:none"></span>${used.length?`<button class="chip${!S.rcf?' on':''}" data-rcf="">Todas</button>`+used.map(c=>`<button class="chip${S.rcf===c?' on':''}" data-rcf="${esc(c)}">${esc(c)}</button>`).join(''):''}</div>`;
  if(S.rmap){const withC=rs.filter(r=>r.lat!=null&&r.lng!=null);
    h+=`<div id="rmap" class="rmap"></div><p class="small muted">${withC.length} de ${rs.length} restaurantes com localização no mapa. Para aparecer, adiciona o link do Google Maps completo ou usa “📍 Estou aqui”.</p>`;return h}
  if(!rs.length)h+=all.length?`<div class="empty">Nenhum restaurante corresponde à pesquisa.</div>`:`<div class="empty"><div class="big">🍽️</div><p>Ainda não há restaurantes avaliados.<br>Onde jantaram da última vez?</p><button class="btn" data-act="new">＋ Avaliar restaurante</button></div>`;
  return h+'<div class="feed">'+rs.map(rcard).join('')+'</div>';
}
function subLine(r){return SUBS.filter(([k])=>r[k]).map(([k,l])=>`${l} <b>${r[k]}</b>`).join(' · ')}
function rcard(r){
  const g=groupMap()[r.groupId];const ch=rcheersOf(r.id);const mine=ch.some(c=>c.uid===S.uid);const nc=rcommentsOf(r.id).length;
  return `<article class="card" data-ropen="${esc(r.id)}">
  <div class="ph" style="--tc:${cuisColor(r.cuisine)}">${rVisual(r)}${r.cuisine?`<span class="badge">${esc(r.cuisine)}</span>`:''}${r.pp!=null?`<span class="vint">${eur(r.pp)} /pessoa</span>`:''}</div>
  <div class="body"><div class="who">${av(r.uid)}<b>${esc(nameOf(r.uid))}</b><span>· ${ago(r.createdAt)}</span>${S.gf==='all'&&g?`<span>· ${esc(g.emoji)} ${esc(g.name)}</span>`:''}</div>
  <h3>${esc(r.name)}</h3>${r.city?`<div class="sub">📍 ${esc(r.city)}</div>`:''}
  <div class="row">${stars(r.rating)}<span class="num">${fr(r.rating)}</span>${subLine(r)?`<span class="small muted">${subLine(r)}</span>`:''}</div>
  ${r.dishes?`<p class="cmt">🍴 <b>A pedir:</b> ${esc(r.dishes)}</p>`:''}
  ${r.comment?`<p class="cmt">“${esc(r.comment.length>180?r.comment.slice(0,180)+'…':r.comment)}”</p>`:''}
  <div class="acts"><button class="pill${mine?' on':''}" data-rcheer="${esc(r.id)}">👏 ${ch.length||'Boa!'}</button><span class="pill">💬 ${nc}</span><a class="pill" href="${esc(mapsHref(r))}" target="_blank" rel="noopener">📍 Maps</a>${r.ret?'<span class="again">✓ Voltava</span>':''}</div>
  </div></article>`;
}
function afterRender(){
  if(lmap){try{lmap.remove()}catch(e){}lmap=null}
  const el=document.getElementById('rmap');if(!el||!window.L)return;
  let rs=rScope();if(S.rcf)rs=rs.filter(r=>r.cuisine===S.rcf);rs=rs.filter(r=>r.lat!=null&&r.lng!=null);
  lmap=L.map(el,{zoomControl:true}).setView([39.4,-8.2],7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(lmap);
  const pts=[];
  for(const r of rs){const m=L.marker([r.lat,r.lng],{icon:L.divIcon({className:'pin',html:`<span>${r.rating>=4.5?'⭐':'🍽️'}</span>`,iconSize:[34,34],iconAnchor:[17,34]})}).addTo(lmap);
    const div=document.createElement('div');div.className='popup';div.innerHTML=`<b>${esc(r.name)}</b><br>${stars(r.rating)} ${fr(r.rating)}${r.pp!=null?' · '+eur(r.pp):''}<br><a href="#" data-ropen="${esc(r.id)}">Ver avaliação</a>`;
    m.bindPopup(div);pts.push([r.lat,r.lng])}
  if(pts.length===1)lmap.setView(pts[0],15);else if(pts.length>1)lmap.fitBounds(pts,{padding:[30,30],maxZoom:15});
}

// ---------- ranking ----------
function vRestRank(){
  if(!myGroupIds().size)return noGroup();
  const rs=rScope();let h=noRestBanner();
  h+=`<div class="seg">${[['top','⭐ Melhores'],['valor','💶 Qualidade/preço'],['cozinha','🍴 Por cozinha'],['cidade','📍 Por cidade']].map(([k,l])=>`<button class="${S.rrk===k?'on':''}" data-rrk="${k}">${l}</button>`).join('')}</div>`;
  const row=(r,i,end)=>`<div class="rk" data-ropen="${esc(r.id)}"><div class="pos ${i<3?'g'+(i+1):''}">${i+1}</div>${r.photo?`<img src="${esc(rPhoto(r))}" alt="" loading="lazy">`:`<div class="ni osmbox">${rVisual(r,'sm')}</div>`}<div class="mid"><b>${esc(r.name)}</b><div class="small muted">${esc([r.cuisine,r.city].filter(Boolean).join(' · '))}</div>${stars(r.rating)}</div><div class="end">${end(r)}</div></div>`;
  const e1=r=>`<b>${fr(r.rating)}</b><div class="small muted">${r.pp!=null?eur(r.pp):''}</div>`;
  if(!rs.length)return h+`<div class="empty">Ainda sem restaurantes para classificar.</div>`;
  if(S.rrk==='top')h+=[...rs].sort((a,b)=>b.rating-a.rating||b.createdAt-a.createdAt).slice(0,25).map((r,i)=>row(r,i,e1)).join('');
  else if(S.rrk==='valor'){const l=rs.filter(r=>r.pp&&r.rating>=3).sort((a,b)=>b.rating*b.rating/b.pp-a.rating*a.rating/a.pp);
    h+=l.length?l.slice(0,25).map((r,i)=>row(r,i,x=>`<b>${eur(x.pp)}</b><div class="small muted">${fr(x.rating)} ★</div>`)).join('')+`<p class="small muted">Ordenado por nota² ÷ preço por pessoa.</p>`:`<div class="empty">Precisas de restaurantes com preço e nota ≥ 3.</div>`}
  else{const key=S.rrk==='cozinha'?'cuisine':'city';const groups={};for(const r of rs){const k=r[key]||'Sem '+(key==='city'?'cidade':'cozinha');(groups[k]=groups[k]||[]).push(r)}
    for(const k of Object.keys(groups).sort((a,b)=>groups[b].length-groups[a].length)){const l=groups[k].sort((a,b)=>b.rating-a.rating);
      h+=`<div class="sec"><h2 style="font-size:17px">${esc(k)}</h2><span class="small muted">${l.length} · média ${fr(avg(l.map(r=>r.rating)))} ★</span></div>`+l.slice(0,3).map((r,i)=>row(r,i,e1)).join('')}}
  return h;
}

// ---------- stats ----------
function vRestStats(){
  let h=noRestBanner();
  if(myGroupIds().size){
    const rs=rScope();const mine=rs.filter(r=>r.uid===S.uid);const pp=mine.map(r=>r.pp).filter(x=>x!=null);
    const fav=f=>{const c={};for(const x of mine){const v=f(x);if(v)c[v]=(c[v]||0)+1}return Object.entries(c).sort((a,b)=>b[1]-a[1])[0]?.[0]};
    h+=`<div class="sec" style="margin-top:4px"><h2>Os meus restaurantes</h2></div>
    <div class="grid3"><div class="stat"><span>Avaliados</span><b>${mine.length}</b></div><div class="stat"><span>Nota média</span><b>${mine.length?fr(avg(mine.map(r=>r.rating))):'—'}</b></div><div class="stat"><span>Por pessoa</span><b style="font-size:19px">${pp.length?eur(avg(pp)):'—'}</b></div></div>
    <div class="grid2" style="margin-top:10px"><div class="stat"><span>Cozinha favorita</span><b style="font-size:18px">${esc(fav(r=>r.cuisine)||'—')}</b></div><div class="stat"><span>Cidade</span><b style="font-size:18px">${esc(fav(r=>r.city)||'—')}</b></div></div>`;
    const by={};for(const r of rs)if(r.cuisine)by[r.cuisine]=(by[r.cuisine]||0)+1;const ent=Object.entries(by).sort((a,b)=>b[1]-a[1]).slice(0,8);const mx=Math.max(1,...ent.map(x=>x[1]));
    if(ent.length)h+=`<div class="sec"><h2>O que o grupo come</h2></div><div class="card" style="padding:14px"><div class="bars">${ent.map(([c,n])=>`<div class="bar"><span>${esc(c)}</span><div class="tr"><i style="width:${n/mx*100}%;background:${cuisColor(c)}"></i></div><b>${n}</b></div>`).join('')}</div></div>`;
    const ids=[...new Set(rs.map(r=>r.uid))];
    const P=ids.map(id=>{const l=rs.filter(r=>r.uid===id);const p=l.map(r=>r.pp).filter(x=>x!=null);return{id,n:l.length,avg:avg(l.map(r=>r.rating)),ap:p.length?avg(p):null}}).sort((a,b)=>b.n-a.n);
    if(P.length){const badge={};const add=(id,b)=>{(badge[id]=badge[id]||[]).push(b)};add(P[0].id,'🧭 Explorador');
      const wp=P.filter(p=>p.ap!=null);if(wp.length>1){add([...wp].sort((a,b)=>b.ap-a.ap)[0].id,'🥂 Gourmet');add([...wp].sort((a,b)=>a.ap-b.ap)[0].id,'🪙 Rei da tasca')}
      const mu=P.filter(p=>p.n>=2);if(mu.length>1)add([...mu].sort((a,b)=>a.avg-b.avg)[0].id,'🧐 Crítico gastronómico');
      h+=`<div class="sec"><h2>Classificação do grupo</h2></div><div class="card" style="padding:4px 14px">${P.map((p,i)=>`<div class="mem">${av(p.id,1)}<div class="mid"><b>${i+1}. ${esc(nameOf(p.id))}</b><div class="small muted">${p.n} restaurante${p.n!==1?'s':''} · média ${fr(p.avg)} ★${p.ap!=null?' · '+eur(p.ap)+' /pessoa':''}</div><div>${(badge[p.id]||[]).map(b=>`<span class="bdg">${b}</span>`).join('')}</div></div></div>`).join('')}</div>`}
  }
  return h+accountHTML();
}

// ---------- detail ----------
function restHTML(id){
  const r=S.rests.find(x=>x.id===id);if(!r)return head('Restaurante')+'<div class="empty">Este restaurante já não existe.</div>';
  const g=groupMap()[r.groupId];const ch=rcheersOf(r.id);const mineC=ch.some(c=>c.uid===S.uid);const cms=rcommentsOf(r.id);
  const wines=S.wines.filter(w=>w.restaurantId===r.id);
  const same=S.rests.filter(x=>x.id!==r.id&&norm(x.name)===norm(r.name)&&norm(x.city)===norm(r.city)&&scopeIds().has(x.groupId));
  let h=head(esc(r.name));
  if(r.photo||r.lat==null)h+=`<div class="big-ph">${rVisual(r)}</div>`;
  h+=`<div class="who">${av(r.uid)}<b>${esc(nameOf(r.uid))}</b><span>· ${ago(r.createdAt)}</span>${g?`<span>· ${esc(g.emoji)} ${esc(g.name)}</span>`:''}</div>`;
  h+=`<div class="row" style="margin-top:4px"><span class="bigst">${stars(r.rating)}</span><span class="num" style="font-size:22px;font-family:Fraunces,serif">${fr(r.rating)}</span><span class="price" style="font-size:18px">${r.pp!=null?eur(r.pp)+' /pessoa':''}</span></div>`;
  if(SUBS.some(([k])=>r[k]))h+=`<div class="kv" style="grid-template-columns:repeat(3,1fr)">${SUBS.map(([k,l])=>`<div><span>${l}</span><b>${r[k]?stars(r[k]):'—'}</b></div>`).join('')}</div>`;
  if(r.comment)h+=`<p class="cmt" style="font-size:15.5px">“${esc(r.comment)}”</p>`;
  const kv=[['Cozinha',r.cuisine],['Cidade',r.city],['Pratos a pedir',r.dishes],['Voltava',r.ret?'Sim ✓':'Não']].filter(x=>x[1]);
  h+=`<div class="kv">${kv.map(([k,v])=>`<div><span>${k}</span><b>${esc(v)}</b></div>`).join('')}</div>`;
  if(r.lat!=null&&r.lng!=null)h+=`<div id="minimap" class="minimap"></div>`;
  h+=`<a class="btn block" style="margin-top:12px;text-decoration:none" href="${esc(mapsHref(r))}" target="_blank" rel="noopener">📍 Abrir no Google Maps</a>`;
  h+=`<div class="acts" style="border:0;margin-top:10px;flex-wrap:wrap"><button class="pill${mineC?' on':''}" data-rcheer="${esc(r.id)}">👏 ${ch.length?ch.length+' ':''}Boa escolha!</button><button class="pill" data-rvisit="${esc(r.id)}">🍽️ Também fui</button><button class="pill" data-rwine="${esc(r.id)}">🍷 Vinho bebido aqui</button><button class="pill" data-rshare="${esc(r.id)}">📤 Partilhar</button>`;
  if(r.uid===S.uid)h+=`<button class="pill" data-redit="${esc(r.id)}">✏️ Editar</button><button class="pill" data-rdel="${esc(r.id)}" style="color:#b3261e">🗑</button>`;
  h+='</div>';
  if(ch.length)h+=`<div class="small muted" style="margin-top:6px">Gostaram: ${ch.map(c=>esc(first(c.uid))).join(', ')}</div>`;
  if(wines.length)h+=`<div class="sec"><h2 style="font-size:17px">🍷 Vinhos bebidos aqui</h2></div>`+wines.map(w=>`<div class="rk" data-open="${esc(w.id)}">${w.photo?`<img src="${esc(photoSrc(w))}" alt="">`:'<div class="ni">🍷</div>'}<div class="mid"><b>${esc(w.name)}${w.vintage?' '+esc(w.vintage):''}</b><div class="small muted">por ${esc(first(w.uid))}</div>${stars(w.rating)}</div><div class="end"><b>${eur(w.price)}</b></div></div>`).join('');
  if(same.length){const all=[r,...same];h+=`<div class="sec"><h2 style="font-size:17px">Outras visitas</h2><span class="small muted">média ${fr(avg(all.map(x=>x.rating)))} ★</span></div><div class="card" style="padding:4px 14px">${same.map(x=>`<div class="mem" data-ropen="${esc(x.id)}" style="cursor:pointer">${av(x.uid)}<div class="mid"><b>${esc(nameOf(x.uid))}</b> ${stars(x.rating)}<div class="small muted">${x.pp!=null?eur(x.pp)+' /pessoa':''}${x.comment?' · '+esc(x.comment.slice(0,70)):''}</div></div></div>`).join('')}</div>`}
  h+=`<div class="sec"><h2 style="font-size:17px">Comentários</h2><span class="small muted">${cms.length}</span></div><div class="card" style="padding:2px 14px">${cms.length?cms.map(c=>`<div class="cm">${av(c.uid)}<div class="t"><b>${esc(nameOf(c.uid))}</b> <span class="small muted">${ago(c.createdAt)}</span><div>${esc(c.text)}</div></div>${c.uid===S.uid||r.uid===S.uid?`<button class="small muted" data-rdelc="${esc(c.id)}">✕</button>`:''}</div>`).join(''):'<div class="cm muted small">Sê o primeiro a comentar.</div>'}</div>`;
  h+=`<div class="cmbox"><input class="inp" id="rcmt" placeholder="Escreve um comentário…" maxlength="500"><button class="btn" data-rcmt="${esc(r.id)}">Enviar</button></div>`;
  return h;
}
function afterSheet(){
  if(mini){try{mini.remove()}catch(e){}mini=null}
  const el=document.getElementById('minimap');if(!el||!window.L||!S.sheet||S.sheet.type!=='rest')return;
  const r=S.rests.find(x=>x.id===S.sheet.id);if(!r||r.lat==null)return;
  mini=L.map(el,{zoomControl:false,dragging:false,scrollWheelZoom:false,doubleClickZoom:false,touchZoom:false,attributionControl:true}).setView([r.lat,r.lng],15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(mini);
  L.marker([r.lat,r.lng],{icon:L.divIcon({className:'pin',html:'<span>🍽️</span>',iconSize:[34,34],iconAnchor:[17,34]})}).addTo(mini);
}

// ---------- form ----------
function subStars(k,v){let h=`<span class="stars sub" data-sub="${k}">`;for(let i=1;i<=5;i++)h+=`<i class="${v>=i?' f':''}" data-rsub="${k}:${i}">★</i>`;return h+'</span>'}
function rformHTML(){
  const p=F.p;const my=[...myGroupIds()].map(id=>groupMap()[id]);const gsel=p.groupId||(S.gf!=='all'?S.gf:my[0]?.id);
  const geo=F.lat!=null?`📍 Localização guardada (${F.lat.toFixed(4)}, ${F.lng.toFixed(4)})`:'';
  return head(F.edit?'Editar restaurante':'Avaliar restaurante')+`
  <div class="photo-pick" id="pp" data-act="cam">${F.preview?`<img src="${esc(F.preview)}" alt="">`:'<div class="big">📸</div><b>Foto do prato ou do restaurante</b><span class="small">opcional</span>'}</div>
  <div class="picks"><button type="button" class="btn ghost" data-act="cam">📷 Tirar foto</button><button type="button" class="btn ghost" data-act="pick">🖼️ Galeria</button></div>
  <label class="l">Grupo</label><select class="inp" id="f-group">${my.map(g=>`<option value="${esc(g.id)}"${g.id===gsel?' selected':''}>${esc(g.emoji)} ${esc(g.name)}</option>`).join('')}</select>
  <label class="l">Nome do restaurante *</label><input class="inp" id="r-name" value="${esc(p.name)}" placeholder="Ex.: O Escondidinho" maxlength="120">
  <div class="grid2"><div><label class="l">Cidade</label><input class="inp" id="r-city" value="${esc(p.city)}" placeholder="Santarém" maxlength="60"></div><div><label class="l">Preço / pessoa (€)</label><input class="inp" id="r-pp" inputmode="decimal" value="${p.pp!=null?esc(String(p.pp).replace('.',',')):''}" placeholder="0,00"></div></div>
  <label class="l">Localização (Google Maps)</label>
  <input class="inp" id="r-maps" value="${esc(p.maps)}" placeholder="Cola aqui o link do Google Maps" autocomplete="off">
  <div class="picks"><button type="button" class="btn line sm" data-act="geo">📍 Estou aqui</button><button type="button" class="btn line sm" data-act="mapsearch">🔎 Procurar no Maps</button></div>
  <div class="small muted" id="geo-st" style="margin-top:6px">${geo||'No Google Maps: abre o restaurante → Partilhar → Copiar link, e cola acima.'}</div>
  <label class="l">Tipo de cozinha</label><div class="tsel">${CUISINES.map(c=>`<button type="button" data-rcuis="${esc(c)}" class="${F.cuisine===c?'on':''}">${c}</button>`).join('')}</div>
  <label class="l">Nota geral *</label><div class="rate"><span id="f-stars">${rateStars(F.rating)}</span><span class="val" id="f-rv">${F.rating?fr(F.rating):'–'}</span></div>
  <div class="subs">${SUBS.map(([k,l])=>`<div class="subrow"><span>${l}</span><span id="sub-${k}">${subStars(k,F.sub[k]||0)}</span></div>`).join('')}</div>
  <label class="l">Pratos que recomendas</label><input class="inp" id="r-dishes" value="${esc(p.dishes)}" placeholder="Ex.: Polvo à lagareiro, arroz de pato" maxlength="300">
  <label class="l">Comentário</label><textarea class="inp" id="r-comment" maxlength="1000" placeholder="Como foi? Serviço, espera, ambiente…">${esc(p.comment)}</textarea>
  <div class="switch"><span>Voltava lá?</span><button type="button" class="tg${F.ret?' on':''}" data-act="rret" aria-label="Voltava"></button></div>
  <div style="height:16px"></div><button class="btn block" id="f-save" data-act="rsave">${F.edit?'Guardar alterações':'Publicar no grupo 🍽️'}</button>`;
}
function openRForm(prefill,editId){
  const p=Object.assign({name:'',city:'',pp:null,maps:'',dishes:'',comment:'',groupId:null,cuisine:''},prefill||{});
  F={kind:'rest',p,edit:editId||null,rating:editId?p.rating:0,sub:editId?{food:p.food,service:p.service,ambiance:p.ambiance}:{},cuisine:p.cuisine||'',ret:editId?!!p.ret:false,
    lat:p.lat??null,lng:p.lng??null,blob:null,photo:editId?p.photo:null,preview:editId&&p.photo?rPhoto(p):null};
  openSheet({type:'rform'});
}
async function saveRest(){
  if(!F||F.saving)return;const v=id=>($('#'+id)?.value||'').trim();
  const name=v('r-name'),groupId=v('f-group');
  if(!groupId)return toast('Escolhe um grupo.');if(!name)return toast('Falta o nome do restaurante.');if(!F.rating)return toast('Dá uma nota geral ⭐');
  let maps=v('r-maps');if(maps&&!safeMaps(maps))return toast('O link tem de ser do Google Maps.');
  const c=parseCoords(maps);let lat=F.lat,lng=F.lng;if(c){lat=c.lat;lng=c.lng}
  F.saving=true;const btn=$('#f-save');btn.disabled=true;btn.innerHTML='<span class="spin"></span> A guardar…';
  try{
    let photo=F.photo;const old=F.edit?S.rests.find(r=>r.id===F.edit)?.photo:null;
    if(F.blob){const path=`${S.uid}/${crypto.randomUUID()}.jpg`;chk(await sb.storage.from('photos').upload(path,F.blob,{contentType:'image/jpeg',cacheControl:'31536000'}));photo=path}
    const row={group_id:groupId,name,cuisine:F.cuisine||null,city:v('r-city')||null,rating:F.rating,food:F.sub.food||null,service:F.sub.service||null,ambiance:F.sub.ambiance||null,
      price_pp:num(v('r-pp')),dishes:v('r-dishes')||null,comment:v('r-comment')||null,would_return:F.ret,maps_url:maps||null,lat,lng,photo_path:photo||null,updated_at:new Date().toISOString()};
    if(F.edit)chk(await sb.from('restaurants').update(row).eq('id',F.edit));else chk(await sb.from('restaurants').insert(row));
    if(F.blob&&old&&old!==photo)sb.storage.from('photos').remove([old]);
    toast(F.edit?'Alterações guardadas ✓':'Publicado! Bom proveito 🍽️');
    if(S.gf!=='all')S.gf=groupId;S.mode='restaurantes';saveMode();S.view='feed';location.hash='feed';closeSheet();loadAll();
  }catch(e){toast(errMsg(e));F.saving=false;btn.disabled=false;btn.textContent='Tentar outra vez'}
}
const saveMode=()=>{try{localStorage.setItem('adega.mode',S.mode)}catch(e){}};

// ---------- clicks ----------
document.addEventListener('click',e=>{
  if(e.target.closest('a[href^="http"]'))return;
  const t=e.target.closest('[data-mode],[data-ropen],[data-rcheer],[data-rview],[data-rcf],[data-rrk],[data-rcuis],[data-rsub],[data-rcmt],[data-rdelc],[data-redit],[data-rdel],[data-rvisit],[data-rwine],[data-rshare],[data-act="geo"],[data-act="mapsearch"],[data-act="rsave"],[data-act="rret"]');
  if(!t)return;const d=t.dataset;
  if(d.mode){S.mode=d.mode;saveMode();S.q='';window.scrollTo(0,0);return render()}
  if(d.rcheer!==undefined){e.stopPropagation();const id=d.rcheer;return act(async()=>{
    if(S.rch.some(c=>c.rid===id&&c.uid===S.uid)){S.rch=S.rch.filter(c=>!(c.rid===id&&c.uid===S.uid));render();renderSheet();chk(await sb.from('r_cheers').delete().eq('restaurant_id',id).eq('user_id',S.uid))}
    else{S.rch.push({rid:id,uid:S.uid});render();renderSheet();chk(await sb.from('r_cheers').insert({restaurant_id:id}))}})}
  if(d.ropen){e.preventDefault();return openSheet({type:'rest',id:d.ropen})}
  if(d.rview){S.rmap=d.rview==='map';return render()}
  if(d.rcf!==undefined){S.rcf=d.rcf;return render()}
  if(d.rrk){S.rrk=d.rrk;return render()}
  if(d.rcuis){F.cuisine=F.cuisine===d.rcuis?'':d.rcuis;document.querySelectorAll('[data-rcuis]').forEach(b=>b.classList.toggle('on',b.dataset.rcuis===F.cuisine));return}
  if(d.rsub){const [k,n]=d.rsub.split(':');F.sub[k]=F.sub[k]===+n?0:+n;$('#sub-'+k).innerHTML=subStars(k,F.sub[k]);return}
  if(d.rcmt){const i=$('#rcmt');const txt=(i.value||'').trim();if(!txt)return;return act(async()=>{chk(await sb.from('r_comments').insert({restaurant_id:d.rcmt,text:txt.slice(0,500)}));i.value='';loadAll()})}
  if(d.rdelc)return act(async()=>{if(await ask('Apagar este comentário?','Apagar')){chk(await sb.from('r_comments').delete().eq('id',d.rdelc));loadAll()}});
  if(d.redit){const r=S.rests.find(x=>x.id===d.redit);if(r)openRForm(r,r.id);return}
  if(d.rvisit){const r=S.rests.find(x=>x.id===d.rvisit);if(r)openRForm({name:r.name,city:r.city,cuisine:r.cuisine,maps:r.maps,lat:r.lat,lng:r.lng,groupId:r.groupId});return}
  if(d.rwine){const r=S.rests.find(x=>x.id===d.rwine);if(r)openForm({groupId:r.groupId,where:'Restaurante',place:r.name,restaurantId:r.id});return}
  if(d.rshare){const r=S.rests.find(x=>x.id===d.rshare);if(!r)return;return shareText(`🍽️ ${r.name}${r.city?' ('+r.city+')':''}\n${'★'.repeat(Math.round(r.rating))} ${fr(r.rating)}/5${r.pp!=null?' · '+eur(r.pp)+'/pessoa':''}${r.dishes?'\n🍴 '+r.dishes:''}${r.comment?'\n“'+r.comment+'”':''}\n📍 ${mapsHref(r)}\n— ${nameOf(r.uid)} na Adega dos Amigos`)}
  if(d.rdel)return act(async()=>{if(!await ask('Apagar esta avaliação e os seus comentários?','Apagar'))return;const r=S.rests.find(x=>x.id===d.rdel);closeSheet();
    chk(await sb.from('restaurants').delete().eq('id',d.rdel));if(r&&r.photo)sb.storage.from('photos').remove([r.photo]);toast('Avaliação apagada.');loadAll()});
  const a=d.act;
  if(a==='rret'){F.ret=!F.ret;t.classList.toggle('on',F.ret);return}
  if(a==='rsave')return saveRest();
  if(a==='mapsearch'){const q=[($('#r-name')?.value||'').trim(),($('#r-city')?.value||'').trim()].filter(Boolean).join(' ');if(!q)return toast('Escreve primeiro o nome do restaurante.');
    window.open('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(q),'_blank','noopener');return}
  if(a==='geo'){const st=$('#geo-st');if(!navigator.geolocation)return toast('Este telemóvel não dá a localização.');st.innerHTML='<span class="spin"></span> A obter localização…';
    navigator.geolocation.getCurrentPosition(p=>{if(!F)return;F.lat=+p.coords.latitude.toFixed(6);F.lng=+p.coords.longitude.toFixed(6);st.textContent=`📍 Localização guardada (${F.lat.toFixed(4)}, ${F.lng.toFixed(4)})`;
      const m=$('#r-maps');if(m&&!m.value.trim())m.value=`https://www.google.com/maps/search/?api=1&query=${F.lat},${F.lng}`},
      err=>{st.textContent=err.code===1?'Sem autorização para a localização. Ativa-a nas definições do browser.':'Não foi possível obter a localização.'},{enableHighAccuracy:true,timeout:15000});return}
});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='rcmt')document.querySelector('[data-rcmt]')?.click()});

"use strict";
// ============================================================
// Adega dos Amigos — versão GitHub Pages + Supabase
// ============================================================
const TYPES=[
 {k:'tinto',l:'Tinto',c:'#7b1e3a'},{k:'branco',l:'Branco',c:'#c9a227'},{k:'rose',l:'Rosé',c:'#e27a91'},
 {k:'verde',l:'Verde',c:'#6f9a35'},{k:'espumante',l:'Espumante',c:'#b8955a'},{k:'porto',l:'Porto',c:'#4d0f20'},
 {k:'doce',l:'Moscatel / Doce',c:'#c0712a'},{k:'outro',l:'Outro',c:'#7a7a7a'}];
const TYPE=Object.fromEntries(TYPES.map(t=>[t.k,t]));
const TAGS=['Frutado','Frutos vermelhos','Frutos pretos','Citrino','Floral','Mineral','Amadeirado','Baunilha','Tostado','Especiado','Fresco','Ácido','Encorpado','Leve','Suave','Taninoso','Seco','Doce','Gastronómico','Persistente'];
const WHERE=['Supermercado','Garrafeira','Restaurante','Produtor / Adega','Online','Oferta'];
const EMOJIS=['🍷','🍇','🥂','🍾','🧀','🍖','🐟','🏡','🎉','⛵','🌿','🔥','🎸','⚽','🏖️','❤️'];
const VIEWS=['feed','ranking','grupos','eu'];

const S={view:'feed',gf:'all',q:'',tf:'',sort:'new',rk:'top',
  groups:[],members:[],wines:[],comments:[],cheers:[],wish:[],names:{},
  uid:null,email:null,anon:true,myName:'',loaded:false,sheet:null,
  joinCode:new URLSearchParams(location.search).get('join')};
let sb=null,F=null;

// ---------- helpers ----------
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>{const n=parseFloat(String(v).replace(',','.'));return isFinite(n)?n:null};
const eur=v=>v==null?'—':new Intl.NumberFormat('pt-PT',{style:'currency',currency:'EUR'}).format(v);
const fr=r=>(Math.round((r||0)*10)/10).toLocaleString('pt-PT',{minimumFractionDigits:1,maximumFractionDigits:1});
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const wkey=w=>norm(w.name)+'|'+(w.vintage||'');
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
function ago(t){const d=(Date.now()-t)/1000;if(d<60)return'agora';if(d<3600)return'há '+Math.floor(d/60)+' min';if(d<86400)return'há '+Math.floor(d/3600)+' h';if(d<172800)return'ontem';if(d<604800)return'há '+Math.floor(d/86400)+' dias';return new Date(t).toLocaleDateString('pt-PT',{day:'numeric',month:'short'})}
function hue(s){let h=0;for(const c of String(s))h=(h*31+c.charCodeAt(0))%360;return h}
function nameOf(id){if(!id)return'Alguém';const n=S.names[id];if(id===S.uid)return n||S.myName||'Eu';return n||'Amigo'}
function first(id){return nameOf(id).split(' ')[0]}
function av(id,lg){const n=nameOf(id);const ini=n.split(/\s+/).map(x=>x[0]||'').join('').slice(0,2).toUpperCase();return `<span class="av${lg?' lg':''}" style="background:hsl(${hue(id)} 45% 42%)">${esc(ini)}</span>`}
function stars(r){let h='<span class="stars">';for(let i=1;i<=5;i++){const c=r>=i?' f':r>=i-.5?' h':'';h+=`<i class="${c}">★</i>`}return h+'</span>'}
function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('on'),2800)}
function ask(text,yes='Confirmar'){return new Promise(res=>{$('#dlgt').textContent=text;$('#dlgy').textContent=yes;$('#dlg').classList.add('on');const done=v=>{$('#dlg').classList.remove('on');res(v)};$('#dlgy').onclick=()=>done(true);$('#dlgn').onclick=()=>done(false)})}
const urlCache={};
function photoSrc(w){if(!w.photo)return'';return urlCache[w.photo]||(urlCache[w.photo]=sb.storage.from('photos').getPublicUrl(w.photo).data.publicUrl)}
function chk(r){if(r&&r.error)throw r.error;return r?r.data:null}
function errMsg(e){const m=(e&&e.message)||'';if(/convite/i.test(m))return m;if(/Failed to fetch|NetworkError/i.test(m))return'Sem ligação à internet.';return'Ocorreu um erro: '+(m||'tenta outra vez')}
const appUrl=()=>location.origin+location.pathname;

// ---------- derived ----------
function groupMap(){return Object.fromEntries(S.groups.map(g=>[g.id,g]))}
function myGroupIds(){return new Set(S.members.filter(m=>m.uid===S.uid).map(m=>m.groupId).filter(id=>groupMap()[id]))}
function membersOf(gid){return [...new Set(S.members.filter(m=>m.groupId===gid).map(m=>m.uid))]}
function scopeIds(){return S.gf!=='all'?new Set([S.gf]):myGroupIds()}
function scopeWines(){const g=scopeIds();return S.wines.filter(w=>g.has(w.groupId))}
function cheersOf(wid){return S.cheers.filter(c=>c.wineId===wid)}
function commentsOf(wid){return S.comments.filter(c=>c.wineId===wid).sort((a,b)=>a.createdAt-b.createdAt)}
function aggregate(ws){const m={};for(const w of ws){const k=wkey(w);(m[k]=m[k]||{list:[]}).list.push(w)}
  return Object.values(m).map(a=>{const l=a.list;const pr=l.map(x=>x.price).filter(x=>x!=null);const best=l.find(x=>x.photo)||l[0];
  return{name:best.name,vintage:best.vintage,type:best.type,region:best.region,avg:avg(l.map(x=>x.rating||0)),n:l.length,price:pr.length?Math.min(...pr):null,thumb:photoSrc(best),id:best.id}})}

// ---------- boot ----------
async function boot(){
  const C=window.ADEGA_CONFIG||{};
  if(!window.supabase||!C.SUPABASE_URL||/XXXX/.test(C.SUPABASE_URL)||/COLA_AQUI/.test(C.SUPABASE_ANON_KEY||'')){
    document.body.classList.add('noapp');
    $('#main').innerHTML=`<div class="empty"><div class="big">⚙️</div><h2 style="color:var(--ink)">Falta configurar</h2><p>Preenche o ficheiro <b>config.js</b> com o URL e a chave do teu projeto Supabase (ver README).</p></div>`;return}
  sb=supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const h=location.hash.slice(1);if(VIEWS.includes(h))S.view=h;
  try{const g=localStorage.getItem('adega.gf');if(g)S.gf=g}catch(e){}
  sb.auth.onAuthStateChange((ev,session)=>{if(ev==='SIGNED_IN'&&session&&session.user.id!==S.uid)start(session)});
  const {data:{session}}=await sb.auth.getSession();
  if(session)start(session);else showWelcome();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else setTimeout(boot,0);

async function showWelcome(mode){
  document.body.classList.add('noapp');
  const m=$('#main');
  if(mode==='email'){m.innerHTML=`
  <div class="welcome"><div class="big">📧</div><h2>Entrar com email</h2><p class="muted">Se já ligaste um email à tua conta noutro telemóvel, recebes um link para entrar.</p>
  <input class="inp" id="w-email" type="email" placeholder="o.teu@email.com" autocomplete="email"><div style="height:10px"></div>
  <button class="btn block" data-act="otp">Enviar link</button><div style="height:10px"></div><button class="btn line block" data-act="welcome">Voltar</button></div>`;return}
  m.innerHTML='<div class="welcome"><div class="big">🍷</div><p class="muted"><span class="spin"></span></p></div>';
  let invName=null,setup=false;
  try{
    if(S.joinCode)invName=chk(await sb.rpc('invite_info',{p_code:S.joinCode}));
    if(!invName)setup=!!chk(await sb.rpc('needs_setup'));
  }catch(e){}
  if(S.joinCode&&!invName)S.joinCode=null;
  const nameField=`<label class="l">Como te chamas?</label><input class="inp" id="w-name" placeholder="O teu nome" maxlength="40" autocomplete="given-name">`;
  const foot=`<p class="small muted" style="margin-top:18px"><a href="#" data-act="emailmode">Já usei noutro telemóvel</a></p>`;
  if(invName){m.innerHTML=`<div class="welcome"><div class="big">🎉</div><h2>Foste convidado!</h2><p class="muted">Para o grupo <b>${esc(invName)}</b> na Adega dos Amigos.</p>${nameField}<div style="height:12px"></div><button class="btn block" data-act="start">Entrar 🥂</button>${foot}</div>`;return}
  if(setup){S.setup=true;m.innerHTML=`<div class="welcome"><div class="big">🍷</div><h2>Adega dos Amigos</h2><p class="muted">Ainda não há nenhum grupo. Entra e cria o primeiro — depois convidas os teus amigos.</p>${nameField}<div style="height:12px"></div><button class="btn block" data-act="start">Começar 🥂</button>${foot}</div>`;return}
  m.innerHTML=`<div class="welcome"><div class="big">🔒</div><h2>Só por convite</h2><p class="muted">Pede a um amigo o link ou o código de convite do grupo.</p>
  <label class="l">Código de convite</label><input class="inp" id="w-code" placeholder="Ex.: A1B2C3" maxlength="6" style="text-transform:uppercase;letter-spacing:.2em;text-align:center" autocomplete="off">
  ${nameField}<div style="height:12px"></div><button class="btn block" data-act="start">Entrar 🥂</button>${foot}</div>`;
}
async function start(session){
  if(!session||S.started===session.user.id)return;
  S.uid=session.user.id;S.email=session.user.email||null;S.anon=!!session.user.is_anonymous&&!S.email;
  document.body.classList.remove('noapp');
  $('#main').innerHTML='<div class="skel"></div><div class="skel"></div>';
  try{
    const p=chk(await sb.from('profiles').select('name').eq('id',S.uid).maybeSingle());
    if(p&&p.name)S.myName=p.name;
    else{const nm=(sessionStorage.getItem('adega.pendingName')||'').trim();
      if(nm){chk(await sb.from('profiles').upsert({id:S.uid,name:nm}));S.myName=nm}
      else{return askName()}}
    if(S.joinCode){
      try{const gid=chk(await sb.rpc('join_group',{p_code:S.joinCode}));S.gf=gid;saveGf();toast('Entraste no grupo 🎉')}catch(e){toast(errMsg(e))}
      S.joinCode=null;history.replaceState(null,'',appUrl()+location.hash);
    }
  }catch(e){toast(errMsg(e))}
  S.started=S.uid;
  await loadAll();
  sb.channel('adega').on('postgres_changes',{event:'*',schema:'public'},()=>reloadSoon()).subscribe();
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')reloadSoon()});
}
function askName(){
  document.body.classList.add('noapp');
  $('#main').innerHTML=`<div class="welcome"><div class="big">👋</div><h2>Como te chamas?</h2><input class="inp" id="w-name2" maxlength="40" placeholder="O teu nome"><div style="height:12px"></div><button class="btn block" data-act="setname">Continuar</button></div>`;
}
const saveGf=()=>{try{localStorage.setItem('adega.gf',S.gf)}catch(e){}};

// ---------- data ----------
let rl=0;function reloadSoon(){clearTimeout(rl);rl=setTimeout(loadAll,350)}
async function loadAll(){
  try{
    const [g,m,w,c,ch,wl]=await Promise.all([
      sb.from('groups').select('*'),sb.from('memberships').select('*'),
      sb.from('wines').select('*').order('created_at',{ascending:false}).limit(3000),
      sb.from('comments').select('*').limit(10000),sb.from('cheers').select('*').limit(20000),sb.from('wishlist').select('*')]);
    S.groups=chk(g).map(r=>({id:r.id,name:r.name,emoji:r.emoji,code:r.invite_code,createdBy:r.created_by}));
    S.members=chk(m).map(r=>({groupId:r.group_id,uid:r.user_id}));
    S.wines=chk(w).map(r=>({id:r.id,groupId:r.group_id,uid:r.user_id,name:r.name,producer:r.producer||'',vintage:r.vintage,type:r.type,region:r.region||'',country:r.country||'',grapes:r.grapes||'',
      price:r.price==null?null:Number(r.price),where:r.where_bought||'',place:r.place||'',rating:Number(r.rating),tags:r.tags||[],comment:r.comment||'',pairing:r.pairing||'',buyAgain:r.buy_again,photo:r.photo_path,restaurantId:r.restaurant_id||null,createdAt:Date.parse(r.created_at)}));
    S.comments=chk(c).map(r=>({id:r.id,wineId:r.wine_id,uid:r.user_id,text:r.text,createdAt:Date.parse(r.created_at)}));
    S.cheers=chk(ch).map(r=>({wineId:r.wine_id,uid:r.user_id}));
    S.wish=chk(wl).map(r=>({id:r.id,groupId:r.group_id,uid:r.user_id,name:r.name,done:r.done,createdAt:Date.parse(r.created_at)}));
    await loadRest();
    const ids=[...new Set([S.uid,...S.members.map(x=>x.uid),...S.wines.map(x=>x.uid),...S.comments.map(x=>x.uid),...S.rests.map(x=>x.uid),...S.rcom.map(x=>x.uid)])];
    if(ids.length){const p=chk(await sb.from('profiles').select('id,name').in('id',ids));for(const r of p)S.names[r.id]=r.name}
    if(S.gf!=='all'&&!groupMap()[S.gf])S.gf='all';
    S.loaded=true;S.err=null;
  }catch(e){S.err=errMsg(e)}
  render();if(S.sheet&&!['form','rform','newgroup'].includes(S.sheet.type))renderSheet();
}

// ---------- render ----------
function keepFocus(fn){const a=document.activeElement;const id=a&&a.id;let s,e;try{s=a.selectionStart;e=a.selectionEnd}catch(x){}fn();if(id){const el=document.getElementById(id);if(el&&el!==a){el.focus();try{el.setSelectionRange(s,e)}catch(x){}}}}
function render(){
  if(!S.loaded&&!S.err)return;
  keepFocus(()=>{
    document.querySelectorAll('#tabs [data-tab]').forEach(b=>b.classList.toggle('on',b.dataset.tab===S.view));
    $('#mebox').innerHTML=S.uid?`${av(S.uid)}<span>${esc(first(S.uid))}</span>`:'';
    renderChips();renderModeBar();
    let h=S.err?`<div class="banner">${esc(S.err)}</div>`:'';
    const R=S.mode==='restaurantes';
    h+=({feed:R?vRestFeed:vFeed,ranking:R?vRestRank:vRank,grupos:vGroups,eu:R?vRestStats:vStats}[S.view]||vFeed)();
    $('#main').innerHTML=h;
  });
  afterRender();
}
function renderChips(){
  const show=S.view!=='grupos';const c=$('#chips');c.style.display=show?'flex':'none';if(!show)return;
  const gm=groupMap();const mine=[...myGroupIds()].map(id=>gm[id]).sort((a,b)=>a.name.localeCompare(b.name));
  c.innerHTML=`<button class="chip${S.gf==='all'?' on':''}" data-gf="all">Todos os meus grupos</button>`+mine.map(g=>`<button class="chip${S.gf===g.id?' on':''}" data-gf="${esc(g.id)}">${esc(g.emoji||'🍷')} ${esc(g.name)}</button>`).join('');
}
function joinBox(){return `<div class="cmbox"><input class="inp" id="jcode" placeholder="Código de convite (ex.: A1B2C3)" maxlength="6" style="text-transform:uppercase" autocomplete="off"><button class="btn" data-act="joincode">Entrar</button></div>`}
function noGroup(){
  return `<div class="empty"><div class="big">🍇</div><h2 style="color:var(--ink)">Bem-vindo, ${esc(first(S.uid))}!</h2><p>Cria um grupo e convida os teus amigos, ou entra num grupo com o código que te enviaram.</p>
  <button class="btn" data-act="newgroup">＋ Criar grupo</button></div>${joinBox()}`;
}

// ----- feed -----
function vFeed(){
  if(!myGroupIds().size)return noGroup();
  const all=scopeWines();let ws=all;
  if(S.tf)ws=ws.filter(w=>w.type===S.tf);
  if(S.q){const q=norm(S.q);ws=ws.filter(w=>norm([w.name,w.producer,w.region,w.grapes,w.comment,nameOf(w.uid),w.tags.join(' ')].join(' ')).includes(q))}
  const so={new:(a,b)=>b.createdAt-a.createdAt,rate:(a,b)=>b.rating-a.rating||b.createdAt-a.createdAt,pa:(a,b)=>(a.price??1e9)-(b.price??1e9),pd:(a,b)=>(b.price??-1)-(a.price??-1)};
  ws=[...ws].sort(so[S.sort]||so.new);
  let h='';
  const wk=all.filter(w=>Date.now()-w.createdAt<7*864e5).sort((a,b)=>b.rating-a.rating||(cheersOf(b.id).length-cheersOf(a.id).length))[0];
  if(wk&&!S.q&&!S.tf)h+=`<div class="hero" data-open="${esc(wk.id)}">${photoSrc(wk)?`<img src="${esc(photoSrc(wk))}" alt="">`:'<div style="font-size:48px">🏅</div>'}<div><div class="k">🏅 Vinho da semana</div><h3>${esc(wk.name)}${wk.vintage?' '+esc(wk.vintage):''}</h3>${stars(wk.rating)} <span class="small" style="opacity:.85">· por ${esc(first(wk.uid))}</span></div></div>`;
  h+=`<div class="searchbar"><input class="inp" id="q" placeholder="Procurar vinho, região, casta, amigo…" value="${esc(S.q)}" data-in="q"><select class="inp" style="width:auto" data-ch="sort">${[['new','Recentes'],['rate','Melhor nota'],['pa','Preço ↑'],['pd','Preço ↓']].map(([k,l])=>`<option value="${k}"${S.sort===k?' selected':''}>${l}</option>`).join('')}</select></div>`;
  h+=`<div class="filt"><button class="chip${!S.tf?' on':''}" data-tf="">Todos</button>${TYPES.map(t=>`<button class="chip${S.tf===t.k?' on':''}" data-tf="${t.k}">${t.l}</button>`).join('')}</div>`;
  if(!ws.length)h+=all.length?`<div class="empty">Nenhum vinho corresponde à pesquisa.</div>`:`<div class="empty"><div class="big">📸</div><p>Ainda não há vinhos aqui.<br>Tira a primeira foto!</p><button class="btn" data-act="new">＋ Adicionar vinho</button></div>`;
  return h+'<div class="feed">'+ws.map(wcard).join('')+'</div>';
}
function wcard(w){
  const t=TYPE[w.type]||TYPE.outro;const g=groupMap()[w.groupId];const ch=cheersOf(w.id);const mine=ch.some(c=>c.uid===S.uid);const nc=commentsOf(w.id).length;
  return `<article class="card" data-open="${esc(w.id)}">
  <div class="ph" style="--tc:${t.c}">${w.photo?`<img src="${esc(photoSrc(w))}" loading="lazy" alt="">`:'<div class="noph">🍷</div>'}<span class="badge">${esc(t.l)}</span>${w.vintage?`<span class="vint">${esc(w.vintage)}</span>`:''}</div>
  <div class="body"><div class="who">${av(w.uid)}<b>${esc(nameOf(w.uid))}</b><span>· ${ago(w.createdAt)}</span>${S.gf==='all'&&g?`<span>· ${esc(g.emoji)} ${esc(g.name)}</span>`:''}</div>
  <h3>${esc(w.name)}</h3>${(w.producer||w.region)?`<div class="sub">${esc([w.producer,w.region].filter(Boolean).join(' · '))}</div>`:''}
  <div class="row">${stars(w.rating)}<span class="num">${fr(w.rating)}</span>${w.where?`<span class="small muted">${esc(w.where)}</span>`:''}<span class="price">${eur(w.price)}</span></div>
  ${w.comment?`<p class="cmt">“${esc(w.comment.length>180?w.comment.slice(0,180)+'…':w.comment)}”</p>`:''}
  ${w.tags.length?`<div class="tags">${w.tags.slice(0,6).map(x=>`<span class="tag">${esc(x)}</span>`).join('')}</div>`:''}
  <div class="acts"><button class="pill${mine?' on':''}" data-cheer="${esc(w.id)}">🥂 ${ch.length||'Saúde'}</button><span class="pill">💬 ${nc}</span>${w.buyAgain?'<span class="again">✓ Voltava a comprar</span>':''}</div>
  </div></article>`;
}

// ----- ranking -----
function vRank(){
  if(!myGroupIds().size)return noGroup();
  const ag=aggregate(scopeWines());let h='';
  h+=`<div class="seg">${[['top','⭐ Melhores'],['valor','💶 Qualidade/preço'],['caro','💎 Mais caros'],['tipo','🍇 Por tipo']].map(([k,l])=>`<button class="${S.rk===k?'on':''}" data-rk="${k}">${l}</button>`).join('')}</div>`;
  const end1=a=>`<b>${fr(a.avg)}</b><div class="small muted">${a.n} prova${a.n>1?'s':''}</div>`,end2=a=>`<b>${eur(a.price)}</b><div class="small muted">${fr(a.avg)} ★</div>`;
  if(S.rk==='tipo'){
    for(const t of TYPES){const all=ag.filter(a=>a.type===t.k);if(!all.length)continue;
      h+=`<div class="sec"><h2 style="font-size:17px"><span style="color:${t.c}">●</span> ${t.l}</h2><span class="small muted">${all.length} vinhos</span></div>`+[...all].sort((a,b)=>b.avg-a.avg).slice(0,3).map((a,i)=>rkRow(a,i,x=>`<b>${fr(x.avg)}</b><div class="small muted">${eur(x.price)}</div>`)).join('')}
    if(!ag.length)h+=`<div class="empty">Ainda sem vinhos para classificar.</div>`;
    return h;
  }
  let list,endFn;
  if(S.rk==='top'){list=[...ag].sort((a,b)=>b.avg-a.avg||b.n-a.n);endFn=end1}
  else if(S.rk==='valor'){list=ag.filter(a=>a.price&&a.avg>=3).sort((a,b)=>b.avg*b.avg/Math.max(b.price,1)-a.avg*a.avg/Math.max(a.price,1));endFn=end2}
  else{list=ag.filter(a=>a.price).sort((a,b)=>b.price-a.price);endFn=end2}
  h+=list.length?list.slice(0,25).map((a,i)=>rkRow(a,i,endFn)).join(''):`<div class="empty">${S.rk==='valor'?'Precisas de vinhos com preço e nota ≥ 3 para este ranking.':'Ainda sem vinhos para classificar.'}</div>`;
  if(S.rk==='valor'&&list.length)h+=`<p class="small muted">Ordenado por nota² ÷ preço — premeia vinhos muito bons a bom preço.</p>`;
  return h;
}
function rkRow(a,i,endFn){return `<div class="rk" data-open="${esc(a.id)}"><div class="pos ${i<3?'g'+(i+1):''}">${i+1}</div>${a.thumb?`<img src="${esc(a.thumb)}" alt="" loading="lazy">`:'<div class="ni">🍷</div>'}<div class="mid"><b>${esc(a.name)}${a.vintage?' '+esc(a.vintage):''}</b><div class="small muted">${esc([TYPE[a.type]?.l,a.region].filter(Boolean).join(' · '))}</div>${stars(a.avg)}</div><div class="end">${endFn(a)}</div></div>`}

// ----- groups -----
function gcard(g){
  const ms=membersOf(g.id);const n=S.wines.filter(w=>w.groupId===g.id).length;
  return `<div class="gcard" data-group="${esc(g.id)}"><div class="gem">${esc(g.emoji||'🍷')}</div><div class="mid"><b>${esc(g.name)}</b><div class="small muted">${ms.length} membro${ms.length!==1?'s':''} · ${n} vinho${n!==1?'s':''}</div>
  <div class="avs" style="margin-top:6px">${ms.slice(0,6).map(id=>av(id)).join('')}</div></div><span class="small muted">›</span></div>`;
}
function vGroups(){
  const gm=groupMap();const mine=[...myGroupIds()].map(id=>gm[id]);
  let h=`<div class="sec" style="margin-top:4px"><h2>Os meus grupos</h2><button class="btn sm" data-act="newgroup">＋ Novo</button></div>`;
  h+=mine.length?mine.map(gcard).join(''):`<div class="empty" style="padding:20px">Ainda não estás em nenhum grupo.</div>`;
  h+=`<div class="sec"><h2 style="font-size:17px">Entrar num grupo</h2></div>${joinBox()}`;
  h+=`<div class="note" style="margin-top:18px">💡 Abre um grupo e carrega em <b>Convidar amigos</b> para enviar o link pelo WhatsApp. Quem abrir o link entra só com o nome — não precisa de conta.</div>`;
  return h;
}

// ----- stats -----
function vStats(){
  let h='';
  if(myGroupIds().size){
    const ws=scopeWines();const mineW=ws.filter(w=>w.uid===S.uid);const pr=mineW.map(w=>w.price).filter(x=>x!=null);
    const fav=(arr,f)=>{const c={};for(const x of arr){const v=f(x);if(v)c[v]=(c[v]||0)+1}return Object.entries(c).sort((a,b)=>b[1]-a[1])[0]?.[0]};
    h+=`<div class="sec" style="margin-top:4px"><h2>A minha adega</h2><span class="small muted">${S.gf==='all'?'todos os grupos':esc(groupMap()[S.gf]?.name||'')}</span></div>
    <div class="grid3"><div class="stat"><span>Provados</span><b>${mineW.length}</b></div><div class="stat"><span>Nota média</span><b>${mineW.length?fr(avg(mineW.map(w=>w.rating))):'—'}</b></div><div class="stat"><span>Preço médio</span><b style="font-size:19px">${pr.length?eur(avg(pr)):'—'}</b></div></div>
    <div class="grid2" style="margin-top:10px"><div class="stat"><span>Tipo favorito</span><b style="font-size:18px">${esc(TYPE[fav(mineW,w=>w.type)]?.l||'—')}</b></div><div class="stat"><span>Região favorita</span><b style="font-size:18px">${esc(fav(mineW,w=>w.region)||'—')}</b></div></div>
    <div class="grid2" style="margin-top:10px"><div class="stat"><span>Investido em vinho</span><b style="font-size:19px">${pr.length?eur(pr.reduce((a,b)=>a+b,0)):'—'}</b></div><div class="stat"><span>Voltava a comprar</span><b>${mineW.filter(w=>w.buyAgain).length}</b></div></div>`;
    const byT=TYPES.map(t=>({t,n:ws.filter(w=>w.type===t.k).length})).filter(x=>x.n);const mx=Math.max(1,...byT.map(x=>x.n));
    if(byT.length)h+=`<div class="sec"><h2>O que o grupo bebe</h2></div><div class="card" style="padding:14px"><div class="bars">${byT.map(x=>`<div class="bar"><span>${x.t.l}</span><div class="tr"><i style="width:${x.n/mx*100}%;background:${x.t.c}"></i></div><b>${x.n}</b></div>`).join('')}</div></div>`;
    const months=[];const now=new Date();for(let i=5;i>=0;i--)months.push({d:new Date(now.getFullYear(),now.getMonth()-i,1),n:0});
    for(const w of ws){const d=new Date(w.createdAt);const m=months.find(x=>x.d.getFullYear()===d.getFullYear()&&x.d.getMonth()===d.getMonth());if(m)m.n++}
    const mm=Math.max(1,...months.map(x=>x.n));
    h+=`<div class="sec"><h2>Atividade</h2><span class="small muted">últimos 6 meses</span></div><div class="card" style="padding:14px"><div class="cols">${months.map(m=>`<div><span>${m.n||''}</span><i style="height:${m.n/mm*80}%"></i><span>${m.d.toLocaleDateString('pt-PT',{month:'short'}).replace('.','')}</span></div>`).join('')}</div></div>`;
    const ids=[...new Set(ws.map(w=>w.uid))];
    const P=ids.map(id=>{const l=ws.filter(w=>w.uid===id);const p=l.map(w=>w.price).filter(x=>x!=null);return{id,n:l.length,avg:avg(l.map(w=>w.rating)),ap:p.length?avg(p):null,ch:S.cheers.filter(c=>l.some(w=>w.id===c.wineId)).length}}).sort((a,b)=>b.n-a.n);
    if(P.length){
      const badge={};const add=(id,b)=>{(badge[id]=badge[id]||[]).push(b)};
      add(P[0].id,'🍷 Sommelier do grupo');
      const multi=P.filter(p=>p.n>=2);if(multi.length>1){add([...multi].sort((a,b)=>a.avg-b.avg)[0].id,'🧐 Crítico exigente');add([...multi].sort((a,b)=>b.avg-a.avg)[0].id,'😍 Coração mole')}
      const wp=P.filter(p=>p.ap!=null);if(wp.length>1){add([...wp].sort((a,b)=>b.ap-a.ap)[0].id,'💎 Mãos largas');add([...wp].sort((a,b)=>a.ap-b.ap)[0].id,'🔎 Caçador de pechinchas')}
      const pc=[...P].sort((a,b)=>b.ch-a.ch)[0];if(pc.ch>0)add(pc.id,'🥂 Mais brindado');
      h+=`<div class="sec"><h2>Classificação do grupo</h2></div><div class="card" style="padding:4px 14px">${P.map((p,i)=>`<div class="mem">${av(p.id,1)}<div class="mid"><b>${i+1}. ${esc(nameOf(p.id))}</b><div class="small muted">${p.n} vinho${p.n!==1?'s':''} · média ${fr(p.avg)} ★ · ${p.ap!=null?eur(p.ap)+' /garrafa':'s/ preço'}</div><div>${(badge[p.id]||[]).map(b=>`<span class="bdg">${b}</span>`).join('')}</div></div></div>`).join('')}</div>`;
    }
  }
  h+=accountHTML();
  return h;
}

function accountHTML(){
  return `<div class="sec"><h2>A minha conta</h2></div><div class="card" style="padding:14px">
  <label class="l" style="margin-top:0">O meu nome</label><div class="cmbox" style="margin:0"><input class="inp" id="acc-name" value="${esc(S.myName)}" maxlength="40"><button class="btn sm" data-act="rename">Guardar</button></div>
  <label class="l">Usar noutro telemóvel</label>${S.email?`<div class="small">✓ Conta ligada a <b>${esc(S.email)}</b>. Noutro telemóvel, escolhe “Já usei noutro telemóvel”.</div>`:
  `<div class="small muted" style="margin-bottom:8px">Liga um email para não perderes os teus vinhos se mudares de telemóvel ou limpares o browser.</div><div class="cmbox" style="margin:0"><input class="inp" id="acc-email" type="email" placeholder="o.teu@email.com"><button class="btn sm" data-act="linkemail">Ligar</button></div>`}
  <div style="height:14px"></div><button class="btn line sm" data-act="logout">Terminar sessão</button></div>`;
}

// ---------- sheets ----------
function openSheet(s){S.sheet=s;$('#sheet').classList.remove('hidden');document.body.style.overflow='hidden';renderSheet(true)}
function closeSheet(){S.sheet=null;F=null;$('#sheet').classList.add('hidden');document.body.style.overflow='';render()}
function renderSheet(fresh){
  const s=S.sheet;if(!s)return;const p=$('#panel');
  if(s.type==='form'){if(fresh)p.innerHTML=formHTML();return}
  if(s.type==='rform'){if(fresh)p.innerHTML=rformHTML();return}
  if(s.type==='newgroup'){if(fresh)p.innerHTML=newGroupHTML();return}
  keepFocus(()=>{const vals={};p.querySelectorAll('input[id]').forEach(i=>vals[i.id]=i.value);const st=p.scrollTop;
    p.innerHTML=s.type==='wine'?wineHTML(s.id):s.type==='rest'?restHTML(s.id):groupHTML(s.id);
    for(const k in vals){const el=document.getElementById(k);if(el)el.value=vals[k]}p.scrollTop=fresh?0:st});
  afterSheet();
}
const head=t=>`<div class="grab"></div><div class="ph-hd"><h2 style="font-size:21px">${t}</h2><button class="x" data-act="close" aria-label="Fechar">✕</button></div>`;

function wineHTML(id){
  const w=S.wines.find(x=>x.id===id);if(!w)return head('Vinho')+'<div class="empty">Este vinho já não existe.</div>';
  const t=TYPE[w.type]||TYPE.outro;const g=groupMap()[w.groupId];const ch=cheersOf(w.id);const mineC=ch.some(c=>c.uid===S.uid);const cms=commentsOf(w.id);
  const same=S.wines.filter(x=>x.id!==w.id&&wkey(x)===wkey(w)&&scopeIds().has(x.groupId));
  let h=head(esc(w.name));
  h+=`<div class="big-ph">${w.photo?`<img src="${esc(photoSrc(w))}" alt="">`:'<div class="noph">🍷</div>'}</div>`;
  h+=`<div class="who">${av(w.uid)}<b>${esc(nameOf(w.uid))}</b><span>· ${ago(w.createdAt)}</span>${g?`<span>· ${esc(g.emoji)} ${esc(g.name)}</span>`:''}</div>`;
  h+=`<div class="row" style="margin-top:4px"><span class="bigst">${stars(w.rating)}</span><span class="num" style="font-size:22px;font-family:Fraunces,serif">${fr(w.rating)}</span><span class="price" style="font-size:20px">${eur(w.price)}</span></div>`;
  if(w.comment)h+=`<p class="cmt" style="font-size:15.5px">“${esc(w.comment)}”</p>`;
  if(w.tags.length)h+=`<div class="tags">${w.tags.map(x=>`<span class="tag">${esc(x)}</span>`).join('')}</div>`;
  const kv=[['Tipo',t.l],['Colheita',w.vintage],['Produtor',w.producer],['Região',[w.region,w.country].filter(Boolean).join(', ')],['Castas',w.grapes],['Onde comprou',[w.where,w.place].filter(Boolean).join(' · ')],['Harmonização',w.pairing],['Voltava a comprar',w.buyAgain?'Sim ✓':'Não']].filter(x=>x[1]);
  h+=`<div class="kv">${kv.map(([k,v])=>`<div><span>${k}</span><b>${esc(v)}</b></div>`).join('')}</div>`;
  {const rr=w.restaurantId&&S.rests.find(x=>x.id===w.restaurantId);if(rr)h+=`<div class="rk" data-ropen="${esc(rr.id)}" style="margin-top:10px"><div class="ni">🍽️</div><div class="mid"><div class="small muted">Bebido em</div><b>${esc(rr.name)}</b></div><div class="end">›</div></div>`}
  h+=`<div class="acts" style="border:0;margin-top:14px;flex-wrap:wrap"><button class="pill${mineC?' on':''}" data-cheer="${esc(w.id)}">🥂 ${ch.length?ch.length+' ':''}Saúde!</button><button class="pill" data-taste="${esc(w.id)}">🍷 Também provei</button><button class="pill" data-share="${esc(w.id)}">📤 Partilhar</button>`;
  if(w.uid===S.uid)h+=`<button class="pill" data-edit="${esc(w.id)}">✏️ Editar</button><button class="pill" data-del="${esc(w.id)}" style="color:#b3261e">🗑</button>`;
  h+='</div>';
  if(ch.length)h+=`<div class="small muted" style="margin-top:6px">Brindaram: ${ch.map(c=>esc(first(c.uid))).join(', ')}</div>`;
  if(same.length){const all=[w,...same];h+=`<div class="sec"><h2 style="font-size:17px">Outras provas deste vinho</h2><span class="small muted">média ${fr(avg(all.map(x=>x.rating)))} ★</span></div><div class="card" style="padding:4px 14px">${same.map(x=>`<div class="mem" data-open="${esc(x.id)}" style="cursor:pointer">${av(x.uid)}<div class="mid"><b>${esc(nameOf(x.uid))}</b> ${stars(x.rating)}<div class="small muted">${eur(x.price)}${x.comment?' · '+esc(x.comment.slice(0,70)):''}</div></div></div>`).join('')}</div>`}
  h+=`<div class="sec"><h2 style="font-size:17px">Comentários</h2><span class="small muted">${cms.length}</span></div><div class="card" style="padding:2px 14px">${cms.length?cms.map(c=>`<div class="cm">${av(c.uid)}<div class="t"><b>${esc(nameOf(c.uid))}</b> <span class="small muted">${ago(c.createdAt)}</span><div>${esc(c.text)}</div></div>${c.uid===S.uid||w.uid===S.uid?`<button class="small muted" data-delc="${esc(c.id)}">✕</button>`:''}</div>`).join(''):'<div class="cm muted small">Sê o primeiro a comentar.</div>'}</div>`;
  h+=`<div class="cmbox"><input class="inp" id="cmt" placeholder="Escreve um comentário…" maxlength="500"><button class="btn" data-cmt="${esc(w.id)}">Enviar</button></div>`;
  return h;
}

// ----- form -----
function formHTML(){
  const p=F.p;const my=[...myGroupIds()].map(id=>groupMap()[id]);const gsel=p.groupId||(S.gf!=='all'?S.gf:my[0]?.id);
  return head(F.edit?'Editar vinho':'Novo vinho')+`
  <div class="photo-pick" id="pp" data-act="cam">${F.preview?`<img src="${esc(F.preview)}" alt="">`:'<div class="big">📸</div><b>Foto da garrafa</b><span class="small">tira uma foto ou escolhe da galeria</span>'}</div>
  <div class="picks"><button type="button" class="btn ghost" data-act="cam">📷 Tirar foto</button><button type="button" class="btn ghost" data-act="pick">🖼️ Galeria</button></div>
  <label class="l">Grupo</label><select class="inp" id="f-group">${my.map(g=>`<option value="${esc(g.id)}"${g.id===gsel?' selected':''}>${esc(g.emoji)} ${esc(g.name)}</option>`).join('')}</select>
  <label class="l">Nome do vinho *</label><input class="inp" id="f-name" value="${esc(p.name)}" placeholder="Ex.: Esporão Reserva" maxlength="120">
  <div class="grid2"><div><label class="l">Produtor</label><input class="inp" id="f-producer" value="${esc(p.producer)}" maxlength="80"></div><div><label class="l">Colheita</label><input class="inp" id="f-vintage" inputmode="numeric" value="${esc(p.vintage||'')}" placeholder="2021" maxlength="4"></div></div>
  <label class="l">Tipo</label><div class="tsel">${TYPES.map(t=>`<button type="button" data-ftype="${t.k}" class="${F.type===t.k?'on':''}">${t.l}</button>`).join('')}</div>
  <div class="grid2"><div><label class="l">Região</label><input class="inp" id="f-region" value="${esc(p.region)}" placeholder="Alentejo" maxlength="60"></div><div><label class="l">País</label><input class="inp" id="f-country" value="${esc(p.country||'Portugal')}" maxlength="40"></div></div>
  <label class="l">Castas</label><input class="inp" id="f-grapes" value="${esc(p.grapes)}" placeholder="Touriga Nacional, Aragonez…" maxlength="120">
  <label class="l">A tua nota *</label><div class="rate"><span id="f-stars">${rateStars(F.rating)}</span><span class="val" id="f-rv">${F.rating?fr(F.rating):'–'}</span></div><div class="small muted">Toca na metade esquerda de uma estrela para meia estrela.</div>
  <div class="grid2"><div><label class="l">Preço (€)</label><input class="inp" id="f-price" inputmode="decimal" value="${p.price!=null?esc(String(p.price).replace('.',',')):''}" placeholder="0,00"></div><div><label class="l">Onde</label><select class="inp" id="f-where"><option value="">—</option>${WHERE.map(x=>`<option${p.where===x?' selected':''}>${x}</option>`).join('')}</select></div></div>
  <label class="l">Local (loja / restaurante)</label><input class="inp" id="f-place" value="${esc(p.place)}" placeholder="Ex.: Garrafeira Nacional" maxlength="80">
  ${S.rests.length?`<label class="l">Bebido num restaurante do grupo?</label><select class="inp" id="f-rest"><option value="">— Não —</option>${S.rests.filter(r=>myGroupIds().has(r.groupId)).sort((a,b)=>a.name.localeCompare(b.name)).map(r=>`<option value="${esc(r.id)}"${p.restaurantId===r.id?' selected':''}>${esc(r.name)}${r.city?' · '+esc(r.city):''}</option>`).join('')}</select>`:''}
  <label class="l">Aromas e perfil</label><div class="tsel">${TAGS.map(t=>`<button type="button" data-ftag="${esc(t)}" class="${F.tags.has(t)?'on':''}">${t}</button>`).join('')}</div>
  <label class="l">Comentário</label><textarea class="inp" id="f-comment" maxlength="1000" placeholder="O que achaste? Com quem bebeste?">${esc(p.comment)}</textarea>
  <label class="l">Harmonização</label><input class="inp" id="f-pairing" value="${esc(p.pairing)}" placeholder="Ex.: Bacalhau à Brás" maxlength="100">
  <div class="switch"><span>Voltava a comprar?</span><button type="button" class="tg${F.buy?' on':''}" data-act="buy" aria-label="Voltava a comprar"></button></div>
  <div style="height:16px"></div><button class="btn block" id="f-save" data-act="save">${F.edit?'Guardar alterações':'Publicar no grupo 🍷'}</button>`;
}
function rateStars(r){let h='<span class="stars">';for(let i=1;i<=5;i++){const c=r>=i?' f':r>=i-.5?' h':'';h+=`<i class="${c}" data-star="${i}">★</i>`}return h+'</span>'}
function openForm(prefill,editId){
  const p=Object.assign({name:'',producer:'',vintage:'',type:'tinto',region:'',country:'Portugal',grapes:'',price:null,where:'',place:'',comment:'',pairing:'',groupId:null,tags:[]},prefill||{});
  F={p,edit:editId||null,rating:editId?p.rating:0,tags:new Set(editId?p.tags:[]),buy:editId?!!p.buyAgain:false,type:p.type||'tinto',blob:null,photo:editId?p.photo:null,preview:editId&&p.photo?photoSrc(p):null,wishId:p.wishId||null};
  openSheet({type:'form'});
}
async function pickPhoto(file){
  if(!file||!F)return;
  try{const url=URL.createObjectURL(file);const img=new Image();img.src=url;await img.decode();
    const s=Math.min(1,1280/Math.max(img.naturalWidth,img.naturalHeight));const c=document.createElement('canvas');c.width=Math.round(img.naturalWidth*s);c.height=Math.round(img.naturalHeight*s);
    c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);
    F.blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.8));F.preview=URL.createObjectURL(F.blob);
    $('#pp').innerHTML=`<img src="${F.preview}" alt="">`;
  }catch(e){toast('Não consegui abrir esta imagem.')}
}
async function saveWine(){
  if(!F||F.saving)return;const v=id=>($('#'+id)?.value||'').trim();
  const name=v('f-name'),groupId=v('f-group');
  if(!groupId)return toast('Escolhe um grupo.');if(!name)return toast('Falta o nome do vinho.');if(!F.rating)return toast('Dá uma nota ao vinho ⭐');
  const vin=parseInt(v('f-vintage'));F.saving=true;const btn=$('#f-save');btn.disabled=true;btn.innerHTML='<span class="spin"></span> A guardar…';
  try{
    let photo=F.photo;const old=F.edit?S.wines.find(w=>w.id===F.edit)?.photo:null;
    if(F.blob){const path=`${S.uid}/${crypto.randomUUID()}.jpg`;chk(await sb.storage.from('photos').upload(path,F.blob,{contentType:'image/jpeg',cacheControl:'31536000'}));photo=path}
    const row={group_id:groupId,name,producer:v('f-producer')||null,vintage:(vin>1800&&vin<2100)?vin:null,type:F.type,region:v('f-region')||null,country:v('f-country')||null,grapes:v('f-grapes')||null,
      price:num(v('f-price')),where_bought:v('f-where')||null,place:v('f-place')||null,rating:F.rating,tags:[...F.tags],comment:v('f-comment')||null,pairing:v('f-pairing')||null,buy_again:F.buy,photo_path:photo||null,...(S.noRest?{}:{restaurant_id:v('f-rest')||null}),updated_at:new Date().toISOString()};
    if(F.edit)chk(await sb.from('wines').update(row).eq('id',F.edit));else chk(await sb.from('wines').insert(row));
    if(F.blob&&old&&old!==photo)sb.storage.from('photos').remove([old]);
    if(F.wishId)await sb.from('wishlist').update({done:true}).eq('id',F.wishId);
    toast(F.edit?'Alterações guardadas ✓':'Publicado! Saúde 🥂');
    if(S.gf!=='all')S.gf=groupId;S.view='feed';location.hash='feed';closeSheet();loadAll();
  }catch(e){toast(errMsg(e));F.saving=false;btn.disabled=false;btn.textContent='Tentar outra vez'}
}

// ----- group sheet -----
function groupHTML(id){
  const g=groupMap()[id];if(!g)return head('Grupo')+'<div class="empty">Este grupo já não existe.</div>';
  const ms=membersOf(id);const ws=S.wines.filter(w=>w.groupId===id);const isCreator=g.createdBy===S.uid;
  const wish=S.wish.filter(x=>x.groupId===id).sort((a,b)=>(a.done?1:0)-(b.done?1:0)||b.createdAt-a.createdAt);
  let h=head(`${esc(g.emoji)} ${esc(g.name)}`);
  h+=`<div class="grid3"><div class="stat"><span>Membros</span><b>${ms.length}</b></div><div class="stat"><span>Vinhos</span><b>${ws.length}</b></div><div class="stat"><span>Média</span><b>${ws.length?fr(avg(ws.map(w=>w.rating))):'—'}</b></div></div>`;
  h+=`<div class="card" style="padding:14px;margin-top:12px;text-align:center"><div class="small muted">Código de convite</div><div style="font-family:Fraunces,serif;font-size:30px;letter-spacing:.2em;color:var(--wine)">${esc(g.code)}</div>
  <div class="acts" style="border:0;justify-content:center;flex-wrap:wrap"><button class="btn sm" data-invite="${esc(id)}">📤 Convidar amigos</button><a class="btn sm ghost" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(inviteText(g))}" style="text-decoration:none">WhatsApp</a></div></div>`;
  h+=`<div class="acts" style="border:0;flex-wrap:wrap"><button class="btn sm" data-viewg="${esc(id)}">Ver vinhos do grupo</button><button class="btn sm line" data-leave="${esc(id)}">Sair</button>${isCreator?`<button class="btn sm line" data-delg="${esc(id)}" style="color:#b3261e">Apagar grupo</button>`:''}</div>`;
  h+=`<div class="sec"><h2 style="font-size:17px">Membros</h2></div><div class="card" style="padding:4px 14px">${ms.map(u=>{const l=ws.filter(w=>w.uid===u);return `<div class="mem">${av(u,1)}<div class="mid"><b>${esc(nameOf(u))}</b>${u===g.createdBy?' <span class="bdg">Criador</span>':''}<div class="small muted">${l.length} vinho${l.length!==1?'s':''}${l.length?' · média '+fr(avg(l.map(w=>w.rating)))+' ★':''}</div></div>${isCreator&&u!==S.uid?`<button class="small muted" data-kick="${esc(u)}">Remover</button>`:''}</div>`}).join('')}</div>`;
  h+=`<div class="sec"><h2 style="font-size:17px">🛒 Queremos provar</h2><span class="small muted">${wish.filter(x=>!x.done).length} por provar</span></div><div class="card" style="padding:2px 14px">${wish.length?wish.map(x=>`<div class="wl${x.done?' done':''}"><div class="mid"><b>${esc(x.name)}</b><div class="small muted">sugerido por ${esc(first(x.uid))}${x.done?' · provado ✓':''}</div></div>${!x.done?`<button class="btn sm ghost" data-wtaste="${esc(x.id)}">Provei!</button>`:''}${x.uid===S.uid?`<button class="small muted" data-wdel="${esc(x.id)}">✕</button>`:''}</div>`).join(''):'<div class="wl muted small">Lista vazia — adiciona vinhos que alguém recomendou.</div>'}</div>`;
  h+=`<div class="cmbox"><input class="inp" id="wish" placeholder="Ex.: Pêra-Manca 2015" maxlength="100"><button class="btn" data-wadd="${esc(id)}">＋</button></div>`;
  return h;
}
const inviteText=g=>`🍷 Junta-te ao grupo "${g.name}" na Adega dos Amigos para partilharmos os vinhos que bebemos! ${appUrl()}?join=${g.code}`;
function newGroupHTML(){
  return head('Novo grupo')+`<label class="l">Nome</label><input class="inp" id="g-name" placeholder="Ex.: Confraria de Santarém" maxlength="40">
  <label class="l">Ícone</label><div class="emo">${EMOJIS.map((e,i)=>`<button type="button" data-emo="${e}" class="${i===0?'on':''}">${e}</button>`).join('')}</div>
  <div style="height:18px"></div><button class="btn block" data-act="creategroup">Criar grupo</button>`;
}
async function shareText(text,url){
  if(navigator.share){try{await navigator.share({text,url});return}catch(e){if(e.name==='AbortError')return}}
  try{await navigator.clipboard.writeText(url?text:text);toast('Copiado — cola no WhatsApp!')}catch(e){toast('Não foi possível partilhar.')}
}

// ---------- actions ----------
async function act(fn){try{await fn()}catch(e){toast(errMsg(e))}}
async function joinCode(code){code=(code||'').trim().toUpperCase();if(code.length<6)return toast('O código tem 6 caracteres.');
  const gid=chk(await sb.rpc('join_group',{p_code:code}));S.gf=gid;saveGf();toast('Entraste no grupo 🎉');S.view='feed';location.hash='feed';await loadAll()}
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-tab],[data-act],[data-gf],[data-tf],[data-rk],[data-open],[data-cheer],[data-group],[data-ftype],[data-ftag],[data-star],[data-emo],[data-cmt],[data-delc],[data-edit],[data-del],[data-taste],[data-share],[data-leave],[data-delg],[data-viewg],[data-invite],[data-kick],[data-wadd],[data-wdel],[data-wtaste]');
  if(!t)return;const d=t.dataset;
  if(d.cheer!==undefined){e.stopPropagation();const wid=d.cheer;return act(async()=>{
    if(S.cheers.some(c=>c.wineId===wid&&c.uid===S.uid)){S.cheers=S.cheers.filter(c=>!(c.wineId===wid&&c.uid===S.uid));render();renderSheet();chk(await sb.from('cheers').delete().eq('wine_id',wid).eq('user_id',S.uid))}
    else{S.cheers.push({wineId:wid,uid:S.uid});render();renderSheet();chk(await sb.from('cheers').insert({wine_id:wid}))}})}
  if(d.tab){S.view=d.tab;location.hash=d.tab;window.scrollTo(0,0);return render()}
  if(d.gf!==undefined){S.gf=d.gf;saveGf();return render()}
  if(d.tf!==undefined){S.tf=d.tf;return render()}
  if(d.rk){S.rk=d.rk;return render()}
  if(d.open)return openSheet({type:'wine',id:d.open});
  if(d.group)return openSheet({type:'group',id:d.group});
  if(d.ftype){F.type=d.ftype;document.querySelectorAll('[data-ftype]').forEach(b=>b.classList.toggle('on',b===t));return}
  if(d.ftag){F.tags.has(d.ftag)?F.tags.delete(d.ftag):F.tags.add(d.ftag);t.classList.toggle('on');return}
  if(d.star){const i=+d.star;const r=t.getBoundingClientRect();F.rating=(e.clientX-r.left)<r.width/2?i-.5:i;$('#f-stars').innerHTML=rateStars(F.rating);$('#f-rv').textContent=fr(F.rating);return}
  if(d.emo){document.querySelectorAll('[data-emo]').forEach(b=>b.classList.toggle('on',b===t));return}
  if(d.cmt){const i=$('#cmt');const txt=(i.value||'').trim();if(!txt)return;return act(async()=>{chk(await sb.from('comments').insert({wine_id:d.cmt,text:txt.slice(0,500)}));i.value='';loadAll()})}
  if(d.delc)return act(async()=>{if(await ask('Apagar este comentário?','Apagar')){chk(await sb.from('comments').delete().eq('id',d.delc));loadAll()}});
  if(d.edit){const w=S.wines.find(x=>x.id===d.edit);if(w)openForm(w,w.id);return}
  if(d.taste){const w=S.wines.find(x=>x.id===d.taste);if(w)openForm({name:w.name,producer:w.producer,vintage:w.vintage,type:w.type,region:w.region,country:w.country,grapes:w.grapes,groupId:w.groupId});return}
  if(d.share){const w=S.wines.find(x=>x.id===d.share);if(!w)return;return shareText(`🍷 ${w.name}${w.vintage?' '+w.vintage:''}\n${'★'.repeat(Math.round(w.rating))} ${fr(w.rating)}/5 · ${eur(w.price)}\n${[w.producer,w.region].filter(Boolean).join(' · ')}${w.comment?'\n“'+w.comment+'”':''}\n— ${nameOf(w.uid)} na Adega dos Amigos`)}
  if(d.del)return act(async()=>{if(!await ask('Apagar este vinho e os seus comentários?','Apagar'))return;const w=S.wines.find(x=>x.id===d.del);closeSheet();
    chk(await sb.from('wines').delete().eq('id',d.del));if(w&&w.photo)sb.storage.from('photos').remove([w.photo]);toast('Vinho apagado.');loadAll()});
  if(d.leave)return act(async()=>{if(!await ask('Sair deste grupo?','Sair'))return;chk(await sb.from('memberships').delete().eq('group_id',d.leave).eq('user_id',S.uid));if(S.gf===d.leave)S.gf='all';closeSheet();loadAll()});
  if(d.kick)return act(async()=>{if(!await ask(`Remover ${nameOf(d.kick)} do grupo?`,'Remover'))return;chk(await sb.from('memberships').delete().eq('group_id',S.sheet.id).eq('user_id',d.kick));loadAll()});
  if(d.delg)return act(async()=>{if(!await ask('Apagar o grupo e todos os seus vinhos? Não dá para desfazer.','Apagar'))return;const id=d.delg;closeSheet();chk(await sb.from('groups').delete().eq('id',id));if(S.gf===id)S.gf='all';toast('Grupo apagado.');loadAll()});
  if(d.viewg){S.gf=d.viewg;saveGf();S.view='feed';location.hash='feed';return closeSheet()}
  if(d.invite){const g=groupMap()[d.invite];if(g)shareText(inviteText(g));return}
  if(d.wadd){const i=$('#wish');const n=(i.value||'').trim();if(!n)return;return act(async()=>{chk(await sb.from('wishlist').insert({group_id:d.wadd,name:n.slice(0,100)}));i.value='';loadAll()})}
  if(d.wdel)return act(async()=>{chk(await sb.from('wishlist').delete().eq('id',d.wdel));loadAll()});
  if(d.wtaste){const x=S.wish.find(w=>w.id===d.wtaste);if(x)openForm({name:x.name,groupId:x.groupId,wishId:x.id});return}
  const a=d.act;
  if(a==='close')return closeSheet();
  if(a==='start'){const n=($('#w-name').value||'').trim();const codeEl=$('#w-code');
    if(codeEl){const c=(codeEl.value||'').trim().toUpperCase();if(c.length<6)return toast('Escreve o código de convite (6 caracteres).');S.joinCode=c}
    if(!n)return toast('Escreve o teu nome.');
    t.disabled=true;t.innerHTML='<span class="spin"></span>';const reset=()=>{t.disabled=false;t.textContent='Entrar 🥂'};
    return act(async()=>{
      if(S.joinCode){const g=chk(await sb.rpc('invite_info',{p_code:S.joinCode}));if(!g){reset();S.joinCode=null;return toast('Código de convite inválido.')}}
      else if(!S.setup||!chk(await sb.rpc('needs_setup'))){reset();return showWelcome()}
      sessionStorage.setItem('adega.pendingName',n.slice(0,40));
      const r=await sb.auth.signInAnonymously();if(r.error){reset();throw r.error}if(!S.uid)start(r.data.session)})}
  if(a==='setname'){const n=($('#w-name2').value||'').trim();if(!n)return toast('Escreve o teu nome.');return act(async()=>{chk(await sb.from('profiles').upsert({id:S.uid,name:n.slice(0,40)}));S.myName=n;start((await sb.auth.getSession()).data.session)})}
  if(a==='emailmode'){e.preventDefault();return showWelcome('email')}
  if(a==='welcome')return showWelcome();
  if(a==='otp'){const em=($('#w-email').value||'').trim();if(!/.+@.+\..+/.test(em))return toast('Email inválido.');return act(async()=>{const r=await sb.auth.signInWithOtp({email:em,options:{shouldCreateUser:false,emailRedirectTo:location.href.split('#')[0]}});if(r.error)throw r.error;toast('Enviámos um link para o teu email 📧')})}
  if(a==='rename'){const n=($('#acc-name').value||'').trim();if(!n)return;return act(async()=>{chk(await sb.from('profiles').upsert({id:S.uid,name:n.slice(0,40)}));S.myName=n;S.names[S.uid]=n;toast('Nome atualizado ✓');render()})}
  if(a==='linkemail'){const em=($('#acc-email').value||'').trim();if(!/.+@.+\..+/.test(em))return toast('Email inválido.');return act(async()=>{const r=await sb.auth.updateUser({email:em},{emailRedirectTo:appUrl()});if(r.error)throw r.error;toast('Confirma no email que te enviámos 📧')})}
  if(a==='logout')return act(async()=>{if(!await ask(S.email?'Terminar sessão neste telemóvel?':'Sem email ligado, perdes o acesso aos teus vinhos se saíres. Continuar?','Sair'))return;await sb.auth.signOut();location.href=appUrl()});
  if(a==='new'){if(!myGroupIds().size){toast('Primeiro cria ou entra num grupo.');S.view='grupos';location.hash='grupos';return render()}return S.mode==='restaurantes'?(S.noRest?toast('Corre primeiro o restaurantes.sql no Supabase.'):openRForm()):openForm()}
  if(a==='pick'){$('#file').value='';return $('#file').click()}
  if(a==='cam'){$('#cam').value='';return $('#cam').click()}
  if(a==='buy'){F.buy=!F.buy;t.classList.toggle('on',F.buy);return}
  if(a==='save')return saveWine();
  if(a==='newgroup')return openSheet({type:'newgroup'});
  if(a==='joincode')return act(()=>joinCode($('#jcode').value));
  if(a==='creategroup'){const n=($('#g-name').value||'').trim();if(!n)return toast('Dá um nome ao grupo.');const emo=document.querySelector('[data-emo].on')?.dataset.emo||'🍷';
    return act(async()=>{const gid=chk(await sb.rpc('create_group',{p_name:n,p_emoji:emo}));S.gf=gid;saveGf();closeSheet();await loadAll();toast('Grupo criado! Agora convida os amigos 👥');openSheet({type:'group',id:gid})})}
});
document.addEventListener('input',e=>{if(e.target.dataset&&e.target.dataset.in==='q'){S.q=e.target.value;render()}});
document.addEventListener('change',e=>{if(e.target.dataset&&e.target.dataset.ch==='sort'){S.sort=e.target.value;render()}if(e.target.id==='file'||e.target.id==='cam')pickPhoto(e.target.files[0])});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&S.sheet)return closeSheet();if(e.key!=='Enter')return;
  const m={cmt:'[data-cmt]',wish:'[data-wadd]','g-name':'[data-act="creategroup"]',jcode:'[data-act="joincode"]','w-name':'[data-act="start"]','w-code':'#w-name','w-name2':'[data-act="setname"]','w-email':'[data-act="otp"]'}[e.target.id];
  if(m){const el=document.querySelector(m);if(!el)return;m[0]==='#'?el.focus():el.click()}});
window.addEventListener('hashchange',()=>{const h=location.hash.slice(1);if(VIEWS.includes(h)&&h!==S.view){S.view=h;render()}});

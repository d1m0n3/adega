"use strict";
// ============================================================
// Adega dos Amigos — Eventos e galerias de fotos partilhadas
// ============================================================
Object.assign(S,{events:[],photos:[],noEv:false,lb:null});
try{const m=localStorage.getItem('adega.mode');if(m==='eventos')S.mode=m}catch(e){}
const GMAX=20; // fotos por envio

// ---------- data ----------
async function loadEvents(){
  try{
    const [e,p]=await Promise.all([sb.from('events').select('*').order('event_date',{ascending:false}).limit(2000),sb.from('photos').select('*').order('created_at',{ascending:true}).limit(10000)]);
    S.events=chk(e).map(x=>({id:x.id,groupId:x.group_id,uid:x.user_id,title:x.title,date:x.event_date,rid:x.restaurant_id,desc:x.description||'',createdAt:Date.parse(x.created_at)}));
    S.photos=chk(p).map(x=>({id:x.id,groupId:x.group_id,uid:x.user_id,wid:x.wine_id,rid:x.restaurant_id,eid:x.event_id,path:x.path,caption:x.caption||'',createdAt:Date.parse(x.created_at)}));
    S.noEv=false;
  }catch(err){S.noEv=true;S.events=[];S.photos=[]}
}
const pUrl=p=>photoSrc({photo:p.path});
function photosOf(kind,id){const k={wine:'wid',restaurant:'rid',event:'eid'}[kind];return S.photos.filter(p=>p[k]===id)}
function evScope(){const g=scopeIds();return S.events.filter(e=>g.has(e.groupId))}
function fmtDate(d){if(!d)return'';const t=new Date(d+'T12:00:00');return t.toLocaleDateString('pt-PT',{weekday:'short',day:'numeric',month:'long',year:t.getFullYear()!==new Date().getFullYear()?'numeric':undefined})}
function noEvBanner(){return S.noEv?`<div class="banner">Para ativar os eventos e galerias, corre o ficheiro <b>eventos.sql</b> no SQL Editor do Supabase.</div>`:''}
function canDelPhoto(p){const g=groupMap()[p.groupId];return p.uid===S.uid||(g&&g.createdBy===S.uid)}

// ---------- gallery block (vinho / restaurante / evento) ----------
function galleryHTML(kind,id,gid,big){
  if(S.noEv)return'';
  const ps=photosOf(kind,id);const who=[...new Set(ps.map(p=>p.uid))];
  let h=`<div class="sec"><h2 style="font-size:17px">📷 Galeria</h2><span class="small muted">${ps.length} foto${ps.length!==1?'s':''}${who.length?' · '+who.length+' pessoa'+(who.length!==1?'s':''):''}</span></div>`;
  h+=`<div class="gal${big?' big':''}">`+ps.map((p,i)=>`<button class="gph" data-ph="${esc(kind)}|${esc(id)}|${i}"><img src="${esc(pUrl(p))}" alt="" loading="lazy"><span class="gwho">${av(p.uid)}</span></button>`).join('')+
    `<button class="gadd" data-gadd="${esc(kind)}|${esc(id)}|${esc(gid)}"><span>＋</span>Adicionar fotos</button></div>`;
  return h;
}

// ---------- events feed ----------
function evCover(e){const ps=photosOf('event',e.id);if(ps.length)return pUrl(ps[ps.length-1]);const r=e.rid&&S.rests.find(x=>x.id===e.rid);return r&&r.photo?rPhoto(r):''}
function vEvFeed(){
  if(!myGroupIds().size)return noGroup();
  let es=evScope();
  if(S.q){const q=norm(S.q);es=es.filter(e=>norm([e.title,e.desc,S.rests.find(r=>r.id===e.rid)?.name,nameOf(e.uid)].join(' ')).includes(q))}
  es=[...es].sort((a,b)=>(b.date||'').localeCompare(a.date||'')||b.createdAt-a.createdAt);
  let h=noEvBanner();
  h+=`<div class="searchbar"><input class="inp" id="q" placeholder="Procurar evento, restaurante…" value="${esc(S.q)}" data-in="q"></div>`;
  if(!es.length)return h+(S.q?`<div class="empty">Nenhum evento corresponde à pesquisa.</div>`:`<div class="empty"><div class="big">📸</div><p>Ainda não há eventos.<br>Jantar, prova de vinhos, viagem… cria um e todos juntam as suas fotos!</p><button class="btn" data-act="new">＋ Criar evento</button></div>`);
  return h+'<div class="feed">'+es.map(ecard).join('')+'</div>';
}
function ecard(e){
  const ps=photosOf('event',e.id);const who=[...new Set(ps.map(p=>p.uid))];const r=e.rid&&S.rests.find(x=>x.id===e.rid);const g=groupMap()[e.groupId];const cov=evCover(e);
  const strip=ps.slice(-4).reverse();
  return `<article class="card" data-eopen="${esc(e.id)}">
  <div class="ph evph">${cov?`<img src="${esc(cov)}" loading="lazy" alt="">`:'<div class="noph">🎉</div>'}<span class="badge" style="--tc:#5b2a7a">📅 ${esc(fmtDate(e.date))}</span><span class="vint">📷 ${ps.length}</span>
  ${strip.length>1?`<div class="strip">${strip.slice(1).map(p=>`<img src="${esc(pUrl(p))}" alt="" loading="lazy">`).join('')}</div>`:''}</div>
  <div class="body"><h3>${esc(e.title)}</h3>
  <div class="sub">${r?`🍽️ ${esc(r.name)}${r.city?' · '+esc(r.city):''}`:''}${S.gf==='all'&&g?`${r?' · ':''}${esc(g.emoji)} ${esc(g.name)}`:''}</div>
  ${e.desc?`<p class="cmt">${esc(e.desc.length>140?e.desc.slice(0,140)+'…':e.desc)}</p>`:''}
  <div class="acts"><div class="avs">${(who.length?who:[e.uid]).slice(0,7).map(id=>av(id)).join('')}</div><span class="small muted" style="margin-left:auto">${who.length?who.length+' com fotos':'sem fotos ainda'}</span></div>
  </div></article>`;
}

// ---------- event detail ----------
function eventHTML(id){
  const e=S.events.find(x=>x.id===id);if(!e)return head('Evento')+'<div class="empty">Este evento já não existe.</div>';
  const r=e.rid&&S.rests.find(x=>x.id===e.rid);const g=groupMap()[e.groupId];
  let h=head(esc(e.title));
  h+=`<div class="who">📅 <b>${esc(fmtDate(e.date))}</b>${g?`<span>· ${esc(g.emoji)} ${esc(g.name)}</span>`:''}<span>· criado por ${esc(first(e.uid))}</span></div>`;
  if(e.desc)h+=`<p class="cmt" style="font-size:15px">${esc(e.desc)}</p>`;
  if(r)h+=`<div class="rk" data-ropen="${esc(r.id)}" style="margin-top:10px">${r.photo?`<img src="${esc(rPhoto(r))}" alt="">`:'<div class="ni">🍽️</div>'}<div class="mid"><div class="small muted">Restaurante</div><b>${esc(r.name)}</b>${stars(r.rating)}</div><div class="end">›</div></div>`;
  h+=galleryHTML('event',e.id,e.groupId,true);
  // vinhos do mesmo dia/restaurante
  const ws=S.wines.filter(w=>w.groupId===e.groupId&&((e.rid&&w.restaurantId===e.rid)||new Date(w.createdAt).toISOString().slice(0,10)===e.date));
  if(ws.length)h+=`<div class="sec"><h2 style="font-size:17px">🍷 Vinhos da noite</h2></div>`+ws.map(w=>`<div class="rk" data-open="${esc(w.id)}">${w.photo?`<img src="${esc(photoSrc(w))}" alt="">`:'<div class="ni">🍷</div>'}<div class="mid"><b>${esc(w.name)}${w.vintage?' '+esc(w.vintage):''}</b><div class="small muted">por ${esc(first(w.uid))}</div>${stars(w.rating)}</div><div class="end"><b>${eur(w.price)}</b></div></div>`).join('');
  h+=`<div class="acts" style="border:0;margin-top:14px;flex-wrap:wrap"><button class="pill" data-eshare="${esc(e.id)}">📤 Partilhar</button>`;
  if(e.uid===S.uid)h+=`<button class="pill" data-eedit="${esc(e.id)}">✏️ Editar</button>`;
  if(e.uid===S.uid||(g&&g.createdBy===S.uid))h+=`<button class="pill" data-edel="${esc(e.id)}" style="color:#b3261e">🗑 Apagar evento</button>`;
  return h+'</div>';
}

// ---------- event form ----------
function eformHTML(){
  const p=F.p;const my=[...myGroupIds()].map(id=>groupMap()[id]);const gsel=p.groupId||(S.gf!=='all'?S.gf:my[0]?.id);
  const rs=S.rests.filter(r=>myGroupIds().has(r.groupId)).sort((a,b)=>a.name.localeCompare(b.name));
  return head(F.edit?'Editar evento':'Novo evento')+`
  <label class="l">Nome do evento *</label><input class="inp" id="e-title" value="${esc(p.title)}" placeholder="Ex.: Jantar de aniversário do Rui" maxlength="80">
  <div class="grid2"><div><label class="l">Data</label><input class="inp" id="e-date" type="date" value="${esc(p.date||new Date().toISOString().slice(0,10))}"></div>
  <div><label class="l">Grupo</label><select class="inp" id="f-group">${my.map(g=>`<option value="${esc(g.id)}"${g.id===gsel?' selected':''}>${esc(g.emoji)} ${esc(g.name)}</option>`).join('')}</select></div></div>
  ${rs.length?`<label class="l">Restaurante (opcional)</label><select class="inp" id="e-rest"><option value="">— Nenhum / em casa —</option>${rs.map(r=>`<option value="${esc(r.id)}"${p.rid===r.id?' selected':''}>${esc(r.name)}${r.city?' · '+esc(r.city):''}</option>`).join('')}</select>`:''}
  <label class="l">Descrição</label><textarea class="inp" id="e-desc" maxlength="1000" placeholder="O que se celebrou, quem esteve…">${esc(p.desc)}</textarea>
  ${F.edit?'':`<div class="note">Depois de criar, cada pessoa do grupo pode juntar as suas fotos ao evento.</div>`}
  <div style="height:16px"></div><button class="btn block" id="f-save" data-act="esave">${F.edit?'Guardar alterações':'Criar evento 🎉'}</button>`;
}
function openEForm(prefill,editId){F={kind:'event',p:Object.assign({title:'',date:'',desc:'',rid:null,groupId:null},prefill||{}),edit:editId||null};openSheet({type:'eform'})}
async function saveEvent(){
  if(!F||F.saving)return;const v=id=>($('#'+id)?.value||'').trim();
  const title=v('e-title'),groupId=v('f-group');if(!groupId)return toast('Escolhe um grupo.');if(!title)return toast('Dá um nome ao evento.');
  F.saving=true;const btn=$('#f-save');btn.disabled=true;btn.innerHTML='<span class="spin"></span> A guardar…';
  try{
    const row={group_id:groupId,title,event_date:v('e-date')||new Date().toISOString().slice(0,10),restaurant_id:v('e-rest')||null,description:v('e-desc')||null};
    let id=F.edit;
    if(F.edit)chk(await sb.from('events').update(row).eq('id',F.edit));else id=chk(await sb.from('events').insert(row).select('id').single()).id;
    toast(F.edit?'Evento atualizado ✓':'Evento criado! Agora juntem as fotos 📸');
    if(S.gf!=='all')S.gf=groupId;closeSheet();await loadAll();openSheet({type:'event',id});
  }catch(e){toast(errMsg(e));F.saving=false;btn.disabled=false;btn.textContent='Tentar outra vez'}
}

// ---------- stats (ranking / eu no modo eventos) ----------
function vEvStats(withAccount){
  let h=noEvBanner();
  if(myGroupIds().size){
    const g=scopeIds();const ps=S.photos.filter(p=>g.has(p.groupId));const es=evScope();const mine=ps.filter(p=>p.uid===S.uid);
    h+=`<div class="sec" style="margin-top:4px"><h2>Memórias do grupo</h2></div><div class="grid3"><div class="stat"><span>Eventos</span><b>${es.length}</b></div><div class="stat"><span>Fotos</span><b>${ps.length}</b></div><div class="stat"><span>As minhas</span><b>${mine.length}</b></div></div>`;
    const top=[...new Set(ps.map(p=>p.uid))].map(id=>({id,n:ps.filter(p=>p.uid===id).length})).sort((a,b)=>b.n-a.n);
    if(top.length)h+=`<div class="sec"><h2>📸 Fotógrafos do grupo</h2></div><div class="card" style="padding:4px 14px">${top.map((p,i)=>`<div class="mem">${av(p.id,1)}<div class="mid"><b>${i+1}. ${esc(nameOf(p.id))}</b><div class="small muted">${p.n} foto${p.n!==1?'s':''}</div>${i===0?'<span class="bdg">📸 Paparazzo oficial</span>':''}</div></div>`).join('')}</div>`;
    const best=[...es].sort((a,b)=>photosOf('event',b.id).length-photosOf('event',a.id).length).slice(0,5).filter(e=>photosOf('event',e.id).length);
    if(best.length)h+=`<div class="sec"><h2>🎉 Eventos com mais fotos</h2></div>`+best.map((e,i)=>`<div class="rk" data-eopen="${esc(e.id)}"><div class="pos ${i<3?'g'+(i+1):''}">${i+1}</div>${evCover(e)?`<img src="${esc(evCover(e))}" alt="">`:'<div class="ni">🎉</div>'}<div class="mid"><b>${esc(e.title)}</b><div class="small muted">${esc(fmtDate(e.date))}</div></div><div class="end"><b>${photosOf('event',e.id).length}</b><div class="small muted">fotos</div></div></div>`).join('');
    if(ps.length){const recent=[...ps].sort((a,b)=>b.createdAt-a.createdAt).slice(0,12);
      h+=`<div class="sec"><h2>Últimas fotos</h2></div><div class="gal">${recent.map((p,i)=>`<button class="gph" data-ph="recent||${i}"><img src="${esc(pUrl(p))}" alt="" loading="lazy"><span class="gwho">${av(p.uid)}</span></button>`).join('')}</div>`}
  }
  return h+(withAccount?accountHTML():'');
}

// ---------- upload ----------
let gTarget=null;
async function compress(file){
  const url=URL.createObjectURL(file);try{const img=new Image();img.src=url;await img.decode();
    const s=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));const c=document.createElement('canvas');c.width=Math.round(img.naturalWidth*s);c.height=Math.round(img.naturalHeight*s);
    c.getContext('2d').drawImage(img,0,0,c.width,c.height);return await new Promise(r=>c.toBlob(r,'image/jpeg',.8))}finally{URL.revokeObjectURL(url)}}
async function uploadGallery(files){
  if(!gTarget||!files.length)return;const [kind,id,gid]=gTarget;gTarget=null;
  const list=[...files].slice(0,GMAX);if(files.length>GMAX)toast(`Máximo ${GMAX} fotos de cada vez — a enviar as primeiras ${GMAX}.`);
  const bar=$('#upbar');let ok=0,fail=0;bar.classList.add('on');
  for(let i=0;i<list.length;i++){
    bar.textContent=`📤 A enviar foto ${i+1} de ${list.length}…`;
    try{const blob=await compress(list[i]);const path=`${S.uid}/${crypto.randomUUID()}.jpg`;
      chk(await sb.storage.from('photos').upload(path,blob,{contentType:'image/jpeg',cacheControl:'31536000'}));
      const row={group_id:gid,path};row[{wine:'wine_id',restaurant:'restaurant_id',event:'event_id'}[kind]]=id;
      try{chk(await sb.from('photos').insert(row))}catch(e){sb.storage.from('photos').remove([path]);throw e}
      ok++}catch(e){fail++}
  }
  bar.classList.remove('on');
  toast(fail?`${ok} foto${ok!==1?'s':''} enviada${ok!==1?'s':''}, ${fail} falharam.`:`${ok} foto${ok!==1?'s':''} adicionada${ok!==1?'s':''} 📸`);
  loadAll();
}

// ---------- lightbox ----------
function lbList(){const l=S.lb;if(!l)return[];if(l.kind==='recent'){const g=scopeIds();return S.photos.filter(p=>g.has(p.groupId)).sort((a,b)=>b.createdAt-a.createdAt).slice(0,12)}return photosOf(l.kind,l.id)}
function renderLB(){
  const el=$('#lb');const list=lbList();
  if(!S.lb||!list.length){el.classList.remove('on');S.lb=null;return}
  if(S.lb.i>=list.length)S.lb.i=list.length-1;const p=list[S.lb.i];
  el.innerHTML=`<div class="lbtop"><span>${S.lb.i+1} / ${list.length}</span><button data-lb="close" aria-label="Fechar">✕</button></div>
  <div class="lbimg"><img src="${esc(pUrl(p))}" alt=""></div>
  ${list.length>1?`<button class="lbnav l" data-lb="prev" aria-label="Anterior">‹</button><button class="lbnav r" data-lb="next" aria-label="Seguinte">›</button>`:''}
  <div class="lbbot">${av(p.uid)}<div><b>${esc(nameOf(p.uid))}</b><div class="small">${ago(p.createdAt)}</div></div>
  <span style="margin-left:auto;display:flex;gap:8px"><a class="lbbtn" href="${esc(pUrl(p))}" target="_blank" rel="noopener">⬇︎ Abrir</a>${canDelPhoto(p)?`<button class="lbbtn" data-lb="del">🗑</button>`:''}</span></div>`;
  el.classList.add('on');
}
function openLB(kind,id,i){S.lb={kind,id,i:+i};renderLB()}
function lbMove(d){const n=lbList().length;if(!n)return;S.lb.i=(S.lb.i+d+n)%n;renderLB()}

// ---------- events ----------
document.addEventListener('click',e=>{
  const lb=e.target.closest('[data-lb]');
  if(lb){const a=lb.dataset.lb;e.stopPropagation();
    if(a==='close'){S.lb=null;$('#lb').classList.remove('on');return}
    if(a==='prev')return lbMove(-1);if(a==='next')return lbMove(1);
    if(a==='del'){const p=lbList()[S.lb.i];if(!p)return;return act(async()=>{if(!await ask('Apagar esta foto?','Apagar'))return;
      chk(await sb.from('photos').delete().eq('id',p.id));if(p.uid===S.uid)sb.storage.from('photos').remove([p.path]);
      S.photos=S.photos.filter(x=>x.id!==p.id);renderLB();toast('Foto apagada.');loadAll()})}
    return}
  if(e.target.closest('a[href^="http"]'))return;
  const t=e.target.closest('[data-eopen],[data-gadd],[data-ph],[data-eedit],[data-edel],[data-eshare],[data-act="esave"]');if(!t)return;const d=t.dataset;
  if(d.eopen){e.preventDefault();return openSheet({type:'event',id:d.eopen})}
  if(d.ph){e.stopPropagation();const [k,id,i]=d.ph.split('|');return openLB(k,id,i)}
  if(d.gadd){e.stopPropagation();gTarget=d.gadd.split('|');$('#multi').value='';return $('#multi').click()}
  if(d.eedit){const ev=S.events.find(x=>x.id===d.eedit);if(ev)openEForm(ev,ev.id);return}
  if(d.edel)return act(async()=>{if(!await ask('Apagar o evento e todas as fotos dele?','Apagar'))return;const id=d.edel;closeSheet();
    const mine=S.photos.filter(p=>p.eid===id&&p.uid===S.uid).map(p=>p.path);chk(await sb.from('events').delete().eq('id',id));
    if(mine.length)sb.storage.from('photos').remove(mine);toast('Evento apagado.');loadAll()});
  if(d.eshare){const ev=S.events.find(x=>x.id===d.eshare);if(!ev)return;const r=ev.rid&&S.rests.find(x=>x.id===ev.rid);
    return shareText(`🎉 ${ev.title}\n📅 ${fmtDate(ev.date)}${r?'\n🍽️ '+r.name:''}\n📷 ${photosOf('event',ev.id).length} fotos na Adega dos Amigos — junta as tuas! ${appUrl()}`)}
  if(d.act==='esave')return saveEvent();
},true);
document.addEventListener('change',e=>{if(e.target.id==='multi')uploadGallery(e.target.files)});
document.addEventListener('keydown',e=>{if(!S.lb)return;
  if(e.key==='Escape'){S.lb=null;$('#lb').classList.remove('on');e.stopImmediatePropagation();e.preventDefault()}
  else if(e.key==='ArrowLeft')lbMove(-1);else if(e.key==='ArrowRight')lbMove(1)},true);
let tx=null;
document.addEventListener('touchstart',e=>{if(S.lb&&e.target.closest('#lb'))tx=e.touches[0].clientX},{passive:true});
document.addEventListener('touchend',e=>{if(tx==null||!S.lb)return;const dx=e.changedTouches[0].clientX-tx;tx=null;if(Math.abs(dx)>50)lbMove(dx<0?1:-1)},{passive:true});

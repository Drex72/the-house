import {HouseScene} from './scene.js';
import {RoomVoice} from './voice.js';
import {IslandStereo,ORIGINAL_TRACKS} from './stereo.js';
import {FLOOR_HEIGHT,ROOMS,INTERACTABLES,OBJECT_ACTIONS,interactionInRange} from './world-layout.js';
import {pathToObject} from './navigation.js';
import {NEED_KEYS,NEED_META,clampNeed} from './needs.js';
const $=id=>document.getElementById(id);
const el={world:$('world'),labels:$('scene-labels'),cast:$('cast-list'),panel:$('panel-content'),panelRoot:$('activity-panel'),clock:$('phase-clock'),phase:$('phase-name'),progress:$('phase-progress-bar'),count:$('online-count'),coin:$('coin-count'),rooms:$('rooms-flyout'),emotes:$('emote-controls'),joystick:$('joystick'),knob:$('joystick-knob'),overlay:$('entry-overlay'),toast:$('toast')};
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const randomId=()=>globalThis.crypto?.randomUUID?.()||('guest-'+Math.random().toString(36).slice(2)+Date.now());
let uid;try{uid=localStorage.getItem('house-profile-id');if(!uid){uid=randomId();localStorage.setItem('house-profile-id',uid);}}catch{uid=randomId();}
// A rejected WebGL shader must never prevent the menus or join controls from working.
// Replace the canvas before acquiring a 2D context: a canvas cannot switch context types.
let scene;
let usedGraphicsFallback=false;
try { scene=new HouseScene(el.world); }
catch (error) {
 console.error('WebGL renderer initialization failed, using 2D fallback:',error);
 usedGraphicsFallback=true;
 const replacement=el.world.cloneNode(false);
 el.world.replaceWith(replacement);el.world=replacement;
 scene=new HouseScene(el.world,{forceCanvas2D:true});
}
if(scene.available){scene.setMode('lower');scene.camera.eye=[32,58,50];scene.camera.target=[0,0,2];} // overview behind welcome screen
const state={role:'viewer',actorId:null,selected:null,camera:'room',tab:'gist',name:'Lagos Legend',profile:{coins:1200,owned:['lagos-tee','denim'],outfit:'lagos-tee',skin:3,hair:1,votedPhase:''},items:[],templates:[],rooms:ROOMS,cast:[],feed:[],requests:[],votes:{},phase:null,connected:false,joined:false,paymentsEnabled:false,paymentToken:null,apiOrigin:location.origin,wing:'male',roomFloor:0,needs:null,objects:INTERACTABLES,devices:{},roomLights:{},socialInvites:[],selectedObject:null};
const skins=['#f0bc96','#cf936f','#a76b4c','#784832','#513324','#31221c'];
const hairNames=['Fresh fade','Natural curls','Braids','Headwrap'];
const emoji={host:'✳',chat:'✉',request:'☝',gift:'🎁',event:'✦'};
let socket,toastTimer,renderAt=0,labelsAt=0,lastFeedId='',lastPanelId='',retryTimer;
let autoRoute=null,queuedAction=null,routeFailures=0,lastInviteRendered=null;
const voice=new RoomVoice(send,notify);
const stereo=new IslandStereo();
function notify(message){el.toast.textContent=message;el.toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.toast.classList.remove('show'),2100);}
function dismissToast(){clearTimeout(toastTimer);el.toast.classList.remove('show');}
function send(type,data={}){if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type,...data}));}
async function connect(role){
 state.name=$('entry-name').value.trim().slice(0,18)||'Lagos Legend';state.role=role;state.wing=$('entry-wing').value;
 $('join-viewer').disabled=true;$('join-housemate').disabled=true;
 if(socket){try{socket.close();}catch{}}
 const proto=location.protocol==='https:'?'wss':'ws';
 let endpoint=`${proto}://${location.host}/live`;
 try{
  const response=await fetch('/runtime-config.json',{cache:'no-store'});
  if(response.ok){const config=await response.json();if(config.websocketUrl){
   const url=new URL(String(config.websocketUrl));
   if(!['ws:','wss:'].includes(url.protocol)||(location.protocol==='https:'&&url.protocol!=='wss:'))throw new Error('Insecure or invalid WebSocket URL');
   endpoint=url.href;
  }}
 }catch(e){console.warn('Using the same-origin live server:',e);}
 state.apiOrigin=new URL(endpoint.replace(/^ws/, 'http')).origin;
 const ws=new WebSocket(endpoint);socket=ws;
 ws.addEventListener('open',()=>{if(socket!==ws)return;state.connected=true;send('join',{role,name:state.name,profileId:uid,wing:state.wing});});
 ws.addEventListener('message',event=>{
  if(socket!==ws)return;
  let data;try{data=JSON.parse(event.data);}catch{return;}
  if(data.type==='welcome'){
   state.role=data.role;state.actorId=data.actorId;scene.localActorId=data.actorId;state.profile=data.profile;state.items=data.items;state.rooms=data.rooms;state.templates=data.templates;state.objects=data.objects||INTERACTABLES;state.paymentsEnabled=Boolean(data.paymentsEnabled);state.paymentToken=data.paymentToken;
   autoRoute=null;queuedAction=null;state.joined=true;state.selected=data.actorId||state.cast[0]?.id||null;scene.targetActor=state.selected;$('open-profile').textContent=(state.name[0]||'Y').toUpperCase();
   const m=state.role==='housemate'?'follow':'lower';setCamera(m);
   el.overlay.hidden=true;$('room-badge').hidden=false;$('quick-controls').hidden=false;$('quick-explore').hidden=state.role!=='viewer';el.emotes.hidden=true;el.joystick.hidden=state.role!=='housemate'||!matchMedia('(pointer:coarse)').matches;
   document.querySelectorAll('#camera-buttons [data-camera]').forEach(b=>b.hidden=!(b.dataset.for==='both'||b.dataset.for===state.role));
   $('voice-toggle').hidden=state.role!=='housemate';
   notify(state.role==='housemate'?'Welcome to the island. Move with WASD or your joystick.':'Welcome to the island. Choose a room or explore downstairs.');
   renderUI(true);return;
  }
  if(data.type==='snapshot'){
   state.cast=data.cast||[];state.devices=Object.fromEntries((data.devices||[]).map(d=>[d.id,d]));state.roomLights=data.roomLights||{};scene.devices=state.devices;scene.roomLights=state.roomLights;
   const listener=state.cast.find(a=>a.id===state.actorId);const listeningRoom=state.role==='housemate'?listener?.room:(state.camera==='room'?scene.room:null);
   stereo.sync({...(state.devices['music-stereo']||{}),room:listeningRoom});
   state.feed=data.feed||[];state.requests=data.requests||[];state.socialInvites=data.socialInvites||[];state.votes=data.votes||{};state.phase=data.phase;renderSocialInvite();
   if(!state.cast.some(a=>a.id===state.selected))state.selected=state.cast[0]?.id||null;
   scene.targetActor=state.role==='housemate'?state.actorId:state.selected;scene.setActors(state.cast);scene.items=state.items;if(state.role==='housemate')voice.sync(state.actorId,state.cast);
   if(state.joined && (data.feed?.[0]?.id!==lastFeedId||data.cast?.length!==state.previousCastCount)){state.previousCastCount=data.cast?.length||0;lastFeedId=data.feed[0]?.id;renderUI(true);}
   return;
  }
  if(data.type==='voice-signal'){void voice.onSignal(data);return;}
  if(data.type==='action-result'){notify(data.message||(data.ok?'Done.':'Action unavailable.'));if(data.ok&&data.openPanel==='shop')setTab('shop');if(!data.ok){autoRoute=null;queuedAction=null;}return;}
  if(data.type==='profile'){state.profile=data.profile;el.coin.textContent=Number(state.profile.coins).toLocaleString();if(state.tab==='shop')renderPanel();}
 });
 ws.addEventListener('close',()=>{
  if(socket!==ws)return;
  state.connected=false;stereo.sync({powered:false});voice.disable(false);$('voice-toggle').classList.remove('active');$('voice-toggle').textContent='🎙 Voice off';
  if(state.joined){notify('Connection lost. Reconnecting...');clearTimeout(retryTimer);retryTimer=setTimeout(()=>{if(!state.connected){state.joined=false;connectWithoutDialog();}},2400);}
  else{$('join-viewer').disabled=false;$('join-housemate').disabled=false;notify('Could not connect. Try again.');}
 });
 ws.addEventListener('error',()=>{if(socket!==ws)return;if(!state.joined)notify('Server unavailable. Start the Node server first.');});
}
function connectWithoutDialog(){const input=$('entry-name');input.value=state.name;connect(state.role);}
$('join-viewer').addEventListener('click',()=>connect('viewer'));
$('join-housemate').addEventListener('click',()=>connect('housemate'));
$('entry-name').addEventListener('keydown',e=>{if(e.key==='Enter')connect('viewer');});
function setCamera(mode){
 if(!scene.available){notify('This browser cannot render the house.');return;}
 const playerModes=['follow','orbit','shoulder','firstperson','topdown'];
 const viewerModes=['follow','room','lower','upper','director'];
 if(state.role==='housemate'&&!playerModes.includes(mode))return;
 if(state.role==='viewer'&&!viewerModes.includes(mode))return;
 if(mode==='follow'&&state.role==='viewer'&&!state.cast.some(a=>a.id===state.selected&&!a.hidden)){notify('Choose a visible housemate or select a room instead.');return;}
 state.camera=mode;scene.setMode(mode);
 if(playerModes.includes(mode))scene.targetActor=state.role==='housemate'?state.actorId:state.selected;
 if(mode==='lower')state.roomFloor=0;
 if(mode==='upper')state.roomFloor=1;
 document.querySelectorAll('[data-camera]').forEach(b=>b.classList.toggle('active',b.dataset.camera===mode));
 const labels={lower:'DOWNSTAIRS · COMPOUND LEVEL',upper:'UPSTAIRS · BEDROOM WINGS',room:`ROOM CAMERA · ${roomName(scene.room).toUpperCase()}`,director:'OGA HOUSE · AUTOMATIC DIRECTOR',firstperson:'PLAYER POV · FIRST PERSON',topdown:'PLAYER CAMERA · TOP DOWN',orbit:'PLAYER CAMERA · FREE ORBIT',shoulder:'PLAYER CAMERA · OVER THE SHOULDER',follow:'FOLLOW CAMERA · LIVE HOUSEMATE'};
 $('camera-caption').textContent=labels[mode]||'THE HOUSE · LAGOS';
 $('camera-hint').textContent=['lower','upper','room','orbit','shoulder','topdown'].includes(mode)?'DRAG TO ROTATE · SCROLL TO ZOOM':'WASD / JOYSTICK TO WALK';
 const quick=$('quick-view');if(quick)quick.textContent=`◉ ${({lower:'Downstairs',upper:'Upstairs',room:'Room view',director:'Live view',firstperson:'POV',topdown:'Top view',orbit:'Orbit',shoulder:'Shoulder',follow:'Follow'})[mode]||'Camera'}`;
}
function closeDrawers(){
 $('cast-panel').classList.remove('is-open');el.panelRoot.classList.remove('is-open');
 $('drawer-backdrop').hidden=true;$('open-menu').setAttribute('aria-expanded','false');
}
function closeObjectMenu(){const menu=$('object-popover');menu.hidden=true;state.selectedObject=null;scene.selectedObject=null;}
function closeAllMenus(){closeDrawers();el.rooms.hidden=true;$('camera-flyout').hidden=true;$('activities-flyout').hidden=true;closeObjectMenu();$('quick-view').setAttribute('aria-expanded','false');}
function openDrawer(kind){
 dismissToast();closeObjectMenu();el.rooms.hidden=true;$('camera-flyout').hidden=true;$('activities-flyout').hidden=true;
 $('cast-panel').classList.toggle('is-open',kind==='cast');
 el.panelRoot.classList.toggle('is-open',kind==='activity');
 $('drawer-backdrop').hidden=false;$('open-menu').setAttribute('aria-expanded','true');
}
const cameraOptions={
 viewer:[['room','▦','Select a room'],['lower','⌂','Downstairs overview'],['upper','⌃','Upstairs overview'],['follow','◉','Follow a housemate'],['director','▣','Live director']],
 housemate:[['follow','◉','Follow camera'],['orbit','⟳','Free orbit'],['shoulder','◔','Shoulder camera'],['firstperson','⊙','First-person POV'],['topdown','⌗','Top-down view']]
};
function showCameraMenu(){
 dismissToast();closeObjectMenu();closeDrawers();el.rooms.hidden=true;$('activities-flyout').hidden=true;
 const fly=$('camera-flyout');fly.hidden=!fly.hidden;
 $('quick-view').setAttribute('aria-expanded',String(!fly.hidden));
 if(fly.hidden)return;
 fly.innerHTML='<div class="flyout-heading"><h3>Choose your view</h3><button type="button" data-close-camera aria-label="Close camera menu">✕</button></div>'+cameraOptions[state.role].map(([mode,icon,label])=>`<button type="button" class="camera-choice ${state.camera===mode?'active':''}" data-camera-choice="${mode}"><span>${icon} &nbsp; ${label}</span>${state.camera===mode?'<small>Selected ✓</small>':'<small>→</small>'}</button>`).join('');
}
$('open-menu').addEventListener('click',()=>{
 if(el.panelRoot.classList.contains('is-open'))closeDrawers();
 else{renderPanel();openDrawer('activity');}
});
$('drawer-people')?.addEventListener('click',()=>openDrawer('cast'));
$('cast-close').addEventListener('click',closeDrawers);
$('cast-back').addEventListener('click',()=>openDrawer('activity'));
$('drawer-backdrop').addEventListener('click',closeAllMenus);
$('quick-view').addEventListener('click',showCameraMenu);
$('quick-explore').addEventListener('click',()=>openRooms());
$('camera-flyout').addEventListener('click',e=>{
 if(e.target.closest('[data-close-camera]')){$('camera-flyout').hidden=true;$('quick-view').setAttribute('aria-expanded','false');return;}
 const b=e.target.closest('[data-camera-choice]');if(!b)return;
 $('camera-flyout').hidden=true;$('quick-view').setAttribute('aria-expanded','false');
 if(b.dataset.cameraChoice==='room'){openRooms(true);return;}
 setCamera(b.dataset.cameraChoice);
});
function roomName(id){return state.rooms.find(r=>r.id===id)?.name||'The Lounge';}
function chooseActor(id){if(!state.cast.find(c=>c.id===id&&!c.hidden))return;state.selected=id;
 if(state.role==='viewer'){scene.targetActor=id;setCamera('follow');}else notify('Watching your own character.');
 renderCast();}
function avatar(a){const skin=skins[a.skin]||skins[3],shirt=state.items.find(i=>i.id===a.outfit)?.color||'#d48865';return `<span class="avatar-pip" style="background:${escape(shirt)}2b;--skin:${skin};--shirt:${escape(shirt)}"></span>`;}
function renderCast(){if(!state.cast.length){el.cast.innerHTML='<div class="cast-empty"><strong>THE HOUSE IS OPEN</strong><p>No real housemates are inside yet. Be the first to enter, or share the link with your friends.</p><span>0 / 10 PLAYER SLOTS</span></div>';el.count.textContent='0 / 10 real housemates';return;}el.cast.innerHTML=state.cast.map((a,i)=>`<button class="cast-member ${state.selected===a.id?'selected':''}" data-person="${a.id}" aria-label="Follow ${escape(a.name)}">${avatar(a)}<span class="cast-desc"><strong>${escape(a.name)}${a.id===state.actorId?' (you)':''}</strong><small>${a.hidden?'PRIVATE ROOM':a.floor?'UPSTAIRS':'DOWNSTAIRS'} · ${a.voiceEnabled?'🎙 LIVE':'● REAL'} · ✦ ${a.fame.toLocaleString()}</small></span><span class="follow-glyph">${state.selected===a.id?'◉':'›'}</span></button>`).join('');
 el.count.textContent=`${state.cast.length} / 10 real housemates`;
}
function setTab(tab){state.tab=tab;document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));$('right-title').innerHTML={gist:'The Gist <span>🔥</span>',vote:'Your Vote <span>♡</span>',requests:'The Request Board <span>☝</span>',shop:'The Store <span>✦</span>'}[tab];$('chat-form').hidden=tab!=='gist';renderPanel();openDrawer('activity');}
function renderFeed(){el.panel.innerHTML=`<p class="panel-intro">Straight from the house. All the banter, all the moments, all in real time.</p>`+state.feed.map(f=>`<div class="feed-item ${escape(f.type)}"><div class="feed-icon ${escape(f.type)}">${emoji[f.type]||'✦'}</div><div class="feed-content"><strong>${escape(f.name)}</strong><small>${new Date(f.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</small><p>${escape(f.text)}</p></div></div>`).join('');}
function renderVote(){const total=Object.values(state.votes).reduce((a,b)=>a+b,0),voted=state.profile.votedPhase===`${state.phase?.season}:${state.phase?.id}`;
 el.panel.innerHTML=`<p class="panel-intro">The audience decides who stays. Every viewer gets one free vote per round. ${state.cast.length?'':'Only actual connected players can receive votes.'}</p><div class="stat-row"><span><small>LIVE VOTES</small><br><strong>${total.toLocaleString()}</strong></span><span><small>YOUR VOTE</small><br><strong>${voted?'CAST':'AVAILABLE'}</strong></span></div>`+state.cast.map(a=>`<div class="voter">${avatar(a)}<div class="voter-main"><strong>${escape(a.name)}</strong><small>${state.votes[a.id]||0} vote${state.votes[a.id]===1?'':'s'}</small><div class="vote-track"><span style="width:${total?Math.round((state.votes[a.id]||0)/total*100):0}%"></span></div></div><button class="tiny-button" data-vote="${a.id}" ${voted?'disabled':''}>${voted?'✓':'VOTE'}</button></div>`).join('');}
function renderRequests(){
 const canRequest=state.role==='viewer';const targetOptions=state.cast.map(a=>`<option value="${a.id}">${escape(a.name)}</option>`).join('');
 const myRequest=state.requests.filter(r=>state.role==='housemate'?r.target===state.actorId:true);
 el.panel.innerHTML=`<p class="panel-intro">The crowd can suggest moments. Players decide whether to make them happen.</p>`+
 (canRequest&&state.cast.length?`<form class="request-form" id="request-form"><label for="request-target">ASK WHICH HOUSEMATE?</label><select id="request-target">${targetOptions}</select><label for="request-template">MAKE A REQUEST</label><select id="request-template">${state.templates.map(t=>`<option value="${t.id}">${t.icon} ${escape(t.name)}</option>`).join('')}</select><label for="request-message">OPTIONAL NOTE</label><input id="request-message" maxlength="90" placeholder="Keep it fun and respectful..."/><button type="submit" class="primary-button">Send request →</button></form>`:'')+
 (myRequest.length?myRequest.map(r=>`<article class="request-card"><div class="req-head"><span>✳ ${escape(state.cast.find(a=>a.id===r.target)?.name||'Housemate')}</span><span>${r.status==='accepted'?'✓ ACCEPTED':'OPEN'}</span></div><strong>${escape(r.text)}</strong><div class="req-foot"><small>Suggested by ${escape(r.from)}</small><button class="tiny-button" ${r.status!=='open'?'disabled':''} data-${state.role==='housemate'?'accept':'upvote'}="${r.id}">${state.role==='housemate'?'✓ Accept':'↑ '+r.votes}</button></div></article>`).join(''):'<div class="request-card">No requests yet. Start the moment!</div>');
}
function renderShop(){const owned=state.profile.owned||[];
 el.panel.innerHTML=`<div class="store-header"><strong>STYLE BOUTIQUE</strong><small>✦ ${Number(state.profile.coins||0).toLocaleString()} NOTES</small></div>
 <p class="panel-intro">Own your looks. Starter styles are free; every additional outfit must be purchased with earned Notes or verified ₦ checkout.</p>
 ${state.items.some(it=>it.currency==='NGN')?`<label class="eyebrow" for="checkout-email">RECEIPT EMAIL FOR NAIRA ITEMS</label><input class="checkout-email" id="checkout-email" type="email" autocomplete="email" placeholder="Email for optional real-money checkout" value="${escape(state.receiptEmail||'')}"/>`:''}
 <div class="shop-grid">${state.items.map(it=>{
 const has=owned.includes(it.id),equipped=state.profile.outfit===it.id,premium=it.currency==='NGN';
 const price=premium?`₦${(it.price/100).toLocaleString('en-NG')}`:`✦ ${it.price.toLocaleString()}`;
 const action=has?'equip':premium?'pay':'buy';
 return `<article class="shop-card"><div class="shop-art" style="--item-color:${escape(it.color)};--item-accent:${escape(it.accent)}"><div class="garment">${it.icon}</div>${has?'<small>OWNED</small>':premium?'<small>PREMIUM</small>':''}</div><div class="shop-details"><small>${escape(it.category)}</small><strong>${escape(it.name)}</strong><button class="${has?'owned':''}" data-${action}="${it.id}" ${equipped||(!has&&premium&&!state.paymentsEnabled)?'disabled':''}>${equipped?'✓ Wearing':has?'Wear it':premium&&!state.paymentsEnabled?price+' · Unavailable':price}</button></div></article>`;}).join('')}</div>
 <p class="store-note">${state.paymentsEnabled?'Premium items use secure Paystack checkout with server-side payment verification.':'Real-money checkout is not enabled in this preview. No money can be charged.'} Earned Notes cannot be cashed out.</p>`;
}
function renderPanel(){const active=document.activeElement;if(el.panel.contains(active)&&['INPUT','SELECT','TEXTAREA'].includes(active?.tagName))return;
 if(state.tab==='gist')renderFeed();if(state.tab==='vote')renderVote();if(state.tab==='requests')renderRequests();if(state.tab==='shop')renderShop();}
function renderNeeds(){
 const hud=$('needs-hud');if(!hud)return;
 const me=state.cast.find(a=>a.id===state.actorId),needs=me?.needs;
 hud.hidden=state.role!=='housemate'||!needs;
 if(hud.hidden)return;
 // Four small unobtrusive bars; never cover the 3D scene or mobile joystick.
 hud.innerHTML='<h3>YOUR NEEDS <small>LIVE</small></h3>'+NEED_KEYS.map(k=>{
  const n=clampNeed(needs[k]??0),m=NEED_META[k];
  const tone=n<=22?'critical':n<=45?'low':'good';
  return `<div class="need-row" title="${m.label}: ${Math.round(n)} out of 100"><span>${m.icon} ${m.label}</span><div class="need-track"><i class="${tone}" style="width:${n}%"></i></div><b>${Math.round(n)}</b></div>`;
 }).join('');
}
function renderUI(force=false){if(!state.joined)return;const now=performance.now();if(!force&&now-renderAt<850)return;renderAt=now;
 renderCast();renderPanel();el.coin.textContent=Number(state.profile.coins).toLocaleString();
 if(state.role==='housemate'){const me=state.cast.find(a=>a.id===state.actorId),room=state.rooms.find(r=>r.id===me?.room),interact=$('interact-action');if(interact){interact.hidden=!room;interact.textContent=me?.pose?'↑ Stand up':room?`${room.icon} Activities`:'';interact.title=me?.pose?'Stop using the furniture':room?`Activities in ${room.name}`:'';}if(!$('activities-flyout').hidden)renderActivities();}
 renderNeeds();
 const badge=$('room-badge');if(badge){const me=state.cast.find(a=>a.id===state.actorId);const room=state.rooms.find(r=>r.id===(state.role==='housemate'?me?.room:scene.room));badge.textContent=state.role==='viewer'&&state.camera==='upper'?'⌃ UPSTAIRS · LIVE':state.role==='viewer'&&state.camera==='lower'?'⌂ DOWNSTAIRS · POOL & COMPOUND':room?`${room.icon} ${room.name}`:'THE HOUSE · LAGOS';}
 if(state.phase){el.phase.textContent=state.phase.label;const minutes=Math.floor(state.phase.remaining/60),seconds=state.phase.remaining%60;el.clock.textContent=`${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;el.progress.style.width=`${100*(1-state.phase.remaining/state.phase.length)}%`;}
}
function openRooms(force=false){if(state.role==='housemate')return;closeObjectMenu();closeDrawers();$('camera-flyout').hidden=true;
 if(!force)el.rooms.hidden=!el.rooms.hidden;
 if(el.rooms.hidden)return;
 const floor=state.roomFloor;
 el.rooms.innerHTML=`<div class="flyout-heading"><h3>SELECT A CAMERA · ${state.rooms.length} PLAYABLE SPACES</h3><button type="button" data-close-rooms aria-label="Close room selector">✕</button></div>
 <p>Room cameras and level-specific overviews only. Diaries, washrooms and changing areas remain private.</p>
 <div class="floor-picker"><button data-floor="0" class="${floor===0?'active':''}">⌂ Downstairs & pool</button><button data-floor="1" class="${floor===1?'active':''}">⌃ Upstairs & wings</button></div>`+
 state.rooms.filter(r=>r.floor===floor).map(r=>`<button class="room-row ${!r.viewable?'privacy':''}" ${r.viewable?'':'disabled'} data-room="${r.id}"><span>${r.icon} ${escape(r.name)}</span><small>${r.viewable?'WATCH ROOM':'PRIVATE'}</small></button>`).join('');
}
function renderActivities(){
 const me=state.cast.find(a=>a.id===state.actorId),room=state.rooms.find(r=>r.id===me?.room);
 const pane=$('activities-flyout');
 if(!room){pane.hidden=true;return;}
 const busy=Boolean(me.pose||(me.activity&&me.activityUntil>Date.now()));
 const effects=a=>Object.entries(a.effects||{}).filter(([,v])=>v!==0).map(([key,n])=>{
   const meta=NEED_META[key];return `${n>0?'+':''}${n} ${meta?.label||key}`;
 }).join(' · ');
 pane.innerHTML=`<div class="flyout-heading"><h3>${room.icon} ${escape(room.name)}</h3><button data-close-activities aria-label="Close activities">✕</button></div><p>Choose something to do here. Activities restore or spend your needs and earn Notes when completed.</p>`+
 (busy?`<div class="current-activity"><strong>${escape(me.activity)}</strong><small>${me.pose&&me.activityUntil===0?'Resting · press Stand up to move':`${Math.ceil((me.activityUntil-Date.now())/1000)}s left`}</small><div class="activity-progress"><span style="width:${Math.max(2,Math.min(100,100*(Date.now()-me.activityStarted)/(me.activityUntil-me.activityStarted))).toFixed(0)}%"></span></div><button type="button" data-cancel-activity>Stop activity</button></div>`:'')+
 room.actions.map(a=>`<button ${busy?'disabled':''} class="activity-button" data-activity="${a.id}"><strong>${escape(a.title)}</strong><small>${a.title.toLowerCase().includes('stairs')?'CHANGE FLOOR':`${a.duration}s · ✦${a.reward} Notes`}</small><em>${escape(effects(a))}</em></button>`).join('');
}

async function startPremiumPurchase(itemId){
 const item=state.items.find(x=>x.id===itemId&&x.currency==='NGN');if(!item||!state.paymentsEnabled)return;
 const email=$('checkout-email')?.value?.trim()||'';
 if(!/^\S+@\S+\.\S+$/.test(email)){notify('Enter your email before checkout.');return;}
 state.receiptEmail=email;notify('Opening secure checkout...');
 try{
  const response=await fetch(`${state.apiOrigin}/api/payments/initialize`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${state.paymentToken}`},body:JSON.stringify({item:item.id,email})});
  const result=await response.json();if(!response.ok)throw Error(result.error||'Checkout unavailable');
  const popup=window.open(result.url,'_blank','noopener,noreferrer');if(!popup)notify('Allow pop-ups to open secure checkout.');
  state.paymentReference=result.reference;
  let checks=0;clearInterval(state.verifyInterval);
  state.verifyInterval=setInterval(async()=>{if(++checks>35){clearInterval(state.verifyInterval);return;}
   try{const check=await fetch(`${state.apiOrigin}/api/payments/verify?reference=${encodeURIComponent(result.reference)}`,{cache:'no-store'});const status=await check.json();if(status.paid){clearInterval(state.verifyInterval);notify('Payment verified. Your outfit is unlocked!');send('equip',{item:item.id});renderPanel();}}catch{}},8000);
 }catch(e){notify(e.message||'Checkout unavailable');}
}
$('activities-flyout').addEventListener('click',e=>{
 if(e.target.closest('[data-close-activities]')){$('activities-flyout').hidden=true;return;}
 if(e.target.closest('[data-cancel-activity]')){send('cancel-activity');$('activities-flyout').hidden=true;notify('Activity stopped.');return;}
 const b=e.target.closest('[data-activity]');if(!b)return;
 const room=state.rooms.find(r=>r.id===state.cast.find(a=>a.id===state.actorId)?.room);
 const action=room?.actions.find(a=>a.id===b.dataset.activity);if(!action)return;
 send(action.title.includes('stairs')?'travel':'interact',action.title.includes('stairs')?{}:{action:action.id});
 notify(`${action.title}${action.title.includes('stairs')?'':` · ${action.duration}s`}`);
 $('activities-flyout').hidden=true;
});
$('voice-toggle')?.addEventListener('click',async()=>{
 if(state.role!=='housemate')return;
 const on=voice.active;if(on)voice.disable();else await voice.enable();
 $('voice-toggle').classList.toggle('active',voice.active);$('voice-toggle').setAttribute('aria-pressed',String(voice.active));$('voice-toggle').textContent=voice.active?'🎙 Voice on':'🎙 Voice off';
});
document.querySelectorAll('[data-camera]').forEach(b=>b.addEventListener('click',()=>{
 if(b.dataset.camera==='room'){openRooms();return;}
 el.rooms.hidden=true;$('camera-flyout').hidden=true;setCamera(b.dataset.camera);
}));
$('view-map').addEventListener('click',()=>{state.roomFloor=0;el.rooms.hidden=false;openRooms(true);});
el.rooms.addEventListener('click',e=>{
 if(e.target.closest('[data-close-rooms]')){el.rooms.hidden=true;return;}
 const fb=e.target.closest('[data-floor]');if(fb){state.roomFloor=Number(fb.dataset.floor);openRooms(true);return;}
 const b=e.target.closest('[data-room]');if(!b||b.disabled)return;
 const room=state.rooms.find(r=>r.id===b.dataset.room);if(!room?.viewable)return;
 scene.room=room.id;state.roomFloor=room.floor;setCamera('room');el.rooms.hidden=true;
});
el.cast.addEventListener('click',e=>{const b=e.target.closest('[data-person]');if(b)chooseActor(b.dataset.person);});
el.labels.addEventListener('click',e=>{const b=e.target.closest('[data-person]');if(b)chooseActor(b.dataset.person);});
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
$('nav-vote').addEventListener('click',()=>setTab('vote'));
$('nav-gift').addEventListener('click',()=>{if(!state.selected){notify('Wait for a housemate to join before gifting.');return;}if(state.role!=='viewer'){notify('Viewers send gifts to housemates.');return;}send('gift',{target:state.selected});notify('Jollof sent to your favorite! 🍚');});
$('nav-shop').addEventListener('click',()=>setTab('shop'));
$('nav-gist').addEventListener('click',()=>setTab('gist'));
$('close-panel').addEventListener('click',closeAllMenus);
$('menu-back').addEventListener('click',closeAllMenus);
$('leave-house').addEventListener('click',()=>{
 // Leave explicitly: clear reconnection before closing the socket.
 clearTimeout(retryTimer);retryTimer=null;
 state.joined=false;state.connected=false;
 try{voice.disable(false);}catch(error){console.warn('Voice cleanup:',error);}
 const old=socket;socket=null;
 if(old){try{old.close(1000,'Left game');}catch{}}
 state.actorId=null;state.cast=[];state.selected=null;
 scene.setActors([]);scene.localActorId=null;scene.targetActor=null;scene.room='lounge';scene.setMode('lower');
 $('profile-modal').hidden=true;closeAllMenus();$('needs-hud').hidden=true;
 $('entry-overlay').hidden=false;$('room-badge').hidden=true;$('quick-controls').hidden=true;
 $('joystick').hidden=true;$('voice-toggle').hidden=true;
 $('join-viewer').disabled=false;$('join-housemate').disabled=false;
 el.labels.innerHTML='';el.count.textContent='0 / 10 real housemates';
 notify('You left the house. You can rejoin whenever you like.');
});
el.panel.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.vote){if(state.role!=='viewer'){notify('Only viewers can vote.');return;}if(state.profile.votedPhase===`${state.phase?.season}:${state.phase?.id}`){notify('You already voted this round.');return;}send('vote',{target:b.dataset.vote});state.profile.votedPhase=`${state.phase?.season}:${state.phase?.id}`;notify('Your vote has been counted!');renderPanel();}
 if(b.dataset.upvote){send('upvote',{id:b.dataset.upvote});notify('Request boosted!');}
 if(b.dataset.accept){send('accept',{id:b.dataset.accept});notify('Request accepted!');}
 if(b.dataset.buy){const it=state.items.find(x=>x.id===b.dataset.buy);if(!it)return;
  if(state.profile.coins<it.price){notify('Not enough Notes. Play to earn more!');return;}
  send('purchase',{item:it.id});state.profile.coins-=it.price;state.profile.owned=[...state.profile.owned,it.id];notify(`${it.name} added to your wardrobe!`);renderUI(true);
 }
 if(b.dataset.pay){void startPremiumPurchase(b.dataset.pay);}
 if(b.dataset.equip){send('equip',{item:b.dataset.equip});state.profile.outfit=b.dataset.equip;notify('Outfit equipped!');renderPanel();}
});
el.panel.addEventListener('submit',e=>{
 if(e.target.id!=='request-form')return;e.preventDefault();const target=$('request-target')?.value,template=$('request-template')?.value,text=$('request-message')?.value;
 send('request',{target,template,text});notify('Request sent to the house!');setTab('requests');
});
$('chat-form').addEventListener('submit',e=>{e.preventDefault();const inp=$('chat-input'),txt=inp.value.trim();if(!txt)return;send('chat',{text:txt});inp.value='';notify('Message sent to the Gist!');});
el.emotes.addEventListener('click',e=>{const b=e.target.closest('[data-emote]');if(b)send('emote',{emote:b.dataset.emote});});
$('interact-action')?.addEventListener('click',()=>{if(currentPlayer()?.pose){send('leave-object');closeAllMenus();return;}closeObjectMenu();dismissToast();closeDrawers();el.rooms.hidden=true;$('camera-flyout').hidden=true;const pane=$('activities-flyout');pane.hidden=!pane.hidden;if(!pane.hidden)renderActivities();});
function profileEditor(){const p=state.profile;
 $('profile-editor').innerHTML=`<div class="profile-section"><strong>SKIN TONE</strong><div class="swatches">${skins.map((c,i)=>`<button class="swatch ${p.skin===i?'selected':''}" style="background:${c}" data-skin="${i}" aria-label="Skin tone ${i+1}"></button>`).join('')}</div></div><div class="profile-section"><strong>HAIR STYLE</strong><div class="hair-options">${hairNames.map((n,i)=>`<button class="${p.hair===i?'selected':''}" data-hair="${i}">${escape(n)}</button>`).join('')}</div></div><div class="profile-section"><strong>YOUR LOOK</strong><p>${escape(state.items.find(it=>it.id===p.outfit)?.name||'Lagos After Dark')} · ${p.owned.length} outfits owned</p></div>`;
}
$('open-profile').addEventListener('click',()=>{closeAllMenus();$('profile-modal').hidden=false;profileEditor();});
$('profile-close').addEventListener('click',()=>{$('profile-modal').hidden=true;});
$('profile-done').addEventListener('click',()=>{$('profile-modal').hidden=true;});
$('profile-editor').addEventListener('click',e=>{
 const skin=e.target.closest('[data-skin]'),hair=e.target.closest('[data-hair]');
 if(skin){state.profile.skin=Number(skin.dataset.skin);send('customize',{skin:state.profile.skin});}
 if(hair){state.profile.hair=Number(hair.dataset.hair);send('customize',{hair:state.profile.hair});}
 if(skin||hair)profileEditor();
});
function currentPlayer(){return state.cast.find(a=>a.id===state.actorId);}
function renderSocialInvite(){
 const invite=state.socialInvites[0],element=$('social-invite');if(!element)return;
 const id=invite?.id||null;if(id===lastInviteRendered)return;lastInviteRendered=id;
 element.hidden=state.role!=='housemate'||!invite;if(element.hidden)return;
 element.innerHTML=`<strong>♡ ${escape(invite.fromName)} wants to cuddle</strong><p>They'd like to sit close to you. It's completely your choice.</p><div class="social-invite-actions"><button type="button" data-decline-invite="${escape(invite.id)}">No thanks</button><button type="button" data-accept-invite="${escape(invite.id)}">Accept</button></div>`;
}
$('social-invite').addEventListener('click',e=>{
 const b=e.target.closest('[data-decline-invite],[data-accept-invite]');if(!b)return;
 send('social-reply',{id:b.dataset.acceptInvite||b.dataset.declineInvite,accept:Boolean(b.dataset.acceptInvite)});
 $('social-invite').hidden=true;
});
function showObjectMenu(object,x,y){
 if(state.role!=='housemate')return;
 closeAllMenus();state.selectedObject=object.id;scene.selectedObject=object.id;
 const pane=$('object-popover'),me=currentPlayer();
 const occupants=state.cast.filter(a=>!a.hidden&&a.id!==state.actorId&&a.objectId===object.id&&a.pose);
 const nearby=interactionInRange(me,object);
 const isTv=['remote','tv','projector'].includes(object.kind),isMusic=['stereo','speaker','mixer'].includes(object.kind);
 const appliance=isTv?state.devices[object.room==='cinema'?'cinema-screen':'lounge-tv']:isMusic?state.devices['music-stereo']:null;
 const active=appliance?.powered,track=ORIGINAL_TRACKS[appliance?.track||0];
 pane.style.setProperty('--tap-x',`${x+12}px`);pane.style.setProperty('--tap-y',`${y+12}px`);
 const status=appliance?`<div class="object-status"><span class="status-light ${active?'on':''}"></span>${active?isMusic?`Playing ${escape(track)}`:`TV on · Channel ${Number(appliance.channel||0)+1}`:'Switched off'}</div>`:'';
 const options=[...new Set([...object.actions,'inspect'])].filter(a=>a!=='cuddle'||occupants.length>0).map(key=>{
  const action=OBJECT_ACTIONS[key];if(!action)return '';
  if(key==='cuddle')return occupants.map(a=>`<button type="button" class="object-action" data-object-choice="${key}" data-social-target="${escape(a.id)}"><span>♡</span><div>Ask ${escape(a.name)} to cuddle<small>Requires their consent</small></div></button>`).join('');
  const liveLabel=key==='tv_power'?`Turn TV ${active?'off':'on'}`:key==='music_toggle'?`${active?'Pause':'Play'} music`:key==='music_next'?`Next track`:action.label;
  const hint=key==='inspect'?'View object details':nearby?'Your housemate will perform this':'Walk over to interact';
  return `<button type="button" class="object-action" data-object-choice="${key}"><span>${action.icon}</span><div>${escape(liveLabel)}<small>${hint}</small></div></button>`;
 }).join('');
 pane.innerHTML=`<div class="object-title"><div><small>OBJECT INTERACTIONS</small><strong>${escape(object.label)}</strong></div><button type="button" data-close-object aria-label="Close object options">✕</button></div>`+status+
 `<div class="object-action-list">${options}</div>`+(isMusic?`<button type="button" class="object-sound" data-toggle-sound>${stereo.enabled?'🔇 Mute local sound':'🔊 Enable sound'}<small>Original in-game music · only heard in the studio</small></button>`:'')+
 (!nearby?'<p class="object-hint">Your character will walk over. Use WASD or the joystick to cancel.</p>':'');
 pane.hidden=false;
}
function startObjectAction(obj,key,targetId){
 const me=currentPlayer();if(!me||!obj)return;
 const action={objectId:obj.id,action:key,...(targetId?{targetId}:{})};
 if(me.pose&&me.objectId!==obj.id)send('leave-object');
 if(interactionInRange(me,obj)){send('object-act',action);return;}
 const visible=state.cast.filter(a=>a.id!==me.id&&!a.hidden);
 const path=pathToObject(me,obj,me.wing||state.wing,visible);
 if(!path?.length){notify('No clear path to this object. Try moving closer.');return;}
 autoRoute=path;queuedAction=action;routeFailures=0;
 notify(`Walking to ${obj.label}…`);
}
$('object-popover').addEventListener('click',e=>{
 if(e.target.closest('[data-close-object]')){closeObjectMenu();return;}
 if(e.target.closest('[data-toggle-sound]')){
  if(stereo.enabled){stereo.mute();notify('Studio sound muted on this device.');}else{void stereo.enable().then(ok=>{notify(ok?'Studio sound enabled.':'Sound is unavailable in this browser.');const me=currentPlayer();stereo.sync({...(state.devices['music-stereo']||{}),room:me?.room});});}
  const obj=state.objects.find(o=>o.id===state.selectedObject);if(obj)showObjectMenu(obj,e.clientX,e.clientY);return;
 }
 const b=e.target.closest('[data-object-choice]');if(!b)return;
 const obj=state.objects.find(o=>o.id===state.selectedObject);if(!obj)return;
 if(['music_toggle','music_next'].includes(b.dataset.objectChoice)&&!stereo.enabled)void stereo.enable().then(()=>{stereo.sync({...(state.devices['music-stereo']||{}),room:currentPlayer()?.room});});
 startObjectAction(obj,b.dataset.objectChoice,b.dataset.socialTarget||null);closeObjectMenu();
});
const held=new Set();const axes={x:0,z:0};let pointerStart=null,joystickPointer=null;
window.addEventListener('keydown',e=>{
 if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
 const key=e.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)){held.add(key);e.preventDefault();}
 if(state.role==='viewer'&&['1','2','3','4','5'].includes(key)){if(key==='2')openRooms();else setCamera(({1:'follow',3:'lower',4:'upper',5:'director'})[key]);}
 if(e.key==='Escape'){closeAllMenus();$('profile-modal').hidden=true;}
});
window.addEventListener('keyup',e=>held.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>held.clear());
setInterval(()=>{
 if(!state.joined||state.role!=='housemate')return;
 const me=state.cast.find(a=>a.id===state.actorId);if(me?.activityLock&&me.activityUntil>Date.now())return;
 const lateral=Number(held.has('d')||held.has('arrowright'))-Number(held.has('a')||held.has('arrowleft'))+axes.x;
 const forward=Number(held.has('w')||held.has('arrowup'))-Number(held.has('s')||held.has('arrowdown'))-axes.z;
 let dx,dz;
 if(Math.hypot(forward,lateral)>.06){autoRoute=null;queuedAction=null;[dx,dz]=scene.moveVector(lateral,forward);}
 else if(autoRoute?.length){
  const visual=scene.actors.find(a=>a.id===state.actorId)||me;
  if(!visual){autoRoute=null;queuedAction=null;return;}
  while(autoRoute.length&&Math.hypot(autoRoute[0].x-visual.x,autoRoute[0].z-visual.z)<.48)autoRoute.shift();
  if(autoRoute.length){const dest=autoRoute[0],len=Math.hypot(dest.x-visual.x,dest.z-visual.z);dx=(dest.x-visual.x)/len;dz=(dest.z-visual.z)/len;}
  else {autoRoute=null;const pending=queuedAction;queuedAction=null;if(pending)setTimeout(()=>send('object-act',pending),210);return;}
 }else return;
 if(Math.hypot(dx,dz)>.06){const moved=scene.predictActor(state.actorId,dx,dz,.07);send('move',{dx,dz});if(autoRoute){routeFailures=moved?0:routeFailures+1;if(routeFailures>24){autoRoute=null;queuedAction=null;notify('Could not reach the furniture. Try moving closer.');}}}
},70);
function installWorldPointerHandlers(canvas){
 canvas.addEventListener('pointerdown',e=>{
  if(e.button!==0&&e.pointerType==='mouse')return;
  pointerStart={x:e.clientX,y:e.clientY,prevX:e.clientX,t:performance.now(),moved:false,pointerId:e.pointerId};
  try{canvas.setPointerCapture(e.pointerId);}catch{}
 });
 canvas.addEventListener('pointermove',e=>{
  if(!pointerStart||pointerStart.pointerId!==e.pointerId)return;
  if(Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)>9)pointerStart.moved=true;
  const dx=e.clientX-pointerStart.prevX;pointerStart.prevX=e.clientX;
  if(pointerStart.moved&&Math.abs(dx)>0){scene.orbit-=dx*.0042;}
 });
 canvas.addEventListener('pointerup',e=>{
  if(!pointerStart||pointerStart.pointerId!==e.pointerId)return;
  const tapped=!pointerStart.moved&&performance.now()-pointerStart.t<600;
  pointerStart=null;if(!tapped||!state.joined)return;
  const rect=canvas.getBoundingClientRect(),mx=e.clientX-rect.left,my=e.clientY-rect.top;
  if(state.role==='housemate'){
   const me=currentPlayer();if(!me||me.floor!==scene.viewFloor)return;
   const objects=state.objects.filter(o=>o.floor===me.floor&&o.room===me.room);
   const item=scene.pickObject(mx,my,objects);
   if(item){showObjectMenu(item,e.clientX,e.clientY);return;}
   closeObjectMenu();return;
  }
  let best=null,dist=38;
  for(const a of state.cast.filter(a=>!a.hidden&&a.floor===scene.viewFloor)){
   const p=scene.project([a.x,2.4+a.floor*FLOOR_HEIGHT,a.z]);if(!p)continue;
   const d=Math.hypot(mx-p[0],my-p[1]);if(d<dist){dist=d;best=a;}
  }
  if(best)chooseActor(best.id);
 });
 for(const kind of ['pointercancel','lostpointercapture'])canvas.addEventListener(kind,()=>{pointerStart=null;});
 canvas.addEventListener('wheel',e=>{e.preventDefault();scene.zoom=Math.max(.58,Math.min(1.6,scene.zoom+(e.deltaY>0?.075:-.075)));},{passive:false});
}
installWorldPointerHandlers(el.world);
function joystickUpdate(e){const r=el.joystick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=(e.clientX-cx)/35,dz=(e.clientY-cy)/35;const mag=Math.hypot(dx,dz);if(mag>1){dx/=mag;dz/=mag;}axes.x=dx;axes.z=dz;el.knob.style.transform=`translate(${dx*30}px,${dz*30}px)`;}
el.joystick.addEventListener('pointerdown',e=>{joystickPointer=e.pointerId;el.joystick.setPointerCapture(e.pointerId);joystickUpdate(e);});
el.joystick.addEventListener('pointermove',e=>{if(e.pointerId===joystickPointer)joystickUpdate(e);});
for(const type of ['pointerup','pointercancel','lostpointercapture'])el.joystick.addEventListener(type,()=>{joystickPointer=null;axes.x=axes.z=0;el.knob.style.transform='';});
function drawLabels(){if(!scene.available||!state.joined)return;const now=performance.now();if(now-labelsAt<95)return;labelsAt=now;
 const max=innerWidth<750?5:10,selected=state.cast.find(a=>a.id===state.selected);
 const display=state.cast.slice(0,max).filter(a=>!a.hidden&&a.floor===scene.viewFloor&&!(state.role==='housemate'&&a.id===state.actorId));
 if(selected&&!selected.hidden&&selected.floor===scene.viewFloor&&!(state.role==='housemate'&&selected.id===state.actorId)&&!display.includes(selected))display.push(selected);
 el.labels.innerHTML=display.map(a=>{const visual=scene.actors.find(v=>v.id===a.id);if(!visual)return '';const p=scene.project([visual.x,2.9+visual.floor*FLOOR_HEIGHT,visual.z]);if(!p)return '';return `<button class="scene-label ${state.selected===a.id?'selected':''}" data-person="${a.id}" style="left:${p[0].toFixed(1)}px;top:${p[1].toFixed(1)}px">${escape(a.name)}${a.id===state.actorId?'<span>YOU</span>':''}</button>`;}).join('');
}
let lastFrame=0;
let softwareRecoveryAttempted=usedGraphicsFallback;
let renderFailureShown=false;
function recoverRenderer(error){
 if(softwareRecoveryAttempted)return false;
 softwareRecoveryAttempted=true;
 console.warn('Switching house renderer to compatibility mode:',error);
 const old=scene,previousCanvas=el.world;
 const freshCanvas=previousCanvas.cloneNode(false);
 previousCanvas.replaceWith(freshCanvas);el.world=freshCanvas;
 try{
  const compatible=new HouseScene(freshCanvas,{forceCanvas2D:true});
  compatible.localActorId=old.localActorId;compatible.targetActor=old.targetActor;
  compatible.items=state.items;compatible.devices=state.devices;compatible.roomLights=state.roomLights;compatible.selectedObject=state.selectedObject;compatible.room=old.room;compatible.setMode(old.cameraMode);
  compatible.zoom=old.zoom;compatible.orbit=old.orbit;compatible.heading=old.heading;
  compatible.camera={eye:[...old.camera.eye],target:[...old.camera.target]};
  compatible.setActors(state.cast.filter(a=>!a.hidden&&Number.isFinite(a.x)&&Number.isFinite(a.z)));
  scene=compatible;installWorldPointerHandlers(freshCanvas);
  notify('Graphics compatibility mode enabled. You can keep playing.');
  renderFailureShown=false;return true;
 }catch(fallbackError){console.error('Graphics recovery failed:',fallbackError);return false;}
}
function registerContextRecovery(canvas){
 canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();recoverRenderer(new Error('WebGL context lost'));});
}
registerContextRecovery(el.world);
$('graphics-fallback').addEventListener('click',()=>{
 if(!scene.gl){notify('Compatibility graphics already active.');return;}
 if(recoverRenderer(new Error('Player selected compatibility graphics'))){closeAllMenus();}
});
function loop(now){
 const drawerVisible=$('cast-panel').classList.contains('is-open')||el.panelRoot.classList.contains('is-open')||!el.overlay.hidden;
 const budget=!scene.gl&&drawerVisible?220:innerWidth<750?32:15;
 if(scene.available&&now-lastFrame>=budget){
  try{scene.frame(now/1000);drawLabels();}catch(error){
   if(!recoverRenderer(error)&&!renderFailureShown){renderFailureShown=true;console.error('3D renderer and fallback failed:',error);notify('Graphics unavailable. Menu and chat still work.');}
  }
  lastFrame=now;
 }
 requestAnimationFrame(loop);
}
if(!scene.available){const card=document.createElement('div');card.className='unsupported';card.style='position:absolute;top:28%;left:25%;right:25%;z-index:3;background:#fff8e8;padding:20px;border-radius:12px;text-align:center';card.textContent='This browser does not support WebGL2. Try a modern Chrome, Edge, Firefox or Safari browser.';$('app').appendChild(card);}
requestAnimationFrame(loop);
setInterval(()=>renderUI(false),600);

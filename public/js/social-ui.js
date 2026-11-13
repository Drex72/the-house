/** Contextual real-player interactions and consent-based, room-local conversations. */
export function installSocialUI({state,send,notice,escape,scene,voiceNotes,closeMenus,getPlayer}){
 const $=id=>document.getElementById(id);
 let fingerprint='',selectedPerson=null;
 const getRoom=()=>{const me=getPlayer();return me?String(me.floor)+':'+me.room:null;};
 function showPersonMenu(id){
  const target=state.cast.find(a=>a.id===id&&!a.hidden),me=getPlayer();
  if(!target||!me||target.id===me.id)return;
  const nearby=Math.hypot(me.x-target.x,me.z-target.z)<=3.2&&me.floor===target.floor&&me.room===target.room;
  closeMenus();selectedPerson=id;
  const pane=$('person-popover');pane.style.setProperty('--tap-x','calc(50vw - 120px)');pane.style.setProperty('--tap-y','35vh');
  pane.innerHTML='<div class="object-title"><div><small>HOUSEMATE INTERACTION</small><strong>'+escape(target.name)+'</strong></div><button type="button" data-close-person aria-label="Close player actions">✕</button></div>'+
   [['wave','👋','Wave hello'],['highfive','🙌','High-five'],['dance','💃','Dance together'],['hug','♡','Ask for a hug']].map(([kind,icon,label])=>'<button type="button" class="object-action" data-social-kind="'+kind+'" '+(nearby?'':'disabled')+'><span>'+icon+'</span><div>'+label+'<small>'+(kind==='wave'?'Friendly gesture':'The other player must accept')+'</small></div></button>').join('')+
   (nearby?'':'<p class="object-hint">Walk closer to this housemate in the same room to interact.</p>');
  pane.hidden=false;
 }
 function renderRoomMessages(){
  const list=$('room-messages'),room=getRoom();if(!room||state.role!=='housemate')return;
  const entries=[...state.roomMessages.map(m=>({id:m.id,time:m.time,name:m.name,text:m.text})),
    ...state.voiceNotes.filter(n=>String(n.floor)+':'+n.room===room).map(n=>({...n,voice:true}))].sort((a,b)=>a.time-b.time).slice(-15);
  const next=room+':'+entries.map(e=>e.id).join(',');
  if(fingerprint===next)return;
  fingerprint=next;list.replaceChildren();
  for(const entry of entries){
   const wrapper=document.createElement('div');wrapper.className='room-message';
   const author=document.createElement('strong');author.textContent=entry.name;wrapper.appendChild(author);
   if(entry.voice){
    const audio=document.createElement('audio');audio.controls=true;audio.preload='none';audio.src=entry.url;audio.setAttribute('aria-label','Voice note from '+entry.name);wrapper.appendChild(audio);
    const seconds=document.createElement('small');seconds.textContent=' '+Math.round(entry.seconds||0)+' seconds';wrapper.appendChild(seconds);
   }else{const text=document.createElement('span');text.textContent=entry.text;wrapper.appendChild(text);}
   list.appendChild(wrapper);
  }
  if(!entries.length){const empty=document.createElement('p');empty.className='panel-intro';empty.textContent='Nobody has spoken here yet. Start the conversation.';list.appendChild(empty);}
  list.scrollTop=list.scrollHeight;
 }
 function receiveVoiceNote(note){
  if(state.role!=='housemate'||!state.joined)return;
  if(!['audio/webm','audio/webm;codecs=opus','audio/ogg','audio/ogg;codecs=opus','audio/mp4'].includes(note.mime)||typeof note.data!=='string'||note.data.length>45000)return;
  try{
   const binary=atob(note.data),bytes=new Uint8Array(binary.length);
   for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
   const url=URL.createObjectURL(new Blob([bytes],{type:note.mime}));
   state.voiceNotes.push({id:note.id,url,name:String(note.name||'Housemate'),room:note.room,floor:note.floor,seconds:note.seconds,time:note.time,voice:true});
   while(state.voiceNotes.length>12){const stale=state.voiceNotes.shift();URL.revokeObjectURL(stale.url);}
   renderRoomMessages();if($('room-chat').hidden)notice('A new voice note arrived in this room.');
  }catch(e){console.warn('Unable to decode voice note',e);}
 }
 function cleanup(){
  voiceNotes.cancel();fingerprint='';selectedPerson=null;
  for(const note of state.voiceNotes)URL.revokeObjectURL(note.url);
  state.voiceNotes=[];$('room-chat').hidden=true;$('person-popover').hidden=true;
 }
 $('person-popover').addEventListener('click',e=>{
  if(e.target.closest('[data-close-person]')){$('person-popover').hidden=true;return;}
  const choice=e.target.closest('[data-social-kind]');
  if(!choice||choice.disabled)return;
  send('social-act',{targetId:selectedPerson,kind:choice.dataset.socialKind});
  $('person-popover').hidden=true;
 });
 $('quick-chat').addEventListener('click',()=>{
  if(state.role!=='housemate')return;
  const wasOpen=!$('room-chat').hidden;
  closeMenus();if(!wasOpen){fingerprint='';$('room-chat').hidden=false;renderRoomMessages();$('room-text').focus();}
 });
 $('close-room-chat').addEventListener('click',()=>{$('room-chat').hidden=true;if(voiceNotes.active)voiceNotes.stop();});
 $('room-chat-form').addEventListener('submit',e=>{
  e.preventDefault();if(state.role!=='housemate')return;
  const input=$('room-text'),text=input.value.trim();if(!text)return;
  send('room-chat',{text});input.value='';
 });
 $('record-note').addEventListener('click',async()=>{
  if(state.role!=='housemate')return;
  if(voiceNotes.active)voiceNotes.stop();else await voiceNotes.start();
  refreshRecordButton();
 });
 function refreshRecordButton(){
  const b=$('record-note');b.classList.toggle('recording',voiceNotes.active);
  b.textContent=voiceNotes.active?'■ Stop and send voice note':'🎙 Record voice note (8s max)';
 }
 setInterval(refreshRecordButton,450);
 return {showPersonMenu,renderRoomMessages,receiveVoiceNote,cleanup};
}

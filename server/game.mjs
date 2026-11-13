import {ROOMS,ROOM_BY_ID,CHARACTER_RADIUS,canStand,advanceActor,roomAt,targetStairs,OBJECT_BY_ID,OBJECT_ACTIONS,INTERACTABLES,interactionInRange} from '../public/js/world-layout.js';
import {newNeeds,drainNeeds,applyNeedEffects} from '../public/js/needs.js';
export {ROOMS,canStand,advanceActor};
export const ITEMS=[
 {id:'lagos-tee',name:'Lagos After Dark',category:'Streetwear',price:0,color:'#ef7b50',accent:'#f7d6b0',icon:'👕'},
 {id:'denim',name:'Mainland Denim',category:'Everyday',price:0,color:'#699bcc',accent:'#e7edf4',icon:'👖'},
 {id:'ankara',name:'Ankara Energy',category:'Nigerian heritage',price:180,color:'#e8b749',accent:'#194b49',icon:'🧵'},
 {id:'agbada',name:'Owambe Royal',category:'Native',price:420,color:'#e1c48c',accent:'#776337',icon:'👘'},
 {id:'aso-ebi',name:'Aso Ebi Slay',category:'Events',price:360,color:'#c58bd0',accent:'#f4cde9',icon:'✨'},
 {id:'detty',name:'Detty December',category:'Limited drop',price:550,color:'#ff6c7d',accent:'#f5d184',icon:'🪩'},
 {id:'street',name:'Lekki Street Set',category:'Streetwear',price:250,color:'#8fb5a1',accent:'#363946',icon:'🧢'},
 {id:'night',name:'VI Night Out',category:'Evening',price:400,color:'#323b72',accent:'#ffb57f',icon:'🌙'},
 {id:'sunset',name:'Golden Hour',category:'Everyday',price:210,color:'#ec994c',accent:'#f5cf79',icon:'🌞'},
 {id:'elegance',name:'Island Elegance',category:'Premium',price:650,color:'#936b94',accent:'#efdaea',icon:'💎'},
 {id:'odogwu',name:'Odogwu Agbada Set',category:'Premium Nigeria',price:350000,currency:'NGN',color:'#d8ba74',accent:'#553460',icon:'👑'},
 {id:'softlife',name:'Soft-Life Silk Fit',category:'Premium Nigeria',price:290000,currency:'NGN',color:'#ad83ba',accent:'#f5d2e4',icon:'💜'},
 {id:'owambe-luxe',name:'Owambe Grand Entrance',category:'Premium Nigeria',price:490000,currency:'NGN',color:'#df794e',accent:'#edc67d',icon:'✨'},
];
export const REQUEST_TEMPLATES=[
 {id:'dance',name:'Show us your best dance',icon:'💃'},
 {id:'garden',name:'Meet in the garden',icon:'🌴'},
 {id:'question',name:'Answer the hot seat',icon:'🎤'},
 {id:'group',name:'Call a house meeting',icon:'🤝'},
 {id:'style',name:'Show off your outfit',icon:'✨'},
];
export const SKINS=['#f0bc96','#cf936f','#a76b4c','#784832','#513324','#31221c'];
export const MAX_HOUSEMATES=10;
const START_PHASES=[['casting',120,'Casting opens'],['round1',300,'Round 1 · First impressions'],['round2',300,'Round 2 · Plot twist'],['round3',300,'Round 3 · The heat is on'],['finale',180,'The Grand Finale']];
export function phaseAt(elapsedSeconds){
 const season=Math.floor(Math.max(0,elapsedSeconds)/1200);
 let t=((Math.max(0,elapsedSeconds)%1200)+1200)%1200;
 for(const [id,length,label] of START_PHASES){if(t<length)return {id,label,season,remaining:Math.ceil(length-t),length};t-=length;}
 return {id:'casting',label:'Casting opens',season,remaining:120,length:120};
}
export function cleanText(value,max=100){return String(value??'').replace(/<[^>]*>/g,'').replace(/[<>\u0000-\u001f]/g,'').replace(/\b(?:\+?\d[\d\s-]{8,}\d)\b/g,'[private]').trim().slice(0,max);}
export function boundedMove(actor,input,dt,otherActors=[]){return advanceActor(actor,input?.dx,input?.dz,dt,otherActors);}
export function createGame(){
 const startedAt=Date.now()-132000;
 /** No computer-controlled or synthetic participants. The cast is exactly active sockets. */
 const cast=[];const profiles=new Map(),requests=[],votes=new Map(),socialInvites=[],roomMessages=[];
 const feed=[{id:'welcome',type:'host',name:'Oga House',text:'Ẹ káàbọ̀! Explore the house, invite friends and apply to be a housemate.',time:Date.now()}];
 let seq=0,lastPhase='';
 function profile(id){let p=profiles.get(id);if(!p){p={id,coins:1200,owned:['lagos-tee','denim'],outfit:'lagos-tee',skin:3,hair:1,name:'Guest',votedPhase:'',lastRequest:0,wing:null,activityWins:0};profiles.set(id,p);}return p;}
 function addFeed(type,name,text){feed.unshift({id:`feed-${++seq}`,type,name,text,time:Date.now()});feed.length=Math.min(feed.length,25);}
 function snapshot(role='housemate',client=null){
  const phase=phaseAt((Date.now()-startedAt)/1000);
  const totals=Object.fromEntries(cast.map(a=>[a.id,votes.get(`${phase.season}:${phase.id}:${a.id}`)||0]));
  return {type:'snapshot',time:Date.now(),phase,occupancy:{housemates:cast.length,capacity:MAX_HOUSEMATES},cast:cast.map(a=>{
    const {id,name,skin,hair,outfit,x,z,angle,walking,emote,fame,line,room,activity,floor,wing,voiceEnabled}=a;
    const here=ROOM_BY_ID[room],owner=client?.actorId===id;
    const hidden=!owner && (here?.access==='private'||here?.access==='male-private'||here?.access==='female-private');
    return {id,name,skin,hair,outfit,x:hidden?null:x,z:hidden?null:z,angle,walking,emote,fame,line,room: hidden?'private':room,
      activity:hidden?'':activity,speech:hidden?null:(a.speech?.until>Date.now()?a.speech:null),socialAnimation:hidden?null:(a.socialAnimation?.until>Date.now()?a.socialAnimation:null),pose:hidden?'':a.pose,objectId:hidden?null:a.objectId,seatIndex:a.objectId?cast.filter(p=>p.objectId===a.objectId).findIndex(p=>p.id===a.id):0,activityId:hidden?'':a.activityId,activityStarted:hidden?0:a.activityStarted,activityUntil:hidden?0:a.activityUntil,activityLock:owner&&a.activityLock===true,needs:owner?{...a.needs}:null,floor,wing,voiceEnabled,hidden,bot:false};
  }),requests:requests.filter(x=>x.expires>Date.now()).map(({id,template,text,target,from,votes,status})=>({id,template,text,target,from,votes,status})),socialInvites:client?.actorId?socialInvites.filter(i=>i.targetId===client.actorId&&i.expires>Date.now()).map(i=>({id:i.id,fromId:i.fromId,fromName:i.fromName,objectId:i.objectId,kind:i.kind||'cuddle',expires:i.expires})):[],votes:totals,feed:feed.slice(0,12),roomMessages:client?.actorId?roomMessages.filter(m=>{const me=cast.find(a=>a.id===client.actorId);return me&&m.room===me.room&&m.floor===me.floor;}).slice(0,12):[],personalMetrics:client?.actorId?(()=>{const a=cast.find(x=>x.id===client.actorId);if(!a)return null;const p=profile(client.profileId);return {needs:{...a.needs},fame:a.fame,notes:p.coins,activitiesCompleted:p.activityWins,distanceWalked:Math.round(a.stats.distanceWalked),roomMessages:a.stats.messages,voiceNotes:a.stats.voiceNotes,socialInteractions:a.stats.socialInteractions,timeInHouseSeconds:Math.floor((Date.now()-a.joinedAt)/1000)};})():null};
 }
 function join(client,requestedRole,requestedName,requestedWing){
  const p=profile(client.profileId);const safe=cleanText(requestedName,18);
  if(safe)p.name=safe;
  const wing=['male','female'].includes(requestedWing)?requestedWing:'male';
  if(requestedRole==='housemate'&&!p.wing)p.wing=wing; // Assigned once per active season; no mid-game wing swapping.
  client.role='viewer';client.actorId=null;
  if(requestedRole==='housemate'&&cast.length<MAX_HOUSEMATES&&!cast.some(a=>a.profileId===client.profileId)){
    let spawn=null;
    for(const spot of [[-8,-3.1],[-5.6,-4],[-10,-3],[-6,-8],[-12,-4],[-9,-2.7],[-8,-10],[-4,-5],[-11,-7],[-8,-2]]){
      if(canStand(spot[0],spot[1],cast,null,CHARACTER_RADIUS,0,p.wing)){spawn=spot;break;}
    }
    if(!spawn){for(const room of ROOMS.filter(r=>r.floor===0&&!r.outdoor&&r.public)){if(canStand(room.x,room.z,cast,null,CHARACTER_RADIUS,0,p.wing)){spawn=[room.x,room.z];break;}}}
    if(spawn){
      const a={id:`player-${++seq}`,owner:client.id,profileId:client.profileId,name:p.name,skin:p.skin,hair:p.hair,outfit:p.outfit,x:spawn[0],z:spawn[1],angle:Math.PI,walking:false,emote:'',fame:0,line:'Here for the cruise.',room:roomAt(...spawn,0).id,floor:0,wing:p.wing,activity:'',activityUntil:0,activityRoom:null,activityLock:false,pose:'',objectId:null,joinedAt:Date.now(),stats:{distanceWalked:0,messages:0,voiceNotes:0,socialInteractions:0},needs:newNeeds(),needsUpdatedAt:Date.now(),voiceEnabled:false,lastMove:Date.now()};
      cast.push(a);client.role='housemate';client.actorId=a.id;
    }
  }
  addFeed('event','Oga House',`${p.name} joined ${client.role==='housemate'?'the real cast':'the audience'}.`);
  return {type:'welcome',role:client.role,actorId:client.actorId,profile:{...p},rooms:ROOMS,items:ITEMS,templates:REQUEST_TEMPLATES,capacity:MAX_HOUSEMATES,objects:INTERACTABLES};
 }
 function leave(client){const idx=cast.findIndex(a=>a.owner===client.id);if(idx>=0){const [a]=cast.splice(idx,1);for(let i=socialInvites.length-1;i>=0;i--)if(socialInvites[i].targetId===a.id||socialInvites[i].fromId===a.id)socialInvites.splice(i,1);for(const other of cast)if(other.pose==='cuddling'&&other.objectId===a.objectId){other.pose='sitting';other.activity='Sitting together';}addFeed('event','Oga House',`${a.name} has left the house.`);}}
  const stopPose=who=>{if(!who)return;const obj=who.objectId;who.pose='';who.objectId=null;who.activity='';who.activityUntil=0;who.activityLock=false;who.activityRoom=null;who.activityEffects=null;for(const mate of cast)if(mate.id!==who.id&&mate.objectId===obj&&mate.pose==='cuddling'){mate.pose='sitting';mate.activity='Sitting together';}};
 function process(client,msg){
  if(!msg||typeof msg!=='object')return;
  const now=Date.now(),p=profile(client.profileId),actor=cast.find(a=>a.owner===client.id);
  switch(msg.type){
   case 'move':{
     if(!actor||actor.activityLock&&actor.activityUntil>now)break;
     if(actor.pose)stopPose(actor);
     const dt=Math.min(.11,Math.max(.01,(now-(client.lastMove||now-70))/1000));
     if(actor.socialAnimation?.until>now)break;
     const beforeX=actor.x,beforeZ=actor.z;
     if(boundedMove(actor,msg,dt,cast)){actor.lastMove=now;actor.stats.distanceWalked+=Math.hypot(actor.x-beforeX,actor.z-beforeZ);}
     client.lastMove=now;break;
   }
   case 'emote': if(actor&&['wave','dance','cheer','laugh'].includes(msg.emote)){actor.emote=msg.emote;actor.emoteUntil=now+3000;addFeed('event',actor.name,`${actor.name} is ${msg.emote==='wave'?'waving':msg.emote==='dance'?'dancing':msg.emote==='cheer'?'cheering':'laughing'}!`);}break;
   case 'travel':{
     if(!actor||now-(client.lastTravel||0)<1500)break;
     const destination=targetStairs(actor.room);
     if(!destination)break;
     const room=ROOM_BY_ID[destination];
     const spots=[[room.x+2.7,room.z+2.1],[room.x-2.9,room.z-2.8],[room.x+2.5,room.z-3.2],[room.x,room.z+4.2]];
     const point=spots.find(([x,z])=>canStand(x,z,cast,actor.id,CHARACTER_RADIUS,room.floor,actor.wing));
     if(!point)break;
     actor.x=point[0];actor.z=point[1];actor.floor=room.floor;actor.room=room.id;actor.walking=false;
     stopPose(actor);client.lastTravel=now;
     addFeed('event',actor.name,`${actor.name} went ${room.floor?'upstairs':'downstairs'}.`);break;
   }
   case 'interact':{
     if(!actor||now-(client.lastInteract||0)<950)break;
     const room=ROOM_BY_ID[actor.room];if(!room)break;
     const action=room.actions.find(a=>a.id===msg.action||a.title===msg.action);
     if(!action||actor.activityUntil>now)break;
     if(action.title.includes('stairs')){ // Stairs are a dedicated movement operation.
       process(client,{type:'travel'});break;
     }
     // Reward one completed activity at a time; no immediate coin grant on click.
     if(actor.pose)stopPose(actor);
     client.lastInteract=now;actor.activity=action.title;actor.activityId=action.id;
     actor.activityRoom=room.id;actor.activityUntil=now+action.duration*1000;actor.activityLock=action.lockMovement===true;
     actor.activityStarted=now;actor.activityReward=action.reward;actor.activityEffects=action.effects;
     if(/Dance|freestyle|workout|runway|swim|HIIT|skit/i.test(action.title)){
       actor.emote='dance';actor.emoteUntil=actor.activityUntil;
     }
     addFeed('event',actor.name,`${actor.name} started: ${action.title} · ${room.name}`);break;
   }
   case 'object-act':{
     if(!actor)return {ok:false,reason:'Only housemates can use furniture.'};
     const obj=OBJECT_BY_ID[String(msg.objectId||'')];
     const key=String(msg.action||''),action=OBJECT_ACTIONS[key];
     if(!obj||!action||!obj.actions.includes(key))return {ok:false,reason:'That action is not available for this object.'};
     if(!interactionInRange(actor,obj))return {ok:false,reason:'Move closer to the furniture first.'};
     if(now-(client.lastObjectAction||0)<350)return {ok:false,reason:'Please wait a moment.'};
     if(actor.activityUntil>now)return {ok:false,reason:'Finish or stop your current activity first.'};
     const occupants=cast.filter(a=>a.id!==actor.id&&a.objectId===obj.id&&a.pose);
     const capacity=obj.kind==='sofa'?2:obj.kind==='bed'?2:1;
     if(key==='cuddle'){
       const other=occupants.find(a=>a.id===String(msg.targetId||'')&&['sitting','lying','cuddling'].includes(a.pose));
       if(!other)return {ok:false,reason:'Someone must already be sitting here to ask them.'};
       if(socialInvites.some(i=>i.targetId===other.id&&i.fromId===actor.id&&i.expires>now))return {ok:false,reason:'Invitation already sent.'};
       socialInvites.push({id:`social-${++seq}`,kind:'cuddle',fromId:actor.id,fromName:actor.name,targetId:other.id,objectId:obj.id,expires:now+30000});
       client.lastObjectAction=now;
       return {ok:true,message:`Asked ${other.name} to cuddle. Waiting for their answer.`};
     }
     if(['sit','lie','sleep'].includes(key)&&occupants.length>=capacity)return {ok:false,reason:'There is no available space here.'};
     stopPose(actor);
     actor.pose=action.pose;actor.objectId=obj.id;actor.poseStarted=now;actor.activity=action.label;actor.activityRoom=obj.room;
     actor.activityStarted=now;actor.activityUntil=action.duration?now+action.duration*1000:0;
     actor.activityLock=true;actor.walking=false;actor.lastMove=0;
     actor.activityReward=action.duration?15:0;
     actor.activityEffects=key==='eat'?{hunger:25}:key==='cook'?{hunger:10}:key==='exercise'?{energy:-9,hygiene:-8}:null;
     client.lastObjectAction=now;
     addFeed('event',actor.name,`${actor.name} chose to ${action.label.toLowerCase()} at ${obj.label}.`);
     return {ok:true,message:action.duration?`${action.label} started.`:`${action.label}. Press Stand up to move again.`};
   }
   case 'leave-object':{
     if(!actor||!actor.pose)return {ok:false,reason:'You are not using an object.'};
     stopPose(actor);return {ok:true,message:'You got up. You can move again.'};
   }
   case 'social-reply':{
     const i=socialInvites.findIndex(v=>v.id===String(msg.id||'')&&v.targetId===actor?.id&&v.expires>now);
     if(i<0)return {ok:false,reason:'Invitation expired.'};
     const [invite]=socialInvites.splice(i,1);
     if(msg.accept!==true)return {ok:true,message:'You declined the invitation.'};
     if(invite.kind&&invite.kind!=='cuddle'){
       const from=cast.find(a=>a.id===invite.fromId);
       if(!from||from.room!==actor.room||from.floor!==actor.floor||Math.hypot(from.x-actor.x,from.z-actor.z)>3.2||from.pose||actor.pose)return {ok:false,reason:'Move closer to the other player.'};
       const duration=invite.kind==='dance'?6200:invite.kind==='hug'?3800:2500;
       const animation={kind:invite.kind,startedAt:now,until:now+duration};
       from.socialAnimation={...animation,partnerId:actor.id};actor.socialAnimation={...animation,partnerId:from.id};
       from.stats.socialInteractions++;actor.stats.socialInteractions++;
       addFeed('event','The House',`${from.name} and ${actor.name} ${invite.kind==='hug'?'hugged':invite.kind==='dance'?'started dancing together':'high-fived'}!`);
       return {ok:true,message:`You accepted ${from.name}'s invitation.`};
     }
     const from=cast.find(a=>a.id===invite.fromId),obj=OBJECT_BY_ID[invite.objectId];
     if(!from||!obj||!interactionInRange(from,obj)||!interactionInRange(actor,obj)||actor.objectId!==obj.id||!['sitting','lying','cuddling'].includes(actor.pose)||from.activityUntil>now)return {ok:false,reason:'The other player is no longer nearby.'};
     if(from.objectId&&from.objectId!==obj.id)stopPose(from);
     from.pose='cuddling';from.objectId=obj.id;from.poseStarted=now;from.activity='Cuddling';from.activityLock=true;from.activityUntil=0;
     actor.pose='cuddling';actor.poseStarted=now;actor.activity='Cuddling';actor.activityLock=true;actor.activityUntil=0;
     addFeed('event','The House',`${from.name} and ${actor.name} are cuddling on the ${obj.label.toLowerCase()}.`);
     return {ok:true,message:`You accepted ${from.name}'s invitation.`};
   }
   case 'cancel-activity':{
     if(actor&&(actor.activityUntil>now||actor.pose)){stopPose(actor);actor.activityId='';addFeed('event',actor.name,`${actor.name} stopped their activity.`);}break;
   }
   case 'social-act':{
     if(!actor)return {ok:false,reason:'Housemates only.'};
     const kind=String(msg.kind||'');
     if(!['wave','highfive','hug','dance'].includes(kind))return {ok:false,reason:'Invalid interaction.'};
     const target=cast.find(a=>a.id===msg.targetId&&a.id!==actor.id);
     if(!target||target.room!==actor.room||target.floor!==actor.floor||Math.hypot(actor.x-target.x,actor.z-target.z)>3.2||actor.pose||target.pose)return {ok:false,reason:'You must be near another available housemate.'};
     if(now-(client.lastSocialAct||0)<2000)return {ok:false,reason:'Please wait a moment.'};
     client.lastSocialAct=now;
     if(kind==='wave'){actor.emote='wave';actor.emoteUntil=now+2600;return {ok:true,message:`Waved to ${target.name}.`};}
     if(socialInvites.some(i=>i.fromId===actor.id&&i.targetId===target.id&&i.expires>now))return {ok:false,reason:'An invitation is already pending.'};
     socialInvites.push({id:`social-${++seq}`,kind,fromId:actor.id,fromName:actor.name,targetId:target.id,expires:now+20000});
     return {ok:true,message:`Asked ${target.name} to ${kind==='highfive'?'high-five':kind==='hug'?'hug':'dance together'}. Waiting for approval.`};
   }
   case 'room-chat':{
     if(!actor||now-(client.lastRoomChat||0)<1300)break;
     const text=cleanText(msg.text,105);if(!text)break;
     client.lastRoomChat=now;actor.stats.messages++;
     actor.speech={text,until:now+5800};
     roomMessages.unshift({id:`room-${++seq}`,from:actor.id,name:actor.name,text,room:actor.room,floor:actor.floor,time:now});roomMessages.splice(50);
     break;
   }
   case 'voice-toggle':{
     if(actor){actor.voiceEnabled=msg.enabled===true;}
     break;
   }
   case 'chat': {
     if(now-(client.lastChat||0)<2500)break;
     const s=cleanText(msg.text,140);if(s){client.lastChat=now;addFeed('chat',actor?.name||p.name,s);if(actor){actor.stats.messages++;actor.speech={text:s.slice(0,105),until:now+5600};}}break;
   }
   case 'vote': {
     if(client.role!=='viewer')break;
     const id=String(msg.target||'');if(!cast.some(a=>a.id===id))break;
     const phase=phaseAt((now-startedAt)/1000),phaseKey=`${phase.season}:${phase.id}`;
     if(p.votedPhase===phaseKey)break;
     votes.set(`${phaseKey}:${id}`,(votes.get(`${phaseKey}:${id}`)||0)+1);p.votedPhase=phaseKey;
     addFeed('event','Oga House','A vote just landed!');break;
   }
   case 'request': {
     if(client.role!=='viewer'||now-p.lastRequest<20000)break;
     const template=REQUEST_TEMPLATES.find(t=>t.id===msg.template),target=cast.find(a=>a.id===msg.target);
     if(!template||!target)break;
     const text=cleanText(msg.text,90)||template.name;
     requests.unshift({id:`request-${++seq}`,template:template.id,text,target:target.id,from:p.name,votes:1,voters:[client.profileId],status:'open',expires:now+120000});
     requests.splice(20);p.lastRequest=now;addFeed('request',p.name,`requested: ${text}`);break;
   }
   case 'upvote': {
     const r=requests.find(x=>x.id===msg.id&&x.status==='open'&&x.expires>now);
     if(r&&!r.voters.includes(client.profileId)){r.voters.push(client.profileId);r.votes++;}break;
   }
   case 'accept': {
     const r=requests.find(x=>x.id===msg.id&&x.status==='open');if(r&&actor&&r.target===actor.id){r.status='accepted';addFeed('event',actor.name,`${actor.name} accepted: ${r.text}`);}break;
   }
   case 'purchase': {
     const item=ITEMS.find(x=>x.id===msg.item);
     if(!item||item.currency==='NGN'||p.owned.includes(item.id)||p.coins<item.price)break;
     p.coins-=item.price;p.owned.push(item.id);break;
   }
   case 'equip': {if(!p.owned.includes(msg.item))break;p.outfit=msg.item;if(actor)actor.outfit=msg.item;break;}
   case 'customize': {
     if(Number.isInteger(msg.skin)&&msg.skin>=0&&msg.skin<SKINS.length){p.skin=msg.skin;if(actor)actor.skin=p.skin;}
     if(Number.isInteger(msg.hair)&&msg.hair>=0&&msg.hair<=3){p.hair=msg.hair;if(actor)actor.hair=p.hair;}break;
   }
   case 'gift': {
     if(client.role!=='viewer'||p.coins<30||now-(client.lastGift||0)<3000)break;
     const a=cast.find(x=>x.id===msg.target);if(!a)break;
     p.coins-=30;a.fame+=10;client.lastGift=now;addFeed('gift',p.name,`sent ${a.name} a plate of jollof 🍚`);break;
   }
  }
 }
 function tick(){
  const now=Date.now(),phase=phaseAt((now-startedAt)/1000);
  if(phase.id!==lastPhase){lastPhase=phase.id;addFeed('host','Oga House',phase.label+'!');}
  for(const a of cast){
   const elapsed=now-(a.needsUpdatedAt||now);a.needs=drainNeeds(a.needs,elapsed);a.needsUpdatedAt=now;
   if(a.pose==='sleeping')a.needs.energy=Math.min(100,a.needs.energy+elapsed*.001*1.4);
   if(a.pose==='cuddling')a.needs.social=Math.min(100,a.needs.social+elapsed*.001*.75);
   a.walking=now-a.lastMove<210&&!a.activityLock;
    if(a.socialAnimation?.until<=now)a.socialAnimation=null;
   if(a.emoteUntil<now)a.emote='';
   if(a.activity&&a.activityUntil>0&&a.activityUntil<=now){
    const p=profile(a.profileId),completed=a.room===a.activityRoom;
    if(completed){p.coins+=a.activityReward||0;p.activityWins++;a.fame+=5;a.needs=applyNeedEffects(a.needs,a.activityEffects);addFeed('event',a.name,`${a.name} completed ${a.activity} and earned ✦ ${a.activityReward} Notes!`);}
    stopPose(a);a.activityId='';
   }
  }
  for(let i=requests.length-1;i>=0;i--)if(requests[i].expires<now)requests.splice(i,1);
  for(let i=socialInvites.length-1;i>=0;i--)if(socialInvites[i].expires<now)socialInvites.splice(i,1);
   for(let i=roomMessages.length-1;i>=0;i--)if(roomMessages[i].time<now-90000)roomMessages.splice(i,1);
 }
 return {cast,profile,join,leave,process,tick,snapshot,recordVoiceNote(client){const a=cast.find(p=>p.owner===client.id);if(a)a.stats.voiceNotes++;},grantPremium(profileId,itemId){const item=ITEMS.find(it=>it.id===itemId&&it.currency==='NGN');if(!item)return false;const p=profile(profileId);if(p.owned.includes(itemId))return false;p.owned.push(itemId);addFeed('event','Style Boutique',`${p.name} unlocked an exclusive boutique look.`);return true;}};
}

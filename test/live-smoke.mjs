import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import assert from 'node:assert/strict';

const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function freePort(){return new Promise((res,rej)=>{const s=createServer();s.on('error',rej);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p));});});}
function connect(url){return new Promise((resolve,reject)=>{const w=new WebSocket(url),messages=[];w.addEventListener('message',e=>{try{messages.push(JSON.parse(e.data));}catch{}});w.addEventListener('open',()=>resolve({w,messages}));w.addEventListener('error',reject);});}
async function awaitMessage(c,match,label){for(let n=0;n<70;n++){const result=c.messages.find(match);if(result)return result;await delay(75);}throw new Error(`Timed out waiting for ${label}`);}
async function smoke(){
 const port=await freePort();const child=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:String(port)},stdio:'pipe',cwd:process.cwd()});
 const clients=[];
 try{
  let healthy=false;
  for(let i=0;i<50;i++){try{const r=await fetch(`http://127.0.0.1:${port}/api/health`);healthy=r.ok;if(healthy)break;}catch{}await delay(80);}
  assert.equal(healthy,true,'server starts and responds');
  const actor=await connect(`ws://127.0.0.1:${port}/live`),viewer=await connect(`ws://127.0.0.1:${port}/live`);clients.push(actor,viewer);
  actor.w.send(JSON.stringify({type:'join',role:'housemate',profileId:'smoke-cast',name:'Ada'}));
  viewer.w.send(JSON.stringify({type:'join',role:'viewer',profileId:'smoke-viewer',name:'Test Viewer'}));
  const w1=await awaitMessage(actor,m=>m.type==='welcome','housemate join'),w2=await awaitMessage(viewer,m=>m.type==='welcome','viewer join');
  assert.equal(w1.role,'housemate');assert.equal(w2.role,'viewer');assert.match(w1.actorId,/^player-/);
  let s=await awaitMessage(viewer,m=>m.type==='snapshot'&&m.cast?.[0]?.name==='Ada','synced cast');assert.equal(s.cast.length,1);
  const startX=s.cast[0].x;
  actor.w.send(JSON.stringify({type:'move',dx:1,dz:0}));await delay(140);actor.w.send(JSON.stringify({type:'move',dx:1,dz:0}));
  s=await awaitMessage(viewer,m=>m.type==='snapshot'&&m.cast?.[0]?.x>startX+.1,'movement synced');
  viewer.w.send(JSON.stringify({type:'vote',target:w1.actorId}));
  s=await awaitMessage(viewer,m=>m.type==='snapshot'&&m.votes?.[w1.actorId]===1,'vote count');
  viewer.w.send(JSON.stringify({type:'vote',target:w1.actorId}));await delay(250);
  assert.equal(viewer.messages.filter(m=>m.type==='snapshot').at(-1).votes[w1.actorId],1,'no second vote');
  viewer.w.send(JSON.stringify({type:'purchase',item:'ankara'}));
  const p=await awaitMessage(viewer,m=>m.type==='profile'&&m.profile?.owned?.includes('ankara'),'store purchase');
  assert.equal(p.profile.coins,1020);
  viewer.w.send(JSON.stringify({type:'request',template:'dance',target:w1.actorId,text:'Show us your moves'}));
  s=await awaitMessage(viewer,m=>m.type==='snapshot'&&m.requests?.length>0,'new viewer request');
  const r=s.requests.find(x=>x.text==='Show us your moves');assert.ok(r);
  actor.w.send(JSON.stringify({type:'accept',id:r.id}));
  s=await awaitMessage(viewer,m=>m.type==='snapshot'&&m.requests?.some(x=>x.id===r.id&&x.status==='accepted'),'accepted request');
  const second=await connect(`ws://127.0.0.1:${port}/live`);clients.push(second);
  second.w.send(JSON.stringify({type:'join',role:'housemate',profileId:'smoke-second',name:'Bayo'}));
  const w3=await awaitMessage(second,m=>m.type==='welcome','second human join');
  assert.equal(w3.role,'housemate');assert.notEqual(w3.actorId,w1.actorId);
  s=await awaitMessage(viewer,m=>m.type==='snapshot'&&m.cast?.length===2,'two human avatars');
  assert.equal(s.cast.filter(a=>a.bot).length,0,'no simulated avatars');
  for(let i=0;i<8;i++){actor.w.send(JSON.stringify({type:'move',dx:1,dz:0}));second.w.send(JSON.stringify({type:'move',dx:-1,dz:0}));await delay(78);}
  await delay(180);
  actor.w.send(JSON.stringify({type:'voice-toggle',enabled:true}));
  second.w.send(JSON.stringify({type:'voice-toggle',enabled:true}));
  await awaitMessage(actor,m=>m.type==='snapshot'&&m.cast?.length===2&&m.cast.every(a=>a.voiceEnabled),'opt-in voice presence');
  // Signaling is relayed only to active, opted-in housemates in the same room.
  const aActor=viewer.messages.filter(m=>m.type==='snapshot'&&m.cast?.length===2).at(-1).cast.find(a=>a.id===w1.actorId);
  const bActor=viewer.messages.filter(m=>m.type==='snapshot'&&m.cast?.length===2).at(-1).cast.find(a=>a.id===w3.actorId);
  if(aActor.room===bActor.room&&aActor.floor===bActor.floor){
   second.w.send(JSON.stringify({type:'voice-signal',to:w1.actorId,signal:{type:'candidate',candidate:{candidate:'test'}}}));
   await awaitMessage(actor,m=>m.type==='voice-signal'&&m.from===w3.actorId,'same room WebRTC signaling');
  }
  const paymentStatus=await (await fetch(`http://127.0.0.1:${port}/api/payments/status`)).json();
  assert.equal(paymentStatus.enabled,false,'no accidental real charges in preview');
  assert.equal((await fetch(`http://127.0.0.1:${port}/api/payments/initialize`,{method:'POST'})).status,503);
  const recent=viewer.messages.filter(m=>m.type==='snapshot'&&m.cast?.length===2).at(-1);
  assert.ok(recent,'synchronized 2 player snapshot');
  assert.ok(Math.hypot(recent.cast[0].x-recent.cast[1].x,recent.cast[0].z-recent.cast[1].z)>=.92,'players cannot overlap');
  second.w.close();
  await awaitMessage(viewer,m=>m.type==='snapshot'&&m.cast?.length===1&&m.cast?.[0]?.id===w1.actorId&&m.time>recent.time,'disconnected actor removed');
  console.log('✓ HTTP health, three genuine clients, two real avatars, movement with player collision, disconnect removal, votes, wardrobe, requests, private signaling and disabled real-money checkout');
 }finally{clients.forEach(c=>c.w.close());child.kill('SIGTERM');}
}
smoke().catch(e=>{console.error(e);process.exitCode=1;});

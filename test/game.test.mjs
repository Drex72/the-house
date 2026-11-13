import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,phaseAt,boundedMove,cleanText,ROOMS,MAX_HOUSEMATES,ITEMS} from '../server/game.mjs';
import {canStand,roomAt,advanceActor,canEnter,FLOOR_HEIGHT,targetStairs} from '../public/js/world-layout.js';

function person(id,wing='male'){const c={id,profileId:`profile-${id}`};return {client:c,wing};}
test('24 rooms: 16 downstairs/outdoor, 8 upstairs, no city roads or NPCs',()=>{
 assert.equal(ROOMS.length,24);assert.equal(new Set(ROOMS.map(r=>r.id)).size,24);
 assert.equal(ROOMS.filter(r=>r.floor===0).length,16);
 assert.equal(ROOMS.filter(r=>r.floor===1).length,8);
 assert.equal(FLOOR_HEIGHT,5.2);assert.equal(roomAt(-8,-5,0).id,'lounge');
 assert.equal(roomAt(-24,23,0).id,'pool');assert.equal(roomAt(8,-19,1).id,'female-bedroom');
 assert.equal(ROOMS.find(r=>r.id==='diary').viewable,false);
 assert.equal(ROOMS.find(r=>r.id==='male-bath').viewable,false);
 assert.equal(ROOMS.find(r=>r.id==='female-bath').viewable,false);
 assert.ok(ROOMS.every(r=>r.actions.length>=3));
});
test('20-minute season flow is deterministic',()=>{
 assert.equal(phaseAt(0).id,'casting');assert.equal(phaseAt(120).id,'round1');
 assert.equal(phaseAt(420).id,'round2');assert.equal(phaseAt(720).id,'round3');
 assert.equal(phaseAt(1020).id,'finale');assert.equal(phaseAt(1200).season,1);
});
test('no bots at startup, real connected users only; leave removes avatar',()=>{
 const g=createGame();assert.equal(g.cast.length,0);assert.equal(g.snapshot('viewer').occupancy.housemates,0);
 const clients=Array.from({length:11},(_,i)=>person(`human-${i}`,i%2?'female':'male').client);
 clients.forEach((c,i)=>g.join(c,'housemate',`Human ${i}`,i%2?'female':'male'));
 assert.equal(g.cast.length,MAX_HOUSEMATES);assert.equal(clients[10].role,'viewer');
 assert.ok(g.cast.every(a=>a.owner&&a.profileId&&!a.bot));
 const duplicate={id:'clone',profileId:clients[0].profileId};assert.equal(g.join(duplicate,'housemate','Clone').role,'viewer');
 g.leave(clients[0]);assert.equal(g.cast.length,9);
});
test('server-authoritative movement blocks furniture, walls, player collisions and wrong wing',()=>{
 assert.equal(canStand(-16,-5),true,'valid opening');
 assert.equal(canStand(-16,-8),false,'wall');
 assert.equal(canStand(-8,-7.5),false,'heavy lounge furniture');
 assert.equal(canStand(-100,0),false,'outside compound');
 assert.equal(canEnter(roomAt(-24,-19,1),'female'),false);
 assert.equal(canEnter(roomAt(8,-19,1),'male'),false);
 assert.equal(canStand(8,-16,[],null,.4,1,'male'),false,'male cannot enter female bedroom');
 assert.equal(canStand(-24,-16,[],null,.4,1,'female'),false,'female cannot enter male bedroom');
 assert.equal(canStand(8,-5,[],null,.4,1,'male'),true,'public upstairs terrace accessible');
 const a={id:'a',x:-18,z:-8.6,angle:0,floor:0,wing:'male'},b={id:'b',x:-17,z:-8.6,floor:0};
 assert.equal(canStand(-17.6,-8.6,[a,b],'a'),false);
 assert.equal(advanceActor(a,1,0,.125,[a,b]),false);
 const actor={id:'free',x:-8,z:-3.8,angle:0,floor:0,wing:'male'};
 assert.equal(boundedMove(actor,{dx:1,dz:0},.1,[]),true);assert.ok(actor.x>-8);
 assert.equal(boundedMove(actor,{dx:Infinity,dz:1},.1,[]),false);
});
test('stair travel is available only from the designated staircase rooms',()=>{
 const g=createGame(),c=person('traveller','female').client;g.join(c,'housemate','Traveller','female');
 const actor=g.cast[0];
 g.process(c,{type:'travel'});assert.equal(actor.floor,0,'cannot teleport from lounge');
 actor.room='foyer';actor.x=-8;actor.z=9;
 assert.equal(targetStairs(actor.room),'upstairs-hall');
 g.process(c,{type:'travel'});assert.equal(actor.floor,1);assert.equal(actor.room,'upstairs-hall');
 assert.equal(canEnter(roomAt(actor.x,actor.z,1),actor.wing),true);
 c.lastTravel=0;
 g.process(c,{type:'travel'});assert.equal(actor.floor,0);assert.equal(actor.room,'foyer');
});
test('voice is opt-in; room voice readiness is not enabled for viewers',()=>{
 const g=createGame(),c=person('speaker').client,v=person('viewer').client;
 g.join(c,'housemate','Speaker','male');g.join(v,'viewer','Audience');
 assert.equal(g.cast[0].voiceEnabled,false);
 g.process(v,{type:'voice-toggle',enabled:true});assert.equal(g.cast[0].voiceEnabled,false);
 g.process(c,{type:'voice-toggle',enabled:true});assert.equal(g.snapshot('viewer').cast[0].voiceEnabled,true);
 g.process(c,{type:'voice-toggle',enabled:false});assert.equal(g.cast[0].voiceEnabled,false);
});
test('real viewers vote once for connected housemates',()=>{
 const g=createGame(),v=person('viewer').client,c=person('cast').client;
 g.join(v,'viewer','Viewer');g.process(v,{type:'vote',target:'fake'});assert.equal(Object.keys(g.snapshot().votes).length,0);
 g.join(c,'housemate','Player','female');const id=g.cast[0].id;
 g.process(c,{type:'vote',target:id});assert.equal(g.snapshot().votes[id],0);
 g.process(v,{type:'vote',target:id});g.process(v,{type:'vote',target:id});assert.equal(g.snapshot().votes[id],1);
});
test('store requires Notes or confirmed paid grant; no unpaid NGN unlocks',()=>{
 const g=createGame(),c=person('buyer').client;g.join(c,'housemate','Buyer','male');
 g.process(c,{type:'purchase',item:'ankara'});g.process(c,{type:'equip',item:'ankara'});
 assert.equal(g.profile(c.profileId).coins,1020);assert.equal(g.cast[0].outfit,'ankara');
 g.process(c,{type:'purchase',item:'odogwu'});g.process(c,{type:'equip',item:'odogwu'});
 assert.equal(g.profile(c.profileId).owned.includes('odogwu'),false);
 assert.equal(g.cast[0].outfit,'ankara');
 assert.equal(g.grantPremium(c.profileId,'odogwu'),true);assert.equal(g.grantPremium(c.profileId,'odogwu'),false);
 g.process(c,{type:'equip',item:'odogwu'});assert.equal(g.cast[0].outfit,'odogwu');
 assert.ok(ITEMS.some(i=>i.currency==='NGN'));
});
test('room activities take time and give reward only on completion',()=>{
 const g=createGame(),v=person('viewer').client,c=person('player').client;
 g.join(v,'viewer','Watcher');g.join(c,'housemate','Player','male');const id=g.cast[0].id;
 g.process(v,{type:'request',target:id,template:'dance',text:'Dance for us!'});
 const req=g.snapshot().requests[0];assert.ok(req);
 g.process(c,{type:'accept',id:req.id});assert.equal(g.snapshot().requests[0].status,'accepted');
 const before=g.profile(c.profileId).coins;
 g.process(c,{type:'interact',action:'lounge-1'});
 assert.equal(g.cast[0].activity,'Chat with housemates');assert.equal(g.profile(c.profileId).coins,before);
 g.cast[0].activityUntil=Date.now()-1;g.tick();
 assert.equal(g.profile(c.profileId).coins,before+20);assert.equal(g.cast[0].activity,'');
});
test('private diary, wardrobe and bathrooms redact participant locations from viewers',()=>{
 const g=createGame(),c=person('privacy','female').client;g.join(c,'housemate','Player','female');
 const actor=g.cast[0];
 for(const id of ['diary','wardrobe','female-bath']){
  const room=ROOMS.find(r=>r.id===id);actor.room=id;actor.floor=room.floor;actor.x=room.x;actor.z=room.z;
  assert.equal(g.snapshot('viewer').cast[0].x,null);
  assert.equal(g.snapshot('viewer').cast[0].hidden,true);
  assert.equal(g.snapshot('housemate',c).cast[0].x,room.x);
 }
});
test('text blocks HTML and likely personally identifying phone numbers',()=>{
 assert.equal(cleanText('<b>hello</b>'),'hello');assert.match(cleanText('Call 08012345678'),/\[private\]/);
});

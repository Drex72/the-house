import test from 'node:test';
import assert from 'node:assert/strict';
import {newNeeds,drainNeeds,applyNeedEffects,NEED_KEYS} from '../public/js/needs.js';
import {ROOMS,canEnter} from '../public/js/world-layout.js';
import {createGame} from '../server/game.mjs';
function client(id){return {id,profileId:id,role:'viewer'};}
test('four compact housemate needs decay and stay in the 0–100 range',()=>{
 const start=newNeeds();assert.deepEqual(NEED_KEYS,['hunger','energy','hygiene','social']);
 const next=drainNeeds(start,60_000); // drain is capped at 30 seconds per tick
 assert.ok(next.hunger<start.hunger);assert.ok(next.energy<start.energy);
 assert.equal(applyNeedEffects({hunger:98,energy:3,hygiene:50,social:10},{hunger:50,energy:-30}).hunger,100);
 assert.equal(applyNeedEffects({hunger:98,energy:3,hygiene:50,social:10},{hunger:50,energy:-30}).energy,0);
});
test('room menus expose real sleep, meal, shower, and island activities',()=>{
 const menu=id=>ROOMS.find(r=>r.id===id).actions;
 assert.ok(menu('male-bedroom').some(a=>a.title==='Sleep in bed'&&a.effects.energy>0&&a.lockMovement));
 assert.ok(menu('female-bedroom').some(a=>a.title==='Sleep in bed'&&a.effects.energy>0));
 assert.ok(menu('kitchen').some(a=>a.title==='Eat a hot meal'&&a.effects.hunger>0));
 assert.ok(menu('female-bath').some(a=>a.title==='Take a shower'&&a.effects.hygiene>0));
 assert.ok(menu('garden').some(a=>a.title==='Rest in a hammock'));
 assert.ok(menu('arena').some(a=>a.title==='Play beach volleyball'));
 assert.ok(menu('cabana').some(a=>a.title==='Make a beach BBQ plate'));
 assert.equal(canEnter(ROOMS.find(r=>r.id==='female-bedroom'),'male'),false);
});
test('needs are private to the owner, not shown to audience or other housemates',()=>{
 const g=createGame(),a=client('a'),b=client('b'),v=client('v');
 g.join(a,'housemate','One','male');g.join(b,'housemate','Two','female');g.join(v,'viewer','Audience');
 const mine=g.snapshot('housemate',a).cast.find(x=>x.id===a.actorId);
 const other=g.snapshot('housemate',b).cast.find(x=>x.id===a.actorId);
 assert.ok(mine.needs&&typeof mine.needs.energy==='number');
 assert.equal(other.needs,null);assert.equal(g.snapshot('viewer',v).cast[0].needs,null);
});
test('sleep prevents walking while active, restores energy after completion, and can be cancelled',()=>{
 const g=createGame(),c=client('sleepy');g.join(c,'housemate','Sleepy','male');
 const a=g.cast[0],room=ROOMS.find(r=>r.id==='male-bedroom');
 a.floor=1;a.room=room.id;a.x=room.x;a.z=room.z;a.needs.energy=18;
 g.process(c,{type:'interact',action:room.actions[0].id});
 assert.equal(a.activity,'Sleep in bed');assert.equal(a.activityLock,true);
 const old={x:a.x,z:a.z};g.process(c,{type:'move',dx:1,dz:0});assert.deepEqual({x:a.x,z:a.z},old);
 a.activityUntil=Date.now()-1;g.tick();
 assert.equal(a.activity,'');assert.equal(a.activityLock,false);assert.ok(a.needs.energy>=63);
 c.lastInteract=0;a.needs.energy=20;
 g.process(c,{type:'interact',action:room.actions[0].id});g.process(c,{type:'cancel-activity'});
 assert.equal(a.activity,'');assert.equal(a.needs.energy,20);
});
test('eating restores hunger, showering restores hygiene, both require completed activities',()=>{
 const g=createGame(),c=client('needy');g.join(c,'housemate','Needy','male');const a=g.cast[0];
 const kitchen=ROOMS.find(r=>r.id==='kitchen');a.x=kitchen.x;a.z=kitchen.z;a.room=kitchen.id;
 a.needs.hunger=9;g.process(c,{type:'interact',action:kitchen.actions[1].id});
 assert.equal(a.needs.hunger,9);a.activityUntil=Date.now()-1;g.tick();assert.ok(a.needs.hunger>=50);
 const bath=ROOMS.find(r=>r.id==='male-bath');c.lastInteract=0;a.floor=1;a.room=bath.id;a.x=bath.x;a.z=bath.z;
 a.needs.hygiene=20;g.process(c,{type:'interact',action:bath.actions[0].id});
 assert.equal(a.needs.hygiene,20);a.activityUntil=Date.now()-1;g.tick();assert.ok(a.needs.hygiene>=67);
});
test('needs tick decays over elapsed time without creating bots',()=>{
 const g=createGame(),c=client('clock');g.join(c,'housemate','Clock','female');const a=g.cast[0];
 a.needsUpdatedAt=Date.now()-15_000;const before=a.needs.energy;
 g.tick();assert.ok(a.needs.energy<before);assert.equal(g.cast.length,1);
});

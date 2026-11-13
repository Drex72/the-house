import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../server/game.mjs';
import {INTERACTABLES,OBJECT_BY_ID,OBJECT_ACTIONS,interactionInRange,canStand} from '../public/js/world-layout.js';
import {findWalkingPath,pathToObject} from '../public/js/navigation.js';
import {HouseScene} from '../public/js/scene.js';
function join(g,id){const c={id,profileId:id};g.join(c,'housemate',id,'male');return c;}
function position(actor,x,z,room='lounge',floor=0){actor.x=x;actor.z=z;actor.room=room;actor.floor=floor;}
test('object catalog has unique locations and context-specific actions',()=>{
 assert.ok(INTERACTABLES.length>=13);
 assert.equal(new Set(INTERACTABLES.map(o=>o.id)).size,INTERACTABLES.length);
 assert.deepEqual(OBJECT_BY_ID['lounge-sofa'].actions,['sit','lie','cuddle']);
 assert.deepEqual(OBJECT_BY_ID['cinema-screen'].actions,['watch']);
 assert.deepEqual(OBJECT_BY_ID['male-bed'].actions,['sleep','lie']);
 assert.ok(INTERACTABLES.every(o=>o.actions.every(k=>OBJECT_ACTIONS[k])));
});
test('camera movement uses stable heading instead of avatar facing angle',()=>{
 const scene=Object.create(HouseScene.prototype);scene.heading=Math.PI;scene.orbit=0;
 const [x,z]=scene.moveVector(0,1);
 assert.ok(Math.abs(x)<.001);assert.ok(z<-.99);
 scene.orbit=Math.PI/2;
 const [a,b]=scene.moveVector(0,1);
 assert.ok(a<-.99);assert.ok(Math.abs(b)<.001);
});
test('server validates proximity and locks selected furniture while allowing stand up',()=>{
 const g=createGame(),c=join(g,'seated'),a=g.cast[0];
 position(a,-15,-8.6);assert.ok(canStand(a.x,a.z,[],a.id));assert.ok(interactionInRange(a,OBJECT_BY_ID['lounge-sofa']));
 let r=g.process(c,{type:'object-act',objectId:'cinema-screen',action:'watch'});assert.equal(r.ok,false);
 r=g.process(c,{type:'object-act',objectId:'lounge-sofa',action:'sit'});assert.equal(r.ok,true);
 assert.equal(a.pose,'sitting');assert.equal(a.objectId,'lounge-sofa');
 g.tick();assert.equal(a.pose,'sitting','a seated pose stays until player stands');
 r=g.process(c,{type:'leave-object'});assert.equal(r.ok,true);assert.equal(a.pose,'');assert.equal(a.objectId,null);
});
test('two players can cuddle only after the seated player approves',()=>{
 const g=createGame(),c1=join(g,'alpha'),c2=join(g,'beta'),a=g.cast[0],b=g.cast[1];
 position(a,-15,-8.6);position(b,-13.1,-7.5);
 assert.equal(g.process(c1,{type:'object-act',objectId:'lounge-sofa',action:'sit'}).ok,true);
 assert.equal(g.process(c2,{type:'object-act',objectId:'lounge-sofa',action:'cuddle',targetId:a.id}).ok,true);
 assert.equal(b.pose,'','invitation does not automatically touch or relocate players');
 const invite=g.snapshot('housemate',c1).socialInvites[0];assert.ok(invite);
 assert.equal(g.snapshot('housemate',c2).socialInvites.length,0,'invite only sent to recipient');
 assert.equal(g.process(c1,{type:'social-reply',id:invite.id,accept:false}).ok,true);
 assert.equal(b.pose,'');assert.equal(a.pose,'sitting');
 c2.lastObjectAction=0;
 assert.equal(g.process(c2,{type:'object-act',objectId:'lounge-sofa',action:'cuddle',targetId:a.id}).ok,true);
 const second=g.snapshot('housemate',c1).socialInvites[0];
 assert.equal(g.process(c1,{type:'social-reply',id:second.id,accept:true}).ok,true);
 assert.equal(a.pose,'cuddling');assert.equal(b.pose,'cuddling');
 g.leave(c2);assert.equal(a.pose,'sitting','remaining partner falls back to sitting');
});
test('other furniture interactions affect needs only after timed completion',()=>{
 const g=createGame(),c=join(g,'eater'),a=g.cast[0];
 position(a,-8,-15.5,'dining');assert.ok(interactionInRange(a,OBJECT_BY_ID['dining-table']));
 const before=g.profile(c.profileId).coins;
 assert.equal(g.process(c,{type:'object-act',objectId:'dining-table',action:'eat'}).ok,true);
 assert.equal(g.profile(c.profileId).coins,before);
 assert.equal(a.pose,'eating');a.activityUntil=Date.now()-1;g.tick();
 assert.equal(a.pose,'');assert.ok(g.profile(c.profileId).coins>before);
});
test('navigation finds safe path around the lounge furniture',()=>{
 const obj=OBJECT_BY_ID['lounge-sofa'],start={id:'test',x:-8,z:-3.1,floor:0,wing:'male'};
 assert.ok(canStand(start.x,start.z));
 const path=pathToObject(start,obj,'male',[]);
 assert.ok(path?.length);
 assert.ok(path.every(p=>canStand(p.x,p.z,[],null,.46,0,'male')));
 const end=path.at(-1);assert.ok(interactionInRange({...end,room:'lounge',floor:0},obj));
 assert.equal(findWalkingPath(start,{x:-100,z:0},0,'male'),null);
});
test('click picking selects nearest prop using screen projection',()=>{
 const s=Object.create(HouseScene.prototype);s.viewFloor=0;s.camera={eye:[-8,5,4]};
 s.project=([x,y,z])=>[250+x*9,350+z*9-y*10];
 const item=s.pickObject(250+8*9,350-11.5*9-9,[OBJECT_BY_ID['cinema-screen']]);
 assert.equal(item?.id,'cinema-screen');
});
test('global illumination uses world-space normals, not camera-relative lighting',async()=>{
 const fs=await import('node:fs/promises');const text=await fs.readFile(new URL('../public/js/scene.js',import.meta.url),'utf8');
 assert.match(text,/vNormal=normalize\(aNormal\)/);
 assert.match(text,/viewDir=normalize\(uEyePosition-vWorld\)/);
 assert.doesNotMatch(text,/mat3\(uView\)\*aNormal/);
});

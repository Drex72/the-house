import test from 'node:test';
import assert from 'node:assert/strict';
import {ROOMS,COLS,ROWS,canStand,roomAt,canEnter,CHARACTER_RADIUS} from '../public/js/world-layout.js';
import {HouseScene} from '../public/js/scene.js';

function connectedOnFloor(floor,wing){
 const grid=.72,sx=-31.4,sz=-25.4,nx=88,nz=floor?39:77;
 const at=(i,j)=>[sx+i*grid,sz+j*grid];const key=(i,j)=>i+','+j;
 const origin=floor?[-8,-3.0]:[-8,-3.6],ij=[Math.round((origin[0]-sx)/grid),Math.round((origin[1]-sz)/grid)];
 const q=[ij],seen=new Set([key(...ij)]),reached=new Set();
 for(let qi=0;qi<q.length;qi++){
  const [i,j]=q[qi],p=at(i,j);if(canStand(...p,[],null,.34,floor,wing))reached.add(roomAt(...p,floor).id);
  for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const ii=i+di,jj=j+dj;if(ii<0||ii>=nx||jj<0||jj>=nz||seen.has(key(ii,jj)))continue;
   if(canStand(...at(ii,jj),[],null,.34,floor,wing)){seen.add(key(ii,jj));q.push([ii,jj]);}
  }
 }
 return reached;
}
test('all sixteen downstairs/outdoor rooms are reachable within the compound',()=>{
 const reached=connectedOnFloor(0,'female');const expected=ROOMS.filter(r=>r.floor===0).map(r=>r.id);
 assert.deepEqual([...reached].sort(),expected.sort());
});
test('upper floor circulation respects wing locks and preserves public terrace',()=>{
 for(const wing of ['male','female']){
  const reached=connectedOnFloor(1,wing);
  const expected=ROOMS.filter(r=>r.floor===1&&canEnter(r,wing)).map(r=>r.id);
  assert.deepEqual([...reached].sort(),expected.sort(),`reachable for ${wing}`);
  assert.equal(reached.has('terrace'),true);
  assert.equal(reached.has(wing==='male'?'female-bedroom':'male-bedroom'),false);
 }
});
test('the dedicated internal door centerlines pass without furniture blockage',()=>{
 for(const [floor,zs] of [[0,[-12,2,16]],[1,[-12]]]){
  for(const z of zs)for(const x of COLS){
   // Gateways into opposite-gender rooms can legitimately be blocked for that wing.
   const a=roomAt(x,z-1.4,floor),b=roomAt(x,z+1.4,floor);
   const wing=(a?.access?.startsWith('female')||b?.access?.startsWith('female'))?'female':'male';
   if(!canEnter(a,wing)||!canEnter(b,wing))continue;
   assert.ok(canStand(x,z,[],null,.3,floor,wing),`gate center ${floor}: ${x},${z}`);
  }
 }
});
test('the local avatar predicts movement without animating nonexistent players',()=>{
 const scene=Object.create(HouseScene.prototype);
 scene.localActorId='me';scene.actorTracks=new Map([['me',{id:'me',x:-8,z:-3,fromX:-8,fromZ:-3,toX:-8,toZ:-3,fromAngle:0,toAngle:0,receivedAt:performance.now(),floor:0,wing:'male'}],['someone',{id:'someone',x:4,z:-3,fromX:4,fromZ:-3,toX:4,toZ:-3,fromAngle:0,toAngle:0,receivedAt:performance.now(),floor:0,wing:'male'}]]);
 scene.actors=[{id:'me',x:-8,z:-3,floor:0},{id:'someone',x:4,z:-3,floor:0}];
 assert.ok(scene.predictActor('me',1,0,.07));assert.ok(scene.actorTracks.get('me').toX>-8);
 assert.equal(scene.actorTracks.get('someone').toX,4);
 assert.equal(scene.predictActor('someone',-1,0,.07),false);
 scene.setActors([{id:'me',x:-8,z:-3,angle:0,walking:true,floor:0},{id:'someone',x:4,z:-3,angle:0,walking:false,floor:0}]);
 assert.equal(scene.actors.length,2);
});

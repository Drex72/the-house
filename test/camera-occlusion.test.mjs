import test from 'node:test';
import assert from 'node:assert/strict';
import {WALLS} from '../public/js/world-layout.js';
import {firstWallFraction,clampCameraToWalls,wallSeparates} from '../public/js/camera-occlusion.js';
import {HouseScene} from '../public/js/scene.js';

const actor=(x,z,room='lounge')=>({id:'person-1',x,z,angle:0,room,floor:0,wing:'male',hidden:false});

test('the camera may pass through a genuine doorway but not its opaque side wall',()=>{
 const from={x:-13,z:-5},through={x:-21,z:-5};
 assert.equal(firstWallFraction(from,through,WALLS,0),1,'doorway must stay open');
 const blockedFrom={x:-13,z:-9},blockedTo={x:-21,z:-9};
 assert.ok(firstWallFraction(blockedFrom,blockedTo,WALLS,0)<.5,'opaque partition must block camera');
 const eye=clampCameraToWalls(blockedFrom,blockedTo,WALLS,0);
 assert.ok(eye.blocked,'the eye should stop at the wall');
 assert.ok(eye.distance>1,'the wall should not force the camera through the player');
 assert.equal(firstWallFraction(blockedFrom,eye,WALLS,0),1,'the corrected path must be clear');
 assert.ok(wallSeparates(blockedTo,blockedFrom,WALLS,0),'wall-hidden characters must not appear as fragments');
 assert.equal(wallSeparates(through,from,WALLS,0),false,'visible actors across a doorway should not vanish');
});

function sceneAt(person,yaw,mode='follow',width=1180){
 const scene=Object.create(HouseScene.prototype);
 scene.actors=[person];scene.targetActor=person.id;scene.localActorId=person.id;
 scene.cameraMode=mode;scene.room=person.room;scene.heading=yaw;scene.orbit=0;
 scene.width=width;scene.height=740;scene.zoom=1;scene.pitch=.42;
 scene.camera={eye:[person.x,3.25,person.z+2],target:[person.x,1.3,person.z]};
 scene.cameraSnap=true;scene.lastCameraTime=0;scene.viewFloor=0;
 return scene;
}

test('follow and shoulder cameras near walls preserve line of sight, never enter walls',()=>{
 const people=[actor(-8,-10.42),actor(-13,-9),actor(-7,-7),actor(-11,-1)];
 for(const person of people){
  for(const mode of ['follow','orbit','shoulder']){
   for(const yaw of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
    const scene=sceneAt(person,yaw,mode,390);
    scene.cameraFor(1);
    assert.ok(scene.camera.eye.every(Number.isFinite),`invalid eye for ${mode}/${yaw}`);
    assert.ok(scene.camera.target.every(Number.isFinite),`invalid target for ${mode}/${yaw}`);
    const eye={x:scene.camera.eye[0],z:scene.camera.eye[2]};
    assert.ok(firstWallFraction(person,eye,WALLS,0,0.32)>.999,
      `camera crossed wall for ${mode}/${yaw}: ${JSON.stringify({person,eye})}`);
    assert.equal(scene.actorVisible(person,0),!scene.cameraHidesTarget,'camera hide rule should match rendering');
   }
  }
 }
});

test('first person hides own mesh and software occlusion hides players behind walls',()=>{
 const me=actor(-13,-9),scene=sceneAt(me,0,'firstperson');
 scene.cameraFor(1);
 assert.equal(scene.actorVisible(me,0),false,'first-person must not render the face inside the camera');
 scene.cameraMode='room';scene.cameraHidesTarget=false;
 scene.targetActor='someone-else';scene.camera.eye=[-21,3,-9];
 assert.equal(scene.actorVisible(me,0),false,'wall must hide a distant actor as a whole');
 scene.camera.eye=[-21,3,-5];me.z=-5;
 assert.equal(scene.actorVisible(me,0),true,'unobstructed doorway may show an actor');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {buildWorld} from '../public/js/scene.js';

test('the reviewed world generates finite, physically sized meshes',()=>{
 const ground=buildWorld(0),upper=buildWorld(1);
 assert.ok(ground.shapes.length>100,'compound should contain real geometry');
 assert.ok(upper.shapes.length>30,'upstairs should contain real geometry');
 for(const [floor,mesh] of [[0,ground],[1,upper]]){
  for(const shape of mesh.shapes){
   for(const key of ['x','y','z'])assert.ok(Number.isFinite(shape[key]),`floor ${floor}: invalid ${key}`);
   if(shape.type==='box'){
    for(const key of ['w','h','d'])assert.ok(Number.isFinite(shape[key])&&shape[key]>0,`floor ${floor}: invalid ${key}`);
   }
   if(shape.type==='sphere'||shape.type==='cylinder')assert.ok(shape.r>0,'positive radius');
  }
 }
});

test('hero lounge seating and table have grounded detail geometry',()=>{
 const shapes=buildWorld(0).shapes;
 const arms=shapes.filter(s=>s.type==='box'&&s.col==='#ba603e'&&s.x>-16&&s.x<0&&s.z>-13&&s.z<0);
 const feet=shapes.filter(s=>s.type==='box'&&s.col==='#52443e'&&s.x>-16&&s.x<0&&s.z>-13&&s.z<0);
 const tableLegs=shapes.filter(s=>s.type==='box'&&s.col==='#493b42'&&Math.abs(s.x+8)<2&&Math.abs(s.z+6.9)<2);
 const ceilingFixtures=shapes.filter(s=>s.type==='box'&&s.col==='#ffdfac'&&s.y>3);
 assert.ok(arms.length>=4,'both lounge sofas need complete arm rests');
 assert.ok(feet.length>=8,'lounge sofa bases should visibly meet the floor');
 assert.equal(tableLegs.length,4,'coffee table should have four visible supports');
 assert.ok(ceilingFixtures.length>=2,'lounge lighting fixtures should have consistent world anchors');
});

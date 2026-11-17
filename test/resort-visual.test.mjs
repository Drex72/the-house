import test from 'node:test';
import assert from 'node:assert/strict';
import {buildWorld} from '../public/js/scene.js';
import {INTERACTABLES} from '../public/js/world-layout.js';

test('resort pool contains one bounded water surface with four raised coping edges',()=>{
 const shapes=buildWorld(0).shapes;
 const nearPool=s=>Math.abs(s.x+24)<8&&s.z>16&&s.z<30;
 const water=shapes.filter(s=>nearPool(s)&&s.type==='box'&&s.col==='#43b1ad');
 const coping=shapes.filter(s=>nearPool(s)&&s.type==='box'&&s.col==='#ede7dc');
 assert.equal(water.length,1,'pool water surface should be singular and visible');
 assert.equal(coping.length,4,'four continuous pool edge pieces should be present');
 assert.ok(water[0].w>9&&water[0].d>6,'the pool should retain its playable dimensions');
 assert.ok(coping.every(s=>s.y>water[0].y),'coping must sit above the water surface');
});

test('resort lounge furniture is grounded and all outdoor paving shares a subdued material',()=>{
 const shapes=buildWorld(0).shapes;
 const timber=shapes.filter(s=>s.type==='box'&&s.col==='#64432f'&&s.z>15&&s.z<21);
 const linen=shapes.filter(s=>s.type==='box'&&s.col==='#f2eee4'&&s.z>15&&s.z<21);
 const umbrella=shapes.filter(s=>s.type==='cylinder'&&s.col==='#f3eee2'&&s.r>=1.6);
 const grout=shapes.filter(s=>s.type==='box'&&s.col==='#d5c9b7'&&s.y>=0);
 assert.ok(timber.length>=2,'both poolside teak loungers should be present');
 assert.ok(linen.length>=2,'both poolside fabric cushions should be present');
 assert.ok(umbrella.length>=3,'pool and garden shaded areas should be present');
 assert.ok(grout.length>=35,'all four compound zones must share the same travertine grid');
});

test('pool visual refinement retains gameplay interaction contracts',()=>{
 const ids=new Set(INTERACTABLES.map(item=>item.id));
 for(const id of ['pool-water','pool-lounger','pool-shower','beach-umbrella']){
  assert.ok(ids.has(id),id+' must remain interactive');
 }
});

test('cabana shade is an open pergola and pool remains uncluttered',()=>{
 const shapes=buildWorld(0).shapes;
 const slats=shapes.filter(s=>s.type==='box'&&s.col==='#ebe2d3'&&s.x>17&&s.x<31&&s.z>18&&s.z<28);
 const enclosed=shapes.filter(s=>s.type==='box'&&s.col==='#eee7da'&&s.w>=10&&s.d>=8&&s.y>4);
 assert.ok(slats.length>=10,'cabana must use individual daylight-filtering roof slats');
 assert.equal(enclosed.length,0,'solid white roof should not obscure the compound view');
});

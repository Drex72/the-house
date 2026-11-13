import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ROOMS,roomAt,canStand} from '../public/js/world-layout.js';
import {buildWorld} from '../public/js/scene.js';
const page=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const styles=readFileSync(new URL('../public/css/island-ui.css',import.meta.url),'utf8');
const app=readFileSync(new URL('../public/js/app.js',import.meta.url),'utf8');
const unique=id=>new RegExp(`id="${id}"`,'g');

test('beach and seaside experiences are playable, with activities',()=>{
 const beach=ROOMS.find(r=>r.id==='garden');
 assert.equal(beach.name,'Private Beach');
 assert.ok(beach.outdoor);
 assert.ok(beach.actions.some(a=>/sandcastle|beach volleyball|sea/i.test(a.title)));
 assert.ok(canStand(beach.x-4,beach.z+2,[],null,.3,0,'female'));
 assert.equal(roomAt(beach.x,beach.z,0).id,beach.id);
 assert.equal(ROOMS.find(r=>r.id==='pool').name,'Beachfront Pool');
 assert.ok(ROOMS.find(r=>r.id==='cabana').name.includes('Sunset'));
});
test('island surrounded by sea, shallows and sand, no roads or buildings outside',()=>{
 const mesh=buildWorld(0);
 assert.ok(mesh.shapes.some(s=>s.type==='box'&&s.w>=300&&s.d>=290&&s.col==='#177c99'));
 assert.ok(mesh.shapes.some(s=>s.type==='box'&&s.col==='#ecd199'));
 assert.ok(mesh.shapes.some(s=>s.type==='box'&&s.col==='#eef6dc'));
 assert.ok(mesh.shapes.some(s=>s.type==='cylinder'&&s.col==='#b17b55'));
 assert.equal(mesh.shapes.some(s=>/road|bus|city/i.test(s.col||'')),false);
 const up=buildWorld(1);
 assert.ok(up.shapes.some(s=>s.type==='box'&&s.col==='#177c99'));
});
test('HUD contains only contextual quick controls; all permanent navigation is retired',()=>{
 for(const id of ['open-menu','drawer-backdrop','quick-controls','quick-view','quick-explore','camera-flyout','interact-action','cast-panel','activity-panel','rooms-flyout'])
  assert.equal((page.match(unique(id))||[]).length,1,`single ${id}`);
 assert.match(page,/<nav class="bottom-nav"[^>]*hidden>/);
 assert.match(styles,/\.bottom-nav,\.scene-caption,\.camera-hint,\.emote-controls\s*\{display:none!important\}/);
 assert.match(styles,/\.left-panel,\.right-panel\{[^}]*visibility:hidden/);
 assert.match(styles,/\.left-panel\.is-open,\.right-panel\.is-open/);
 assert.match(page,/<div id="quick-controls"[^>]*hidden>/);
 assert.match(app,/closeAllMenus\(\)/);
 assert.match(app,/cameraOptions\s*=\s*\{/);
});

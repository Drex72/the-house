import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=read('public/index.html');
const app=read('public/js/app.js');
const css=read('public/css/island-ui.css');
const ids=new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]));

test('startup never binds an unconditional handler to an absent element',()=>{
  const required=[...app.matchAll(/\$\(['"]([^'"]+)['"]\)\.addEventListener\(/g)].map(m=>m[1]);
  for(const id of required)assert.ok(ids.has(id),`Missing DOM element #${id} would abort the render loop`);
});
test('all critical controls exist: game menu, X, Back, Leave, cast, voice',()=>{
  for(const id of ['open-menu','close-panel','menu-back','leave-house','drawer-people','voice-toggle','cast-close','drawer-backdrop','quick-view','quick-explore','entry-overlay','world'])assert.ok(ids.has(id),`Missing #${id}`);
  assert.match(css,/\.right-panel \.mobile-close\{display:grid!important/);
});
test('render initialization and frame errors are handled instead of stopping input startup',()=>{
  assert.match(app,/try \{ scene=new HouseScene\(el.world\); \}/);
  assert.match(app,/forceCanvas2D:true/);
  assert.match(app,/catch\(error\).*recoverRenderer\(error\)/s);
  assert.match(app,/webglcontextlost/);
  assert.match(app,/installWorldPointerHandlers\(freshCanvas\)/);
  assert.match(app,/requestAnimationFrame\(loop\)/);
});

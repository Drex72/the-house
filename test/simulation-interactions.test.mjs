import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../server/game.mjs';
import {ROOMS,INTERACTABLES,OBJECT_ACTIONS,OBJECT_BY_ID,interactionInRange} from '../public/js/world-layout.js';
import {ORIGINAL_TRACKS,IslandStereo} from '../public/js/stereo.js';

function actorIn(g,client,objectId){
 const a=g.cast.find(v=>v.owner===client.id),o=OBJECT_BY_ID[objectId];
 a.room=o.room;a.floor=o.floor;a.x=o.x+o.w/2+.75;a.z=o.z;
 return a;
}
function join(g,id){const c={id,profileId:id};g.join(c,'housemate',id,'male');return c;}
function act(g,c,o,a){c.lastObjectAction=0;return g.process(c,{type:'object-act',objectId:o,action:a});}

test('every room has at least one real object with a bounded server-owned action set',()=>{
 assert.ok(INTERACTABLES.length>=60);
 assert.equal(new Set(INTERACTABLES.map(o=>o.id)).size,INTERACTABLES.length);
 assert.deepEqual(ROOMS.filter(room=>!INTERACTABLES.some(o=>o.room===room.id)),[]);
 for(const obj of INTERACTABLES){
  assert.ok(obj.actions.length>=1,obj.id);
  assert.ok(obj.actions.length<=6,`${obj.id}: too many actions in one menu`);
  assert.ok(obj.actions.every(key=>OBJECT_ACTIONS[key]),`invalid action on ${obj.id}`);
  assert.equal(obj.floor,ROOMS.find(r=>r.id===obj.room).floor);
 }
});
test('TV remote and wall TV manipulate the same shared screen on the server',()=>{
 const g=createGame(),c=join(g,'Ada');actorIn(g,c,'lounge-remote');
 assert.equal(act(g,c,'lounge-remote','tv_power').ok,true);
 let tv=g.snapshot('housemate',c).devices.find(x=>x.id==='lounge-tv');
 assert.equal(tv.powered,true);
 assert.equal(act(g,c,'lounge-remote','tv_channel').ok,true);
 tv=g.snapshot('housemate',c).devices.find(x=>x.id==='lounge-tv');
 assert.equal(tv.channel,1);
 assert.equal(act(g,c,'lounge-remote','tv_power').ok,true);
 assert.equal(g.snapshot('viewer',null).devices.find(x=>x.id==='lounge-tv').powered,false);
});
test('studio speaker, mixer and stereo share synchronized public playback state',()=>{
 const g=createGame(),c=join(g,'Bayo');actorIn(g,c,'music-stereo');
 assert.equal(act(g,c,'music-stereo','music_toggle').ok,true);
 let d=g.snapshot('viewer').devices.find(x=>x.id==='music-stereo');
 assert.deepEqual([d.powered,d.track],[true,0]);
 actorIn(g,c,'music-mixer');
 assert.equal(act(g,c,'music-mixer','music_next').ok,true);
 d=g.snapshot('viewer').devices.find(x=>x.id==='music-stereo');
 assert.equal(d.track,1);assert.equal(ORIGINAL_TRACKS[d.track],'Sunset Highlife');
 assert.equal(act(g,c,'music-mixer','music_toggle').ok,true);
 assert.equal(g.snapshot('viewer').devices.find(x=>x.id==='music-stereo').powered,false);
});
test('server rejects invented object IDs, actions and unauthorized proximity',()=>{
 const g=createGame(),c=join(g,'Kemi'),v={id:'spectator',profileId:'spectator',role:'viewer'};g.join(v,'viewer','Watcher');
 assert.equal(g.process(v,{type:'object-act',objectId:'music-stereo',action:'music_toggle'}).ok,false);
 assert.equal(act(g,c,'__made_up__','music_toggle').ok,false);
 assert.equal(act(g,c,'music-stereo','tv_channel').ok,false);
 assert.equal(act(g,c,'music-stereo','music_toggle').ok,false,'player must be in music studio');
});
test('object gestures replicate but expire, without freezing player movement',()=>{
 const g=createGame(),c=join(g,'Titi'),a=actorIn(g,c,'lounge-remote');
 assert.ok(interactionInRange(a,OBJECT_BY_ID['lounge-remote']));
 assert.equal(act(g,c,'lounge-remote','remote_pickup').ok,true);
 const initial=g.snapshot('housemate',c).cast.find(x=>x.id===a.id);
 assert.equal(initial.gesture,'remote');assert.ok(initial.gestureUntil>Date.now());
 assert.equal(a.activityLock,false);
 a.gestureUntil=Date.now()-1;g.tick();
 assert.equal(a.gesture,'');
});
test('activities update needs only on completion, not at the moment of selection',()=>{
 const g=createGame(),c=join(g,'Chuka'),a=actorIn(g,c,'men-shower');
 const before=a.needs.hygiene;
 assert.equal(act(g,c,'men-shower','shower').ok,true);
 assert.equal(a.needs.hygiene,before);
 assert.equal(a.pose,'showering');
 a.activityUntil=Date.now()-1;g.tick();
 assert.ok(a.needs.hygiene>before);
 assert.equal(a.pose,'');
});
test('clothing-rack interaction opens wardrobe panel instead of bypassing purchase validation',()=>{
 const g=createGame(),c=join(g,'Zara');actorIn(g,c,'wardrobe-rack');
 const before=g.profile(c.profileId).owned.slice();
 const result=act(g,c,'wardrobe-rack','try_on');
 assert.equal(result.ok,true);assert.equal(result.openPanel,'shop');
 assert.deepEqual(g.profile(c.profileId).owned,before,'trying on cannot grant paid clothes');
});
test('stereo audio remains off until explicitly enabled; unsupported browsers fail safely',async()=>{
 const player=new IslandStereo();
 assert.equal(player.enabled,false);
 player.sync({powered:true,track:1,room:'music'});
 assert.equal(player.running,false);
 if(!globalThis.AudioContext&&!globalThis.webkitAudioContext)assert.equal(await player.enable(),false);
 player.mute();assert.equal(player.enabled,false);
});

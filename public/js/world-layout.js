/** The House V4 shared level, architecture, access, and collision contract.
 * All playable world-space lives in one private compound. The upper floor is
 * physically stacked 5.2 metres above ground. No bots or random passers-by.
 */
import {needsForAction,durationForAction,locksMovement} from './needs.js';
export const FLOOR_HEIGHT=5.2;
export const COLS=[-24,-8,8,24];
export const ROWS=[-19,-5,9,23];
export const CHARACTER_RADIUS=.46;
export const DOOR_WIDTH=4.6;
export const LIMITS={minX:-31.85,maxX:31.85,minZ:-25.85,maxZ:29.85};
const definitions=[
 // Ground floor, including the outside portions of the enclosed compound.
 ['kitchen','Chop Life Kitchen','🍲','Cook up Jollof','Cook jollof|Eat a hot meal|Have a snack','public'],
 ['dining','Owambe Dining','🍽️','Host a dinner','Eat dinner|Share a meal|Host family dinner','public'],
 ['spa','Soft Life Spa','🧖','Enjoy a spa session','Get a facial|Take a shower|Relax in the sauna','public'],
 ['wardrobe','Style Boutique','👗','Try an outfit','Try a designer look|Arrange your wardrobe|Practice runway walk','private'],
 ['games','Games & Wahala','🎱','Play a game','Play snooker|Battle at the arcade|Truth or cap','public'],
 ['lounge','The Big Lounge','🛋️','Gather in the lounge','Chat with housemates|Take a power nap|Host a house meeting','public'],
 ['diary','Confession Room','🎙️','Record a confession','Record your confession|Reflect on the day|Make a secret nomination','private'],
 ['cinema','Private Cinema','🎬','Watch a movie','Watch Nollywood night|Make movie commentary|Vote on the next film','public'],
 ['music','Afrobeats Studio','🎶','Record a song','Record a freestyle|Dance to Afrobeats|Drop a new single','public'],
 ['foyer','Grand Stair Hall','✨','Take the stairs','Take the stairs upstairs|Admire the chandelier|Welcome a housemate','public'],
 ['gym','Fitness & Wellness','🏋️','Work out','Do a HIIT workout|Train with a partner|Film a fitness challenge','public'],
 ['glam','Glam & Content Studio','💄','Create content','Film a GRWM|Shoot a viral skit|Pose for a magazine cover','public'],
 ['pool','Beachfront Pool','🏊','Poolside hangout','Swim a lap|Take a beach shower|Host a pool party','outdoor'],
 ['garden','Private Beach','🏖️','Feet in the sand','Build a sandcastle|Rest in a hammock|Watch the sunset by the sea','outdoor'],
 ['arena','Beach Games','🏐','Compete by the shore','Play beach volleyball|Unwind by the bonfire|Win a team puzzle','outdoor'],
 ['cabana','Sunset Cabana','🍹','Live the soft life','Make a beach BBQ plate|Host a beachfront brunch|Take a luxury selfie','outdoor'],
 // True second floor, horizontally stacked over the first two ground rows.
 ['male-bedroom','Men’s Bedroom','🛏️','Relax in the men’s wing','Sleep in bed|Make your bed|Chat with housemates','male'],
 ['male-bath','Men’s Washroom','🚿','Freshen up','Take a shower|Brush your teeth|Get ready for the day','male-private'],
 ['female-bedroom','Women’s Bedroom','🛏️','Relax in the women’s wing','Sleep in bed|Make your bed|Chat with housemates','female'],
 ['female-bath','Women’s Washroom','🚿','Freshen up','Take a shower|Brush your teeth|Get ready for the day','female-private'],
 ['male-lounge','Gentlemen’s Lounge','♟️','Unwind in the men’s lounge','Play chess|Watch a match|Plan a strategy','male'],
 ['upstairs-hall','Upper Gallery','🪜','Visit the gallery','Take the stairs downstairs|Admire the portraits|Practice your victory speech','public'],
 ['terrace','Skyline Terrace','🌇','Enjoy the skyline','Watch sunset|Host a soft-life soirée|Take a balcony photo','public'],
 ['female-lounge','Ladies’ Lounge','💜','Unwind in the women’s lounge','Host a tea party|Trade style tips|Plan a strategy','female'],
];
const colors=['#ca7b45','#ab7265','#8d9093','#986586','#685488','#ed743c','#593c79','#4b4162','#654b86','#e6a470','#6a877d','#b86b89','#48bac7','#6c9b79','#d3a051','#c39b6c','#546b87','#a7abb1','#b77d8f','#a0a4ad','#4c6781','#e2b56f','#a17595','#8b78a7'];
export const ROOMS=definitions.map(([id,name,icon,headline,options,access],i)=>{
 const upper=i>=16,slot=upper?i-16:i;
 const floor=upper?1:0,x=COLS[slot%4],z=ROWS[Math.floor(slot/4)],outdoor=!upper&&slot>=12;
 const actions=options.split('|').map((title,j)=>({id:`${id}-${j+1}`,title,duration:durationForAction(title,6+(j%3)*3),reward:20+(j%3)*10,effects:needsForAction(id,title),lockMovement:locksMovement(title)}));
 return {id,name,icon,headline,action:actions[0].title,actions,access,viewable:!['private','male-private','female-private'].includes(access),public:!['private','male-private','female-private'].includes(access),floor,x,z,w:15.55,d:13.55,outdoor,color:colors[i],height:floor*FLOOR_HEIGHT};
});
export const ROOM_BY_ID=Object.fromEntries(ROOMS.map(r=>[r.id,r]));
export const WALLS=[];
const put=(floor,x,z,w,d,h=4.35)=>WALLS.push({floor,x,z,w,d,h});
function verticalDividers(floor,rowIndices){for(const x of [-16,0,16])for(const idx of rowIndices){const z=ROWS[idx],part=(14-DOOR_WIDTH)/2;for(const sign of [-1,1])put(floor,x,z+sign*(DOOR_WIDTH/2+part/2),.42,part);}}
function horizontalDividers(floor,zs){for(const z of zs)for(const x of COLS){const part=(16-DOOR_WIDTH)/2;for(const sign of [-1,1])put(floor,x+sign*(DOOR_WIDTH/2+part/2),z,part,.42);}}
verticalDividers(0,[0,1,2]);horizontalDividers(0,[-12,2]);
// A 4.6m gate from the indoor ground floor into the landscaped compound.
for(const x of COLS){const part=(16-(x===-8?5.8:DOOR_WIDTH))/2,gap=x===-8?5.8:DOOR_WIDTH;for(const sign of [-1,1])put(0,x+sign*(gap/2+part/2),16,part,.52);}
for(const x of [-32,32])put(0,x,2,.5,56,3.2);
for(const z of [-26,30])put(0,0,z,64,.52,3.2);
verticalDividers(1,[0,1]);horizontalDividers(1,[-12]);
for(const x of [-32,32])put(1,x,-12,.42,28,4.4);
for(const z of [-26,2])put(1,0,z,64,.42,4.4);
export const FURNITURE=[
 ['sofa','lounge',-12,-8.9,4.8,1.35],['sofa','lounge',-3,-8.5,1.35,4],['table','lounge',-8,-7.5,2.9,1.7],
 ['counter','kitchen',-28,-23,6.2,1.25],['island','kitchen',-24,-20,4.4,1.8],
 ['dining','dining',-8,-19,4.8,2],['spa','spa',8,-19,3,3],['clothes','wardrobe',27,-20,1.3,7],
 ['billiards','games',-24,-5,4.6,2.4],['diary-chair','diary',8,-5,1.6,1.6],['screen','cinema',8,-9.9,6,.48],
 ['sofa','cinema',8,-3.4,5,1.6],['music','music',-24,8.5,4.5,1.5],['stairs','foyer',-10,10,2.7,4.2],
 ['gym','gym',8,9,3.4,1.45],['mirror','glam',28,9,1.1,5.2],['pool','pool',-24,23,10.5,8],
 ['garden','garden',-8,22,3,2.5],['hammock','garden',-12.5,27,3.3,1.0],['pool-shower','pool',-18.5,28.1,1.0,1.2],['beach-grill','cabana',29.2,20.1,2.1,1.1],['beach-picnic','garden',-4.5,19,3.7,1.9],['fire-circle','arena',12.7,28.2,2.0,2.0],['court-post','arena',3,22.5,.4,.4],['court-post','arena',13,22.5,.4,.4],['stage','arena',8,27,10,1.4],['cabana','cabana',24,23,6,3.7],
 ['bed','male-bedroom',-24,-19,5.3,4.5],['shower','male-bath',-8,-19,4,3],
 ['bed','female-bedroom',8,-19,5.3,4.5],['shower','female-bath',24,-19,4,3],
 ['sofa','male-lounge',-24,-5,4.5,1.4],['stairs','upstairs-hall',-8,-5,2.7,3.4],
 ['sofa','female-lounge',24,-5,4.5,1.4],['bar','terrace',11,-7,1.3,5],
].map(([kind,room,x,z,w,d])=>({kind,room,x,z,w,d,floor:ROOM_BY_ID[room].floor}));
/** Clickable furniture is a shared data contract for picking and server validation.
 * Only the object catalog determines actions: the client cannot invent them. */
const interactableDefinitions=[
 ['lounge-sofa','lounge','Living room sofa','sofa',-11,-9.1,4.6,1.6,['sit','lie','cuddle']],
 ['lounge-armchair','lounge','Orange armchair','chair',-4.4,-8.7,1.9,4.2,['sit','cuddle']],
 ['lounge-tv','lounge','Lounge television','tv',-8,-11.3,6.1,.4,['watch','tv_power','tv_channel','tv_movie']],
 ['lounge-remote','lounge','TV remote','remote',-8,-6.9,.65,.4,['remote_pickup','tv_power','tv_channel','tv_movie']],
 ['lounge-lamp','lounge','Statement floor lamp','lamp',-14,-3,1.2,1.2,['lights_toggle','inspect']],
 ['lounge-plant','lounge','Tropical houseplant','plant',-1.7,-2.7,1,1,['water','inspect']],
 ['lounge-coffee-table','lounge','Coffee table','table',-8,-6.9,2.8,1.6,['sit','inspect']],
 ['cinema-sofa','cinema','Cinema couch','sofa',8,-3.4,5.2,1.8,['sit','lie','cuddle']],
 ['cinema-screen','cinema','Movie screen','tv',8,-11.5,8,.35,['watch']],
 ['cinema-remote','cinema','Cinema remote','remote',8,-3,.65,.38,['remote_pickup','tv_power','tv_channel','tv_movie']],
 ['cinema-projector','cinema','Ceiling projector','projector',7,-7,1.2,1.1,['tv_power','tv_movie','inspect']],
 ['male-bed','male-bedroom','Your bedroom bed','bed',-24,-19,5.7,4.7,['sleep','lie']],
 ['female-bed','female-bedroom','Your bedroom bed','bed',8,-19,5.7,4.7,['sleep','lie']],
 ['dining-table','dining','Dining table','table',-8,-19,5.4,3.1,['eat','sit']],
 ['kitchen-island','kitchen','Kitchen island','counter',-24,-20,5,2.2,['cook','eat']],
 ['game-table','games','Snooker table','table',-24,-5,4.8,2.7,['play']],
 ['beach-hammock','garden','Beach hammock','hammock',-12.5,27,3.7,1.5,['lie','sleep']],
 ['beach-picnic','garden','Picnic table','table',-4.5,19,4.2,2.3,['eat','sit']],
 ['bbq-grill','cabana','Barbecue grill','grill',29.2,20.1,2.4,1.4,['cook','eat']],
 ['gym-equipment','gym','Workout bench','gym',8,9,3.7,1.8,['exercise']],
 ['gym-mat','gym','Yoga mat','gym',11,6,1.2,2.1,['stretch','meditate']],
 ['gym-weights','gym','Dumbbell rack','gym',5.4,10.7,1.8,1.1,['exercise','inspect']],
 ['spa-tub','spa','Spa tub','bath',8,-15.5,2.2,2.2,['bath','relax']],
 ['spa-bed','spa','Spa treatment bed','bed',5.1,-19,2.3,4.8,['lie','relax']],
 ['spa-mirror','spa','Spa mirror','mirror',12,-19,.65,3.1,['admire','inspect']],
 ['kitchen-fridge','kitchen','Fridge','fridge',-29.5,-22.1,1.7,1.3,['fridge_open','eat','inspect']],
 ['kitchen-sink','kitchen','Kitchen sink','sink',-27.5,-24,2.3,1.4,['wash','clean']],
 ['kitchen-stove','kitchen','Cooker','stove',-25,-24,2.1,1.4,['cook','clean']],
 ['kitchen-barstool','kitchen','Kitchen bar stool','chair',-26,-18.05,1.1,1.1,['sit','inspect']],
 ['dining-chair','dining','Dining chair','chair',-10.7,-16.9,1.1,1.0,['sit','inspect']],
 ['dining-lamp','dining','Dining pendant light','lamp',-8,-19,1.2,1.2,['lights_toggle','inspect']],
 ['wardrobe-rack','wardrobe','Outfit rack','clothes',19.3,-19,1,8.8,['try_on','inspect']],
 ['wardrobe-mirror','wardrobe','Full-length mirror','mirror',28.6,-19,1,4.8,['admire','try_on']],
 ['wardrobe-bench','wardrobe','Dressing bench','chair',24,-15.7,2.2,1.2,['sit','inspect']],
 ['games-arcade','games','Retro arcade machine','arcade',-28,-10,1.2,1.1,['arcade_play','inspect']],
 ['games-snooker','games','Snooker table','table',-24,-5,4.8,2.7,['play','inspect']],
 ['diary-chair','diary','Diary room chair','chair',8,-5,2.5,1.6,['sit','confess']],
 ['diary-mic','diary','Diary microphone','microphone',8,-3,1.0,1.0,['confess','inspect']],
 ['music-stereo','music','Afrobeats stereo','stereo',-29,6.2,1.5,1.2,['music_toggle','music_next','dance','inspect']],
 ['music-speaker','music','Studio speaker','speaker',-19.1,6.2,1.5,1.2,['music_toggle','music_next','inspect']],
 ['music-mic','music','Recording microphone','microphone',-24,6.3,1.3,1.3,['freestyle','inspect']],
 ['music-mixer','music','Production mixer','mixer',-24,6.3,4.3,1.5,['music_toggle','music_next','freestyle','inspect']],
 ['foyer-chandelier','foyer','Grand chandelier','lamp',-8,8.7,1.3,1.2,['lights_toggle','inspect']],
 ['foyer-stairs','foyer','Grand staircase','stairs',-10,10,3.2,4.5,['travel','inspect']],
 ['glam-mirror','glam','Makeup mirror','mirror',20.2,9,1.4,3,['admire','try_on','inspect']],
 ['glam-ring-light','glam','Ring light','lamp',27.3,9,1.4,1.4,['lights_toggle','inspect']],
 ['pool-water','pool','Swimming pool','pool',-24,23,10.6,8,['swim','relax','inspect']],
 ['pool-lounger','pool','Poolside lounger','sofa',-29,17.6,2.3,1.1,['sit','lie','inspect']],
 ['pool-shower','pool','Pool shower','shower',-18.5,28.1,1,1.2,['shower','inspect']],
 ['beach-umbrella','garden','Beach umbrella','umbrella',-13,19,2.3,2.3,['relax','inspect']],
 ['beach-surfboard','garden','Surfboard rack','board',-2,28,3,1,['surf','inspect']],
 ['beach-fire-circle','arena','Beach bonfire','fire',12.7,28.2,2.0,2.0,['bonfire','relax','inspect']],
 ['beach-volleyball','arena','Volleyball court','court',8,22.5,10.3,8.7,['volleyball','inspect']],
 ['cabana-bar','cabana','Juice bar','bar',19,27.6,1.7,3.3,['drink','eat','inspect']],
 ['cabana-counter','cabana','Cabana counter','counter',24,23,5.8,4,['drink','relax','inspect']],
 ['men-nightstand','male-bedroom','Bedside table','table',-27.7,-20.1,1,1.1,['read','inspect']],
 ['women-nightstand','female-bedroom','Bedside table','table',4.3,-20.1,1,1.1,['read','inspect']],
 ['men-shower','male-bath','Men’s shower','shower',-8,-18,2.6,2,['shower','inspect']],
 ['women-shower','female-bath','Women’s shower','shower',24,-18,2.6,2,['shower','inspect']],
 ['mens-chess','male-lounge','Chess table','table',-24,-8,2.5,1.9,['chess','sit','inspect']],
 ['womens-tea','female-lounge','Tea table','table',24,-8,2.5,1.9,['drink','sit','inspect']],
 ['upper-gallery-painting','upstairs-hall','Gallery painting','art',-8,-2,2.4,.7,['admire','inspect']],
 ['upstairs-stairs','upstairs-hall','Grand staircase','stairs',-8,-5,3.2,3.7,['travel','inspect']],
 ['terrace-bar','terrace','Terrace bar','bar',11,-7,1.6,5.3,['drink','relax','inspect']],
 ['terrace-view','terrace','Ocean viewpoint','view',8,-9,4.0,1.0,['relax','admire','inspect']],
];
export const OBJECT_ACTIONS={
 sit:{label:'Sit down',icon:'🪑',duration:0,pose:'sitting'},
 lie:{label:'Lie down',icon:'🛋️',duration:0,pose:'lying'},
 sleep:{label:'Go to sleep',icon:'💤',duration:0,pose:'sleeping'},
 cuddle:{label:'Ask to cuddle',icon:'♡',duration:0,pose:'cuddling',consent:true},
 watch:{label:'Watch a movie',icon:'📺',duration:0,pose:'watching'},
 eat:{label:'Have something to eat',icon:'🍽️',duration:13,pose:'eating'},
 cook:{label:'Prepare some food',icon:'🍲',duration:15,pose:'cooking'},
 play:{label:'Play snooker',icon:'🎱',duration:14,pose:'playing'},
 exercise:{label:'Work out',icon:'🏋️',duration:13,pose:'exercising'},
 read:{label:'Read a magazine',icon:'📖',duration:12,pose:'reading',effects:{energy:5}},
 snack:{label:'Have a snack',icon:'🍿',duration:9,pose:'eating',effects:{hunger:12}},
 inspect:{label:'Inspect',icon:'🔎',duration:0,pose:'inspecting',moment:true},
 tv_power:{label:'Turn TV on / off',icon:'⏻',duration:0,pose:'remote',device:'tv',moment:true},
 tv_channel:{label:'Change channel',icon:'📺',duration:0,pose:'remote',device:'tv',moment:true},
 tv_movie:{label:'Start movie night',icon:'🎬',duration:0,pose:'watching',device:'tv'},
 remote_pickup:{label:'Pick up remote',icon:'🎮',duration:0,pose:'remote',moment:true},
 music_toggle:{label:'Play / pause music',icon:'🎵',duration:0,pose:'dancing',device:'stereo',moment:true},
 music_next:{label:'Change music',icon:'⏭',duration:0,pose:'remote',device:'stereo',moment:true},
 dance:{label:'Dance to the music',icon:'💃',duration:0,pose:'dancing'},
 lights_toggle:{label:'Switch lights on / off',icon:'💡',duration:0,pose:'reaching',device:'lights',moment:true},
 water:{label:'Water plant',icon:'🌿',duration:8,pose:'watering',effects:{hygiene:-2,social:3}},
 fridge_open:{label:'Open the fridge',icon:'🧊',duration:0,pose:'reaching',moment:true},
 clean:{label:'Clean up',icon:'🧽',duration:11,pose:'cleaning',effects:{hygiene:-2}},
 wash:{label:'Wash the dishes',icon:'🫧',duration:10,pose:'washing',effects:{hygiene:4}},
 bath:{label:'Take a relaxing bath',icon:'🛁',duration:16,pose:'bathing',effects:{hygiene:28,energy:9}},
 relax:{label:'Relax',icon:'🌺',duration:0,pose:'relaxing'},
 admire:{label:'Admire / check reflection',icon:'🪞',duration:0,pose:'admiring',moment:true},
 try_on:{label:'Try on an outfit',icon:'👗',duration:0,pose:'styling',moment:true},
 arcade_play:{label:'Play arcade',icon:'🕹️',duration:14,pose:'gaming'},
 confess:{label:'Record a confession',icon:'🎙️',duration:15,pose:'speaking'},
 freestyle:{label:'Record a freestyle',icon:'🎤',duration:14,pose:'singing'},
 travel:{label:'Use staircase',icon:'🪜',duration:0,pose:'walking',moment:true},
 stretch:{label:'Stretch',icon:'🧘',duration:12,pose:'stretching',effects:{energy:6}},
 meditate:{label:'Meditate',icon:'🧘',duration:16,pose:'meditating',effects:{energy:11,social:2}},
 swim:{label:'Swim laps',icon:'🏊',duration:14,pose:'swimming',effects:{hygiene:4,energy:-6}},
 shower:{label:'Take shower',icon:'🚿',duration:12,pose:'showering',effects:{hygiene:32}},
 surf:{label:'Practice surfing',icon:'🏄',duration:15,pose:'surfing'},
 bonfire:{label:'Sit around the fire',icon:'🔥',duration:0,pose:'relaxing'},
 volleyball:{label:'Play volleyball',icon:'🏐',duration:15,pose:'playing'},
 drink:{label:'Get a drink',icon:'🥤',duration:8,pose:'drinking',effects:{hunger:7}},
 chess:{label:'Play chess',icon:'♟',duration:16,pose:'playing'},

};
export const INTERACTABLES=interactableDefinitions.map(([id,room,label,kind,x,z,w,d,actions])=>({
 id,room,label,kind,x,z,w,d,floor:ROOM_BY_ID[room].floor,actions,
 height:kind==='tv'?2.2:kind==='bed'?.9:kind==='hammock'?1.0:kind==='chair'||kind==='sofa'?1.4:kind==='gym'?1.8:kind==='lamp'?3.2:1.4,
}));
export const OBJECT_BY_ID=Object.fromEntries(INTERACTABLES.map(o=>[o.id,o]));
export function distanceToObject(x,z,obj){
 const dx=Math.max(0,Math.abs(x-obj.x)-obj.w/2);
 const dz=Math.max(0,Math.abs(z-obj.z)-obj.d/2);
 return Math.hypot(dx,dz);
}
export function interactionInRange(actor,obj){return Boolean(actor&&obj&&actor.floor===obj.floor&&actor.room===obj.room&&distanceToObject(actor.x,actor.z,obj)<=2.5);}

/** Designated self-selected sleeping wing. This is a game rule, not identity verification. */
export function canEnter(room,wing){return !room?false:room.access.startsWith('male')?wing==='male':room.access.startsWith('female')?wing==='female':true;}
export function roomAt(x,z,floor=0){
 const rooms=ROOMS.filter(r=>r.floor===floor);
 return rooms.reduce((nearest,r)=>!nearest||Math.hypot(x-r.x,z-r.z)<Math.hypot(x-nearest.x,z-nearest.z)?r:nearest,null);
}
function overlapsRect(x,z,r,o){const cx=Math.max(o.x-o.w/2,Math.min(x,o.x+o.w/2)),cz=Math.max(o.z-o.d/2,Math.min(z,o.z+o.d/2));return Math.hypot(x-cx,z-cz)<r+.015;}
export function canStand(x,z,others=[],selfId=null,r=CHARACTER_RADIUS,floor=0,wing='male'){
 if(!Number.isFinite(x)||!Number.isFinite(z)||x<LIMITS.minX+r||x>LIMITS.maxX-r||z<(-25.8+r)||z>(floor===0?29.8:1.8)-r)return false;
 const room=roomAt(x,z,floor);if(!room||!canEnter(room,wing))return false;
 for(const w of WALLS)if(w.floor===floor&&overlapsRect(x,z,r,w))return false;
 for(const f of FURNITURE)if(f.floor===floor&&f.kind!=='pool'&&overlapsRect(x,z,r,f))return false;
 for(const a of others)if(a.id!==selfId&&(a.floor??0)===floor&&Number.isFinite(a.x)&&Math.hypot(x-a.x,z-a.z)<r*2+.08)return false;
 return true;
}
/** Colliding, server-authoritative, camera-independent world movement. */
export function advanceActor(actor,dx,dz,dt,others=[]){
 dx=Number(dx);dz=Number(dz);dt=Number(dt);if(!Number.isFinite(dx)||!Number.isFinite(dz)||!Number.isFinite(dt)||dt<=0)return false;
 const mag=Math.hypot(dx,dz);if(mag<.025)return false;
 const factor=Math.min(.125,dt)*3.65/Math.max(1,mag);dx*=factor;dz*=factor;
 const oldX=actor.x,oldZ=actor.z,fl=actor.floor??0,wing=actor.wing||'male';
 if(canStand(actor.x+dx,actor.z,others,actor.id,CHARACTER_RADIUS,fl,wing))actor.x+=dx;
 if(canStand(actor.x,actor.z+dz,others,actor.id,CHARACTER_RADIUS,fl,wing))actor.z+=dz;
 const moved=Math.hypot(actor.x-oldX,actor.z-oldZ)>.0001;
 if(moved){actor.angle=Math.atan2(dx,dz);actor.room=roomAt(actor.x,actor.z,fl).id;}actor.walking=moved;
 return moved;
}
export function targetStairs(roomId){return roomId==='foyer'?'upstairs-hall':roomId==='upstairs-hall'?'foyer':null;}

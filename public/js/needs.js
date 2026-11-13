/** Compact, season-length needs simulation. Shared between browser UI and game server. */
export const NEED_KEYS=['hunger','energy','hygiene','social'];
export const NEED_META={
 hunger:{label:'Food',icon:'🍲',ratePerMinute:1.55},
 energy:{label:'Energy',icon:'⚡',ratePerMinute:1.9},
 hygiene:{label:'Hygiene',icon:'💧',ratePerMinute:1.1},
 social:{label:'Social',icon:'💬',ratePerMinute:1.35},
};
export const INITIAL_NEEDS={hunger:75,energy:78,hygiene:82,social:72};
export const clampNeed=n=>Math.max(0,Math.min(100,Math.round(n*10)/10));
export const newNeeds=()=>({...INITIAL_NEEDS});
export function drainNeeds(current,elapsedMs){
 const minutes=Math.min(Math.max(0,Number(elapsedMs)||0),30_000)/60_000;
 const next={...current};
 for(const key of NEED_KEYS)next[key]=clampNeed((Number(next[key])||0)-NEED_META[key].ratePerMinute*minutes);
 return next;
}
export function applyNeedEffects(current,effects={}){
 const next={...current};
 for(const key of NEED_KEYS){if(Number.isFinite(effects[key]))next[key]=clampNeed((Number(next[key])||0)+effects[key]);}
 return next;
}
// The effects are rewards for COMPLETED tasks only. Movement during sleep/eating/showering is locked.
const explicit={
 'Sleep in bed':{energy:46,hunger:-3},'Take a power nap':{energy:22},'Rest in a hammock':{energy:27,social:3},
 'Eat a hot meal':{hunger:43,energy:4},'Have a snack':{hunger:20},'Eat dinner':{hunger:39,social:8},
 'Share a meal':{hunger:28,social:17},'Make a beach BBQ plate':{hunger:34,social:8},
 'Take a shower':{hygiene:48},'Brush your teeth':{hygiene:17},'Get a facial':{hygiene:23,energy:7},
 'Take a beach shower':{hygiene:34},'Swim a lap':{hygiene:5,energy:-10,social:7},
 'Play beach volleyball':{social:18,energy:-10,hygiene:-7},'Chat with housemates':{social:27},
 'Host a pool party':{social:29,energy:-5},'Host a beachfront brunch':{hunger:18,social:25},
 'Watch the sunset by the sea':{energy:10,social:8},'Unwind by the bonfire':{energy:12,social:17},
 'Make your bed':{hygiene:3,energy:-2},'Work out':{energy:-10,hygiene:-8},
};
export function needsForAction(roomId,title){
 if(explicit[title])return {...explicit[title]};
 if(/cook|jollof|stew|rice|chops|mocktail/i.test(title))return {hunger:9,energy:-2};
 if(/dance|workout|train|hiit|fitness|beach games/i.test(title))return {social:10,energy:-9,hygiene:-6};
 if(/lounge|spa|relax|sofa|cinema|movie|sunset|meditat|chess/i.test(title))return {energy:11,social:4};
 if(/gist|talk|meeting|party|together|strategy|tea|debate|skit/i.test(title))return {social:19};
 return {social:7};
}
export function durationForAction(title,normal){
 if(/Sleep in bed/.test(title))return 24;
 if(/Take a shower/.test(title))return 14;
 if(/Eat a hot meal|Eat dinner|Share a meal/.test(title))return 11;
 if(/nap|hammock|beach shower/.test(title))return 13;
 return normal;
}
export function locksMovement(title){return /^(Sleep in bed|Take a power nap|Rest in a hammock|Eat a hot meal|Eat dinner|Share a meal|Take a shower|Take a beach shower)$/.test(title);}

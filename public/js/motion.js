/** Frame-rate-independent animation blending for local and replicated human players. */
export const clamp01=n=>Math.max(0,Math.min(1,Number(n)||0));
export const lerp=(a,b,t)=>a+(b-a)*clamp01(t);
export const smooth=(current,target,dt,rate=9)=>lerp(current,target,1-Math.exp(-rate*Math.max(0,dt)));
export function advanceGait(previous={},actor={},now=0){
 const px=Number(actor.x)||0,pz=Number(actor.z)||0;
 const dt=Math.max(0,Math.min(.12,(now-(previous.time??now))/1000));
 const travelled=Math.hypot(px-(previous.x??px),pz-(previous.z??pz));
 const speed=dt>0?Math.min(3.5,travelled/dt):0;
 const target=actor.walking?clamp01((speed||1.6)/2.35):0;
 const weight=smooth(previous.weight||0,target,dt,11);
 const phase=((previous.phase||0)+dt*(7.5+speed*1.8)*Math.max(.28,weight))%(Math.PI*2);
 return {x:px,z:pz,time:now,weight,phase,speed};
}
export function gestureProgress(action,now){
 if(!action||!Number.isFinite(action.startedAt)||!Number.isFinite(action.until)||action.until<=now)return 0;
 const duration=Math.max(1,action.until-action.startedAt);
 const t=clamp01((now-action.startedAt)/duration);
 return Math.sin(Math.PI*t)**.6;
}

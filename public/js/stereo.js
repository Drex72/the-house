/** Small original synthesized grooves for the island studio.
 * No external recordings, copyrighted samples, streaming URLs or autoplay.
 * The listener must explicitly choose Enable sound before audio can play.
 */
const MELODIES = [
  [0,4,7,9,7,4,2,4,0,7,5,4,2,4,7,9],
  [0,5,7,12,9,7,5,4,0,4,7,11,9,5,4,2],
  [0,3,7,10,7,3,5,7,0,10,8,7,3,5,7,10],
];
export const ORIGINAL_TRACKS=['Island Groove','Sunset Highlife','Lagos Bounce'];

export class IslandStereo {
 constructor(){this.ctx=null;this.master=null;this.allowed=false;this.running=false;this.room=null;this.track=0;this.step=0;this.nextAt=0;this.interval=null;}
 async enable(){
  const AudioContextImpl=globalThis.AudioContext||globalThis.webkitAudioContext;
  if(!AudioContextImpl)return false;
  if(!this.ctx){this.ctx=new AudioContextImpl();this.master=this.ctx.createGain();this.master.gain.value=.075;this.master.connect(this.ctx.destination);}
  try{await this.ctx.resume();this.allowed=this.ctx.state==='running';}catch{this.allowed=false;}
  return this.allowed;
 }
 note(freq,when,length,type='triangle',gain=.22){
  if(!this.allowed||!this.ctx)return;
  const o=this.ctx.createOscillator(),g=this.ctx.createGain();
  o.type=type;o.frequency.setValueAtTime(freq,when);
  g.gain.setValueAtTime(0,when);g.gain.linearRampToValueAtTime(gain,when+.012);
  g.gain.exponentialRampToValueAtTime(.001,when+length);
  o.connect(g);g.connect(this.master);o.start(when);o.stop(when+length+.025);
 }
 beat(when,low=false){
  if(!this.allowed||!this.ctx)return;
  const o=this.ctx.createOscillator(),g=this.ctx.createGain();
  o.type='sine';o.frequency.setValueAtTime(low?118:430,when);o.frequency.exponentialRampToValueAtTime(low?49:150,when+.12);
  g.gain.setValueAtTime(low?.38:.10,when);g.gain.exponentialRampToValueAtTime(.001,when+.13);
  o.connect(g);g.connect(this.master);o.start(when);o.stop(when+.145);
 }
 schedule(){
  if(!this.allowed||!this.running||!this.ctx)return;
  const beatSeconds=[.245,.28,.22][this.track];
  while(this.nextAt<this.ctx.currentTime+.23){
   const n=this.step,pattern=MELODIES[this.track];
   if(n%4===0)this.beat(this.nextAt,true);
   else if(n%4===2)this.beat(this.nextAt,false);
   const key=pattern[n%pattern.length],root=[196,175,220][this.track];
   const freq=root*Math.pow(2,key/12);
   this.note(freq,this.nextAt,beatSeconds*.75,this.track===1?'sine':'triangle',.12);
   if(n%4===0)this.note(root/2,this.nextAt,beatSeconds*2,'sine',.13);
   this.step++;this.nextAt+=beatSeconds;
  }
 }
 /** Only listeners inside the room with the stereo can hear it. */
 sync({powered=false,track=0,room=null}={}){
  const shouldPlay=this.allowed&&powered&&room==='music';
  const changed=this.track!==track;
  this.track=Math.max(0,Math.min(2,Number(track)||0));
  this.room=room;
  if(!shouldPlay){this.running=false;if(this.interval){clearInterval(this.interval);this.interval=null;}return;}
  if(changed||!this.running){this.step=0;this.nextAt=this.ctx.currentTime+.05;this.running=true;}
  if(!this.interval)this.interval=setInterval(()=>this.schedule(),95);
 }
 mute(){this.allowed=false;this.running=false;if(this.interval){clearInterval(this.interval);this.interval=null;}if(this.ctx)this.ctx.suspend().catch(()=>{});}
 get enabled(){return this.allowed;}
}

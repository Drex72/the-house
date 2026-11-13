/** Explicit, eight-second room-only voice notes; never records automatically. */
export class VoiceNotes{
 constructor(send,notice){this.send=send;this.notice=notice;this.recorder=null;this.stream=null;this.startedAt=0;this.parts=[];this.timeout=null;this.active=false;this.cancelled=false;}
 async start(){
  if(this.active)return;
  if(!window.MediaRecorder||!navigator.mediaDevices?.getUserMedia){this.notice('Voice notes require a modern HTTPS browser.');return false;}
  const mime=['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus'].find(m=>MediaRecorder.isTypeSupported(m));
  if(!mime){this.notice('This browser does not support voice notes.');return false;}
  try{
   this.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
   this.recorder=new MediaRecorder(this.stream,{mimeType:mime,audioBitsPerSecond:24000});
   this.parts=[];this.cancelled=false;this.active=true;this.startedAt=performance.now();
   this.recorder.addEventListener('dataavailable',e=>{if(e.data?.size)this.parts.push(e.data);});
   this.recorder.addEventListener('stop',()=>{void this.finish();},{once:true});
   this.recorder.start(250);
   this.timeout=setTimeout(()=>this.stop(),8000);
   return true;
  }catch(e){this.clean();this.notice(e.name==='NotAllowedError'?'Microphone permission denied.':'Could not record voice note.');return false;}
 }
 stop(){if(this.recorder?.state==='recording'){clearTimeout(this.timeout);this.recorder.stop();}}
 cancel(){this.cancelled=true;if(this.recorder?.state==='recording')this.recorder.stop();else this.clean();}
 clean(){clearTimeout(this.timeout);this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.recorder=null;this.active=false;}
 async finish(){
  const seconds=Math.min(8,(performance.now()-this.startedAt)/1000);
  const blob=new Blob(this.parts,{type:this.recorder?.mimeType||'audio/webm'});
  const cancelled=this.cancelled;this.clean();this.parts=[];
  if(cancelled)return;
  if(blob.size>32768){this.notice('Voice note too large. Try a shorter recording.');return;}
  if(blob.size<100||seconds<.4){this.notice('Voice note too short.');return;}
  try{
   const bytes=new Uint8Array(await blob.arrayBuffer());
   this.send('voice-note-start',{mime:blob.type});
   for(let i=0;i<bytes.length;i+=1800){
    const chunk=bytes.subarray(i,i+1800);
    let binary='';for(const byte of chunk)binary+=String.fromCharCode(byte);
    this.send('voice-note-chunk',{data:btoa(binary)});
   }
   this.send('voice-note-end',{seconds});
   this.notice('Sending voice note to this room…');
  }catch(e){this.notice('Voice note failed to send.');}
 }
}

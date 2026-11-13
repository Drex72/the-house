/** Opt-in, room-local WebRTC voice between actual connected housemates.
 * The signaling server authorizes same-room/same-floor/voice-enabled peers.
 * No voice recording, and spectators do not receive peer audio.
 */
export class RoomVoice{
 constructor(send,notice){this.send=send;this.notice=notice;this.active=false;this.stream=null;this.peers=new Map();this.actorId=null;}
 async enable(){
  if(this.active)return;
  if(!navigator.mediaDevices?.getUserMedia||!window.RTCPeerConnection){this.notice('Voice requires a modern HTTPS browser.');return false;}
  try{
   this.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1},video:false});
   this.active=true;this.send('voice-toggle',{enabled:true});this.notice('Microphone on. Only nearby opted-in housemates can hear you.');return true;
  }catch(e){this.notice(e.name==='NotAllowedError'?'Microphone permission denied.':'Could not start microphone.');return false;}
 }
 disable(notifyServer=true){
  if(notifyServer)this.send('voice-toggle',{enabled:false});
  for(const peerId of [...this.peers.keys()])this.closePeer(peerId);
  this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.active=false;
 }
 closePeer(id){const p=this.peers.get(id);if(!p)return;this.peers.delete(id);try{p.pc.close();}catch{}p.audio?.remove();}
 makePeer(id){
  if(this.peers.has(id))return this.peers.get(id);
  if(!this.active||!this.stream)return null;
  const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
  const peer={pc,audio:null,candidates:[],id};this.peers.set(id,peer);
  this.stream.getAudioTracks().forEach(track=>pc.addTrack(track,this.stream));
  pc.addEventListener('icecandidate',e=>{if(e.candidate)this.send('voice-signal',{to:id,signal:{type:'candidate',candidate:e.candidate.toJSON()}});});
  pc.addEventListener('track',e=>{
   if(peer.audio)return;
   const audio=document.createElement('audio');audio.autoplay=true;audio.playsInline=true;audio.dataset.houseVoice=id;
   audio.srcObject=e.streams[0]||new MediaStream([e.track]);audio.style.display='none';document.body.appendChild(audio);peer.audio=audio;
   audio.play().catch(()=>this.notice('Tap Voice again if your browser blocks playback.'));
  });
  pc.addEventListener('connectionstatechange',()=>{if(['closed','failed'].includes(pc.connectionState))this.closePeer(id);});
  return peer;
 }
 async offer(id){
  const peer=this.makePeer(id);if(!peer||peer.pc.signalingState!=='stable')return;
  try{await peer.pc.setLocalDescription(await peer.pc.createOffer());this.send('voice-signal',{to:id,signal:{type:'offer',sdp:peer.pc.localDescription.sdp}});}catch(e){console.warn('Voice negotiation',e);}
 }
 async onSignal(message){
  if(!this.active||!message?.from||!message.signal)return;
  const {from,signal}=message;const peer=this.makePeer(from);if(!peer)return;
  try{
   if(signal.type==='offer'){
    if(peer.pc.signalingState!=='stable')return;
    await peer.pc.setRemoteDescription({type:'offer',sdp:signal.sdp});
    await peer.pc.setLocalDescription(await peer.pc.createAnswer());
    this.send('voice-signal',{to:from,signal:{type:'answer',sdp:peer.pc.localDescription.sdp}});
   }else if(signal.type==='answer'){
    if(peer.pc.signalingState==='have-local-offer')await peer.pc.setRemoteDescription({type:'answer',sdp:signal.sdp});
   }else if(signal.type==='candidate'){
    if(peer.pc.remoteDescription)await peer.pc.addIceCandidate(signal.candidate);else peer.candidates.push(signal.candidate);
   }
   if(peer.pc.remoteDescription){for(const candidate of peer.candidates.splice(0))await peer.pc.addIceCandidate(candidate);}
  }catch(e){console.warn('Unable to connect voice peer',e);}
 }
 sync(actorId,cast){
  this.actorId=actorId;if(!this.active)return;
  const me=cast.find(a=>a.id===actorId);
  if(!me||me.hidden)return;
  const allowed=new Set(cast.filter(a=>a.id!==actorId&&a.voiceEnabled&&!a.hidden&&a.room===me.room&&a.floor===me.floor).map(a=>a.id));
  for(const peerId of [...this.peers.keys()])if(!allowed.has(peerId))this.closePeer(peerId);
  for(const id of allowed)if(id<actorId&&!this.peers.has(id))void this.offer(id);
 }
}

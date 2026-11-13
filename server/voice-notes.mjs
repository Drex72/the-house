/** Ephemeral, opt-in, room-local audio notes. No disk, database, or viewer delivery.
 * Client websocket frames are kept small; relay validates authorization on completion. */
import {randomUUID} from 'node:crypto';
const LIMIT=32*1024,MAX_FRAMES=30,MAX_SECONDS=8;
export const NOTE_MIMES=new Set(['audio/webm','audio/webm;codecs=opus','audio/ogg','audio/ogg;codecs=opus','audio/mp4']);
export function createVoiceNoteRelay({now=Date.now}={}){
 return function handle(client,message,game,clients,send){
  const type=message?.type;
  if(!['voice-note-start','voice-note-chunk','voice-note-end','voice-note-cancel'].includes(type))return false;
  const actor=game.cast.find(a=>a.owner===client.id);
  const failure=reason=>{client.noteUpload=null;send(client,{type:'voice-note-result',ok:false,reason});return true;};
  if(!actor||client.role!=='housemate')return failure('Only housemates can record room notes.');
  if(type==='voice-note-cancel'){client.noteUpload=null;return true;}
  if(type==='voice-note-start'){
   if(client.noteUpload)return failure('Already recording.');
   if(now()-(client.lastVoiceNote||0)<12000)return failure('Voice notes have a short cooldown.');
   const mime=String(message.mime||'');
   if(!NOTE_MIMES.has(mime))return failure('This audio format is not supported.');
   client.noteUpload={mime,room:actor.room,floor:actor.floor,at:now(),parts:[],bytes:0};
   return true;
  }
  const upload=client.noteUpload;
  if(!upload)return failure('Start a recording first.');
  if(now()-upload.at>17000||actor.room!==upload.room||actor.floor!==upload.floor)return failure('Recording expired or you left the room.');
  if(type==='voice-note-chunk'){
   const payload=message.data;
   if(typeof payload!=='string'||payload.length>3600||!payload.length||!/^[A-Za-z0-9+/]+={0,2}$/.test(payload))return failure('Invalid audio chunk.');
   const bytes=Buffer.from(payload,'base64');
   if(bytes.length>2500||upload.bytes+bytes.length>LIMIT||upload.parts.length>=MAX_FRAMES)return failure('Voice note exceeds size limit.');
   upload.parts.push(bytes);upload.bytes+=bytes.length;return true;
  }
  if(type==='voice-note-end'){
   const seconds=Number(message.seconds);
   if(!Number.isFinite(seconds)||seconds<=0||seconds>MAX_SECONDS+.5||upload.bytes<100)return failure('Record between 1 and 8 seconds.');
   const payload=Buffer.concat(upload.parts).toString('base64');
   client.noteUpload=null;client.lastVoiceNote=now();
   game.recordVoiceNote?.(client);
   const note={type:'voice-note',id:randomUUID(),from:actor.id,name:actor.name,room:actor.room,floor:actor.floor,mime:upload.mime,seconds:Math.round(seconds*10)/10,data:payload,time:now()};
   for(const dest of clients){
    if(!dest.joined||dest.role!=='housemate')continue;
    const peer=game.cast.find(a=>a.owner===dest.id);
    if(peer&&peer.room===upload.room&&peer.floor===upload.floor)send(dest,note);
   }
   send(client,{type:'voice-note-result',ok:true});
   return true;
  }
  return true;
 };
}

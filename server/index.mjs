import {createServer} from 'node:http';
import {createReadStream, existsSync, statSync} from 'node:fs';
import {resolve, extname, sep} from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {createGame,cleanText,ITEMS} from './game.mjs';
import {createVoiceNoteRelay} from './voice-notes.mjs';
const PORT=Number(process.env.PORT||3000);
const ROOT=process.env.VERCEL?resolve(process.cwd(),'public'):resolve(import.meta.dirname,'../public');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'};
const game=createGame();
const relayVoiceNote=createVoiceNoteRelay();
// Optional cross-origin browser hosts for a Vercel frontend with a separate persistent backend.
const ALLOWED_ORIGIN_HOSTS=new Set(String(process.env.ALLOWED_ORIGIN_HOSTS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean));
const clients=new Set();
const pendingPayments=new Map();
const paymentRequests=new Map();
const paymentsEnabled=Boolean(process.env.PAYSTACK_SECRET_KEY&&process.env.ENABLE_EXPERIMENTAL_PAYMENTS==='1');
function originAllowed(origin,req){
 if(!origin)return true;
 try{const host=new URL(origin).host.toLowerCase();return host===String(req.headers.host||'').toLowerCase()||ALLOWED_ORIGIN_HOSTS.has(host);}catch{return false;}
}
function corsHeaders(req){const origin=req.headers.origin;return origin&&originAllowed(origin,req)?{'access-control-allow-origin':origin,'vary':'Origin','access-control-allow-headers':'Authorization, Content-Type','access-control-allow-methods':'GET, POST, OPTIONS'}:{};}
function json(res,code,value,req){res.writeHead(code,{'content-type':'application/json','cache-control':'no-store',...corsHeaders(req)});res.end(JSON.stringify(value));}
async function parseJson(req){let raw='';for await(const part of req){raw+=part.toString('utf8');if(raw.length>2048)throw Error('Body too large');}return JSON.parse(raw||'{}');}
async function paymentApi(req,res,url){
 if(req.method==='OPTIONS'){res.writeHead(204,corsHeaders(req));res.end();return;}
 if(!originAllowed(req.headers.origin,req)){json(res,403,{error:'Origin not allowed'},req);return;}
 if(url.pathname==='/api/payments/status'){json(res,200,{enabled:paymentsEnabled,currency:'NGN'},req);return;}
 if(!paymentsEnabled){json(res,503,{error:'Real-money payments are disabled until payment storage and accounts are configured'},req);return;}
 const key=process.env.PAYSTACK_SECRET_KEY;
 if(url.pathname==='/api/payments/initialize'&&req.method==='POST'){
  const token=String(req.headers.authorization||'').replace(/^Bearer /i,'');
  const client=[...clients].find(c=>c.paymentToken===token&&c.joined);
  if(!client){json(res,401,{error:'You must join the house before checking out'},req);return;}
  const last=paymentRequests.get(client.id)||0;if(Date.now()-last<7000){json(res,429,{error:'Please retry in a moment'},req);return;}
  paymentRequests.set(client.id,Date.now());
  let body;try{body=await parseJson(req);}catch{json(res,400,{error:'Invalid request'},req);return;}
  const item=ITEMS.find(i=>i.id===body.item&&i.currency==='NGN');
  const email=String(body.email||'').trim().toLowerCase();
  if(!item||!/^\S+@\S+\.\S+$/.test(email)||email.length>150){json(res,422,{error:'Choose a paid item and enter a valid email'},req);return;}
  if(game.profile(client.profileId).owned.includes(item.id)){json(res,409,{error:'Already owned'},req);return;}
  const reference=`HOUSE-${randomUUID().replaceAll('-','')}`;
  // Amount in kobo, validated against the server's catalogue (never client pricing).
  const callback=req.headers.origin&&originAllowed(req.headers.origin,req)?req.headers.origin:new URL('http://'+req.headers.host).origin;
  const payload={email,amount:String(item.price),currency:'NGN',reference,callback_url:`${callback}/?payment_ref=${encodeURIComponent(reference)}`};
  try{
   const response=await fetch('https://api.paystack.co/transaction/initialize',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(9500)});
   const data=await response.json();if(!response.ok||!data.status||!String(data.data?.authorization_url||'').startsWith('https://checkout.paystack.com/'))throw Error('Checkout initialization unsuccessful');
   pendingPayments.set(reference,{profileId:client.profileId,itemId:item.id,amount:item.price,createdAt:Date.now(),redeemed:false});
   json(res,200,{reference,url:data.data.authorization_url},req);
  }catch(e){json(res,502,{error:'Payment service unavailable'},req);}return;
 }
 if(url.pathname==='/api/payments/verify'&&req.method==='GET'){
  const reference=url.searchParams.get('reference')||'';
  const order=pendingPayments.get(reference);
  if(!order||order.createdAt<Date.now()-7200000){json(res,404,{error:'Payment order not found'},req);return;}
  if(order.redeemed){json(res,200,{paid:true,alreadyDelivered:true,item:order.itemId},req);return;}
  try{
   const response=await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,{headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(9500)});
   const data=await response.json();const tx=data.data;
   const valid=data.status===true&&tx?.status==='success'&&tx?.reference===reference&&Number(tx.amount)===order.amount&&tx.currency==='NGN';
   if(valid){order.redeemed=true;game.grantPremium(order.profileId,order.itemId);json(res,200,{paid:true,item:order.itemId},req);}
   else json(res,200,{paid:false,status:tx?.status||'pending'},req);
  }catch{json(res,502,{error:'Payment verification unavailable'},req);}return;
 }
 json(res,404,{error:'Unknown endpoint'},req);
}

const server=createServer((req,res)=>{
 if(req.url?.startsWith('/api/payments/')){let url;try{url=new URL(req.url,'http://localhost')}catch{json(res,400,{error:'Invalid URL'},req);return;}void paymentApi(req,res,url).catch(()=>json(res,500,{error:'Unexpected payment error'},req));return;}
 if(req.url?.startsWith('/api/health')){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({ok:true,viewers:[...clients].filter(c=>c.role==='viewer').length,housemates:[...clients].filter(c=>c.role==='housemate').length}));return;}
 let path;
 try{path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}
 const file=resolve(ROOT,'.'+(path==='/'?'/index.html':path));
 if(!file.startsWith(ROOT+sep)&&file!==ROOT){res.writeHead(403);res.end();return;}
 if(!existsSync(file)||!statSync(file).isFile()){res.writeHead(404);res.end('Not found');return;}
 res.writeHead(200,{'content-type':MIME[extname(file)]||'application/octet-stream','cache-control':'no-cache','x-content-type-options':'nosniff','content-security-policy':"default-src 'self' data: blob:; connect-src 'self' ws: wss:; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:;"});
 createReadStream(file).pipe(res);
});
function encodeFrame(s,opcode=1){
 const payload=Buffer.from(s);const n=payload.length;
 const header=Buffer.alloc(n<126?2:n<65536?4:10);header[0]=0x80|opcode;
 if(n<126)header[1]=n;else if(n<65536){header[1]=126;header.writeUInt16BE(n,2);}else{header[1]=127;header.writeBigUInt64BE(BigInt(n),2);}
 return Buffer.concat([header,payload]);
}
function send(client,content){
 if(client.socket.destroyed||!client.socket.writable)return;
 const frame=encodeFrame(typeof content==='string'?content:JSON.stringify(content));
 if(client.socket.writableLength<2_000_000)client.socket.write(frame);
}
server.on('upgrade',(req,socket,head)=>{
 if(new URL(req.url,'http://localhost').pathname!=='/live'){socket.destroy();return;}
 const key=req.headers['sec-websocket-key'];
 if(!key||typeof key!=='string'||req.headers.upgrade?.toLowerCase()!=='websocket'){socket.destroy();return;}
 // Browser-origin restriction for deployment; local access allows localhost.
 const origin=req.headers.origin;
 if(!originAllowed(origin,req)){socket.destroy();return;}
 const accept=createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
 socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');
 const client={id:randomUUID(),socket,profileId:randomUUID(),paymentToken:randomUUID(),role:'viewer',actorId:null,joined:false,buffer:Buffer.alloc(0),lastMessage:0,lastPong:Date.now()};
 clients.add(client);
 function close(){if(!clients.has(client))return;clients.delete(client);game.leave(client);}
 socket.on('close',close);socket.on('error',close);
 socket.on('data',chunk=>{
  client.buffer=Buffer.concat([client.buffer,chunk]);
  // RFC 6455: only masked browser frames, max 8 KB; reject fragments and oversized frames.
  while(client.buffer.length>=2){
   const b=client.buffer;const opcode=b[0]&15,fin=b[0]&0x80,masked=b[1]&0x80;let len=b[1]&127,offset=2;
   if(len===126){if(b.length<4)break;len=b.readUInt16BE(2);offset=4;}
   if(len===127){socket.destroy();return;}
   if(!fin||!masked||len>8192){socket.destroy();return;}
   if(b.length<offset+4+len)break;
   const mask=b.subarray(offset,offset+4),data=Buffer.from(b.subarray(offset+4,offset+4+len));
   for(let i=0;i<data.length;i++)data[i]^=mask[i&3];
   client.buffer=b.subarray(offset+4+len);
   if(opcode===8){socket.end(encodeFrame('',8));close();return;}
   if(opcode===9){socket.write(encodeFrame(data.toString('utf8'),10));continue;}
   if(opcode===10){client.lastPong=Date.now();continue;}
   if(opcode!==1){socket.destroy();return;}
   let message;try{message=JSON.parse(data.toString('utf8'));}catch{continue;}
   if(!client.joined){
    if(message?.type!=='join')continue;
    client.joined=true;client.profileId=cleanText(message.profileId,64)||client.id;
    send(client,{...game.join(client,message.role,message.name,message.wing),paymentToken:client.paymentToken,paymentsEnabled});send(client,game.snapshot(client.role,client));
   }else {
    if(message.type==='voice-signal'){
     const from=game.cast.find(a=>a.id===client.actorId);
     const target=game.cast.find(a=>a.id===message.to);
     const dest=[...clients].find(c=>c.actorId===message.to);
     const body=message.signal;
     // Only opted-in, colocated housemates can exchange WebRTC signaling.
     if(from?.voiceEnabled&&target?.voiceEnabled&&from.room===target.room&&from.floor===target.floor&&dest&&body&&['offer','answer','candidate'].includes(body.type)&&JSON.stringify(body).length<6500){
      send(dest,{type:'voice-signal',from:from.id,signal:body});
     }
    }else if(relayVoiceNote(client,message,game,clients,send)){
     // No storage or broadcast to viewers; successful notes go to the current room.
    }else{
     const result=game.process(client,message);
     if(result&&['object-act','leave-object','social-reply','social-act'].includes(message.type))send(client,{type:'action-result',...result});
     if(!['move','emote'].includes(message.type))send(client,{type:'profile',profile:game.profile(client.profileId)});
    }
   }
  }
  if(client.buffer.length>16000)socket.destroy();
 });
 if(head.length)socket.emit('data',head);
});
let lastTick=Date.now();
setInterval(()=>{const now=Date.now();const dt=Math.min(.1,(now-lastTick)/1000);lastTick=now;game.tick(dt);},50).unref();
setInterval(()=>{for(const c of clients)if(c.joined)send(c,game.snapshot(c.role,c));},150).unref();
setInterval(()=>{for(const c of clients){if(Date.now()-c.lastPong>120000){c.socket.destroy();continue;}c.socket.write(encodeFrame('',9));}},30000).unref();
if(!process.env.VERCEL)server.listen(PORT,'0.0.0.0',()=>console.log(`THE HOUSE 3D — http://localhost:${PORT}`));
export default server;

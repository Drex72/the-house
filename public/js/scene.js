/* The House: original dependency-free low-poly WebGL2 renderer.
 * Geometry is synthesized procedurally, allowing the demo to run without downloads or 3D assets. */
const palettes={
  cream:'#f2dfb8', sand:'#e7be88', coral:'#e89579', dark:'#233c39', mint:'#8bc1a7',
  sky:'#dceef3', wood:'#a57158', gold:'#f3c761', leaf:'#467b60', white:'#fff3db',
};
function rgb(hex){hex=palettes[hex]||hex;if(!hex?.startsWith('#'))hex='#aaaaaa';if(hex.length===4)hex='#'+[...hex.slice(1)].map(x=>x+x).join('');return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);}
const PI=Math.PI;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a+(b-a)*t;
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>{const n=Math.hypot(...a)||1;return a.map(x=>x/n);};
/** Camera-facing axes for spheres in the lightweight 2D fallback.
 * World-X projected into a side-on camera collapses to ~0 pixels; this was
 * producing black vertical hair streaks and detached, paper-thin limbs. */
export function billboardAxes(eye,target){
 const forward=norm(sub(target,eye));
 let right=cross([0,1,0],forward);
 if(Math.hypot(...right)<1e-5)right=[1,0,0];
 right=norm(right);
 const up=norm(cross(forward,right));
 return {right,up,forward};
}
function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2);return [f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0];}
function orthographic(width,aspect,near,far){const h=width/aspect;return [2/width,0,0,0,0,2/h,0,0,0,0,-2/(far-near),0,0,0,-(far+near)/(far-near),1];}
function lookAt(eye,target){const z=norm(sub(eye,target)),x=norm(cross([0,1,0],z)),y=cross(z,x);return [x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1];}
function transform(m,v){return [0,1,2,3].map(i=>(m[i]*v[0]+m[i+4]*v[1]+m[i+8]*v[2]+m[i+12]*v[3]));}
// Column-major matrix helpers, shared by perspective and orthographic object picking.
function multiply4(a,b){const c=Array(16).fill(0);for(let col=0;col<4;col++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)c[col*4+row]+=a[k*4+row]*b[col*4+k];return c;}
function inverse4(m){
 const a=Array.from({length:4},(_,r)=>[...Array.from({length:4},(_,c)=>m[c*4+r]),...Array.from({length:4},(_,c)=>Number(c===r))]);
 for(let i=0;i<4;i++){
  let pivot=i;for(let r=i+1;r<4;r++)if(Math.abs(a[r][i])>Math.abs(a[pivot][i]))pivot=r;
  if(Math.abs(a[pivot][i])<1e-10)return null;
  [a[i],a[pivot]]=[a[pivot],a[i]];
  const divisor=a[i][i];for(let c=0;c<8;c++)a[i][c]/=divisor;
  for(let r=0;r<4;r++)if(r!==i){const k=a[r][i];for(let c=0;c<8;c++)a[r][c]-=k*a[i][c];}
 }
 return Array.from({length:16},(_,i)=>a[i%4][4+Math.floor(i/4)]);
}
function intersectAABB(origin,direction,min,max){
 let tmin=0,tmax=Infinity;
 for(let i=0;i<3;i++){
  if(Math.abs(direction[i])<1e-8){if(origin[i]<min[i]||origin[i]>max[i])return Infinity;continue;}
  const a=(min[i]-origin[i])/direction[i],b=(max[i]-origin[i])/direction[i];
  tmin=Math.max(tmin,Math.min(a,b));tmax=Math.min(tmax,Math.max(a,b));
  if(tmin>tmax)return Infinity;
 }
 return tmin;
}

class Mesh {
 constructor(){this.data=[];this.shapes=[];}
 tri(a,b,c,n,col){const rgbc=rgb(col);for(const p of [a,b,c])this.data.push(...p,...n,...rgbc);}
 quad(a,b,c,d,n,col){this.tri(a,b,c,n,col);this.tri(a,c,d,n,col);}
 box(x,y,z,w,h,d,col,rot=0){
   this.shapes.push({type:'box',x,y,z,w,h,d,col,rot});
   const hw=w/2,hh=h/2,hd=d/2,c=Math.cos(rot),s=Math.sin(rot);
   const p=(a,b,e)=>[x+a*c+e*s,y+b,z-a*s+e*c];
   const faces=[[[1,0,0],[[hw,-hh,-hd],[hw,hh,-hd],[hw,hh,hd],[hw,-hh,hd]]],
    [[-1,0,0],[[-hw,-hh,hd],[-hw,hh,hd],[-hw,hh,-hd],[-hw,-hh,-hd]]],
    [[0,1,0],[[-hw,hh,-hd],[-hw,hh,hd],[hw,hh,hd],[hw,hh,-hd]]],
    [[0,-1,0],[[-hw,-hh,hd],[-hw,-hh,-hd],[hw,-hh,-hd],[hw,-hh,hd]]],
    [[0,0,1],[[hw,-hh,hd],[hw,hh,hd],[-hw,hh,hd],[-hw,-hh,hd]]],
    [[0,0,-1],[[-hw,-hh,-hd],[-hw,hh,-hd],[hw,hh,-hd],[hw,-hh,-hd]]]];
   for(const [nn,verts] of faces){const n=norm([nn[0]*c+nn[2]*s,nn[1],-nn[0]*s+nn[2]*c]);this.quad(...verts.map(v=>p(...v)),n,col);}
 }
 cylinder(x,y,z,r,h,col,seg=18,topR=r){
   this.shapes.push({type:'cylinder',x,y,z,r,h,col});
   for(let i=0;i<seg;i++){
    const a=i*2*PI/seg,b=(i+1)*2*PI/seg;
    const p0=[x+r*Math.cos(a),y-h/2,z+r*Math.sin(a)],p1=[x+r*Math.cos(b),y-h/2,z+r*Math.sin(b)];
    const p2=[x+topR*Math.cos(b),y+h/2,z+topR*Math.sin(b)],p3=[x+topR*Math.cos(a),y+h/2,z+topR*Math.sin(a)];
    const n=norm([Math.cos((a+b)/2),0,Math.sin((a+b)/2)]);
    this.quad(p0,p1,p2,p3,n,col);
    this.tri([x,y+h/2,z],p3,p2,[0,1,0],col);
    this.tri([x,y-h/2,z],p1,p0,[0,-1,0],col);
   }
 }
 sphere(x,y,z,r,col,seg=18,rings=12,scale=[1,1,1]){
  this.shapes.push({type:'sphere',x,y,z,r,col,scale});
  const pt=(theta,phi)=>[x+Math.sin(theta)*Math.cos(phi)*r*scale[0],y+Math.cos(theta)*r*scale[1],z+Math.sin(theta)*Math.sin(phi)*r*scale[2]];
  for(let j=0;j<rings;j++)for(let i=0;i<seg;i++){
    const t=j*PI/rings,t2=(j+1)*PI/rings,ph=i*2*PI/seg,ph2=(i+1)*2*PI/seg;
    const a=pt(t,ph),b=pt(t2,ph),c=pt(t2,ph2),d=pt(t,ph2);
    const n=v=>norm([v[0]-x,v[1]-y,v[2]-z]);
    this.tri(a,b,c,n(a),col);this.tri(a,c,d,n(c),col);
  }
 }
 line(x1,y1,z1,x2,y2,z2,r,col){
  const x=(x1+x2)/2,y=(y1+y2)/2,z=(z1+z2)/2;
  const length=Math.hypot(x2-x1,y2-y1,z2-z1);
  // Decorative vertical or horizontal supports only; create box aligned in X/Z.
  this.box(x,y,z,Math.abs(x2-x1)+r,Math.abs(y2-y1)+r,Math.abs(z2-z1)+r,col);
 }
}
import {ROOMS,WALLS,FURNITURE,COLS,ROWS,ROOM_BY_ID,FLOOR_HEIGHT,canStand,roomAt,advanceActor,INTERACTABLES,OBJECT_BY_ID} from './world-layout.js';
import {advanceGait,gestureProgress} from './motion.js';
import {clampCameraToWalls,wallSeparates} from './camera-occlusion.js';
// The follow camera uses segment-to-wall tests instead of endpoint checks.
function buildWorld(floor=0){
 const g=new Mesh(),Y=floor*FLOOR_HEIGHT;
 const box=(x,y,z,w,h,d,c,rot=0)=>g.box(x,y+Y,z,w,h,d,c,rot);
 const cyl=(x,y,z,r,h,c,segments=22,top)=>g.cylinder(x,y+Y,z,r,h,c,segments,top);
 const ball=(x,y,z,r,c,seg=18,rings=12,scale=[1,1,1])=>g.sphere(x,y+Y,z,r,c,seg,rings,scale);
 const seat=(x,z,c='#d4773e',rotate=false)=>{
  // A consistent local transform keeps all sofa details aligned when rotated.
  const yaw=rotate?PI/2:0,at=(dx,dz)=>rotate?[x+dz,z-dx]:[x+dx,z+dz];
  box(x,.50,z,4.3,.64,1.38,c,yaw);
  box(x,.96,z,4.15,.33,1.28,'#df8556',yaw);
  const back=at(0,-.45);box(back[0],1.23,back[1],4.17,.74,.42,'#c76b43',yaw);
  for(const off of [-1.35,0,1.35]){
   const q=at(off,.22);
   ball(q[0],1.09,q[1],.44,off===0?'#fee1aa':'#a777a7',14,9,[1,.39,.8]);
  }
  // Rolled arms, piping, three individual seat cushions and grounded feet.
  for(const side of [-1,1]){
   const arm=at(side*2.03,-.01);
   box(arm[0],.90,arm[1],.35,.57,1.44,'#ba603e',yaw);
   box(arm[0],1.18,arm[1],.40,.14,1.46,'#eaa778',yaw);
   for(const dz of [-.46,.46]){
    const foot=at(side*1.72,dz);
    box(foot[0],.20,foot[1],.16,.21,.18,'#52443e');
   }
  }
  for(const off of [-.70,.70]){
   const seam=at(off,.20);
   box(seam[0],1.135,seam[1],.023,.010,.83,'#e6a078',yaw);
  }
  const throwPillow=at(-1.53,-.10);
  box(throwPillow[0],1.30,throwPillow[1],.54,.43,.18,'#f3d1b2',yaw+.15);
 };
 const palm=(x,z,scale=1)=>{
  cyl(x,1.58*scale,z,.22*scale,3.0*scale,'#876246',13);
  for(let i=0;i<8;i++){const a=i*PI/4;
   const dx=Math.cos(a),dz=Math.sin(a);
   ball(x+dx*1.1*scale,3.05*scale,z+dz*1.1*scale,1.28*scale,'#42876b',14,8,[1.1,.23,.45]);
  }
 };
 const plant=(x,z)=>{cyl(x,.39,z,.45,.72,'#f8e4d8',13);for(const [dx,dz] of [[.1,.1],[-.3,.12],[.24,-.25]])ball(x+dx,1.08,z+dz,.68,'#357d68',12,8,[.65,1.05,.63]);};
 const spotlight=(x,z)=>{
  cyl(x,3.64,z,.17,.18,'#51354c',12);
  cyl(x,3.54,z,.35,.06,'#fff0b2',14);
 };
 // Sea and sand are visible from the upstairs spectator floor, without
 // exposing the downstairs interior or adding fake background buildings.
 if(floor===1){
  g.box(0,-1.34,2,310,.16,300,'#177c99');
  g.box(0,-1.16,2,115,.065,105,'#2b9eaf');
  g.box(0,-1.10,2,99,.06,89,'#62bfc0');
  g.box(0,-.91,2,91,.36,83,'#ecd199');
  g.box(0,-.66,2,84,.18,76,'#f0dca9');
 }
 if(floor===0){
  // Island world: sea, shallows and sandy shore are the ONLY surrounding geography.
  // Ground outside the collision boundary is scenery, never a road or fake city.
  box(0,-1.34,2,310,.16,300,'#177c99'); // deep water
  box(0,-1.16,2,115,.065,105,'#2b9eaf'); // turquoise lagoon
  box(0,-1.10,2,99,.06,89,'#62bfc0'); // clear nearshore
  box(0,-.91,2,91,.36,83,'#ecd199'); // broad sand shelf
  box(0,-.66,2,84,.18,76,'#f0dca9'); // pale dry sand
  // Break the perfectly rectangular shoreline with sandy headlands.
  for(const x of [-38,38])for(const z of [-31,33])ball(x,-.64,z,6.0,'#edd5a3',21,9,[1,.09,.72]);
  // Scalloped white surf and long, gentle moving ripple bands.
  for(const z of [-38.3,42.1]){
   box(0,-1.055,z,80,.045,.23,'#c9eee1');
   for(let x=-38;x<38;x+=6.5)box(x,-1.01,z+Math.sin(x*.18)*.65,3.6,.035,.10,'#eef6dc');
  }
  for(const x of [-45.4,45.4])box(x,-1.052,2,.21,.035,76,'#c6eadd');
  for(let i=0;i<38;i++){
   const t=i*1.618,xx=Math.sin(t*2.4)*95,zz=Math.cos(t*1.7)*90;
   if(Math.abs(xx)<56&&Math.abs(zz-2)<50)continue;
   box(xx,-1.205,zz,2.5+(i%3),.016,.09,i%3?'#68c7cf':'#a4e1dc');
  }
  // The playable compound sits directly on the island's sand.
  box(0,-.48,2,72,.78,65,'#d9c39a');
  box(0,-.07,17.4,63,.10,25,'#edd5a6');
  box(0,-.02,24,62,.09,10,'#eed9b4');
  for(const x of [-30.7,30.7])for(let z=17;z<29;z+=3.7)plant(x,z);
  // Shorefront railing: preserve collision boundary without a tall visual prison wall.
  for(const x of [-30.9,30.9])for(let z=-24;z<30;z+=6.3){
   cyl(x,0.55,z,.13,1.22,'#faf0da',10);
  }
  for(const z of [-25.7,29.7])for(let x=-30;x<32;x+=6.1)cyl(x,.53,z,.13,1.18,'#faf0da',10);
  // Entrance to the private sandy shoreline and swimming pool.
  box(0,.27,29.7,8,.20,.45,'#c59c70');
 }
 for(const r of ROOMS.filter(r=>r.floor===floor)){
  const outdoor=r.outdoor,baseColor=outdoor?'#eed7ac':(floor===1?'#eadbca':'#e5d2c4');
  box(r.x,.01,r.z,15.75,.20,13.74,baseColor);
  // Large-scale stone tiles, sealed substrate and subtle border.
  if(!outdoor){
   for(let t=-6.3;t<7;t+=2.2)box(r.x+t,.119,r.z,.018,.006,13.1,'#d2c4ba');
   for(let t=-5.5;t<6;t+=2.2)box(r.x,.12,r.z+t,15.1,.006,.018,'#cbbcb5');
  }
  for(const sign of [-1,1])box(r.x,.16,r.z+sign*6.64,15.0,.045,.08,r.color);
  if(!outdoor){for(const x of [r.x-5.6,r.x+5.6])spotlight(x,r.z+4.1);}
 }
 for(const w of WALLS.filter(x=>x.floor===floor)){
  const external=(Math.abs(w.x)>31.8 || Math.abs(w.z)>29.9 || w.z===-26 || (floor===1&&w.z===2));
  const wall=external?'#efdfc9':(floor?'#f1dec7':'#e59976');
  const displayHeight=(floor===0&&external)?1.05:w.h;
  box(w.x,displayHeight/2,w.z,w.w,displayHeight,w.d,wall);
  if(!external){
   if(w.w>w.d){box(w.x,3.81,w.z,w.w,.12,w.d+.04,'#68416d');box(w.x,.35,w.z,w.w,.42,w.d+.03,'#804b7c');}
   else {box(w.x,3.81,w.z,w.w+.04,.12,w.d,'#68416d');box(w.x,.35,w.z,w.w+.04,.42,w.d,'#804b7c');}
  }
 }
 // Passage trims follow exactly the physical door gaps in WALLS.
 for(const x of [-16,0,16])for(const z of (floor===0?ROWS.slice(0,3):ROWS.slice(0,2))){
  box(x,.13,z,.65,.11,4.5,'#f8c782');
  for(const side of [-1,1])box(x,2.1,z+side*2.29,.23,4.1,.23,'#553461');
 }
 for(const z of (floor===0?[-12,2,16]:[-12]))for(const x of COLS){
  box(x,.13,z,4.5,.11,.65,'#e4bd88');
  for(const side of [-1,1])box(x+side*2.33,2.1,z,.23,4.1,.22,'#553461');
 }
 if(floor===0){
  // Hero lounge: contemporary Nigerian reality television editorial palette.
  // One woven statement rug. Muted terracotta and ivory replace a flat
  // fluorescent rectangle while keeping the show's orange-purple identity.
  box(-8,.16,-7,11,.05,8.5,'#8d5874');
  box(-8,.18,-7,9.65,.04,7.1,'#d1a07e');
  for(const side of [-1,1]){
   box(-8+side*4.49,.208,-7,.075,.014,6.85,'#f3dfbb');
   box(-8,.208,-7+side*3.22,9.25,.014,.075,'#f3dfbb');
  }
  // Restrained geometric weaving, flat to the floor with no gameplay collider.
  for(let i=-2;i<=2;i++){
   const xx=-8+i*1.62;
   box(xx,.211,-7,0.84,.014,.84,'#8e6173',PI/4);
   box(xx,.219,-7,0.50,.013,.50,'#efcf9e',PI/4);
   for(const sign of [-1,1]){
    box(xx,.212,-7+sign*1.92,.11,.013,.82,'#ad6a71',PI/6*sign);
   }
  }
  seat(-11,-9.1);seat(-4.4,-8.7,'#de6937',true);
  cyl(-8,.45,-6.9,1.45,.40,'#503550',24);cyl(-8,.70,-6.9,1.15,.08,'#694d65',24);
  ball(-8,.88,-6.9,.37,'#e4a853',14,8,[1,.42,.8]);
  // A supported coffee table: the previous floating tabletop read as a flat disc.
  for(const dx of [-.87,.87])for(const dz of [-.57,.57]){
   box(-8+dx,.24,-6.9+dz,.11,.31,.11,'#493b42');
  }
  cyl(-8,.31,-6.9,.81,.07,'#684c61',20);
  box(-8,.91,-6.9,.43,.08,.32,'#f0d8b5'); // folded book
  box(-7.25,.83,-7.38,.27,.06,.16,'#d7b77c'); // handset
  // Framed focal wall and low media console, all inside the existing room footprint.
  box(-8,2.22,-11.43,6.8,2.85,.12,'#673f71');
  box(-8,2.22,-11.33,6.3,2.4,.08,'#653283');
  box(-8,.68,-11.00,6.1,.36,.49,'#624348');
  box(-8,.90,-10.98,6.15,.07,.53,'#d6af7c');
  for(const dx of [-2.72,-1.36,0,1.36,2.72]){
   box(-8+dx,.66,-10.72,.028,.28,.025,'#d5b594');
  }
  // Tall fluted feature-panel wings bring scale and material contrast to the lounge.
  for(const side of [-1,1]){
   for(let i=0;i<4;i++){
    const xx=-8+side*(3.82+i*.24);
    box(xx,2.24,-11.36,.12,2.78,.10,i%2?'#bb7c58':'#d39b65');
   }
  }
  // Pendant rings and fixed-world lighting forms, not camera-following lights.
  for(const xx of [-12.25,-3.75]){
   box(xx,3.57,-6.60,1.02,.10,1.02,'#503c48');
   box(xx,3.49,-6.60,.74,.035,.74,'#ffdfac');
   box(xx,3.74,-6.60,.045,.45,.045,'#705b60');
  }
  for(let i=0;i<6;i++)box(-10.25+i*.9,2.2,-11.22,.16,1.0+(i%3)*.28,.04,i%2?'#ed973e':'#fec784');
  plant(-14,-2.7);plant(-1.7,-2.7);
  // Kitchen: PBR-like depth from layered cabinet fronts and warm metallic trim.
  box(-27.5,.7,-24.0,7.5,1.2,1.4,'#7e5f61');box(-27.5,1.38,-24,7.7,.12,1.52,'#f7e7da');
  for(let x=-30;x<-23;x+=1.45){box(x,2.22,-25.15,1.19,1.24,.6,'#b78367');box(x,2.18,-24.84,.8,.035,.1,'#e7c184');}
  box(-24,.76,-20,4.85,1.2,2.1,'#9c5c69');box(-24,1.44,-20,5,.16,2.25,'#f2d9c3');
  for(const x of [-26,-22])cyl(x,.72,-18.05,.43,.79,'#684b67');
  box(-29.5,1.58,-22.1,1.65,3.0,1.1,'#c7d7d7');
  // Dining + spa.
  box(-8,.9,-19,5.3,.26,2.7,'#996444');for(const x of [-10.7,-8,-5.3])for(const z of [-16.9,-21.1]){
   box(x,.51,z,1.05,.42,.94,'#a66a89');box(x,1.12,z+(z<-19?-.45:.45),1.08,.84,.2,'#714b72');
  }
  for(const x of [-10,-6])cyl(x,2.85,-19,.6,.21,'#eec57b');
  for(const x of [5.1,10.8]){box(x,.53,-19,2.3,.64,4.8,'#f4eddb');box(x,.87,-19,2.07,.22,4.5,'#aac2c0');}
  plant(13,-23);cyl(8,.57,-15.5,1.1,.9,'#e0b4a3',22);
  // Wardrobe storefront is a functional space even though its dressing zones are private.
  for(const x of [19.3,28.6]){
   box(x,2.20,-19,.17,.12,9.0,'#5e435c');
   for(let n=0;n<8;n++){const z=-22.3+n*.9;box(x,1.53,z,.86,1.1,.22,['#db8d5e','#7b70ad','#e7bd6f','#6b9f8b'][n%4]);}
  }
  box(24,.20,-19,4.5,.045,9.3,'#e2a9ba');box(24,.63,-15.7,2.2,1.1,1.1,'#b37b9b');
  // Games and cinema.
  box(-24,.92,-5,4.9,.80,2.7,'#654878');box(-24,1.32,-5,4.5,.08,2.36,'#3b947b');
  for(const [x,z] of [[-25,-5.6],[-23,-4.9],[-24.4,-4.2]])ball(x,1.5,z,.16,'#f6dc8d',12,6);
  for(let x=-29;x<=-27;x+=1.5){box(x,1.13,-10.0,1.1,2.25,.8,'#543e85');box(x,1.66,-9.57,.87,.76,.05,'#46a0ac');}
  box(8,1.45,-11.5,8,2.55,.10,'#3e3050');box(8,1.45,-11.37,7.3,2.05,.06,'#625596');
  seat(8,-2.8,'#7c5988');
  // Diary room and Afrobeats studio.
  box(8,.18,-5,12,.045,10.6,'#603f7c');
  box(8,.8,-5,2.5,1.3,1.6,'#be8da7');cyl(8,.3,-3,1.1,.22,'#e1ae78');
  for(const x of [-29.0,-19.1]){box(x,1.22,6.2,1.5,2.4,1.15,'#42304b');cyl(x,1.6,5.61,.54,.12,'#906aa3');}
  box(-24,.83,6.3,4.5,.16,1.65,'#7b486e');box(-24,.17,9,8,.045,8,'#8b5a92');
  for(let i=0;i<5;i++)box(-25.5+i*.7,.97,6.4,.35,.05,.21,'#c9afb9');
  // Grand staircase with dramatic banister and landing gate. Movement uses server stairs action.
  for(let n=0;n<8;n++){box(-10,.18+n*.22,12.5-n*.53,3.2,.26,.54,'#c7a47e');}
  for(const x of [-11.5,-8.5])box(x,1.52,10,.10,2.4,4.5,'#745275');
  ball(-8,3.35,8.7,.76,'#ffe2a2',24,12,[.85,1.4,.85]);
  for(const x of [5.4,8.5,11.6])box(x,.5,10.7,1.5,.75,.9,'#5a6e67');
  box(8,.25,5.2,5.8,.15,1.2,'#a08c83');
  for(const x of [20.2,27.3])box(x,2.0,9,1.3,2.8,.17,'#eccab4');
  box(24,.16,8.8,5.5,.04,7.1,'#b582a5');plant(19,13);
  // Outside: a sandy beach, a real swimming pool, palm grove and cabana.
  box(-24,.08,23,13.4,.11,12.0,'#d8c3a2');
  box(-24,.08,23,10.6,.11,8.0,'#f4e6d5');
  box(-24,.10,23,9.85,.13,7.05,'#3384a3');
  box(-24,.177,23,9.35,.055,6.65,'#4cc1d0');
  for(const x of [-29,-19]){box(x,.39,17.6,2.3,.32,.92,'#f3e0c4');box(x,.71,17.3,2.2,.22,.45,'#f8dcc4');}
  for(const x of [-30,30])for(const z of [15.2,25.1])palm(x,z, .85);
  // Private beach: shade umbrellas, beach towels, sun loungers and surfboards.
  for(const [x,z,c] of [[-13,19,'#f2b980'],[-4,26,'#fcf1cd']]){
   cyl(x,1.34,z,.10,2.6,'#b17b55',12);
   cyl(x,2.64,z,2.20,.16,c,24,0.22);
   box(x,0.10,z+2.0,1.05,.04,2.0,'#72cbb7');
  }
  for(const x of [-14,-2])palm(x,19.7,.73);
  for(const [x,z] of [[-11,27],[-5,20]]){
   box(x,.19,z,2.7,.24,1.12,'#d7a678');
   box(x,.36,z,2.4,.15,1.0,'#f5e4c7');
   box(x,.5,z-.55,1.0,.30,.23,'#d18a7d');
  }
  for(const x of [-3,0]){
   box(x,1.23,27.7,.18,2.4,.95,'#f5e9d0',.17);
   box(x,2.0,27.7,.13,1.12,.83,'#54aaa5',.17);
  }
  box(8,.45,27.1,11.0,.62,2.2,'#7a4d74');box(8,.79,27.1,10.5,.13,1.9,'#d99e55');
  for(const x of [4,8,12])cyl(x,.52,21,.65,.45,'#cca476');
  for(const x of [18,30]){box(x,2.62,23,.34,5,.34,'#e9dcc7');}
  box(24,4.25,23,13.0,.35,10.8,'#b67852');
  box(24,.45,23,5.5,.81,3.9,'#e5af79');
  for(const x of [20,28])cyl(x,1.2,18.4,.65,.72,'#b89ba3');
  // V7 island living: meaningful compound amenities, not background roads/buildings.
  // Pool lounge: floating rings, tiled ladder, changing/shower cubicle.
  for(const [x,z,col] of [[-25.5,22,'#e9b681'],[-21.2,24.2,'#f8d9b0']]){
   for(let j=0;j<12;j++){const t=j*2*PI/12;ball(x+Math.cos(t)*.72,.32,z+Math.sin(t)*.72,.20,col,9,6,[1,.52,1]);}
  }
  for(const xx of [-18.75,-18.1]){
   cyl(xx,1.12,22.6,.09,1.8,'#e9e7de',10);
   for(const dz of [-.42,.42])box(xx,.32,22.6+dz,.09,.065,.83,'#f4f0e8');
  }
  box(-18.45,.14,28.1,2.5,.16,2.9,'#e4d8c5');
  cyl(-18.5,1.5,28.1,.10,2.6,'#d0d1d0',10);
  cyl(-18.5,2.83,28.1,.40,.11,'#f7ebd7',13); // outdoor rinse shower
  // Beach: canvas hammock with solid anchor poles and a shaded picnic table.
  for(const xx of [-14.2,-10.8]){
   cyl(xx,1.18,27.0,.13,2.25,'#9d7359',12);
   ball(xx,2.41,27.0,.25,'#d7bd92',12,7);
  }
  box(-12.5,.95,27,3.65,.11,1.3,'#f1cfaa');
  for(const xx of [-13.9,-12.5,-11.1])box(xx,.98,27,1.04,.09,1.18,xx===-12.5?'#f6a67b':'#f8ddb6');
  box(-4.5,.92,19,3.9,.15,2.1,'#b58f69');
  for(const xx of [-5.9,-3.1])for(const zz of [18.3,19.7])cyl(xx,.45,zz,.15,.88,'#9d7557');
  // Beach-game court: real net, side posts, painted boundary and a spectator bench.
  for(const xx of [3.0,13.0]){
   cyl(xx,1.44,22.5,.12,2.85,'#fbf5e5',12);
   cyl(xx,2.82,22.5,.20,.12,'#f5c78c',14);
  }
  for(let y=.92;y<2.66;y+=.32)box(8,y,22.5,9.85,.035,.038,'#f5e8db');
  for(let x=3.7;x<13;x+=.66)box(x,1.72,22.5,.032,1.6,.035,'#f5e8db');
  for(const zz of [18.1,26.8])box(8,.15,zz,10.2,.025,.09,'#fff4d8');
  for(const xx of [2.85,13.2])box(xx,.15,22.5,.08,.025,8.5,'#fff4d8');
  ball(11.5,.40,19.3,.35,'#ffe5ad',15,10);
  // Evening fire circle placed near the corner, keeping the court open.
  cyl(12.7,.30,28.2,1.05,.52,'#5c5d60',18);
  for(let j=0;j<6;j++){const t=j*2*PI/6;cyl(12.7+Math.cos(t)*.75,.35,28.2+Math.sin(t)*.75,.15,.45,'#c9b7a1',9);}
  ball(12.7,.72,28.2,.48,'#ec9157',13,8,[.65,1.5,.6]);
  // Sunset cabana: functional barbecue kitchen and a small juice bar.
  box(29.2,1.05,20.1,2.2,1.5,1.0,'#4f5d5d');
  box(29.2,1.88,20.1,2.3,.13,1.17,'#d8a276');
  for(let j=0;j<5;j++)box(28.35+j*.44,2.05,20.1,.11,.08,.93,'#3d3836');
  box(19.0,.86,27.6,1.35,1.26,3.1,'#9c735a');
  box(19.0,1.51,27.6,1.57,.15,3.26,'#edcb9f');
  for(const zz of [26.6,27.6,28.6]){
   cyl(20.2,1.02,zz,.22,1.22,'#9f6e66',12);
   ball(20.2,1.72,zz,.25,'#ffe5ae',12,7,[1,.7,1]);
  }
  // A surfboard rack by the compound entrance and lanterns for evening ambience.
  for(const [x,z,c] of [[-1.6,28.2,'#d87d89'],[.0,28.2,'#ffe2a9'],[1.6,28.2,'#70cbb5']]){
   box(x,1.12,z,.47,2.17,.13,c,.10);
   ball(x,2.21,z,.28,c,12,8,[.8,.55,.3]);
  }
  for(const [x,z] of [[-30,28],[30,28],[2.5,18],[15,18]]){
   cyl(x,1.38,z,.085,2.55,'#87725e',10);
   ball(x,2.66,z,.28,'#ffeab4',13,8,[1,.8,1]);
  }
 }else{
  // The second storey is physically supported by an opaque downstairs shell.
  // We do not render downstairs rooms from the upstairs spectator camera.
  g.box(0,2.45,-26,64,4.9,.6,'#b48c83');
  g.box(0,2.45,2,64,4.9,.6,'#b48c83');
  for(const x of [-32,32])g.box(x,2.45,-12,.6,4.9,28,'#af867f');
  for(const x of [-25,-9,7,23])for(const z of [-26.33,2.33]){
   g.box(x,2.6,z,3.1,2.1,.1,'#4d6270');
   g.box(x,2.6,z+.08,2.8,1.9,.05,'#839da1');
  }
  box(0,-.14,-12,63.4,.28,28.2,'#c8aa9e');
  for(const [id,col] of [['male-bedroom','#6a80a3'],['female-bedroom','#ce91b4']]){
   const r=ROOM_BY_ID[id],x=r.x;
   box(x,.54,-19,5.7,.71,4.65,'#5a4868');box(x,1.02,-19,5.5,.25,4.4,col);
   box(x,1.19,-20.52,4.7,.20,.79,'#f6e9d6');
   for(const dx of [-1.35,1.35])ball(x+dx,1.26,-20.25,.65,'#eee2d3',16,8,[1,.3,.65]);
   for(const dx of [-3.7,3.7]){box(x+dx,.64,-20.1,.95,1.03,1.1,'#987b73');cyl(x+dx,1.5,-20.1,.38,.53,'#f3d7a2');}
   box(x,.15,-15.6,8,.06,2.2,col);
  }
  for(const x of [-8,24]){for(const dx of [-4,4])box(x+dx,1.7,-22,2.6,3.1,.45,'#aed2d7');
   cyl(x,.53,-18,1.3,1.0,'#e2d5cb');}
  seat(-24,-8.6,'#6489a0');seat(24,-8.6,'#bb7a9e');
  for(let n=0;n<8;n++)box(-8,.16+n*.22,-2.5-n*.51,3.2,.26,.52,'#c7a47e');
  for(const x of [-11,11])cyl(x,.75,-4,1.15,.50,'#c8ad90');
  box(8,.18,-5,11.4,.06,9,'#ba9a9e');
  for(const x of [3,13])plant(x,-9.2);
  for(const x of [4,12]){cyl(x,.43,-1.8,.69,.5,'#7c6483');cyl(x,.70,-1.8,1.0,.13,'#edbc7e');}
 }
 // Game props live at the same coordinates as the interaction registry.
 // Add tactile, recognizable small objects rather than invisible hit boxes.
 for(const o of INTERACTABLES.filter(o=>o.floor===floor)){
  const x=o.x,z=o.z;
  if(o.kind==='remote'){
   box(x,.92,z,.35,.075,.18,'#302e34');
   for(const dx of [-.08,0,.08])ball(x+dx,.967,z,.034,'#c8d8d5',8,4);
  }else if(o.kind==='stereo'){
   box(x,1.42,z,1.0,.66,.39,'#292a35');
   box(x,1.47,z+.2,.68,.36,.035,'#57bda1');
   for(const dx of [-.34,.34])cyl(x+dx,1.44,z+.23,.11,.05,'#e0be8d',12);
  }else if(o.kind==='speaker'){
   box(x,1.4,z,1.15,1.85,.76,'#34344b');
   for(const dy of [1.0,1.72])cyl(x,dy,z+.40,dy===1?.30:.19,.055,'#9874b1',16);
  }else if(o.kind==='mirror'){
   box(x,2.05,z,Math.max(.22,o.w),2.8,.22,'#cba87e');
   box(x,2.05,z+.16,Math.max(.17,o.w-.16),2.53,.035,'#a5d5dd');
  }else if(o.kind==='art'){
   box(x,2.45,z,2.8,2.2,.15,'#e3ba81');
   box(x,2.45,z+.09,2.42,1.89,.04,'#a37ba8');
  }else if(o.kind==='microphone'){
   cyl(x,.85,z,.08,1.7,'#44404e',12);ball(x,1.82,z,.20,'#9a9397',14,8);
  }else if(o.kind==='mixer'){
   box(x,1.07,z,2.85,.22,1.0,'#33313c');
   for(let i=0;i<8;i++)box(x-1.15+i*.32,1.204,z,.20,.035,.42,i%2?'#e2b47a':'#71a6aa');
  }else if(o.kind==='lamp'){
   cyl(x,1.24,z,.09,2.45,'#806775',11);
   ball(x,2.65,z,.36,'#ffe0a1',16,8,[1,.88,1]);
  }else if(o.kind==='projector'){
   box(x,3.43,z,1.25,.48,.75,'#e9ddd0');
   cyl(x,3.41,z+.39,.21,.20,'#5c6570',14);
  }else if(o.kind==='sink'){
   box(x,1.48,z,.92,.08,.68,'#bdcfd1');
   cyl(x,1.75,z-.14,.045,.62,'#c0b6aa',10);
  }else if(o.kind==='stove'){
   for(const dx of [-.44,.44])for(const dz of [-.22,.22])cyl(x+dx,1.41,z+dz,.23,.07,'#2b2a2f',12);
  }else if(o.kind==='board'){
   box(x,.22,z,2.6,.32,.43,'#b38b74');
  }else if(o.kind==='umbrella'){
   cyl(x,1.25,z,.09,2.5,'#ab7b54',12);
   cyl(x,2.48,z,1.5,.14,'#f7c080',24,.14);
  }else if(o.kind==='fridge'){
   for(let yy of [1.3,2.3])box(x+.78,yy,z+.58,.085,.5,.11,'#8899a0');
  }
 }
 return g;
}
function buildPrivacyRoofs(floor=0){
 const mesh=new Mesh(),Y=floor*FLOOR_HEIGHT;
 for(const room of ROOMS.filter(r=>r.floor===floor&&!r.viewable)){
  mesh.box(room.x,Y+4.53,room.z,15.35,.26,13.3,'#765a7b');
  mesh.box(room.x,Y+4.69,room.z,12.8,.05,10.8,'#93769d');
 }
 return mesh;
}
function buildCeilings(floor=0){
 const g=new Mesh(),Y=floor*FLOOR_HEIGHT;
 for(const r of ROOMS.filter(r=>r.floor===floor&&!r.outdoor)){
  g.box(r.x,Y+4.37,r.z,15.2,.24,13.0,r.id==='lounge'?'#d3b6d2':'#ead5c5');
  g.box(r.x,Y+4.2,r.z,13.2,.12,11.2,'#f3dfcf');
  for(const x of [r.x-3,r.x+3]){
   g.box(x,Y+3.9,r.z,4.2,.16,2.6,'#513957');
   g.box(x,Y+3.78,r.z,4.0,.085,2.42,'#edb77c');
   for(const z of [r.z-1.13,r.z+1.13])g.box(x,Y+3.71,z,3.75,.065,.10,'#fff6d4');
   for(const xx of [x-1.85,x+1.85])g.box(xx,Y+3.71,r.z,.10,.065,2.25,'#fff6d4');
  }
  for(const dz of [-6.15,6.15])g.box(r.x,Y+4.04,r.z+dz,14.0,.08,.12,r.id==='lounge'?'#a956dc':'#bb8ca7');
 }
 return g;
}
/** Lightweight real-time reactions to the server-authoritative appliances.
 * Uses the same dynamic mesh for WebGL2 and 2D compatibility mode. */
function addDeviceVisuals(mesh,devices,roomLights,floor,time,selectedId,hoveredId=null){
 for(const d of Object.values(devices||{})){
  const room=ROOM_BY_ID[d.room];if(!room||room.floor!==floor)continue;
  const y=floor*FLOOR_HEIGHT;
  if(d.kind==='tv'){
   const isCinema=d.id==='cinema-screen',x=isCinema?8:-8,z=isCinema?-11.37:-11.20;
   const w=isCinema?7.2:5.8,h=isCinema?1.9:2.12;
   if(d.powered){
    const colors=['#52779a','#915e94','#cc8669'];
    mesh.box(x,1.95+y,z,w,h,.065,colors[d.channel%3]);
    mesh.box(x,2.11+y,z+.04,w*.54,.30,.078,'#f8d5a0');
    for(let i=0;i<5;i++)mesh.box(x-w*.33+i*w*.16,1.58+y,z+.045,w*.11,.12,.081,'#ead0d0');
   }else mesh.box(x,1.97+y,z,w,h,.055,'#2a2c39');
  }else if(d.kind==='stereo'&&d.powered){
   for(let i=0;i<7;i++){
    const h=.25+.72*Math.abs(Math.sin(time*4.7+i*1.7));
    mesh.box(-24-1.20+i*.38,1.18+y+h/2,7.12,.23,h,.07,i%2?'#f3b36e':'#7fd7c7');
   }
  }
 }
 // Clearly readable lights state with restrained fixture colors; no camera-relative flicker.
 for(const o of INTERACTABLES.filter(v=>v.kind==='lamp'&&v.floor===floor)){
  const on=roomLights?.[o.room]!==false;
  mesh.sphere(o.x,2.65+floor*FLOOR_HEIGHT,o.z,.28,on?'#fff1bd':'#695e67',12,8,[1,.65,1]);
 }
 // Show a quieter highlight on pointer hover, and keep selected-object emphasis.
 const indicatorId=selectedId||hoveredId;
 if(indicatorId){
  const o=OBJECT_BY_ID[indicatorId];
  if(o&&o.floor===floor){
   const r=Math.max(.63,Math.min(2.5,Math.max(o.w,o.d)/2));
   const pulse=1+.05*Math.sin(time*4),isSelected=indicatorId===selectedId;
   // Four understated corners instead of a huge on-screen highlight or persistent HUD.
   for(const angle of [0,PI/2,PI,3*PI/2]){
    mesh.sphere(o.x+Math.cos(angle)*r*pulse,.20+floor*FLOOR_HEIGHT,o.z+Math.sin(angle)*r*pulse,isSelected?.09:.066,isSelected?'#f0d4a0':'#d5edd8',8,4,[1,.32,1]);
   }
  }
 }
}
const skins=['#f0bc96','#cf936f','#a76b4c','#784832','#513324','#31221c'];
function addCharacter(m,a,items,time,players=[]){
 // Distinct stylized human avatars. Animated gait follows replicated real-player motion.
 const object=a.objectId?OBJECT_BY_ID[a.objectId]:null;
 const partner=a.socialAnimation?.partnerId?players.find(p=>p.id===a.socialAnimation.partnerId):null;
 const socialKind=partner&&a.socialAnimation?.until>Date.now()?a.socialAnimation.kind:null;
 const socialWeight=socialKind?gestureProgress(a.socialAnimation,Date.now()):0;
 const resting=Boolean(object&&['sitting','lying','sleeping','cuddling'].includes(a.pose));
 let x=a.x,z=a.z,angle=a.angle||0,lift=0;
 if(socialKind&&partner){angle=Math.atan2(partner.x-a.x,partner.z-a.z);if(socialKind==='hug'){x+=(partner.x-a.x)*.08*socialWeight;z+=(partner.z-a.z)*.08*socialWeight;}}
 if(resting){
  // Occupants render at seat/bed anchors. Their authoritative movement positions
  // remain just outside furniture, so movement collision stays deterministic.
  const index=Number(a.seatIndex)||0;
  const spread=object.kind==='sofa'?.84:object.kind==='bed'?.83:.26;
  x=object.x+(index===0?-spread:spread);
  z=object.z+(object.kind==='sofa'?.12:0);
  angle=0;
  lift=['lying','sleeping'].includes(a.pose)?object.kind==='bed'?.57:.43:.1;
 }

 const outfit=items?.find(it=>it.id===a.outfit)||{color:'#ed9b53',accent:'#f3e1ca'};
 const skin=skins[a.skin]||skins[3],c=outfit.color,secondary=outfit.accent||'#f3ca9b';
 const activity=String(a.activity||'').toLowerCase();
 const gesture=a.gestureUntil>Date.now()?a.gesture:'';
 const reaching=['remote','reaching','inspecting','styling','admiring','watering'].includes(gesture);
 const gestureWave=reaching?Math.sin(Math.min(1,(Date.now()-(a.gestureStarted||0))/380)*PI)*.8:0;
 const actionPose=String(a.pose||'');
 const actionAge=Math.max(0,(Date.now()-(a.poseStarted||Date.now()))/1000);
 const settle=clamp(actionAge/.34,0,1);
 const working=['cooking','cleaning','washing','watering','speaking','singing','styling','showering','bathing','drinking','gaming'].includes(actionPose);
 const taskWave=working?Math.sin(time*(actionPose==='gaming'?8:4.1))*.18:0;

 const dancing=a.emote==='dance'||socialKind==='dance'||actionPose==='dancing'||/dance|freestyle|runway|skit|viral|party/.test(activity);
 const training=['exercising','stretching','swimming','surfing','playing'].includes(actionPose)||/workout|hiit|train|swim|lap/.test(activity);
 const sitting=['sitting','watching','cuddling','eating','gaming','relaxing','meditating'].includes(a.pose)||/sleep|movie|watch|chess|relax|spa|self-care|tea party/.test(activity);
 const lying=['lying','sleeping'].includes(a.pose);
 const waving=a.emote==='wave'||a.emote==='cheer'||/grand entrance|victory speech|campaign/.test(activity);
 const gaitWeight=a.gaitWeight??(a.walking?1:0);
 const walk=Math.sin(a.gaitPhase??time*8.8)*.26*gaitWeight+(training?Math.sin(time*7)*.05:0);
 const bob=training?Math.abs(Math.sin(time*8))*.10:dancing?Math.sin(time*7)*.075:sitting?-.30*settle:Math.abs(Math.sin(a.gaitPhase??time*9))*.045*gaitWeight;
 const yaw=angle;
 function p(dx,y,dz){const sway=dancing?Math.sin(time*6)*.05:0;return [x+dx*Math.cos(yaw)+dz*Math.sin(yaw)+sway,y+(y>.75?bob:0)+lift,z-dx*Math.sin(yaw)+dz*Math.cos(yaw)];}
 function box(dx,y,dz,w,h,d,col,rot=0){const q=p(dx,y,dz);m.box(...q,w,h,d,col,rot+yaw);}
 function sph(dx,y,dz,r,col,scale,seg=11){const q=p(dx,y,dz);m.sphere(...q,r,col,seg,8,scale||[1,1,1]);}
 function cyl(dx,y,dz,r,h,col){const q=p(dx,y,dz);m.cylinder(...q,r,h,col,12);}
 m.sphere(x,.065+lift,z,.48,'#856782',15,3,[1,.04,.65]);
 if(lying){
  // Horizontal resting silhouette. Objects are selected in world space; pose is replicated.
  for(const side of [-1,1]){sph(side*.24,.40,.83,.22,secondary,[.84,.62,1.6]);box(side*.24,.24,1.28,.32,.19,.52,'#fff3e6');}
  sph(0,.44,-.03,.55,c,[.97,.55,1.55]);sph(0,.48,-.66,.38,skin,[1,.85,.9]);
  sph(0,.59,-.82,.35,'#27212b',[1,.30,.88]);return;
 }
 // Angular hips with more organic shaped trousers/leggings and footwear.
 sph(0,.89,0,.48,secondary,[1,.54,.62]);
 for(const side of [-1,1]){
  const step=dancing?Math.sin(time*9+side*3)*.24:actionPose==='swimming'?Math.sin(time*5+side*PI)*.30:walk*side;
  sph(side*.23,sitting?.48:.62,sitting?.28:step*.20,.24,secondary,[.76,sitting?.85:1.38,sitting?1.5:.9]);
  cyl(side*.23,sitting?.29:.31,sitting?.56:step*.33,.155,sitting?.30:.44,secondary);
  box(side*.23,.11,(sitting?.84:.18+step*.40),.36,.19,.59,'#fff3e6');
  box(side*.23,.13,.42+step*.40,.27,.06,.15,'#e7bc92');
 }
 // Torso, shoulders, contrasting collar/graphic detail, sleeves and hands.
 sph(0,1.32,0,.56,c,[1.02,1.0,.69]);
 sph(0,1.07,.02,.44,c,[1,.55,.7]);
 sph(0,1.64,.10,.38,secondary,[1,.13,.70]);
 box(0,1.25,.36,.39,.12,.065,secondary);
 for(const side of [-1,1]){
  const swing=dancing?Math.sin(time*7+side*3)*.21:working?taskWave*(side===1?1:-1):walk*-side;
  const lift=socialKind==='highfive'&&side===1?.82*socialWeight:socialKind==='hug'?.43*socialWeight:waving&&side===1?.48:reaching&&side===1?gestureWave*.52:working&&side===1?.26+taskWave:dancing?.19+Math.abs(Math.sin(time*6+side))*.15:training?.14: /cook|serve|record|set the table/i.test(activity)&&side===1?.17:0;
  sph(side*.59,1.41+lift*.25,0,.24,c,[.75,1,.85]);
  sph(side*.60,1.03+lift+swing*.21,stepFrom(side,walk)*.16,.17,skin,[.85,1.45,.9]);
  sph(side*.61,.78+lift+swing*.24,.04,.145,skin);
 }
 // Tiny held props make actions readable even with the low-poly avatar fallback.
 if((gesture==='remote'||actionPose==='watching')&&!lying){box(.63,1.30+gestureWave*.3,.14,.10,.20,.21,'#2f3f4d');}
 if(['drinking','eating'].includes(actionPose)){
  cyl(.6,1.17+taskWave,.32,.12,.23,actionPose==='drinking'?'#ecd1a2':'#f8e7d3');
 }
 if(['singing','speaking'].includes(actionPose)){
  cyl(.62,1.26+taskWave,.25,.055,.36,'#44404c');sph(.62,1.44+taskWave,.25,.12,'#a8a1a8');
 }
 if(['cooking','washing','cleaning'].includes(actionPose)){
  box(.55,1.02+taskWave,.40,.44,.10,.38,'#b6bec3');
 }
 if(actionPose==='watering')cyl(.63,.95+taskWave,.27,.17,.3,'#66aa8f');
 if(['playing','volleyball'].includes(actionPose))sph(.55,1.14+Math.abs(Math.sin(time*4))*.15,.44,.21,'#d6ba82');

 cyl(0,1.8,0,.16,.23,skin);
 sph(0,2.18,0,.375,skin,[.93,1.13,.87]);
 // Ears, nose, eyes, brows and a subtle smile, all oriented to the front.
 for(const side of [-1,1]){
  sph(side*.34,2.18,0,.085,skin);
  sph(side*.14,2.24,.324,.063,'#fffbf1',[.91,.68,.42]);
  sph(side*.14,2.24,.363,.034,'#242023');
  box(side*.14,2.33,.33,.13,.032,.025,'#312323');
 }
 sph(0,2.08,.36,.064,skin,[.65,1.1,.70]);
 box(0,1.976,.345,.18,.035,.030,'#9f5e5f');
 // Hair is editable and tuned for a readable silhouette from third-person distance.
 if(a.hair===0){sph(0,2.52,-.03,.37,'#292429',[1,.40,.96]);}
 else if(a.hair===1){
  sph(0,2.53,-.07,.42,'#221e25',[1.04,.48,1.04]);
  for(let j=0;j<9;j++){const t=j*PI*2/9;sph(Math.cos(t)*.27,2.68,Math.sin(t)*.27,.14,'#27212b');}
 }else if(a.hair===2){
  sph(0,2.53,-.05,.43,'#28212c',[1,.44,1]);
  for(let side of [-1,1])for(let j=0;j<3;j++)box(side*(.28+.06*j),2.08,-.13+j*.11,.11,.78,.10,'#241e27');
 }else{
  sph(0,2.55,-.05,.46,secondary,[1.06,.42,1.02]);
  box(0,2.79,-.02,.42,.23,.39,c);
  sph(0,2.90,-.03,.22,secondary,[1,.44,1]);
 }
 if(a.emote==='cheer')sph(0,2.97,0,.16,'#f5c666');
}
function stepFrom(side,walk){return side*walk;}
function compile(gl,type,source){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader;}
export class HouseScene{
 constructor(canvas,{forceCanvas2D=false}={}){
  this.canvas=canvas;
  this.gl=forceCanvas2D?null:canvas.getContext('webgl2',{antialias:true,alpha:false,powerPreference:'low-power'});
  if(!this.gl){
   // 2D rasterizer fallback renders the same 3D triangle meshes with depth sorting.
   // This means low-spec browsers can still enter the world when WebGL2 is unavailable.
   this.ctx=canvas.getContext('2d');this.available=Boolean(this.ctx);
   this.staticCpu=[buildWorld(0).shapes,buildWorld(1).shapes];this.roofCpu=[buildCeilings(0).shapes,buildCeilings(1).shapes];this.privacyCpu=[buildPrivacyRoofs(0).shapes,buildPrivacyRoofs(1).shapes];this.camera={eye:[-3,2.85,.3],target:[-8,1.4,-7]};
   this.view=lookAt(this.camera.eye,this.camera.target);this.proj=perspective(.9,1,.1,330);
   this.cameraMode='lower';this.targetActor=null;this.room='lounge';this.viewFloor=0;this.zoom=1;this.orbit=0;this.heading=Math.PI;this.pitch=.42;this.cameraSnap=true;this.lastCameraTime=0;this.items=[];this.devices={};this.roomLights={};this.selectedObject=null;this.hoveredObject=null;this.actors=[];this.actorTracks=new Map();this.gaitStates=new Map();this.localActorId=null;this.fps=0;this.frames=0;this.lastFps=performance.now();this.lastFallback=0;this.width=1;this.height=1;
   return;
  }
  const gl=this.gl;this.available=true;
  const vs=`#version 300 es
precision highp float;
in vec3 aPos;in vec3 aNormal;in vec3 aColor;
uniform mat4 uProj;uniform mat4 uView; uniform float uTime;
out vec3 vColor;out vec3 vNormal;out vec3 vEye;out float vDepth;out float vGround;out vec3 vWorld;out float vOcean;
void main(){
 vec3 worldPos=aPos;
 vOcean=float(aPos.y < -1.14 && aNormal.y > .90);
 if(vOcean > .5)worldPos.y += .055*sin(aPos.x*.24 + uTime*1.16)*cos(aPos.z*.16 + uTime*.82);
 vWorld=worldPos;
 vec4 viewPos=uView*vec4(worldPos,1.0);
 vEye=-viewPos.xyz;vDepth=-viewPos.z;
 vNormal=normalize(aNormal);
 vColor=aColor;
 vGround=smoothstep(0.0,0.72,mod(aPos.y,5.2));
 gl_Position=uProj*viewPos;
}`;
  const fs=`#version 300 es
precision highp float;
in vec3 vColor;in vec3 vNormal;in vec3 vEye;in float vDepth;in float vGround;in vec3 vWorld;in float vOcean;uniform float uTime;uniform vec3 uEyePosition;
out vec4 frag;
void main(){
 vec3 normal=normalize(vNormal);
 vec3 key=normalize(vec3(-0.42,0.87,0.48));
 vec3 fill=normalize(vec3(0.63,0.34,-0.5));
 float diff=max(dot(normal,key),0.0);
 float bounce=max(dot(normal,fill),0.0);
 vec3 viewDir=normalize(uEyePosition-vWorld);
 float spec=pow(max(dot(normal,normalize(key+viewDir)),0.0),32.0);
 float roughness=0.43;
 float ambientOcclusion=mix(0.85,1.0,vGround);
 vec3 tone=vColor*(0.62+0.45*diff+0.12*bounce)*ambientOcclusion + vec3(0.96,0.83,0.71)*spec*(0.1+0.14*(1.0-roughness));
 if(vOcean>.5){
  float wave=sin(vWorld.x*.31+uTime*1.3)*cos(vWorld.z*.24-uTime*.72);
  float sparkle=pow(max(0.,sin(vWorld.x*.32+uTime*.25)*cos(vWorld.z*.25+uTime*.18)),24.);
  tone+=vec3(.018,.06,.08)*wave+vec3(.06,.08,.06)*sparkle;
 }
 float fog=clamp((vDepth-88.0)/128.0,0.0,0.29);
 tone=mix(tone,vec3(0.76,0.72,0.77),fog);
 tone=pow(max(tone,vec3(0.0)),vec3(0.94));
 frag=vec4(tone,1.0);
}`;
  this.program=gl.createProgram();gl.attachShader(this.program,compile(gl,gl.VERTEX_SHADER,vs));gl.attachShader(this.program,compile(gl,gl.FRAGMENT_SHADER,fs));gl.linkProgram(this.program);
  if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));
  this.aPos=gl.getAttribLocation(this.program,'aPos');this.aNormal=gl.getAttribLocation(this.program,'aNormal');this.aColor=gl.getAttribLocation(this.program,'aColor');
  this.uProj=gl.getUniformLocation(this.program,'uProj');this.uView=gl.getUniformLocation(this.program,'uView');this.uTime=gl.getUniformLocation(this.program,'uTime');this.uEyePosition=gl.getUniformLocation(this.program,'uEyePosition');
  this.staticMesh=[this.toBuffer(buildWorld(0),gl.STATIC_DRAW),this.toBuffer(buildWorld(1),gl.STATIC_DRAW)];
  this.roofMesh=[this.toBuffer(buildCeilings(0),gl.STATIC_DRAW),this.toBuffer(buildCeilings(1),gl.STATIC_DRAW)];
  this.privacyMesh=[this.toBuffer(buildPrivacyRoofs(0),gl.STATIC_DRAW),this.toBuffer(buildPrivacyRoofs(1),gl.STATIC_DRAW)];
  this.dynamicMesh=this.toBuffer(new Mesh(),gl.DYNAMIC_DRAW);
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);
  this.camera={eye:[-3,2.85,.3],target:[-8,1.4,-7]};this.view=lookAt(this.camera.eye,this.camera.target);this.proj=perspective(.9,1,.1,330);
  this.cameraMode='lower';this.targetActor=null;this.room='lounge';this.viewFloor=0;this.zoom=1;this.orbit=0;this.heading=Math.PI;this.pitch=.42;this.cameraSnap=true;this.lastCameraTime=0;
  this.items=[];this.devices={};this.roomLights={};this.selectedObject=null;this.hoveredObject=null;this.actors=[];this.actorTracks=new Map();this.gaitStates=new Map();this.localActorId=null;this.fps=0;this.frames=0;this.lastFps=performance.now();this.width=1;this.height=1;
 }
 toBuffer(mesh,usage){const gl=this.gl,vao=gl.createVertexArray(),buffer=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(mesh.data),usage);
  for(const [idx,attr] of [[this.aPos,0],[this.aNormal,12],[this.aColor,24]]){gl.enableVertexAttribArray(idx);gl.vertexAttribPointer(idx,3,gl.FLOAT,false,36,attr);}
  gl.bindVertexArray(null);return {vao,buffer,count:mesh.data.length/9};
 }
 updateDynamic(mesh){const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,this.dynamicMesh.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(mesh.data),gl.DYNAMIC_DRAW);this.dynamicMesh.count=mesh.data.length/9;}
 setMode(mode){this.cameraMode=mode;this.orbit=0;this.cameraSnap=true;}
 moveVector(lateral,forward){const yaw=this.heading+this.orbit;return [forward*Math.sin(yaw)+lateral*Math.cos(yaw),forward*Math.cos(yaw)-lateral*Math.sin(yaw)];}
 resize(){const c=this.canvas,w=Math.max(1,c.clientWidth),h=Math.max(1,c.clientHeight),dpr=Math.min(devicePixelRatio||1,innerWidth<750?1.4:1.65);
  const pw=Math.floor(w*dpr),ph=Math.floor(h*dpr);if(c.width!==pw||c.height!==ph){c.width=pw;c.height=ph;if(this.gl)this.gl.viewport(0,0,pw,ph);}this.width=w;this.height=h;
 }
 /** Every network packet updates animation targets, never renderer transforms directly.
  * This gives 60/30fps interpolation between the server's 150ms broadcasts. */
 /** Client prediction only applies to this device's own avatar. The authoritative
  * server still rejects movement through walls, furniture and other players. */
 predictActor(id,dx,dz,dt){
  if(id!==this.localActorId)return false;
  const track=this.actorTracks.get(id);if(!track)return false;
  const now=performance.now();
  const t=clamp((now-track.receivedAt)/155,0,1);
  const actor={id,x:mix(track.fromX,track.toX,t),z:mix(track.fromZ,track.toZ,t),angle:track.toAngle,walking:true,floor:track.floor||0,wing:track.wing||'male'};
  const others=this.actors.filter(a=>a.id!==id);
  if(!advanceActor(actor,dx,dz,dt,others))return false;
  this.actorTracks.set(id,{...track,fromX:actor.x,fromZ:actor.z,toX:actor.x,toZ:actor.z,fromAngle:actor.angle,toAngle:actor.angle,walking:true,predicted:true,lastPredict:now,receivedAt:now});
  this.animateActors(now);return true;
 }
 /** Remote avatars interpolate between 150 ms snapshots; the local avatar uses
  * immediate collision-aware prediction with gradual server reconciliation. */
 setActors(actors){
  const now=performance.now();
  const valid=new Set();
  for(const a of actors){
   if(!Number.isFinite(a.x)||!Number.isFinite(a.z))continue;
   valid.add(a.id);
   const old=this.actorTracks.get(a.id);
   if(old&&((old.floor??0)!==(a.floor??0)||Math.hypot(old.toX-a.x,old.toZ-a.z)>6)){
     this.actorTracks.set(a.id,{...a,fromX:a.x,fromZ:a.z,fromAngle:a.angle,toX:a.x,toZ:a.z,toAngle:a.angle,receivedAt:now});
   }else if(old){
     const t=clamp((now-old.receivedAt)/155,0,1);
     let currentX=mix(old.fromX,old.toX,t),currentZ=mix(old.fromZ,old.toZ,t);
     const difference=Math.atan2(Math.sin(old.toAngle-old.fromAngle),Math.cos(old.toAngle-old.fromAngle));
     let currentAngle=old.fromAngle+difference*t;
     if(a.id===this.localActorId&&old.predicted){
       const err=Math.hypot(a.x-currentX,a.z-currentZ);
       const correction=err>1.2?1:now-(old.lastPredict||0)<240?.09:.26;
       currentX=mix(currentX,a.x,correction);currentZ=mix(currentZ,a.z,correction);
       currentAngle=mix(currentAngle,a.angle,correction);
       this.actorTracks.set(a.id,{...a,fromX:currentX,fromZ:currentZ,fromAngle:currentAngle,toX:currentX,toZ:currentZ,toAngle:currentAngle,predicted:true,lastPredict:old.lastPredict,receivedAt:now});
     }else this.actorTracks.set(a.id,{...a,fromX:currentX,fromZ:currentZ,fromAngle:currentAngle,toX:a.x,toZ:a.z,toAngle:a.angle,receivedAt:now});
   }else this.actorTracks.set(a.id,{...a,fromX:a.x,fromZ:a.z,fromAngle:a.angle,toX:a.x,toZ:a.z,toAngle:a.angle,receivedAt:now});
  }
  for(const id of this.actorTracks.keys())if(!valid.has(id)){this.actorTracks.delete(id);this.gaitStates.delete(id);}
  this.animateActors(now);
 }
 animateActors(now){
  // Compatibility paths and geometry tests can instantiate without the constructor.
  if(!this.gaitStates)this.gaitStates=new Map();
  this.actors=[...this.actorTracks.values()].map(track=>{
   const t=clamp((now-track.receivedAt)/155,0,1),difference=Math.atan2(Math.sin(track.toAngle-track.fromAngle),Math.cos(track.toAngle-track.fromAngle));
   const actor={...track,x:mix(track.fromX,track.toX,t),z:mix(track.fromZ,track.toZ,t),angle:track.fromAngle+difference*t};
    const gait=advanceGait(this.gaitStates.get(track.id),actor,now);
    this.gaitStates.set(track.id,gait);
    return {...actor,gaitWeight:gait.weight,gaitPhase:gait.phase};
  });
 }
 cameraFor(time){
  const target=this.actors.find(a=>a.id===this.targetActor&&!a.hidden);
  const room=ROOM_BY_ID[this.room]||ROOM_BY_ID.lounge;
  const isPlayer=['follow','firstperson','orbit','shoulder','topdown'].includes(this.cameraMode);
  const a=target||{x:room.x,z:room.z,angle:PI,floor:room.floor||0,wing:'male'};
  let floor=(isPlayer&&target)?a.floor:(this.cameraMode==='upper'?1:this.cameraMode==='lower'?0:room.floor);
  if(this.cameraMode==='director'){
   const publicRooms=ROOMS.filter(r=>r.viewable);
   const r=publicRooms[Math.floor(time/12)%publicRooms.length];this.room=r.id;floor=r.floor;
  }
  floor=floor||0;this.viewFloor=floor;
  const base=floor*FLOOR_HEIGHT;
  let eye,to;
  this.cameraHidesTarget=this.cameraMode==='firstperson';
  if(isPlayer&&target){
   // Rotate the view without changing the character's walking direction.
   const yaw=this.heading+this.orbit;
   if(this.cameraMode==='firstperson'){
    eye=[a.x,base+1.89,a.z];to=[a.x+Math.sin(yaw)*7,base+1.84,a.z+Math.cos(yaw)*7];
   }else if(this.cameraMode==='topdown'){
    eye=[a.x+2,base+13*this.zoom,a.z+1.8];to=[a.x,base+.8,a.z];
   }else{
    const phoneFollow=this.width<650&&this.cameraMode==='follow';
    const d=(this.cameraMode==='shoulder'?3.6:this.cameraMode==='orbit'?5.4:5.5)*(phoneFollow?1.22:1)*this.zoom;
    const sx=this.cameraMode==='shoulder'?.95:phoneFollow?.38:.55;
    const desired={x:a.x-Math.sin(yaw)*d+Math.cos(yaw)*sx,
                   z:a.z-Math.cos(yaw)*d-Math.sin(yaw)*sx};
    // The entire eye-to-player segment must stay clear. The old code only
    // checked the endpoint and could put an opaque wall between both.
    const visible=clampCameraToWalls(a,desired,WALLS,floor);
    const clearance=clamp((visible.distance-1.25)/.95,0,1);
    // As the camera arm shortens, rise slightly ABOVE seat backs rather than
    // dropping into them. Keep the eye below the room's ceiling.
    // Preserve PR #5 structural wall collision and emergency camera lift,
    // while supporting bounded up/down drag in follow, shoulder and orbit modes.
    const pitchLift=this.cameraMode==='orbit'?clamp(this.pitch,-.35,.50):clamp(this.pitch*.45,-.20,.35);
    eye=[visible.x,base+3.55-.30*clearance+pitchLift,visible.z];
    const lookAhead=phoneFollow?1.80:1.15;
    to=[a.x+Math.sin(yaw)*lookAhead,base+1.25,a.z+Math.cos(yaw)*lookAhead];
    // At a wall, temporarily use a near-eye camera rather than drawing the
    // avatar as disjoint shapes through opaque geometry.
    this.cameraHidesTarget=visible.distance<1.85;
   }
  }else if(this.cameraMode==='upper'||this.cameraMode==='lower'){
   eye=[36*Math.sin(.55+this.orbit),base+57*this.zoom,43*Math.cos(.55+this.orbit)+(floor===0?7:-12)];
   to=[0,base,floor===0?2:-12];
  }else{
   const r=ROOM_BY_ID[this.room]||room;
   eye=[r.x+4.65*Math.sin(.9+this.orbit),base+2.83,r.z+5.4*Math.cos(.9+this.orbit)];
   to=[r.x,base+1.35,r.z-1.4];
  }
  if(['room','director'].includes(this.cameraMode))eye=eye.map((v,i)=>mix(to[i],v,clamp(this.zoom,.6,1.15)));
  if(this.cameraMode==='firstperson'){this.camera.eye=eye;this.camera.target=to;}
  else{
   const delta=clamp(time-(this.lastCameraTime||time),0,.07);
   const alpha=this.cameraSnap&&(!isPlayer||target)?1:1-Math.exp(-8.5*Math.max(.01,delta));
   this.camera.eye=this.camera.eye.map((v,i)=>mix(v,eye[i],alpha));
   this.camera.target=this.camera.target.map((v,i)=>mix(v,to[i],alpha));
   if(this.cameraSnap&&(!isPlayer||target))this.cameraSnap=false;
  }
  // Smoothing between two clear eye targets can cross a wall. Correct
  // the interpolated position, not just the intended camera destination.
  if(isPlayer&&target&&!['firstperson','topdown'].includes(this.cameraMode)){
   const actual=clampCameraToWalls(target,{x:this.camera.eye[0],z:this.camera.eye[2]},WALLS,floor);
   if(actual.blocked){this.camera.eye[0]=actual.x;this.camera.eye[2]=actual.z;}
   if(Math.hypot(this.camera.eye[0]-target.x,this.camera.eye[2]-target.z)<1.85)
    this.cameraHidesTarget=true;
  }
  this.lastCameraTime=time;
  this.view=lookAt(this.camera.eye,this.camera.target);
  this.proj=['upper','lower','topdown'].includes(this.cameraMode)?orthographic((this.cameraMode==='topdown'?30:104)*this.zoom,this.width/this.height,.1,260):perspective(this.cameraMode==='firstperson'?1.12:this.cameraMode==='room'?1.04:this.width<650?1.30:1.08,this.width/this.height,.1,260);
 }
 actorVisible(actor,floor){
  if(actor.floor!==floor||actor.hidden)return false;
  if(actor.id===this.targetActor&&this.cameraHidesTarget)return false;
  // Canvas2D has no depth buffer. Do not render dismembered silhouettes
  // through architectural walls; overhead views remain unrestricted.
  if(['follow','shoulder','orbit','firstperson','room','director'].includes(this.cameraMode)
     &&wallSeparates({x:this.camera.eye[0],z:this.camera.eye[2]},actor,WALLS,floor))return false;
  return true;
 }
 frame(time){if(!this.available)return;this.resize();this.animateActors(performance.now());this.cameraFor(time);
  if(!this.gl){this.fallbackFrame(time);return;}const gl=this.gl;
  const floor=this.viewFloor;
  let mesh=new Mesh();addDeviceVisuals(mesh,this.devices,this.roomLights,floor,time,this.selectedObject,this.hoveredObject);for(const a of this.actors.filter(a=>this.actorVisible(a,floor))){
    const piece=new Mesh();addCharacter(piece,a,this.items,time,this.actors);
    const water=a.room==='pool'&&Math.abs(a.x+24)<5&&Math.abs(a.z-23)<3.6?-.55:0;const offset=(a.floor||0)*FLOOR_HEIGHT+water;
    for(let i=1;i<piece.data.length;i+=9)piece.data[i]+=offset;
    for(const shape of piece.shapes)shape.y+=offset;
    mesh.data.push(...piece.data);mesh.shapes.push(...piece.shapes);
  }
  this.updateDynamic(mesh);
  gl.clearColor(.66,.83,.86,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  gl.useProgram(this.program);
  gl.uniformMatrix4fv(this.uProj,false,new Float32Array(this.proj));gl.uniformMatrix4fv(this.uView,false,new Float32Array(this.view));gl.uniform1f(this.uTime,time);gl.uniform3fv(this.uEyePosition,new Float32Array(this.camera.eye));
  const objects=[this.staticMesh[floor],...(['room','follow','firstperson','orbit','shoulder','director'].includes(this.cameraMode)?[this.roofMesh[floor]]:[]),...(['lower','upper','topdown'].includes(this.cameraMode)?[this.privacyMesh[floor]]:[]),this.dynamicMesh];
  for(const m of objects){gl.bindVertexArray(m.vao);gl.drawArrays(gl.TRIANGLES,0,m.count);}
  gl.bindVertexArray(null);
  this.frames++;if(performance.now()-this.lastFps>1100){this.fps=Math.round(this.frames*1000/(performance.now()-this.lastFps));this.frames=0;this.lastFps=performance.now();}
 }
 fallbackFrame(time){
  // Software projection of shape primitives. Intentionally low-complexity:
  // keeps this game usable on browsers where WebGL2 is disabled.
  if(performance.now()-this.lastFallback<66)return;
  const ctx=this.ctx,w=this.canvas.width,h=this.canvas.height;
  this.lastFallback=performance.now();
  const dynamic=new Mesh();
  addDeviceVisuals(dynamic,this.devices,this.roomLights,this.viewFloor,time,this.selectedObject,this.hoveredObject);
  const avatars=[];
  for(const a of this.actors.filter(a=>this.actorVisible(a,this.viewFloor))){
   const part=new Mesh();addCharacter(part,a,this.items,time,this.actors);
   for(const shape of part.shapes)shape.y+=(a.floor||0)*FLOOR_HEIGHT+(a.room==='pool'&&Math.abs(a.x+24)<5&&Math.abs(a.z-23)<3.6?-.55:0);
   avatars.push({actor:a,shapes:part.shapes});
  }
  const floor=this.viewFloor;const shapes=[...this.staticCpu[floor],...(['room','follow','firstperson','orbit','shoulder','director'].includes(this.cameraMode)?this.roofCpu[floor]:[]),...(['lower','upper','topdown'].includes(this.cameraMode)?this.privacyCpu[floor]:[]),...dynamic.shapes];
  const eye=this.camera.eye;
  const {forward,right:billboardRight,up:billboardUp}=billboardAxes(eye,this.camera.target);
  const depthOf=o=>dot([o.x-eye[0],o.y-eye[1],o.z-eye[2]],forward);
  const isFloor=s=>s.type==='box'&&s.h<=1&&s.w>5&&s.d>3;
  shapes.sort((a,b)=>{
   // Wide floor slabs must render behind furniture regardless of their center distance.
   const fa=isFloor(a),fb=isFloor(b);if(fa!==fb)return fa?-1:1;
   if(fa&&fb)return a.y-b.y;
   return depthOf(b)-depthOf(a);
  });
  const toScreen=(x,y,z)=>{const q=transform(this.proj,transform(this.view,[x,y,z,1]));return q[3]>.01?[(q[0]/q[3]+1)*w/2,(1-q[1]/q[3])*h/2]:null;};
  const color=(hex,k=1)=>rgb(hex).map(c=>Math.round(clamp(c*k,0,1)*255));
  const faceColor=(hex,k=1)=>`rgb(${color(hex,k).join(',')})`;
  const poly=(pts,col)=>{if(pts.some(p=>!p))return;ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(...pts[0]);for(let i=1;i<pts.length;i++)ctx.lineTo(...pts[i]);ctx.closePath();ctx.fill();};
  ctx.fillStyle='#a7dfe7';ctx.fillRect(0,0,w,h);
  // Canvas2D has no per-pixel depth buffer. Sort the house separately, then
  // composite each actor's *complete* authored pose in a dedicated layer.
  // Interleaving individual limbs with large wall/sofa meshes produced the
  // reported floating face and detached arms. Structural wall occlusion is
  // handled before this pass by actorVisible().
  const orderedAvatars=avatars.sort((a,b)=>
   depthOf({x:b.actor.x,y:(b.actor.floor||0)*FLOOR_HEIGHT+1.2,z:b.actor.z})-
   depthOf({x:a.actor.x,y:(a.actor.floor||0)*FLOOR_HEIGHT+1.2,z:a.actor.z}));
  const renderShapes=[...shapes,...orderedAvatars.flatMap(group=>group.shapes)];
  for(const s of renderShapes){
   if(s.type==='sphere'){
    const p=toScreen(s.x,s.y,s.z);
    const scale=s.scale||[1,1,1];
    const rx=s.r*Math.hypot(billboardRight[0]*scale[0],billboardRight[1]*scale[1],billboardRight[2]*scale[2]);
    const ry=s.r*Math.hypot(billboardUp[0]*scale[0],billboardUp[1]*scale[1],billboardUp[2]*scale[2]);
    const px=toScreen(s.x+billboardRight[0]*rx,s.y+billboardRight[1]*rx,s.z+billboardRight[2]*rx);
    const py=toScreen(s.x+billboardUp[0]*ry,s.y+billboardUp[1]*ry,s.z+billboardUp[2]*ry);
    if(!p||!px||!py)continue;
    const rw=Math.max(.5,Math.hypot(px[0]-p[0],px[1]-p[1])),rh=Math.max(.5,Math.hypot(py[0]-p[0],py[1]-p[1]));
    ctx.beginPath();ctx.ellipse(p[0],p[1],rw,rh,0,0,2*Math.PI);ctx.fillStyle=faceColor(s.col,1.0);ctx.fill();continue;
   }
   const bx=s.type==='cylinder'?s.r*2:s.w,by=s.h,bz=s.type==='cylinder'?s.r*2:s.d,rot=s.rot||0;
   const c=Math.cos(rot),ss=Math.sin(rot);
   const v=(xx,yy,zz)=>toScreen(s.x+xx*c+zz*ss,s.y+yy,s.z-xx*ss+zz*c);
   const X=bx/2,Y=by/2,Z=bz/2;
   const pts=[v(-X,-Y,-Z),v(X,-Y,-Z),v(X,Y,-Z),v(-X,Y,-Z),v(-X,-Y,Z),v(X,-Y,Z),v(X,Y,Z),v(-X,Y,Z)];
   // Draw all faces back to front with consistent light/dark faces.
   const faces=[[[0,1,2,3],.72],[[1,5,6,2],.87],[[4,0,3,7],.75],[[5,4,7,6],.80],[[3,2,6,7],1.08]];
   const order=faces.map(([ids,shade])=>({ids,shade,depth:ids.reduce((tot,id)=>tot+((id===0||id===1||id===4||id===5)?-.15:.15),0)}));
   // Painter order on each solid is not perfect, but suitable as a lightweight fallback.
   for(const f of order)poly(f.ids.map(i=>pts[i]),faceColor(s.col,f.shade));
  }
  this.frames++;if(performance.now()-this.lastFps>1100){this.fps=Math.round(this.frames*1000/(performance.now()-this.lastFps));this.frames=0;this.lastFps=performance.now();}
 }
 /** Returns the closest clickable furnishing beneath a screen tap.
  * Camera projection and renderer use the same view/projection matrices. */
 pickObject(screenX,screenY,objects=INTERACTABLES){
  // Use true 3D depth when the camera is available: front tables must not
  // shadow TV screens, and tiny remotes should win over furniture behind them.
  if(this.view&&this.proj&&this.width&&this.height){
   const inv=inverse4(multiply4(this.proj,this.view));
   if(inv){
    const x=screenX/this.width*2-1,y=1-screenY/this.height*2;
    const unproject=z=>{const p=transform(inv,[x,y,z,1]);return p.slice(0,3).map(v=>v/p[3]);};
    const origin=unproject(-1),far=unproject(1),direction=norm(sub(far,origin));
    const hits=[];
    for(const o of objects){
     if(o.floor!==this.viewFloor)continue;
     const base=o.floor*FLOOR_HEIGHT;
     const bounds={remote:[.84,1.1],table:[.05,.95],tv:[1.0,3.45],projector:[3.0,4.15],lamp:[.05,3.5],mirror:[.4,3.6],speaker:[.45,2.6],stereo:[.95,2.3],art:[1.0,3.5],microphone:[.2,2.15]};
     const [low,high]=bounds[o.kind]||[0,o.height||1.4];
     const t=intersectAABB(origin,direction,[o.x-o.w/2,base+low,o.z-o.d/2],[o.x+o.w/2,base+high,o.z+o.d/2]);
     if(Number.isFinite(t))hits.push({o,t});
    }
    hits.sort((a,b)=>a.t-b.t||a.o.w*a.o.d-b.o.w*b.o.d);
    if(hits.length)return hits[0].o;
   }
  }
  // Conservative projection fallback for test doubles or unusual GPU matrices.
  const candidates=[];
  for(const o of objects){
   if(o.floor!==this.viewFloor)continue;
   const y=o.floor*FLOOR_HEIGHT,depth=o.height||1.4;
   const corners=[];
   for(const sx of [-1,1])for(const sz of [-1,1])for(const sy of [0,1]){
    const p=this.project([o.x+sx*o.w/2,y+sy*depth+.1,o.z+sz*o.d/2]);if(p)corners.push(p);
   }
   if(corners.length<4)continue;
   const x0=Math.min(...corners.map(p=>p[0]))-4,x1=Math.max(...corners.map(p=>p[0]))+4;
   const y0=Math.min(...corners.map(p=>p[1]))-4,y1=Math.max(...corners.map(p=>p[1]))+4;
   if(screenX<x0||screenX>x1||screenY<y0||screenY>y1)continue;
   const worldDistance=Math.hypot(o.x-this.camera.eye[0],y+depth/2-this.camera.eye[1],o.z-this.camera.eye[2]);
   candidates.push({o,score:worldDistance});
  }
  candidates.sort((a,b)=>a.score-b.score);return candidates[0]?.o||null;
 }
 project(pos){const v=transform(this.proj,transform(this.view,[...pos,1]));if(v[3]<=0)return null;const x=v[0]/v[3],y=v[1]/v[3];if(Math.abs(x)>1.3||Math.abs(y)>1.3)return null;return [(x+1)/2*this.width,(1-y)/2*this.height];}
}
// Exposed for deterministic geometry validation and offline architectural preview renders.
export {Mesh,buildWorld,buildCeilings,buildPrivacyRoofs};

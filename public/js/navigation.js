/** Compact deterministic ground navigation on the server's collision geometry.
 * The server is still authoritative: waypoints only generate normal move inputs. */
import {canStand,LIMITS,CHARACTER_RADIUS,distanceToObject} from './world-layout.js';

const STEP=.85;
const sx=-31.4,sz=-25.4;
const nx=Math.floor((LIMITS.maxX-sx)/STEP),nz=Math.floor((LIMITS.maxZ-sz)/STEP);
const coord=(i,j)=>[sx+i*STEP,sz+j*STEP];
const cell=(x,z)=>[Math.max(0,Math.min(nx,Math.round((x-sx)/STEP))),Math.max(0,Math.min(nz,Math.round((z-sz)/STEP)))];
const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
function newHeap(){const arr=[];return {
 push(e){arr.push(e);let i=arr.length-1;while(i>0){const p=(i-1)>>1;if(arr[p].f<=e.f)break;arr[i]=arr[p];i=p;}arr[i]=e;},
 pop(){if(!arr.length)return null;const out=arr[0],last=arr.pop();if(arr.length){let i=0;while(i*2+1<arr.length){let c=i*2+1;if(c+1<arr.length&&arr[c+1].f<arr[c].f)c++;if(arr[c].f>=last.f)break;arr[i]=arr[c];i=c;}arr[i]=last;}return out;},
 get length(){return arr.length;}
};}
function walkableLine(ax,az,bx,bz,valid){const length=Math.hypot(bx-ax,bz-az);const slices=Math.max(1,Math.ceil(length/.27));for(let n=1;n<=slices;n++){const t=n/slices;if(!valid(ax+(bx-ax)*t,az+(bz-az)*t))return false;}return true;}
/** A* across the floor; refuses inaccessible wings or corners. */
export function findWalkingPath(start,goal,floor=0,wing='male',others=[]){
 const valid=(x,z)=>canStand(x,z,others,null,CHARACTER_RADIUS,floor,wing);
 if(!valid(start.x,start.z)||!valid(goal.x,goal.z))return null;
 if(walkableLine(start.x,start.z,goal.x,goal.z,valid))return [{x:goal.x,z:goal.z}];
 const from=cell(start.x,start.z),to=cell(goal.x,goal.z);
 const getId=(i,j)=>i+j*(nx+1),decode=id=>[id%(nx+1),Math.floor(id/(nx+1))];
 const begin=getId(...from),dest=getId(...to),heap=newHeap();
 const came=new Map(),gScore=new Map([[begin,0]]),closed=new Set();
 const heuristic=(i,j)=>Math.hypot(i-to[0],j-to[1]);
 heap.push({id:begin,f:heuristic(...from)});
 const cellValid=new Map();
 const permitted=(i,j)=>{if(i<0||j<0||i>nx||j>nz)return false;const k=getId(i,j);if(!cellValid.has(k))cellValid.set(k,valid(...coord(i,j)));return cellValid.get(k);};
 let reached=null,iterations=0;
 while(heap.length&&iterations++<12000){
  const node=heap.pop(),id=node.id;if(closed.has(id))continue;closed.add(id);
  const [i,j]=decode(id);if(id===dest||Math.hypot(i-to[0],j-to[1])<=1.2&&walkableLine(...coord(i,j),goal.x,goal.z,valid)){reached=id;break;}
  for(const [di,dj] of dirs){const ii=i+di,jj=j+dj;
   if(!permitted(ii,jj))continue;
   if(di&&dj&&(!permitted(i+di,j)||!permitted(i,j+dj)))continue;
   const next=getId(ii,jj),dist=Math.hypot(di,dj),tent=(gScore.get(id)||0)+dist;
   if(tent>=(gScore.get(next)??Infinity))continue;
   came.set(next,id);gScore.set(next,tent);heap.push({id:next,f:tent+heuristic(ii,jj)});
  }
 }
 if(reached===null)return null;
 const route=[];let id=reached;
 while(id!==begin&&route.length<900){const [i,j]=decode(id),[x,z]=coord(i,j);route.push({x,z});if(!came.has(id))break;id=came.get(id);}
 route.reverse();route.push({x:goal.x,z:goal.z});
 // Remove unnecessary turns using the exact same collision function.
 const out=[],points=[start,...route];let idx=0;
 while(idx<points.length-1){let best=idx+1;for(let j=points.length-1;j>idx+1;j--)if(walkableLine(points[idx].x,points[idx].z,points[j].x,points[j].z,valid)){best=j;break;}out.push({x:points[best].x,z:points[best].z});idx=best;}
 return out;
}
/** Pick an open standing position adjacent to the selected furniture. */
export function pathToObject(start,obj,wing='male',others=[]){
 if(!obj||start.floor!==obj.floor)return null;
 const r=Math.max(obj.w,obj.d)/2+.85;
 const candidates=[];
 for(let k=0;k<24;k++){
  const t=k*Math.PI/12;
  const x=obj.x+Math.cos(t)*(obj.w/2+.95),z=obj.z+Math.sin(t)*(obj.d/2+.95);
  if(distanceToObject(x,z,obj)>2.1)continue;
  if(canStand(x,z,others,start.id,CHARACTER_RADIUS,obj.floor,wing))candidates.push({x,z});
 }
 candidates.sort((a,b)=>Math.hypot(a.x-start.x,a.z-start.z)-Math.hypot(b.x-start.x,b.z-start.z));
 let best=null,score=Infinity;
 for(const goal of candidates.slice(0,12)){
  const path=findWalkingPath(start,goal,obj.floor,wing,others.filter(o=>o.id!==start.id));
  if(path){const total=path.reduce((s,p,i)=>s+Math.hypot(p.x-(i?path[i-1].x:start.x),p.z-(i?path[i-1].z:start.z)),0);
   if(total<score){best=path;score=total;}}
 }
 return best;
}

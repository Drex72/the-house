/**
 * Pure, deterministic 2D camera-to-architecture checks.
 * Gameplay movement remains server authoritative. Camera collision is client-only.
 *
 * The old camera only checked the final eye position; a wall could sit between
 * the player and eye, producing a wall-filling view and dismembered silhouettes
 * in the Canvas2D compatibility renderer.
 */
export function firstWallFraction(start,end,walls,floor=0,padding=0.32){
 const x0=Number(start.x),z0=Number(start.z),dx=Number(end.x)-x0,dz=Number(end.z)-z0;
 if(![x0,z0,dx,dz].every(Number.isFinite))return 0;
 let nearest=1;
 for(const wall of walls){
  if(wall.floor!==floor)continue;
  const xmin=wall.x-wall.w/2-padding,xmax=wall.x+wall.w/2+padding;
  const zmin=wall.z-wall.d/2-padding,zmax=wall.z+wall.d/2+padding;
  let enter=0,exit=1;
  for(const [startCoord,delta,min,max] of [[x0,dx,xmin,xmax],[z0,dz,zmin,zmax]]){
   if(Math.abs(delta)<1e-9){
    if(startCoord<min||startCoord>max){enter=2;break;}
   }else{
    const t0=(min-startCoord)/delta,t1=(max-startCoord)/delta;
    enter=Math.max(enter,Math.min(t0,t1));
    exit=Math.min(exit,Math.max(t0,t1));
    if(enter>exit)break;
   }
  }
  if(enter<=exit&&exit>=0&&enter>=0&&enter<=1)nearest=Math.min(nearest,enter);
 }
 return nearest;
}

/** Keep the eye at least 12cm in front of the first structural wall. */
export function clampCameraToWalls(anchor,desired,walls,floor=0,padding=0.32){
 const dx=desired.x-anchor.x,dz=desired.z-anchor.z,length=Math.hypot(dx,dz);
 if(!Number.isFinite(length)||length<1e-7)return {x:anchor.x,z:anchor.z,distance:0,blocked:false};
 const first=firstWallFraction(anchor,desired,walls,floor,padding);
 const safeLength=first>=1?length:Math.max(0,first*length-0.12);
 const t=safeLength/length;
 return {x:anchor.x+dx*t,z:anchor.z+dz*t,distance:safeLength,blocked:first<1,wallFraction:first};
}

/** Check opaque wall separation for software-rendered distant avatars. */
export function wallSeparates(eye,actor,walls,floor=0){
 // A very small tolerance avoids incorrectly culling actors beside door frames.
 return firstWallFraction(actor,eye,walls,floor,0.015)<0.985;
}

/** Exports the very same procedural mesh data used by the browser renderer
 * so an offline raster can check room compositions when Chromium is blocked. */
import {writeFileSync} from 'node:fs';
import {buildWorld,buildPrivacyRoofs,buildCeilings,Mesh} from '../public/js/scene.js';
const floor=Number(process.argv[2]||0),out=process.argv[3]||`/tmp/house-floor${floor}.bin`;
const mesh=buildWorld(floor);
const v=new Float32Array(mesh.data);
writeFileSync(out,Buffer.from(v.buffer));
console.log(`Wrote ${mesh.shapes.length} shapes / ${v.length/27} triangles to ${out}`);

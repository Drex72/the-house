"""Screenshot regression for the wall/doorway camera clipping report.

Uses the project Chromium harness and its live client, not a fabricated
rendering. The mock transport only substitutes WebSocket server messages.
The scene and camera matrices are the real production code.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
scope={'__file__':str(Path(__file__).with_name('browser-smoke.py'))}
source=Path(scope['__file__']).read_text().split('with sync_playwright() as p:')[0]
exec(compile(source,scope['__file__'],'exec'),scope)
make_document=scope['make_document']
OUT=Path(__file__).resolve().parent.parent/'artifacts'

with sync_playwright() as p:
 browser=p.chromium.launch(
  executable_path=scope['shutil'].which('chromium') or p.chromium.executable_path,
  headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--disable-web-security']
 )
 for width,height in [(1180,740),(390,844)]:
  page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
  errors=[]
  page.on('pageerror',lambda e: errors.append(str(e)))
  page.set_content(make_document(debug=True),wait_until='domcontentloaded')
  page.locator('#join-housemate').click()
  page.wait_for_timeout(2100)
  assert page.locator('#entry-overlay').evaluate('(e)=>e.hidden')
  cases=[
   ('back-wall',-12.5,-10.42,0,True),
   ('solid-divider',-13,-9,1.57079632679,False),
   ('open-doorway',-13,-5,1.57079632679,False),
  ]
  for name,x,z,heading,expect_near in cases:
   page.evaluate("""v=>{
    const a=window.__actor;
    Object.assign(a,{x:v.x,z:v.z,angle:v.heading,room:'lounge',walking:false});
    window.__socket.update();
    const scene=window.__houseScene;
    scene.setMode('follow');
    scene.heading=v.heading;
    scene.orbit=0;
    scene.cameraSnap=true;
   }""",{'x':x,'z':z,'heading':heading})
   page.wait_for_timeout(500)
   detail=page.evaluate("""()=>{
    const s=window.__houseScene,a=window.__actor;
    s.cameraFor(performance.now()/1000);
    const delta=Math.hypot(s.camera.eye[0]-a.x,s.camera.eye[2]-a.z);
    return {eye:s.camera.eye,look:s.camera.target,
      hidden:s.cameraHidesTarget,actorVisible:s.actorVisible(a,0),
      distance:delta,mode:s.cameraMode,hasGraphics:s.available};
   }""")
   assert detail['hasGraphics'] and all(isinstance(v,(int,float)) for v in detail['eye'])
   print('CAMERA DETAIL',width,name,detail,flush=True)
   assert detail['actorVisible']==(not detail['hidden']),'no half-rendered character through wall'
   if expect_near:
    assert detail['hidden'],'near-wall view should not draw a dismembered closeup'
    assert detail['eye'][1]>=3.40,f'emergency camera should rise above sofa backs: {detail}'
   if name=='open-doorway':
    assert detail['distance']>3.2,f'camera should pass through real door opening: {detail}'
    assert detail['actorVisible'],'player in a doorway must remain visible'
   assert not errors,errors
   page.screenshot(path=str(OUT/f'camera-{name}-{width}x{height}.png'))
   print('PASS',width,name,detail,flush=True)
  page.close()
 browser.close()

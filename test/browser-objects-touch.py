"""Real Chromium viewport and pointer testing for object selection (mocked network).
Run separately from live Node WebSocket integration tests.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
scope={'__file__':str(Path(__file__).with_name('browser-smoke.py'))}
source=Path(scope['__file__']).read_text().split('with sync_playwright() as p:')[0]
exec(compile(source,scope['__file__'],'exec'),scope)
make_document=scope['make_document']
OUT=Path(__file__).resolve().parent.parent/'artifacts'
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--disable-web-security'])
 for width,height in [(1180,740),(390,844)]:
  page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1,has_touch=True,is_mobile=(width<600))
  errors=[]
  page.on('pageerror', lambda exc: errors.append(str(exc)))
  page.set_content(make_document(debug=True),wait_until='domcontentloaded')
  page.locator('#join-housemate').click()
  page.wait_for_timeout(2100)
  scene_info=page.evaluate('''() => {
    const s=window.__houseScene,o=window.__houseState.objects.find(o=>o.id==='lounge-sofa');
    const center=s.project([o.x, .88, o.z]);
    const left=s.project([o.x-1.2, .88, o.z]);
    return {center,left,eye:s.camera.eye,mode:s.cameraMode,match:center&&s.pickObject(...center,window.__houseState.objects.filter(it=>it.room==='lounge'))?.id};
  }''')
  print('DEBUG',width,scene_info,flush=True)
  candidates=page.evaluate("""() => window.__houseState.objects.filter(o=>o.room==='lounge').map(o=>({id:o.id,center:window.__houseScene.project([o.x,o.kind==='tv'?2.2:.9,o.z])}))""")
  print('CANDIDATES',width,candidates,flush=True)
  visible=[o for o in candidates if o['center'] and 10<o['center'][0]<width-10 and 82<o['center'][1]<height-85]
  assert visible, 'At least one contextual object should be visible in each viewport'
  choice=next((o for o in visible if o['id']==('lounge-tv' if width<600 else 'lounge-sofa')),visible[0])
  center=choice['center']
  print('TARGET',width,choice)
  # Mouse/touch event must hit the actual canvas, not an invisible fake action button.
  page.touchscreen.tap(center[0],center[1])
  page.wait_for_timeout(250)
  assert page.locator('#object-popover').is_visible(), 'furniture options did not open on tap'
  expected='watch' if choice['id']=='lounge-tv' else 'sit'
  assert page.locator(f'[data-object-choice="{expected}"]').count()==1, f'{choice["id"]} missing {expected}'
  if choice['id']=='lounge-sofa': assert page.locator('[data-object-choice="lie"]').count()==1, 'sofa has no lie option'
  page.screenshot(path=str(OUT/f'touch-object-{width}x{height}.png'))
  page.locator('[data-close-object]').click()
  assert not page.locator('#object-popover').is_visible(), 'close object menu did not work'
  page.touchscreen.tap(center[0],center[1])
  page.locator(f'[data-object-choice="{expected}"]').click()
  page.wait_for_timeout(560)
  last=page.evaluate('window.__lastMessage')
  assert last['type'] in ('move','object-act'),f'Object selection did not initiate a real action: {last}'
  assert not errors, errors
  print('PASS',width,'sofa tap, contextual choices and close button',flush=True)
  page.close()
 browser.close()

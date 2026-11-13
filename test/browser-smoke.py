"""Optional visual/browser smoke test; requires Python Playwright and Chromium.
This harness loads exact client source as in-memory ES modules because this environment
blocks direct localhost navigation. Its WebSocket is simulated, not a live browser network test.
Use npm run test:integration for real server WebSocket testing.
"""
from pathlib import Path
import base64
import json
import re
import subprocess
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / 'public'
OUT = ROOT / 'artifacts'
OUT.mkdir(exist_ok=True)

def uri(code):
    return 'data:text/javascript;base64,'+base64.b64encode(code.encode()).decode()

def node_room_data():
    script = "import {ROOMS} from './public/js/world-layout.js';import {ITEMS} from './server/game.mjs';console.log(JSON.stringify({rooms:ROOMS,items:ITEMS}));"
    return json.loads(subprocess.check_output(['node', '--input-type=module', '-e', script], cwd=ROOT, text=True))

def make_document(simulate_gpu_error=False, debug=False):
    needs = uri((PUBLIC / 'js/needs.js').read_text())
    layout_source = (PUBLIC / 'js/world-layout.js').read_text().replace("from './needs.js'", f"from '{needs}'")
    layout = uri(layout_source)
    voice = uri((PUBLIC / 'js/voice.js').read_text())
    motion = uri((PUBLIC / 'js/motion.js').read_text())
    notes = uri((PUBLIC / 'js/voice-notes.js').read_text())
    social = uri((PUBLIC / 'js/social-ui.js').read_text())
    scene_source = ((PUBLIC / 'js/scene.js').read_text()
        .replace("from './world-layout.js'", f"from '{layout}'")
        .replace("from './motion.js'", f"from '{motion}'"))
    if simulate_gpu_error:
        # Exactly one WebGL frame throws on first-person join; software fallback must survive.
        scene_source = scene_source.replace(
            'frame(time){if(!this.available)return;',
            "frame(time){if(this.targetActor&&!globalThis.__testRenderCrashOnce){globalThis.__testRenderCrashOnce=true;throw new Error('Simulated runtime render failure');}if(!this.available)return;"
        )
    scene = uri(scene_source)
    navigation_source = (PUBLIC / 'js/navigation.js').read_text().replace("from './world-layout.js'", f"from '{layout}'")
    navigation = uri(navigation_source)
    app_source = ((PUBLIC / 'js/app.js').read_text()
        .replace("from './scene.js'", f"from '{scene}'")
        .replace("from './voice.js'", f"from '{voice}'")
        .replace("from './world-layout.js'", f"from '{layout}'")
        .replace("from './needs.js'", f"from '{needs}'")
        .replace("from './navigation.js'", f"from '{navigation}'")
        .replace("from './voice-notes.js'", f"from '{notes}'")
        .replace("from './social-ui.js'", f"from '{social}'"))
    if debug:
        app_source = app_source.replace('installWorldPointerHandlers(el.world);', 'installWorldPointerHandlers(el.world);globalThis.__houseScene=scene;globalThis.__houseState=state;')
    app = uri(app_source)
    html = (PUBLIC / 'index.html').read_text()
    css = (PUBLIC / 'css/style.css').read_text()+'\n'+(PUBLIC / 'css/island-ui.css').read_text()
    html = re.sub(r'<link rel="stylesheet"[^>]+>', '', html)
    html = html.replace('</head>', '<style>'+css+'</style></head>')
    catalog = node_room_data()
    mock = r'''<script>
window.fetch=async()=>({ok:true,status:200,json:async()=>({websocketUrl:'ws://fake.test/live'})});
class FakeSocket extends EventTarget {
 static OPEN=1; static CLOSED=3;
 constructor(){super();window.__socket=this;this.readyState=0;queueMicrotask(()=>{this.readyState=1;this.dispatchEvent(new Event('open'));});}
 send(data){const message=JSON.parse(data);window.__lastMessage=message;if(message.type==='join'){
   const a={id:'player-1',name:'Tester',x:-8,z:-3.1,angle:3.14,walking:false,floor:0,wing:'male',room:'lounge',skin:3,hair:1,outfit:'lagos-tee',activity:'',activityUntil:0,hidden:false,bot:false,fame:0,voiceEnabled:false,needs:{hunger:67,energy:78,hygiene:82,social:56}};
   window.__actor=a;
   const profile={id:'tester',name:'Tester',coins:1200,owned:['lagos-tee','denim'],outfit:'lagos-tee',skin:3,hair:1,votedPhase:''};
   const role=message.role;
   const welcome={type:'welcome',role,actorId:role==='housemate'?'player-1':null,profile,items:window.__CATALOG.items,rooms:window.__CATALOG.rooms,templates:[],paymentsEnabled:false};
   setTimeout(()=>{this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify(welcome)}));this.update()},80);
 }else if(message.type==='interact'){
   const action=window.__CATALOG.rooms.find(r=>r.id===a.room)?.actions.find(a=>a.id===message.action);
   if(action){window.__actor.activity=action.title;window.__actor.activityStarted=Date.now();window.__actor.activityUntil=Date.now()+action.duration*1000;window.__actor.activityLock=action.lockMovement;this.update();}
 }else if(message.type==='cancel-activity'){window.__actor.activity='';window.__actor.activityUntil=0;this.update();}}
 update(){if(this.readyState!==1)return;this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({type:'snapshot',cast:[window.__actor],feed:[],requests:[],votes:{},phase:{label:'Test',remaining:120,length:300,season:0,id:'round1'}})}));}
 close(){this.readyState=3;this.dispatchEvent(new Event('close'));}
}
window.WebSocket=FakeSocket;
</script>
'''.replace('window.__CATALOG.rooms.find(r=>r.id===a.room)', 'window.__CATALOG.rooms.find(r=>r.id===window.__actor.room)')
    mock = '<script>window.__CATALOG='+json.dumps(catalog)+'</script>'+mock
    html = html.replace('<script type="module" src="/js/app.js"></script>', mock+f'<script type="module" src="{app}"></script>')
    return html

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--disable-web-security'])
    for width,height,crash in [(1180,740,False),(390,844,False),(1180,740,True)]:
        page = browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
        errors=[];logs=[]
        page.on('pageerror',lambda exc:errors.append(str(exc)))
        page.on('console',lambda m:logs.append((m.type,m.text)))
        page.set_content(make_document(crash),wait_until='domcontentloaded')
        page.wait_for_timeout(1000)
        page.locator('#join-housemate').click()
        page.wait_for_timeout(2200)
        assert page.locator('#entry-overlay').evaluate('(e)=>e.hidden'), 'join failed'
        assert page.locator('#needs-hud').is_visible(), 'needs HUD hidden'
        assert page.locator('#needs-hud .need-row').count()==4, 'four needs required'
        assert not errors, f'uncaught errors: {errors}'
        suffix=f'{width}x{height}'+('-recovery' if crash else '')
        page.screenshot(path=str(OUT / f'housemate-{suffix}.png'))
        page.locator('#interact-action').click()
        assert page.locator('#activities-flyout').is_visible(), 'activities did not open'
        assert page.locator('#activities-flyout .activity-button').count()>=3, 'missing tasks'
        page.screenshot(path=str(OUT / f'activities-{suffix}.png'))
        page.locator('[data-close-activities]').click()
        assert not page.locator('#activities-flyout').is_visible(), 'activities close failed'
        page.locator('#open-menu').click()
        page.locator('#activity-panel').wait_for(state='visible',timeout=2000)
        assert page.locator('#activity-panel').is_visible()
        page.locator('#close-panel').click()
        page.locator('#activity-panel').wait_for(state='hidden',timeout=2000)
        assert not page.locator('#activity-panel').is_visible()
        if crash:
            assert any('Switching house renderer to compatibility mode' in v for k,v in logs), 'WebGL recovery was not invoked'
            assert page.locator('#world').evaluate("(c)=>c.getContext('2d')!==null"), '2D renderer not active after recovery'
        print(f'PASS {suffix}: joined housemate, visible needs, tasks, menu and graphics '+('software recovery' if crash else 'normal'))
        page.close()
    # Regression: spectators can inspect a specific outdoor area without seeing private rooms.
    spectator=browser.new_page(viewport={'width':1180,'height':740},device_scale_factor=1)
    spectator_errors=[]
    spectator.on('pageerror',lambda exc:spectator_errors.append(str(exc)))
    spectator.set_content(make_document(False),wait_until='domcontentloaded')
    spectator.wait_for_timeout(1000)
    spectator.locator('#join-viewer').click()
    spectator.wait_for_timeout(1900)
    assert not spectator.locator('#needs-hud').is_visible(), 'spectator should not see private needs'
    spectator.locator('#quick-view').click()
    spectator.locator('[data-camera-choice="lower"]').click()
    spectator.wait_for_timeout(1400)
    spectator.screenshot(path=str(OUT/'compound-overview-1180x740.png'))
    spectator.locator('#quick-explore').click()
    spectator.locator('[data-room="arena"]').click()
    spectator.wait_for_timeout(1400)
    assert not spectator_errors, f'viewer browser errors: {spectator_errors}'
    spectator.screenshot(path=str(OUT/'compound-beach-games-1180x740.png'))
    print('PASS viewer: downstairs-only overview, outdoor room camera, private needs hidden')
    spectator.close()
    browser.close()

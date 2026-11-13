# The House V9 · Player Motion & Social Conversations

This branch adds a compact social layer to the existing multiplayer island house.

**Getting started:** Run `npm start` with Node.js 20+ and open `http://localhost:3000`. Open two browsers to join as different housemates.

### New housemate controls
- **Walking:** animated footfall cadence now eases between walking and idling instead of restarting on every network packet. Procedural high-fives, hugging and dancing together are synchronized across players.
- **Player interactions:** tap another housemate (or their roster entry) while nearby in the same room. **Wave** is immediate; **High-five**, **Hug**, and **Dance together** send a private consent request. Both real participants must agree before shared animations begin.
- **Private metrics:** open **Menu → Me** to see food, energy, hygiene, social, fame, Notes, activity completions, distance walked, messages, voice notes and social interactions. Metrics are server-authoritative and only delivered to the owning player.
- **Chat boxes:** click **💬 Talk** as a housemate to open room-only text chat. Messages appear temporarily in bubbles above visible players. The existing **Gist** is still the public audience channel.
- **Voice notes:** inside **💬 Talk**, tap **Record voice note**, grant microphone permission, and tap **Stop and send** (automatic cutoff at 8 seconds). Audio is playable manually by housemates **in the same room**, never by spectators. MediaRecorder requires HTTPS or localhost. Nothing is stored on disk; notes disappear on refresh, reconnect or server restart.

### Safety and current limitations
- Consent is required for two-person physical animations, including hugging. Interaction requests expire after 20 seconds and are checked by the server for proximity, floor and room.
- Voice notes are size-limited (32 KiB), throttled and kept in memory for delivery only. The server does not send them to viewers or other rooms. There is no background recording.
- Real identities and long-term profiles are **not yet authenticated or persisted**; this is an interactive prototype, not a production voice/chat service.
- Walking and interaction poses are procedural shapes, not mocap skeletal rigs. Hardware-specific performance and full microphone compatibility require real-device QA.
- `npm test` runs game unit/security tests. `npm run test:integration` exercises live WebSockets, including private chat and voice-note routing. PR CI additionally checks JavaScript syntax.

---

# The House V9 · Object Interactions & Animations
**Branch feature: expanded Sims-style contextual interactions** for the Lagos island-house game. Every one of the **24 rooms** has clickable props; the catalog now includes **65 interactable objects**. Tapping an object opens a small context-sensitive action menu; character movement, close buttons, camera modes, room restrictions and existing multiplayer rules are preserved.
- Tap the **TV**, **remote**, **stereo**, **speakers**, **fridge**, **stove**, **mirror**, **bed**, **shower**, **pool**, **volleyball court**, or other in-world props. When far away, the character walks to the object.
- TV channels, stereo power/track and light switches are **synchronized across connected clients**. The screen/equalizer react in 3D.
- The stereo plays **three original synthesized loops** with opt-in, studio-only local sound; no copyrighted music or external player is included.
- Avatars replicate object interaction poses, short hand gestures and simple held props. These are procedural animation cues, not fully rigged motion capture.
- The contextual menu displays only when an object is clicked. **Inspect** is a safe secondary action, and **Ask to cuddle** still requires explicit consent from another real player.
See [Interaction design and implementation](docs/OBJECT_INTERACTIONS.md) for state validation, audio behavior, content-extension instructions and limitations.
## Run and test
```bash
npm start                   # Node.js 20+, http://localhost:3000
npm test                    # 43 unit and simulation checks
npm run test:integration    # live multi-client WebSocket test
python test/browser-smoke.py         # optional, requires Python Playwright and Chromium
python test/browser-objects.py       # desktop/mobile canvas click tests
python test/browser-objects-touch.py # touch-specific pointer tests
```
**Status:** tested locally, not deployed. The Chromium harness loads actual source in memory with mocked WebSocket events; the separate integration test uses actual live Node WebSockets. Browser audio and high-quality skeletal animation have not been validated on physical phones.
# The House V8 · Stable Movement & Interactive Furniture

**A runnable multiplayer 3D island house prototype.** V8 repairs camera jitter and camera-dependent colour changes and introduces object-specific interactions without adding permanent on-screen controls. It preserves the real-user-only housemates, needs, private bedroom rules, viewer cameras, beach compound, wardrobe and optional voice signaling from prior builds.

## Run locally

Requires Node.js 20+. There are no third-party Node dependencies.

```bash
npm start
# open http://localhost:3000
```

To test interactions, choose **Housemate**, walk through the lounge and **click/tap a sofa, armchair or television**. Tap **Sit down** or **Lie down** on a sofa, **Watch a movie** on a TV, or **Sleep** on a bed. When you are far away from a selected object, your housemate attempts to walk to it using a collision-aware path. Tap WASD, arrow keys or joystick to cancel that walk. Press **Stand up** to leave a seated/lying position.

**Camera controls:** mouse-drag or swipe on the scene changes the view while the character faces the walking direction independently. Use the small **View** button to switch camera modes. A camera or object menu closes with its X, background click, or Escape.

**Shared interactions:** if a different *real housemate* is sitting on the same sofa, **Ask [player] to cuddle** becomes available. Their private consent dialog lets them accept or decline. Both players must be close and the server confirms occupancy; this cannot be forced on other players.

**Activity behavior:** eating and exercising restore appropriate need meters once the activity completes. A TV selection shows a seated/watching activity state; no film stream is integrated. These are gameplay interactions and prototype poses, not yet custom animation clips.

## Checks

```bash
npm test                     # 35 unit/simulation tests
npm run test:integration     # live Node WebSocket multi-client test
python test/browser-smoke.py # optional Chromium in-memory UI smoke tests
python test/browser-objects.py # optional clickable-object UI test
```

The Chromium checks use an in-memory page with the real game scripts and mocked WebSocket events because direct localhost browsing was blocked. They do not establish behavior on a deployed public server or physical phones. The WebSocket integration test runs against the actual local Node server separately. Real-money checkout remains disabled, graphics are still procedural, and no public deployment is included in this archive.

---

# The House V7 · Island Life

**Playable two-floor beach-house multiplayer prototype.** This update repairs rendering failures in housemate mode, introduces food/energy/hygiene/social needs, and adds playable objects and activities across the island compound. There are no NPC housemates.

## Run on your computer

Requires **Node.js 20+**. No npm install is needed.

```bash
npm start
# Open http://localhost:3000
```

Open multiple browser windows/profiles to join as different real housemates or viewers. Voice requires microphone permission and usually HTTPS on mobile networks. The local demo uses in-memory state; clothing, currency and needs reset when the Node server restarts.

## Housemate life: food, energy, hygiene and social needs

The four compact bars appear under your current room name when you join as a **housemate**. They decrease over the course of a session. Viewers cannot see other players' needs. To change them, walk to the appropriate area, press **Activities**, and select an action:

- **Sleep in bed**: men's or women's upstairs bedroom; restores energy when the sleep timer finishes. Choose the **Grand Stair Hall** activity to go upstairs. A **power nap** is also available in the Big Lounge. Sleeping locks movement; you can press **Stop activity** to cancel it without gaining benefits.
- **Eat a hot meal / Have a snack**: Chop Life Kitchen; restores food. You can also eat dinner in Owambe Dining or pick up food at the cabana BBQ.
- **Take a shower**: upstairs washrooms, the Soft Life Spa, or the poolside rinse shower; restores hygiene.
- **Chat with housemates**, share a meal, play volleyball, host a party or relax at the bonfire to restore social needs, often at an energy cost.

All need changes are **server-authoritative** and applied on activity completion; simply clicking an action doesn't replenish meters. Paid clothes stay separate from food/needs: no pay-to-win stat purchases.

## More things to explore in the compound

The outdoor floor now has a pool ladder, floating rings, outdoor shower, hammocks, picnic table, beach volleyball net/court, fire pit, beach BBQ grill, juice stand, surfboard rack and low lanterns. The beach, beach games, pool and cabana have activities that correspond to those amenities. Collision blocks key props, and the doorways remain walkable. This remains **one island compound** surrounded by water and sand, with no city streets or decorative buildings.

## Housemate graphics reliability

- The client tries WebGL2 first and uses software drawing when WebGL2 can't initialize.
- If the renderer throws during gameplay or WebGL context is lost, the game replaces the canvas with the software renderer, preserves the room/camera/avatars, and reattaches pointer controls rather than asking for a refresh.
- If the 3D scene is dark without an error, open **Menu → Switch to compatibility graphics** to force the fallback manually.
- If both renderers fail, menu/chat remain usable; the limitation is reported.

**Visual quality caveat:** fallback graphics are lower-fidelity and potentially slower than GPU 3D. The 3D world and characters remain procedural prototypes, not the polished assets seen in the user-supplied artwork. WebGL and mobile GPU performance must be tested on physical devices.

## Tests

```bash
npm test                    # 27 server, geometry, needs, HUD and renderer-contract tests
npm run test:integration    # live three-client WebSocket integration
python test/browser-smoke.py # optional: requires Chromium + Python Playwright
```

The browser harness loads real JavaScript modules **in memory** with a fake WebSocket because direct localhost navigation was blocked in this environment. It tested joining as housemate, desktop/mobile HUD and activities, opening/closing menus, a deliberately injected runtime render failure, and a viewer switching to the beach-games camera. The real Node WebSocket path was tested separately with three genuine Node WebSocket clients. Screenshots in `artifacts/` are from the in-memory Chromium harness, **not proof of physical-device performance or deployed website operation**.

**Not yet production-ready:** professional rigged character models and polished sleep/eat animations, persistent accounts and needs, moderated voice, hardened payments, mobile GPU profiling and a publicly deployed always-on multiplayer server. Real-money payments remain disabled by default.

---

## Previous V6 build information

# The House · Island Edition — V6 visibility and navigation repair

A **runnable browser-first multiplayer social game** with one private island beach-house compound, two levels, real-player-only housemates, spectator cameras, room activities, paid/earned-currency wardrobes and opt-in room voice.

This is a working **prototype**, not the finished Sims-grade game depicted in the visual reference. The 3D world currently uses original *procedural WebGL2 meshes*, not professionally sculpted characters, furniture, textures or motion-captured animation. There are **no bots filling empty housemate slots**. The original reality-show season, voting, gifting and viewer-request systems are retained.

## V6 bug fixes (November 13, 2026)

- **Fixed the blank/dark game view:** V5 referenced a missing `#drawer-people` element during startup, throwing an exception before the animation loop could run. The required Housemates control is now present, so scene animation starts reliably.
- **Fixed menu close controls:** V5 also referenced a missing `#voice-toggle` element later in startup; this is now present but only shown to housemates. The menu X is no longer mobile-only, and X, backdrop, Escape and a dedicated **Back to the game** button all dismiss overlays.
- **Added functional Leave game:** disconnects the WebSocket session, stops voice, prevents unintended reconnection and returns to the welcome screen.
- **Added close buttons** to the camera options and room selector; these do not appear permanently on the game canvas.
- **Improved graphics startup resilience:** if WebGL initialization fails, the game retries with the canvas software renderer instead of breaking all input handlers. The room/world content is unchanged.
- **Added three automatic UI contract tests** to prevent this particular missing-element startup regression.
- **Validated controls at 1180×740 and 390×844** using an in-memory Chromium browser harness and simulated join events, in both viewer and housemate modes. All startup and menu scenarios tested completed without JavaScript exceptions. The container blocked navigation to localhost; do not treat these as tests of a deployed public site or physical mobile GPU.

## Run

Node.js **20+**, no package installation or third-party runtime dependencies:

```bash
npm start
# open http://localhost:3000
```

For local testing, use two distinct browser profiles, one as a housemate and the other as a viewer. For LAN multiplayer, navigate to `http://<your-computer-LAN-IP>:3000` from both devices (microphone permission typically requires HTTPS, even when plain HTTP gameplay works over LAN).

```bash
npm test
npm run test:integration
```

Tests exercise server-authoritative movement, collisions, both floors, accessible doors, entry-wing restrictions, real-client joins and disconnects, vote/request/store state, private rooms, and WebRTC **signaling authorization**. A successful signaling test is *not* a full microphone-to-speaker test on multiple physical devices.

## The house: 24 spaces, two floors, one enclosed compound

**Downstairs:** Chop Life Kitchen, Owambe Dining, Soft Life Spa, Style Boutique, Games & Wahala, The Big Lounge, Confession Room, Private Cinema, Afrobeats Studio, Grand Stair Hall, Fitness & Wellness, Glam & Content Studio.  
**Outdoor, inside the beachfront compound:** Beachfront Pool, Private Beach, Beach Games, Sunset Cabana. The entire world is bordered by ocean, shallow turquoise water and sandy shoreline. The playable beach offers sandcastle building, beach volleyball and sunset-watching activities; the water beyond the perimeter is scenic, not swimmable. There are no streets or unrelated buildings.  
**Upstairs:** Men's Bedroom, Men's Washroom, Women's Bedroom, Women's Washroom, Gentlemen's Lounge, Upper Gallery, Skyline Terrace, Ladies' Lounge.

Every room declares **three named activities**. A housemate selects one, completes a short timer and earns in-game Notes if they stay in that room until completion. Examples: cook jollof, serve small chops, perform a Nollywood commentary, practise a GRWM, record Afrobeats freestyle, plan a house strategy, compete in Oga House's challenge, host an owambe or pool party. Activities are a working timing/rewards/game-state system, **not yet fully animated bespoke minigames**.

The stair hall and upper gallery offer a floor-transfer interaction. Bedroom-wing assignments are **self-selected on housemate entry and server-enforced** for that session; this is a house rule, **not identity/sex verification**. Opposite-wing rooms and lounges block entry. Spectators cannot teleport into private rooms or choose a whole-building view.

## V6 repaired minimal interface

- The game world takes the full screen. The large left and right panels are **closed at startup**; there is **no nine-button navigation dock**.
- The top bar contains the identity, live player count and a single **Menu** button; the tiny location indicator shows the selected/current room.
- Bottom-right **View** opens the appropriate housemate/viewer camera options on demand. **Explore** opens the room list for viewers; **Activities** appears for housemates instead.
- Menu opens one right-hand panel for chat, vote, requests and shop, with a link to the separate housemate roster. Mobile uses a bottom-sheet pattern. Menus are mutually exclusive and can be closed with the visible X on mobile and desktop, Back to the game, clicking outside, or Escape. A separate Leave game action disconnects and returns to the entry screen.
- For touch housemates a smaller virtual joystick appears on the left. Desktop movement stays WASD/arrow keys.
- The scene has original low-poly island/ocean geometry, a shader-based animated sea, pale sand, palms, beach umbrellas, loungers and surf details, replacing city/street filler.

## Cameras

**Housemates:** Follow, Orbit, Shoulder, first-person POV and personal top-down. WASD/arrow keys or mobile virtual joystick; drag to orbit/turn where applicable. Camera-relative movement supports changing viewpoint during play.

**Viewers:** A public-room selector, **downstairs-only** eagle view, **upstairs-only** eagle view, live director and follow mode. Private spaces are redacted or roof-covered rather than made visible through an all-building cutaway. No whole-compound / both-floors-at-once camera is provided.

## Social, voice and wardrobe

- Up to ten simultaneous, **connected human-operated browser sessions** in cast. The game does not spawn fictional housemates or passers-by. It does not yet enforce human-verification or durable identity.
- Server collision and movement authority, client prediction and interpolated remote players.
- Votes from viewer clients, requests with upvotes/housemate acceptance, chat, free gifts, room-based activity feed.
- An in-game shop: earned **Notes** are spent for normal outfits, never unlocked simply by entering the wardrobe; premium outfits have **₦ prices** and an optional Paystack initialize-and-verify checkout integration on the server.
- **Real-money payment processing is OFF by default**. `ENABLE_EXPERIMENTAL_PAYMENTS=1` and a server-side `PAYSTACK_SECRET_KEY` are required, but **do not enable on a public server before implementing authenticated accounts, durable payment transactions, Paystack webhooks/reconciliation and robust anti-fraud controls**. Orders/profiles here are in memory and the payment code is experimental.
- Microphone is **OFF by default**. Housemates can opt into WebRTC audio with others who opted in inside the same room and floor; spectators receive no private audio. Server gates signaling. The current STUN-only setup may fail behind certain networks; production requires TURN, per-room mute/block and active moderation. Voice audio is not recorded by this prototype.
- Skin tones, hair and purchased clothes are visible on the avatar; wardrobe ownership and currency live in server memory, **not persistent accounts**.

## Deployment architecture

Vercel can host the **static frontend** from `public/` using the included `vercel.json`, but **cannot serve the persistent Node WebSocket room itself**. Deploy the *full repo* separately to a persistent Node provider such as Railway, with start command `npm start`, and secure its origin policies.

Edit `public/runtime-config.json`:

```json
{ "websocketUrl": "wss://YOUR_PERSISTENT_NODE_BACKEND/live" }
```

Configure `ALLOWED_ORIGIN_HOSTS` on the backend with the deployed Vercel hostname(s), and run a full two-browser smoke test. Alternatively deploy the entire application to one persistent Node service, where the browser and game server share an origin and no separate Vercel frontend is needed. A working public URL requires both pieces and real-user security controls.

## Project structure

- `public/js/world-layout.js`: authoritative 24-room / 2-floor geometry, constraints, activities
- `server/game.mjs`: joins, player movement, access, shop, timed activities and game state
- `server/index.mjs`: HTTP and persistent WebSocket room; gated payment and voice signal APIs
- `public/js/scene.js`: WebGL2 renderer, level/lod camera, geometry, avatars
- `public/js/app.js`: user interface, mobile controls, client prediction, views and store
- `public/js/voice.js`: consent-based room-local WebRTC peer audio
- `public/css/style.css`: web/mobile UI
- `test/`: geometry, game logic and live multi-client tests
- `docs/World_Map.png`: implemented room/floor schematic

## Browser screenshot limitation

The browser automation environment reports `ERR_BLOCKED_BY_ADMINISTRATOR` for localhost pages. The game is testable over HTTP and WebSockets, and procedural meshes can be exported for offline inspection, but **a live Chromium visual screenshot and physical phone GPU profiling were not possible here**. The design changes and menu visibility have source-level regression tests, not completed manual visual approval.

## Verified vs unverified

**Verified:** Node code checks, automated simulation and integration tests, local HTTP response, mesh shape generation and finite coordinates. **Unverified:** GPU frame rate on mobile devices; browser-rendered appearance against the uploaded reference; cross-device microphone call setup and audio quality; safe real-money order delivery. Browser automation in the available execution environment returned `ERR_BLOCKED_BY_ADMINISTRATOR` for local and external pages. Any supplied floor-plan or offline mesh projection is **not a browser screenshot**.

**Not production-ready:** robust user authentication, identity/anti-bot controls, persistent economy, moderated audio/chat, payment fulfillment, real-world player abuse/harassment controls, fully implemented eviction/diary-room competition rules, professional character rigs, PBR asset packs and detailed animations. These remain engineering milestones; this code makes no claim of matching the reference's rendering fidelity yet.

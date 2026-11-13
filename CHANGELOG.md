# V9 — Contextual object interactions and animations · 13 November 2026

- Expanded physical interactions to **65 registered objects in all 24 rooms**, including a TV remote, shared TV channels, Afrobeats stereo, speakers/mixer, appliances, bathroom fixtures, mirrors, game and beach equipment, lights and décor.
- Added server-authoritative appliance on/off/channel/track state to WebSocket snapshots; protected all actions by role, room, floor, distance and allowlisted server actions.
- Added original synthesized stereo loops, explicitly user-enabled and audible only when physically in the music room. No external/copyrighted music streams.
- Added short-lived replicated hand gestures, more activity poses, held cups, microphones and remote, reactive TV screens/stereo equalizer, and a selected-object locator.
- Replaced 2D rectangle-only picking with proper 3D depth intersections, fixing TV click selection behind a foreground table.
- Preserved consent-gated shared sofa cuddling, private bedroom rules, client fallback renderer and minimal contextual menus.
- Verification: 43 Node tests, multi-client WebSocket integration, desktop/mobile mouse and touch action menus, Chromium housemate/render recovery tests all passed in this environment.
- Still a procedural WebGL2 prototype, not fully rigged motion capture. Production browser/phone audio and deployed performance are unverified.

---

# V8 — Stable Movement & Interactive Furniture · 13 November 2026

## Bug fixes
- **Lighting:** world-space shading stays consistent when the camera turns; fixed camera-relative surface normals and specular light that made walls and furniture unexpectedly change colour.
- **Movement:** avatar facing no longer forcibly rotates the follow camera on every movement packet. Mouse/touch drag controls the orbit separately from WASD/joystick movement, with more controlled interpolation.
- **Camera collision:** follow camera checks structural walls rather than every furniture collider, preventing abrupt zooms and snaps near chairs and tables.
- **Compatibility rendering:** software canvas sorting uses camera-forward depth rather than distance to camera, eliminating a source of object-order popping while moving.

## Click-to-interact objects
- Added selectable sofas, chairs, beds, TVs, cinema screen, kitchen island, dining tables, snooker, hammocks, picnic tables, BBQ and exercise stations.
- Furniture actions are relevant to the selected object: **sit / lie down**, **sleep**, **watch a movie**, **eat / cook / exercise / play**. The actions update game state, timed activity and/or needs where applicable. The TV action does not stream copyrighted films.
- Clicking objects opens one compact, dismissible contextual menu on desktop or mobile; nothing is permanently added to the navigation dock.
- Added collision-aware short-range automatic walking to the selected prop, with server-side proximity validation. Manual movement cancels auto-walk.
- Seat occupancy and shared actions are server-authoritative. **Cuddle** is offered only when another real player occupies the same sofa, and that player must explicitly accept the private invite. Declining causes no contact.
- Static poses persist until standing/moving; activity timers don't accidentally cancel seating. Disconnects release seats and shared poses.

## Validation
- `npm test`: **35/35** unit and simulation tests passed.
- `npm run test:integration`: multi-client real Node/WebSocket smoke test passed.
- `python test/browser-smoke.py`: desktop/mobile Chromium tests for joining, navigation, camera, recovery, and viewer mode passed with in-memory source loading.
- `python test/browser-objects.py`: desktop sofa and mobile television canvas click, context menu, close, and action dispatch passed.

## Limitations
- Full gameplay has not been deployed to a persistent public server. Direct localhost Chromium navigation is restricted in this environment; browser test harness loads the real scripts in-memory with a simulated WebSocket. The live Node multiplayer transport is tested separately.
- Walk-to-object navigation is collision-aware but complex moving crowds and physical low-end phone GPUs are not fully validated.
- Procedural avatar poses and objects remain simpler than professional Sims-grade modeled/rigged 3D assets.

---

# V7 Island Life — 13 November 2026

- Added four server-authoritative needs (food, energy, hygiene, social), private to each housemate.
- Added actual benefits and costs to room activities; sleep restores energy, eating restores hunger, showers restore hygiene, conversations and games restore social needs.
- Added movement lock for sleep/meal/shower and a cancel-activity operation. Benefits and Notes are granted only on completion.
- Added pool floaters and ladder, beach shower, hammocks, picnic furniture, volleyball court/net, bonfire, cabana grill, juice bar, surfboards and lanterns. Added collision envelopes for significant props.
- Fixed mid-game render failures by recovering WebGL context to a new software canvas and rebinding pointer handlers; added manual compatibility-graphics option.
- Added four small needs gauges without a large permanent dashboard; moved toasts away from gauges and hid the player's own overhead label.
- Added optional desktop/mobile Chromium harness, forced render-error recovery test and real-viewer camera regression, alongside unit tests.
- Verification: 27 unit/simulation tests passed; 3-client real Node WebSocket smoke test passed; 4 in-memory Chromium visual/interaction scenarios passed.
- Limitations: V7 is a procedural 3D prototype; no production Vercel deployment, permanent database or real mobile GPU validation.

---

# The House V6 — critical usability patch

Date: 13 November 2026

## Root cause
The V5 application tried to bind a `click` event to `#drawer-people`, which had been deleted during the minimal-UI redesign. The resulting null dereference aborted module evaluation before `requestAnimationFrame(loop)` and most close-button handlers could register. A second missing element, `#voice-toggle`, would also throw when a player joined or closed a connection.

## Fixes
- Re-added both controls to the DOM (Housemates navigation and housemate-only opt-in microphone).
- Displayed the menu close X on desktop and mobile; connected it to close all overlays.
- Added Back to game and Leave game actions; exiting stops the session and voice.
- Added X actions to camera and room pickers.
- Added a software rendering fallback for failed WebGL2 initialization, with a guarded render loop.
- Reduced software renderer workload while menus and the welcome screen are visible to keep buttons responsive.
- Added static DOM startup regression checks.

## Validation
- `npm test`: 21/21 passed.
- `npm run test:integration`: passed.
- In-memory Chromium render/UI tests: desktop 1180×740 and mobile 390×844, viewer and housemate onboarding, Menu/X, Housemates, camera menu, Escape, room picker, Back, Leave; zero uncaught JavaScript errors.
- Live localhost Chromium navigation blocked by environment policy; GPU hardware, deployed build, and physical phone performance not verified.

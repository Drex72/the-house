# Contextual interactions and animation system

The House uses simulation-game-style **object-first** interactions: tap a physical object, see actions for that object, and let the character walk there. The menu appears only when selected; it is not another always-visible HUD.

## Coverage

There are **65 interactive objects across all 24 playable rooms**. The shared `INTERACTABLES` catalog in `public/js/world-layout.js` is the single source of truth for the object ID, floor, room, bounding envelope and offered actions. Existing seating and consent-based cuddling are preserved.

Examples:

- **Living room TV and remote:** watch a movie, power on/off, switch through three fictional channels, start movie night. The physical remote is placed on the coffee table. TV state is shared across viewers and housemates in the server snapshots; the actual screen changes colour/graphics when switched on.
- **Afrobeats studio:** click the stereo, its speakers or its production mixer to start/pause/advance one of three **original synth-generated** in-game tracks. Studio-only local sound requires an explicit tap to enable it and respects browser autoplay restrictions; it is not a radio stream or a playback of copyrighted songs.
- **Furniture:** sit, lie down, sleep, read, snack, use mirrors, try outfits, and inspect. Sitting and shared poses are server-owned. A cuddle invitation is private and only valid with an explicit response from the other player.
- **Kitchen, bathrooms and wellness:** open fridge, prepare meals, clean/wash, shower, bathe, stretch, meditate. Timed activities apply need changes on completion, not on click.
- **Compound and beach:** swim, play volleyball, surf, relax under an umbrella, interact with the bonfire and cabana bar.
- **Other objects:** inspect is available as a universal safe secondary action, and stairs change floors according to existing access rules.

## Flow

1. Client projects the click into a world ray and intersects **3D AABBs**, nearest first, rather than simply picking the closest projected bounding rectangle. This prevents a foreground coffee table from stealing taps on a visible television screen.
2. The contextual menu shows the object label and action choices. The client takes a collision-aware route to a nearby valid position if required.
3. The server validates player role, object ID, action ID, floor, current room, maximum interaction distance and relevant occupancy/consent. Clients cannot invent actions or teleport via an interaction message.
4. The server broadcasts the resulting pose, short-lived gesture or public appliance state in periodic snapshots. A renderer uses hand gestures, activity-specific held props and animated device overlays.
5. Timed actions apply health/need effects and rewards only when completed. Free poses can be ended using Stand up. Movement cancels auto-walk.

## Original audio implementation

`public/js/stereo.js` uses Web Audio oscillators and envelopes to generate three short original repeating patterns. There are no remote samples, YouTube embeds, Spotify links, licensed recordings or audio assets. **Audio is muted by default**, the user must click Play or Enable sound, and the local synthesizer stops when outside the studio or when the server switches the stereo off. The server transmits only track/power state, not raw audio.

## Adding more interactions

Register a physical prop with a unique ID, correct room/floor and reasonable AABB in `interactableDefinitions`. Add each new action to `OBJECT_ACTIONS`. In `server/game.mjs`, handle new shared state or moment action in the `object-act` case; don't allow client-only state changes that grant currency, access or other game benefits. Add a corresponding visible mesh to `public/js/scene.js` for any new small prop. Test with `npm test` and pointer scripts. Never allow a private-room actor or private-camera area to become visible to spectators.

## Validation and limitations

The game's procedural figures perform lightweight animated gestures and simple poses, **not** professional skeletal animations, inverse-kinematics or motion-captured contact alignment. Object picking uses proxy boxes, so unusually shaped meshes need tighter future bounds. The TV has simulated channel graphics instead of streaming real movies. The stereo plays original synthesized audio only after a local user gesture; hardware/device latency and multi-device audio playback still require physical testing.

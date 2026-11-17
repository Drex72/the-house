# The House · Resort Visual Direction

## Reference and intent
The user's 17 November 2026 poolside reference is the benchmark for the next rendering iterations. The game should feel like a **sunlit, privately owned island beach resort** — beach sand, turquoise water, pale stone decking, mature linen/teak furniture, and small charcoal-and-gold UI labels. Avoid saturated prototype panels, unrelated roads, crowded overlays and disconnected props.

## Scene palette
- **Travertine deck:** `#e8dfd0`; understated grout `#d5c9b7`; raised coping `#ede7dc`
- **Water:** `#43b1ad` sunlit top; `#287b84` pool basin; existing open-water hues behind the compound
- **Fabrics:** `#f2eee4` linen cushions; `#f3eee2` umbrellas and shade
- **Timber:** `#64432f` sunbeds; `#76533d` canopy structure
- **Interface:** charcoal `#30343d`, ivory and restrained warm champagne accents

## Implementation invariants
1. Do not change authoritative multiplayer movement, room access, player count, gender-restricted wings or collision.
2. Keep pool and loungers at their existing clickable coordinates; details are non-colliding art dressing.
3. Use WebGL2 when available. Preserve the Canvas2D fallback, including its camera-occlusion corrections.
4. Caustics use existing shader uniforms and don't introduce per-frame CPU mesh generation.
5. The photographed reference illustrates *intended quality*, not a statement that the current procedural assets reach photorealism.
6. The island compound is the entire traversable world — no roads or surrounding commercial buildings.

## Visual review gates
- Capture the **pool room** at 1180×740 and 390×844, alongside standard housemate and viewer views.
- Inspect furniture silhouettes, pool edges, color separation, contact with support surfaces, camera visibility and UI safe margins.
- Verify gameplay menus, object picking, camera modes, WebGL failure recovery and private-room boundaries.
- Run code syntax, unit/simulation, three-client WebSocket integration and browser visual checks on each PR.
- Merge only once review screenshots show an improvement. Record remaining low-poly, physical-device and shader limitations without overstating fidelity.

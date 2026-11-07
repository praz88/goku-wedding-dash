# Contributing

| What | Where |
|---|---|
| Story cards, lore, anomaly text | `js/story.js` |
| The 3D hall, props, anomaly effects (`APPLY` table), `reset()` | `js/scene.js` |
| Procedural textures (boards, posters, signs, floor, walls) | `js/textures.js` |
| Sound (all synthesized) | `js/audio.js` |
| Game flow, controls, post-processing | `js/main.js` |
| Leaderboard server | `server.js` |

## Add an anomaly
1. `js/story.js` → add to `ANOMS`: `{ id, prop, lore, reveal }`. `prop` is the
   thing the player taps to read the creepy version (see `LORE` keys).
2. `js/scene.js` → add `id: () => { ... }` to the `APPLY` table, and undo it in
   `reset()`. Props are plain three.js objects; look at how `cabin_eyes` or
   `bench_face` do it.
3. Test with `http://localhost:8080/?anom=your_id`.

## Add a prop
Build it in `scene.js`, call `reg('yourId', ...meshes)` so it's tappable, add
`LORE.yourId` in `story.js`, and (optionally) a `propPos` entry for spatial sound.

## Rules
- No build step, no npm dependencies at runtime (three.js is vendored).
- Keep total assets small; compress models with `gltf-transform optimize`.
- Keep it funny. Keep it PG.
- No real people's names, phone numbers, or employers in the code or assets.
  Roast-mode names are typed by players and stay in `localStorage`.
- Test on a phone before opening a PR.

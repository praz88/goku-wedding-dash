# Contributing

Everything lives in `index.html` (game) and `server.js` (leaderboard). No build.

## Add an anomaly (the fun one)
1. Pick a prop in `PROPS` (clock, calendar, portrait, notice, npa, cabin,
   chairs, desk, cooler, plant, locker, exit, atm, cctv, mantapa).
2. In that prop's `draw(a)`, add a branch for your new id, e.g.
   `if(a==='plant_eyes'){ ... }`.
3. Add an entry to `ANOMS`:
   `{ id:'plant_eyes', prop:'plant', lore:'what you see when you tap it', reveal:'one line shown after a wrong call' }`
4. Test: open `index.html`, play until it appears (or temporarily force it in `pickAnomaly`).

## Add a prop
Add to `PROPS` with `x,y` (tap centre), a `draw(a)` and `lore`, and put its id
in the `order` array in `draw()`.

## Story
`STORY` holds the cards between walks. `TIMES` holds the clock labels.
`<b>` and `<i>` are allowed; keep each card under ~90 words — people read
these on phones.

## Rules
- Single file, zero dependencies, works offline.
- Keep it funny. Keep it PG.
- No real people's names, phone numbers, or employers in the code or assets.
  Roast-mode names are typed by players and stay in `localStorage`.
- Test on a phone before opening a PR.

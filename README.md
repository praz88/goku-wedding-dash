# 👹 Goku's Wedding Dash: Weekend Nightmare

A horror-comedy lane runner about a bank manager trying to reach his own
South Indian wedding while his branch manager and customers refuse to
acknowledge the existence of weekends.

Three nights. Three levels. One muhurtha.

- **Night 1 — The Branch After Hours:** zombie customers, bleeding ATM.
- **Night 2 — Silk Board:** possessed phones, ghost autos, no signal.
- **Night 3 — The Mantapa:** the Branch Manager (final form) hurls calls at you until the thaali is tied.

Features: 8 playable runners with different perks (Goku, Bosi, Kailu, Shivanna the guard, Manju the chai guy, Shastri the purohit, Ranga the peon, Auto Anna), jump/duck obstacles, 21 callers, ಕನ್ನಡ call lines, synth sound effects (Web Audio), spoken calls via speech synthesis, and an online leaderboard. No build step, no npm dependencies.

## Play

Online: **https://goku-wedding-dash.fly.dev**

Local: `node server.js` then open http://localhost:8080 (leaderboard saves to `scores.json`). Or just open `index.html` — everything works except the shared leaderboard.

## Deploy (Fly.io)

```sh
fly launch --copy-config --yes   # first time
fly deploy                        # afterwards
```

Pushes to `main` auto-deploy via GitHub Actions if the repo has a
`FLY_API_TOKEN` secret (`fly tokens create deploy -x 999999h`).

## Contributing

PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). Easy wins:

- New call lines (add to `CALLS` in `index.html`, English + Kannada)
- New levels (add to `LEVELS` — each is a plain object)
- More languages (Tamil, Telugu, Hindi…)
- Better monsters, music, a boss per level, a weekly leaderboard reset

## License

MIT

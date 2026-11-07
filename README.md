# 👹 Goku's Wedding Dash: Weekend Nightmare

A horror-comedy lane runner about a bank manager trying to reach his own
South Indian wedding while his branch manager and customers refuse to
acknowledge the existence of weekends.

Three nights. Three levels. One muhurtha.

- **Night 1 — The Branch After Hours:** zombie customers, bleeding ATM.
- **Night 2 — Silk Board:** possessed phones, ghost autos, no signal.
- **Night 3 — The Mantapa:** the Branch Manager (final form) hurls calls at you until the thaali is tied.

Features: ಕನ್ನಡ call lines, synth sound effects (Web Audio), spoken calls via the browser's speech synthesis, no build step, no dependencies.

## Play

Open `index.html` in a browser. That's it. Tap left/right or use ← →.

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
- Better monsters, a leaderboard, music, a mobile swipe gesture

## License

MIT

# 👹 Goku's Wedding Dash: Weekend Nightmare

A slow horror-comedy browser game about a bank manager, a wedding on Sunday,
and a phone that does not know what a weekend is.

**Play: https://goku-wedding-dash.fly.dev**

## How it plays

It's an *anomaly hunt* (think *Exit 8*, *Escape Work*): you walk the same
branch corridor from Friday night to Sunday's muhurtha. Tap anything to look
closer — the clock, the Manager's cabin, the NPA board, the customer chairs,
the water cooler. That's where the story is.

- If **anything is wrong**, turn back.
- If it's **a normal night**, go on.
- Eight right calls → the mantapa. One wrong call → Friday, 11:58 PM, again.

Story cards between walks introduce the Manager, the customers, and the three
who got away. **Roast mode** lets your group type their own names on their
own phones; those names never leave the device.

Features: 21 anomalies, typewriter story cards (optionally read aloud),
synth ambience (Web Audio), online leaderboard. One HTML file, zero npm deps.

## Run locally

```sh
node server.js        # http://localhost:8080, leaderboard saved to scores.json
```
Or just open `index.html` — everything works except the shared leaderboard.

## Deploy (Fly.io)

Pushes to `main` auto-deploy via GitHub Actions (`FLY_API_TOKEN` secret).
The leaderboard lives on a 1 GB Fly volume named `data`.

## Contributing

PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). The easiest, most fun
contribution is **a new anomaly**: one entry in `ANOMS` plus a draw branch in
the prop it belongs to. Keep it creepy-funny, keep it PG, no real people.

## License

MIT

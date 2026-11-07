# Contributing

Everything lives in one file: `index.html`. No build, no framework.

## Adding call lines
Find `const CALLS = [...]`. Add `{ who, en, kn }`. Keep it short enough to fit two lines on a phone.

## Adding a level
Find `const LEVELS = [...]`. Copy an entry and change `tag`, `title`, `story`,
`hint`, `sky` (3 gradient stops), `speed`, `dur` (seconds), `enemies` (emoji),
`enemyRate`, `callRate`, `boss`.

## Adding a language
Add a key (e.g. `ta`) to each `CALLS` entry, a checkbox in the start overlay,
and extend the `opt.kn ? ... : ...` branches into a `lang` switch. PRs that
refactor this into a proper `LANG` table are very welcome.

## Rules
- Keep it a single file with zero dependencies.
- Keep it funny. Keep it PG.
- No real people's names, phone numbers, or employers in the game content.
- Test on a phone before opening a PR.

# NEPA! — Light Up Lagos

A free, mobile-friendly cable puzzle for [start.ng](https://start.ng/). Rotate cables to reconnect Lagos, one district at a time. Built with plain HTML, CSS and JavaScript; no build, server, packages or secrets required.

## Implemented features

- A 90-second run through randomly generated, solvable districts. The board grows from 4×4 to 5×5 after two districts, and 6×6 after five.
- Connected cables glow. Power every tile from the top-left station to clear a district, earn energy and add 15 seconds. A hint restores one tile for 5 seconds.
- Each district earns `tile count × 20 + max(0, tile count × 3 − rotations) × 5` energy. Hints count as one rotation. Partial districts earn no energy.
- Touch, mouse, and keyboard play, optional synthesized sound, pause/resume, automatic pause when the tab is hidden, and reduced-motion support.
- Device personal best and start.ng profile card, sign-in, score submission and shared top-five leaderboard. Guests can play without an account.

## Quick start

Prerequisites: a modern browser. Python 3 is useful for a local server; Node.js 18+ runs checks.

```sh
python -m http.server 4173
```

Open `http://localhost:4173`. No installation or configuration is needed. Internet access loads optional Google Fonts; system fonts are the fallback.

## Usage

Choose **Power up Lagos**. Tap any tile to turn it clockwise. Follow the lime glow from the top-left ϟ station and connect every tile. Clear districts before time runs out. Use **Hint** for a five-second penalty, **Ⅱ** to pause, and **One more shift** to replay.

Keyboard: Tab between controls, Enter or Space to activate, arrow keys to move between tiles, P or Escape to pause/resume. The timer stays paused after returning to a hidden tab until you resume.

## Verification

```sh
node --test engine.test.cjs
node --check engine.js
node --check game.js
```

The engine tests cover 600 generated puzzles across all sizes, rotational solvability, reciprocal connections and grid boundaries. Manually check start, rotations, pause/resume, hint penalties, completion, replay, narrow screens and time expiration. Real identity and shared scores can only be checked on the published start.ng subdomain.

## Publishing

Follow [start.ng's requirements](https://start.ng/docs.md). Commit these ready-to-play root files to a public GitHub repository. No build command is needed. `startng.json` declares the `score` and `districts` integer leaderboard columns. `cover.png` is the game card art.

POST the public `repo_url` and chosen `name` as JSON to `https://api.start.ng/games/check`, resolve errors, then POST the same body to `https://api.start.ng/games/publish`. A new game returns an `approve_url` for the owner to open, sign in and confirm. Only after approval is it live and listed on the homepage. Subsequent pushes update the linked game automatically; publishing again requests an immediate update.

## Limitations

- start.ng identity and shared scores require the published `*.start.ng` origin. Local play uses a guest label and a device best. Connection failures do not prevent gameplay; failed score submissions are reported and are not retried automatically.
- Device best storage can be blocked or cleared by browser settings. Shared leaderboards require a signed-in start.ng account; client scores cannot be cheat-proof.
- An interrupted or refreshed run is not saved. Hints restore the generated solution; alternative valid connections may also solve a board.
- The final start.ng account approval belongs to the owner. A pending approval is not a live deployment.

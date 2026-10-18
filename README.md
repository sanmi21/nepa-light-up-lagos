# NEPA! — Light Up Lagos

A free, mobile-friendly **Three.js 3D cable puzzle** for [start.ng](https://start.ng/). Rotate cables to reconnect Lagos, one district at a time. [Play the published game](https://nepa-light-up-lagos.start.ng/).

The ready-to-play HTML, CSS, JavaScript and bundled Three.js files are committed at the repository root. Playing or hosting the game requires no build step, installation, backend or secrets.

## Implemented features

- Three.js renders the actual playable board using WebGL: raised tile meshes, cylindrical cables, animated clockwise turns, responsive station lights and a skyline that lights up with the grid. Raycasting selects the tile under a mouse click or touch. This is the primary game renderer, not an optional decorative scene.
- A 90-second run through randomly generated, solvable districts. The board grows from 4×4 to 5×5 after two districts, and 6×6 after five.
- Connected cables glow. Power every tile from the top-left station to clear a district, earn energy and add 15 seconds. A hint restores one tile for 5 seconds.
- Each district earns `tile count × 20 + max(0, tile count × 3 − rotations) × 5` energy. Hints count as one rotation. Partial districts earn no energy.
- Touch, mouse, and keyboard play, optional synthesized sound, pause/resume, automatic pause when the tab is hidden, and reduced-motion support.
- Device personal best and start.ng profile card, sign-in, score submission and shared top-five leaderboard. Guests can play without an account.

## Quick start

Prerequisites: a modern browser with WebGL 2 for the 3D board. Python 3 is useful for a local server; Node.js 18+ runs checks. Devices without WebGL automatically receive the playable flat board.

```sh
python -m http.server 4173
```

Open `http://localhost:4173`. Use an HTTP server rather than opening `index.html` directly, because browser ES modules require HTTP. No installation or configuration is needed to play. Internet access loads optional Google Fonts; system fonts are the fallback. Three.js itself is served locally from `vendor/`.

## Usage

Choose **Power up Lagos**. Tap any tile to turn it clockwise. Follow the lime glow from the top-left ϟ station and connect every tile. Clear districts before time runs out. Use **Hint** for a five-second penalty, **Ⅱ** to pause, and **One more shift** to replay.

The board shows **3D GRID · THREE.JS** when the WebGL renderer is active. Powered cables glow lime, tile lamps turn warm yellow, and nearby buildings light up. Focused or hovered tiles lift slightly. If WebGL initialization fails or its context is lost, the game switches to **2D mode** while keeping the current puzzle and clock.

Keyboard: Tab between controls, Enter or Space to activate, arrow keys to move between tiles, P or Escape to pause/resume. The timer stays paused after returning to a hidden tab until you resume.

## Verification

```sh
node --test engine.test.cjs
node --check engine.js
node --check game.js
node --check board3d.js
```

The engine tests cover 600 generated puzzles across all sizes, rotational solvability, reciprocal connections and grid boundaries. The same checks are available through `npm test` and `npm run check`.

For browser integration tests, install the development-only dependency and browser once:

```sh
npm install
npx playwright install chromium
npm run test:browser
```

`browser.test.cjs` starts and closes its own local server and headless browser. It checks real Three.js WebGL rendering, raycast rotation, keyboard actions, district completion, hints, pause/resume, 4×4/5×5/6×6 grids, sound, time expiration/replay, mobile overflow, and fallback after WebGL context loss or startup failure. Desktop and mobile screenshots are written to ignored `test-results/`. Optional `BROWSER_EXECUTABLE` selects an existing Chromium/Chrome installation.

During this implementation these browser checks passed using the workspace's bundled Playwright and installed Chrome; the fresh `npm install` and Playwright browser download were not needed or separately verified. Real signed-in identity and shared score submission require a published start.ng origin and a player account.

## Three.js implementation

`game.js` imports `board3d.js`, which imports the local **Three.js 0.180.0 (r180)** ES module. `index.html` loads the game as a browser module. `board3d.js` creates the scene, orthographic camera, WebGL renderer, lighting, tile/cable meshes, pointer raycaster and animation loop. It synchronizes those objects with the existing puzzle engine's cable masks and powered cells. Renderer resources are reused across turns and disposed when replacing districts or falling back.

The DOM tile controls remain available to keyboard and screen-reader users while the visible board is 3D. A non-WebGL fallback preserves playability; reduced-motion preferences remove turn interpolation. Pixel ratio is capped at 1.75 to limit mobile rendering cost, and unchanged scenes are not redrawn.

The upstream library is bundled unchanged as `vendor/three.module.js` and `vendor/three.core.js`; its MIT license is preserved in [`vendor/three-LICENSE.txt`](vendor/three-LICENSE.txt). There are no runtime npm or CDN script dependencies.

## Publishing

Follow [start.ng's requirements](https://start.ng/docs.md). Commit these ready-to-play root files to a public GitHub repository. No build command is needed. `startng.json` declares the `score` and `districts` integer leaderboard columns. `cover.png` is the game card art.

POST the public `repo_url` and chosen `name` as JSON to `https://api.start.ng/games/check`, resolve errors, then POST the same body to `https://api.start.ng/games/publish`. A new game returns an `approve_url` for the owner to open, sign in and confirm. Only after approval is it live and listed on the homepage. Subsequent pushes update the linked game automatically; publishing again requests an immediate update.

## Limitations

- start.ng identity and shared scores require the published `*.start.ng` origin. Local play uses a guest label and a device best. Connection failures do not prevent gameplay; failed score submissions are reported and are not retried automatically.
- Device best storage can be blocked or cleared by browser settings. Shared leaderboards require a signed-in start.ng account; client scores cannot be cheat-proof.
- An interrupted or refreshed run is not saved. Hints restore the generated solution; alternative valid connections may also solve a board.
- The 3D renderer needs WebGL 2 and working browser graphics support. Devices using the explicitly labeled 2D fallback do not render the board in Three.js.
- The final start.ng account approval belongs to the owner. A pending approval is not a live deployment.

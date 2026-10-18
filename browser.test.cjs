const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (error, content) => {
    res.writeHead(error ? 404 : 200, {'Content-Type':types[path.extname(file)] || 'text/plain'});
    res.end(error ? 'Not found' : content);
  });
});
async function main() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless:true, ...(process.env.BROWSER_EXECUTABLE ? {executablePath:process.env.BROWSER_EXECUTABLE} : {}), args:['--enable-unsafe-swiftshader'] });
  try {
    const context = await browser.newContext({viewport:{width:1280,height:1100}});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    // A deterministic valid puzzle: only the source is scrambled, so input can
    // complete real districts without reaching into the game's private state.
    await page.addInitScript(() => { Math.random = () => 0; });
    await page.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    await page.goto(origin);
    await page.waitForSelector('#board-stage.three-ready');
    assert.equal(await page.locator('#board3d').getAttribute('data-renderer'), 'three.js r180');
    assert.equal(await page.locator('#board3d canvas').count(), 1);
    await page.locator('#start').click();
    const before = await page.locator('#grid button').first().innerHTML();
    // Project a tile center into canvas space, then use a real pointer event.
    const point = await page.evaluate(async () => {
      const THREE = await import('./vendor/three.module.js');
      const extent = 4 * .6 + .25;
      const camera = new THREE.OrthographicCamera(-extent,extent,extent,-extent,.1,60);
      camera.position.set(1.8,10,6.2);camera.lookAt(0,0,0);camera.updateMatrixWorld();
      const p = new THREE.Vector3(-1.5,.1,-1.5).project(camera);
      const rect = document.querySelector('canvas').getBoundingClientRect();
      return {x:rect.x+(p.x+1)*rect.width/2,y:rect.y+(1-p.y)*rect.height/2};
    });
    await page.mouse.click(point.x, point.y);
    assert.notEqual(await page.locator('#grid button').first().innerHTML(), before, 'raycast click rotates the selected tile');
    await page.locator('#grid button').first().focus();
    await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('#cleared').textContent === '1');
    assert.ok(Number(await page.locator('#score').textContent()) > 0);
    await page.waitForFunction(() => document.querySelector('#district').textContent.includes('Surulere'));
    await page.locator('#pause').click();
    assert.equal(await page.locator('#overlay-title').textContent(), 'The city can wait.');
    const paused = await page.locator('#time').textContent();
    await page.waitForTimeout(250);
    assert.equal(await page.locator('#time').textContent(), paused);
    await page.locator('#start').click();
    const timeBeforeHint = parseInt(await page.locator('#time').textContent());
    await page.locator('#hint').click();
    await page.waitForFunction(() => document.querySelector('#cleared').textContent === '2');
    // Hint fixes the remaining tile: -5 seconds plus a +15 district bonus.
    assert.ok(parseInt(await page.locator('#time').textContent()) <= timeBeforeHint + 10);
    await page.waitForFunction(() => document.querySelectorAll('#grid button').length === 25);
    assert.equal(await page.locator('#board3d canvas').count(), 1, 'canvas is reused across districts');
    await page.locator('#sound').click();
    assert.equal(await page.locator('#sound').getAttribute('aria-pressed'), 'true');
    for (let district = 3; district <= 5; district++) {
      await page.locator('#grid button').first().focus();
      for (let i=0;i<3;i++) await page.keyboard.press('Enter');
      await page.waitForFunction(value => Number(document.querySelector('#cleared').textContent) === value, district);
      await page.waitForFunction(value => document.querySelector('#district').textContent.startsWith(String(value+1).padStart(2,'0')), district);
    }
    assert.equal(await page.locator('#grid button').count(), 36);
    fs.mkdirSync(path.join(root,'test-results'), {recursive:true});
    await page.screenshot({path:path.join(root,'test-results','desktop-3d.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:path.join(root,'test-results','mobile-3d.png'),fullPage:true});
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile layout fits');
    // Context loss must return the same playable puzzle to the flat renderer.
    await page.evaluate(() => document.querySelector('canvas').dispatchEvent(new Event('webglcontextlost',{cancelable:true})));
    assert.equal(await page.locator('#board-stage').getAttribute('class'),'board-stage');
    assert.equal(await page.locator('#board3d canvas').count(),0);
    await page.locator('#grid button').first().click();
    assert.deepEqual(errors,[],'no uncaught browser errors');
    await context.close();
    // Explicit WebGL failure at startup should also preserve playability.
    const fallback = await browser.newContext();
    const flat = await fallback.newPage();
    await flat.addInitScript(() => {
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type,...args) { return type.startsWith('webgl') ? null : get.call(this,type,...args); };
    });
    await flat.goto(origin);
    await flat.waitForFunction(() => document.querySelector('#render-mode').textContent.includes('2D mode'));
    await flat.locator('#start').click();
    await flat.locator('#grid button').first().click();
    await fallback.close();
    // Advance the real timer with a controlled browser clock, then replay.
    const timed = await browser.newPage();
    await timed.clock.install();
    await timed.goto(origin);
    await timed.waitForSelector('#board-stage.three-ready');
    await timed.locator('#start').click();
    await timed.clock.fastForward(91000);
    assert.equal(await timed.locator('#overlay-label').textContent(),'NIGHT SHIFT COMPLETE');
    assert.equal(await timed.locator('#time').textContent(),'0s');
    await timed.locator('#start').click();
    assert.equal(await timed.locator('#cleared').textContent(),'0');
    assert.equal(await timed.locator('#overlay').isHidden(),true);
    await timed.close();
    console.log('PASS: Three.js WebGL render, raycast rotation, keyboard play, district completion, hints, pause/resume, 4/5/6 grids, sound, desktop/mobile layout, context-loss/startup fallback, time expiry and replay.');
  } finally { await browser.close(); }
}
main().catch(error => {console.error(error); process.exitCode=1;}).finally(() => server.close());

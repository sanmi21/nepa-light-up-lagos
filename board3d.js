import * as THREE from './vendor/three.module.js';

// Three.js owns the visible game board and pointer picking. The DOM grid supplies
// the same actions to keyboard and assistive-technology users, or a WebGL fallback.
export function createBoard3D(host, { onTurn, onUnavailable }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.5;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-3, 3, 3, -3, .1, 60);
  camera.position.set(1.8, 10, 6.2);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xe6fff1, 0x183247, 2.4));
  const sun = new THREE.DirectionalLight(0xffecd5, 3);
  sun.position.set(-4, 9, 5);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x8ce1ff, 1.8);
  rim.position.set(5, 4, -4);
  scene.add(rim);
  const world = new THREE.Group();
  scene.add(world);
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const geometries = {
    tile: new THREE.BoxGeometry(.91, .19, .91),
    arm: new THREE.CylinderGeometry(.055, .055, .5, 10),
    joint: new THREE.SphereGeometry(.075, 12, 8),
    post: new THREE.CylinderGeometry(.018, .025, .16, 6),
    lamp: new THREE.SphereGeometry(.045, 10, 8),
    building: new THREE.BoxGeometry(1, 1, 1),
    window: new THREE.PlaneGeometry(.045, .065),
  };
  const cityOff = new THREE.MeshStandardMaterial({ color: 0x29434a, roughness: .8 });
  const cityOn = new THREE.MeshStandardMaterial({ color: 0x536848, roughness: .8 });
  const windowOff = new THREE.MeshBasicMaterial({ color: 0x243a43 });
  const windowOn = new THREE.MeshBasicMaterial({ color: 0xffd580 });
  const postMat = new THREE.MeshStandardMaterial({ color: 0x70827a, metalness: .6, roughness: .4 });
  const platformMat = new THREE.MeshStandardMaterial({ color: 0x0b161c, roughness: .75 });
  let boardKey = '', size = 4, enabled = false, tileObjects = [], picks = [], skyline = [];
  let hovered = -1, focused = -1, hinted = -1, hintUntil = 0, dirty = true, lastTime = 0;

  function disposeBoard() {
    for (const tile of tileObjects) { tile.base.material.dispose(); tile.cable.material.dispose(); tile.lamp.material.dispose(); }
    world.clear(); tileObjects = []; picks = []; skyline = [];
  }
  function mesh(geometry, material, x, y, z, parent = world) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z); parent.add(object); return object;
  }
  function rebuild(tiles, n) {
    disposeBoard(); size = n;
    const platform = mesh(geometries.building, platformMat, 0, -.23, 0);
    platform.scale.set(n + .3, .22, n + .3);
    tiles.forEach((mask, i) => {
      const group = new THREE.Group();
      group.position.set(i % n - (n - 1) / 2, 0, Math.floor(i / n) - (n - 1) / 2);
      world.add(group);
      const base = mesh(geometries.tile, new THREE.MeshStandardMaterial({ color: 0x29434a, roughness: .45, metalness: .22 }), 0, 0, 0, group);
      base.userData.index = i; picks.push(base);
      const cables = new THREE.Group(); group.add(cables);
      const cableMaterial = new THREE.MeshStandardMaterial({ color: 0x667e83, roughness: .35, metalness: .35, emissive: 0x000000 });
      const cable = mesh(geometries.joint, cableMaterial, 0, .14, 0, cables);
      for (let d = 0; d < 4; d++) if (mask & (1 << d)) {
        const x = [0, .25, 0, -.25][d], z = [-.25, 0, .25, 0][d];
        const arm = mesh(geometries.arm, cableMaterial, x, .14, z, cables);
        arm.rotation[d % 2 ? 'z' : 'x'] = Math.PI / 2;
      }
      mesh(geometries.post, postMat, -.31, .19, .31, group);
      const lamp = mesh(geometries.lamp, new THREE.MeshBasicMaterial({ color: 0x465e5c }), -.31, .29, .31, group);
      if (i === 0) {
        const station = mesh(geometries.building, postMat, -.31, .16, -.31, group);
        station.scale.set(.19, .18, .19);
        const beacon = mesh(geometries.joint, new THREE.MeshBasicMaterial({ color: 0xffd580 }), -.31, .3, -.31, group);
        // Share the beacon material with this tile's lamp for disposal.
        beacon.material.dispose(); beacon.material = lamp.material;
      }
      tileObjects.push({ group, base, cables, cable, lamp, mask, angle: 0, target: 0, online: false });
    });
    // A small city grows bright as the actual puzzle's powered fraction rises.
    for (let i = 0; i < n + 2; i++) {
      const height = .22 + ((i * 7) % 5) * .1;
      const x = (i - (n + 1) / 2) * .65;
      const building = mesh(geometries.building, cityOff, x, height / 2 - .08, -n / 2 - .45);
      building.scale.set(.38, height, .32);
      const windows = [];
      for (let w = 0; w < 2; w++) windows.push(mesh(geometries.window, windowOff, x + (w ? .08 : -.08), height * .6, -n / 2 - .285));
      skyline.push({ building, windows });
    }
    const extent = n * .6 + .25;
    camera.left = -extent; camera.right = extent; camera.top = extent; camera.bottom = -extent;
    camera.updateProjectionMatrix(); dirty = true;
  }
  function sync({ tiles, n, solution, live, active }) {
    enabled = active;
    const key = solution.join(',');
    if (key !== boardKey) { boardKey = key; hovered = focused = hinted = -1; rebuild(tiles, n); }
    tileObjects.forEach((tile, i) => {
      let mask = tile.mask;
      for (let steps = 0; steps < 4; steps++) {
        if (mask === tiles[i]) { tile.target -= steps * Math.PI / 2; break; }
        mask = ((mask << 1) & 15) | (mask >> 3);
      }
      tile.mask = tiles[i]; tile.online = live.has(i);
      tile.cable.material.color.set(tile.online ? 0xd4f777 : 0x688187);
      tile.cable.material.emissive.set(tile.online ? 0x91bd32 : 0x000000);
      tile.cable.material.emissiveIntensity = tile.online ? .65 : 0;
      tile.lamp.material.color.set(tile.online ? 0xffdc86 : 0x465e5c);
    });
    skyline.forEach(({ building, windows }, i) => {
      const lit = i / skyline.length < live.size / (n * n);
      building.material = lit ? cityOn : cityOff;
      windows.forEach(w => { w.material = lit ? windowOn : windowOff; });
    });
    dirty = true;
  }
  function pick(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    scene.updateMatrixWorld(true); raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(picks, false)[0]?.object.userData.index ?? -1;
  }
  let down = null;
  renderer.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, index: pick(e) }; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (enabled && down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 12 && down.index === pick(e) && down.index >= 0) onTurn(down.index);
    down = null;
  });
  renderer.domElement.addEventListener('pointercancel', () => { down = null; });
  renderer.domElement.addEventListener('pointermove', e => { hovered = enabled ? pick(e) : -1; renderer.domElement.style.cursor = hovered >= 0 ? 'pointer' : 'default'; dirty = true; });
  renderer.domElement.addEventListener('pointerleave', () => { hovered = -1; dirty = true; });
  renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); renderer.setAnimationLoop(null); onUnavailable(); });
  const resize = new ResizeObserver(() => {
    const { width, height } = host.getBoundingClientRect();
    if (width && height) { renderer.setSize(width, height, false); dirty = true; }
  });
  resize.observe(host);
  renderer.setAnimationLoop(time => {
    if (document.hidden) { lastTime = time; return; }
    const delta = Math.min(.05, (time - lastTime) / 1000 || .016); lastTime = time;
    let moving = false;
    tileObjects.forEach((tile, i) => {
      const distance = tile.target - tile.angle;
      tile.angle = reducedMotion.matches || Math.abs(distance) < .002 ? tile.target : tile.angle + distance * Math.min(1, delta * 18);
      tile.cables.rotation.y = tile.angle;
      moving ||= Math.abs(distance) >= .002;
      const highlight = enabled && (i === hovered || i === focused || (i === hinted && time < hintUntil));
      const lift = highlight ? .055 : 0;
      if (tile.group.position.y !== lift) { tile.group.position.y = lift; dirty = true; }
      tile.base.material.color.set(highlight ? 0x587249 : tile.online ? 0x354f38 : 0x29434a);
    });
    if (dirty || moving) { renderer.render(scene, camera); dirty = false; }
  });
  host.dataset.renderer = `three.js r${THREE.REVISION}`;
  return {
    sync,
    focus(index) { focused = index; dirty = true; },
    hint(index) { hinted = index; hintUntil = performance.now() + 3000; dirty = true; },
    dispose() {
      renderer.setAnimationLoop(null); resize.disconnect(); disposeBoard();
      Object.values(geometries).forEach(g => g.dispose());
      [cityOff, cityOn, windowOff, windowOn, postMat, platformMat].forEach(m => m.dispose());
      renderer.dispose(); renderer.domElement.remove();
    },
  };
}

(() => {
  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const T = 16, WORLD = 80;
  const questTitle = document.querySelector('#questTitle');
  const questText = document.querySelector('#questText');
  const progressText = document.querySelector('#progressText');
  const progressFill = document.querySelector('#progressFill');
  const hint = document.querySelector('#hint');
  const toast = document.querySelector('#toast');
  const dialogue = document.querySelector('#dialogue');
  const dialogueText = document.querySelector('#dialogueText');
  const speakerBadge = document.querySelector('#speakerBadge');
  const dialogueNext = document.querySelector('#dialogueNext');
  let width = innerWidth, height = innerHeight, dpr = 1, scale = 1, tileSize = 24;
  let lastTime = 0, elapsed = 0, toastTimer = 0, soundOn = false, audioCtx;
  let phase = 0, petals = 0, dialogueLines = [], dialogueIndex = 0, afterDialogue = null;
  let lastInteract = 0;
  const keys = new Set(), touchDirs = new Set();
  const flowers = [
    { x: 31.5, y: 38.5, found: false, color: '#f5e89c' },
    { x: 40.5, y: 35.5, found: false, color: '#f4c7dc' },
    { x: 43.5, y: 42.5, found: false, color: '#f2e89b' }
  ];
  const mira = { x: 38.5, y: 35.5 };
  const player = { x: 35.5, y: 40.5, facing: 'down', moving: false, step: 0 };
  const obstacles = new Map(), decorations = [];
  const hash = (x, y) => { let n = (x * 374761393 + y * 668265263) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967295; };
  const pathY = x => 41 + Math.sin(x * .13) * 3.2 + Math.sin(x * .37) * .9;
  const keyOf = (x, y) => `${x},${y}`;
  function isSafeSpot(x, y) {
    if (Math.hypot(x - player.x, y - player.y) < 7 || Math.hypot(x - mira.x, y - mira.y) < 2.4) return true;
    return flowers.some(f => Math.hypot(x - f.x, y - f.y) < 1.5);
  }
  function makeWorld() {
    for (let y = 0; y < WORLD; y++) for (let x = 0; x < WORLD; x++) {
      const edge = Math.min(x, y, WORLD - 1 - x, WORLD - 1 - y);
      const r = hash(x + 170, y + 71);
      const nearPath = Math.abs(y - pathY(x)) < 2.8;
      if (!isSafeSpot(x + .5, y + .5) && !nearPath && (edge < 3 ? r > .34 : r > .973)) {
        obstacles.set(keyOf(x, y), edge < 3 || r > .993 ? 'tree' : (r > .985 ? 'rock' : 'bush'));
      }
      if (hash(x + 83, y + 391) > .87) decorations.push({ x, y, kind: hash(x + 410, y) > .5 ? 'grass' : 'flower', variant: hash(x, y + 808) });
    }
  }
  makeWorld();
  function resize() {
    width = innerWidth; height = innerHeight; dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    tileSize = Math.min(width / 20, height / 13, 34);
    scale = tileSize / T;
    ctx.imageSmoothingEnabled = false;
  }
  addEventListener('resize', resize); resize();

  function drawGround(tx, ty) {
    const r = hash(tx + 500, ty + 900);
    const pathDist = Math.abs(ty + .5 - pathY(tx + .5));
    let color = r > .52 ? '#77ae59' : (r > .22 ? '#73a854' : '#6fa451');
    if (pathDist < 1.22) color = r > .56 ? '#c9b979' : '#c4b271';
    else if (pathDist < 1.52) color = r > .5 ? '#91b567' : '#83ad5e';
    ctx.fillStyle = color; ctx.fillRect(tx * T, ty * T, T, T);
    if (pathDist < 1.55) {
      ctx.fillStyle = '#d6c78b';
      if (r > .45) ctx.fillRect(tx * T + 3 + Math.floor(r * 7), ty * T + (pathDist < 1.22 ? 5 : 2), 3, 2);
      if (r > .76) ctx.fillRect(tx * T + 11, ty * T + 10, 2, 2);
    } else {
      if (r > .56) { ctx.fillStyle = '#8abb63'; ctx.fillRect(tx * T + (r > .8 ? 11 : 3), ty * T + (r > .8 ? 4 : 11), 2, 2); }
      if (r < .09) { ctx.fillStyle = '#5e944b'; ctx.fillRect(tx * T + 9, ty * T + 2, 2, 2); }
    }
  }
  function drawFlower(x, y, color, size = 1, glow = false) {
    const bob = Math.sin(elapsed * 2.8 + x * 4) * .45;
    const px = x * T, py = y * T + bob;
    if (glow) { ctx.globalAlpha = .24 + (Math.sin(elapsed * 3 + x) + 1) * .09; ctx.fillStyle = '#fff6bd'; ctx.fillRect(px + 6, py - 2, 4, 2); ctx.fillRect(px + 7, py - 3, 2, 4); ctx.fillRect(px - 1, py + 4, 2, 2); ctx.globalAlpha = 1; }
    ctx.fillStyle = '#447946'; ctx.fillRect(px + 7, py + 7, 2, 6); ctx.fillRect(px + 4, py + 10, 3, 2);
    ctx.fillStyle = color; ctx.fillRect(px + 4, py + 2, 3, 3); ctx.fillRect(px + 9, py + 2, 3, 3); ctx.fillRect(px + 2, py + 5, 3, 3); ctx.fillRect(px + 10, py + 5, 3, 3); ctx.fillRect(px + 5, py + 8, 5, 3);
    ctx.fillStyle = '#f9d675'; ctx.fillRect(px + 6, py + 5, 3, 3);
    if (size > 1) { ctx.fillStyle = '#e9e19d'; ctx.fillRect(px + 13, py + 11, 2, 2); }
  }
  function drawTree(tx, ty, kind = 'tree') {
    const x = tx * T, y = ty * T;
    if (kind === 'rock') {
      ctx.fillStyle = '#55834a'; ctx.fillRect(x + 2, y + 12, 12, 3);
      ctx.fillStyle = '#929b77'; ctx.fillRect(x + 4, y + 7, 9, 6); ctx.fillRect(x + 6, y + 5, 5, 2);
      ctx.fillStyle = '#b7b68d'; ctx.fillRect(x + 6, y + 7, 3, 2); return;
    }
    if (kind === 'bush') {
      ctx.fillStyle = '#4d8145'; ctx.fillRect(x + 2, y + 8, 12, 6); ctx.fillRect(x + 4, y + 5, 8, 8);
      ctx.fillStyle = '#67994d'; ctx.fillRect(x + 4, y + 7, 5, 3); ctx.fillRect(x + 10, y + 9, 3, 2); return;
    }
    ctx.fillStyle = '#4d7441'; ctx.fillRect(x + 5, y + 12, 7, 4);
    ctx.fillStyle = '#735f3c'; ctx.fillRect(x + 7, y + 9, 3, 6); ctx.fillRect(x + 5, y + 13, 7, 2);
    ctx.fillStyle = '#3e7543'; ctx.fillRect(x + 1, y + 6, 14, 7); ctx.fillRect(x + 3, y + 3, 10, 9); ctx.fillRect(x + 5, y + 1, 6, 8);
    ctx.fillStyle = '#568d4b'; ctx.fillRect(x + 4, y + 4, 5, 4); ctx.fillRect(x + 2, y + 7, 4, 3); ctx.fillRect(x + 10, y + 5, 3, 4);
    ctx.fillStyle = '#76a954'; ctx.fillRect(x + 6, y + 3, 3, 2); ctx.fillRect(x + 3, y + 6, 2, 2);
    ctx.fillStyle = '#345f3d'; ctx.fillRect(x + 11, y + 10, 2, 2);
  }
  function drawMira() {
    const x = mira.x * T, y = mira.y * T;
    drawShadow(x, y + 3);
    const wave = Math.sin(elapsed * 3.5) > .35;
    ctx.fillStyle = '#493b34'; ctx.fillRect(x + 4, y - 10, 8, 5); ctx.fillRect(x + 3, y - 7, 10, 5);
    ctx.fillStyle = '#f1c99a'; ctx.fillRect(x + 5, y - 7, 7, 7); ctx.fillStyle = '#6e4b3b'; ctx.fillRect(x + 5, y - 3, 2, 1);
    ctx.fillStyle = '#b75454'; ctx.fillRect(x + 4, y, 9, 8); ctx.fillStyle = '#e87b68'; ctx.fillRect(x + 4, y, 9, 3);
    ctx.fillStyle = '#ecd6a5'; ctx.fillRect(x + 5, y + 7, 3, 4); ctx.fillRect(x + 10, y + 7, 3, 4);
    ctx.fillStyle = '#815444'; ctx.fillRect(x + 4, y + 10, 4, 2); ctx.fillRect(x + 10, y + 10, 4, 2);
    if (phase < 2 && wave) { ctx.fillStyle = '#f1c99a'; ctx.fillRect(x + 13, y - 1, 3, 3); ctx.fillStyle = '#e87b68'; ctx.fillRect(x + 14, y - 3, 2, 3); }
    if (Math.hypot(player.x - mira.x, player.y - mira.y) < 2.2) drawPrompt(x + 8, y - 17, 'A');
  }
  function drawShadow(x, y) { ctx.fillStyle = '#30583975'; ctx.fillRect(x - 1, y, 17, 4); ctx.fillRect(x + 2, y - 1, 11, 6); }
  function drawPlayer() {
    const x = player.x * T, y = player.y * T;
    drawShadow(x, y + 3);
    const walk = player.moving ? Math.floor(player.step / 7) % 2 : 0;
    const bob = player.moving && walk ? -1 : 0;
    const face = player.facing;
    ctx.fillStyle = '#5b4339'; ctx.fillRect(x + 4, y - 10 + bob, 9, 5); ctx.fillRect(x + 3, y - 7 + bob, 10, 4);
    ctx.fillStyle = '#e9bc91'; ctx.fillRect(x + 5, y - 7 + bob, 7, 7);
    if (face !== 'up') { ctx.fillStyle = '#3d493a'; if (face === 'left') ctx.fillRect(x + 5, y - 4 + bob, 2, 2); else if (face === 'right') ctx.fillRect(x + 10, y - 4 + bob, 2, 2); else { ctx.fillRect(x + 6, y - 4 + bob, 1, 2); ctx.fillRect(x + 10, y - 4 + bob, 1, 2); } }
    ctx.fillStyle = '#527b94'; ctx.fillRect(x + 3, y + bob, 11, 8); ctx.fillRect(x + 5, y + 7 + bob, 7, 2);
    ctx.fillStyle = '#e2d18a'; ctx.fillRect(x + 7, y + bob, 3, 6); ctx.fillRect(x + 6, y + 1 + bob, 5, 1);
    ctx.fillStyle = '#e9bc91'; if (face === 'left') ctx.fillRect(x + 1, y + 2 + bob, 3, 4); else if (face === 'right') ctx.fillRect(x + 13, y + 2 + bob, 3, 4);
    ctx.fillStyle = '#51433a'; const legY = y + 8 + bob;
    if (player.moving && walk) { ctx.fillRect(x + 4, legY, 4, 4); ctx.fillRect(x + 10, legY + 1, 4, 3); }
    else { ctx.fillRect(x + 4, legY, 4, 4); ctx.fillRect(x + 10, legY, 4, 4); }
    ctx.fillStyle = '#e0cf9a'; ctx.fillRect(x + 3, y + 11 + bob, 5, 2); ctx.fillRect(x + 10, y + 11 + bob, 5, 2);
  }
  function drawPrompt(x, y, label) {
    ctx.fillStyle = '#fff1b9'; ctx.fillRect(x - 4, y - 4, 16, 13); ctx.fillStyle = '#3b563e'; ctx.fillRect(x - 3, y - 3, 14, 11);
    ctx.fillStyle = '#fff0bd'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'; ctx.fillText(label, x + 4, y + 5);
  }
  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#70a552'; ctx.fillRect(0, 0, width, height);
    ctx.save(); ctx.translate(width / 2 - player.x * tileSize, height / 2 - player.y * tileSize); ctx.scale(scale, scale);
    const minX = Math.floor(player.x - width / tileSize / 2) - 2, maxX = Math.ceil(player.x + width / tileSize / 2) + 2;
    const minY = Math.floor(player.y - height / tileSize / 2) - 2, maxY = Math.ceil(player.y + height / tileSize / 2) + 2;
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      if (x < 0 || y < 0 || x >= WORLD || y >= WORLD) { ctx.fillStyle = '#365c3b'; ctx.fillRect(x * T, y * T, T, T); continue; }
      drawGround(x, y);
    }
    for (const d of decorations) if (d.x >= minX && d.x <= maxX && d.y >= minY && d.y <= maxY && !obstacles.has(keyOf(d.x, d.y))) {
      if (d.kind === 'grass') { ctx.fillStyle = d.variant > .5 ? '#598f4b' : '#94b963'; ctx.fillRect(d.x * T + 5, d.y * T + 8, 2, 4); ctx.fillRect(d.x * T + 9, d.y * T + 6, 2, 5); }
      else if (hash(d.x + 212, d.y) > .45) drawFlower(d.x + .26, d.y + .2, d.variant > .5 ? '#f5df9a' : '#f5d2d7', .8);
    }
    for (const [k, type] of obstacles) { const [x, y] = k.split(',').map(Number); if (x >= minX - 1 && x <= maxX + 1 && y >= minY - 1 && y <= maxY + 1) drawTree(x, y, type); }
    for (const f of flowers) if (!f.found && f.x >= minX - 1 && f.x <= maxX + 1 && f.y >= minY - 1 && f.y <= maxY + 1) drawFlower(f.x, f.y, f.color, 1, true);
    if (mira.x >= minX - 1 && mira.x <= maxX + 1 && mira.y >= minY - 1 && mira.y <= maxY + 1) drawMira();
    drawPlayer(); ctx.restore();
  }
  function blocked(x, y) {
    if (x < 1 || y < 1 || x > WORLD - 2 || y > WORLD - 2) return true;
    const tx = Math.floor(x), ty = Math.floor(y);
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const type = obstacles.get(keyOf(tx + ox, ty + oy));
      if (type && type !== 'bush' && Math.hypot(x - (tx + ox + .5), y - (ty + oy + .55)) < .68) return true;
      if (type === 'bush' && Math.hypot(x - (tx + ox + .5), y - (ty + oy + .5)) < .42) return true;
    }
    return false;
  }
  function inputAxis() {
    const up = keys.has('ArrowUp') || keys.has('w') || touchDirs.has('up');
    const down = keys.has('ArrowDown') || keys.has('s') || touchDirs.has('down');
    const left = keys.has('ArrowLeft') || keys.has('a') || touchDirs.has('left');
    const right = keys.has('ArrowRight') || keys.has('d') || touchDirs.has('right');
    return { x: (right ? 1 : 0) - (left ? 1 : 0), y: (down ? 1 : 0) - (up ? 1 : 0) };
  }
  function frame(now) {
    const dt = Math.min((now - lastTime) / 1000 || 0, .04); lastTime = now; elapsed += dt;
    const axis = inputAxis(); player.moving = !!(axis.x || axis.y);
    if (player.moving && !dialogue.classList.contains('open')) {
      const length = Math.hypot(axis.x, axis.y); const speed = 4.1;
      const dx = axis.x / length * speed * dt, dy = axis.y / length * speed * dt;
      if (axis.x) { player.facing = axis.x < 0 ? 'left' : 'right'; if (!blocked(player.x + dx, player.y)) player.x += dx; }
      if (axis.y) { if (!axis.x) player.facing = axis.y < 0 ? 'up' : 'down'; if (!blocked(player.x, player.y + dy)) player.y += dy; }
      player.step += dt * 13;
    }
    updatePrompt(); render(); requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  function nearFlower() { return flowers.filter(f => !f.found).sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y))[0]; }
  function nearestFlowerInRange() { const f = nearFlower(); return f && Math.hypot(f.x - player.x, f.y - player.y) < 1.55 ? f : null; }
  function updatePrompt() {
    const f = nearestFlowerInRange(), nearMira = Math.hypot(mira.x - player.x, mira.y - player.y) < 2.15;
    let text = 'Explore the meadow';
    if (nearMira) text = 'Talk to Mira';
    else if (f) text = 'Pick a moonpetal';
    else if (phase === 1) text = `Find moonpetals · ${petals}/3`;
    else if (phase === 0) text = 'Find Mira in the meadow';
    else if (phase === 2) text = 'The meadow feels brighter';
    hint.querySelector('span:last-child').textContent = text;
    const key = hint.querySelector('.hint-key'); key.textContent = nearMira || f ? 'A' : '✦';
  }
  function updateQuest() {
    if (phase === 0) { questTitle.textContent = 'A kind hello'; questText.textContent = 'Find Mira in the meadow and say hello.'; progressText.textContent = '0 / 1'; progressFill.style.width = '0%'; }
    else if (phase === 1) { questTitle.textContent = 'Mira’s little favor'; questText.textContent = petals < 3 ? 'Gather 3 moonpetals growing around the field.' : 'Bring the moonpetals back to Mira.'; progressText.textContent = `${petals} / 3`; progressFill.style.width = `${petals / 3 * 100}%`; }
    else { questTitle.textContent = 'A meadow made brighter'; questText.textContent = 'Mira has a little thank-you for you. Keep exploring!'; progressText.textContent = '✓'; progressFill.style.width = '100%'; }
  }
  function say(lines, who = 'MIRA', done = null) {
    dialogueLines = lines; dialogueIndex = 0; afterDialogue = done; speakerBadge.textContent = who;
    dialogueText.textContent = dialogueLines[0]; dialogue.classList.add('open'); dialogue.setAttribute('aria-hidden', 'false');
  }
  function advanceDialogue() {
    if (!dialogue.classList.contains('open')) return;
    dialogueIndex++;
    if (dialogueIndex >= dialogueLines.length) {
      dialogue.classList.remove('open'); dialogue.setAttribute('aria-hidden', 'true'); const callback = afterDialogue; afterDialogue = null; if (callback) callback();
    } else dialogueText.textContent = dialogueLines[dialogueIndex];
  }
  function interact() {
    const now = performance.now(); if (now - lastInteract < 220) return; lastInteract = now;
    if (dialogue.classList.contains('open')) { advanceDialogue(); return; }
    const f = nearestFlowerInRange();
    if (f) {
      f.found = true; petals++; updateQuest(); playTone(680, .12); showToast('Moonpetal tucked safely away  ✦');
      if (petals === 3 && phase === 1) { questText.textContent = 'Bring the moonpetals back to Mira.'; showToast('You found them all! Find Mira.'); }
      return;
    }
    if (Math.hypot(mira.x - player.x, mira.y - player.y) < 2.15) {
      if (phase === 0) {
        phase = 1; updateQuest(); playTone(480, .1);
        say(['Oh, hello there! I’m Mira. The meadow is full of little moonpetals this morning.', 'Would you gather three for my tea? They’re the pale flowers sparkling in the grass. I’ll be right here!'], 'MIRA');
      } else if (phase === 1 && petals < 3) say([`You’ve found ${petals} of the three moonpetals. They’re tucked in the sunny grass nearby!`, 'Take your time—the meadow is lovely this morning.'], 'MIRA');
      else if (phase === 1) {
        phase = 2; updateQuest(); playTone(790, .15);
        say(['Oh, these are perfect! Thank you, little wanderer. The meadow will remember your kindness.', 'Here—take this lucky clover. May your path always lead somewhere lovely!'], 'MIRA', () => showToast('Quest complete · Lucky clover earned!'));
      } else say(['The tea is just right. I can hear the bees humming their thanks!', 'There’s always something new to find in the Greenwold.'], 'MIRA');
      return;
    }
    const nearest = nearFlower();
    if (nearest && Math.hypot(nearest.x - player.x, nearest.y - player.y) < 4) showToast('A moonpetal is nearby—follow the little sparkle.');
    else showToast('A quiet breeze rustles through the grass.');
  }
  function showToast(text) { toast.textContent = text; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 1900); }
  function playTone(freq, duration) {
    if (!soundOn) return;
    try { audioCtx ||= new (window.AudioContext || window.webkitAudioContext)(); const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.type = 'triangle'; o.frequency.value = freq; g.gain.setValueAtTime(.035, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + duration); o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + duration); } catch (_) {}
  }
  document.addEventListener('keydown', e => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
    keys.add(k);
    if (e.key === ' ' || e.key === 'Enter' || e.key.toLowerCase() === 'e') { if (!e.repeat) interact(); }
  });
  document.addEventListener('keyup', e => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
  addEventListener('blur', () => { keys.clear(); touchDirs.clear(); });
  document.querySelectorAll('.dpad-btn').forEach(button => {
    const dir = button.dataset.dir;
    button.addEventListener('pointerdown', e => { e.preventDefault(); button.setPointerCapture(e.pointerId); touchDirs.add(dir); button.classList.add('pressed'); });
    const release = e => { touchDirs.delete(dir); button.classList.remove('pressed'); };
    button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
  });
  const actionBtn = document.querySelector('#actionBtn');
  actionBtn.addEventListener('pointerdown', e => { e.preventDefault(); interact(); });
  dialogueNext.addEventListener('click', advanceDialogue);
  dialogue.addEventListener('pointerdown', e => { if (e.target === dialogue || e.target.classList.contains('dialogue-box')) advanceDialogue(); });
  document.querySelector('#soundBtn').addEventListener('click', e => {
    soundOn = !soundOn; e.currentTarget.classList.toggle('on', soundOn); e.currentTarget.title = `Sound: ${soundOn ? 'on' : 'off'}`;
    e.currentTarget.innerHTML = soundOn ? '<span>♫</span>' : '<span>♪</span>'; playTone(590, .1);
    showToast(soundOn ? 'Sound effects on' : 'Sound effects off');
  });
  updateQuest();
})();

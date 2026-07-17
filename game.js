(() => {
  'use strict';

  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  const startScreen = document.querySelector('#startScreen');
  const gameOverScreen = document.querySelector('#gameOverScreen');
  const pauseLabel = document.querySelector('#pauseLabel');
  const startButton = document.querySelector('#startButton');
  const retryButton = document.querySelector('#retryButton');
  const finalScore = document.querySelector('#finalScore');
  const newRecord = document.querySelector('#newRecord');
  const resultTitle = document.querySelector('#resultTitle');
  const menuHighScore = document.querySelector('#menuHighScore');
  const soundButton = document.querySelector('#soundButton');
  const difficultyButtons = [...document.querySelectorAll('[data-difficulty]')];
  const controllerStatus = document.querySelector('#controllerStatus');

  const VW = 1280;
  const VH = 720;
  const keys = new Set();
  const pointer = { active: false, x: 0, y: 0 };
  const spriteSheet = new Image();
  spriteSheet.src = '背景なしChatGPT Image 2026年7月18日 06_30_26.png';

  let spriteFrames = [];
  let walkFrames = [];
  let idleFrame = null;
  let state = 'menu';
  let paused = false;
  let lastTime = 0;
  let score = 0;
  let highScore = Number(localStorage.getItem('grochan-highscore') || 0);
  let combo = 0;
  let comboTimer = 0;
  let health = 100;
  const maxHealth = 100;
  let elapsed = 0;
  let spawnTimer = 0;
  let pickupTimer = 0;
  let shake = 0;
  let flash = 0;
  let gameSpeed = 1;
  let bossState = 'waiting';
  let bossWarning = 0;
  let stageIndex = 0;
  let stageTime = 0;
  let stageBanner = 0;
  let stageTransition = 0;
  let difficultyKey = 'normal';
  let musicClock = 0;
  let musicStep = 0;
  let soundOn = true;
  const padInput = { x: 0, y: 0, fire: false };
  let padStartWasDown = false;
  let padActionWasDown = false;
  const difficulties = {
    easy: { spawn: 1.22, speed: .82, damage: .68, bossTime: 31, bossHp: 72, score: .8 },
    normal: { spawn: 1, speed: 1, damage: 1, bossTime: 26, bossHp: 100, score: 1 },
    hard: { spawn: .76, speed: 1.2, damage: 1.28, bossTime: 21, bossHp: 135, score: 1.4 }
  };
  const stages = [
    { name: 'NEON DOWNTOWN', boss: 'HEART BREAKER', sky: ['#120b3e', '#3b1878', '#f044a0'], far: '#28145e', city: '#100b34', accent: '#31e8ff', accent2: '#ff3e9d' },
    { name: 'AQUA HIGHWAY', boss: 'DEEP BLUE DIVA', sky: ['#041b3d', '#075987', '#20c5c9'], far: '#123c68', city: '#071d42', accent: '#65fff2', accent2: '#2f8cff' },
    { name: 'SUNSET FACTORY', boss: 'BLAZE EMPRESS', sky: ['#351036', '#a42f4f', '#ff9f43'], far: '#592141', city: '#28132e', accent: '#ffe15a', accent2: '#ff5a36' },
    { name: 'CYBER STORM', boss: 'VOLT PHANTOM', sky: ['#071d24', '#13554b', '#48b849'], far: '#164636', city: '#071f25', accent: '#72ff68', accent2: '#31e8ff' },
    { name: 'HEART PALACE', boss: 'QUEEN OF HEARTBREAK', sky: ['#25051d', '#72114e', '#d82065'], far: '#4d123d', city: '#21061d', accent: '#ffe15a', accent2: '#ff3e9d' }
  ];

  const GROUND_Y = 500;
  const player = { x: 170, y: 360, w: 118, h: 102, vx: 0, vy: 0, fire: 0, inv: 0, frame: 0, grounded: false, power: 1, spread: 1, speed: 1 };
  let bullets = [];
  let enemyBullets = [];
  let enemies = [];
  let particles = [];
  let pickups = [];
  let stars = [];
  let clouds = [];

  menuHighScore.textContent = pad(highScore);

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.floor(innerWidth * dpr);
    canvas.height = Math.floor(innerHeight * dpr);
    canvas.style.width = `${innerWidth}px`;
    canvas.style.height = `${innerHeight}px`;
    ctx.imageSmoothingEnabled = false;
  }

  function getView() {
    // Keep the entire 16:9 playfield visible so HUD values never get cropped.
    const scale = Math.min(canvas.width / VW, canvas.height / VH);
    return { scale, ox: (canvas.width - VW * scale) / 2, oy: (canvas.height - VH * scale) / 2 };
  }

  function screenToWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const v = getView();
    const px = (clientX - rect.left) * (canvas.width / rect.width);
    const py = (clientY - rect.top) * (canvas.height / rect.height);
    return { x: (px - v.ox) / v.scale, y: (py - v.oy) / v.scale };
  }

  function makeFrame(sx, sy, sw, sh) {
    const c = document.createElement('canvas');
    c.width = sw; c.height = sh;
    const cctx = c.getContext('2d');
    cctx.drawImage(spriteSheet, sx, sy, sw, sh, 0, 0, sw, sh);
    return c;
  }

  spriteSheet.onload = () => {
    spriteFrames = [
      makeFrame(378, 535, 240, 305),
      makeFrame(684, 535, 240, 305),
      makeFrame(972, 535, 240, 305),
      makeFrame(1264, 535, 240, 305)
    ];
    idleFrame = makeFrame(92, 72, 225, 350);
    walkFrames = [
      makeFrame(398, 72, 225, 350),
      makeFrame(684, 72, 225, 350),
      makeFrame(974, 72, 225, 350),
      makeFrame(1260, 72, 225, 350)
    ];
  };

  function resetGame() {
    score = 0; combo = 0; comboTimer = 0; health = maxHealth; elapsed = 0;
    spawnTimer = .7; pickupTimer = 6; shake = 0; flash = 0; gameSpeed = 1;
    bossState = 'waiting'; bossWarning = 0;
    stageIndex = 0; stageTime = 0; stageBanner = 3; stageTransition = 0;
    musicClock = 0; musicStep = 0;
    bullets = []; enemyBullets = []; enemies = []; particles = []; pickups = [];
    player.x = 160; player.y = VH / 2; player.vx = 0; player.vy = 0;
    player.fire = 0; player.inv = 1.2; player.frame = 0; player.grounded = false; player.power = 1; player.spread = 1; player.speed = 1;
    state = 'playing'; paused = false;
    startScreen.classList.remove('is-visible');
    gameOverScreen.classList.remove('is-visible');
    pauseLabel.classList.remove('is-visible');
    lastTime = performance.now();
    ensureAudio();
  }

  function initBackdrop() {
    stars = Array.from({ length: 90 }, () => ({ x: Math.random() * VW, y: Math.random() * VH * .74, s: 1 + Math.random() * 3, a: Math.random() * 6 }));
    clouds = Array.from({ length: 8 }, () => ({ x: Math.random() * VW, y: 70 + Math.random() * 410, s: .5 + Math.random() * 1.1, v: 10 + Math.random() * 18 }));
  }

  function shoot() {
    // Muzzle position measured from the flying sprite sheet frame.
    const muzzleX = player.x + (player.grounded ? 103 : 116);
    const muzzleY = player.y + (player.grounded ? 65 : 72 + Math.sin(player.frame * .65) * 3);
    const lanes = player.spread === 1 ? [0] : player.spread === 2 ? [-105, 0, 105] : [-175, -85, 0, 85, 175];
    for (const vy of lanes) bullets.push({ x: muzzleX, y: muzzleY, vx: 770, vy, life: 1.5, r: 6 + player.power * 2, damage: player.power });
    burst(muzzleX, muzzleY, '#ffe15a', 4, 130);
    sfx('shoot');
  }

  function spawnEnemy() {
    const r = Math.random();
    const y = 80 + Math.random() * (VH - 210);
    const wave = Math.random() < .46;
    if (r < .4) {
      enemies.push({ type: 'drone', x: VW + 70, y, baseY: y, w: 64, h: 56, hp: 2, maxHp: 2, vx: 175 + stageTime * .8, t: Math.random() * 6, wave, points: 120, fire: 1 + Math.random() * 2.2 });
    } else if (r < .65) {
      enemies.push({ type: 'bat', x: VW + 70, y, baseY: y, w: 70, h: 50, hp: 1, maxHp: 1, vx: 255 + stageTime, t: Math.random() * 6, wave: true, points: 180, fire: 99 });
    } else if (r < .82) {
      enemies.push({ type: 'spinner', x: VW + 80, y, baseY: y, w: 76, h: 76, hp: 4, maxHp: 4, vx: 150 + stageTime * .7, t: 0, wave: true, points: 350, fire: 1.3 });
    } else if (r < .94) {
      enemies.push({ type: 'tank', x: VW + 90, y, baseY: y, w: 98, h: 78, hp: 7, maxHp: 7, vx: 105 + stageTime * .5, t: 0, wave: false, points: 600, fire: .9 });
    } else {
      enemies.push({ type: 'turret', x: VW + 80, y: 574, baseY: 574, w: 74, h: 72, hp: 5, maxHp: 5, vx: 125, t: 0, wave: false, points: 480, fire: .7 });
    }
    const enemy = enemies[enemies.length - 1];
    const hpBonus = Math.floor(stageIndex / 2);
    enemy.hp += hpBonus; enemy.maxHp += hpBonus;
    enemy.vx *= 1 + stageIndex * .08;
    enemy.points = Math.round(enemy.points * (1 + stageIndex * .22));
  }

  function spawnBoss() {
    const bossHp = Math.round(difficulties[difficultyKey].bossHp * (1 + stageIndex * .42));
    enemies.push({ type: 'boss', x: VW + 260, y: 220, baseY: 220, w: 230, h: 190, hp: bossHp, maxHp: bossHp, vx: 0, t: 0, wave: false, points: 12000, fire: 1.2 });
    bossState = 'active';
    musicStep = 0; musicClock = 0;
    enemyBullets = [];
    shake = 15;
    sfx('boss');
  }

  function enemyShoot(e) {
    const dx = player.x - e.x;
    const dy = (player.y + 45) - (e.y + e.h / 2);
    const len = Math.hypot(dx, dy) || 1;
    const speed = e.type === 'tank' || e.type === 'turret' ? 250 : 205;
    const count = e.type === 'spinner' ? 3 : 1;
    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * .2;
      const base = Math.atan2(dy, dx) + offset;
      enemyBullets.push({ x: e.x, y: e.y + e.h / 2, vx: Math.cos(base) * speed, vy: Math.sin(base) * speed, r: e.type === 'tank' ? 11 : 8, life: 5, damage: e.type === 'tank' ? 25 : 18 });
    }
  }

  function bossShoot(e) {
    const originX = e.x + 18;
    const originY = e.y + e.h / 2;
    const aim = Math.atan2(player.y + 45 - originY, player.x - originX);
    for (let i = -2; i <= 2; i++) {
      const a = aim + i * .19;
      enemyBullets.push({ x: originX, y: originY, vx: Math.cos(a) * 285, vy: Math.sin(a) * 285, r: 10, life: 6, damage: 14, boss: true });
    }
    burst(originX, originY, '#ff3e9d', 9, 190);
  }

  function update(dt) {
    if (state !== 'playing' || paused) return;
    elapsed += dt;
    if (bossState === 'waiting') stageTime += dt;
    stageBanner = Math.max(0, stageBanner - dt);
    gameSpeed = Math.min(1.6, 1 + stageTime / 100) + stageIndex * .08;
    shake = Math.max(0, shake - dt * 25); flash = Math.max(0, flash - dt * 3);
    player.inv = Math.max(0, player.inv - dt);
    comboTimer -= dt;
    if (comboTimer <= 0) combo = 0;

    const difficulty = difficulties[difficultyKey];
    musicClock -= dt;
    if (musicClock <= 0) { playMusicNote(); musicClock = bossState === 'active' ? .115 : .185; }

    if (bossState === 'waiting' && stageTime >= difficulty.bossTime + stageIndex * 2) {
      bossState = 'warning'; bossWarning = 3.2; enemies = []; enemyBullets = [];
    } else if (bossState === 'warning') {
      bossWarning -= dt;
      if (bossWarning <= 0) spawnBoss();
    } else if (bossState === 'transition' || bossState === 'final') {
      stageTransition -= dt;
      if (stageTransition <= 0) {
        if (bossState === 'final') {
          finishGame(true);
        } else {
          stageIndex++; stageTime = 0; stageBanner = 3; bossState = 'waiting'; spawnTimer = 1.2; pickupTimer = 4;
          health = Math.min(maxHealth, health + 28); player.inv = 2;
        }
      }
    }

    let ax = padInput.x, ay = padInput.y;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) ax--;
    if (keys.has('ArrowRight') || keys.has('KeyD')) ax++;
    if (keys.has('ArrowUp') || keys.has('KeyW')) ay--;
    if (keys.has('ArrowDown') || keys.has('KeyS')) ay++;
    const speedBoost = 1 + (player.speed - 1) * .18;
    if (player.grounded) {
      if (ay < 0 || (pointer.active && pointer.y < GROUND_Y - 80)) {
        player.grounded = false; player.vy = -270; burst(player.x + 55, GROUND_Y + 130, '#31e8ff', 10, 130);
      }
      player.vx += ax * 1100 * speedBoost * dt;
      if (pointer.active) player.vx += Math.sign(pointer.x - player.x - 50) * 850 * speedBoost * dt;
      player.vy = 0;
    } else if (pointer.active) {
      const targetX = Math.min(pointer.x - player.w * .45, VW * .58);
      const targetY = pointer.y - player.h * .5;
      player.vx += (targetX - player.x) * dt * 18;
      player.vy += (targetY - player.y) * dt * 18;
    } else {
      player.vx += ax * 1250 * speedBoost * dt;
      player.vy += ay * 1250 * speedBoost * dt;
    }
    const drag = Math.pow(.0009, dt);
    player.vx *= drag; player.vy *= drag;
    const speed = Math.hypot(player.vx, player.vy);
    const maxMoveSpeed = 420 * (1 + (player.speed - 1) * .16);
    if (speed > maxMoveSpeed) { player.vx *= maxMoveSpeed / speed; player.vy *= maxMoveSpeed / speed; }
    player.x = clamp(player.x + player.vx * dt, 28, VW * .62);
    if (player.grounded) {
      player.y = GROUND_Y;
    } else {
      player.y = clamp(player.y + player.vy * dt, 32, GROUND_Y);
      if (player.y >= GROUND_Y && (ay > 0 || (pointer.active && pointer.y > 570))) {
        player.grounded = true; player.y = GROUND_Y; player.vy = 0; burst(player.x + 55, GROUND_Y + 132, '#ffe15a', 9, 100);
      }
    }
    player.frame += dt * (player.grounded ? (Math.abs(player.vx) > 25 ? 9 : 0) : 10);
    player.fire -= dt;
    if (!player.grounded && !['transition', 'final'].includes(bossState) && (keys.has('Space') || pointer.active || padInput.fire) && player.fire <= 0) { shoot(); player.fire = .145; }

    spawnTimer -= dt;
    if (bossState === 'waiting' && stageBanner <= 1.4 && spawnTimer <= 0) { spawnEnemy(); spawnTimer = ((.55 + Math.random() * .45) * difficulty.spawn) / gameSpeed; }
    pickupTimer -= dt;
    if (pickupTimer <= 0 && (bossState === 'waiting' || bossState === 'active')) {
      const roll = Math.random();
      pickups.push({ type: roll < .28 ? 'heal' : roll < .53 ? 'power' : roll < .76 ? 'spread' : 'speed', x: VW + 30, y: 100 + Math.random() * (VH - 240), r: 19, t: 0 });
      pickupTimer = 8 + Math.random() * 7;
    }

    for (const s of stars) { s.x -= s.s * 15 * dt * gameSpeed; s.a += dt * 2; if (s.x < -5) { s.x = VW + 5; s.y = Math.random() * VH * .75; } }
    for (const c of clouds) { c.x -= c.v * dt * gameSpeed; if (c.x < -220 * c.s) { c.x = VW + 150; c.y = 80 + Math.random() * 390; } }
    for (const b of bullets) { b.x += b.vx * dt; b.y += (b.vy || 0) * dt; b.life -= dt; }
    for (const b of enemyBullets) { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; }
    for (const e of enemies) {
      e.t += dt;
      if (e.type === 'boss') {
        if (e.x > VW - 290) e.x -= 105 * dt;
        e.y = 225 + Math.sin(e.t * 1.25) * 125;
        e.fire -= dt;
        if (e.fire <= 0 && e.x < VW - 180) { bossShoot(e); e.fire = .85; }
        continue;
      }
      e.x -= e.vx * dt * gameSpeed * difficulty.speed;
      if (e.wave) e.y = e.baseY + Math.sin(e.t * 3.2) * (e.type === 'bat' ? 55 : e.type === 'spinner' ? 42 : 30);
      e.fire -= dt;
      if (e.fire <= 0 && e.x < VW - 90) { enemyShoot(e); e.fire = e.type === 'tank' ? 1.1 : e.type === 'turret' ? 1.4 : e.type === 'spinner' ? 1.8 : 2.1 + Math.random(); }
    }
    for (const p of pickups) { p.x -= 130 * dt; p.t += dt; }
    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.gravity || 0) * dt; p.life -= dt; p.vx *= Math.pow(.08, dt); }

    collisions();
    bullets = bullets.filter(b => b.life > 0 && b.x < VW + 80 && b.y > -30 && b.y < VH + 30);
    enemyBullets = enemyBullets.filter(b => b.life > 0 && b.x > -40);
    enemies = enemies.filter(e => e.hp > 0 && e.x > -130);
    particles = particles.filter(p => p.life > 0);
    pickups = pickups.filter(p => p.x > -50 && !p.taken);
  }

  function collisions() {
    const hitX = player.x + 24;
    const hitY = player.grounded ? player.y - 4 : player.y + 20;
    const hitW = player.w - 43;
    const hitH = player.grounded ? 148 : player.h - 34;
    for (const b of bullets) {
      for (const e of enemies) {
        if (b.life > 0 && e.hp > 0 && circleRect(b.x, b.y, b.r, e.x, e.y, e.w, e.h)) {
          b.life = 0; e.hp -= b.damage || 1; shake = 3; burst(b.x, b.y, '#31e8ff', 5, 150);
          if (e.hp <= 0) destroyEnemy(e);
          break;
        }
      }
    }
    if (player.inv <= 0) {
      for (const e of enemies) {
        if (rects(hitX, hitY, hitW, hitH, e.x, e.y, e.w, e.h)) {
          if (e.type !== 'boss') { e.hp = 0; destroyEnemy(e); }
          hurt(e.type === 'boss' ? 38 : 28); break;
        }
      }
      for (const b of enemyBullets) {
        if (b.life > 0 && circleRect(b.x, b.y, b.r, hitX, hitY, hitW, hitH)) { b.life = 0; hurt(b.damage || 20); break; }
      }
    }
    for (const p of pickups) {
      if (!p.taken && circleRect(p.x, p.y, p.r, player.x, player.y, player.w, player.h)) {
        p.taken = true; score += 500;
        if (p.type === 'power') player.power = Math.min(3, player.power + 1);
        else if (p.type === 'spread') player.spread = Math.min(3, player.spread + 1);
        else if (p.type === 'speed') player.speed = Math.min(3, player.speed + 1);
        else health = Math.min(maxHealth, health + 32);
        burst(p.x, p.y, p.type === 'power' ? '#ff8a35' : p.type === 'spread' ? '#31e8ff' : p.type === 'speed' ? '#72ff68' : '#ffe15a', 22, 260); sfx('power');
      }
    }
  }

  function destroyEnemy(e) {
    combo++; comboTimer = 2.2;
    const mult = Math.min(5, 1 + Math.floor(combo / 5));
    score += e.points * mult * difficulties[difficultyKey].score;
    const isBoss = e.type === 'boss';
    burst(e.x + e.w / 2, e.y + e.h / 2, e.type === 'bat' ? '#ff3e9d' : '#ffe15a', isBoss ? 90 : e.type === 'tank' ? 28 : 15, isBoss ? 520 : e.type === 'tank' ? 330 : 240);
    shake = isBoss ? 28 : e.type === 'tank' ? 12 : 6; flash = isBoss ? 1 : e.type === 'tank' ? .35 : .12; sfx('boom');
    if (isBoss) {
      bossState = stageIndex === stages.length - 1 ? 'final' : 'transition'; stageTransition = 3.6;
      enemyBullets = []; bullets = []; health = Math.min(maxHealth, health + 40); musicStep = 0; musicClock = 0;
    }
  }

  function hurt(damage) {
    health = Math.max(0, health - damage * difficulties[difficultyKey].damage); player.inv = 1.4; combo = 0; shake = 18; flash = .7;
    burst(player.x + player.w / 2, player.y + player.h / 2, '#ff3e9d', 28, 330); sfx('hurt');
    if (health <= 0) finishGame(false);
  }

  function finishGame(cleared) {
    state = 'over';
    resultTitle.textContent = cleared ? 'ALL CLEAR!' : 'GAME OVER';
    const record = score > highScore;
    if (record) { highScore = score; localStorage.setItem('grochan-highscore', String(highScore)); }
    finalScore.textContent = pad(score);
    menuHighScore.textContent = pad(highScore);
    newRecord.classList.toggle('is-hidden', !record);
    setTimeout(() => gameOverScreen.classList.add('is-visible'), 450);
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (.35 + Math.random() * .65);
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: .35 + Math.random() * .55, max: .9, color, size: 3 + Math.random() * 7, gravity: 90 });
    }
  }

  function draw() {
    const v = getView();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#08051e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(v.ox, v.oy); ctx.scale(v.scale, v.scale);
    const sx = shake ? (Math.random() - .5) * shake : 0;
    const sy = shake ? (Math.random() - .5) * shake : 0;
    ctx.translate(sx, sy);
    drawBackdrop();
    drawGame();
    ctx.restore();
  }

  function drawBackdrop() {
    const stage = stages[stageIndex];
    const g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, stage.sky[0]); g.addColorStop(.52, stage.sky[1]); g.addColorStop(1, stage.sky[2]);
    ctx.fillStyle = g; ctx.fillRect(-30, -30, VW + 60, VH + 60);
    const moon = ctx.createRadialGradient(970, 145, 8, 970, 145, 100);
    moon.addColorStop(0, 'rgba(255,255,220,.95)'); moon.addColorStop(.25, 'rgba(255,225,90,.38)'); moon.addColorStop(1, 'rgba(255,225,90,0)');
    ctx.fillStyle = moon; ctx.beginPath(); ctx.arc(970, 145, 100, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff3aa'; ctx.beginPath(); ctx.arc(970, 145, 42, 0, Math.PI * 2); ctx.fill();
    drawSkyRibbons();
    for (const s of stars) { ctx.globalAlpha = .45 + Math.sin(s.a) * .35; ctx.fillStyle = s.s > 2.4 ? '#ffe15a' : '#8defff'; ctx.fillRect(s.x, s.y, s.s, s.s); }
    ctx.globalAlpha = 1;
    for (const c of clouds) drawCloud(c);
    drawCity((elapsed * -7) % 80, 505, stage.far, 40, .32);
    drawCity((elapsed * -20) % 120, 600, stage.city, 54, .78);
    drawNeonSigns();
    drawHorizonGrid();
    drawGroundLayer();
  }

  function drawSkyRibbons() {
    ctx.save(); ctx.globalAlpha = .12;
    const stage = stages[stageIndex];
    const colors = [stage.accent, stage.accent2, '#ffffff'];
    for (let j = 0; j < 3; j++) {
      ctx.strokeStyle = colors[j]; ctx.lineWidth = 18 + j * 9; ctx.beginPath();
      for (let x = -80; x <= VW + 80; x += 40) {
        const y = 105 + j * 63 + Math.sin(x * .006 + elapsed * (.12 + j * .04)) * (36 + j * 12);
        x === -80 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawNeonSigns() {
    const stage = stages[stageIndex];
    const signs = [
      { x: 145 - (elapsed * 35) % 1500, y: 493, w: 94, h: 38, text: 'GRO★', c: stage.accent2 },
      { x: 650 - (elapsed * 35) % 1500, y: 520, w: 110, h: 42, text: `ST-${stageIndex + 1}`, c: stage.accent },
      { x: 1120 - (elapsed * 35) % 1500, y: 474, w: 83, h: 36, text: '♥ 24H', c: '#ffe15a' }
    ];
    for (let repeat = 0; repeat < 2; repeat++) for (const s of signs) {
      const x = s.x + repeat * 1500;
      ctx.save(); ctx.shadowColor = s.c; ctx.shadowBlur = 12; ctx.fillStyle = '#0b0929'; ctx.fillRect(x, s.y, s.w, s.h);
      ctx.strokeStyle = s.c; ctx.lineWidth = 3; ctx.strokeRect(x, s.y, s.w, s.h); ctx.fillStyle = s.c;
      ctx.font = '12px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillText(s.text, x + s.w / 2, s.y + 25); ctx.restore();
    }
  }

  function drawHorizonGrid() {
    ctx.save(); ctx.globalAlpha = .22; ctx.strokeStyle = stages[stageIndex].accent; ctx.lineWidth = 1;
    const horizon = 590;
    for (let y = horizon; y < 680; y += 13) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VW, y); ctx.stroke(); }
    for (let x = -200; x < VW + 200; x += 70) { const drift = (elapsed * 100) % 70; ctx.beginPath(); ctx.moveTo(VW/2, horizon); ctx.lineTo(x - drift, 680); ctx.stroke(); }
    ctx.restore();
  }

  function drawGroundLayer() {
    const stage = stages[stageIndex];
    const ground = 650;
    const road = ctx.createLinearGradient(0, ground, 0, VH);
    road.addColorStop(0, '#24164f'); road.addColorStop(1, '#08051b');
    ctx.fillStyle = road; ctx.fillRect(0, ground, VW, VH - ground);
    ctx.fillStyle = stage.accent; ctx.fillRect(0, ground, VW, 4);
    ctx.fillStyle = stage.accent2; ctx.fillRect(0, ground + 9, VW, 2);
    const tileOffset = (elapsed * 120) % 120;
    for (let x = -120 - tileOffset; x < VW + 120; x += 120) {
      ctx.globalAlpha = .3; ctx.strokeStyle = stage.accent; ctx.strokeRect(x, ground + 12, 90, 58);
      ctx.fillStyle = stage.accent2; ctx.fillRect(x + 15, ground + 43, 46, 3); ctx.globalAlpha = 1;
    }
    const postOffset = (elapsed * 210) % 430;
    for (let x = -postOffset; x < VW + 200; x += 430) {
      ctx.fillStyle = '#100927'; ctx.fillRect(x, 548, 12, 102); ctx.fillRect(x - 22, 548, 56, 8);
      ctx.shadowColor = stage.accent; ctx.shadowBlur = 18; ctx.fillStyle = stage.accent; ctx.fillRect(x - 17, 552, 46, 7); ctx.shadowBlur = 0;
    }
  }

  function drawCloud(c) {
    ctx.save(); ctx.globalAlpha = .11; ctx.fillStyle = '#d7ddff';
    ctx.fillRect(c.x, c.y + 25 * c.s, 150 * c.s, 30 * c.s);
    ctx.beginPath(); ctx.arc(c.x + 35*c.s, c.y + 28*c.s, 30*c.s, Math.PI, 0); ctx.arc(c.x + 85*c.s, c.y + 24*c.s, 43*c.s, Math.PI, 0); ctx.arc(c.x + 128*c.s, c.y + 30*c.s, 27*c.s, Math.PI, 0); ctx.fill(); ctx.restore();
  }

  function drawCity(offset, ground, color, unit, alpha) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color;
    for (let i = -2; i < 28; i++) {
      const x = i * unit + offset; const h = 45 + ((i * 47 + 130) % 150);
      ctx.fillRect(x, ground - h, unit - 5, h);
      ctx.fillStyle = i % 3 ? stages[stageIndex].accent : stages[stageIndex].accent2;
      for (let yy = ground - h + 14; yy < ground - 10; yy += 18) for (let xx = x + 8; xx < x + unit - 8; xx += 14) if ((xx + yy + i) % 3 > 1) ctx.fillRect(xx, yy, 4, 6);
      ctx.fillStyle = color;
    }
    ctx.restore();
  }

  function drawGame() {
    for (const p of pickups) drawPickup(p);
    for (const b of bullets) drawPlayerBullet(b);
    for (const b of enemyBullets) drawEnemyBullet(b);
    for (const e of enemies) drawEnemy(e);
    if (state === 'playing' || state === 'over') drawPlayer();
    for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color; const s = Math.ceil(p.size); ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s); }
    ctx.globalAlpha = 1;
    if (state === 'playing' || state === 'over') drawHUD();
    if (flash > 0) { ctx.globalAlpha = flash * .45; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1; }
  }

  function drawPlayer() {
    ctx.save();
    if (player.inv > 0 && Math.floor(player.inv * 12) % 2 === 0) ctx.globalAlpha = .25;
    const bob = player.grounded ? 0 : Math.sin(player.frame * .65) * 3;
    ctx.fillStyle = 'rgba(49,232,255,.18)'; ctx.beginPath(); ctx.ellipse(player.x + 56, player.y + (player.grounded ? 155 : 96), 54, 11, 0, 0, Math.PI * 2); ctx.fill();
    if (player.grounded && idleFrame && walkFrames.length) {
      const frame = Math.abs(player.vx) > 25 ? walkFrames[Math.floor(player.frame) % walkFrames.length] : idleFrame;
      ctx.drawImage(frame, player.x - 8, player.y - 28, 130, 190);
    } else if (spriteFrames.length) {
      const frame = spriteFrames[Math.floor(player.frame) % spriteFrames.length];
      ctx.drawImage(frame, player.x - 13, player.y - 22 + bob, 132, 167);
    } else {
      ctx.fillStyle = '#ff3e9d'; ctx.fillRect(player.x + 20, player.y + 20, 70, 65);
    }
    ctx.restore();
  }

  function drawPlayerBullet(b) {
    const size = b.r || 8;
    ctx.fillStyle = 'rgba(255,62,157,.25)'; ctx.fillRect(b.x - 30, b.y - size, 42, size * 2);
    ctx.fillStyle = b.damage >= 3 ? '#ff8a35' : '#ffe15a'; ctx.fillRect(b.x - 13, b.y - size / 2, 24 + b.damage * 3, size);
    ctx.fillStyle = '#fff'; ctx.fillRect(b.x, b.y - 2, 13, 4);
  }

  function drawEnemyBullet(b) {
    ctx.fillStyle = 'rgba(255,62,157,.25)'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 8, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ff3e9d'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(b.x - 3, b.y - 3, 5, 5);
  }

  function drawEnemy(e) {
    ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y));
    if (e.type === 'drone') {
      ctx.fillStyle = '#180d3d'; ctx.fillRect(8, 8, 48, 39); ctx.fillRect(0, 18, 64, 18);
      ctx.fillStyle = '#8b3fff'; ctx.fillRect(7, 11, 50, 25); ctx.fillStyle = '#dba6ff'; ctx.fillRect(13, 15, 38, 7);
      ctx.fillStyle = '#ff3e9d'; ctx.fillRect(20, 25, 9, 9); ctx.fillRect(38, 25, 9, 9); ctx.fillStyle = '#fff'; ctx.fillRect(23, 26, 3, 3); ctx.fillRect(41, 26, 3, 3);
      ctx.fillStyle = '#31e8ff'; ctx.fillRect(4, 48, 14, 5); ctx.fillRect(46, 48, 14, 5);
    } else if (e.type === 'bat') {
      const flap = Math.sin(e.t * 12) > 0 ? 0 : 10;
      ctx.fillStyle = '#ff3e9d'; ctx.fillRect(22, 13, 27, 34); ctx.fillRect(5, 4 + flap, 21, 12); ctx.fillRect(46, 4 + flap, 21, 12); ctx.fillRect(0, 2 + flap, 9, 25); ctx.fillRect(62, 2 + flap, 9, 25);
      ctx.fillStyle = '#210c3f'; ctx.fillRect(27, 19, 17, 22); ctx.fillStyle = '#ffe15a'; ctx.fillRect(29, 22, 5, 5); ctx.fillRect(38, 22, 5, 5);
    } else if (e.type === 'spinner') {
      ctx.translate(38, 38); ctx.rotate(e.t * 2.5);
      ctx.fillStyle = '#31e8ff'; for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.fillRect(13, -7, 27, 14); }
      ctx.fillStyle = '#381465'; ctx.beginPath(); ctx.arc(0, 0, 31, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff3e9d'; ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(-7, -7, 14, 14);
    } else if (e.type === 'tank') {
      ctx.fillStyle = '#1a103e'; ctx.fillRect(6, 20, 86, 51); ctx.fillStyle = '#6943c8'; ctx.fillRect(12, 13, 74, 48); ctx.fillStyle = '#31e8ff'; ctx.fillRect(20, 0, 58, 22);
      ctx.fillStyle = '#120b2e'; ctx.fillRect(23, 25, 50, 28); ctx.fillStyle = '#ff3e9d'; ctx.fillRect(29, 31, 10, 10); ctx.fillRect(57, 31, 10, 10);
      ctx.fillStyle = '#ffe15a'; ctx.fillRect(5, 70, 23, 7); ctx.fillRect(69, 70, 23, 7);
      ctx.fillStyle = '#120b2e'; ctx.fillRect(14, 64, 70, 5); ctx.fillStyle = '#ff3e9d'; ctx.fillRect(14, 64, 70 * Math.max(0, e.hp/e.maxHp), 5);
    } else if (e.type === 'turret') {
      ctx.fillStyle = '#160c36'; ctx.fillRect(5, 43, 64, 27); ctx.fillStyle = '#6943c8'; ctx.fillRect(12, 29, 50, 31);
      ctx.fillStyle = '#ff3e9d'; ctx.fillRect(18, 34, 33, 16); ctx.fillStyle = '#ffe15a'; ctx.fillRect(-7, 38, 29, 8);
      ctx.fillStyle = '#31e8ff'; ctx.fillRect(8, 67, 19, 5); ctx.fillRect(48, 67, 19, 5);
    } else {
      const stage = stages[stageIndex];
      const pulse = 4 + Math.sin(e.t * 5) * 3;
      ctx.shadowColor = stage.accent2; ctx.shadowBlur = 18;
      ctx.fillStyle = '#16082f'; ctx.fillRect(28, 25, 174, 138); ctx.fillRect(0, 66, 230, 57);
      ctx.fillStyle = stage.accent2; ctx.fillRect(39, 14, 152, 136); ctx.fillStyle = stage.accent; ctx.fillRect(51, 26, 128, 30);
      ctx.fillStyle = '#100720'; ctx.fillRect(53, 65, 124, 66);
      ctx.fillStyle = stage.accent2; ctx.fillRect(67, 78, 30, 25); ctx.fillRect(133, 78, 30, 25);
      ctx.fillStyle = '#fff'; ctx.fillRect(74, 81, 9, 8); ctx.fillRect(140, 81, 9, 8);
      ctx.fillStyle = '#ffe15a'; ctx.fillRect(95, 113, 40, 8); ctx.fillRect(108, 104, 14, 22);
      ctx.fillStyle = stage.accent; ctx.fillRect(-pulse, 51, 35, 8); ctx.fillRect(197, 51, 35 + pulse, 8); ctx.fillRect(15, 153, 55, 12); ctx.fillRect(160, 153, 55, 12);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  function drawPickup(p) {
    const s = 1 + Math.sin(p.t * 5) * .13;
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(s, s); ctx.rotate(p.t);
    ctx.fillStyle = 'rgba(255,225,90,.2)'; ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI*2); ctx.fill();
    const color = p.type === 'power' ? '#ff8a35' : p.type === 'spread' ? '#31e8ff' : p.type === 'speed' ? '#72ff68' : '#ffe15a';
    ctx.fillStyle = color; starPath(0, 0, 19, 8, p.type === 'spread' ? 6 : 5); ctx.fill();
    ctx.rotate(-p.t); ctx.fillStyle = '#120b2e'; ctx.font = '11px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillText(p.type === 'power' ? 'P' : p.type === 'spread' ? 'W' : p.type === 'speed' ? 'S' : '+', 0, 4); ctx.restore();
  }

  function drawHUD() {
    ctx.save();
    const stage = stages[stageIndex];
    ctx.fillStyle = 'rgba(10,6,31,.82)'; ctx.fillRect(24, 23, 286, 70); ctx.fillRect(VW - 356, 23, 332, 70);
    ctx.strokeStyle = 'rgba(49,232,255,.6)'; ctx.strokeRect(24.5, 23.5, 286, 70); ctx.strokeRect(VW - 356.5, 23.5, 332, 70);
    ctx.fillStyle = '#31e8ff'; ctx.font = '10px "Press Start 2P", monospace'; ctx.fillText('SCORE', 42, 45);
    ctx.fillStyle = '#fff'; ctx.font = '25px "Press Start 2P", monospace'; ctx.fillText(pad(score), 42, 77);
    ctx.fillStyle = '#fff'; ctx.font = '9px "Press Start 2P", monospace'; ctx.fillText('HP', VW - 336, 48);
    ctx.fillStyle = '#21163f'; ctx.fillRect(VW - 336, 57, 286, 18);
    const hpWidth = 286 * health / maxHealth;
    ctx.fillStyle = health > 50 ? '#31e8ff' : health > 25 ? '#ffe15a' : '#ff3e9d'; ctx.fillRect(VW - 336, 57, hpWidth, 18);
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(VW - 332, 60, Math.max(0, hpWidth - 8), 3);
    ctx.textAlign = 'right'; ctx.fillStyle = '#fff'; ctx.font = '9px "Press Start 2P", monospace'; ctx.fillText(`${Math.ceil(health)} / ${maxHealth}`, VW - 48, 48); ctx.textAlign = 'left';
    ctx.fillStyle = '#ffe15a'; ctx.font = '7px "Press Start 2P", monospace'; ctx.fillText(`POWER ${player.power}`, VW - 336, 88);
    ctx.fillStyle = '#31e8ff'; ctx.fillText(`WIDE ${player.spread}`, VW - 220, 88);
    ctx.fillStyle = '#72ff68'; ctx.fillText(`SPEED ${player.speed}`, VW - 126, 88);
    if (combo > 1 && comboTimer > 0) {
      ctx.textAlign = 'center'; ctx.fillStyle = '#ffe15a'; ctx.font = '18px "Press Start 2P", monospace'; ctx.fillText(`${combo} COMBO!`, VW / 2, 61);
      ctx.fillStyle = '#fff'; ctx.font = '10px "Press Start 2P", monospace'; ctx.fillText(`SCORE ×${Math.min(5, 1 + Math.floor(combo / 5))}`, VW/2, 84);
    } else {
      ctx.textAlign = 'center'; ctx.fillStyle = stage.accent; ctx.font = '10px "Press Start 2P", monospace'; ctx.fillText(`STAGE ${stageIndex + 1} / ${stages.length}`, VW / 2, 48);
      ctx.fillStyle = '#fff'; ctx.font = '9px "Press Start 2P", monospace'; ctx.fillText(stage.name, VW / 2, 70); ctx.textAlign = 'left';
    }
    const boss = enemies.find(e => e.type === 'boss');
    if (boss) {
      ctx.fillStyle = 'rgba(10,6,31,.9)'; ctx.fillRect(330, VH - 52, 620, 28);
      ctx.fillStyle = '#311848'; ctx.fillRect(338, VH - 44, 604, 12);
      ctx.fillStyle = stage.accent2; ctx.fillRect(338, VH - 44, 604 * Math.max(0, boss.hp / boss.maxHp), 12);
      ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '9px "Press Start 2P", monospace'; ctx.fillText(`BOSS  ${stage.boss}`, VW / 2, VH - 58); ctx.textAlign = 'left';
    }
    if (bossState === 'warning') {
      ctx.globalAlpha = .55 + Math.sin(bossWarning * 12) * .35; ctx.fillStyle = stage.accent2; ctx.fillRect(0, 292, VW, 102);
      ctx.globalAlpha = 1; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '28px "Press Start 2P", monospace'; ctx.fillText('WARNING', VW / 2, 344);
      ctx.font = '11px "Press Start 2P", monospace'; ctx.fillText('BOSS APPROACHING', VW / 2, 374); ctx.textAlign = 'left';
    }
    if (stageBanner > 0) {
      const alpha = Math.min(1, stageBanner, (3 - stageBanner) * 2);
      ctx.globalAlpha = Math.max(0, alpha); ctx.fillStyle = 'rgba(7,4,25,.78)'; ctx.fillRect(0, 274, VW, 138);
      ctx.textAlign = 'center'; ctx.fillStyle = stage.accent; ctx.font = '16px "Press Start 2P", monospace'; ctx.fillText(`STAGE ${stageIndex + 1}`, VW / 2, 324);
      ctx.fillStyle = '#fff'; ctx.font = '23px "Press Start 2P", monospace'; ctx.fillText(stage.name, VW / 2, 370); ctx.globalAlpha = 1; ctx.textAlign = 'left';
    }
    if (bossState === 'transition' || bossState === 'final') {
      ctx.globalAlpha = .9; ctx.fillStyle = 'rgba(7,4,25,.86)'; ctx.fillRect(0, 276, VW, 132);
      ctx.textAlign = 'center'; ctx.fillStyle = '#ffe15a'; ctx.font = '25px "Press Start 2P", monospace'; ctx.fillText(bossState === 'final' ? 'MISSION COMPLETE!' : 'STAGE CLEAR!', VW / 2, 350);
      ctx.globalAlpha = 1; ctx.textAlign = 'left';
    }
    ctx.restore();
  }

  let audioCtx;
  function ensureAudio() {
    if (!soundOn) return;
    try {
      audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (_) { /* audio is optional */ }
  }

  function playMusicNote() {
    if (!soundOn || !audioCtx) return;
    const melody = [440, 523.25, 659.25, 523.25, 392, 493.88, 587.33, 493.88, 349.23, 440, 523.25, 659.25, 392, 493.88, 659.25, 783.99];
    const bossMelody = [146.83, 174.61, 146.83, 220, 207.65, 174.61, 155.56, 138.59, 146.83, 293.66, 261.63, 220, 207.65, 233.08, 174.61, 138.59];
    const bass = [110, 110, 98, 98, 87.31, 87.31, 98, 123.47];
    const bossMusic = bossState === 'active';
    const now = audioCtx.currentTime;
    const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
    o.type = bossMusic ? 'sawtooth' : 'square'; o.frequency.value = (bossMusic ? bossMelody : melody)[musicStep % melody.length]; o.connect(g); g.connect(audioCtx.destination);
    g.gain.setValueAtTime(bossMusic ? .026 : .018, now); g.gain.exponentialRampToValueAtTime(.001, now + .14); o.start(now); o.stop(now + .15);
    if (musicStep % 2 === 0) {
      const bo = audioCtx.createOscillator(); const bg = audioCtx.createGain(); bo.type = 'triangle'; bo.frequency.value = bass[Math.floor(musicStep / 2) % bass.length]; bo.connect(bg); bg.connect(audioCtx.destination);
      bg.gain.setValueAtTime(.035, now); bg.gain.exponentialRampToValueAtTime(.001, now + .3); bo.start(now); bo.stop(now + .31);
    }
    musicStep++;
  }

  function pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = [...pads].find(Boolean);
    if (!pad) { padInput.x = 0; padInput.y = 0; padInput.fire = false; padStartWasDown = false; padActionWasDown = false; return; }
    const deadzone = value => Math.abs(value) < .18 ? 0 : value;
    padInput.x = deadzone(pad.axes[0] || 0) + ((pad.buttons[15]?.pressed ? 1 : 0) - (pad.buttons[14]?.pressed ? 1 : 0));
    padInput.y = deadzone(pad.axes[1] || 0) + ((pad.buttons[13]?.pressed ? 1 : 0) - (pad.buttons[12]?.pressed ? 1 : 0));
    padInput.x = clamp(padInput.x, -1, 1); padInput.y = clamp(padInput.y, -1, 1);
    padInput.fire = Boolean(pad.buttons[0]?.pressed || pad.buttons[1]?.pressed || pad.buttons[2]?.pressed || (pad.buttons[7]?.value || 0) > .25);
    const startDown = Boolean(pad.buttons[9]?.pressed);
    const actionDown = Boolean(pad.buttons[0]?.pressed);
    if (startDown && !padStartWasDown && state === 'playing') { paused = !paused; pauseLabel.classList.toggle('is-visible', paused); }
    if (actionDown && !padActionWasDown && state !== 'playing') resetGame();
    padStartWasDown = startDown; padActionWasDown = actionDown;
  }

  function sfx(type) {
    if (!soundOn) return;
    try {
      ensureAudio();
      const o = audioCtx.createOscillator(); const gain = audioCtx.createGain();
      o.connect(gain); gain.connect(audioCtx.destination);
      const now = audioCtx.currentTime;
      const map = { shoot: [650, 980, .035, .035], boom: [130, 48, .1, .12], hurt: [180, 70, .18, .15], power: [480, 1200, .24, .12], boss: [90, 260, .7, .16] };
      const [a, b, dur, vol] = map[type]; o.type = type === 'shoot' ? 'square' : 'sawtooth';
      o.frequency.setValueAtTime(a, now); o.frequency.exponentialRampToValueAtTime(b, now + dur);
      gain.gain.setValueAtTime(vol, now); gain.gain.exponentialRampToValueAtTime(.001, now + dur);
      o.start(now); o.stop(now + dur);
    } catch (_) { /* audio is optional */ }
  }

  function frame(now) {
    const dt = Math.min(.033, (now - lastTime) / 1000 || 0);
    lastTime = now; pollGamepad(); update(dt); draw(); requestAnimationFrame(frame);
  }

  function pad(n) { return Math.floor(n).toString().padStart(6, '0'); }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function rects(ax, ay, aw, ah, bx, by, bw, bh) { return ax < bx+bw && ax+aw > bx && ay < by+bh && ay+ah > by; }
  function circleRect(cx, cy, r, x, y, w, h) { const nx = clamp(cx, x, x+w); const ny = clamp(cy, y, y+h); return (cx-nx)**2 + (cy-ny)**2 < r*r; }
  function starPath(cx, cy, outer, inner, points) { ctx.beginPath(); for (let i=0;i<points*2;i++){ const a=-Math.PI/2+i*Math.PI/points; const r=i%2?inner:outer; const x=cx+Math.cos(a)*r, y=cy+Math.sin(a)*r; i?ctx.lineTo(x,y):ctx.moveTo(x,y); } ctx.closePath(); }

  addEventListener('resize', resize);
  addEventListener('keydown', e => {
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
    keys.add(e.code);
    if (e.code === 'Escape' && state === 'playing') { paused = !paused; pauseLabel.classList.toggle('is-visible', paused); }
    if (e.code === 'Enter' && state !== 'playing') resetGame();
  });
  addEventListener('keyup', e => keys.delete(e.code));
  canvas.addEventListener('pointerdown', e => { if (state !== 'playing') return; pointer.active = true; const p = screenToWorld(e.clientX, e.clientY); pointer.x=p.x; pointer.y=p.y; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => { if (!pointer.active) return; const p=screenToWorld(e.clientX,e.clientY); pointer.x=p.x; pointer.y=p.y; });
  canvas.addEventListener('pointerup', () => pointer.active = false);
  canvas.addEventListener('pointercancel', () => pointer.active = false);
  startButton.addEventListener('click', resetGame);
  retryButton.addEventListener('click', resetGame);
  difficultyButtons.forEach(button => button.addEventListener('click', () => {
    difficultyKey = button.dataset.difficulty;
    difficultyButtons.forEach(item => item.classList.toggle('is-active', item === button));
    sfx('power');
  }));
  soundButton.addEventListener('click', () => {
    soundOn = !soundOn;
    soundButton.textContent = soundOn ? '♪ ON' : '♪ OFF';
    soundButton.classList.toggle('is-muted', !soundOn);
    if (soundOn) { ensureAudio(); sfx('power'); }
  });
  addEventListener('gamepadconnected', event => {
    controllerStatus.textContent = `🎮 ${event.gamepad.id.includes('Xbox') ? 'XBOX' : 'CONTROLLER'} READY`;
    controllerStatus.classList.add('is-visible');
    setTimeout(() => controllerStatus.classList.remove('is-visible'), 2400);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') { paused = true; pauseLabel.classList.add('is-visible'); } });

  resize(); initBackdrop(); requestAnimationFrame(frame);
})();

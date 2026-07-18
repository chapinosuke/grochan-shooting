(() => {
  'use strict';

  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  const startScreen = document.querySelector('#startScreen');
  const openingScreen = document.querySelector('#openingScreen');
  const gameOverScreen = document.querySelector('#gameOverScreen');
  const pauseLabel = document.querySelector('#pauseLabel');
  const startButton = document.querySelector('#startButton');
  const launchButton = document.querySelector('#launchButton');
  const retryButton = document.querySelector('#retryButton');
  const finalScore = document.querySelector('#finalScore');
  const newRecord = document.querySelector('#newRecord');
  const resultTitle = document.querySelector('#resultTitle');
  const menuHighScore = document.querySelector('#menuHighScore');
  const soundButton = document.querySelector('#soundButton');
  const pauseButton = document.querySelector('#pauseButton');
  const specialButton = document.querySelector('#specialButton');
  const resumeButton = document.querySelector('#resumeButton');
  const difficultyButtons = [...document.querySelectorAll('[data-difficulty]')];
  const controllerStatus = document.querySelector('#controllerStatus');
  const statKills = document.querySelector('#statKills');
  const statStage = document.querySelector('#statStage');
  const statTime = document.querySelector('#statTime');

  const VW = 1280;
  const VH = 720;
  const keys = new Set();
  const pointer = { active: false, x: 0, y: 0 };
  const spriteSheet = new Image();
  spriteSheet.src = 'assets/images/player-spritesheet.png';
  const bgmTracks = {
    opening: new Audio('assets/bgm/Neon Arcade Rush.mp3'),
    stage0: new Audio('assets/bgm/Neon Arcade Rush.mp3'),
    stage1: new Audio('assets/bgm/Neon Arena.mp3'),
    stage2: new Audio('assets/bgm/Neon Arena (1).mp3'),
    stage3: new Audio('assets/bgm/Neon Demoness.mp3'),
    stage4: new Audio('assets/bgm/Neon Bullet Heaven.mp3'),
    midBoss: new Audio('assets/bgm/The Crimson Labyrinth.mp3'),
    bossBattle: new Audio('assets/bgm/Neon Bullet Heaven.mp3'),
    finalBoss: new Audio('assets/bgm/Red Planet Showdown.mp3')
  };
  const bgmVolumes = { opening: .22, stage0: .27, stage1: .27, stage2: .27, stage3: .27, stage4: .27, midBoss: .3, bossBattle: .3, finalBoss: .32 };
  Object.entries(bgmTracks).forEach(([key, track]) => { track.loop = true; track.preload = 'auto'; track.volume = bgmVolumes[key]; });
  const sampledSfx = {
    shoot: { src: 'assets/sfx/player-shot.mp3', volume: .2, pool: 7, max: .42 },
    hit: { src: 'assets/sfx/hit.mp3', volume: .24, pool: 5, max: .5 },
    boom: { src: 'assets/sfx/explosion.mp3', volume: .19, pool: 5, max: 1.7 },
    bigBoom: { src: 'assets/sfx/big-explosion.mp3', volume: .32, pool: 2, max: 3.4 },
    missile: { src: 'assets/sfx/missile.mp3', volume: .25, pool: 3, max: .85 },
    special: { src: 'assets/sfx/special-beam.mp3', volume: .34, pool: 2, max: 2.4 },
    boss: { src: 'assets/sfx/charge.mp3', volume: .23, pool: 2, max: 1.6 },
    warning: { src: 'assets/sfx/boss-warning.mp3', volume: .2, pool: 1, max: 3.15 },
    power: { src: 'assets/sfx/power-up.mp3', volume: .3, pool: 2, max: .9 },
    shield: { src: 'assets/sfx/shield.mp3', volume: .28, pool: 3, max: .75 },
    hurt: { src: 'assets/sfx/heavy-hit.mp3', volume: .28, pool: 2, max: 1.25 }
  };
  const sfxPools = {};
  Object.entries(sampledSfx).forEach(([key, def]) => {
    sfxPools[key] = { cursor: 0, voices: Array.from({ length: def.pool }, () => {
      const voice = new Audio(def.src); voice.preload = 'auto'; voice.volume = def.volume; return voice;
    }) };
  });

  let spriteFrames = [];
  let walkFrames = [];
  let idleFrame = null;
  let jumpFrame = null;
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
  let midBossDone = false;
  let stageIndex = 0;
  let stageTime = 0;
  let stageBanner = 0;
  let stageTransition = 0;
  let difficultyKey = 'normal';
  let musicClock = 0;
  let musicStep = 0;
  let soundOn = true;
  let currentBgmKey = null;
  let bgmFadeToken = 0;
  let openingTimeout = 0;
  let totalKills = 0;
  let stageKills = 0;
  let stageStart = 0;
  let stageDamaged = false;
  let stageResult = null;
  let lightning = 0;
  let lightningX = 0;
  let special = 35;
  let specialFlash = 0;
  let formationTimer = 3;
  let fpsShow = false;   // F1 toggles a verification-only FPS readout
  let fpsAvg = 60;       // EMA of 1/rawDt
  const padInput = { x: 0, y: 0, fire: false, special: false };
  let padStartWasDown = false;
  let padActionWasDown = false;
  let padSpecialWasDown = false;
  const difficulties = {
    easy: { spawn: .92, speed: .88, damage: .72, bossTime: 48, bossHp: 220, score: .8, midHp: 70 },
    normal: { spawn: .72, speed: 1.05, damage: 1.05, bossTime: 42, bossHp: 340, score: 1, midHp: 110 },
    hard: { spawn: .55, speed: 1.28, damage: 1.35, bossTime: 36, bossHp: 480, score: 1.45, midHp: 160 }
  };
  const stages = [
    {
      name: 'SHIBUYA CROSSING', boss: 'HEART BREAKER', theme: 'neon', subtitle: '渋谷スクランブルの夜をかけぬけろ',
      sky: ['#120b3e', '#3b1878', '#f044a0'], far: '#28145e', city: '#100b34', accent: '#31e8ff', accent2: '#ff3e9d',
      spawnTable: [['drone', 5], ['bat', 4], ['spinner', 3], ['tank', 2], ['racer', 4], ['seeker', 1]],
      melody: [440, 523.25, 659.25, 523.25, 392, 493.88, 587.33, 493.88, 349.23, 440, 523.25, 659.25, 392, 493.88, 659.25, 783.99],
      bass: [110, 110, 98, 98, 87.31, 87.31, 98, 123.47]
    },
    {
      name: 'AQUA HIGHWAY', boss: 'DEEP BLUE DIVA', theme: 'aqua', subtitle: '潮風のハイウェイを駆け抜けろ',
      sky: ['#041b3d', '#075987', '#20c5c9'], far: '#123c68', city: '#071d42', accent: '#65fff2', accent2: '#2f8cff',
      spawnTable: [['bat', 3], ['jelly', 5], ['drone', 2], ['spinner', 3], ['manta', 4], ['racer', 2]],
      melody: [392, 440, 523.25, 587.33, 659.25, 587.33, 523.25, 440, 349.23, 392, 440, 523.25, 587.33, 523.25, 440, 392],
      bass: [98, 98, 87.31, 87.31, 110, 110, 87.31, 73.42]
    },
    {
      name: 'SUNSET FACTORY', boss: 'BLAZE EMPRESS', theme: 'factory', subtitle: '燃える夕日と鋼鉄の罠',
      sky: ['#351036', '#a42f4f', '#ff9f43'], far: '#592141', city: '#28132e', accent: '#ffe15a', accent2: '#ff5a36',
      spawnTable: [['tank', 5], ['turret', 4], ['ember', 5], ['drone', 2], ['walker', 4], ['spinner', 2]],
      melody: [329.63, 329.63, 392, 329.63, 311.13, 329.63, 392, 440, 329.63, 329.63, 392, 493.88, 440, 392, 329.63, 293.66],
      bass: [82.41, 82.41, 82.41, 82.41, 77.78, 77.78, 98, 98]
    },
    {
      name: 'CYBER STORM', boss: 'VOLT PHANTOM', theme: 'storm', subtitle: '雷鳴とどろく電脳空域',
      sky: ['#071d24', '#13554b', '#48b849'], far: '#164636', city: '#071f25', accent: '#72ff68', accent2: '#31e8ff',
      spawnTable: [['glitch', 5], ['spinner', 4], ['bat', 2], ['turret', 3], ['seeker', 4], ['racer', 2]],
      melody: [293.66, 349.23, 440, 349.23, 293.66, 369.99, 440, 587.33, 293.66, 349.23, 466.16, 440, 349.23, 293.66, 246.94, 293.66],
      bass: [73.42, 73.42, 87.31, 87.31, 73.42, 73.42, 92.5, 110]
    },
    {
      name: 'HEART PALACE', boss: 'QUEEN OF HEARTBREAK', theme: 'palace', subtitle: '決戦、ハートの女王の宮殿',
      sky: ['#25051d', '#72114e', '#d82065'], far: '#4d123d', city: '#21061d', accent: '#ffe15a', accent2: '#ff3e9d',
      spawnTable: [['cupid', 5], ['drone', 2], ['bat', 3], ['spinner', 3], ['tank', 3], ['knight', 4], ['seeker', 2]],
      melody: [261.63, 311.13, 392, 523.25, 466.16, 392, 311.13, 261.63, 233.08, 293.66, 349.23, 466.16, 392, 349.23, 293.66, 261.63],
      bass: [65.41, 65.41, 77.78, 77.78, 98, 98, 58.27, 65.41]
    }
  ];

  const GROUND_Y = 500;
  const CHIMNEYS = [[120, 60, 210], [196, 44, 160], [880, 70, 230], [1010, 50, 180], [430, 40, 140]];
  const player = { x: 170, y: 360, w: 118, h: 102, vx: 0, vy: 0, fire: 0, missileFire: 0, inv: 0, frame: 0, grounded: false, power: 1, spread: 1, speed: 1, takeoff: 0 };
  let bullets = [];
  let enemyBullets = [];
  let enemies = [];
  let particles = [];
  let pickups = [];
  let stars = [];
  let clouds = [];
  let ambient = [];
  let bgProps = [];
  let nearProps = [];
  let delayedBursts = [];
  let shockwaves = [];

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

  // --- Offscreen sprite-cache foundation ---------------------------------
  // Expensive, deterministic body art is baked once into an offscreen canvas
  // and blitted every frame; reactive bits (eyes, hit-flash, additive glow)
  // stay live. Bake-target draw helpers render through `rctx`, which equals
  // the on-screen `ctx` unless a bake is in progress. While no caller invokes
  // bakeSprite yet, rctx === ctx always, so behaviour is unchanged.
  const CACHE_SCALE = 2;              // matches the dpr cap in resize()
  const spriteCache = new Map();      // key -> offscreen canvas (baked at CACHE_SCALE)
  let rctx = ctx;                     // bake-target helpers draw through this
  function bakeSprite(key, w, h, painter) {
    const cached = spriteCache.get(key);
    if (cached) return cached;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * CACHE_SCALE));
    c.height = Math.max(1, Math.ceil(h * CACHE_SCALE));
    const bc = c.getContext('2d');
    bc.scale(CACHE_SCALE, CACHE_SCALE);
    const prev = rctx;
    rctx = bc;
    try { painter(bc); } finally { rctx = prev; }
    c._w = w; c._h = h;
    spriteCache.set(key, c);
    return c;
  }
  function blit(c, dx, dy, dw, dh) {
    ctx.drawImage(c, dx, dy, dw ?? c._w, dh ?? c._h);
  }
  // Memoize the static full-screen gradient objects that were being rebuilt
  // every frame. Gradient coordinates are resolved against the CTM at paint
  // time, so a cached object under the same user-space coords is pixel-identical.
  const gradCache = new Map();
  function cachedGrad(key, make) {
    let g = gradCache.get(key);
    if (!g) { g = make(); gradCache.set(key, g); }
    return g;
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

  function buildPlayerFrames() {
    if (!spriteSheet.naturalWidth) return;
    // Sheet 1672x941: idle + walk×4 (top, walk holds gun), jump + fly-shoot×4 (bottom).
    spriteFrames = [
      makeFrame(378, 535, 248, 305),
      makeFrame(684, 535, 248, 305),
      makeFrame(972, 535, 248, 305),
      makeFrame(1260, 535, 248, 305)
    ];
    idleFrame = makeFrame(92, 72, 225, 350);
    // Walk crops include the pink blaster tip (gun is part of the walk asset).
    walkFrames = [
      makeFrame(398, 72, 232, 350),
      makeFrame(684, 72, 232, 350),
      makeFrame(970, 72, 232, 350),
      makeFrame(1260, 72, 232, 350)
    ];
    jumpFrame = makeFrame(70, 500, 250, 340);
  }
  spriteSheet.onload = buildPlayerFrames;
  if (spriteSheet.complete) buildPlayerFrames();

  function resetGame() {
    clearTimeout(openingTimeout); openingTimeout = 0;
    score = 0; combo = 0; comboTimer = 0; health = maxHealth; elapsed = 0;
    spawnTimer = .7; pickupTimer = 6; shake = 0; flash = 0; gameSpeed = 1;
    bossState = 'waiting'; bossWarning = 0; midBossDone = false;
    stageIndex = 0; stageTime = 0; stageBanner = 3; stageTransition = 0;
    musicClock = 0; musicStep = 0;
    totalKills = 0; stageResult = null; lightning = 0; delayedBursts = [];
    special = 35; specialFlash = 0; formationTimer = 2.8;
    bullets = []; enemyBullets = []; enemies = []; particles = []; pickups = []; shockwaves = [];
    setupStage();
    player.x = 160; player.y = VH / 2; player.vx = 0; player.vy = 0;
    player.fire = 0; player.missileFire = .8; player.inv = 1.2; player.frame = 0; player.grounded = false; player.takeoff = 0; player.power = 1; player.spread = 1; player.speed = 1;
    state = 'playing'; paused = false;
    startScreen.classList.remove('is-visible');
    openingScreen.classList.remove('is-visible');
    gameOverScreen.classList.remove('is-visible');
    pauseLabel.classList.remove('is-visible');
    pauseButton.classList.add('is-visible');
    specialButton.classList.add('is-visible');
    pauseButton.classList.remove('is-paused');
    pauseButton.textContent = '❚❚';
    updateSpecialButton();
    lastTime = performance.now();
    ensureAudio();
    playBgm('stage0', true);
  }

  function showOpening() {
    clearTimeout(openingTimeout);
    state = 'opening'; paused = false;
    startScreen.classList.remove('is-visible'); gameOverScreen.classList.remove('is-visible');
    openingScreen.classList.remove('is-visible');
    // Restart the CSS timeline even when the intro is replayed after returning to the menu.
    void openingScreen.offsetWidth;
    openingScreen.classList.add('is-visible');
    pauseButton.classList.remove('is-visible'); specialButton.classList.remove('is-visible');
    playBgm('opening', true); ensureAudio(); sfx('power');
    openingTimeout = setTimeout(resetGame, 9000);
  }

  function playBgm(key, restart = false) {
    const next = bgmTracks[key];
    if (!next) return;
    const previousKey = currentBgmKey;
    const previous = previousKey && bgmTracks[previousKey];
    const targetVolume = bgmVolumes[key] ?? .27;
    if (previousKey === key) {
      if (restart) next.currentTime = 0;
      next.volume = targetVolume;
      if (soundOn) next.play().catch(() => { /* starts on the next user gesture */ });
      return;
    }
    const token = ++bgmFadeToken;
    currentBgmKey = key;
    if (restart) next.currentTime = 0;
    next.volume = 0;
    if (!soundOn) { if (previous) previous.pause(); return; }
    next.play().catch(() => { /* starts on the next user gesture */ });
    const started = performance.now(), duration = 900, previousVolume = previous ? previous.volume : 0;
    const fade = now => {
      if (token !== bgmFadeToken) return;
      const t = clamp((now - started) / duration, 0, 1);
      next.volume = targetVolume * t;
      if (previous) previous.volume = previousVolume * (1 - t);
      if (t < 1) requestAnimationFrame(fade);
      else if (previous) { previous.pause(); previous.volume = bgmVolumes[previousKey] ?? .27; }
    };
    requestAnimationFrame(fade);
  }

  function pauseBgm() { bgmFadeToken++; Object.values(bgmTracks).forEach(track => track.pause()); }

  function pauseSampledSfx() {
    Object.values(sfxPools).forEach(pool => pool.voices.forEach(voice => { voice.pause(); voice.currentTime = 0; }));
  }

  function desiredBgmKey() {
    if (state === 'opening' || state === 'menu') return 'opening';
    if (bossState === 'midboss-active' || bossState === 'midboss-warning') return 'midBoss';
    if (bossState === 'active') return stageIndex === stages.length - 1 ? 'finalBoss' : 'bossBattle';
    return `stage${stageIndex}`;
  }

  function playSampledSfx(type) {
    const def = sampledSfx[type], pool = sfxPools[type];
    if (!soundOn || !def || !pool) return false;
    const voice = pool.voices[pool.cursor++ % pool.voices.length];
    voice.pause(); voice.currentTime = 0; voice.volume = def.volume;
    voice.play().catch(() => { /* audio resumes on the next user gesture */ });
    if (def.max) setTimeout(() => { if (!voice.paused && voice.currentTime >= def.max - .08) { voice.pause(); voice.currentTime = 0; } }, def.max * 1000);
    return true;
  }

  function initBackdrop() {
    stars = Array.from({ length: 90 }, () => ({ x: Math.random() * VW, y: Math.random() * VH * .74, s: 1 + Math.random() * 3, a: Math.random() * 6 }));
    clouds = Array.from({ length: 8 }, () => ({ x: Math.random() * VW, y: 70 + Math.random() * 410, s: .5 + Math.random() * 1.1, v: 10 + Math.random() * 18 }));
  }

  function setupStage() {
    stageKills = 0; stageStart = elapsed; stageDamaged = false;
    formationTimer = 2.5 + Math.random() * 2;
    ambient = []; bgProps = []; lightning = 0;
    const theme = stages[stageIndex].theme;
    if (theme === 'neon') {
      bgProps = Array.from({ length: 3 }, (_, i) => ({ kind: 'car', x: Math.random() * VW, y: 150 + i * 90 + Math.random() * 40, v: 60 + Math.random() * 90, dir: Math.random() < .5 ? -1 : 1 }));
      bgProps.push({ kind: 'searchlight', x: 260, phase: 0, speed: .5 }, { kind: 'searchlight', x: 940, phase: 2.4, speed: .38 });
    } else if (theme === 'aqua') {
      for (let i = 0; i < 26; i++) ambient.push(makeAmbient('bubble'));
      bgProps.push({ kind: 'lighthouse', x: 1050, phase: 0 });
      bgProps.push({ kind: 'fish', x: VW + 100, phase: Math.random() * 4 }, { kind: 'fish', x: VW + 620, phase: Math.random() * 4 });
    } else if (theme === 'factory') {
      for (let i = 0; i < 14; i++) ambient.push(makeAmbient('smoke'));
      for (let i = 0; i < 10; i++) ambient.push(makeAmbient('spark'));
      bgProps = [
        { kind: 'gear', x: 190, y: 430, r: 58, speed: .5 }, { kind: 'gear', x: 610, y: 465, r: 40, speed: -.8 },
        { kind: 'gear', x: 1080, y: 420, r: 66, speed: .35 }, { kind: 'gear', x: 860, y: 486, r: 30, speed: -1.1 }
      ];
    } else if (theme === 'storm') {
      for (let i = 0; i < 70; i++) ambient.push(makeAmbient('rain'));
      bgProps = Array.from({ length: 9 }, () => ({ kind: 'code', x: Math.random() * VW, y: Math.random() * 560, v: 60 + Math.random() * 120, len: 5 + Math.floor(Math.random() * 8) }));
      bgProps.push({ kind: 'panel', x: 220, y: 170, w: 120, h: 66, phase: 0 }, { kind: 'panel', x: 760, y: 120, w: 150, h: 80, phase: 2 }, { kind: 'panel', x: 1060, y: 250, w: 100, h: 58, phase: 4 });
      lightning = 0; lightningX = VW * .5;
    } else if (theme === 'palace') {
      for (let i = 0; i < 20; i++) ambient.push(makeAmbient('heart'));
    }
    // Stable scene dressing gives every run a busy, inhabited world without
    // affecting collision or gameplay readability.
    for (let i = 0; i < 8; i++) bgProps.push({ kind: 'nearDetail', lane: i, seed: Math.random() * 1000 });
    // Cache the near-detail subset so the draw loop skips a per-frame filter().
    nearProps = bgProps.filter(p => p.kind === 'nearDetail');
  }

  function makeAmbient(kind) {
    if (kind === 'bubble') return { kind, x: Math.random() * VW, y: 300 + Math.random() * 380, vy: -(24 + Math.random() * 46), r: 2 + Math.random() * 5, a: Math.random() * 6 };
    if (kind === 'smoke') {
      const [cx, cw, ch] = CHIMNEYS[Math.floor(Math.random() * CHIMNEYS.length)];
      return { kind, x: cx + cw / 2 + (Math.random() - .5) * 14, y: 560 - ch - 8, vy: -(14 + Math.random() * 20), r: 9 + Math.random() * 18, life: 2.5 + Math.random() * 2 };
    }
    if (kind === 'spark') return { kind, x: Math.random() * VW, y: 560 + Math.random() * 80, vx: -(60 + Math.random() * 120), vy: -(60 + Math.random() * 160), life: .4 + Math.random() * .8 };
    if (kind === 'rain') return { kind, x: Math.random() * (VW + 200), y: -20 - Math.random() * VH, vx: -230, vy: 620 + Math.random() * 240, len: 14 + Math.random() * 16 };
    return { kind: 'heart', x: Math.random() * VW, y: Math.random() * VH * .8, vy: -(8 + Math.random() * 16), s: 4 + Math.random() * 8, a: Math.random() * 6 };
  }

  function updateAmbient(dt) {
    const theme = stages[stageIndex].theme;
    for (const a of ambient) {
      a.x += (a.vx || 0) * dt - 26 * dt * gameSpeed;
      a.y += (a.vy || 0) * dt;
      if (a.kind === 'spark') a.vy += 480 * dt;
      if (a.kind === 'smoke') a.r += dt * 6;
      if (a.a !== undefined) a.a += dt * 3;
      if (a.life !== undefined) a.life -= dt;
    }
    ambient = ambient.filter(a => a.y > -60 && a.y < VH + 40 && a.x > -80 && (a.life === undefined || a.life > 0));
    const cap = { aqua: 26, factory: 24, storm: 70, palace: 20 }[theme] || 0;
    while (ambient.length < cap) {
      const kind = theme === 'aqua' ? 'bubble' : theme === 'palace' ? 'heart' : theme === 'storm' ? 'rain' : Math.random() < .58 ? 'smoke' : 'spark';
      const fresh = makeAmbient(kind);
      if (kind === 'bubble') fresh.y = VH - 40;
      if (kind === 'heart') fresh.y = VH - 30;
      if (kind === 'rain') fresh.y = -20;
      ambient.push(fresh);
    }
    for (const p of bgProps) {
      if (p.kind === 'car') { p.x += p.v * p.dir * dt; if (p.x < -160) { p.x = VW + 60; p.dir = 1; p.v = 60 + Math.random() * 90; } if (p.x > VW + 160) { p.x = -60; p.dir = -1; } }
      else if (p.kind === 'fish') { p.phase += dt; if (p.phase > 4.6) { p.phase = 0; p.x = VW * .25 + Math.random() * VW * .8; } }
      else if (p.kind === 'code') { p.y += p.v * dt; if (p.y > 620) { p.y = -80; p.x = Math.random() * VW; } }
      else if (p.kind === 'gear' || p.kind === 'searchlight' || p.kind === 'panel' || p.kind === 'lighthouse') p.phase = (p.phase || 0) + dt * (p.speed || 1);
    }
    if (theme === 'storm') {
      lightning -= dt;
      if (lightning < -4 - Math.random() * 5) { lightning = .45; lightningX = 120 + Math.random() * (VW - 240); if (state === 'playing' && !paused) sfx('thunder'); }
    }
  }

  function shoot() {
    // Walk sheet gun tip ≈ local (217, 200) in 232×350 crop, drawn at (x-8,y-28) size 130×190.
    // → screen offset ≈ (+113, +80). Fly sheet tip is further forward.
    const muzzleX = player.x + (player.grounded ? 114 : 116);
    const muzzleY = player.y + (player.grounded ? 80 : 72 + Math.sin(player.frame * .65) * 3);
    const lanes = player.spread === 1 ? [0] : player.spread === 2 ? [-95, 0, 95] : [-160, -80, 0, 80, 160];
    // Ground run-and-gun: mostly horizontal out of the walk blaster (asset already aims forward).
    const aimBias = player.grounded ? -12 : 0;
    for (const vy of lanes) {
      bullets.push({ x: muzzleX, y: muzzleY, vx: 860, vy: vy + aimBias, life: 1.7, r: 7 + player.power * 2, damage: player.power, fromGround: player.grounded });
    }
    // Visible muzzle flash so walk-shoot reads clearly.
    burst(muzzleX, muzzleY, '#ffe15a', player.grounded ? 8 : 5, player.grounded ? 200 : 150);
    if (player.grounded) {
      particles.push({ x: muzzleX + 6, y: muzzleY, vx: 220, vy: (Math.random() - .5) * 40, life: .12, max: .12, color: '#ff8a35', size: 6, gravity: 0 });
      particles.push({ x: muzzleX + 2, y: muzzleY, vx: 160, vy: (Math.random() - .5) * 30, life: .1, max: .1, color: '#fff', size: 4, gravity: 0 });
    }
    sfx('shoot');
  }

  function shootMissile() {
    const x = player.x + (player.grounded ? 100 : 88);
    const y = player.y + (player.grounded ? 78 : 76);
    for (const side of [-1, 1]) bullets.push({ x, y: y + side * 17, vx: 390, vy: side * 115 - (player.grounded ? 20 : 0), life: 3.2, r: 9, damage: 1.4 + player.power * .65, missile: true, turn: 4.2 });
    burst(x, y, '#ff8a35', 7, 100); sfx('missile');
  }

  function useSpecial() {
    if (state !== 'playing' || paused || ['transition', 'final'].includes(bossState) || special < 100) return;
    special = 0; specialFlash = 1.25; player.inv = 2.2; shake = 24;
    const cx = player.x + player.w / 2, cy = player.y + player.h / 2;
    shockwaves.push({ x: cx, y: cy, r: 20, speed: 980, life: 1.05, max: 1.05, color: '#ffe15a' });
    shockwaves.push({ x: cx, y: cy, r: 8, speed: 690, life: 1.2, max: 1.2, color: '#ff3e9d' });
    for (const b of enemyBullets) burst(b.x, b.y, b.volt ? '#72ff68' : b.bubble ? '#65fff2' : '#ff9ccf', 2, 110);
    enemyBullets = [];
    for (const e of [...enemies]) {
      if (e.hp <= 0) continue;
      const damage = e.type === 'boss' ? 22 + player.power * 5 : e.type === 'midboss' ? 18 + player.power * 4 : 10 + player.power * 4;
      e.hp -= damage; e.hit = .3;
      if (e.hp <= 0) destroyEnemy(e);
    }
    burst(cx, cy, '#ffe15a', 70, 620); sfx('special'); updateSpecialButton();
  }

  function updateSpecialButton() {
    const ready = special >= 100;
    specialButton.classList.toggle('is-ready', ready);
    specialButton.disabled = !ready || state !== 'playing' || ['transition', 'final'].includes(bossState);
    specialButton.textContent = ready ? 'SPECIAL!' : `SPECIAL ${Math.floor(special)}%`;
  }

  function pickSpawnType() {
    const table = stages[stageIndex].spawnTable;
    let total = 0;
    for (const [, weight] of table) total += weight;
    let r = Math.random() * total;
    for (const [type, weight] of table) { r -= weight; if (r <= 0) return type; }
    return table[0][0];
  }

  function spawnEnemy(typeOverride = null, formation = null) {
    const type = typeOverride || pickSpawnType();
    const y = formation?.y ?? (80 + Math.random() * (VH - 210));
    let e;
    if (type === 'drone') e = { type, x: VW + 70, y, baseY: y, w: 64, h: 56, hp: 2, maxHp: 2, vx: 175 + stageTime * .8, t: Math.random() * 6, wave: Math.random() < .46, points: 120, fire: 1 + Math.random() * 2.2 };
    else if (type === 'bat') e = { type, x: VW + 70, y, baseY: y, w: 70, h: 50, hp: 1, maxHp: 1, vx: 255 + stageTime, t: Math.random() * 6, wave: true, points: 180, fire: 99 };
    else if (type === 'spinner') e = { type, x: VW + 80, y, baseY: y, w: 76, h: 76, hp: 4, maxHp: 4, vx: 150 + stageTime * .7, t: 0, wave: true, points: 350, fire: 1.3 };
    else if (type === 'tank') e = { type, x: VW + 90, y, baseY: y, w: 98, h: 78, hp: 7, maxHp: 7, vx: 105 + stageTime * .5, t: 0, wave: false, points: 600, fire: .9 };
    else if (type === 'turret') e = { type, x: VW + 80, y: 574, baseY: 574, w: 74, h: 72, hp: 5, maxHp: 5, vx: 125, t: 0, wave: false, points: 480, fire: .7 };
    else if (type === 'jelly') e = { type, x: VW + 70, y: Math.min(y, 460), baseY: Math.min(y, 460), w: 62, h: 66, hp: 3, maxHp: 3, vx: 85 + stageTime * .4, t: Math.random() * 6, wave: true, points: 260, fire: 99 };
    else if (type === 'ember') e = { type, x: VW + 60, y: 606, baseY: 606, w: 44, h: 44, hp: 1, maxHp: 1, vx: 290 + stageTime, t: Math.random() * 2, wave: false, points: 220, fire: 99, vy: -(330 + Math.random() * 180) };
    else if (type === 'glitch') e = { type, x: VW + 70, y, baseY: y, w: 58, h: 58, hp: 3, maxHp: 3, vx: 140, t: Math.random() * 6, wave: false, points: 320, fire: 1.7, tp: .6 + Math.random() * .6, blink: 0 };
    else if (type === 'racer') e = { type, x: VW + 90, y: clamp(y, 170, 510), baseY: clamp(y, 170, 510), w: 84, h: 46, hp: 3, maxHp: 3, vx: 285 + stageTime, t: Math.random() * 6, wave: true, points: 420, fire: 1.25 };
    else if (type === 'manta') e = { type, x: VW + 90, y: Math.min(y, 455), baseY: Math.min(y, 455), w: 88, h: 52, hp: 4, maxHp: 4, vx: 125 + stageTime * .55, t: Math.random() * 6, wave: true, points: 440, fire: 1.45 };
    else if (type === 'walker') e = { type, x: VW + 90, y: 548, baseY: 548, w: 84, h: 92, hp: 8, maxHp: 8, vx: 92 + stageTime * .35, t: Math.random() * 2, wave: false, points: 760, fire: .85 };
    else if (type === 'seeker') e = { type, x: VW + 80, y, baseY: y, w: 68, h: 68, hp: 5, maxHp: 5, vx: 155 + stageTime * .6, t: Math.random() * 6, wave: true, points: 520, fire: 1.15 };
    else if (type === 'knight') e = { type, x: VW + 80, y: Math.min(y, 500), baseY: Math.min(y, 500), w: 72, h: 82, hp: 7, maxHp: 7, vx: 115 + stageTime * .4, t: Math.random() * 6, wave: true, points: 680, fire: 1.3 };
    else e = { type: 'cupid', x: VW + 70, y, baseY: y, w: 62, h: 58, hp: 3, maxHp: 3, vx: 120, t: Math.random() * 6, wave: true, points: 340, fire: 1.6 };
    const variantRoll = Math.random();
    e.variant = variantRoll < .11 ? 'elite' : variantRoll < .31 ? 'armored' : 'standard';
    if (e.variant === 'armored') { e.hp = Math.ceil(e.hp * 1.45); e.maxHp = e.hp; e.vx *= .88; e.points = Math.round(e.points * 1.45); }
    if (e.variant === 'elite') { e.hp = Math.ceil(e.hp * 1.25); e.maxHp = e.hp; e.vx *= 1.2; e.fire *= .72; e.points = Math.round(e.points * 1.8); }
    const hpBonus = Math.floor(stageIndex / 2);
    e.hp += hpBonus; e.maxHp += hpBonus;
    e.vx *= 1 + stageIndex * .08;
    e.points = Math.round(e.points * (1 + stageIndex * .22));
    if (e.variant === 'armored') e.shield = Math.ceil(e.maxHp * .6);
    if (formation) { e.x += formation.xOffset || 0; e.formation = formation.shape; e.formationSlot = formation.slot || 0; }
    const canDive = ['bat', 'racer', 'cupid', 'knight'].includes(e.type);
    e.behavior = formation ? 'formation' : canDive && Math.random() < .48 ? 'dive' : Math.random() < .24 ? 'stagger' : 'cruise';
    enemies.push(e);
  }

  function spawnFormation() {
    const type = pickSpawnType();
    const groundType = ['tank', 'turret', 'ember', 'walker'].includes(type);
    const count = groundType ? 2 : (Math.random() < .35 ? 4 : 3);
    const shape = Math.random() < .5 ? 'vee' : 'column';
    const centerY = 140 + Math.random() * 300;
    for (let i = 0; i < count; i++) {
      const offset = i - (count - 1) / 2;
      const y = groundType ? 560 : clamp(centerY + (shape === 'vee' ? Math.abs(offset) * 58 : offset * 64), 75, 535);
      spawnEnemy(type, { y, xOffset: i * 82 + (shape === 'vee' ? Math.abs(offset) * 35 : 0), shape, slot: i });
    }
    formationTimer = 3.2 + Math.random() * 2.4;
  }

  function spawnBoss() {
    const bossHp = Math.round(difficulties[difficultyKey].bossHp * (1 + stageIndex * .55));
    // Design art is 230×190; scale way up so the boss fills a large chunk of the arena.
    enemies.push({ type: 'boss', x: VW + 380, y: 90, baseY: 90, w: 460, h: 380, hp: bossHp, maxHp: bossHp, vx: 0, t: 0, wave: false, points: 18000 + stageIndex * 4000, fire: .7, sp: 2.8 });
    bossState = 'active';
    musicStep = 0; musicClock = 0;
    enemyBullets = [];
    shake = 18; flash = .55;
    playBgm(stageIndex === stages.length - 1 ? 'finalBoss' : 'bossBattle', true);
    sfx('boss'); sfx('warning');
  }

  function spawnMidBoss() {
    const baseHp = difficulties[difficultyKey].midHp;
    const hp = Math.round(baseHp * (1 + stageIndex * .38));
    enemies.push({ type: 'midboss', x: VW + 240, y: 140, baseY: 140, w: 280, h: 230, hp, maxHp: hp, vx: 0, t: 0, wave: false, points: 6200 + stageIndex * 1200, fire: .55, sp: 2.1, variant: 'standard' });
    bossState = 'midboss-active';
    enemyBullets = []; shake = 14; flash = .45;
    playBgm('midBoss', true); sfx('boss'); sfx('warning');
  }

  function updateMidBoss(e, dt) {
    const midPark = VW - e.w - 50;
    if (e.x > midPark) e.x -= 300 * dt;
    e.y = clamp(e.baseY + Math.sin(e.t * (1.25 + stageIndex * .1)) * (70 + stageIndex * 6), 20, VH - e.h - 30);
    e.fire -= dt; e.sp -= dt;
    const engaged = e.x <= midPark + 20;
    const rage = e.hp < e.maxHp * .45;
    if (engaged && e.fire <= 0) {
      const ox = e.x + 12, oy = e.y + e.h / 2;
      const aim = Math.atan2(player.y + 45 - oy, player.x - ox);
      const count = rage ? 7 : 5;
      for (let i = 0; i < count; i++) {
        const a = aim + (i - (count - 1) / 2) * .17;
        enemyBullets.push({ x: ox, y: oy, vx: Math.cos(a) * (270 + stageIndex * 22), vy: Math.sin(a) * (270 + stageIndex * 22), r: 10, life: 6.5, damage: 16 + stageIndex, boss: true, volt: stageIndex === 3, fire: stageIndex === 2, heart: stageIndex === 4, bubble: stageIndex === 1 });
      }
      burst(ox, oy, stages[stageIndex].accent2, 10, 190); e.fire = rage ? .42 : .58;
    }
    if (engaged && e.sp <= 0) {
      const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
      const count = rage ? 16 : 12;
      for (let i = 0; i < count; i++) {
        const a = i / count * Math.PI * 2 + e.t * .4;
        enemyBullets.push({ x: cx, y: cy, vx: Math.cos(a) * 195, vy: Math.sin(a) * 195, r: 9, life: 6, damage: 15 + stageIndex, boss: true });
      }
      // Side cannons
      for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          enemyBullets.push({ x: cx + side * 55, y: cy, vx: -210, vy: (i - 1) * 90, r: 8, life: 5.5, damage: 14 + stageIndex, boss: true });
        }
      }
      shockwaves.push({ x: cx, y: cy, r: 16, speed: 340, life: .6, max: .6, color: stages[stageIndex].accent2 });
      sfx('boss'); e.sp = rage ? 2.4 : 3.3;
    }
  }

  function enemyShoot(e) {
    const dx = player.x - e.x;
    const dy = (player.y + 45) - (e.y + e.h / 2);
    const aim = Math.atan2(dy, dx);
    if (e.type === 'cupid') {
      enemyBullets.push({ x: e.x + 8, y: e.y + e.h / 2, vx: Math.cos(aim) * 155, vy: Math.sin(aim) * 155, r: 10, life: 6, damage: 16, heart: true, homing: 1.1 });
      return;
    }
    if (e.type === 'manta') {
      for (const offset of [-.18, .18]) enemyBullets.push({ x: e.x, y: e.y + 28, vx: Math.cos(aim + offset) * 190, vy: Math.sin(aim + offset) * 190, r: 9, life: 6, damage: 14, bubble: true, drift: 90 });
      return;
    }
    if (e.type === 'knight') {
      enemyBullets.push({ x: e.x, y: e.y + 38, vx: Math.cos(aim) * 230, vy: Math.sin(aim) * 230, r: 9, life: 6, damage: 17, heart: true, homing: .42 });
      return;
    }
    if (e.type === 'walker') {
      for (const lift of [-250, -355]) enemyBullets.push({ x: e.x, y: e.y + 28, vx: Math.cos(aim) * 190, vy: lift, gravity: 420, r: 10, life: 5, damage: 20, fire: true });
      return;
    }
    const speed = ['tank', 'turret', 'walker'].includes(e.type) ? 250 : ['glitch', 'racer', 'seeker'].includes(e.type) ? 330 : 205;
    const count = e.type === 'spinner' ? 3 : e.type === 'seeker' ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const base = aim + (i - (count - 1) / 2) * .2;
      enemyBullets.push({ x: e.x, y: e.y + e.h / 2, vx: Math.cos(base) * speed, vy: Math.sin(base) * speed, r: ['tank', 'walker'].includes(e.type) ? 11 : 8, life: 5, damage: ['tank', 'walker'].includes(e.type) ? 25 : 18, volt: e.type === 'seeker' });
    }
  }

  function updateBoss(e, dt) {
    const idx = stageIndex;
    const parkX = VW - e.w - 40;
    if (e.x > parkX && e.mode !== 'dash' && e.mode !== 'return') e.x -= 250 * dt;
    if (!e.phase2 && e.hp <= e.maxHp / 2) {
      e.phase2 = true; shake = 14; flash = .5;
      burst(e.x + e.w / 2, e.y + e.h / 2, stages[idx].accent2, 40, 420);
      enemyBullets = []; sfx('boss');
    }
    const engaged = e.x < parkX + 30;
    e.fire -= dt;
    e.sp = e.sp === undefined ? 3.5 : e.sp - dt;
    if (e.tel > 0) {
      e.tel -= dt;
      if (e.tel <= 0) executeBossSpecial(e);
    }
    const yMin = 16, yMax = Math.max(40, VH - e.h - 24);
    const bobY = (mid, amp) => clamp(mid + Math.sin(e.t * 1.1) * amp, yMin, yMax);
    if (idx === 0) {
      if (e.mode === 'dash') {
        e.x -= 780 * dt;
        if (e.x < 40) e.mode = 'return';
      } else if (e.mode === 'return') {
        e.x += 430 * dt;
        if (e.x >= parkX) { e.x = parkX; e.mode = 'hover'; }
      } else {
        e.y = bobY(e.baseY + 40, 70);
        if (engaged && e.fire <= 0) { bossFan(e, e.phase2 ? 9 : 6); e.fire = e.phase2 ? .48 : .62; }
        if (engaged && e.sp <= 0 && !(e.tel > 0)) { e.tel = .7; e.telType = 'dash'; e.telY = clamp(player.y - 30, 40, 480); e.sp = e.phase2 ? 3.8 : 5.2; }
      }
    } else if (idx === 1) {
      e.y = bobY(e.baseY + 30, 80);
      if (engaged && e.fire <= 0) { bossBubbles(e); e.fire = e.phase2 ? .48 : .7; }
      if (engaged && e.sp <= 0 && !(e.tel > 0)) { e.tel = .85; e.telType = 'wave'; e.sp = e.phase2 ? 3.2 : 4.6; }
    } else if (idx === 2) {
      e.y = bobY(e.baseY + 50, 55);
      if (engaged && e.fire <= 0) {
        if (e.phase2) { bossFlameSweep(e); e.fire = .12; } else { bossFireball(e); e.fire = .85; }
      }
      if (engaged && e.sp <= 0 && !(e.tel > 0)) { e.tel = .8; e.telType = 'pillar'; e.telX = clamp(player.x + 45, 60, VW - 200); e.sp = e.phase2 ? 2.8 : 4.0; }
    } else if (idx === 3) {
      e.blink = Math.max(0, (e.blink || 0) - dt);
      e.tpT = e.tpT === undefined ? 2 : e.tpT - dt;
      if (e.tpT <= 0) {
        e.tpT = e.phase2 ? 1.7 : 2.4; e.blink = .3;
        burst(e.x + e.w / 2, e.y + e.h / 2, '#72ff68', 16, 260);
        e.x = clamp(VW - e.w - 80 - Math.random() * 200, 200, parkX);
        e.y = clamp(40 + Math.random() * (yMax - 40), yMin, yMax);
        burst(e.x + e.w / 2, e.y + e.h / 2, '#72ff68', 16, 260); sfx('teleport');
        if (e.phase2) bossVoltRing(e);
      }
      if (engaged && e.fire <= 0) { bossVoltShot(e); e.fire = e.phase2 ? .55 : .75; }
      if (engaged && e.sp <= 0 && !(e.tel > 0)) { e.tel = .75; e.telType = 'strike'; e.telX = clamp(player.x + 45, 60, VW - 100); e.sp = e.phase2 ? 2.5 : 3.8; }
    } else {
      e.y = bobY(e.baseY + 35, 75);
      e.spiral = (e.spiral || 0) + dt * (e.phase2 ? 3.4 : 2.4);
      if (engaged && e.fire <= 0) { bossHeartSpiral(e); e.fire = e.phase2 ? .16 : .24; }
      if (engaged && e.sp <= 0 && !(e.tel > 0)) {
        e.telType = ['fan', 'wave', 'ring'][Math.floor(Math.random() * (e.phase2 ? 3 : 2))];
        e.tel = .7; e.sp = e.phase2 ? 2.6 : 3.8;
      }
    }
  }

  function executeBossSpecial(e) {
    const type = e.telType; e.telType = null;
    if (type === 'dash') { e.mode = 'dash'; e.y = e.telY; sfx('boss'); }
    else if (type === 'wave') { stageIndex === 4 ? bossHeartWall(e) : bossBubbleWall(e); }
    else if (type === 'pillar') bossPillar(e.telX);
    else if (type === 'strike') bossStrike(e.telX);
    else if (type === 'fan') bossFan(e, 7);
    else if (type === 'ring') bossHeartRing(e);
  }

  function bossFan(e, n) {
    const ox = e.x + 18, oy = e.y + e.h / 2;
    const aim = Math.atan2(player.y + 45 - oy, player.x - ox);
    for (let i = 0; i < n; i++) {
      const a = aim + (i - (n - 1) / 2) * .19;
      enemyBullets.push({ x: ox, y: oy, vx: Math.cos(a) * 285, vy: Math.sin(a) * 285, r: 10, life: 6, damage: 18, boss: true });
    }
    burst(ox, oy, '#ff3e9d', 9, 190);
  }

  function bossBubbles(e) {
    const ox = e.x + 20, oy = e.y + e.h / 2;
    const aim = Math.atan2(player.y + 45 - oy, player.x - ox);
    for (let i = -1; i <= 1; i++) {
      const a = aim + i * .3;
      enemyBullets.push({ x: ox, y: oy, vx: Math.cos(a) * 190, vy: Math.sin(a) * 190, r: 11, life: 7, damage: 13, bubble: true, drift: 220 });
    }
    sfx('bubble');
  }

  function bossBubbleWall(e) {
    const gap = 1 + Math.floor(Math.random() * 5);
    for (let i = 0; i < 8; i++) {
      if (i === gap || i === gap + 1) continue;
      enemyBullets.push({ x: e.x - 30, y: 60 + i * 85, vx: -235, vy: 0, r: 13, life: 8, damage: 15, bubble: true });
    }
    sfx('boss');
  }

  function bossFireball(e) {
    const ox = e.x + 20, oy = e.y + e.h / 2;
    for (const lead of [0, 90]) {
      enemyBullets.push({ x: ox, y: oy, vx: (player.x + lead - ox) / 1.3, vy: -300 - Math.random() * 110, gravity: 430, r: 12, life: 6, damage: 17, fire: true });
    }
    sfx('fireball');
  }

  function bossFlameSweep(e) {
    e.sweep = (e.sweep || 2.6) + .13;
    const a = Math.PI - Math.sin(e.sweep) * .85;
    const ox = e.x + 20, oy = e.y + e.h / 2;
    enemyBullets.push({ x: ox, y: oy, vx: Math.cos(a) * 330, vy: Math.sin(a) * 330, r: 10, life: 4, damage: 13, fire: true });
  }

  function bossPillar(x) {
    for (let i = 0; i < 7; i++) {
      enemyBullets.push({ x: x + (Math.random() - .5) * 26, y: 690 + i * 42, vx: 0, vy: -560, r: 12, life: 3.2, damage: 16, fire: true });
    }
    burst(x, 655, '#ff8a35', 18, 300); shake = 10; sfx('fireball');
  }

  function bossVoltShot(e) {
    const ox = e.x + 20, oy = e.y + e.h / 2;
    const aim = Math.atan2(player.y + 45 - oy, player.x - ox);
    for (let i = -1; i <= 1; i++) {
      const a = aim + i * .22;
      enemyBullets.push({ x: ox, y: oy, vx: Math.cos(a) * 360, vy: Math.sin(a) * 360, r: 8, life: 5, damage: 14, volt: true });
    }
  }

  function bossStrike(x) {
    for (let i = 0; i < 8; i++) enemyBullets.push({ x: x + (Math.random() - .5) * 20, y: -30 - i * 46, vx: 0, vy: 640, r: 9, life: 2.6, damage: 16, volt: true });
    lightning = .4; lightningX = x; shake = 12; sfx('thunder');
  }

  function bossVoltRing(e) {
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      enemyBullets.push({ x: cx, y: cy, vx: Math.cos(a) * 240, vy: Math.sin(a) * 240, r: 8, life: 4, damage: 13, volt: true });
    }
  }

  function bossHeartSpiral(e) {
    const cx = e.x + 40, cy = e.y + e.h / 2;
    for (const off of [0, Math.PI]) {
      const a = e.spiral + off;
      enemyBullets.push({ x: cx, y: cy, vx: Math.cos(a) * 210, vy: Math.sin(a) * 210, r: 9, life: 6, damage: 13, heart: true });
    }
  }

  function bossHeartWall(e) {
    const gap = 1 + Math.floor(Math.random() * 5);
    for (let i = 0; i < 8; i++) {
      if (i === gap || i === gap + 1) continue;
      enemyBullets.push({ x: e.x - 30, y: 60 + i * 85, vx: -245, vy: 0, r: 11, life: 8, damage: 15, heart: true });
    }
    sfx('boss');
  }

  function bossHeartRing(e) {
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2;
      enemyBullets.push({ x: cx, y: cy, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, r: 10, life: 7, damage: 14, heart: true, homing: .5 });
    }
    sfx('boss');
  }

  function update(dt) {
    if (state !== 'playing' || paused) return;
    elapsed += dt;
    if (bossState === 'waiting') stageTime += dt;
    stageBanner = Math.max(0, stageBanner - dt);
    gameSpeed = Math.min(1.6, 1 + stageTime / 100) + stageIndex * .08;
    shake = Math.max(0, shake - dt * 25); flash = Math.max(0, flash - dt * 3);
    specialFlash = Math.max(0, specialFlash - dt);
    player.inv = Math.max(0, player.inv - dt);
    comboTimer -= dt;
    if (comboTimer <= 0) combo = 0;

    const difficulty = difficulties[difficultyKey];
    // The supplied full-length tracks replace the old generated note loop.

    const bossAt = difficulty.bossTime + stageIndex * 3;
    const midAt = bossAt * .38;
if (bossState === 'waiting' && !midBossDone && stageTime >= midAt) {
      bossState = 'midboss-warning'; bossWarning = 3.0; enemies = []; enemyBullets = []; bullets = []; sfx('warning');
      playBgm('midBoss', true);
    } else if (bossState === 'midboss-warning') {
      bossWarning -= dt;
      if (bossWarning <= 0) spawnMidBoss();
    } else if (bossState === 'waiting' && midBossDone && stageTime >= bossAt) {
      bossState = 'warning'; bossWarning = 3.6; enemies = []; enemyBullets = []; bullets = []; sfx('warning');
    } else if (bossState === 'waiting' && !midBossDone && stageTime >= bossAt) {
      // Safety: if mid was skipped somehow, force mid first
      bossState = 'midboss-warning'; bossWarning = 2.5; enemies = []; enemyBullets = []; sfx('warning');
      playBgm('midBoss', true);
    } else if (bossState === 'warning') {
      bossWarning -= dt;
      if (bossWarning <= 0) spawnBoss();
    } else if (bossState === 'transition' || bossState === 'final') {
      stageTransition -= dt;
      if (stageTransition <= 0) {
        if (bossState === 'final') {
          finishGame(true);
        } else {
          stageIndex++; stageTime = 0; stageBanner = 3; bossState = 'waiting'; midBossDone = false; spawnTimer = 1.2; pickupTimer = 4;
          health = Math.min(maxHealth, health + 28); player.inv = 2;
          stageResult = null; setupStage(); musicStep = 0; musicClock = 0;
          playBgm(`stage${stageIndex}`, true);
        }
      }
    }

    let ax = padInput.x, ay = padInput.y;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) ax--;
    if (keys.has('ArrowRight') || keys.has('KeyD')) ax++;
    if (keys.has('ArrowUp') || keys.has('KeyW')) ay--;
    if (keys.has('ArrowDown') || keys.has('KeyS')) ay++;
    const speedBoost = 1 + (player.speed - 1) * .18;
    player.takeoff = Math.max(0, player.takeoff - dt);
    // Clear vertical intent (ignore tiny stick noise so walking is not cancelled).
    const upHeld = keys.has('ArrowUp') || keys.has('KeyW') || padInput.y < -.45;
    const downHeld = keys.has('ArrowDown') || keys.has('KeyS') || padInput.y > .45;
    if (player.grounded) {
      // Takeoff only on clear Up / top-screen swipe — never cancel walk+shoot by accident.
      const wantTakeoff = upHeld || (pointer.active && pointer.y < 120);
      if (wantTakeoff) {
        player.grounded = false;
        player.vy = -340;
        player.takeoff = .28;
        burst(player.x + 55, GROUND_Y + 130, '#31e8ff', 12, 140);
      } else {
        // Run & gun: horizontal walk while the walk-with-gun sprite fires.
        player.vx += ax * 1300 * speedBoost * dt;
        if (pointer.active) player.vx += Math.sign(pointer.x - player.x - 50) * 950 * speedBoost * dt;
        player.vy = 0;
        player.y = GROUND_Y;
      }
    }
    if (!player.grounded) {
      if (pointer.active) {
        const targetX = Math.min(pointer.x - player.w * .45, VW * .58);
        const targetY = pointer.y - player.h * .5;
        player.vx += (targetX - player.x) * dt * 18;
        player.vy += (targetY - player.y) * dt * 18;
      } else {
        player.vx += ax * 1250 * speedBoost * dt;
        player.vy += ay * 1250 * speedBoost * dt;
      }
    }
    const drag = Math.pow(.0009, dt);
    player.vx *= drag; player.vy *= drag;
    const speed = Math.hypot(player.vx, player.vy);
    const maxMoveSpeed = (player.grounded ? 380 : 420) * (1 + (player.speed - 1) * .16);
    if (speed > maxMoveSpeed) { player.vx *= maxMoveSpeed / speed; player.vy *= maxMoveSpeed / speed; }
    player.x = clamp(player.x + player.vx * dt, 28, VW * .62);
    if (player.grounded) {
      player.y = GROUND_Y;
      player.vy = 0;
    } else {
      player.y = clamp(player.y + player.vy * dt, 32, GROUND_Y);
      // Land with Down, bottom touch, or settling on the floor.
      const wantLand = downHeld || (pointer.active && pointer.y > 580) || (player.y >= GROUND_Y - 1 && player.vy >= -10 && !upHeld && player.takeoff <= 0);
      if (player.y >= GROUND_Y && wantLand) {
        player.grounded = true; player.y = GROUND_Y; player.vy = 0;
        burst(player.x + 55, GROUND_Y + 132, '#ffe15a', 10, 110);
      }
    }
    // Manual fire only: Space / Z / hold pointer / pad fire.
    const firing = keys.has('Space') || keys.has('KeyZ') || pointer.active || padInput.fire;
    const canShoot = firing && !['transition', 'final', 'warning', 'midboss-warning'].includes(bossState);
    const groundAnim = player.grounded && (Math.abs(player.vx) > 18 || firing);
    player.frame += dt * (player.grounded ? (groundAnim ? 11 : 0) : 10);
    player.fire -= dt; player.missileFire -= dt;
    if (canShoot && player.fire <= 0) {
      shoot();
      player.fire = player.grounded ? .12 : .13;
    }
    if (canShoot && player.power >= 2 && player.missileFire <= 0) {
      shootMissile();
      player.missileFire = player.power >= 3 ? .75 : 1.05;
    }

    spawnTimer -= dt;
    formationTimer -= dt;
    if (bossState === 'waiting' && stageBanner <= 1.2 && spawnTimer <= 0) {
      const cap = 9 + stageIndex;
      if (formationTimer <= 0 && enemies.length < cap) {
        spawnFormation();
        // Bonus second pack for volume
        if (Math.random() < .55 && enemies.length < cap) spawnFormation();
        spawnTimer = 1.05 + Math.random() * .35;
      } else if (enemies.length < cap) {
        spawnEnemy();
        if (Math.random() < .45 && enemies.length < cap) spawnEnemy();
        if (Math.random() < .22 && enemies.length < cap) spawnEnemy();
        spawnTimer = ((.32 + Math.random() * .28) * difficulty.spawn) / gameSpeed;
      } else {
        spawnTimer = .35;
      }
    }
    pickupTimer -= dt;
    if (pickupTimer <= 0 && (bossState === 'waiting' || bossState === 'active' || bossState === 'midboss-active')) {
      const roll = Math.random();
      const type = roll < .28 ? 'heal' : roll < .53 ? 'power' : roll < .76 ? 'spread' : 'speed';
      pickups.push({ type, kind: type === 'heal' ? (Math.random() < .5 ? 'drink' : 'burger') : null, x: VW + 30, y: 100 + Math.random() * (VH - 240), r: 19, t: 0 });
      pickupTimer = 8 + Math.random() * 7;
    }

    for (const s of stars) { s.x -= s.s * 15 * dt * gameSpeed; s.a += dt * 2; if (s.x < -5) { s.x = VW + 5; s.y = Math.random() * VH * .75; } }
    for (const c of clouds) { c.x -= c.v * dt * gameSpeed; if (c.x < -220 * c.s) { c.x = VW + 150; c.y = 80 + Math.random() * 390; } }
    updateAmbient(dt);
    for (const b of bullets) {
      if (b.missile) {
        let target = null, best = Infinity;
        for (const e of enemies) { const d = (e.x - b.x) ** 2 + (e.y + e.h / 2 - b.y) ** 2; if (e.hp > 0 && d < best) { best = d; target = e; } }
        if (target) {
          const wanted = Math.atan2(target.y + target.h / 2 - b.y, target.x + target.w / 2 - b.x);
          const current = Math.atan2(b.vy, b.vx); let diff = wanted - current;
          while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
          const angle = current + clamp(diff, -b.turn * dt, b.turn * dt), speed = Math.min(690, Math.hypot(b.vx, b.vy) + 360 * dt);
          b.vx = Math.cos(angle) * speed; b.vy = Math.sin(angle) * speed;
        }
        if (Math.random() < .65) particles.push({ x: b.x - b.vx * .018, y: b.y - b.vy * .018, vx: -b.vx * .08, vy: -b.vy * .08, life: .22, max: .22, color: '#ff8a35', size: 4, gravity: 0 });
      }
      b.x += b.vx * dt; b.y += (b.vy || 0) * dt; b.life -= dt;
    }
    for (const b of enemyBullets) {
      if (b.homing) {
        const target = Math.atan2(player.y + 45 - b.y, player.x + 40 - b.x);
        const cur = Math.atan2(b.vy, b.vx);
        const sp = Math.hypot(b.vx, b.vy);
        let diff = target - cur;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const na = cur + clamp(diff, -b.homing * dt, b.homing * dt);
        b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
      }
      if (b.gravity) b.vy += b.gravity * dt;
      if (b.drift) { b.vx += Math.sin(elapsed * 3 + b.y * .05) * b.drift * dt; b.vy += Math.cos(elapsed * 2.6 + b.x * .04) * b.drift * dt; }
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (!b.grazed && player.inv <= 0) {
        const dx = b.x - (player.x + 56), dy = b.y - (player.y + 55);
        const grazeRange = b.r + 48;
        if (dx * dx + dy * dy < grazeRange * grazeRange) {
          b.grazed = true; special = Math.min(100, special + 2.2); score += 35;
          burst(b.x, b.y, '#ffe15a', 3, 80); sfx('graze');
        }
      }
    }
    for (const e of enemies) {
      e.t += dt;
      e.hit = Math.max(0, (e.hit || 0) - dt);
      if (e.type === 'boss') { updateBoss(e, dt); continue; }
      if (e.type === 'midboss') { updateMidBoss(e, dt); continue; }
      e.x -= e.vx * dt * gameSpeed * difficulty.speed;
      if (e.behavior === 'dive' && e.x < 1040 && e.x > 380) {
        const targetY = clamp(player.y + 20 + Math.sin(e.t * 5) * 45, 60, 575);
        e.baseY += (targetY - e.baseY) * dt * (e.type === 'racer' ? 2.8 : 1.55);
      } else if (e.behavior === 'stagger') {
        e.x += Math.sin(e.t * 5 + (e.formationSlot || 0)) * 70 * dt;
      }
      if (e.type === 'ember') {
        e.vy += 820 * dt; e.y += e.vy * dt;
        if (e.y >= e.baseY) { e.y = e.baseY; e.vy = -(330 + Math.random() * 200); burst(e.x + 20, e.y + 40, '#ff8a35', 5, 120); }
      } else if (e.type === 'glitch') {
        e.blink = Math.max(0, e.blink - dt);
        e.tp -= dt;
        if (e.tp <= 0) { e.tp = .8 + Math.random() * .7; e.y = clamp(e.y + (Math.random() - .5) * 260, 60, 580); e.blink = .22; burst(e.x + 29, e.y + 29, '#72ff68', 8, 170); }
      } else if (e.wave) {
        const amp = e.type === 'bat' ? 55 : e.type === 'spinner' ? 42 : e.type === 'jelly' ? 74 : e.type === 'cupid' ? 62 : e.type === 'manta' ? 46 : e.type === 'knight' ? 28 : 30;
        const freq = e.type === 'jelly' ? 1.5 : e.type === 'manta' ? 1.2 : e.type === 'cupid' ? 2.2 : e.type === 'knight' ? 1.7 : 3.2;
        e.y = e.baseY + Math.sin(e.t * freq) * amp;
      }
      e.fire -= dt;
      if (e.fire <= 0 && e.x < VW - 90) {
        enemyShoot(e);
        const cadence = e.type === 'tank' ? 1.1 : e.type === 'turret' ? 1.4 : e.type === 'spinner' ? 1.8 : e.type === 'glitch' ? 1.9 : e.type === 'cupid' ? 2 : e.type === 'racer' ? 1.5 : e.type === 'manta' ? 1.9 : e.type === 'walker' ? 1.25 : e.type === 'seeker' ? 1.45 : e.type === 'knight' ? 1.7 : 2.1 + Math.random();
        e.fire = cadence * (e.variant === 'elite' ? .76 : 1);
      }
    }
    for (const p of pickups) { p.x -= 130 * dt; p.t += dt; }
    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.gravity || 0) * dt; p.life -= dt; p.vx *= Math.pow(.08, dt); }
    for (const r of shockwaves) { r.r += r.speed * dt; r.life -= dt; }
    for (const d of delayedBursts) {
      d.t -= dt;
      if (d.t <= 0) { burst(d.x, d.y, d.color, 18, 300); shake = Math.max(shake, 8); if (d.boom) sfx('boom'); }
    }
    delayedBursts = delayedBursts.filter(d => d.t > 0);

    collisions();
    bullets = bullets.filter(b => b.life > 0 && b.x < VW + 80 && b.y > -30 && b.y < VH + 30);
    enemyBullets = enemyBullets.filter(b => b.life > 0 && b.x > -40 && b.x < VW + 240 && b.y > -80 && b.y < VH + 80);
    enemies = enemies.filter(e => e.hp > 0 && e.x > -130);
    particles = particles.filter(p => p.life > 0);
    shockwaves = shockwaves.filter(r => r.life > 0);
    pickups = pickups.filter(p => p.x > -50 && !p.taken);
    updateSpecialButton();
  }

  function collisions() {
    const hitX = player.x + 24;
    const hitY = player.grounded ? player.y - 4 : player.y + 20;
    const hitW = player.w - 43;
    const hitH = player.grounded ? 148 : player.h - 34;
    for (const b of bullets) {
      for (const e of enemies) {
        if (b.life > 0 && e.hp > 0 && circleRect(b.x, b.y, b.r, e.x, e.y, e.w, e.h)) {
          b.life = 0;
          let damage = b.damage || 1;
          if (e.shield > 0) {
            const absorbed = Math.min(e.shield, damage); e.shield -= absorbed; damage -= absorbed;
            shockwaves.push({ x: b.x, y: b.y, r: 3, speed: 130, life: .24, max: .24, color: '#a8b7d6' }); sfx('shield');
          }
          e.hp -= damage; e.hit = .11; special = Math.min(100, special + .35 + (b.missile ? .5 : 0)); shake = 3; burst(b.x, b.y, '#31e8ff', 5, 150); sfx('hit');
          if (e.hp <= 0) destroyEnemy(e);
          break;
        }
      }
    }
    if (player.inv <= 0) {
      for (const e of enemies) {
        if (e.hp > 0 && rects(hitX, hitY, hitW, hitH, e.x, e.y, e.w, e.h)) {
          if (e.type !== 'boss' && e.type !== 'midboss') { e.hp = 0; destroyEnemy(e); }
          hurt(e.type === 'boss' ? 38 : e.type === 'midboss' ? 32 : 28); break;
        }
      }
      for (const b of enemyBullets) {
        if (b.life > 0 && circleRect(b.x, b.y, b.r, hitX, hitY, hitW, hitH)) { b.life = 0; hurt(b.damage || 20); break; }
      }
    }
    for (const p of pickups) {
      if (!p.taken && circleRect(p.x, p.y, p.r, player.x, player.y, player.w, player.h)) {
        p.taken = true; score += 500; special = Math.min(100, special + 6);
        if (p.type === 'power') player.power = Math.min(3, player.power + 1);
        else if (p.type === 'spread') player.spread = Math.min(3, player.spread + 1);
        else if (p.type === 'speed') player.speed = Math.min(3, player.speed + 1);
        else health = Math.min(maxHealth, health + 32);
        burst(p.x, p.y, p.type === 'power' ? '#ff8a35' : p.type === 'spread' ? '#31e8ff' : p.type === 'speed' ? '#72ff68' : '#ffe15a', 22, 260); sfx('power');
      }
    }
  }

  function destroyEnemy(e, allowChain = true) {
    combo++; comboTimer = 2.2;
    totalKills++; stageKills++;
    special = Math.min(100, special + (e.type === 'boss' ? 30 : e.type === 'midboss' ? 20 : e.variant === 'elite' ? 8 : 4));
    const mult = Math.min(5, 1 + Math.floor(combo / 5));
    score += e.points * mult * difficulties[difficultyKey].score;
    if (e.type === 'jelly') {
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + i * Math.PI / 2;
        enemyBullets.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, vx: Math.cos(a) * 185, vy: Math.sin(a) * 185, r: 7, life: 3, damage: 12, drift: 140 });
      }
    }
    const isBoss = e.type === 'boss';
    const isMidBoss = e.type === 'midboss';
    const isMajor = isBoss || isMidBoss;
    if (!isMajor && combo >= 5 && allowChain) {
      const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
      const chainVictims = [];
      shockwaves.push({ x: cx, y: cy, r: 8, speed: 330, life: .42, max: .42, color: stages[stageIndex].accent2 });
      for (const other of enemies) {
        if (other === e || other.hp <= 0 || other.type === 'boss' || other.type === 'midboss') continue;
        const dx = other.x + other.w / 2 - cx, dy = other.y + other.h / 2 - cy;
        if (dx * dx + dy * dy < 145 * 145) { other.hp -= 1; other.hit = .14; if (other.hp <= 0) chainVictims.push(other); }
      }
      for (const victim of chainVictims) destroyEnemy(victim, false);
    }
    burst(e.x + e.w / 2, e.y + e.h / 2, e.type === 'bat' ? '#ff3e9d' : '#ffe15a', isMajor ? (isBoss ? 90 : 55) : e.type === 'tank' ? 28 : 15, isMajor ? (isBoss ? 520 : 420) : e.type === 'tank' ? 330 : 240);
    shake = isMajor ? (isBoss ? 28 : 20) : e.type === 'tank' ? 12 : 6; flash = isMajor ? (isBoss ? 1 : .6) : e.type === 'tank' ? .35 : .12; sfx(isMajor ? 'bigBoom' : 'boom');
    if (isMidBoss) {
      midBossDone = true; bossState = 'waiting'; enemyBullets = []; bullets = [];
      health = Math.min(maxHealth, health + 22); special = Math.min(100, special + 30);
      // Ensure the post-mid stretch has volume before the main boss.
      const bossAtNow = difficulties[difficultyKey].bossTime + stageIndex * 3;
      stageTime = Math.max(stageTime, bossAtNow * .38 + 1.2);
      pickups.push({ type: 'power', x: e.x + e.w / 2, y: e.y + e.h / 2, r: 19, t: 0 });
      const drop = Math.random() < .5 ? 'spread' : 'heal';
      pickups.push({ type: drop, kind: drop === 'heal' ? (Math.random() < .5 ? 'drink' : 'burger') : null, x: e.x + e.w / 2 + 40, y: e.y + e.h / 2 - 20, r: 19, t: 0 });
      playBgm(`stage${stageIndex}`, true);
      stageBanner = 2.2;
    }
    if (isBoss) {
      bossState = stageIndex === stages.length - 1 ? 'final' : 'transition'; stageTransition = 4.6;
      enemyBullets = []; bullets = []; health = Math.min(maxHealth, health + 40); musicStep = 0; musicClock = 0;
      const stage = stages[stageIndex];
      for (let i = 0; i < 14; i++) {
        delayedBursts.push({ x: e.x + Math.random() * e.w, y: e.y + Math.random() * e.h, t: .08 + i * .11, color: i % 3 ? '#ffe15a' : stage.accent2, boom: i % 2 === 0 });
      }
      const noDamageBonus = stageDamaged ? 0 : 5000;
      const timeBonus = Math.max(0, Math.round((60 - (elapsed - stageStart)) * 50));
      stageResult = { kills: stageKills, time: elapsed - stageStart, noDamageBonus, timeBonus };
      score += (noDamageBonus + timeBonus) * difficulties[difficultyKey].score;
    }
  }

  function hurt(damage) {
    health = Math.max(0, health - damage * difficulties[difficultyKey].damage); player.inv = 1.4; combo = 0; shake = 18; flash = .7;
    stageDamaged = true;
    burst(player.x + player.w / 2, player.y + player.h / 2, '#ff3e9d', 28, 330); sfx('hurt');
    if (health <= 0) finishGame(false);
  }

  function finishGame(cleared) {
    state = 'over';
    pauseButton.classList.remove('is-visible', 'is-paused');
    specialButton.classList.remove('is-visible', 'is-ready');
    pauseLabel.classList.remove('is-visible');
    if (cleared) score += 25000 * difficulties[difficultyKey].score;
    resultTitle.textContent = cleared ? 'ALL CLEAR!' : 'GAME OVER';
    statKills.textContent = String(totalKills);
    statStage.textContent = cleared ? 'ALL' : `${stageIndex + 1} / ${stages.length}`;
    statTime.textContent = `${elapsed.toFixed(1)}s`;
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
    if (fpsShow) drawFpsMeter();
  }

  function drawFpsMeter() {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.font = '14px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(6, 6, 104, 22);
    ctx.fillStyle = fpsAvg >= 58 ? '#72ff68' : fpsAvg >= 45 ? '#ffe15a' : '#ff5a36';
    ctx.fillText('FPS ' + fpsAvg.toFixed(1), 12, 10);
    ctx.restore();
  }

  function drawBackdrop() {
    const stage = stages[stageIndex];
    const g = cachedGrad('sky' + stageIndex, () => {
      const grad = ctx.createLinearGradient(0, 0, 0, VH);
      grad.addColorStop(0, stage.sky[0]); grad.addColorStop(.52, stage.sky[1]); grad.addColorStop(1, stage.sky[2]);
      return grad;
    });
    ctx.fillStyle = g; ctx.fillRect(-30, -30, VW + 60, VH + 60);
    const theme = stage.theme;
    if (theme === 'neon') drawNeonBackdrop(stage);
    else if (theme === 'aqua') drawAquaBackdrop(stage);
    else if (theme === 'factory') drawFactoryBackdrop(stage);
    else if (theme === 'storm') drawStormBackdrop(stage);
    else drawPalaceBackdrop(stage);
    drawAmbient();
    drawNearScenery(stage);
    drawAtmosphere(stage);
  }

  // Atmospheric perspective: distant layers fade into a haze the colour of the sky,
  // and a warm glow leaks up from the neon ground for depth.
  function drawAtmosphere(stage) {
    ctx.save();
    const haze = cachedGrad('haze' + stageIndex, () => {
      const grad = ctx.createLinearGradient(0, 300, 0, 660);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, hexA(stage.sky[1], .3));
      return grad;
    });
    ctx.fillStyle = haze; ctx.fillRect(0, 300, VW, 360);
    const glow = cachedGrad('atmoGlow' + stageIndex, () => {
      const grad = ctx.createLinearGradient(0, VH, 0, VH - 150);
      grad.addColorStop(0, hexA(stage.accent2, .16));
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      return grad;
    });
    ctx.fillStyle = glow; ctx.fillRect(0, VH - 150, VW, 150);
    ctx.restore();
  }

  // Cinematic vignette drawn over gameplay but under the HUD.
  function drawVignette() {
    const g = cachedGrad('vignette', () => {
      const grad = ctx.createRadialGradient(VW / 2, VH * .46, VH * .34, VW / 2, VH * .5, VH * .96);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(.7, 'rgba(4,2,12,.16)');
      grad.addColorStop(1, 'rgba(3,1,10,.62)');
      return grad;
    });
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  }

  function drawMoon(x, y, r, core, glow) {
    const m = ctx.createRadialGradient(x, y, r * .1, x, y, r * 2.4);
    m.addColorStop(0, glow.replace('A)', '.95)')); m.addColorStop(.25, glow.replace('A)', '.38)')); m.addColorStop(1, glow.replace('A)', '0)'));
    ctx.fillStyle = m; ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, Math.PI * 2); ctx.fill();
    // Spherical body: lit from upper-left, shading into a soft terminator.
    const body = ctx.createRadialGradient(x - r * .35, y - r * .35, r * .1, x, y, r);
    body.addColorStop(0, '#ffffff'); body.addColorStop(.5, core); body.addColorStop(1, hexA(core, .55));
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.clip();
    ctx.fillStyle = body; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = .18; ctx.fillStyle = '#8a7a52';
    for (const [cx, cy, cr] of [[.24, -.18, .16], [-.28, .1, .22], [.08, .34, .12], [.42, .28, .09]]) {
      ctx.beginPath(); ctx.arc(x + cx * r, y + cy * r, cr * r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawStars(limit, colorA, colorB) {
    for (let i = 0; i < limit; i++) { const s = stars[i]; ctx.globalAlpha = .45 + Math.sin(s.a) * .35; ctx.fillStyle = s.s > 2.4 ? colorA : colorB; ctx.fillRect(s.x, s.y, s.s, s.s); }
    ctx.globalAlpha = 1;
  }

  function drawNeonBackdrop(stage) {
    drawMoon(970, 145, 42, '#fff3aa', 'rgba(255,225,90,A)');
    drawSkyRibbons();
    drawStars(90, '#ffe15a', '#8defff');
    for (const c of clouds) drawCloud(c, '#d7ddff', .11);
    for (const p of bgProps) if (p.kind === 'searchlight') drawSearchlight(p, stage);
    drawCity((elapsed * -7) % 80, 505, stage.far, 40, .32, 8);
    draw109Tower(stage);
    for (const p of bgProps) if (p.kind === 'car') drawFlyingCar(p, stage);
    drawCity((elapsed * -20) % 120, 600, stage.city, 54, .78, 18);
    drawNeonSigns();
    drawShibuyaScreen(stage);
    drawScrambleCrossing(stage);
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

  // Shibuya-style neon: a jumble of Japanese vertical and horizontal signs on the storefronts.
  const SHIBUYA_SIGNS = [
    { x: 120, y: 468, w: 60, h: 128, text: 'カラオケ', c: '#ff3e9d', v: true },
    { x: 330, y: 506, w: 122, h: 40, text: 'ラーメン', c: '#ffe15a' },
    { x: 545, y: 460, w: 56, h: 130, text: '居酒屋', c: '#31e8ff', v: true },
    { x: 690, y: 512, w: 118, h: 38, text: '安い！', c: '#72ff68' },
    { x: 880, y: 470, w: 58, h: 120, text: '薬粧', c: '#ff8a35', v: true },
    { x: 1010, y: 505, w: 132, h: 42, text: 'SHIBUYA', c: '#ff3e9d' },
    { x: 1180, y: 520, w: 84, h: 36, text: '24H', c: '#ffe15a' }
  ];
  function drawNeonSigns() {
    const stage = stages[stageIndex];
    const scroll = (elapsed * 35) % 1600;
    for (let repeat = 0; repeat < 2; repeat++) for (const s of SHIBUYA_SIGNS) {
      const x = s.x - scroll + repeat * 1600;
      if (x < -170 || x > VW + 40) continue;
      const on = (Math.floor(elapsed * 2 + s.x * .1) % 11) !== 0;
      ctx.save();
      ctx.fillStyle = '#0b0929'; ctx.fillRect(x, s.y, s.w, s.h);
      ctx.shadowColor = s.c; ctx.shadowBlur = on ? 14 : 2;
      ctx.strokeStyle = on ? s.c : '#3a2a66'; ctx.lineWidth = 3; ctx.strokeRect(x + 1.5, s.y + 1.5, s.w - 3, s.h - 3);
      ctx.fillStyle = on ? s.c : '#4a3a76';
      ctx.textAlign = 'center';
      if (s.v) {
        ctx.font = '17px "DotGothic16", monospace';
        [...s.text].forEach((ch, i) => ctx.fillText(ch, x + s.w / 2, s.y + 25 + i * 25));
      } else {
        ctx.font = s.text === 'SHIBUYA' || s.text === '24H' ? '13px "Press Start 2P", monospace' : '18px "DotGothic16", monospace';
        ctx.fillText(s.text, x + s.w / 2, s.y + s.h / 2 + 7);
      }
      ctx.restore();
    }
  }

  // The 109-style cylindrical landmark tower with its vertical sign.
  function draw109Tower(stage) {
    const base = 940 - (elapsed * 10) % 1600;
    for (let r = 0; r < 2; r++) {
      const cx = base + r * 1600;
      if (cx < -140 || cx > VW + 140) continue;
      drawTower(cx, stage);
    }
  }
  function drawTower(cx, stage) {
    const baseY = 566, topY = 336, wb = 104, wt = 68;
    ctx.save(); ctx.globalAlpha = .92;
    const g = ctx.createLinearGradient(cx - wb / 2, 0, cx + wb / 2, 0);
    g.addColorStop(0, '#1a1230'); g.addColorStop(.45, '#3a2b63'); g.addColorStop(.55, '#42327a'); g.addColorStop(1, '#150f2a');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(cx - wt / 2, topY); ctx.lineTo(cx + wt / 2, topY); ctx.lineTo(cx + wb / 2, baseY); ctx.lineTo(cx - wb / 2, baseY); ctx.closePath(); ctx.fill();
    // curved window bands imply the cylinder
    ctx.strokeStyle = hexA(stage.accent, .5); ctx.lineWidth = 2;
    for (let i = 1; i < 12; i++) {
      const t = i / 12, y = topY + (baseY - topY) * t, w = wt + (wb - wt) * t;
      ctx.globalAlpha = .45; ctx.beginPath(); ctx.ellipse(cx, y, w / 2 - 4, 5, 0, .12, Math.PI - .12); ctx.stroke();
    }
    ctx.globalAlpha = .92;
    ctx.fillStyle = '#2a1f4d'; ctx.beginPath(); ctx.ellipse(cx, topY, wt / 2, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#15102b'; ctx.fillRect(cx - 2, topY - 44, 4, 44);
    ctx.fillStyle = '#ff3e9d'; ctx.fillRect(cx - 3, topY - 50, 6, 6);
    // vertical 109 sign
    ctx.fillStyle = '#0b0929'; ctx.fillRect(cx - 21, topY + 42, 42, 96);
    ctx.shadowColor = stage.accent2; ctx.shadowBlur = 16; ctx.strokeStyle = stage.accent2; ctx.lineWidth = 3; ctx.strokeRect(cx - 21, topY + 42, 42, 96);
    ctx.fillStyle = '#fff'; ctx.font = '24px "Press Start 2P", monospace'; ctx.textAlign = 'center';
    ctx.fillText('1', cx, topY + 72); ctx.fillText('0', cx, topY + 101); ctx.fillText('9', cx, topY + 130);
    ctx.restore();
  }

  // The giant Shibuya LED screen, cycling through content.
  function drawShibuyaScreen(stage) {
    const base = 700 - (elapsed * 20) % 1600;
    for (let r = 0; r < 2; r++) {
      const sx = base + r * 1600;
      if (sx < -270 || sx > VW + 40) continue;
      drawScreen(sx, stage);
    }
  }
  function drawScreen(sx, stage) {
    const w = 232, h = 130, y = 350;
    ctx.save();
    ctx.fillStyle = '#0a0820'; ctx.fillRect(sx - 6, y - 6, w + 12, h + 12);
    ctx.fillStyle = '#151033'; ctx.fillRect(sx + 24, y + h + 6, 10, 74); ctx.fillRect(sx + w - 34, y + h + 6, 10, 74);
    const frame = Math.floor(elapsed / 2.4) % 3;
    ctx.save(); ctx.beginPath(); ctx.rect(sx, y, w, h); ctx.clip();
    if (frame === 0) {
      const cols = ['#ff3e9d', '#ffe15a', '#31e8ff', '#72ff68', '#ff8a35', '#a56bff'];
      cols.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(sx + i * (w / cols.length), y, w / cols.length + 1, h); });
      ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(sx, y + (elapsed * 60) % h, w, 8);
    } else if (frame === 1) {
      ctx.fillStyle = '#120b2e'; ctx.fillRect(sx, y, w, h);
      ctx.fillStyle = stage.accent; ctx.font = '25px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillText('SHIBUYA', sx + w / 2, y + 56);
      ctx.fillStyle = '#fff'; ctx.font = '15px "DotGothic16", monospace'; ctx.fillText('スクランブル交差点', sx + w / 2, y + 92);
    } else {
      ctx.fillStyle = '#25051d'; ctx.fillRect(sx, y, w, h);
      ctx.fillStyle = '#ff3e9d'; heartPath(sx + w / 2, y + h / 2, 40); ctx.fill();
      ctx.fillStyle = '#ffd7ea'; heartPath(sx + w / 2 - 8, y + h / 2 - 8, 12); ctx.fill();
    }
    ctx.globalAlpha = .12; ctx.fillStyle = '#000';
    for (let yy = y; yy < y + h; yy += 4) ctx.fillRect(sx, yy, w, 2);
    ctx.restore();
    ctx.shadowColor = stage.accent2; ctx.shadowBlur = 18; ctx.strokeStyle = stage.accent2; ctx.lineWidth = 3; ctx.strokeRect(sx, y, w, h);
    ctx.restore();
  }

  // Perspective scramble crossing: zebra stripes receding to the vanishing point.
  function drawScrambleCrossing(stage) {
    const vpx = VW / 2, vpy = 590, groundY = 664;
    ctx.save();
    ctx.globalAlpha = .2; ctx.strokeStyle = stage.accent; ctx.lineWidth = 1;
    const drift = (elapsed * 60) % 96;
    for (let x = -260; x <= VW + 260; x += 96) { ctx.beginPath(); ctx.moveTo(vpx, vpy); ctx.lineTo(x - drift, groundY + 60); ctx.stroke(); }
    const scroll = (elapsed * .55) % 1;
    for (let i = 0; i < 15; i++) {
      const z = i + scroll;
      const near = 1 - 1 / (1 + z * .55), far = 1 - 1 / (1 + (z + .5) * .55);
      const y = vpy + (groundY - vpy) * near, yF = vpy + (groundY - vpy) * far;
      if (i % 2) continue;
      const hw = 250 * near, hwF = 250 * far;
      ctx.globalAlpha = Math.max(0, .55 - i * .03); ctx.fillStyle = '#eef4ff';
      ctx.beginPath(); ctx.moveTo(vpx - hw, y); ctx.lineTo(vpx + hw, y); ctx.lineTo(vpx + hwF, yF); ctx.lineTo(vpx - hwF, yF); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
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
    // Wet-asphalt reflections: streaks of neon smeared down the road surface.
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const postOffset = (elapsed * 210) % 430;
    for (let x = -postOffset; x < VW + 200; x += 430) {
      const refl = ctx.createLinearGradient(0, ground, 0, VH);
      refl.addColorStop(0, hexA(stage.accent, .5)); refl.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = refl; ctx.fillRect(x - 12, ground, 34, VH - ground);
    }
    const billboardRefl = ctx.createLinearGradient(0, ground, 0, VH);
    billboardRefl.addColorStop(0, hexA(stage.accent2, .32)); billboardRefl.addColorStop(1, 'rgba(0,0,0,0)');
    const bx = ((830 - (elapsed * 20) % 1500) % 1500 + 1500) % 1500;
    ctx.fillStyle = billboardRefl;
    ctx.fillRect(bx - 6 + Math.sin(elapsed * 8) * 3, ground, 70, VH - ground);
    ctx.restore();
    ctx.fillStyle = stage.accent; ctx.fillRect(0, ground, VW, 4);
    ctx.fillStyle = stage.accent2; ctx.fillRect(0, ground + 9, VW, 2);
    const tileOffset = (elapsed * 120) % 120;
    for (let x = -120 - tileOffset; x < VW + 120; x += 120) {
      ctx.globalAlpha = .3; ctx.strokeStyle = stage.accent; ctx.strokeRect(x, ground + 12, 90, 58);
      ctx.fillStyle = stage.accent2; ctx.fillRect(x + 15, ground + 43, 46, 3); ctx.globalAlpha = 1;
    }
    for (let x = -postOffset; x < VW + 200; x += 430) {
      ctx.fillStyle = '#100927'; ctx.fillRect(x, 548, 12, 102); ctx.fillRect(x - 22, 548, 56, 8);
      ctx.shadowColor = stage.accent; ctx.shadowBlur = 18; ctx.fillStyle = stage.accent; ctx.fillRect(x - 17, 552, 46, 7); ctx.shadowBlur = 0;
    }
  }

  function drawCloud(c, color = '#d7ddff', alpha = .11) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color;
    ctx.fillRect(c.x, c.y + 25 * c.s, 150 * c.s, 30 * c.s);
    ctx.beginPath(); ctx.arc(c.x + 35*c.s, c.y + 28*c.s, 30*c.s, Math.PI, 0); ctx.arc(c.x + 85*c.s, c.y + 24*c.s, 43*c.s, Math.PI, 0); ctx.arc(c.x + 128*c.s, c.y + 30*c.s, 27*c.s, Math.PI, 0); ctx.fill(); ctx.restore();
  }

  function drawSearchlight(p, stage) {
    ctx.save(); ctx.globalAlpha = .09; ctx.fillStyle = stage.accent;
    ctx.translate(p.x, 560); ctx.rotate(Math.sin(p.phase || 0) * .5);
    ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(-80, -640); ctx.lineTo(80, -640); ctx.lineTo(16, 0); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawFlyingCar(p, stage) {
    ctx.save(); ctx.globalAlpha = .85; ctx.translate(p.x, p.y + Math.sin(elapsed * 2 + p.y) * 5); ctx.scale(p.dir, 1);
    ctx.fillStyle = 'rgba(255,62,157,.55)'; ctx.fillRect(-40, -2, 14, 4);
    ctx.fillStyle = '#1b1140'; ctx.fillRect(-26, -7, 52, 14);
    ctx.fillStyle = stage.accent; ctx.fillRect(2, -12, 16, 7);
    ctx.fillStyle = '#ffe15a'; ctx.fillRect(21, -4, 6, 4);
    ctx.restore();
  }

  function drawBillboard(stage) {
    const x = 830 - (elapsed * 20) % 1500;
    for (let r = 0; r < 2; r++) {
      const bx = x + r * 1500;
      const on = Math.floor(elapsed * 1.6 + r) % 2 === 0;
      ctx.save();
      ctx.fillStyle = '#0b0929'; ctx.fillRect(bx + 20, 464, 6, 44); ctx.fillRect(bx + 124, 464, 6, 44);
      ctx.fillRect(bx, 380, 150, 84);
      ctx.strokeStyle = on ? stage.accent2 : '#3a2a66'; ctx.lineWidth = 4; ctx.strokeRect(bx, 380, 150, 84);
      if (on) { ctx.shadowColor = stage.accent2; ctx.shadowBlur = 16; }
      ctx.fillStyle = on ? stage.accent2 : '#4a3a76';
      ctx.font = '15px "Press Start 2P", monospace'; ctx.textAlign = 'center';
      ctx.fillText('GRO', bx + 75, 416); ctx.fillText('CHAN', bx + 75, 444);
      ctx.restore();
    }
  }

  function drawAquaBackdrop(stage) {
    drawMoon(210, 120, 36, '#eafcff', 'rgba(160,240,255,A)');
    drawStars(50, '#eafcff', '#8defff');
    for (const c of clouds) drawCloud(c, '#eaf6ff', .16);
    ctx.save(); ctx.globalAlpha = .5; ctx.fillStyle = stage.far;
    ctx.beginPath(); ctx.ellipse(430, 560, 150, 42, 0, Math.PI, 0); ctx.fill();
    ctx.beginPath(); ctx.ellipse(780, 566, 90, 26, 0, Math.PI, 0); ctx.fill();
    ctx.restore();
    for (const p of bgProps) if (p.kind === 'lighthouse') drawLighthouse(p);
    drawOcean(stage);
    for (const p of bgProps) if (p.kind === 'fish') drawFish(p, stage);
    drawHighway(stage);
  }

  function drawLighthouse(p) {
    ctx.save(); ctx.globalAlpha = .9;
    ctx.fillStyle = '#0d2c52'; ctx.fillRect(p.x - 14, 470, 28, 96);
    ctx.fillStyle = '#123c68'; ctx.fillRect(p.x - 19, 462, 38, 12);
    ctx.fillStyle = '#ffe15a'; ctx.fillRect(p.x - 8, 448, 16, 15);
    ctx.globalAlpha = .1; ctx.fillStyle = '#ffe15a';
    ctx.translate(p.x, 455); ctx.rotate(Math.sin((p.phase || 0) * .9) * 1.1);
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(-540, -60); ctx.lineTo(-540, 46); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawOcean(stage) {
    const top = 556;
    const g = ctx.createLinearGradient(0, top, 0, VH);
    g.addColorStop(0, '#0a3a66'); g.addColorStop(1, '#031228');
    ctx.fillStyle = g; ctx.fillRect(0, top, VW, VH - top);
    // Moon's rippling reflection: broken horizontal glints down the water column.
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 14; i++) {
      const y = top + 6 + i * 11;
      const w = (58 - i * 2.5) * (.7 + Math.abs(Math.sin(elapsed * 2.4 + i * .8)) * .5);
      ctx.globalAlpha = Math.max(0, .34 - i * .02);
      ctx.fillStyle = '#dff6ff';
      ctx.fillRect(210 - w / 2 + Math.sin(elapsed * 1.8 + i) * 10, y, w, 3);
    }
    ctx.restore();
    ctx.save(); ctx.globalAlpha = .18; ctx.fillStyle = '#bfefff';
    for (let i = 0; i < 6; i++) ctx.fillRect(180 + Math.sin(elapsed * 2 + i) * 14 - i * 4, top + 10 + i * 15, 70 - i * 8, 4);
    ctx.restore();
    ctx.save();
    for (let row = 0; row < 4; row++) {
      ctx.strokeStyle = row % 2 ? stage.accent : stage.accent2; ctx.lineWidth = 2; ctx.globalAlpha = .3 - row * .05;
      ctx.beginPath();
      const y0 = top + 8 + row * 24;
      for (let x = -40; x <= VW + 40; x += 26) {
        const y = y0 + Math.sin(x * .02 + elapsed * (1.4 + row * .3) + row * 2) * 5;
        x === -40 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawFish(p, stage) {
    if ((p.phase || 0) > 1.6) return;
    const t = (p.phase || 0) / 1.6;
    const x = p.x - t * 240;
    const y = 575 - Math.sin(t * Math.PI) * 95;
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.cos(t * Math.PI) * .9);
    ctx.fillStyle = stage.accent;
    ctx.beginPath(); ctx.ellipse(0, 0, 16, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(24, -7); ctx.lineTo(24, 7); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawHighway(stage) {
    const ground = 650;
    const poff = (elapsed * 160) % 260;
    for (let x = -poff; x < VW + 100; x += 260) {
      ctx.fillStyle = '#0c2547'; ctx.fillRect(x, ground, 26, VH - ground);
      ctx.fillStyle = 'rgba(101,255,242,.25)'; ctx.fillRect(x + 4, ground, 4, VH - ground);
    }
    const road = ctx.createLinearGradient(0, ground - 10, 0, ground + 36);
    road.addColorStop(0, '#123a6b'); road.addColorStop(1, '#0a1c3c');
    ctx.fillStyle = road; ctx.fillRect(0, ground - 8, VW, 46);
    ctx.fillStyle = stage.accent; ctx.fillRect(0, ground - 8, VW, 4);
    const dash = (elapsed * 240) % 90;
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    for (let x = -dash; x < VW; x += 90) ctx.fillRect(x, ground + 14, 44, 4);
    ctx.fillStyle = 'rgba(47,140,255,.55)'; ctx.fillRect(0, ground - 22, VW, 4);
    const rail = (elapsed * 160) % 130;
    for (let x = -rail; x < VW; x += 130) ctx.fillRect(x, ground - 20, 5, 14);
  }

  function drawFactoryBackdrop(stage) {
    drawMoon(640, 468, 88, '#ffb347', 'rgba(255,120,60,A)');
    ctx.save(); ctx.globalAlpha = .45; ctx.fillStyle = stage.sky[1];
    for (let i = 0; i < 4; i++) ctx.fillRect(530, 448 + i * 20, 220, 5 + i * 3);
    ctx.restore();
    for (const c of clouds) drawCloud(c, '#ffd9a0', .13);
    drawCranes(stage);
    drawChimneys();
    for (const p of bgProps) if (p.kind === 'gear') drawGear(p, stage);
    drawCity((elapsed * -20) % 120, 600, stage.city, 54, .8, 18);
    drawConveyor(stage);
  }

  function drawCranes(stage) {
    ctx.save(); ctx.globalAlpha = .45; ctx.fillStyle = stage.far;
    for (const [x, h] of [[300, 130], [700, 100], [1150, 150]]) {
      ctx.fillRect(x, 560 - h, 10, h);
      ctx.fillRect(x - 60, 560 - h, 150, 8);
      ctx.fillRect(x + 78, 560 - h + 8, 4, 36);
      ctx.fillRect(x + 68, 560 - h + 44, 24, 14);
    }
    ctx.restore();
  }

  function drawChimneys() {
    for (const [x, w, h] of CHIMNEYS) {
      ctx.fillStyle = '#2b1230'; ctx.fillRect(x, 560 - h, w, h);
      ctx.save(); ctx.globalAlpha = .5 + Math.sin(elapsed * 3 + x) * .3;
      ctx.fillStyle = '#ff5a36'; ctx.fillRect(x + 6, 560 - h + 6, w - 12, 5); ctx.restore();
      ctx.fillStyle = 'rgba(255,225,90,.22)'; ctx.fillRect(x, 560 - h + 20, w, 9);
    }
  }

  function drawGear(p, stage) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.phase || 0);
    ctx.fillStyle = 'rgba(43,18,40,.92)';
    for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); ctx.fillRect(-8, 0, 16, p.r + 12); }
    ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = .5; ctx.strokeStyle = stage.accent2; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, p.r * .55, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  function drawConveyor(stage) {
    const ground = 650;
    const g = ctx.createLinearGradient(0, ground, 0, VH);
    g.addColorStop(0, '#3a1626'); g.addColorStop(1, '#12060f');
    ctx.fillStyle = g; ctx.fillRect(0, ground, VW, VH - ground);
    ctx.fillStyle = stage.accent2; ctx.fillRect(0, ground, VW, 4);
    const off = (elapsed * 180) % 70;
    ctx.fillStyle = '#57202c';
    for (let x = -off; x < VW + 70; x += 70) { ctx.beginPath(); ctx.arc(x, ground + 38, 16, 0, Math.PI * 2); ctx.fill(); }
    ctx.save(); ctx.globalAlpha = .35; ctx.strokeStyle = stage.accent; ctx.lineWidth = 5;
    const coff = (elapsed * 180) % 60;
    for (let x = -coff; x < VW + 60; x += 60) { ctx.beginPath(); ctx.moveTo(x, ground + 8); ctx.lineTo(x + 20, ground + 15); ctx.lineTo(x, ground + 22); ctx.stroke(); }
    ctx.restore();
  }

  function drawStormBackdrop(stage) {
    drawStars(26, '#8fffb0', '#4de3a0');
    for (const c of clouds) drawCloud(c, '#04161a', .55);
    for (const p of bgProps) if (p.kind === 'code') drawCodeColumn(p, stage);
    drawCity((elapsed * -7) % 80, 505, stage.far, 40, .42, 8);
    for (const p of bgProps) if (p.kind === 'panel') drawPanel(p, stage);
    drawCity((elapsed * -20) % 120, 600, stage.city, 54, .82, 18);
    drawStormGround(stage);
    drawLightningBolt(stage);
  }

  function drawCodeColumn(p, stage) {
    ctx.save();
    for (let i = 0; i < p.len; i++) {
      ctx.fillStyle = i === 0 ? '#d6ffd0' : stage.accent;
      ctx.globalAlpha = Math.max(.05, (i === 0 ? .8 : .4) - i * .04);
      ctx.fillRect(p.x, p.y - i * 16, 6, 10);
    }
    ctx.restore();
  }

  function drawPanel(p, stage) {
    const flicker = Math.sin((p.phase || 0) * 7 + p.x) > .82 ? .3 : 1;
    const by = p.y + Math.sin((p.phase || 0) * .8 + p.x) * 8;
    ctx.save(); ctx.globalAlpha = .32 * flicker;
    ctx.fillStyle = '#02120e'; ctx.fillRect(p.x, by, p.w, p.h);
    ctx.strokeStyle = stage.accent; ctx.lineWidth = 2; ctx.strokeRect(p.x, by, p.w, p.h);
    ctx.fillStyle = stage.accent;
    for (let r = 0; r < 3; r++) ctx.fillRect(p.x + 8, by + 10 + r * 16, (p.w - 16) * (.35 + ((r * 37 + Math.floor((p.phase || 0) * 2)) % 5) / 8), 5);
    ctx.restore();
  }

  function drawStormGround(stage) {
    const ground = 650;
    const g = ctx.createLinearGradient(0, ground, 0, VH);
    g.addColorStop(0, '#0b2a26'); g.addColorStop(1, '#040d10');
    ctx.fillStyle = g; ctx.fillRect(0, ground, VW, VH - ground);
    ctx.fillStyle = stage.accent; ctx.fillRect(0, ground, VW, 3);
    ctx.save(); ctx.globalAlpha = .2; ctx.fillStyle = stage.accent;
    const off = (elapsed * 140) % 160;
    for (let x = -off; x < VW; x += 160) ctx.fillRect(x, ground + 16, 60, 3);
    ctx.globalAlpha = .12;
    for (let x = -off * .6; x < VW; x += 220) ctx.fillRect(x, ground + 38, 90, 4);
    ctx.restore();
  }

  function drawLightningBolt(stage) {
    if (lightning <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, lightning * 2.4) * .22;
    ctx.fillStyle = '#d8fff0'; ctx.fillRect(-30, -30, VW + 60, VH + 60);
    ctx.globalAlpha = Math.min(1, lightning * 2.4) * .9;
    ctx.strokeStyle = '#eaffff'; ctx.lineWidth = 4; ctx.shadowColor = stage.accent; ctx.shadowBlur = 22;
    ctx.beginPath();
    let x = lightningX, y = -20, seed = Math.floor(lightningX * 7);
    ctx.moveTo(x, y);
    while (y < 560) { seed = (seed * 9301 + 49297) % 233280; x += (seed / 233280 - .5) * 96; y += 42 + seed % 38; ctx.lineTo(x, y); }
    ctx.stroke();
    ctx.restore();
  }

  function drawPalaceBackdrop(stage) {
    ctx.save(); ctx.shadowColor = stage.accent2; ctx.shadowBlur = 42; ctx.fillStyle = '#ff6fb5';
    heartPath(980, 150, 56); ctx.fill(); ctx.restore();
    drawStars(70, '#ffe15a', '#ff9ccf');
    for (const c of clouds) drawCloud(c, '#f8c7e6', .08);
    ctx.save(); ctx.globalAlpha = .06; ctx.fillStyle = stage.accent;
    for (let i = 0; i < 4; i++) { const bx = 120 + i * 300 + Math.sin(elapsed * .4 + i) * 30; ctx.beginPath(); ctx.moveTo(bx, -30); ctx.lineTo(bx + 120, -30); ctx.lineTo(bx + 300, 660); ctx.lineTo(bx + 180, 660); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    drawPalaceTowers(stage);
    drawColonnade();
    drawPalaceFloor(stage);
  }

  function drawPalaceTowers(stage) {
    const off = (elapsed * -9) % 300;
    ctx.save(); ctx.globalAlpha = .6;
    for (let i = -1; i < 6; i++) {
      const x = i * 300 + off; const h = 180 + (i * 53 % 90 + 90) % 90;
      ctx.fillStyle = stage.far;
      ctx.fillRect(x + 20, 560 - h, 70, h);
      ctx.beginPath(); ctx.moveTo(x + 12, 560 - h); ctx.lineTo(x + 55, 560 - h - 66); ctx.lineTo(x + 98, 560 - h); ctx.closePath(); ctx.fill();
      ctx.fillStyle = stage.accent2;
      for (let wy = 560 - h + 26; wy < 536; wy += 36) ctx.fillRect(x + 47, wy, 15, 21);
    }
    ctx.restore();
  }

  function drawColonnade() {
    const off = (elapsed * -60) % 260;
    ctx.save(); ctx.globalAlpha = .85;
    for (let i = -1; i < 7; i++) {
      const x = i * 260 + off;
      ctx.fillStyle = '#2c0a24'; ctx.fillRect(x, 470, 40, 180);
      ctx.fillRect(x - 8, 462, 56, 14); ctx.fillRect(x - 8, 638, 56, 14);
      ctx.fillStyle = 'rgba(255,62,157,.3)'; ctx.fillRect(x + 6, 476, 6, 162);
    }
    ctx.restore();
  }

  function drawPalaceFloor(stage) {
    const ground = 650;
    const g = ctx.createLinearGradient(0, ground, 0, VH);
    g.addColorStop(0, '#3c0f2e'); g.addColorStop(1, '#140416');
    ctx.fillStyle = g; ctx.fillRect(0, ground, VW, VH - ground);
    ctx.fillStyle = stage.accent2; ctx.fillRect(0, ground, VW, 4);
    const off = (elapsed * 180) % 128;
    ctx.save(); ctx.globalAlpha = .28; ctx.fillStyle = '#ff9ccf';
    for (let row = 0; row < 2; row++) for (let x = -128 + (row ? 64 : 0) - off; x < VW + 128; x += 128) ctx.fillRect(x, ground + 10 + row * 26, 64, 22);
    ctx.restore();
    ctx.fillStyle = 'rgba(255,225,90,.18)'; ctx.fillRect(0, ground + 62, VW, 8);
  }

  function drawAmbient() {
    for (const a of ambient) {
      ctx.save();
      if (a.kind === 'bubble') { ctx.globalAlpha = .3 + Math.sin(a.a) * .15; ctx.strokeStyle = '#bfefff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.stroke(); }
      else if (a.kind === 'smoke') { ctx.globalAlpha = Math.max(0, Math.min(.2, a.life * .09)); ctx.fillStyle = '#c9b8c9'; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.fill(); }
      else if (a.kind === 'spark') { ctx.globalAlpha = Math.max(0, Math.min(1, a.life * 1.6)); ctx.fillStyle = '#ffe15a'; ctx.fillRect(a.x, a.y, 4, 4); ctx.fillStyle = 'rgba(255,138,53,.6)'; ctx.fillRect(a.x - a.vx * .02, a.y - a.vy * .02, 3, 3); }
      else if (a.kind === 'rain') { ctx.globalAlpha = .32; ctx.strokeStyle = '#9fe8d8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x + a.vx * .022, a.y + a.vy * .022); ctx.stroke(); }
      else { ctx.globalAlpha = .28 + Math.sin(a.a) * .16; ctx.fillStyle = '#ff9ccf'; heartPath(a.x, a.y, a.s); ctx.fill(); }
      ctx.restore();
    }
  }

  // Fast near-field silhouettes sell parallax and make each location feel lived-in.
  // They stay translucent and below the main flight lane so enemies remain readable.
  function drawNearScenery(stage) {
    const details = nearProps;
    const speed = stage.theme === 'aqua' ? 92 : stage.theme === 'palace' ? 72 : 118;
    ctx.save();
    for (const p of details) {
      const x = ((p.lane * 205 + p.seed * 1.7 - elapsed * speed) % 1680 + 1680) % 1680 - 180;
      const wobble = Math.sin(elapsed * 1.4 + p.seed) * 3;
      if (stage.theme === 'neon') {
        // Commuters and umbrellas behind the crossing barrier.
        ctx.globalAlpha = .3; ctx.fillStyle = '#08051b';
        const head = 598 + (p.lane % 3) * 6 + wobble;
        ctx.beginPath(); ctx.arc(x, head, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(x - 8, head + 8, 16, 35);
        if (p.lane % 2 === 0) {
          ctx.fillStyle = hexA(stage.accent2, .32); ctx.beginPath(); ctx.arc(x + 12, head - 4, 27, Math.PI, 0); ctx.fill();
          ctx.strokeStyle = hexA(stage.accent, .4); ctx.beginPath(); ctx.moveTo(x + 12, head - 4); ctx.lineTo(x + 12, head + 42); ctx.stroke();
        }
      } else if (stage.theme === 'aqua') {
        // Distant sailboats, buoys and turbine silhouettes along the coast.
        ctx.globalAlpha = .25; ctx.fillStyle = '#03172b';
        if (p.lane % 2) {
          ctx.fillRect(x, 522, 4, 82); ctx.beginPath(); ctx.arc(x + 2, 522, 24, 0, Math.PI * 2); ctx.strokeStyle = hexA(stage.accent, .45); ctx.stroke();
          ctx.save(); ctx.translate(x + 2, 522); ctx.rotate(elapsed * .45 + p.seed); for (let i = 0; i < 3; i++) { ctx.rotate(Math.PI * 2 / 3); ctx.fillRect(0, -2, 42, 4); } ctx.restore();
        } else {
          ctx.beginPath(); ctx.moveTo(x - 38, 580); ctx.lineTo(x + 42, 580); ctx.lineTo(x + 25, 596); ctx.lineTo(x - 27, 596); ctx.closePath(); ctx.fill();
          ctx.fillStyle = hexA(stage.accent, .38); ctx.beginPath(); ctx.moveTo(x, 526); ctx.lineTo(x, 578); ctx.lineTo(x + 35, 572); ctx.closePath(); ctx.fill();
        }
      } else if (stage.theme === 'factory') {
        // Heavy pipes, valves and warning lamps close to the camera.
        ctx.globalAlpha = .36; ctx.fillStyle = '#140b18'; ctx.fillRect(x, 566, 24, 95); ctx.fillRect(x - 34, 570, 92, 18);
        ctx.strokeStyle = '#3f2636'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(x + 12, 588, 23, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = p.lane % 2 ? '#ff5a36' : '#ffe15a'; ctx.globalAlpha = .35 + Math.sin(elapsed * 5 + p.seed) * .2; ctx.fillRect(x + 5, 552, 14, 10);
      } else if (stage.theme === 'storm') {
        // Wind-bent aerials and live power arcs.
        ctx.globalAlpha = .32; ctx.fillStyle = '#03100f'; ctx.fillRect(x, 552, 10, 108);
        ctx.strokeStyle = hexA(stage.accent, .42); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 5, 552); ctx.lineTo(x - 22, 516); ctx.moveTo(x + 5, 552); ctx.lineTo(x + 34, 520); ctx.stroke();
        if (p.lane % 3 === 0) { ctx.globalAlpha = .55; ctx.fillStyle = '#d6ffd0'; ctx.fillRect(x - 25, 513, 5, 5); ctx.fillRect(x + 32, 517, 5, 5); }
      } else {
        // Rose hedges and gold candelabra in the palace foreground.
        ctx.globalAlpha = .28; ctx.fillStyle = '#170316';
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x + i * 18, 625 + Math.sin(i + p.seed) * 5, 20, 0, Math.PI * 2); ctx.fill(); }
        if (p.lane % 2 === 0) {
          ctx.fillStyle = '#5b163e'; ctx.fillRect(x + 24, 560, 7, 82); ctx.fillStyle = '#ffe15a';
          for (const ox of [5, 27, 49]) { ctx.fillRect(x + ox, 568, 5, 28); ctx.beginPath(); ctx.arc(x + ox + 2, 563, 5, 0, Math.PI * 2); ctx.fill(); }
        }
      }
    }
    // Low moving mist ties sprites into the scene instead of leaving them floating.
    const fog = ctx.createLinearGradient(0, 565, 0, 690);
    fog.addColorStop(0, 'rgba(255,255,255,0)'); fog.addColorStop(.55, hexA(stage.sky[1], .09)); fog.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = .55 + Math.sin(elapsed * .4) * .12; ctx.fillStyle = fog; ctx.fillRect(0, 555, VW, 140);
    ctx.restore();
  }

  // Pseudo-3D skyline: every building is an extruded box with a shaded side face,
  // its depth converging toward a vanishing point so the row reads as real volume.
  function drawCity(offset, ground, color, unit, alpha, depth = 16) {
    const stage = stages[stageIndex];
    const vpx = VW / 2, vpy = 552;
    const front = color, sideCol = shade(color, .58), edge = stage.accent;
    ctx.save(); ctx.globalAlpha = alpha;
    for (let i = -2; i < 28; i++) {
      const x = i * unit + offset;
      const w = unit - 5;
      const h = 45 + ((i * 47 + 130) % 150);
      const topY = ground - h;
      const cx = x + w / 2;
      const dir = cx < vpx ? 1 : -1;
      const fx = dir > 0 ? x + w : x;
      const bx = fx + dir * depth;
      const btY = topY + Math.sign(vpy - topY) * depth * .45;
      const bbY = ground + Math.sign(vpy - ground) * depth * .45;
      // extruded side face
      ctx.fillStyle = sideCol;
      ctx.beginPath(); ctx.moveTo(fx, topY); ctx.lineTo(bx, btY); ctx.lineTo(bx, bbY); ctx.lineTo(fx, ground); ctx.closePath(); ctx.fill();
      // front face
      ctx.fillStyle = front; ctx.fillRect(x, topY, w, h);
      // neon vertical edge where the two faces meet
      ctx.globalAlpha = alpha * .5; ctx.fillStyle = edge; ctx.fillRect(fx - (dir > 0 ? 2 : 0), topY, 2, h); ctx.globalAlpha = alpha;
      // lit windows on the front face
      ctx.fillStyle = i % 3 ? stage.accent : stage.accent2;
      for (let yy = topY + 14; yy < ground - 10; yy += 18) for (let xx = x + 8; xx < x + w - 6; xx += 14) if ((xx + yy + i) % 3 > 1) ctx.fillRect(xx, yy, 4, 6);
    }
    ctx.restore();
  }

  function drawBossTelegraph() {
    const boss = enemies.find(e => e.type === 'boss');
    if (!boss || !(boss.tel > 0) || !boss.telType) return;
    const p = .18 + Math.abs(Math.sin(elapsed * 16)) * .16;
    ctx.save(); ctx.globalAlpha = p;
    if (boss.telType === 'pillar') {
      ctx.fillStyle = '#ff8a35'; ctx.fillRect(boss.telX - 26, 350, 52, 310);
      ctx.globalAlpha = p * 2; ctx.fillStyle = '#ffe15a'; ctx.fillRect(boss.telX - 4, 350, 8, 310);
    } else if (boss.telType === 'strike') {
      ctx.fillStyle = '#72ff68'; ctx.fillRect(boss.telX - 16, 0, 32, 620);
      ctx.globalAlpha = p * 2; ctx.fillStyle = '#d6ffd0'; ctx.fillRect(boss.telX - 3, 0, 6, 620);
    } else if (boss.telType === 'dash') {
      ctx.fillStyle = '#ff3e9d'; ctx.fillRect(0, boss.telY, VW, boss.h);
    } else {
      ctx.fillStyle = stages[stageIndex].accent2;
      ctx.beginPath(); ctx.arc(boss.x + boss.w / 2, boss.y + boss.h / 2, 130 + Math.sin(elapsed * 16) * 14, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawGame() {
    drawBossTelegraph();
    for (const p of pickups) drawPickup(p);
    ctx.globalCompositeOperation = 'lighter';
    for (const b of bullets) drawPlayerBullet(b);
    ctx.globalCompositeOperation = 'source-over';
    for (const b of enemyBullets) drawEnemyBullet(b);
    for (const r of shockwaves) {
      ctx.save(); ctx.globalAlpha = Math.max(0, r.life / r.max); ctx.strokeStyle = r.color; ctx.lineWidth = 5 + r.life * 8; ctx.shadowColor = r.color; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    for (const e of enemies) drawEnemy(e);
    if (state === 'playing' || state === 'over') drawPlayer();
    // Additive blending makes overlapping sparks glow white-hot like real light.
    ctx.globalCompositeOperation = 'lighter';
    for (const p of particles) {
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a; ctx.fillStyle = p.color;
      const s = Math.ceil(p.size); ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s);
      if (p.size > 4) { ctx.globalAlpha = a * .4; ctx.fillRect(Math.round(p.x) - 2, Math.round(p.y) - 2, s + 4, s + 4); }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    drawVignette();
    if (specialFlash > 0) {
      const sg = ctx.createRadialGradient(player.x + 55, player.y + 52, 20, player.x + 55, player.y + 52, 760);
      sg.addColorStop(0, `rgba(255,255,255,${specialFlash * .52})`); sg.addColorStop(.35, `rgba(255,225,90,${specialFlash * .25})`); sg.addColorStop(1, 'rgba(255,62,157,0)');
      ctx.fillStyle = sg; ctx.fillRect(0, 0, VW, VH);
    }
    if (state === 'playing' || state === 'over') drawHUD();
    if (flash > 0) { ctx.globalAlpha = flash * .45; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1; }
  }

  function drawPlayer() {
    ctx.save();
    if (player.inv > 0 && Math.floor(player.inv * 12) % 2 === 0) ctx.globalAlpha = .25;
    const bob = player.grounded ? 0 : Math.sin(player.frame * .65) * 3;
    // Ground shadow shrinks and fades as Gro-chan climbs — a real sense of altitude.
    const alt = player.grounded ? 1 : clamp(1 - (GROUND_Y - player.y) / GROUND_Y, .3, 1);
    ctx.save(); ctx.globalAlpha *= .16 + alt * .18; ctx.fillStyle = '#04030f';
    ctx.beginPath(); ctx.ellipse(player.x + 56, GROUND_Y + 150, 56 * alt, 12 * alt, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // Thruster exhaust: additive glow flickering behind the sprite while airborne.
    if (!player.grounded) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const flick = .55 + Math.abs(Math.sin(player.frame * 1.3)) * .45;
      const tx = player.x + 20, ty = player.y + 78 + bob;
      const th = ctx.createRadialGradient(tx, ty, 2, tx, ty, 42);
      th.addColorStop(0, hexA('#8ffcff', .8 * flick)); th.addColorStop(.5, hexA('#31e8ff', .32 * flick)); th.addColorStop(1, 'rgba(49,232,255,0)');
      ctx.fillStyle = th; ctx.beginPath(); ctx.ellipse(tx - 10, ty, 40 * flick, 15, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(49,232,255,.18)'; ctx.beginPath(); ctx.ellipse(player.x + 56, player.y + (player.grounded ? 155 : 96), 54, 11, 0, 0, Math.PI * 2); ctx.fill();
    if (player.takeoff > 0 && jumpFrame) {
      // Jump / takeoff cell from the sheet.
      ctx.drawImage(jumpFrame, player.x - 10, player.y - 26 + bob, 128, 175);
    } else if (player.grounded && (idleFrame || walkFrames.length)) {
      // Idle has no gun; walk frames hold the gun — use walk while moving or firing.
      const firingNow = keys.has('Space') || keys.has('KeyZ') || pointer.active || padInput.fire;
      const useWalk = walkFrames.length && (Math.abs(player.vx) > 18 || firingNow);
      const frame = useWalk
        ? walkFrames[Math.floor(Math.abs(player.frame)) % walkFrames.length]
        : (idleFrame || walkFrames[0]);
      if (frame) ctx.drawImage(frame, player.x - 8, player.y - 28, 130, 190);
      if (firingNow && Math.floor(elapsed * 18) % 2 === 0) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255,225,90,.85)';
        ctx.beginPath(); ctx.arc(player.x + 114, player.y + 80, 5 + Math.random() * 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
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
    if (b.missile) {
      const a = Math.atan2(b.vy, b.vx);
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(a);
      ctx.fillStyle = 'rgba(255,138,53,.35)'; ctx.beginPath(); ctx.moveTo(-25, 0); ctx.lineTo(-7, -8); ctx.lineTo(-7, 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f4f0ff'; ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(-8, -7); ctx.lineTo(-8, 7); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff3e9d'; ctx.fillRect(-7, -8, 6, 16); ctx.fillStyle = '#ffe15a'; ctx.fillRect(-12, -3, 7, 6); ctx.restore(); return;
    }
    ctx.fillStyle = 'rgba(255,62,157,.25)'; ctx.fillRect(b.x - 30, b.y - size, 42, size * 2);
    ctx.fillStyle = b.damage >= 3 ? '#ff8a35' : '#ffe15a'; ctx.fillRect(b.x - 13, b.y - size / 2, 24 + b.damage * 3, size);
    ctx.fillStyle = '#fff'; ctx.fillRect(b.x, b.y - 2, 13, 4);
  }

  function drawEnemyBullet(b) {
    if (b.heart) {
      ctx.save(); ctx.globalAlpha = .3; ctx.fillStyle = '#ff9ccf'; heartPath(b.x, b.y, b.r + 7); ctx.fill();
      ctx.globalAlpha = 1; ctx.fillStyle = '#ff3e9d'; heartPath(b.x, b.y, b.r); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(b.x - 3, b.y - 4, 4, 4); ctx.restore(); return;
    }
    if (b.bubble) {
      ctx.save(); ctx.globalAlpha = .25; ctx.fillStyle = '#65fff2'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 6, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = .9; ctx.strokeStyle = '#65fff2'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(47,140,255,.5)'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r - 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(b.x - b.r * .4, b.y - b.r * .5, 4, 4); ctx.restore(); return;
    }
    if (b.fire) {
      ctx.save(); ctx.globalAlpha = .3; ctx.fillStyle = '#ff8a35'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 8, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1; ctx.fillStyle = '#ff5a36'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe15a'; ctx.beginPath(); ctx.arc(b.x - b.vx * .008, b.y - b.vy * .008, b.r * .5, 0, Math.PI * 2); ctx.fill(); ctx.restore(); return;
    }
    if (b.volt) {
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(elapsed * 9);
      ctx.fillStyle = 'rgba(114,255,104,.3)'; ctx.fillRect(-b.r - 5, -b.r - 5, (b.r + 5) * 2, (b.r + 5) * 2);
      ctx.fillStyle = '#d6ffd0'; ctx.fillRect(-b.r, -b.r, b.r * 2, b.r * 2);
      ctx.fillStyle = '#72ff68'; ctx.fillRect(-b.r + 3, -b.r + 3, b.r * 2 - 6, b.r * 2 - 6); ctx.restore(); return;
    }
    ctx.fillStyle = 'rgba(255,62,157,.25)'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 8, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ff3e9d'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(b.x - 3, b.y - 3, 5, 5);
  }


  // --- Pseudo-3D enemy kit (extrusion / bevel / underglow, no per-fodder shadowBlur) ---
  function enemySideColor(hex) { return shade(hex, .52); }
  function enemyTopColor(hex) { return shade(hex, 1.28); }
  function enemyDepthDir(worldX, w) {
    const cx = worldX + w * .5;
    return cx < VW * .52 ? 1 : -1;
  }
  function drawBox3D(x, y, w, h, front, depth = 7) {
    const side = enemySideColor(front), top = enemyTopColor(front);
    const d = depth, dy = depth * .55;
    rctx.fillStyle = top;
    rctx.beginPath();
    rctx.moveTo(x, y); rctx.lineTo(x + d, y - dy); rctx.lineTo(x + w + d, y - dy); rctx.lineTo(x + w, y);
    rctx.closePath(); rctx.fill();
    rctx.fillStyle = side;
    rctx.beginPath();
    rctx.moveTo(x + w, y); rctx.lineTo(x + w + d, y - dy); rctx.lineTo(x + w + d, y + h - dy); rctx.lineTo(x + w, y + h);
    rctx.closePath(); rctx.fill();
    const g = rctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, enemyTopColor(front)); g.addColorStop(.45, front); g.addColorStop(1, enemySideColor(front));
    rctx.fillStyle = g; rctx.fillRect(x, y, w, h);
    rctx.fillStyle = 'rgba(255,255,255,.1)'; rctx.fillRect(x + 3, y + 3, Math.max(3, w * .35), 2);
  }
  function drawCylinder3D(x, y, w, h, front) {
    const g = rctx.createLinearGradient(x, y, x + w, y);
    g.addColorStop(0, enemySideColor(front)); g.addColorStop(.22, enemyTopColor(front)); g.addColorStop(.55, front); g.addColorStop(1, enemySideColor(front));
    rctx.fillStyle = g; rctx.fillRect(x, y, w, h);
    rctx.fillStyle = hexA('#ffffff', .2); rctx.fillRect(x + w * .18, y + 2, w * .14, h - 4);
  }
  function drawEnemyUnderglow(e, color) {
    // Intentionally empty — under-rings read as unnatural frames around sprites.
  }
  function drawEnemyShadow(e) {
    rctx.save(); rctx.globalAlpha = .18; rctx.fillStyle = '#020108';
    rctx.beginPath(); rctx.ellipse(e.w * .5 + 6, e.h + 10, e.w * .48, Math.max(5, e.h * .11), 0, 0, Math.PI * 2); rctx.fill();
    rctx.restore();
  }
  function drawKawaiiEyes(x1, x2, y, s = 9, pupil = 3) {
    rctx.fillStyle = '#120b2e'; rctx.fillRect(x1, y, s, s); rctx.fillRect(x2, y, s, s);
    rctx.fillStyle = '#fff'; rctx.fillRect(x1 + 2, y + 1, pupil, pupil); rctx.fillRect(x2 + 2, y + 1, pupil, pupil);
  }
  function drawExtrudeSilhouette(drawFn, color, depth = 6) {
    ctx.save(); ctx.translate(depth, depth * .55); ctx.fillStyle = color; ctx.strokeStyle = color;
    drawFn(true); ctx.restore();
  }
  function drawShieldBubble(e) {
    if (!(e.shield > 0)) return;
    // Tiny sparkles only — no outer ring/frame.
    const a = .35 + Math.sin((e.t || 0) * 9) * .15;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
    ctx.fillStyle = '#d0e4ff';
    for (let i = 0; i < 4; i++) {
      const ang = (e.t || 0) * 2 + i * 1.6;
      ctx.beginPath();
      ctx.arc(e.w * .5 + Math.cos(ang) * e.w * .28, e.h * .45 + Math.sin(ang) * e.h * .22, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawEnemy(e) {
    const stage = stages[stageIndex];
    ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y));
    if (e.type !== 'boss' && e.type !== 'midboss') {
      drawEnemyShadow(e);
      drawEnemyUnderglow(e, stage.accent2);
    }
    if (e.type === 'drone') {
      // Floating purple surveillance cube with extruded volume + thrusters
      drawBox3D(6, 10, 50, 30, '#8b3fff', 8);
      drawBox3D(0, 18, 64, 14, '#5a28b8', 5);
      ctx.fillStyle = '#dba6ff'; ctx.fillRect(12, 14, 38, 5);
      drawKawaiiEyes(18, 38, 24, 10, 3);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const thr = .55 + Math.abs(Math.sin(e.t * 14)) * .45;
      ctx.fillStyle = hexA('#31e8ff', .75 * thr);
      ctx.beginPath(); ctx.ellipse(12, 50, 9 * thr, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(52, 50, 9 * thr, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#31e8ff'; ctx.fillRect(4, 46, 16, 4); ctx.fillRect(44, 46, 16, 4);
    } else if (e.type === 'bat') {
      const flap = Math.sin(e.t * 12) * 10;
      // Darker wing undersides (depth), body gradient
      ctx.fillStyle = '#6b1548';
      ctx.beginPath(); ctx.moveTo(22, 20); ctx.lineTo(2, 8 + flap); ctx.lineTo(0, 30 + flap * .3); ctx.lineTo(20, 34); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(48, 20); ctx.lineTo(68, 8 - flap); ctx.lineTo(70, 30 - flap * .3); ctx.lineTo(50, 34); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff3e9d';
      ctx.beginPath(); ctx.moveTo(24, 18); ctx.lineTo(6, 4 + flap); ctx.lineTo(8, 22 + flap * .2); ctx.lineTo(24, 28); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(46, 18); ctx.lineTo(64, 4 - flap); ctx.lineTo(62, 22 - flap * .2); ctx.lineTo(46, 28); ctx.closePath(); ctx.fill();
      const body = ctx.createLinearGradient(22, 10, 50, 48);
      body.addColorStop(0, '#ff8ac2'); body.addColorStop(.5, '#ff3e9d'); body.addColorStop(1, '#7a1848');
      ctx.fillStyle = body; ctx.fillRect(22, 12, 28, 34);
      ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(24, 14, 10, 4);
      ctx.fillStyle = '#210c3f'; ctx.fillRect(27, 20, 18, 16);
      drawKawaiiEyes(29, 39, 23, 6, 2);
      ctx.fillStyle = '#fff'; ctx.fillRect(32, 38, 3, 4); ctx.fillRect(38, 38, 3, 4);
    } else if (e.type === 'spinner') {
      ctx.save(); ctx.translate(38, 38); ctx.rotate(e.t * 2.5);
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        const arm = ctx.createLinearGradient(12, -8, 42, 8);
        arm.addColorStop(0, '#8ffcff'); arm.addColorStop(1, '#0a6f8a');
        ctx.fillStyle = arm; ctx.fillRect(12, -8, 30, 16);
        ctx.fillStyle = '#08384a'; ctx.fillRect(14, -5, 26, 4);
      }
      ctx.restore();
      ctx.save(); ctx.translate(38, 38);
      const core = ctx.createRadialGradient(-6, -8, 2, 0, 0, 30);
      core.addColorStop(0, '#ffe15a'); core.addColorStop(.35, '#ff3e9d'); core.addColorStop(1, '#2a0a48');
      ctx.fillStyle = '#2a1048'; ctx.beginPath(); ctx.arc(3, 3, 30, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = core; ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(-6, -6, 12, 12);
      ctx.restore();
    } else if (e.type === 'tank') {
      drawBox3D(8, 22, 82, 48, '#6943c8', 9);
      drawBox3D(18, 2, 56, 24, '#31e8ff', 6);
      ctx.fillStyle = '#120b2e'; ctx.fillRect(24, 28, 48, 26);
      drawKawaiiEyes(30, 54, 34, 11, 4);
      drawCylinder3D(4, 68, 24, 8, '#ffe15a');
      drawCylinder3D(68, 68, 24, 8, '#ffe15a');
      ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(22, 6, 20, 3);
    } else if (e.type === 'turret') {
      drawBox3D(6, 44, 62, 24, '#3a2068', 7);
      drawBox3D(14, 26, 46, 30, '#6943c8', 6);
      const barrel = ctx.createLinearGradient(-10, 36, 30, 48);
      barrel.addColorStop(0, '#ffe15a'); barrel.addColorStop(1, '#9a6a10');
      ctx.fillStyle = barrel; ctx.fillRect(-10, 36, 32, 10);
      ctx.fillStyle = '#120b2e'; ctx.fillRect(-12, 38, 8, 6);
      ctx.fillStyle = '#ff3e9d'; ctx.fillRect(20, 32, 30, 14);
      drawKawaiiEyes(24, 38, 35, 7, 2);
      drawCylinder3D(8, 66, 18, 5, '#31e8ff');
      drawCylinder3D(46, 66, 18, 5, '#31e8ff');
    } else if (e.type === 'jelly') {
      const squish = 1 + Math.sin(e.t * 4) * .1;
      ctx.save(); ctx.translate(31, 30); ctx.scale(squish, 2 - squish);
      // extruded dome
      ctx.fillStyle = '#0a3a6e'; ctx.beginPath(); ctx.ellipse(4, 4, 28, 28, 0, Math.PI, 0); ctx.fill();
      const dome = ctx.createRadialGradient(-8, -10, 2, 0, 4, 30);
      dome.addColorStop(0, '#9cfff5'); dome.addColorStop(.4, '#2f8cff'); dome.addColorStop(1, '#082a55');
      ctx.globalAlpha = .92; ctx.fillStyle = dome; ctx.beginPath(); ctx.ellipse(0, 0, 27, 27, 0, Math.PI, 0); ctx.fill();
      ctx.fillRect(-27, 0, 54, 8);
      ctx.restore();
      ctx.strokeStyle = '#65fff2'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        ctx.beginPath(); ctx.moveTo(12 + i * 13, 38);
        ctx.quadraticCurveTo(12 + i * 13 + Math.sin(e.t * 5 + i) * 7, 50, 12 + i * 13 + Math.sin(e.t * 5 + i + 1) * 9, 64);
        ctx.stroke();
      }
      drawKawaiiEyes(20, 36, 12, 7, 2);
    } else if (e.type === 'ember') {
      const flick = Math.sin(e.t * 18) * 4;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const glow = ctx.createRadialGradient(22, 26, 2, 22, 26, 28);
      glow.addColorStop(0, 'rgba(255,225,90,.9)'); glow.addColorStop(.4, 'rgba(255,90,54,.55)'); glow.addColorStop(1, 'rgba(255,90,54,0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(22, 26, 28, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#8a2010';
      ctx.beginPath(); ctx.moveTo(8, 18); ctx.lineTo(24, -6 - flick); ctx.lineTo(40, 18); ctx.closePath(); ctx.fill();
      const flame = ctx.createLinearGradient(22, -8, 22, 40);
      flame.addColorStop(0, '#ffe15a'); flame.addColorStop(.45, '#ff5a36'); flame.addColorStop(1, '#7a1808');
      ctx.fillStyle = flame;
      ctx.beginPath(); ctx.moveTo(6, 18); ctx.lineTo(22, -8 - flick); ctx.lineTo(38, 18); ctx.lineTo(22, 42); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff3a0'; ctx.beginPath(); ctx.arc(22, 26, 9, 0, Math.PI * 2); ctx.fill();
      drawKawaiiEyes(15, 26, 22, 5, 2);
    } else if (e.type === 'glitch') {
      if (e.blink > 0 && Math.floor(e.blink * 30) % 2 === 0) { ctx.restore(); return; }
      const slice = Math.floor(e.t * 9) % 3;
      // chromatic extrusion
      ctx.save(); ctx.globalAlpha = .35; ctx.fillStyle = '#31e8ff';
      for (let i = 0; i < 3; i++) ctx.fillRect(2 + (slice === i ? 8 : 0) + 2, 6 + i * 16, 50, 14);
      ctx.fillStyle = '#ff3e9d';
      for (let i = 0; i < 3; i++) ctx.fillRect(2 + (slice === i ? -4 : 0) - 2, 6 + i * 16, 50, 14);
      ctx.restore();
      const blocks = ['#0b2e18', '#0b2e18', '#0b2e18'];
      for (let i = 0; i < 3; i++) {
        const ox = slice === i ? (i === 1 ? -6 : 6) : 0;
        const g = ctx.createLinearGradient(4 + ox, 6 + i * 16, 54 + ox, 20 + i * 16);
        g.addColorStop(0, '#72ff68'); g.addColorStop(1, '#0b2e18');
        ctx.fillStyle = '#031008'; ctx.fillRect(4 + ox, 6 + i * 16, 50, 16);
        ctx.fillStyle = g; ctx.fillRect(10 + ox, 9 + i * 16, 38, 10);
      }
      drawKawaiiEyes(16, 34, 26, 9, 3);
    } else if (e.type === 'racer') {
      const jet = 12 + Math.abs(Math.sin(e.t * 15)) * 16;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const exhaust = ctx.createLinearGradient(70, 0, 70 + jet, 0);
      exhaust.addColorStop(0, 'rgba(49,232,255,.85)'); exhaust.addColorStop(1, 'rgba(49,232,255,0)');
      ctx.fillStyle = exhaust; ctx.fillRect(72, 16, jet, 12);
      ctx.restore();
      // underside extrusion
      ctx.fillStyle = '#3a0f2c';
      ctx.beginPath(); ctx.moveTo(8, 28); ctx.lineTo(28, 12); ctx.lineTo(74, 14); ctx.lineTo(88, 28); ctx.lineTo(70, 44); ctx.lineTo(20, 44); ctx.closePath(); ctx.fill();
      const body = ctx.createLinearGradient(8, 4, 70, 42);
      body.addColorStop(0, '#ffb3d6'); body.addColorStop(.4, '#ff3e9d'); body.addColorStop(1, '#4a1238');
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.moveTo(3, 24); ctx.lineTo(23, 7); ctx.lineTo(70, 10); ctx.lineTo(83, 24); ctx.lineTo(67, 39); ctx.lineTo(18, 40); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#171039'; ctx.beginPath(); ctx.ellipse(42, 18, 18, 9, 0, 0, Math.PI * 2); ctx.fill();
      const glass = ctx.createLinearGradient(28, 12, 48, 22);
      glass.addColorStop(0, '#dffffb'); glass.addColorStop(1, '#31e8ff');
      ctx.fillStyle = glass; ctx.beginPath(); ctx.ellipse(38, 16, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe15a'; ctx.fillRect(5, 22, 10, 4); ctx.fillStyle = '#fff'; ctx.fillRect(23, 9, 24, 3);
    } else if (e.type === 'manta') {
      const flap = Math.sin(e.t * 5) * 8;
      ctx.fillStyle = '#041828';
      ctx.beginPath(); ctx.moveTo(8, 32); ctx.quadraticCurveTo(26, 2 + flap, 46, 22); ctx.quadraticCurveTo(68, 2 - flap, 90, 32); ctx.quadraticCurveTo(64, 28, 52, 48); ctx.lineTo(46, 56); ctx.lineTo(40, 48); ctx.quadraticCurveTo(28, 28, 8, 32); ctx.fill();
      const skin = ctx.createLinearGradient(0, 0, 0, 52);
      skin.addColorStop(0, '#c8fffa'); skin.addColorStop(.35, '#2f8cff'); skin.addColorStop(1, '#082a55');
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.moveTo(4, 29); ctx.quadraticCurveTo(23, -4 + flap, 43, 19); ctx.quadraticCurveTo(65, -4 - flap, 85, 29); ctx.quadraticCurveTo(63, 23, 50, 43); ctx.lineTo(44, 51); ctx.lineTo(39, 42); ctx.quadraticCurveTo(25, 23, 4, 29); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(43, 16, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
      drawKawaiiEyes(31, 50, 18, 7, 2);
    } else if (e.type === 'walker') {
      const step = Math.sin(e.t * 7) * 8;
      ctx.strokeStyle = '#1a0c14'; ctx.lineWidth = 13; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(24, 58); ctx.lineTo(18 + step, 88); ctx.moveTo(60, 58); ctx.lineTo(66 - step, 88); ctx.stroke();
      ctx.strokeStyle = '#ff8a35'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(24, 58); ctx.lineTo(18 + step, 88); ctx.moveTo(60, 58); ctx.lineTo(66 - step, 88); ctx.stroke();
      drawBox3D(8, 16, 68, 46, '#6e3548', 8);
      drawBox3D(16, 4, 50, 18, '#d04b3f', 5);
      ctx.fillStyle = '#15080d'; ctx.fillRect(18, 26, 47, 22);
      drawKawaiiEyes(24, 48, 30, 11, 3);
      const gun = ctx.createLinearGradient(-10, 18, 20, 32);
      gun.addColorStop(0, '#ffd6a0'); gun.addColorStop(1, '#ff5a36');
      ctx.fillStyle = gun; ctx.fillRect(-10, 18, 26, 10);
      ctx.fillStyle = '#120b2e'; ctx.fillRect(-12, 21, 8, 4);
    } else if (e.type === 'seeker') {
      ctx.save(); ctx.translate(34, 34); ctx.rotate(-e.t * 1.8);
      ctx.strokeStyle = '#72ff68'; ctx.lineWidth = 5; ctx.globalAlpha = .85;
      for (let i = 0; i < 3; i++) { ctx.rotate(Math.PI * 2 / 3); ctx.beginPath(); ctx.arc(0, 0, 30, -.55, .55); ctx.stroke(); }
      ctx.restore();
      ctx.fillStyle = '#031008'; ctx.beginPath(); ctx.arc(37, 37, 26, 0, Math.PI * 2); ctx.fill();
      const core = ctx.createRadialGradient(24, 20, 2, 34, 34, 26);
      core.addColorStop(0, '#efffeb'); core.addColorStop(.3, '#72ff68'); core.addColorStop(1, '#082519');
      ctx.fillStyle = core; ctx.beginPath(); ctx.arc(34, 34, 24, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#031008'; ctx.fillRect(20, 28, 28, 12);
      ctx.fillStyle = '#d6ffd0'; ctx.fillRect(24, 31, 20, 5);
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(26, 24, 5, 0, Math.PI * 2); ctx.fill();
    } else if (e.type === 'knight') {
      // cape volume
      ctx.fillStyle = '#2a0a22';
      ctx.beginPath(); ctx.moveTo(50, 22); ctx.lineTo(74, 32); ctx.lineTo(72, 82); ctx.lineTo(44, 66); ctx.closePath(); ctx.fill();
      const cape = ctx.createLinearGradient(55, 14, 72, 78); cape.addColorStop(0, '#ff6eb0'); cape.addColorStop(1, '#4d123d');
      ctx.fillStyle = cape; ctx.beginPath(); ctx.moveTo(48, 19); ctx.lineTo(70, 28); ctx.lineTo(67, 78); ctx.lineTo(42, 62); ctx.closePath(); ctx.fill();
      // armor extrude then front
      ctx.fillStyle = '#3b1730';
      ctx.beginPath(); ctx.moveTo(22, 22); ctx.lineTo(40, 8); ctx.lineTo(60, 22); ctx.lineTo(62, 70); ctx.lineTo(40, 84); ctx.lineTo(18, 70); ctx.closePath(); ctx.fill();
      const armor = ctx.createLinearGradient(10, 5, 57, 72);
      armor.addColorStop(0, '#fff3bd'); armor.addColorStop(.3, '#ffe15a'); armor.addColorStop(.7, '#9d5c27'); armor.addColorStop(1, '#3b1730');
      ctx.fillStyle = armor;
      ctx.beginPath(); ctx.moveTo(18, 18); ctx.lineTo(36, 3); ctx.lineTo(55, 18); ctx.lineTo(57, 65); ctx.lineTo(36, 79); ctx.lineTo(15, 65); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#25051d'; ctx.fillRect(20, 22, 33, 17); ctx.fillStyle = '#ff9ccf'; ctx.fillRect(26, 27, 21, 4);
      ctx.strokeStyle = '#ffe15a'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(9, 32); ctx.lineTo(-5, 74); ctx.stroke();
      ctx.fillStyle = '#ff3e9d'; heartPath(36, 55, 10); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(22, 12, 8, 4);
    } else if (e.type === 'cupid') {
      const flap = Math.sin(e.t * 10) * 8;
      ctx.fillStyle = 'rgba(255,200,230,.35)';
      ctx.beginPath(); ctx.ellipse(10, 24 + flap * .4, 18, 10, -.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(52, 24 + flap * .4, 18, 10, .5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.beginPath(); ctx.ellipse(8, 22 + flap * .4, 16, 8, -.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(54, 22 + flap * .4, 16, 8, .5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7a1848'; heartPath(34, 33, 24); ctx.fill();
      ctx.fillStyle = '#ff3e9d'; heartPath(31, 30, 22); ctx.fill();
      ctx.fillStyle = '#ffd7ea'; heartPath(26, 25, 9); ctx.fill();
      drawKawaiiEyes(22, 36, 28, 6, 2);
      ctx.strokeStyle = '#ffe15a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(2, 32, 10, -1.1, 1.1); ctx.stroke();
    } else if (e.type === 'midboss') {
      // Art authored at 158×132
      ctx.save(); ctx.scale(e.w / 158, e.h / 132);
      drawMidBoss(e);
      ctx.restore();
    } else {
      // Art authored at 230×190 — scale to the larger hitbox.
      ctx.save(); ctx.scale(e.w / 230, e.h / 190);
      drawBoss(e);
      ctx.restore();
    }
    if (e.type !== 'boss' && e.type !== 'midboss') {
      drawShieldBubble(e);
      drawEnemyVariant(e);
    } else if (e.hit > 0) {
      // Soft hit flash (no hard bounding-box frame).
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(.55, e.hit * 4);
      const g = ctx.createRadialGradient(e.w * .5, e.h * .5, 4, e.w * .5, e.h * .5, e.w * .55);
      g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(e.w * .5, e.h * .5, e.w * .48, e.h * .42, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawEnemyVariant(e) {
    if (e.hit > 0) {
      // Soft body flash — never stroke a full rect "frame" around the enemy.
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(.5, e.hit * 4);
      const g = ctx.createRadialGradient(e.w * .5, e.h * .45, 2, e.w * .5, e.h * .45, e.w * .5);
      g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(e.w * .5, e.h * .45, e.w * .42, e.h * .4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    if (e.variant === 'standard') return;
    const color = e.variant === 'elite' ? '#ffe15a' : '#a8b7d6';
    ctx.save(); ctx.globalAlpha = .9;
    ctx.fillStyle = color;
    if (e.variant === 'elite') {
      // Crown only — no outline box, no HP frame bar.
      ctx.beginPath(); ctx.moveTo(e.w / 2 - 12, 5); ctx.lineTo(e.w / 2 - 5, -7); ctx.lineTo(e.w / 2, 3); ctx.lineTo(e.w / 2 + 6, -8); ctx.lineTo(e.w / 2 + 13, 5); ctx.closePath(); ctx.fill();
    } else {
      // Armored: small rivet dots on the body, not a border.
      for (let x = 14; x < e.w - 10; x += 18) {
        ctx.beginPath(); ctx.arc(x, 12, 2.2, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawMidBoss(e) {
    const stage = stages[stageIndex], pulse = 6 + Math.sin(e.t * 7) * 4;
    // extruded hex chassis
    ctx.save();
    ctx.translate(5, 4); ctx.fillStyle = '#05030c';
    ctx.beginPath(); ctx.moveTo(18, 66); ctx.lineTo(48, 14); ctx.lineTo(111, 14); ctx.lineTo(142, 66); ctx.lineTo(111, 118); ctx.lineTo(48, 118); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.shadowColor = stage.accent2; ctx.shadowBlur = 18;
    const shell = ctx.createLinearGradient(30, 20, 120, 110);
    shell.addColorStop(0, shade(stage.accent2, 1.2)); shell.addColorStop(.5, stage.accent2); shell.addColorStop(1, shade(stage.accent2, .45));
    ctx.fillStyle = '#10091f';
    ctx.beginPath(); ctx.moveTo(18, 66); ctx.lineTo(48, 14); ctx.lineTo(111, 14); ctx.lineTo(142, 66); ctx.lineTo(111, 118); ctx.lineTo(48, 118); ctx.closePath(); ctx.fill();
    ctx.fillStyle = shell;
    ctx.beginPath(); ctx.moveTo(31, 65); ctx.lineTo(55, 28); ctx.lineTo(103, 28); ctx.lineTo(128, 65); ctx.lineTo(103, 104); ctx.lineTo(55, 104); ctx.closePath(); ctx.fill();
    // stage motif trim
    ctx.fillStyle = stage.accent;
    if (stageIndex === 1) { for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(50 + i * 28, 112, 10, 5, 0, 0, Math.PI * 2); ctx.fill(); } }
    else if (stageIndex === 2) { ctx.fillRect(40, 18, 8, 12); ctx.fillRect(110, 18, 8, 12); }
    else if (stageIndex === 3) { ctx.fillStyle = stage.accent; ctx.fillRect(56, 44, 46, 4); ctx.fillRect(56, 54, 46, 4); }
    else if (stageIndex === 4) { heartPath(79, 36, 8); ctx.fill(); }
    else { ctx.fillRect(48, 18, 62, 4); }
    ctx.fillStyle = '#211039'; ctx.fillRect(48, 45, 63, 43);
    ctx.fillStyle = stage.accent; ctx.fillRect(57, 54, 16, 12); ctx.fillRect(87, 54, 16, 12);
    ctx.fillStyle = '#fff'; ctx.fillRect(61, 57, 6, 5); ctx.fillRect(91, 57, 6, 5);
    const core = ctx.createRadialGradient(74, 78, 2, 79, 82, 14);
    core.addColorStop(0, '#fff'); core.addColorStop(.4, '#ffe15a'); core.addColorStop(1, stage.accent2);
    ctx.fillStyle = core; ctx.beginPath(); ctx.arc(79, 82, 10 + pulse * .25, 0, Math.PI * 2); ctx.fill();
    drawBox3D(-pulse, 54, 40 + pulse, 12, stage.accent, 4);
    drawBox3D(118, 54, 40 + pulse, 12, stage.accent, 4);
    drawBox3D(22, 108, 44, 12, '#24102f', 4);
    drawBox3D(93, 108, 44, 12, '#24102f', 4);
    ctx.shadowBlur = 0;
    ctx.restore();
  }



  function drawBoss(e) {
    const stage = stages[stageIndex];
    const pulse = 4 + Math.sin(e.t * 5) * 3;
    // shared depth plate under every boss
    ctx.save(); ctx.globalAlpha = .35; ctx.fillStyle = '#05030c';
    ctx.translate(8, 7); ctx.fillRect(20, 20, e.w - 40, e.h - 30); ctx.restore();
    if (stageIndex === 0) {
      ctx.shadowColor = stage.accent2; ctx.shadowBlur = 16;
      drawBox3D(28, 25, 174, 138, '#16082f', 10);
      drawBox3D(0, 66, 230, 57, '#2a1048', 8);
      drawBox3D(39, 14, 152, 136, stage.accent2, 8);
      ctx.fillStyle = stage.accent; ctx.fillRect(51, 26, 128, 30);
      ctx.fillStyle = '#100720'; ctx.fillRect(53, 65, 124, 66);
      ctx.fillStyle = stage.accent2; ctx.fillRect(67, 78, 30, 25); ctx.fillRect(133, 78, 30, 25);
      ctx.fillStyle = '#fff'; ctx.fillRect(74, 81, 9, 8); ctx.fillRect(140, 81, 9, 8);
      ctx.fillStyle = '#ffe15a'; heartPath(115, 116, 19); ctx.fill();
      ctx.fillStyle = stage.accent; ctx.fillRect(-pulse, 51, 35, 8); ctx.fillRect(197, 51, 35 + pulse, 8);
      drawBox3D(15, 153, 55, 12, stage.accent, 4); drawBox3D(160, 153, 55, 12, stage.accent, 4);
      ctx.shadowBlur = 0;
    } else if (stageIndex === 1) {
      ctx.shadowColor = '#65fff2'; ctx.shadowBlur = 16;
      ctx.fillStyle = '#061828';
      ctx.beginPath(); ctx.moveTo(155, 100); ctx.quadraticCurveTo(236, 65 + Math.sin(e.t * 3) * 20, 232, 32); ctx.quadraticCurveTo(205, 100, 232, 166); ctx.quadraticCurveTo(214, 126, 155, 126); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#0d2c52';
      ctx.beginPath(); ctx.moveTo(150, 95); ctx.quadraticCurveTo(232, 60 + Math.sin(e.t * 3) * 20, 228, 28); ctx.quadraticCurveTo(200, 95, 228, 162 + Math.sin(e.t * 3) * 15); ctx.quadraticCurveTo(210, 122, 150, 122); ctx.closePath(); ctx.fill();
      const body = ctx.createRadialGradient(70, 70, 10, 100, 100, 90);
      body.addColorStop(0, '#65fff2'); body.addColorStop(.4, '#2f8cff'); body.addColorStop(1, '#071d42');
      ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(100, 95, 68, 55, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#071d42'; ctx.fillRect(45, 70, 95, 40);
      ctx.fillStyle = '#65fff2'; ctx.fillRect(55, 80, 22, 18); ctx.fillRect(95, 80, 22, 18);
      ctx.fillStyle = '#fff'; ctx.fillRect(60, 84, 7, 7); ctx.fillRect(100, 84, 7, 7);
      ctx.fillStyle = '#65fff2';
      ctx.beginPath(); ctx.moveTo(60, 42); ctx.lineTo(80, 2); ctx.lineTo(95, 40); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(95, 40); ctx.lineTo(115, -6); ctx.lineTo(130, 38); ctx.closePath(); ctx.fill();
      for (let i = 0; i < 5; i++) { ctx.fillStyle = i % 2 ? '#ffe15a' : '#fff'; ctx.beginPath(); ctx.arc(42 + i * 32, 152, 7, 0, Math.PI * 2); ctx.fill(); }
      ctx.shadowBlur = 0;
    } else if (stageIndex === 2) {
      const fl = Math.sin(e.t * 14) * 6;
      ctx.shadowColor = '#ff5a36'; ctx.shadowBlur = 16;
      ctx.fillStyle = '#ff8a35';
      ctx.beginPath(); ctx.moveTo(22, 24); ctx.lineTo(37, -8 - fl); ctx.lineTo(52, 24); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(178, 24); ctx.lineTo(193, -14 + fl); ctx.lineTo(208, 24); ctx.closePath(); ctx.fill();
      drawBox3D(20, 20, 34, 72, '#2b1230', 7);
      drawBox3D(176, 20, 34, 72, '#2b1230', 7);
      drawBox3D(35, 55, 160, 122, '#3a1626', 10);
      drawBox3D(45, 65, 140, 102, '#57202c', 7);
      ctx.fillStyle = '#180509'; ctx.fillRect(60, 112, 110, 48);
      for (let i = 0; i < 4; i++) {
        ctx.save(); ctx.globalAlpha = .55 + Math.sin(e.t * 6 + i) * .4;
        ctx.fillStyle = '#ff5a36'; ctx.fillRect(66 + i * 27, 118, 18, 36); ctx.restore();
      }
      ctx.fillStyle = '#ffe15a'; ctx.fillRect(70, 78, 26, 16); ctx.fillRect(134, 78, 26, 16);
      ctx.fillStyle = '#180509'; ctx.fillRect(76, 82, 8, 8); ctx.fillRect(140, 82, 8, 8);
      ctx.fillStyle = '#ffe15a';
      ctx.beginPath(); ctx.moveTo(85, 55); ctx.lineTo(95, 30); ctx.lineTo(105, 55); ctx.lineTo(115, 26); ctx.lineTo(125, 55); ctx.lineTo(135, 32); ctx.lineTo(145, 55); ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
    } else if (stageIndex === 3) {
      if (e.blink > 0 && Math.floor(e.blink * 30) % 2 === 0) return;
      ctx.save();
      ctx.globalAlpha = .82 + Math.sin(e.t * 7) * .12;
      ctx.shadowColor = '#72ff68'; ctx.shadowBlur = 18;
      ctx.fillStyle = '#031008';
      ctx.beginPath(); ctx.moveTo(120, 10); ctx.lineTo(220, 100); ctx.lineTo(120, 190); ctx.lineTo(20, 100); ctx.closePath(); ctx.fill();
      const plate = ctx.createLinearGradient(40, 20, 180, 160);
      plate.addColorStop(0, '#72ff68'); plate.addColorStop(.45, '#164636'); plate.addColorStop(1, '#0b2e18');
      ctx.fillStyle = plate;
      ctx.beginPath(); ctx.moveTo(115, 5); ctx.lineTo(215, 95); ctx.lineTo(115, 185); ctx.lineTo(15, 95); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#0b2e18';
      ctx.beginPath(); ctx.moveTo(115, 25); ctx.lineTo(195, 95); ctx.lineTo(115, 165); ctx.lineTo(35, 95); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#72ff68'; ctx.fillRect(75, 80, 30, 12); ctx.fillRect(125, 80, 30, 12);
      ctx.fillStyle = '#d6ffd0'; ctx.fillRect(83, 83, 9, 6); ctx.fillRect(133, 83, 9, 6);
      ctx.strokeStyle = '#72ff68'; ctx.lineWidth = 4; ctx.beginPath();
      for (let i = 0; i <= 6; i++) ctx.lineTo(80 + i * 12, 125 + (i % 2 ? 8 : 0));
      ctx.stroke();
      for (let i = 0; i < 3; i++) { const a = e.t * 3 + i * 2.1; ctx.fillStyle = '#d6ffd0'; ctx.fillRect(115 + Math.cos(a) * 110 - 4, 95 + Math.sin(a) * 80 - 4, 8, 8); }
      ctx.restore();
    } else {
      ctx.shadowColor = '#ff3e9d'; ctx.shadowBlur = 20;
      if (e.phase2) { ctx.save(); ctx.globalAlpha = .22 + Math.sin(e.t * 8) * .14; ctx.fillStyle = '#ff3e9d'; heartPath(115, 100, 104 + pulse); ctx.fill(); ctx.restore(); }
      ctx.fillStyle = '#3a0a28'; heartPath(120, 106, 94); ctx.fill();
      ctx.fillStyle = '#72114e'; heartPath(115, 100, 92); ctx.fill();
      const heart = ctx.createRadialGradient(90, 70, 10, 115, 100, 80);
      heart.addColorStop(0, '#ff6eb0'); heart.addColorStop(.5, '#d82065'); heart.addColorStop(1, '#72114e');
      ctx.fillStyle = heart; heartPath(115, 96, 78); ctx.fill();
      ctx.fillStyle = '#25051d'; ctx.fillRect(70, 70, 34, 26); ctx.fillRect(126, 70, 34, 26);
      ctx.fillStyle = '#ffe15a'; ctx.fillRect(78, 76, 12, 12); ctx.fillRect(134, 76, 12, 12);
      ctx.strokeStyle = '#25051d'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(68, 60); ctx.lineTo(104, 72); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(162, 60); ctx.lineTo(126, 72); ctx.stroke();
      ctx.fillStyle = '#25051d'; ctx.fillRect(95, 120, 40, 10);
      ctx.fillStyle = '#ffe15a';
      ctx.beginPath(); ctx.moveTo(75, 30); ctx.lineTo(85, -2); ctx.lineTo(100, 24); ctx.lineTo(115, -8); ctx.lineTo(130, 24); ctx.lineTo(145, -2); ctx.lineTo(155, 30); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#31e8ff'; ctx.beginPath(); ctx.arc(115, 18, 8, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }
    // Hit flash handled by drawEnemy parent after scale.
  }

  function drawPickup(p) {
    const bob = Math.sin(p.t * 4.2) * 4;
    const s = 1 + Math.sin(p.t * 5) * .08;
    ctx.save(); ctx.translate(p.x, p.y + bob); ctx.scale(s, s);
    // Soft ground glow only — no hard circle/frame.
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .28;
    const aura = p.type === 'heal' ? '#72ff68' : p.type === 'power' ? '#ff8a35' : p.type === 'spread' ? '#31e8ff' : '#ffe15a';
    const ag = ctx.createRadialGradient(0, 8, 2, 0, 8, 26);
    ag.addColorStop(0, hexA(aura, .55)); ag.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ag; ctx.beginPath(); ctx.ellipse(0, 10, 20, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (p.type === 'heal') {
      if (p.kind === 'burger') drawBurgerPickup(p.t);
      else drawEnergyDrinkPickup(p.t);
    } else if (p.type === 'power') drawPowerPickup(p.t);
    else if (p.type === 'spread') drawSpreadPickup(p.t);
    else drawSpeedPickup(p.t);
    ctx.restore();
  }

  function drawEnergyDrinkPickup(t) {
    // Tall slim energy can with tab, label, and sparkles
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.ellipse(1, 18, 11, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    // body shell
    ctx.fillStyle = '#14101f';
    ctx.beginPath(); ctx.roundRect ? null : null;
    ctx.beginPath();
    ctx.moveTo(-10, -18); ctx.quadraticCurveTo(-12, 0, -11, 16); ctx.lineTo(11, 16); ctx.quadraticCurveTo(12, 0, 10, -18); ctx.closePath(); ctx.fill();
    const body = ctx.createLinearGradient(-12, 0, 12, 0);
    body.addColorStop(0, '#0a2f22'); body.addColorStop(.25, '#3dff9a'); body.addColorStop(.55, '#31e8ff'); body.addColorStop(.8, '#7b5cff'); body.addColorStop(1, '#0a1a40');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-8, -16); ctx.quadraticCurveTo(-10, 0, -9, 14); ctx.lineTo(9, 14); ctx.quadraticCurveTo(10, 0, 8, -16); ctx.closePath(); ctx.fill();
    // silver lid + pull tab
    ctx.fillStyle = '#d5dbe8'; ctx.fillRect(-7, -20, 14, 5);
    ctx.fillStyle = '#9aa3b5'; ctx.fillRect(-3, -23, 6, 3);
    ctx.strokeStyle = '#c8d0e0'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(4, -21, 3.5, -.2, Math.PI * 1.2); ctx.stroke();
    // label band
    ctx.fillStyle = 'rgba(8,6,18,.55)'; ctx.fillRect(-7, -6, 14, 14);
    ctx.fillStyle = '#ffe15a'; ctx.font = 'bold 8px "Press Start 2P", monospace'; ctx.textAlign = 'center';
    ctx.fillText('E', 0, 5);
    ctx.fillStyle = '#fff'; ctx.font = '5px sans-serif'; ctx.fillText('ENERGY', 0, -1);
    // specular
    ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(-6, -14, 2.5, 22);
    // sparkles
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = hexA('#ffe15a', .55 + Math.sin(t * 10) * .3);
    ctx.beginPath(); ctx.arc(12, -10 + Math.sin(t * 6) * 2, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-12, 4, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawBurgerPickup(t) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.beginPath(); ctx.ellipse(1, 16, 15, 4, 0, 0, Math.PI * 2); ctx.fill();
    // bottom bun
    ctx.fillStyle = '#d4923a';
    ctx.beginPath(); ctx.ellipse(0, 10, 15, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8a84a'; ctx.fillRect(-15, 6, 30, 6);
    // patty
    ctx.fillStyle = '#5c2a12'; ctx.fillRect(-14, 2, 28, 5);
    ctx.fillStyle = '#7a3a18'; ctx.fillRect(-13, 3, 26, 2);
    // cheese drip
    ctx.fillStyle = '#ffc938'; ctx.fillRect(-13, -1, 26, 4);
    ctx.beginPath(); ctx.moveTo(-6, 3); ctx.lineTo(-4, 8); ctx.lineTo(-2, 3); ctx.fill();
    ctx.beginPath(); ctx.moveTo(5, 3); ctx.lineTo(7, 9); ctx.lineTo(9, 3); ctx.fill();
    // lettuce
    ctx.fillStyle = '#3cb85a';
    ctx.beginPath(); ctx.moveTo(-14, -2); ctx.quadraticCurveTo(-8, -6, 0, -2); ctx.quadraticCurveTo(8, -6, 14, -2); ctx.lineTo(13, 1); ctx.lineTo(-13, 1); ctx.closePath(); ctx.fill();
    // tomato
    ctx.fillStyle = '#ff4d6a'; ctx.fillRect(-12, -5, 24, 3);
    // top bun
    const bun = ctx.createLinearGradient(0, -16, 0, -2);
    bun.addColorStop(0, '#f0c06a'); bun.addColorStop(1, '#c47a28');
    ctx.fillStyle = bun;
    ctx.beginPath(); ctx.ellipse(0, -4, 15, 9, 0, Math.PI, 0); ctx.fill();
    ctx.fillRect(-15, -5, 30, 4);
    // sesame
    ctx.fillStyle = '#ffe9b0';
    for (const [x, y] of [[-7, -10], [-2, -12], [3, -11], [8, -9], [0, -8], [-5, -7]]) {
      ctx.beginPath(); ctx.ellipse(x, y, 1.4, .9, .4, 0, Math.PI * 2); ctx.fill();
    }
    // steam
    ctx.globalAlpha = .35 + Math.sin(t * 5) * .15; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-4, -18); ctx.quadraticCurveTo(-6, -24, -2, -28); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(5, -17); ctx.quadraticCurveTo(8, -23, 4, -27); ctx.stroke();
    ctx.restore();
  }

  function drawPowerPickup(t) {
    // Hot sauce / power flask
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(0, 16, 10, 3, 0, 0, Math.PI * 2); ctx.fill();
    // bottle
    const glass = ctx.createLinearGradient(-10, -14, 10, 14);
    glass.addColorStop(0, '#ffb070'); glass.addColorStop(.4, '#ff5a20'); glass.addColorStop(1, '#7a1808');
    ctx.fillStyle = glass;
    ctx.beginPath(); ctx.moveTo(-8, -8); ctx.lineTo(8, -8); ctx.lineTo(10, 12); ctx.lineTo(-10, 12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff8a35'; ctx.fillRect(-5, -16, 10, 9);
    ctx.fillStyle = '#ffe15a'; ctx.fillRect(-6, -18, 12, 3);
    // chili mark
    ctx.fillStyle = '#fff'; ctx.beginPath();
    ctx.moveTo(0, -4); ctx.quadraticCurveTo(6, 2, 2, 8); ctx.quadraticCurveTo(0, 4, -2, 8); ctx.quadraticCurveTo(-6, 2, 0, -4); ctx.fill();
    ctx.fillStyle = '#3cb85a'; ctx.fillRect(-1, -6, 2, 4);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = hexA('#ff8a35', .4 + Math.sin(t * 8) * .2);
    ctx.beginPath(); ctx.arc(0, 2, 14, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawSpreadPickup(t) {
    // Triple blaster / wide shot
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(0, 14, 14, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1040';
    ctx.beginPath(); ctx.moveTo(-6, 8); ctx.lineTo(4, 8); ctx.lineTo(6, -2); ctx.lineTo(-4, -2); ctx.closePath(); ctx.fill();
    const metal = ctx.createLinearGradient(-14, 0, 14, 0);
    metal.addColorStop(0, '#0a6a7a'); metal.addColorStop(.5, '#65fff2'); metal.addColorStop(1, '#1a4a9a');
    ctx.fillStyle = metal;
    for (const [ox, oy, rot] of [[-10, -2, -.35], [0, -6, 0], [10, -2, .35]]) {
      ctx.save(); ctx.translate(ox, oy); ctx.rotate(rot);
      ctx.fillRect(-3, -10, 6, 16);
      ctx.fillStyle = '#ffe15a'; ctx.fillRect(-2, -12, 4, 3);
      ctx.fillStyle = metal; ctx.restore();
    }
    ctx.fillStyle = '#31e8ff'; ctx.fillRect(-5, 0, 12, 6);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = hexA('#31e8ff', .45 + Math.sin(t * 7) * .2);
    for (const a of [-.4, 0, .4]) {
      ctx.beginPath(); ctx.moveTo(4, -4); ctx.lineTo(18 * Math.cos(a), -4 + 18 * Math.sin(a)); ctx.lineTo(14 * Math.cos(a), 2 + 14 * Math.sin(a)); ctx.fill();
    }
    ctx.restore();
  }

  function drawSpeedPickup(t) {
    // Neon sneakers
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(0, 14, 14, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    // shoe body
    const shoe = ctx.createLinearGradient(-14, -8, 14, 10);
    shoe.addColorStop(0, '#9dff7a'); shoe.addColorStop(.5, '#72ff68'); shoe.addColorStop(1, '#1a6a30');
    ctx.fillStyle = shoe;
    ctx.beginPath(); ctx.moveTo(-12, 2); ctx.quadraticCurveTo(-14, -6, -4, -10); ctx.lineTo(10, -8); ctx.quadraticCurveTo(16, -4, 14, 4); ctx.lineTo(-10, 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#120b2e'; ctx.fillRect(-8, -2, 16, 3);
    ctx.fillStyle = '#fff'; ctx.fillRect(-6, -6, 8, 2);
    // sole
    ctx.fillStyle = '#0a2818'; ctx.fillRect(-12, 6, 26, 4);
    ctx.fillStyle = '#ffe15a';
    for (let i = 0; i < 4; i++) ctx.fillRect(-10 + i * 6, 7, 3, 2);
    // motion lines
    ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = hexA('#72ff68', .5 + Math.sin(t * 9) * .25); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-18, -2); ctx.lineTo(-10, -2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-17, 3); ctx.lineTo(-9, 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-16, 8); ctx.lineTo(-10, 8); ctx.stroke();
    ctx.restore();
  }

  function drawHUD() {
    ctx.save();
    const stage = stages[stageIndex];
    ctx.fillStyle = 'rgba(10,6,31,.82)'; ctx.fillRect(24, 23, 286, 70); ctx.fillRect(VW - 356, 23, 332, 70);
    ctx.strokeStyle = 'rgba(49,232,255,.6)'; ctx.strokeRect(24.5, 23.5, 286, 70); ctx.strokeRect(VW - 356.5, 23.5, 332, 70);
    ctx.fillStyle = '#31e8ff'; ctx.font = '10px "Press Start 2P", monospace'; ctx.fillText('SCORE', 42, 45);
    ctx.fillStyle = '#fff'; ctx.font = '25px "Press Start 2P", monospace'; ctx.fillText(pad(score), 42, 77);
    ctx.fillStyle = 'rgba(10,6,31,.84)'; ctx.fillRect(24, 99, 286, 26); ctx.strokeStyle = 'rgba(255,225,90,.55)'; ctx.strokeRect(24.5, 99.5, 286, 26);
    ctx.fillStyle = '#2d2144'; ctx.fillRect(91, 107, 207, 10); ctx.fillStyle = special >= 100 ? '#ffe15a' : '#ff3e9d'; ctx.fillRect(91, 107, 207 * special / 100, 10);
    ctx.fillStyle = special >= 100 ? '#ffe15a' : '#fff'; ctx.font = '7px "Press Start 2P", monospace'; ctx.fillText('SPECIAL', 34, 116);
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
    const boss = enemies.find(e => e.type === 'boss' || e.type === 'midboss');
    if (boss) {
      ctx.fillStyle = 'rgba(10,6,31,.9)'; ctx.fillRect(330, VH - 52, 620, 28);
      ctx.fillStyle = '#311848'; ctx.fillRect(338, VH - 44, 604, 12);
      const ratio = Math.max(0, boss.hp / boss.maxHp);
      if (boss.type === 'boss' && stageIndex === stages.length - 1) {
        // Final boss shows two stacked gauges: yellow drains first, then pink.
        ctx.fillStyle = stage.accent2; ctx.fillRect(338, VH - 44, 604 * Math.min(1, ratio * 2), 12);
        if (ratio > .5) { ctx.fillStyle = '#ffe15a'; ctx.fillRect(338, VH - 44, 604 * ((ratio - .5) * 2), 12); }
      } else {
        ctx.fillStyle = stage.accent2; ctx.fillRect(338, VH - 44, 604 * ratio, 12);
      }
      ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '9px "Press Start 2P", monospace'; ctx.fillText(boss.type === 'midboss' ? 'MID BOSS  CRIMSON WARDEN' : `BOSS  ${stage.boss}`, VW / 2, VH - 58);
      if (boss.phase2) { ctx.fillStyle = stage.accent2; ctx.font = '8px "Press Start 2P", monospace'; ctx.fillText('- FINAL PHASE -', VW / 2, VH - 18); }
      ctx.textAlign = 'left';
    }
    if (bossState === 'warning' || bossState === 'midboss-warning') {
      ctx.globalAlpha = .55 + Math.sin(bossWarning * 12) * .35; ctx.fillStyle = stage.accent2; ctx.fillRect(0, 292, VW, 102);
      ctx.globalAlpha = 1; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '28px "Press Start 2P", monospace'; ctx.fillText('WARNING', VW / 2, 344);
      ctx.font = '11px "Press Start 2P", monospace'; ctx.fillText(bossState === 'midboss-warning' ? 'MID BOSS APPROACHING' : 'BOSS APPROACHING', VW / 2, 374); ctx.textAlign = 'left';
    }
    if (stageBanner > 0) {
      const alpha = Math.min(1, stageBanner, (3 - stageBanner) * 2);
      ctx.globalAlpha = Math.max(0, alpha); ctx.fillStyle = 'rgba(7,4,25,.78)'; ctx.fillRect(0, 258, VW, 176);
      ctx.textAlign = 'center'; ctx.fillStyle = stage.accent; ctx.font = '16px "Press Start 2P", monospace'; ctx.fillText(`STAGE ${stageIndex + 1}`, VW / 2, 308);
      ctx.fillStyle = '#fff'; ctx.font = '23px "Press Start 2P", monospace'; ctx.fillText(stage.name, VW / 2, 352);
      ctx.fillStyle = '#ffd7ea'; ctx.font = '19px "DotGothic16", monospace'; ctx.fillText(stage.subtitle, VW / 2, 388);
      ctx.fillStyle = stage.accent2; ctx.font = '9px "Press Start 2P", monospace'; ctx.fillText(`BOSS: ${stage.boss}`, VW / 2, 418);
      ctx.globalAlpha = 1; ctx.textAlign = 'left';
    }
    if ((bossState === 'transition' || bossState === 'final') && state === 'playing') {
      ctx.globalAlpha = .92; ctx.fillStyle = 'rgba(7,4,25,.86)'; ctx.fillRect(0, 240, VW, 236);
      ctx.textAlign = 'center'; ctx.fillStyle = '#ffe15a'; ctx.font = '25px "Press Start 2P", monospace';
      ctx.fillText(bossState === 'final' ? 'MISSION COMPLETE!' : 'STAGE CLEAR!', VW / 2, 296);
      if (stageResult) {
        ctx.font = '11px "Press Start 2P", monospace'; ctx.fillStyle = '#fff';
        ctx.fillText(`DEFEATED  ${stageResult.kills}`, VW / 2, 344);
        ctx.fillText(`TIME  ${stageResult.time.toFixed(1)}s`, VW / 2, 372);
        ctx.fillStyle = '#31e8ff'; ctx.fillText(`TIME BONUS  +${stageResult.timeBonus}`, VW / 2, 402);
        if (stageResult.noDamageBonus) { ctx.fillStyle = '#ffe15a'; ctx.fillText(`NO DAMAGE!  +${stageResult.noDamageBonus}`, VW / 2, 432); }
      }
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
    const stage = stages[stageIndex];
    const bossMelody = [146.83, 174.61, 146.83, 220, 207.65, 174.61, 155.56, 138.59, 146.83, 293.66, 261.63, 220, 207.65, 233.08, 174.61, 138.59];
    const finalMelody = [155.56, 185, 155.56, 233.08, 220, 185, 164.81, 146.83, 155.56, 311.13, 277.18, 233.08, 220, 246.94, 185, 146.83];
    const bossBass = [73.42, 73.42, 82.41, 82.41, 65.41, 65.41, 82.41, 92.5];
    const bossMusic = bossState === 'active' || bossState === 'warning';
    const melody = bossMusic ? (stageIndex === stages.length - 1 ? finalMelody : bossMelody) : stage.melody;
    const bass = bossMusic ? bossBass : stage.bass;
    const now = audioCtx.currentTime;
    const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
    o.type = bossMusic ? 'sawtooth' : 'square'; o.frequency.value = melody[musicStep % melody.length]; o.connect(g); g.connect(audioCtx.destination);
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
    if (!pad) { padInput.x = 0; padInput.y = 0; padInput.fire = false; padInput.special = false; padStartWasDown = false; padActionWasDown = false; padSpecialWasDown = false; return; }
    const deadzone = value => Math.abs(value) < .18 ? 0 : value;
    padInput.x = deadzone(pad.axes[0] || 0) + ((pad.buttons[15]?.pressed ? 1 : 0) - (pad.buttons[14]?.pressed ? 1 : 0));
    padInput.y = deadzone(pad.axes[1] || 0) + ((pad.buttons[13]?.pressed ? 1 : 0) - (pad.buttons[12]?.pressed ? 1 : 0));
    padInput.x = clamp(padInput.x, -1, 1); padInput.y = clamp(padInput.y, -1, 1);
    padInput.fire = Boolean(pad.buttons[0]?.pressed || pad.buttons[1]?.pressed || pad.buttons[2]?.pressed || (pad.buttons[7]?.value || 0) > .25);
    padInput.special = Boolean(pad.buttons[3]?.pressed || (pad.buttons[6]?.value || 0) > .5);
    const startDown = Boolean(pad.buttons[9]?.pressed);
    const actionDown = Boolean(pad.buttons[0]?.pressed);
    if (startDown && !padStartWasDown && state === 'playing') togglePause();
    if (actionDown && !padActionWasDown && state !== 'playing') resetGame();
    if (padInput.special && !padSpecialWasDown && state === 'playing') useSpecial();
    padStartWasDown = startDown; padActionWasDown = actionDown;
    padSpecialWasDown = padInput.special;
  }

  function sfx(type) {
    if (!soundOn) return;
    try {
      const hasSample = playSampledSfx(type);
      const map = {
        shoot: [650, 980, .035, .035], boom: [130, 48, .1, .12], hurt: [180, 70, .18, .15], power: [480, 1200, .24, .12], boss: [90, 260, .7, .16],
        thunder: [75, 38, .5, .2], teleport: [900, 210, .16, .09], bubble: [290, 720, .13, .06], fireball: [230, 60, .26, .11],
        missile: [180, 760, .12, .07], special: [75, 1280, .85, .18], graze: [1200, 1650, .045, .025], shield: [760, 340, .08, .04]
      };
      if (!map[type]) return;
      ensureAudio();
      const o = audioCtx.createOscillator(); const gain = audioCtx.createGain();
      o.connect(gain); gain.connect(audioCtx.destination);
      const now = audioCtx.currentTime;
      const [a, b, dur, vol] = map[type];
      const mixedVolume = Math.min(.3, vol * (hasSample ? .72 : 1.85));
      o.type = type === 'shoot' ? 'square' : 'sawtooth';
      o.frequency.setValueAtTime(a, now); o.frequency.exponentialRampToValueAtTime(b, now + dur);
      gain.gain.setValueAtTime(mixedVolume, now); gain.gain.exponentialRampToValueAtTime(.001, now + dur);
      o.start(now); o.stop(now + dur);
    } catch (_) { /* audio is optional */ }
  }

  function setPaused(value) {
    if (state !== 'playing') return;
    paused = value;
    pauseLabel.classList.toggle('is-visible', paused);
    pauseButton.classList.toggle('is-paused', paused);
    pauseButton.textContent = paused ? '▶' : '❚❚';
    specialButton.disabled = paused || special < 100;
    if (paused) pauseBgm();
    else { lastTime = performance.now(); playBgm(desiredBgmKey()); }
  }
  function togglePause() { setPaused(!paused); }

  function frame(now) {
    const raw = (now - lastTime) / 1000;
    const dt = clamp(raw || 0, 0, .033);
    if (fpsShow && raw > 0 && raw < 1) fpsAvg += (1 / raw - fpsAvg) * .1;
    lastTime = now; pollGamepad(); update(dt); draw(); requestAnimationFrame(frame);
  }

  function pad(n) { return Math.floor(n).toString().padStart(6, '0'); }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function rects(ax, ay, aw, ah, bx, by, bw, bh) { return ax < bx+bw && ax+aw > bx && ay < by+bh && ay+ah > by; }
  function circleRect(cx, cy, r, x, y, w, h) { const nx = clamp(cx, x, x+w); const ny = clamp(cy, y, y+h); return (cx-nx)**2 + (cy-ny)**2 < r*r; }
  function heartPath(cx, cy, s) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * .75);
    ctx.bezierCurveTo(cx - s * 1.15, cy + s * .1, cx - s * 1.02, cy - s * .78, cx, cy - s * .22);
    ctx.bezierCurveTo(cx + s * 1.02, cy - s * .78, cx + s * 1.15, cy + s * .1, cx, cy + s * .75);
    ctx.closePath();
  }
  function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
  function shade(hex, f) { const n = parseInt(hex.slice(1), 16); const r = Math.min(255, Math.round(((n >> 16) & 255) * f)); const g = Math.min(255, Math.round(((n >> 8) & 255) * f)); const b = Math.min(255, Math.round((n & 255) * f)); return `rgb(${r},${g},${b})`; }

  function starPath(cx, cy, outer, inner, points) { ctx.beginPath(); for (let i=0;i<points*2;i++){ const a=-Math.PI/2+i*Math.PI/points; const r=i%2?inner:outer; const x=cx+Math.cos(a)*r, y=cy+Math.sin(a)*r; i?ctx.lineTo(x,y):ctx.moveTo(x,y); } ctx.closePath(); }

  addEventListener('resize', resize);
  addEventListener('keydown', e => {
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
    keys.add(e.code);
    if (e.code === 'F1') { e.preventDefault(); fpsShow = !fpsShow; }
    if ((e.code === 'Escape' || e.code === 'KeyP') && state === 'playing') togglePause();
    if (e.code === 'KeyX' && !e.repeat) useSpecial();
    if (e.code === 'Enter' && state === 'menu') showOpening();
    else if (e.code === 'Enter' && state === 'opening') resetGame();
    else if (e.code === 'Enter' && state === 'over') resetGame();
    // Hidden debug keys: Shift+N skips a stage, Shift+M summons its mid boss, Shift+B summons its boss.
    if (e.shiftKey && e.code === 'KeyN' && state === 'playing' && !paused) {
      enemies = []; enemyBullets = []; bullets = [];
      bossState = stageIndex === stages.length - 1 ? 'final' : 'transition';
      stageTransition = 2.4;
      stageResult = { kills: stageKills, time: elapsed - stageStart, noDamageBonus: stageDamaged ? 0 : 5000, timeBonus: 0 };
    }
    if (e.shiftKey && e.code === 'KeyM' && state === 'playing' && !paused && bossState === 'waiting' && !midBossDone) {
      stageTime = (difficulties[difficultyKey].bossTime + stageIndex * 3) * .38;
    }
    if (e.shiftKey && e.code === 'KeyB' && state === 'playing' && !paused && (bossState === 'waiting' || bossState === 'midboss-active')) {
      midBossDone = true; enemies = enemies.filter(en => en.type !== 'midboss'); bossState = 'waiting'; stageTime = 9999;
    }
  });
  addEventListener('keyup', e => keys.delete(e.code));
  canvas.addEventListener('pointerdown', e => { if (state !== 'playing') return; pointer.active = true; const p = screenToWorld(e.clientX, e.clientY); pointer.x=p.x; pointer.y=p.y; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => { if (!pointer.active) return; const p=screenToWorld(e.clientX,e.clientY); pointer.x=p.x; pointer.y=p.y; });
  canvas.addEventListener('pointerup', () => pointer.active = false);
  canvas.addEventListener('pointercancel', () => pointer.active = false);
  startButton.addEventListener('click', showOpening);
  launchButton.addEventListener('click', resetGame);
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
    if (soundOn) {
      ensureAudio();
      playBgm(desiredBgmKey());
      sfx('power');
    } else { pauseBgm(); pauseSampledSfx(); }
  });
  pauseButton.addEventListener('click', togglePause);
  specialButton.addEventListener('click', useSpecial);
  resumeButton.addEventListener('click', () => setPaused(false));
  addEventListener('gamepadconnected', event => {
    controllerStatus.textContent = `🎮 ${event.gamepad.id.includes('Xbox') ? 'XBOX' : 'CONTROLLER'} READY`;
    controllerStatus.classList.add('is-visible');
    setTimeout(() => controllerStatus.classList.remove('is-visible'), 2400);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') setPaused(true); });

  // Read-only state snapshot for automated testing (see also Shift+N / Shift+B).
  Object.defineProperty(window, 'GRO_DEBUG', { get: () => ({ state, bossState, stageIndex, health, special, score, totalKills, enemies: enemies.length, playerBullets: bullets.length, enemyBullets: enemyBullets.length, grounded: player.grounded, playerY: player.y, firing: keys.has('Space') || keys.has('KeyZ') || pointer.active || padInput.fire, walkFrames: walkFrames.length }) });

  resize(); initBackdrop(); setupStage(); requestAnimationFrame(frame);
})();

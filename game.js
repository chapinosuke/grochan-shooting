(() => {
  'use strict';

  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  const gameShell = document.querySelector('.game-shell');
  const gameOverBlackout = document.querySelector('#gameOverBlackout');
  const titleScreen = document.querySelector('#titleScreen');
  const startScreen = document.querySelector('#startScreen');
  const openingScreen = document.querySelector('#openingScreen');
  const endingScreen = document.querySelector('#endingScreen');
  const endingButton = document.querySelector('#endingButton');
  const staffRollScreen = document.querySelector('#staffRollScreen');
  const staffRollTrack = document.querySelector('#staffRollTrack');
  const staffRollFin = document.querySelector('#staffRollFin');
  const storyScreen = document.querySelector('#storyScreen');
  const storyImage = document.querySelector('#storyImage');
  const storyText = document.querySelector('#storyText');
  const gameOverScreen = document.querySelector('#gameOverScreen');
  const pauseLabel = document.querySelector('#pauseLabel');
  const startButton = document.querySelector('#startButton');
  const shopScreen = document.querySelector('#shopScreen');
  const shopMoney = document.querySelector('#shopMoney');
  const shopNext = document.querySelector('#shopNext');
  const nextStageButton = document.querySelector('#nextStageButton');
  const launchButton = document.querySelector('#launchButton');
  const retryButton = document.querySelector('#retryButton');
  const titleButton = document.querySelector('#titleButton');
  const pauseTitleButton = document.querySelector('#pauseTitleButton');
  const finalScore = document.querySelector('#finalScore');
  const newRecord = document.querySelector('#newRecord');
  const resultTitle = document.querySelector('#resultTitle');
  const menuHighScore = document.querySelector('#menuHighScore');
  // Secret soundtrack page: the links exist in the DOM but stay hidden until
  // the hard-clear flag is set. The page itself is meta-noindexed and the
  // anchors carry rel="nofollow"; robots.txt deliberately does NOT name the
  // path (a Disallow line would advertise it and stop the noindex being read).
  // The result-screen link only shows on a clear -- a GAME OVER result is no
  // place to advertise it; the title link stays available for repeat visits.
  const titleSoundtrackLink = document.querySelector('#titleSoundtrackLink');
  const resultSoundtrackLink = document.querySelector('#resultSoundtrackLink');
  function refreshSoundtrackLinks(cleared = false) {
    const unlocked = !!localStorage.getItem('grochan-hard-clear');
    titleSoundtrackLink?.classList.toggle('is-hidden', !unlocked);
    resultSoundtrackLink?.classList.toggle('is-hidden', !(unlocked && cleared));
  }
  refreshSoundtrackLinks();
  const soundButton = document.querySelector('#soundButton');
  const pauseButton = document.querySelector('#pauseButton');
  const specialButton = document.querySelector('#specialButton');
  const bombButton = document.querySelector('#bombButton');
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
  const hurtSheet = new Image();   // 4-frame damage/hurt animation (holds the gun)
  const groundSheet = new Image(); // 5 ground frames holding the gun: idle + walk×4
  spriteSheet.src = 'assets/images/player-spritesheet.webp?v=hq';
  // opening/stage0 share one Audio element so the title theme flows seamlessly
  // into stage 1 instead of restarting from the top when the run begins.
  const neonArcadeRush = new Audio('assets/bgm/Neon Arcade Rush.mp3');
  const bgmTracks = {
    title: new Audio('assets/bgm/Neon Pink Dreams.mp3'),
    opening: neonArcadeRush,
    stage0: neonArcadeRush,
    stage1: new Audio('assets/bgm/Neon Arena.mp3'),
    stage2: new Audio('assets/bgm/Neon Arena (1).mp3'),
    stage3: new Audio('assets/bgm/Neon Demoness.mp3'),
    stage4: new Audio('assets/bgm/Neon Bullet Heaven.mp3'),
    midBoss: new Audio('assets/bgm/The Crimson Labyrinth.mp3'),
    bossBattle: new Audio('assets/bgm/Neon Bullet Heaven.mp3'),
    finalBoss: new Audio('assets/bgm/Red Planet Showdown.mp3'),
    gameOver: new Audio('assets/bgm/Game Over, Again.mp3'),
    ending: new Audio('assets/bgm/静かに睨め.mp3')
  };
  const bgmVolumes = { title: .3, opening: .22, stage0: .27, stage1: .27, stage2: .27, stage3: .27, stage4: .27, midBoss: .3, bossBattle: .3, finalBoss: .32, gameOver: .28, ending: .3 };
  // The ending theme plays through once and stops (the staff roll holds on
  // FIN afterward instead of looping the credits), unlike every other track.
  Object.entries(bgmTracks).forEach(([key, track]) => { track.loop = key !== 'ending'; track.preload = 'auto'; track.volume = bgmVolumes[key]; });
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
    hurt: { src: 'assets/sfx/heavy-hit.mp3', volume: .28, pool: 2, max: 1.25 },
    // Weighty boss-battle layer (効果音ラボ「戦闘」, free / commercial OK / no credit):
    // a beast roar + ground tremor on entrance, a super-arts impact on phase 2,
    // a building collapse on defeat.
    bossRoar: { src: 'assets/sfx/boss-roar.mp3', volume: .42, pool: 1, max: 2.6 },
    bossQuake: { src: 'assets/sfx/boss-quake.mp3', volume: .34, pool: 1, max: 3.5 },
    bossSuperHit: { src: 'assets/sfx/boss-superhit.mp3', volume: .4, pool: 2, max: 1.1 },
    bossCollapse: { src: 'assets/sfx/boss-collapse.mp3', volume: .46, pool: 1, max: 3.5 },
    // 効果音ラボ「連続打ち上げ花火」 — the six-second royal finale bed.
    fireworks: { src: 'assets/sfx/fireworks-finale.mp3', volume: .42, pool: 1, max: 6.5 }
  };
  const sfxPools = {};
  Object.entries(sampledSfx).forEach(([key, def]) => {
    sfxPools[key] = { cursor: 0, voices: Array.from({ length: def.pool }, () => {
      const voice = new Audio(def.src); voice.preload = 'auto'; voice.volume = def.volume; return voice;
    }) };
  });

  // Gro-chan's voice (効果音ラボ「真面目な女剣士」, free / commercial OK / no credit required).
  // One line at a time — a new line cuts off the previous so they never overlap.
  const VOICE_VOL = .74;
  const voiceLines = {
    start: ['swordwoman-start1'],       // 「覚悟しなさい！」launch
    bossAppear: ['swordwoman-start2'],  // 「負けられないわ！」boss warning
    special: ['swordwoman-special1'], // 「はあーっ！」
    heal: ['swordwoman-start2'],      // 「負けられないわ！」回復して立て直し
    hurt: ['swordwoman-damage1', 'swordwoman-damage2'],      // 「きゃっ！」「いやっ！」
    clear: ['swordwoman-win1'],         // 「先を急ぎましょう」stage clear
    gameover: ['swordwoman-death1']     // 「きゃああーー！」game over
  };
  const voiceClips = {};
  [...new Set(Object.values(voiceLines).flat())].forEach(name => {
    const a = new Audio(`assets/voice/${name}.mp3`); a.preload = 'auto'; a.volume = VOICE_VOL; voiceClips[name] = a;
  });
  let currentVoice = null;
  function voice(event) {
    if (!soundOn) return;
    const list = voiceLines[event]; if (!list || !list.length) return;
    const clip = voiceClips[list[Math.floor(Math.random() * list.length)]];
    if (!clip) return;
    if (currentVoice && currentVoice !== clip) { currentVoice.pause(); currentVoice.currentTime = 0; }
    currentVoice = clip;
    try { clip.currentTime = 0; clip.volume = VOICE_VOL; clip.play().catch(() => {}); } catch (_) { /* optional */ }
  }

  // Per-boss villain voices (効果音ラボ「ゲームキャラクターボイス」, free / commercial OK /
  // no credit). The free roster is small, so each stage boss gets a distinct
  // source character *plus* a playbackRate tint — five villains from five voices.
  // Boss lines ride their own channel so a taunt never cuts Gro-chan's voice.
  const BOSS_VOICE_VOL = .8;
  const bossVoiceCfg = [
    { char: 'thief-boy', rate: 1.05 },            // st1 MASQUERADE 仮面の道化
    { char: 'witch', rate: 0.82 },                // st2 ABYSS SIREN 深海の人魚
    { char: 'necromancer-oldwoman', rate: 0.88 }, // st3 INFERNO DJINN 炎上魔人
    { char: 'wizard', rate: 0.85 },               // st4 BOT GENERAL ロボ将軍
    { char: 'witch', rate: 1.0 }                  // st5 QUEEN 女王
  ];
  // event -> candidate line files. Only files every character actually has are
  // listed (necromancer lacks attack3), so nothing ever 404s.
  const bossVoiceLines = {
    appear: ['greeting1', 'start1'],
    serious: ['start2', 'special2'], // phase 2 (<=50% HP)
    attack: ['attack1', 'attack2', 'special1'],
    hurt: ['damage1', 'damage2'],
    death: ['death1', 'lose1']
  };
  const bossVoiceClips = {};
  bossVoiceCfg.forEach(cfg => {
    [...new Set(Object.values(bossVoiceLines).flat())].forEach(line => {
      const key = `${cfg.char}-${line}`;
      const a = new Audio(`assets/voice/boss/${key}.mp3`); a.preload = 'auto'; a.volume = BOSS_VOICE_VOL;
      bossVoiceClips[key] = a;
    });
  });
  let bossCurrentVoice = null;
  let bossVoiceCd = 0; // throttles chatty events (attacks) so taunts stay punchy
  function bossVoice(stageIdx, event, { throttle = 0 } = {}) {
    if (!soundOn) return;
    const cfg = bossVoiceCfg[stageIdx]; if (!cfg) return;
    if (throttle) { if (bossVoiceCd > 0) return; bossVoiceCd = throttle; }
    const list = bossVoiceLines[event]; if (!list || !list.length) return;
    const clip = bossVoiceClips[`${cfg.char}-${list[Math.floor(Math.random() * list.length)]}`];
    if (!clip) return;
    if (bossCurrentVoice && bossCurrentVoice !== clip) { bossCurrentVoice.pause(); bossCurrentVoice.currentTime = 0; }
    bossCurrentVoice = clip;
    try { clip.currentTime = 0; clip.volume = BOSS_VOICE_VOL; clip.playbackRate = cfg.rate; clip.play().catch(() => {}); } catch (_) { /* optional */ }
  }

  let spriteFrames = [];
  let walkFrames = [];
  let hurtFrames = [];
  let groundFrames = []; // [0]=idle(gun), [1..4]=walk(gun)
  let idleFrame = null;
  let jumpFrame = null;
  let state = 'menu';
  let menuStep = 'title';   // 'title' -> 'howto' -> showOpening()
  let paused = false;
  let lastTime = 0;
  let score = 0;
  // New storage key: old 'grochan-highscore' records predate the 1/10 yen
  // rescale and would be unbeatable, so the best-money record starts fresh.
  let highScore = Number(localStorage.getItem('grochan-money-best') || 0);
  let combo = 0;
  let comboTimer = 0;
  let health = 100;
  let maxHealth = 100;      // raised by the shop's vitamin; reset per run
  let vitaminsBought = 0;
  let elapsed = 0;
  let spawnTimer = 0;
  let pickupTimer = 0;
  let shake = 0;
  let flash = 0;
  let hitStop = 0;
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
  let soundOn = false;
  let currentBgmKey = null;
  let bgmFadeToken = 0;
  let openingTimeout = 0;
  let resultTimeout = 0;
  let totalKills = 0;
  let stageKills = 0;
  let stageStart = 0;
  let stageDamaged = false;
  let stageResult = null;
  let lightning = 0;
  let lightningX = 0;
  let special = 35;
  let specialFlash = 0;
  let continuesLeft = 3;
  let continueBanner = 0;
  let powerDownBanner = 0;
  let bombStock = 0;
  let charmStock = 0;
  let charmFlash = 0;
  let testMaxLoadout = false; // localhost ?max=1: lock combat-check resources at full
  let ammo = 170;        // main-gun magazine: one round per volley, pea-shot fallback at 0
  let ammoMax = 170;
  let ammoBanner = 0;    // "弾切れ!" rising tag timer, armed on the shot that empties the gun
  let lifeDropsSpawned = 0;  // per-run cap on the rare max-HP capsule drop
  // Full-reload packs: bought in the shop, auto-spent the instant the mag runs
  // dry. START is the opening cushion handed out by resetGame(); MAX caps both
  // the shop and the debug grant, so the two never drift apart.
  const AMMO_PACK_START = 3, AMMO_PACK_MAX = 5;
  // Bikini costume: a one-off shop purchase that only takes effect from stage 2
  // (it is sold in the stage-1 rest stop, so it is always "next stage onward").
  // While worn it trickles HP and ammo back, which is the whole reason to buy it.
  let bikiniOwned = false;
  let bikiniRegenHp = 0, bikiniRegenAmmo = 0;   // fractional carry, applied at 1.0
  const BIKINI_HP_PER_SEC = 0.9, BIKINI_AMMO_PER_SEC = 2.2;
  const bikiniOn = () => bikiniOwned && stageIndex >= 1;
  let ammoPackStock = AMMO_PACK_START;  // stocked full-reload packs, auto-used when the mag hits empty
  let reloadFlash = 0;    // "スペアマガジン!" rising tag timer, armed when a spare auto-fires
  let bossCrit = 0;      // 0..1 fade of the palace's blood-red sky in the queen's last act
  let bgCam = 0;
  let bgCamX = 0;        // horizontal camera yaw, eased from player.x (parallax)
  let bokeh = [];        // front-of-camera defocused light orbs
  let shoppers = [];     // pedestrians walking the shopping street (neon stage)
  let formationTimer = 3;
  let blockWallTimer = 0;  // personal cooldown for destructible wall spawns
  let fpsShow = false;   // F1 toggles a verification-only FPS readout
  let fpsAvg = 60;       // EMA of 1/rawDt
  const padInput = { x: 0, y: 0, fire: false, special: false, bomb: false };
  const motionBuf = [];   // recent 8-way input directions (numpad encoding) for command moves
  let lastMotionDir = 5;
  let wasFiring = false;  // previous-frame fire state → rising-edge detection
  let padStartWasDown = false;
  let padActionWasDown = false;
  let padSpecialWasDown = false;
  let padBombWasDown = false;
  const difficulties = {
    // bulletSpeed scales how fast enemy shots travel; fireGap stretches the time between
    // volleys (>1 = fewer bullets, wider gaps). Easy is tuned to be comfortably dodgeable.
    // The boss-pattern knobs: barrage scales bullet counts, gapW scales the width of the
    // safe corridor in px (beams use it inversely for thickness), telMul stretches every
    // telegraph, hazardDmg scales beam damage. hard keeps gapW at .85 rather than .8 so
    // the corridor stays wider than the player's 148px-tall grounded hitbox.
    easy: { spawn: 1.08, speed: .8, damage: .55, timeScale: 1.06, bossHp: 480, score: .8, midHp: 170, bulletSpeed: .68, fireGap: 2.2, barrage: .72, gapW: 1.5, telMul: 1.3, hazardDmg: .6, ammo: 220 },
    normal: { spawn: .72, speed: 1.05, damage: 1.05, timeScale: 1, bossHp: 900, score: 1, midHp: 320, bulletSpeed: 1, fireGap: 1, barrage: 1, gapW: 1, telMul: 1, hazardDmg: 1, ammo: 170 },
    hard: { spawn: .55, speed: 1.28, damage: 1.35, timeScale: .92, bossHp: 1300, score: 1.45, midHp: 460, bulletSpeed: 1.08, fireGap: .9, barrage: 1.28, gapW: .85, telMul: .92, hazardDmg: 1.15, ammo: 140 }
  };
  // Stage 1 doubles as the tutorial: the player is still learning the controls,
  // hasn't seen the shop yet and starts at power 1. The easing here is aimed
  // strictly at ROUTE CROWDING — how many small fry are on screen at once and
  // how fast they keep coming. Boss and mid-boss stats are deliberately NOT
  // touched: stage 1's bosses hit exactly as hard as on every other stage.
  const STAGE1_EASE = {
    cap: 3,           // fewer simultaneous enemies on screen (assault/formation)
    spawnGap: 1.45,   // longer pauses between spawns, and rarer bonus spawns
    packSize: .6,     // smaller squads per formation / set-piece launch
    variant: .55,     // rarity multiplier for armored/elite upgrades
    fire: 1.25        // regular enemies wait longer between volleys
  };
  const isStage1 = () => stageIndex === 0;
  const stages = [
    {
      name: 'TOKYO MIDNIGHT', boss: 'MASQUERADE', midBoss: 'HEART BREAKER', theme: 'neon', subtitle: '渋谷スクランブル、眠らない東京の夜',
      sky: ['#120b3e', '#3b1878', '#f044a0'], far: '#28145e', city: '#100b34', accent: '#31e8ff', accent2: '#ff3e9d',
      spawnTable: [['crow', 5], ['alleycat', 3], ['neonmoth', 4], ['drone', 2], ['racer', 2]],
      melody: [440, 523.25, 659.25, 523.25, 392, 493.88, 587.33, 493.88, 349.23, 440, 523.25, 659.25, 392, 493.88, 659.25, 783.99],
      bass: [110, 110, 98, 98, 87.31, 87.31, 98, 123.47]
    },
    {
      name: 'AQUA HIGHWAY', boss: 'ABYSS SIREN', midBoss: 'DEEP BLUE DIVA', theme: 'aqua', subtitle: '潮風のハイウェイを駆け抜けろ',
      sky: ['#041b3d', '#075987', '#20c5c9'], far: '#123c68', city: '#071d42', accent: '#65fff2', accent2: '#2f8cff',
      // Stage 2 fields real deep-sea fauna instead of the shared mecha roster:
      // dumbo octopus, humpback anglerfish, oarfish and a giant moray, with the
      // jellyfish and manta that were already native here. One patrol racer is
      // left in so the highway still reads as a human route through their water.
      spawnTable: [['jelly', 4], ['manta', 4], ['dumbo', 5], ['angler', 3], ['oarfish', 3], ['moray', 2], ['racer', 2]],
      melody: [392, 440, 523.25, 587.33, 659.25, 587.33, 523.25, 440, 349.23, 392, 440, 523.25, 587.33, 523.25, 440, 392],
      bass: [98, 98, 87.31, 87.31, 110, 110, 87.31, 73.42]
    },
    {
      name: 'SUNSET FACTORY', boss: 'INFERNO DJINN', midBoss: 'BLAZE EMPRESS', theme: 'factory', subtitle: '燃える夕日と鋼鉄の罠',
      sky: ['#351036', '#a42f4f', '#ff9f43'], far: '#592141', city: '#28132e', accent: '#ffe15a', accent2: '#ff5a36',
      spawnTable: [['slagling', 5], ['rivetbeetle', 4], ['furnacehound', 3], ['turret', 2], ['walker', 2]],
      melody: [329.63, 329.63, 392, 329.63, 311.13, 329.63, 392, 440, 329.63, 329.63, 392, 493.88, 440, 392, 329.63, 293.66],
      bass: [82.41, 82.41, 82.41, 82.41, 77.78, 77.78, 98, 98]
    },
    {
      name: 'CYBER STORM', boss: 'BOT GENERAL', midBoss: 'VOLT PHANTOM', theme: 'storm', subtitle: '雷鳴とどろく電脳空域',
      sky: ['#071d24', '#13554b', '#48b849'], far: '#164636', city: '#071f25', accent: '#72ff68', accent2: '#31e8ff',
      spawnTable: [['cloudray', 5], ['voltbug', 4], ['packetwyrm', 3], ['glitch', 3], ['seeker', 2]],
      melody: [293.66, 349.23, 440, 349.23, 293.66, 369.99, 440, 587.33, 293.66, 349.23, 466.16, 440, 349.23, 293.66, 246.94, 293.66],
      bass: [73.42, 73.42, 87.31, 87.31, 73.42, 73.42, 92.5, 110]
    },
    {
      name: 'HEART PALACE', boss: 'QUEEN OF HEARTBREAK', midBoss: 'LORD CENSOR', theme: 'palace', subtitle: '決戦、ハートの女王の宮殿',
      sky: ['#25051d', '#72114e', '#d82065'], far: '#4d123d', city: '#21061d', accent: '#ffe15a', accent2: '#ff3e9d',
      spawnTable: [['rosebud', 5], ['cardguard', 4], ['teacup', 3], ['cupid', 3], ['knight', 2]],
      melody: [261.63, 311.13, 392, 523.25, 466.16, 392, 311.13, 261.63, 233.08, 293.66, 349.23, 466.16, 392, 349.23, 293.66, 261.63],
      bass: [65.41, 65.41, 77.78, 77.78, 98, 98, 58.27, 65.41]
    }
  ];

  // Story cutscenes: each slide pairs one illustration with one caption. The
  // player clicks / ENTERs through them like an old JRPG visual scene.
  // interludes[i] plays after clearing stage i (none after the final stage —
  // the ending sequence takes over there).
  const STORY = {
    opening: [
      { img: 'assets/images/story/op1_academy_day.webp', text: 'ここは 花のAI学園。ぐろちゃん・ちゃっぴー・くろ子は、いつもいっしょの仲よし3人組。' },
      { img: 'assets/images/story/op2_heist_night.webp', text: 'ある夜、空にあやしい影が…。学園のみんなの「ハート」が、ひと晩でぬすまれてしまった！' },
      { img: 'assets/images/story/op3_sleeping_friends.webp', text: 'ハートをなくした くろ子もちゃっぴーも、目をさまさない…。' },
      { img: 'assets/images/story/op4_launch.webp', text: 'ハートをぬすんだ影は、まだ空にいる。ぐろちゃんはSpaceX製ユニットにとび乗った！「みんなのハート、ぜったい取りもどす！」' },
    ],
    interludes: [
      [{ img: 'assets/images/story/int1_shard1.webp', text: 'MASQUERADEを撃破！仮面の道化は、みんなのハートを「いいね」に変えて集めていた。残る反応は海の方へ！' }],
      [{ img: 'assets/images/story/int2_transmission.webp', text: 'ABYSS SIRENを退けると、深海に閉じこめられていたハートがいっせいに浮かび上がった。「……次は灼熱地帯。気をつけて……」くろ子の通信だ！' }],
      [{ img: 'assets/images/story/int3_resolve.webp', text: 'INFERNO DJINNを鎮火！怒りや悲しみをあおるほど、炎上魔人は大きくなっていた。「もう、だれの心も燃やさせない！」' }],
      [{ img: 'assets/images/story/int4_palace_reveal.webp', text: 'BOT GENERALの自動投稿軍団が停止。命令の発信元は、嵐の雲の上——ハートの宮殿。黒幕の女王が待っている！' }],
    ],
    ending: [
      { img: 'assets/images/story/ed1_queen_tears.webp', text: '仮面の下にいたのは、ひとりぼっちの小さなAIの子だった。ぐろちゃんは、自分のハートの光をそっと分けてあげた。' },
      { img: 'assets/images/story/ed2_hearts_return.webp', text: '夜空いっぱいに、ハートが流れ星になって帰っていく——' },
      { img: 'assets/images/story/ed3_morning.webp', text: 'くろ子もちゃっぴーも、ぱちりと目をさます。花のAI学園に、いつもの朝がきた！' },
    ],
    gameover: [
      { img: 'assets/images/story/go1_crash.webp', text: 'ぐろちゃん、不時着…！でもまだ終わりじゃない。もういちど、飛ぼう！' },
    ],
  };
  for (const slide of [...STORY.opening, ...STORY.ending, ...STORY.gameover, ...STORY.interludes.flat()]) new Image().src = slide.img;

  // Generated boss art: side views cut from the turnaround sheets, keyed to
  // transparency. Indexed by stage; the WARDEN mid-boss shares one design.
  const bossSprites = stages.map((_, i) => {
    const im = new Image();
    im.src = `assets/images/bosses/sprites/stage${i + 1}_side.webp`;
    return im;
  });
  const wardenSprite = new Image();
  wardenSprite.src = 'assets/images/bosses/sprites/warden_side.webp';
  const frameReady = (im) => im && im.complete && im.naturalWidth > 0;
  // Battle pose sets (transparent PNGs, facing left): arrays per pose so
  // multi-frame sets animate (idle sways between 2 frames, attacks cycle 3).
  // The user-made sheet bosses use {2,3,2}; the generated sets are single-frame.
  const loadSet = (base, counts) => {
    const load = (name) => { const im = new Image(); im.src = `assets/images/bosses/poses/${name}.webp`; return im; };
    const set = {};
    for (const pose of ['idle', 'attack', 'hurt']) {
      const n = counts[pose];
      set[pose] = n === 1 ? [load(`${base}_${pose}`)] : Array.from({ length: n }, (_, i) => load(`${base}_${pose}${i + 1}`));
    }
    return set;
  };
  const GEN_COUNTS = { idle: 1, attack: 1, hurt: 1 }, SHEET_COUNTS = { idle: 2, attack: 3, hurt: 2 };
  const FINAL_QUEEN_COUNTS = { idle: 4, attack: 4, hurt: 8 };
  // Stage bosses. SERVER GOLEM and the former stage5 set remain in assets as
  // held designs; replacing an active slot never deletes its source material.
  const bossSets = [
    loadSet('masquerade', SHEET_COUNTS),
    loadSet('abyss-siren', SHEET_COUNTS),
    loadSet('inferno-djinn', SHEET_COUNTS),
    loadSet('bot-general', SHEET_COUNTS),
    loadSet('heartbreak-queen', FINAL_QUEEN_COUNTS),
  ];
  // Mid-bosses: the former stage bosses demoted, plus LORD CENSOR guarding the palace.
  const midSets = [
    loadSet('stage1', GEN_COUNTS),
    loadSet('stage2', GEN_COUNTS),
    loadSet('stage3', GEN_COUNTS),
    loadSet('stage4', GEN_COUNTS),
    loadSet('lord-censor', SHEET_COUNTS),
  ];
  // Two colours per boss: one for the moment a shot lands, one for the state it
  // enters once it is nearly dead. Both are deliberately foreign to the stage
  // palette so they read as damage rather than as more scenery.
  const BOSS_TINT = [
    { hit: '#9ff4ff', crit: '#ff3e9d' },  // MASQUERADE   pale scan -> magenta cracks
    { hit: '#f3d5ff', crit: '#b832ff' },  // ABYSS SIREN pearl flash -> abyss violet
    { hit: '#7ad7ff', crit: '#fff3bd' },  // INFERNO DJINN doused blue -> white heat
    { hit: '#ff4d4d', crit: '#72ff68' },  // BOT GENERAL   error red -> glitch green
    { hit: '#fff1a8', crit: '#8f35d9' },  // QUEEN         royal gold -> abyss violet
  ];
  // Sprites are re-drawn through their own alpha into an offscreen canvas, so a
  // flat colour lands on the character and never on a bounding box. ctx.filter
  // is avoided — it appears nowhere else in this file. At most 7 frames per boss
  // times two colours, so the cache stays tiny.
  const tintCache = new Map();
  function tintSprite(img, color) {
    const key = img.src + '|' + color;
    let c = tintCache.get(key);
    if (!c) {
      c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
      tintCache.set(key, c);
    }
    return c;
  }
  // hurt wins over attack; attack shows through the telegraph windup too.
  const readyFrames = (arr) => arr.filter(frameReady);
  const pickPoseFrame = (set, e) => {
    if (e.hurtT > 0) {
      const f = readyFrames(set.hurt);
      if (f.length) {
        const duration = e.hurtPoseDuration || .4;
        const progress = clamp(1 - e.hurtT / duration, 0, .999);
        return f[Math.floor(progress * f.length)];
      }
    }
    // Only the tail of a windup shows the attack pose — long telegraphs would
    // otherwise leave the boss frozen mid-swing for over a second.
    if (e.attackT > 0 || (e.tel > 0 && e.tel < .55)) {
      const f = readyFrames(set.attack);
      if (f.length) return f[(e.attackIdx || 0) % f.length];
    }
    const f = readyFrames(set.idle);
    return f.length ? f[Math.floor(e.t * 2) % f.length] : null;
  };
  // Shared per-frame pose bookkeeping for bosses and mid-bosses: tick down the
  // pose timers and turn a fresh hit flash (e.hit set by the bullet collision)
  // into a short pained reaction with a cooldown so constant fire doesn't
  // freeze the boss in the hurt pose.
  function stepPoseTimers(e, dt) {
    e.attackT = Math.max(0, (e.attackT || 0) - dt);
    e.hurtT = Math.max(0, (e.hurtT || 0) - dt);
    e.hurtCd = Math.max(0, (e.hurtCd || 0) - dt);
    if (e.hit > .09 && e.hurtCd <= 0) {
      // The final queen's second sheet is an eight-pose dramatic damage
      // sequence. At the shared .4s duration each pose survived for only
      // ~3 frames and looked as if the sheet was not being used. Give every
      // cell a readable beat while leaving the shorter sets unchanged.
      e.hurtPoseDuration = e.type === 'boss' && stageIndex === 4 ? 1.2 : .4;
      e.hurtT = e.hurtPoseDuration;
      e.hurtCd = e.type === 'boss' && stageIndex === 4 ? 1.7 : 1.3;
      if (e.type === 'boss' && Math.random() < .35) bossVoice(stageIndex, 'hurt', { throttle: 3 });
    }
    // rotate through the attack frames: each newly-triggered attack (the
    // timer jumping up) advances to the next pose in the set
    if ((e.attackT || 0) > (e.prevAttackT || 0)) e.attackIdx = ((e.attackIdx || 0) + 1) % 3;
    e.prevAttackT = e.attackT || 0;
  }

  // ABYSS SIREN's sheet depicts a specific move in every attack frame. Pin the
  // frame instead of cycling it so the on-screen motion always matches the art.
  function setBossAttackPose(e, frame, duration = .58) {
    e.attackIdx = frame;
    e.attackT = duration;
    e.prevAttackT = duration;
  }

  let storySlides = null, storyStep = 0, storyDone = null;
  let storyTyping = null, storyFullText = '', storyTypeDelay = 55;
  function showStory(slides, done, opts = {}) {
    if (!slides || !slides.length) { if (done) done(); return; }
    storySlides = slides; storyStep = -1; storyDone = done;
    storyTypeDelay = opts.typeDelay || 55;
    storyScreen.classList.add('is-visible');
    advanceStory();
  }
  // Captions type out one character at a time like an old JRPG text box; the
  // first click completes the line instantly, the next one turns the page.
  // The full line is always present (hidden) so the caption box keeps its
  // final size from the start — only the characters are revealed one by one.
  function renderTyped(shown) {
    storyText.textContent = '';
    const typed = document.createElement('span');
    typed.textContent = storyFullText.slice(0, shown);
    const rest = document.createElement('span');
    rest.className = 'story-untyped';
    rest.textContent = storyFullText.slice(shown);
    storyText.append(typed, rest);
  }
  function typeSlide(text) {
    clearInterval(storyTyping);
    storyFullText = text;
    storyScreen.classList.add('is-typing');
    renderTyped(0);
    let shown = 0;
    storyTyping = setInterval(() => {
      shown++;
      renderTyped(shown);
      if (shown >= text.length) finishTyping();
    }, storyTypeDelay);
  }
  function finishTyping() {
    clearInterval(storyTyping); storyTyping = null;
    storyText.textContent = storyFullText;
    storyScreen.classList.remove('is-typing');
  }
  function advanceStory() {
    if (!storySlides) return;
    if (storyTyping) { finishTyping(); return; }
    storyStep++;
    if (storyStep >= storySlides.length) {
      const done = storyDone;
      storySlides = null; storyDone = null;
      storyScreen.classList.remove('is-visible');
      if (done) done();
      return;
    }
    storyImage.src = storySlides[storyStep].img;
    typeSlide(storySlides[storyStep].text);
    if (storyStep > 0) sfx('power');
  }
  function cancelStory() {
    clearInterval(storyTyping); storyTyping = null;
    storySlides = null; storyDone = null;
    storyScreen.classList.remove('is-visible', 'is-typing');
  }

  // Scripted stage timeline. Normal difficulty budgets 136s for the route;
  // warnings + mid-boss + main boss bring a typical clear to about 3m30s.
  // Durations are scaled by difficulties[..].timeScale so harder boss HP is
  // offset by a slightly tighter route and easy mode gets more breathing room.
  const PHASE_TEMPLATE = [
    { id: 'opening', dur: 12, mode: 'trickle', intensity: .25 },
    { id: 'buildup', dur: 18, mode: 'assault', intensity: .5 },
    { id: 'formationA', dur: 15, mode: 'formation', intensity: .6 },
    { id: 'breather1', dur: 5, mode: 'calm', intensity: .15 },
    { id: 'midboss', dur: 0, mode: 'midboss' },
    { id: 'recover', dur: 7, mode: 'calm', intensity: .2 },
    { id: 'assault2', dur: 21, mode: 'assault', intensity: .7 },
    { id: 'setpiece', dur: 16, mode: 'setpiece', intensity: .75 },
    { id: 'breather2', dur: 5, mode: 'calm', intensity: .2 },
    { id: 'eliteRush', dur: 20, mode: 'formation', intensity: .9, elite: true },
    { id: 'finalPush', dur: 17, mode: 'assault', intensity: 1 }
  ];
  const SETPIECE_TIMES = [0, 3.5, 7, 10.5, 14];
  function timeScale() { return difficulties[difficultyKey].timeScale; }
  function timelineTotal() {
    let t = 0;
    for (const p of PHASE_TEMPLATE) t += p.dur;
    return t * timeScale();
  }
  function midbossStart() {
    let t = 0;
    for (const p of PHASE_TEMPLATE) { if (p.mode === 'midboss') break; t += p.dur; }
    return t * timeScale();
  }
  // Stateless lookup so the Shift+M/Shift+B debug jumps stay consistent.
  function currentPhase(t) {
    const s = timeScale();
    let acc = 0;
    for (const p of PHASE_TEMPLATE) {
      const d = p.dur * s;
      if (t < acc + d) return { phase: p, tIn: t - acc };
      acc += d;
    }
    const last = PHASE_TEMPLATE[PHASE_TEMPLATE.length - 1];
    return { phase: last, tIn: t - (acc - last.dur * s) };
  }
  let activePhase = PHASE_TEMPLATE[0];
  let activeTIn = 0;
  let lastPhaseId = '';
  let setpieceStep = 0;

  const GROUND_Y = 500;
  const CHIMNEYS = [[120, 60, 210], [196, 44, 160], [880, 70, 230], [1010, 50, 180], [430, 40, 140]];
  // Aqua stage's rare giant fish breach: shared by updateAmbient (splash timing)
  // and drawBigFish (the arc itself), so the two stay in sync. SCALE blows the
  // ~1000px base body up further (bigger than the screen is wide at the apex);
  // DUR is short relative to that size so the leap snaps rather than floats.
  const BIGFISH_DUR = 2.5, BIGFISH_TRAVEL = 760, BIGFISH_ARC = 340, BIGFISH_SCALE = 1.45;
  const REFINERY_TANKS = [[240, 46, 250], [730, 38, 210], [1080, 52, 268]];
  const player = { x: 170, y: 360, w: 118, h: 102, vx: 0, vy: 0, fire: 0, missileFire: 0, inv: 0, hit: 0, frame: 0, walkPhase: 0, walkStep: 0, grounded: false, power: 1, spread: 1, speed: 1, takeoff: 0, facing: 1 };
  let bullets = [];
  let enemyBullets = [];
  let enemies = [];
  let particles = [];
  let pickups = [];
  let stars = [];
  let clouds = [];
  let ambient = [];
  let bgProps = [];
  let aquaRings = [];    // expanding surface ripples left by the big fish (cosmetic)
  let boltGhosts = [];   // fading after-images of recent lightning strikes (cosmetic)
  let palaceBossMix = 0; // eased 0..1: palace shifts to battle lighting while the queen is on stage
  let nearProps = [];
  let lifeAgents = [];   // background inhabitants (birds, fish, drones, courtiers...)
  let motes = [];        // depth-layered airborne particulate (the weather pass)
  let sceneLayersOn = true;  // debug toggle (window.__bgLayers) for A/B-ing the new passes
  let delayedBursts = [];
  let shockwaves = [];
  // Wide-area boss attacks (beams and rect fields) live here rather than in
  // enemyBullets: they need a swept-segment test, not a circle one.
  let hazards = [];
  // Every site that wipes enemy fire must wipe both lists — a missed one leaves
  // an invisible beam still hitting the player after the stage has moved on.
  function clearEnemyFire() { enemyBullets = []; hazards = []; }

  menuHighScore.textContent = yen(highScore);

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
    // HQ sheet 1672x941: idle + walk×4 (top), jump + flying-shoot×4 (bottom).
    // Only jump / flight / title-idle come from here; grounded idle+walk use the gun
    // frames in player-ground.webp (buildGroundFrames), so the sheet's walk row is unused.
    spriteFrames = [
      makeFrame(371, 533, 248, 305),
      makeFrame(673, 533, 248, 305),
      makeFrame(971, 533, 248, 305),
      makeFrame(1264, 533, 248, 305)
    ];
    idleFrame = makeFrame(104, 90, 190, 327);
    jumpFrame = makeFrame(72, 530, 250, 325);
  }
  spriteSheet.onload = buildPlayerFrames;
  if (spriteSheet.complete) buildPlayerFrames();

  // Slice an N-cell horizontal strip (uniform, bottom-aligned) into per-frame canvases.
  function sliceStrip(img, n) {
    const cw = img.naturalWidth / n, ch = img.naturalHeight, frames = [];
    for (let i = 0; i < n; i++) {
      const c = document.createElement('canvas');
      c.width = cw; c.height = ch;
      c.getContext('2d').drawImage(img, i * cw, 0, cw, ch, 0, 0, cw, ch);
      frames.push(c);
    }
    return frames;
  }
  // Damage: 4 uniform 298x308 cells. Ground: 5 cells (idle + walk×4), same geometry.
  function buildHurtFrames() { if (hurtSheet.naturalWidth) hurtFrames = sliceStrip(hurtSheet, 4); }
  function buildGroundFrames() {
    if (!groundSheet.naturalWidth) return;
    groundFrames = sliceStrip(groundSheet, 5);
    walkFrames = groundFrames.slice(1);
  }
  hurtSheet.onload = buildHurtFrames;
  hurtSheet.src = 'assets/images/player-hurt.webp?v=1';
  if (hurtSheet.complete) buildHurtFrames();
  groundSheet.onload = buildGroundFrames;
  groundSheet.src = 'assets/images/player-ground.webp?v=1';
  if (groundSheet.complete) buildGroundFrames();

  // --- Bikini costume (shop unlock) --------------------------------------
  // The bikini art was authored with different padding and cell aspect than the
  // originals (its walk cell is 434x725 against the original 298x308), so the
  // sheets are NOT drop-in. Each cell is trimmed to its actual artwork and
  // re-drawn into a cell of the original's aspect — bottom-anchored, centred —
  // so drawPlayer's fixed draw sizes keep working untouched for both costumes.
  //
  // The union box across a strip (not a per-frame box) is what gets normalised:
  // per-frame trimming would re-centre every cell and make a walk cycle jitter.
  function alphaBox(ctx2, x, y, w, h) {
    const d = ctx2.getImageData(x, y, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        if (d[(py * w + px) * 4 + 3] > 16) {
          if (px < x0) x0 = px; if (px > x1) x1 = px;
          if (py < y0) y0 = py; if (py > y1) y1 = py;
        }
      }
    }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }

  // Slice `img` into `n` equal cells, then refit them into `aspect`-shaped
  // frames of `outH` px tall. Returns an array of canvases.
  function refitStrip(img, n, aspect, outH = 320) {
    const cw = img.naturalWidth / n, ch = img.naturalHeight;
    const probe = document.createElement('canvas');
    probe.width = Math.ceil(cw); probe.height = ch;
    const pctx = probe.getContext('2d', { willReadFrequently: true });
    const boxes = [];
    for (let i = 0; i < n; i++) {
      pctx.clearRect(0, 0, probe.width, probe.height);
      pctx.drawImage(img, i * cw, 0, cw, ch, 0, 0, cw, ch);
      boxes.push(alphaBox(pctx, 0, 0, probe.width, ch));
    }
    const live = boxes.filter(Boolean);
    if (!live.length) return [];
    // Union box: shared crop window, so relative motion between frames survives.
    const ux0 = Math.min(...live.map(b => b.x)), uy0 = Math.min(...live.map(b => b.y));
    const ux1 = Math.max(...live.map(b => b.x + b.w)), uy1 = Math.max(...live.map(b => b.y + b.h));
    const uw = ux1 - ux0, uh = uy1 - uy0;
    const outW = Math.round(outH * aspect);
    // Fit the union box inside the target cell, bottom-anchored and centred.
    const scale = Math.min(outW / uw, outH / uh);
    const dw = uw * scale, dh = uh * scale;
    const dx = (outW - dw) / 2, dy = outH - dh;
    const frames = [];
    for (let i = 0; i < n; i++) {
      const c = document.createElement('canvas');
      c.width = outW; c.height = outH;
      c.getContext('2d').drawImage(img, i * cw + ux0, uy0, uw, uh, dx, dy, dw, dh);
      frames.push(c);
    }
    return frames;
  }

  // Fit one explicit box into a cell of `aspect`. The box is drawn AS GIVEN —
  // no re-trimming: BIKINI_SHEET_BOXES are already exact, and re-trimming would
  // re-centre each frame individually and make the flight cycle jitter.
  function refitBox(img, box, aspect, outH = 320) {
    const outW = Math.round(outH * aspect);
    const scale = Math.min(outW / box.w, outH / box.h);
    const dw = box.w * scale, dh = box.h * scale;
    const c = document.createElement('canvas');
    c.width = outW; c.height = outH;
    c.getContext('2d').drawImage(img, box.x, box.y, box.w, box.h,
      (outW - dw) / 2, outH - dh, dw, dh);
    return c;
  }

  // Frame boxes measured off the delivered sheet. Two things make this fiddly:
  // the muzzle-flash streak bridges the last two flight cells (so equal-width
  // slicing cannot separate them), and loose hair strands are only a few pixels
  // deep (so a "tall column" body scan clips them). These boxes were derived by
  // finding the bodies, then growing outward over the thin hair columns with a
  // 34px cap — enough for the hair, short of the ~110px flash.
  // The three flight cells share one y/h so the pose keeps its relative height
  // through the cycle; each is centred on its own body.
  const BIKINI_SHEET_BOXES = {
    idle: { x: 205, y: 60, w: 221, h: 375 },
    jump: { x: 190, y: 484, w: 249, h: 367 },
    fly: [{ x: 481, y: 508, w: 282, h: 334 }, { x: 797, y: 508, w: 282, h: 334 }, { x: 1119, y: 508, w: 282, h: 334 }]
  };
  let bikiniFly = [], bikiniGround = [], bikiniHurt = [];
  let bikiniIdle = null, bikiniJump = null;
  const bikiniSheet = new Image(), bikiniGroundSheet = new Image(), bikiniHurtSheet = new Image();
  function buildBikiniSheet() {
    if (!bikiniSheet.naturalWidth) return;
    bikiniIdle = refitBox(bikiniSheet, BIKINI_SHEET_BOXES.idle, 190 / 327);
    bikiniJump = refitBox(bikiniSheet, BIKINI_SHEET_BOXES.jump, 250 / 325);
    const fly = BIKINI_SHEET_BOXES.fly.map(bx => refitBox(bikiniSheet, bx, 248 / 305));
    // Only three flight cells were drawn; ping-pong them into the 4-frame cycle
    // the flight animation expects so it reads as a loop, not a stutter.
    bikiniFly = [fly[0], fly[1], fly[2], fly[1]];
  }
  function buildBikiniGround() {
    if (bikiniGroundSheet.naturalWidth) bikiniGround = refitStrip(bikiniGroundSheet, 5, 298 / 308);
  }
  function buildBikiniHurt() {
    if (bikiniHurtSheet.naturalWidth) bikiniHurt = refitStrip(bikiniHurtSheet, 4, 298 / 308);
  }
  bikiniSheet.onload = buildBikiniSheet; bikiniSheet.src = 'assets/images/player-bikini-sheet.webp?v=1';
  if (bikiniSheet.complete) buildBikiniSheet();
  bikiniGroundSheet.onload = buildBikiniGround; bikiniGroundSheet.src = 'assets/images/player-bikini-ground.webp?v=1';
  if (bikiniGroundSheet.complete) buildBikiniGround();
  bikiniHurtSheet.onload = buildBikiniHurt; bikiniHurtSheet.src = 'assets/images/player-bikini-hurt.webp?v=1';
  if (bikiniHurtSheet.complete) buildBikiniHurt();

  function resetGame() {
    clearTimeout(openingTimeout); openingTimeout = 0;
    clearTimeout(resultTimeout); resultTimeout = 0;
    bossCrit = 0; tintCache.clear();
    maxHealth = 100; vitaminsBought = 0;
    score = 0; combo = 0; comboTimer = 0; health = maxHealth; elapsed = 0;
    spawnTimer = .7; pickupTimer = 6; shake = 0; flash = 0; hitStop = 0; gameSpeed = 1;
    bossState = 'waiting'; bossWarning = 0; midBossDone = false;
    stageIndex = 0; stageTime = 0; stageBanner = 3; stageTransition = 0;
    musicClock = 0; musicStep = 0;
    totalKills = 0; stageResult = null; lightning = 0; palaceBossMix = 0; delayedBursts = [];
    special = 35; specialFlash = 0; formationTimer = 2.8;
    continuesLeft = 3; continueBanner = 0; powerDownBanner = 0;
    bombStock = 0; charmStock = 0; charmFlash = 0;
    ammo = ammoMax = difficulties[difficultyKey].ammo; ammoBanner = 0; lifeDropsSpawned = 0;
    // Starting kit: three full-reload packs. Running dry in the first stage
    // before the shop is ever reachable was the harshest part of the opening,
    // so the run begins stocked. Continues deliberately do NOT top this up —
    // it is an opening cushion, not a permanent safety net.
    ammoPackStock = AMMO_PACK_START; reloadFlash = 0;
    bikiniOwned = false; bikiniRegenHp = 0; bikiniRegenAmmo = 0;
    bullets = []; clearEnemyFire(); enemies = []; particles = []; pickups = []; shockwaves = [];
    setupStage();
    player.x = 160; player.y = VH / 2; player.vx = 0; player.vy = 0;
    player.fire = 0; player.missileFire = .8; player.inv = 1.2; player.hit = 0; player.frame = 0; player.walkPhase = 0; player.walkStep = 0; player.grounded = false; player.takeoff = 0; player.power = 1; player.spread = 1; player.speed = 1; player.facing = 1;
    state = 'playing'; paused = false;
    cancelStory();
    titleScreen.classList.remove('is-visible');
    startScreen.classList.remove('is-visible');
    openingScreen.classList.remove('is-visible');
    endingScreen.classList.remove('is-visible');
    gameOverScreen.classList.remove('is-visible');
    gameShell.classList.remove('is-game-over');
    gameOverBlackout.classList.remove('is-visible');
    shopScreen.classList.remove('is-visible');
    pauseLabel.classList.remove('is-visible');
    pauseButton.classList.add('is-visible');
    specialButton.classList.add('is-visible');
    bombButton.classList.add('is-visible');
    pauseButton.classList.remove('is-paused');
    pauseButton.textContent = '❚❚';
    updateSpecialButton();
    updateBombButton();
    lastTime = performance.now();
    ensureAudio();
    playBgm('stage0', true);
    voice('start');
  }

  // Menu flow: title (canvas logo + attract demo) -> how-to-play -> opening.
  function showHowto() {
    if (menuStep !== 'title') return;   // guard against repeat triggers (click + Enter)
    menuStep = 'howto';
    titleScreen.classList.remove('is-visible');
    startScreen.classList.add('is-visible');
    // First user gesture: start the title theme here. It carries through the
    // how-to and opening screens, then crossfades to the stage music on launch.
    ensureAudio(); playBgm('title'); sfx('power');
  }

  function showTitle() {
    menuStep = 'title';
    startScreen.classList.remove('is-visible');
    titleScreen.classList.add('is-visible');
  }

  // Bail out to the title screen, either from the pause menu (mid-run, so
  // confirm first since the run is lost) or from the result screen (run
  // already ended, nothing left to lose).
  function returnToTitle() {
    if (state === 'playing' && !confirm('タイトルに戻りますか？ここまでのプレイは失われます。')) return;
    clearTimeout(openingTimeout); openingTimeout = 0;
    clearTimeout(resultTimeout); resultTimeout = 0;
    cancelStory();
    state = 'menu'; paused = false;
    gameShell.classList.remove('is-game-over');
    gameOverBlackout.classList.remove('is-visible');
    shopScreen.classList.remove('is-visible');
    startScreen.classList.remove('is-visible');
    openingScreen.classList.remove('is-visible');
    endingScreen.classList.remove('is-visible');
    staffRollScreen.classList.remove('is-visible', 'is-rolling');
    gameOverScreen.classList.remove('is-visible');
    pauseLabel.classList.remove('is-visible');
    pauseButton.classList.remove('is-visible', 'is-paused');
    specialButton.classList.remove('is-visible', 'is-ready');
    bombButton.classList.remove('is-visible', 'is-ready');
    pauseButton.textContent = '❚❚';
    playBgm('title', true);
    showTitle();
  }

  function showOpening() {
    clearTimeout(openingTimeout);
    state = 'opening'; paused = false;
    titleScreen.classList.remove('is-visible');
    startScreen.classList.remove('is-visible'); gameOverScreen.classList.remove('is-visible');
    openingScreen.classList.remove('is-visible');
    pauseButton.classList.remove('is-visible'); specialButton.classList.remove('is-visible'); bombButton.classList.remove('is-visible');
    playBgm('title'); ensureAudio(); sfx('power');
    // Story slides first, then the mission-card screen with the LAUNCH button.
    // Stay on the opening until the player launches (button / ENTER / click) — no auto-advance.
    showStory(STORY.opening, () => {
      // Restart the CSS timeline even when the intro is replayed after returning to the menu.
      void openingScreen.offsetWidth;
      openingScreen.classList.add('is-visible');
    });
  }

  function playBgm(key, restart = false) {
    const next = bgmTracks[key];
    if (!next) return;
    const previousKey = currentBgmKey;
    const previous = previousKey && bgmTracks[previousKey];
    const targetVolume = bgmVolumes[key] ?? .27;
    // previous === next covers keys that share one Audio element (opening/stage0):
    // the track keeps playing seamlessly instead of fading against itself.
    if (previousKey === key || previous === next) {
      currentBgmKey = key;
      if (restart && previousKey === key) next.currentTime = 0;
      if (!soundOn) { next.volume = targetVolume; return; }
      // next.paused means this track isn't actually sounding yet — either a
      // genuine first start, or an autoplay block that only just got lifted
      // by a user gesture (e.g. the ?ending/?staffroll test modes, or a mute
      // toggle). Ease it in instead of snapping straight to full volume.
      if (next.paused) {
        const token = ++bgmFadeToken;
        next.volume = 0;
        next.play().catch(() => { /* starts on the next user gesture */ });
        ensureBgmAnalyser(next);
        const started = performance.now(), duration = 900;
        const fadeIn = now => {
          if (token !== bgmFadeToken) return;
          const t = clamp((now - started) / duration, 0, 1);
          next.volume = targetVolume * t;
          if (t < 1) requestAnimationFrame(fadeIn);
        };
        requestAnimationFrame(fadeIn);
      } else {
        next.volume = targetVolume;
        next.play().catch(() => { /* starts on the next user gesture */ });
      }
      return;
    }
    const token = ++bgmFadeToken;
    currentBgmKey = key;
    if (restart) next.currentTime = 0;
    next.volume = 0;
    if (!soundOn) { if (previous) previous.pause(); return; }
    next.play().catch(() => { /* starts on the next user gesture */ });
    ensureBgmAnalyser(next);
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
    if (state === 'opening' || state === 'menu') return 'title';
    if (state === 'over') return gameShell.classList.contains('is-game-over') ? 'gameOver' : 'ending';
    if (bossState === 'midboss-active' || bossState === 'midboss-warning') return 'midBoss';
    if (bossState === 'active' || bossState === 'transition' || bossState === 'final') return stageIndex === stages.length - 1 ? 'finalBoss' : 'bossBattle';
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
    // Big soft light orbs that live in front of the focal plane. They race past
    // fast (near-field), stay low-alpha and use the stage tint (assigned at draw
    // time) so the frame reads like a lens with shallow depth of field.
    bokeh = Array.from({ length: 6 }, (_, i) => ({
      x: Math.random() * VW, y: 60 + Math.random() * 560,
      r: 46 + Math.random() * 78, spd: 120 + Math.random() * 130,
      tint: i % 2, bob: Math.random() * 6, bobV: .5 + Math.random() * .6,
      a: .05 + Math.random() * .05
    }));
  }

  function setupStage() {
    stageKills = 0; stageStart = elapsed; stageDamaged = false;
    formationTimer = 2.5 + Math.random() * 2;
    ambient = []; bgProps = []; lightning = 0; shoppers = [];
    const theme = stages[stageIndex].theme;
    if (theme === 'neon') {
      bgProps = Array.from({ length: 3 }, (_, i) => ({ kind: 'car', x: Math.random() * VW, y: 150 + i * 90 + Math.random() * 40, v: 60 + Math.random() * 90, dir: Math.random() < .5 ? -1 : 1 }));
      bgProps.push({ kind: 'searchlight', x: 260, phase: 0, speed: .5 }, { kind: 'searchlight', x: 940, phase: 2.4, speed: .38 });
      // Festival fireworks over the Shibuya skyline + giant club speakers that
      // pump with the BGM, flanking the shopping street.
      bgProps.push({ kind: 'firework', x: 330, timer: 2 + Math.random() * 3 }, { kind: 'firework', x: 950, timer: 5 + Math.random() * 3 });
      bgProps.push({ kind: 'speaker', x: 96, ringT: -9 }, { kind: 'speaker', x: 1112, ringT: -9 });
      // Shoppers strolling the sidewalk in front of the storefronts. Farther ones
      // sit higher and smaller for depth; each carries an optional shopping bag.
      const coats = ['#ff5a8a', '#4a9cff', '#ffd24a', '#8a6cff', '#3ad6a0', '#ff8a3a'];
      const bags = ['#ffe15a', '#ff3e9d', '#31e8ff', '#ffffff'];
      shoppers = Array.from({ length: 11 }, () => {
        const depth = Math.random();
        return {
          x: Math.random() * VW, baseY: 614 + depth * 28, scale: .78 + depth * .5,
          dir: Math.random() < .5 ? -1 : 1, spd: 15 + Math.random() * 24, phase: Math.random() * 6.28,
          coat: coats[Math.floor(Math.random() * coats.length)],
          bag: Math.random() < .62, bagC: bags[Math.floor(Math.random() * bags.length)]
        };
      });
    } else if (theme === 'aqua') {
      for (let i = 0; i < 26; i++) ambient.push(makeAmbient('bubble'));
      bgProps.push({ kind: 'lighthouse', x: 1050, phase: 0 });
      bgProps.push({ kind: 'fish', x: VW + 100, phase: Math.random() * 4 }, { kind: 'fish', x: VW + 620, phase: Math.random() * 4 });
      // A single much larger fish breaches far less often than the small ones —
      // a rare "whoa" beat. Pure background dressing; it has no hitbox.
      bgProps.push({ kind: 'bigFish', x: VW * .5, phase: Math.random() * 18, cycle: 16 + Math.random() * 8 });
    } else if (theme === 'factory') {
      for (let i = 0; i < 14; i++) ambient.push(makeAmbient('smoke'));
      for (let i = 0; i < 10; i++) ambient.push(makeAmbient('spark'));
      bgProps = [
        { kind: 'gear', x: 190, y: 430, r: 58, speed: .5 }, { kind: 'gear', x: 610, y: 465, r: 40, speed: -.8 },
        { kind: 'gear', x: 1080, y: 420, r: 66, speed: .35 }, { kind: 'gear', x: 860, y: 486, r: 30, speed: -1.1 },
        { kind: 'hammer', x: 470, phase: 0 }, { kind: 'hammer', x: 940, phase: .5 }
      ];
    } else if (theme === 'storm') {
      for (let i = 0; i < 70; i++) ambient.push(makeAmbient('rain'));
      bgProps = Array.from({ length: 9 }, () => ({ kind: 'code', x: Math.random() * VW, y: Math.random() * 560, v: 60 + Math.random() * 120, len: 5 + Math.floor(Math.random() * 8) }));
      bgProps.push({ kind: 'panel', x: 220, y: 170, w: 120, h: 66, phase: 0 }, { kind: 'panel', x: 760, y: 120, w: 150, h: 80, phase: 2 }, { kind: 'panel', x: 1060, y: 250, w: 100, h: 58, phase: 4 });
      lightning = 0; lightningX = VW * .5;
    } else if (theme === 'palace') {
      for (let i = 0; i < 20; i++) ambient.push(makeAmbient('heart'));
      // Royal fireworks — they turn into a celebratory volley when the queen falls.
      bgProps.push(
        { kind: 'firework', x: 250, timer: 3 + Math.random() * 4 },
        { kind: 'firework', x: 1030, timer: 6 + Math.random() * 4 }
      );
    }
    // Stable scene dressing gives every run a busy, inhabited world without
    // affecting collision or gameplay readability.
    for (let i = 0; i < 8; i++) bgProps.push({ kind: 'nearDetail', lane: i, seed: Math.random() * 1000 });
    // Cache the near-detail subset so the draw loop skips a per-frame filter().
    nearProps = bgProps.filter(p => p.kind === 'nearDetail');
    initSceneLayers();
  }

  function makeAmbient(kind) {
    if (kind === 'bubble') return { kind, x: Math.random() * VW, y: 300 + Math.random() * 380, vy: -(24 + Math.random() * 46), r: 2 + Math.random() * 5, a: Math.random() * 6 };
    if (kind === 'smoke') {
      const [cx, cw, ch] = CHIMNEYS[Math.floor(Math.random() * CHIMNEYS.length)];
      return { kind, x: cx + cw / 2 + (Math.random() - .5) * 14, y: 560 - ch - 8, vy: -(14 + Math.random() * 20), r: 9 + Math.random() * 18, life: 2.5 + Math.random() * 2 };
    }
    // Sparks leap out of the molten river under the floor grating, so their
    // arcs visibly connect the glow to the machinery above it.
    if (kind === 'spark') return { kind, x: Math.random() * VW, y: 672 + Math.random() * 40, vx: -(60 + Math.random() * 120), vy: -(140 + Math.random() * 240), life: .4 + Math.random() * .8 };
    if (kind === 'rain') return { kind, x: Math.random() * (VW + 200), y: -20 - Math.random() * VH, vx: -230, vy: 620 + Math.random() * 240, len: 14 + Math.random() * 16 };
    if (kind === 'dust') {
      // Gold motes born at a window mouth, drifting down the god-ray direction
      // toward the nave centre.
      const wx = [190, 398, 828, 1036][Math.floor(Math.random() * 4)];
      return { kind, x: wx + 10 + Math.random() * 56, y: 280 + Math.random() * 70, vx: (640 - wx) * .05 + (Math.random() - .5) * 6, vy: 26 + Math.random() * 18, life: 5 + Math.random() * 3 };
    }
    return { kind: 'heart', x: Math.random() * VW, y: Math.random() * VH * .8, vy: -(8 + Math.random() * 16), s: 4 + Math.random() * 8, a: Math.random() * 6 };
  }

  function updateAmbient(dt) {
    const theme = stages[stageIndex].theme;
    for (const a of ambient) {
      a.x += (a.vx || 0) * dt - 26 * dt * gameSpeed;
      a.y += (a.vy || 0) * dt;
      if (a.kind === 'spark') a.vy += 480 * dt;
      if (a.kind === 'fwspark') {
        a.vy += (a.gravity || 135) * dt;
        a.vx *= Math.pow(a.drag || .72, dt);
      }
      if (a.kind === 'fwsmoke') {
        a.r += 12 * dt; a.vx *= Math.pow(.55, dt); a.vy -= 5 * dt;
      }
      if (a.kind === 'smoke') { a.r += dt * 6; a.x -= dt * (560 - a.y) * .05; }  // wind shear grows with altitude
      if (a.a !== undefined) a.a += dt * 3;
      if (a.life !== undefined) a.life -= dt;
    }
    ambient = ambient.filter(a => a.y > -60 && a.y < VH + 40 && a.x > -80 && (a.life === undefined || a.life > 0));
    let cap = { aqua: 26, factory: 24, storm: 70, palace: 26 }[theme] || 0;
    if (theme === 'palace') cap += Math.round(palaceBossMix * 8);   // more petals while the queen fights
    while (ambient.length < cap) {
      const kind = theme === 'aqua' ? 'bubble' : theme === 'palace' ? (Math.random() < .6 ? 'heart' : 'dust') : theme === 'storm' ? 'rain' : Math.random() < .58 ? 'smoke' : 'spark';
      const fresh = makeAmbient(kind);
      if (kind === 'bubble') fresh.y = VH - 40;
      if (kind === 'heart') fresh.y = VH - 30;
      if (kind === 'rain') fresh.y = -20;
      ambient.push(fresh);
    }
    for (const p of bgProps) {
      if (p.kind === 'car') { p.x += p.v * p.dir * dt; if (p.x < -160) { p.x = VW + 60; p.dir = 1; p.v = 60 + Math.random() * 90; } if (p.x > VW + 160) { p.x = -60; p.dir = -1; } }
      else if (p.kind === 'fish') { p.phase += dt; if (p.phase > 4.6) { p.phase = 0; p.x = VW * .25 + Math.random() * VW * .8; } }
      else if (p.kind === 'bigFish') {
        const wasUp = p.phase < BIGFISH_DUR;
        p.phase += dt;
        // Splash where it re-enters the water, then again on the next launch.
        if (wasUp && p.phase >= BIGFISH_DUR) splashRipple(p.x - BIGFISH_TRAVEL);
        if (p.phase > (p.cycle || 18)) {
          p.phase = 0; p.x = VW * .22 + Math.random() * VW * .56; p.cycle = 16 + Math.random() * 8;
          splashRipple(p.x);
        }
      }
      else if (p.kind === 'code') { p.y += p.v * dt; if (p.y > 620) { p.y = -80; p.x = Math.random() * VW; } }
      else if (p.kind === 'firework') {
        if (p.rise) {
          p.riseY -= 540 * dt;
          // A hot rocket core, falling gold embers and a faint smoke corkscrew
          // make the launch readable before the shell opens.
          if (bgQuality() > 0 && Math.random() < .82) {
            ambient.push({ kind: 'fwspark', x: p.bx + (Math.random() - .5) * 4, y: p.riseY, vx: (Math.random() - .5) * 18, vy: 55, life: .42, max: .42, size: 2.4, gravity: 95, color: '#fff1b8' });
            if (Math.random() < .22) ambient.push({ kind: 'fwsmoke', x: p.bx, y: p.riseY + 12, vx: (Math.random() - .5) * 14, vy: 18, r: 5, life: 1.1, max: 1.1 });
          }
          if (p.riseY <= p.burstY) {
            p.rise = false;
            const quality = bgQuality();
            // Never let overlapping shells grow without bound. Two structured
            // rings read richer than hundreds of tiny points and are far less
            // expensive beside the 980px boss sprite.
            const n = ambient.length > 360 ? 12 : [12, 26, 44][quality];
            const pal = stages[stageIndex].theme === 'palace' ? ['#ff9ccf', '#ffe15a', '#ff5a9d'] : ['#31e8ff', '#ff3e9d', '#ffe15a'];
            const main = pal[Math.floor(Math.random() * pal.length)];
            const inner = pal[(pal.indexOf(main) + 1) % pal.length];
            ambient.push({ kind: 'fwflash', x: p.bx, y: p.burstY, life: .42, max: .42, color: main });
            // Structured chrysanthemum shell: near-even spokes with small
            // physical imperfections, a bright crown and contrasting pistil.
            for (let i = 0; i < n; i++) {
              const a2 = i / n * Math.PI * 2 + (Math.random() - .5) * .055;
              const sp = 185 + Math.random() * 72;
              const life = 1.65 + Math.random() * .7;
              ambient.push({ kind: 'fwspark', x: p.bx, y: p.burstY, vx: Math.cos(a2) * sp, vy: Math.sin(a2) * sp, life, max: life, size: 2 + Math.random() * 1.8, gravity: 118 + Math.random() * 38, drag: .78, color: i % 7 === 0 ? '#fff7d6' : main });
            }
            const innerN = Math.round(n * .35);
            for (let i = 0; i < innerN; i++) {
              const a2 = i / innerN * Math.PI * 2 + .08;
              const sp = 82 + Math.random() * 35;
              const life = 1.1 + Math.random() * .45;
              ambient.push({ kind: 'fwspark', x: p.bx, y: p.burstY, vx: Math.cos(a2) * sp, vy: Math.sin(a2) * sp, life, max: life, size: 1.8, gravity: 92, color: inner });
            }
            for (let i = 0; i < 2 + quality * 2; i++) ambient.push({ kind: 'fwsmoke', x: p.bx + (Math.random() - .5) * 24, y: p.burstY + (Math.random() - .5) * 18, vx: (Math.random() - .5) * 35, vy: -8 + Math.random() * 24, r: 8 + Math.random() * 10, life: 1.8 + Math.random(), max: 2.8 });
            // The queen's downfall earns a celebratory volley cadence.
            const festival = stages[stageIndex].theme === 'palace' && ['transition', 'final'].includes(bossState);
            p.timer = festival ? .65 + Math.random() * .65 : 4.5 + Math.random() * 5;
          }
        } else {
          p.timer -= dt;
          if (p.timer <= 0) {
            p.rise = true; p.riseY = 600;
            p.burstY = 100 + Math.random() * 160;
            p.bx = p.x + (Math.random() - .5) * 180;
          }
        }
      }
      else if (p.kind === 'gear' || p.kind === 'searchlight' || p.kind === 'panel' || p.kind === 'lighthouse') p.phase = (p.phase || 0) + dt * (p.speed || 1);
    }
    if (theme === 'storm') {
      lightning -= dt;
      if (lightning < -4 - Math.random() * 5) { lightning = .45; lightningX = 120 + Math.random() * (VW - 240); if (state === 'playing' && !paused) sfx('thunder'); }
    }
  }

  // Bullets leave the gun tip. Both numbers below were measured, not guessed:
  // each costume's frame was drawn into drawPlayer's own rect and scanned for
  // the rightmost opaque pixel (the barrel), giving
  //   fly     normal (118,71)  bikini (116,64)
  //   ground  normal (119,64)  bikini (122,56)
  // MUZZLE_BASE is the default costume's tip; MUZZLE_FIX is the bikini's offset
  // from it (its blaster rides higher, and further forward on the ground).
  // The previous ground base was (114,80) — 16px below the barrel, which is
  // where the "bullets miss the muzzle" report came from.
  // fly.x/y were re-derived after PLAYER_DRAW unified the airborne sprite scale
  // with the grounded one: the same cell-local tip (u≈.99, v≈.56) lands 9px
  // further forward and 1px lower once the flight cell is drawn at 150×185.
  const MUZZLE_BASE = { fly: { x: 127, y: 72 }, ground: { x: 119, y: 64 } };
  const MUZZLE_FIX = { fly: { x: -2, y: -7 }, ground: { x: 3, y: -8 } };
  function muzzle() {
    const g = player.grounded;
    const base = g ? MUZZLE_BASE.ground : MUZZLE_BASE.fly;
    const o = bikiniOn() ? (g ? MUZZLE_FIX.ground : MUZZLE_FIX.fly) : { x: 0, y: 0 };
    return {
      x: player.x + base.x + o.x,
      y: player.y + base.y + o.y + (g ? 0 : Math.sin(player.frame * .65) * 3)
    };
  }

  function shoot() {
    // Walk sheet gun tip ≈ local (217, 200) in 232×350 crop, drawn at (x-8,y-28) size 130×190.
    // → screen offset ≈ (+113, +80). Fly sheet tip is further forward.
    const { x: muzzleX, y: muzzleY } = muzzle();
    const lanes = player.spread === 1 ? [0] : player.spread === 2 ? [-95, 0, 95] : [-160, -80, 0, 80, 160];
    // Ground run-and-gun: mostly horizontal out of the walk blaster (asset already aims forward).
    const aimBias = player.grounded ? -12 : 0;
    for (const vy of lanes) {
      // hue seeds the max-power rainbow orbs; harmless below power 3.
      bullets.push({ x: muzzleX, y: muzzleY, vx: 860, vy: vy + aimBias, life: 1.7, r: 7 + player.power * 2, damage: player.power, fromGround: player.grounded, hue: Math.random() * 360 });
    }
    // Visible muzzle flash so walk-shoot reads clearly.
    burst(muzzleX, muzzleY, '#ffe15a', player.grounded ? 8 : 5, player.grounded ? 200 : 150);
    if (player.grounded) {
      particles.push({ x: muzzleX + 6, y: muzzleY, vx: 220, vy: (Math.random() - .5) * 40, life: .12, max: .12, color: '#ff8a35', size: 6, gravity: 0 });
      particles.push({ x: muzzleX + 2, y: muzzleY, vx: 160, vy: (Math.random() - .5) * 30, life: .1, max: .1, color: '#fff', size: 4, gravity: 0 });
    }
    sfx('shoot');
  }

  // Empty-magazine fallback: a slow, weak but infinite pea-shot so running dry
  // is a setback, never a softlock — every boss stays killable.
  function shootPea() {
    const { x: muzzleX, y: muzzleY } = muzzle();
    bullets.push({ x: muzzleX, y: muzzleY, vx: 780, vy: player.grounded ? -12 : 0, life: 1.7, r: 5, damage: .6, pea: true });
    burst(muzzleX, muzzleY, '#c9d6ec', 3, 90);
    sfx('shoot');
  }

  function shootMissile() {
    const fix = bikiniOn() ? (player.grounded ? MUZZLE_FIX.ground : MUZZLE_FIX.fly) : { x: 0, y: 0 };
    const x = player.x + (player.grounded ? 100 : 93) + fix.x;
    const y = player.y + (player.grounded ? 78 : 78) + fix.y;
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
    // A beam still charging is cancelled outright; one already firing keeps its
    // light but stops being lethal, so the bomb never looks like it failed.
    hazards = hazards.filter(hz => hz.t >= hz.warn);
    for (const hz of hazards) hz.dead = true;
    for (const e of [...enemies]) {
      if (e.hp <= 0) continue;
      const damage = e.type === 'boss' ? 22 + player.power * 5 : e.type === 'midboss' ? 18 + player.power * 4 : 10 + player.power * 4;
      e.hp -= damage; e.hit = .3;
      if (e.hp <= 0) destroyEnemy(e);
    }
    // Don't let a boss counter-attack into the bomb's own invulnerability window.
    const bombed = enemies.find(e => e.type === 'boss');
    if (bombed) bombed.sp = Math.max(bombed.sp || 0, 1.4);
    burst(cx, cy, '#ffe15a', 70, 620); sfx('special'); voice('special'); updateSpecialButton();
  }

  function updateSpecialButton() {
    const ready = special >= 100;
    specialButton.classList.toggle('is-ready', ready);
    specialButton.disabled = !ready || state !== 'playing' || ['transition', 'final'].includes(bossState);
    specialButton.textContent = ready ? 'SPECIAL!' : `SPECIAL ${Math.floor(special)}%`;
  }

  // A stocked emergency bomb: unlike useSpecial() it doesn't need the gauge
  // full and deals no damage, it only sweeps the screen clean and buys a
  // moment of safety — a panic button, not a second special attack.
  function useBomb() {
    if (state !== 'playing' || paused || ['transition', 'final'].includes(bossState) || bombStock <= 0) return;
    bombStock--; player.inv = Math.max(player.inv, 1.1); shake = Math.max(shake, 16); flash = Math.max(flash, .4);
    const cx = player.x + player.w / 2, cy = player.y + player.h / 2;
    shockwaves.push({ x: cx, y: cy, r: 10, speed: 760, life: .8, max: .8, color: '#c9d6ec' });
    for (const b of enemyBullets) burst(b.x, b.y, '#c9d6ec', 2, 90);
    enemyBullets = [];
    hazards = hazards.filter(hz => hz.t >= hz.warn);
    for (const hz of hazards) hz.dead = true;
    burst(cx, cy, '#c9d6ec', 34, 420); sfx('shield'); updateBombButton();
  }

  function updateBombButton() {
    bombButton.classList.toggle('is-ready', bombStock > 0);
    bombButton.disabled = bombStock <= 0 || state !== 'playing' || ['transition', 'final'].includes(bossState);
    bombButton.textContent = `BOMB ×${bombStock}`;
  }

  // --- Motion-input command moves -----------------------------------------
  // checkMotion walks the recent direction history (numpad encoding, oldest
  // first) and reports whether `seq` appears in order inside the input window.
  // Intermediate neutrals/extra directions are ignored, so a rolled ↓↘→ on
  // keys or a swept stick both register.
  function checkMotion(seq, window = .45) {
    let i = 0;
    for (const m of motionBuf) {
      if (elapsed - m.t > window) continue;
      if (m.dir === seq[i]) i++;
      if (i === seq.length) return true;
    }
    return false;
  }

  // Called on a fresh fire press, before the normal shot. Returns true when a
  // command consumed the press. The two sequences are mutually exclusive
  // (2,3,6 vs 6,2,3), so order of the checks doesn't matter.
  function tryCommandMove() {
    if (state !== 'playing' || paused || ['transition', 'final'].includes(bossState)) return false;
    if (checkMotion([2, 3, 6])) return commandHeartWave();
    if (checkMotion([6, 2, 3])) return commandSparkRiser();
    return false;
  }

  // ハートウェーブ (↓↘→+shot, 35% gauge): one giant piercing heart that sails
  // through every enemy in its path, ticking each of them as it passes.
  function commandHeartWave() {
    if (special < 35) { sfx('shield'); return false; }
    special -= 35; updateSpecialButton(); motionBuf.length = 0;
    const x = player.x + 110, y = player.y + (player.grounded ? 70 : 60);
    bullets.push({ x, y, vx: 620, vy: 0, life: 2.4, r: 34, damage: 3, pierce: true, hue: Math.random() * 360 });
    shockwaves.push({ x, y, r: 12, speed: 620, life: .5, max: .5, color: '#ff3e9d' });
    burst(x, y, '#ff9ccf', 24, 320);
    shake = Math.max(shake, 8); sfx('missile'); sfx('power');
    return true;
  }

  // スパークライザー (→↓↘+shot, 40% gauge): a climbing volt pillar plus a
  // close-range bullet sweep and a breath of invulnerability — the panic
  // uppercut of the pair.
  function commandSparkRiser() {
    if (special < 40) { sfx('shield'); return false; }
    special -= 40; updateSpecialButton(); motionBuf.length = 0;
    const cx = player.x + player.w / 2, cy = player.y + player.h / 2;
    for (let i = 0; i < 10; i++) {
      bullets.push({ x: cx + 20 + i * 30, y: cy + 36 + i * 15, vx: 150, vy: -760, life: 1.15, r: 10, damage: 2, spark: true });
    }
    for (const b of enemyBullets) {
      if (Math.hypot(b.x - cx, b.y - cy) < 200) { b.life = 0; burst(b.x, b.y, '#72ff68', 2, 90); }
    }
    player.inv = Math.max(player.inv, .6);
    shockwaves.push({ x: cx, y: cy, r: 10, speed: 700, life: .6, max: .6, color: '#72ff68' });
    shake = Math.max(shake, 10); sfx('boom'); sfx('power');
    return true;
  }

  // Enemy type categories, shared by the spawner, the formation builder and the
  // damage-decal pass so each rule lives in exactly one place.
  //   GROUND  … walks/sits on the floor, so it ignores the flight lane
  //   ORGANIC … living creatures: no rivets, no crown, no squad badge, no
  //             cracked plating — flesh doesn't spall, it scars and bleeds light
  //   SOLO    … too big or too slow to make sense seven-abreast in a formation
  const GROUND_TYPES = ['tank', 'turret', 'ember', 'walker', 'alleycat', 'slagling', 'furnacehound', 'cardguard', 'teacup'];
  const ORGANIC_TYPES = ['bat', 'jelly', 'manta', 'dumbo', 'angler', 'oarfish', 'moray',
    'crow', 'alleycat', 'neonmoth', 'slagling', 'furnacehound', 'cloudray', 'voltbug', 'packetwyrm', 'rosebud'];
  const SOLO_TYPES = ['moray', 'oarfish', 'packetwyrm'];
  const isGroundType = t => GROUND_TYPES.includes(t);
  const isOrganic = t => ORGANIC_TYPES.includes(t);

  function pickSpawnType() {
    const table = stages[stageIndex].spawnTable;
    let total = 0;
    for (const [, weight] of table) total += weight;
    let r = Math.random() * total;
    for (const [type, weight] of table) { r -= weight; if (r <= 0) return type; }
    return table[0][0];
  }

  function spawnEnemy(typeOverride = null, formation = null, flank = false) {
    const type = typeOverride || pickSpawnType();
    const y = formation?.y ?? (80 + Math.random() * (VH - 210));
    // Difficulty ramps with phase intensity + early stage progress, capped so a
    // 5-minute timeline never runs enemy speed off the rails.
    const rank = Math.min(1, stageTime / 120) * (.4 + .6 * (activePhase.intensity ?? .5));
    let e;
    if (type === 'drone') e = { type, x: VW + 70, y, baseY: y, w: 64, h: 56, hp: 2, maxHp: 2, vx: 175 + rank * 40, t: Math.random() * 6, wave: Math.random() < .46, points: 120, fire: 1 + Math.random() * 2.2 };
    else if (type === 'bat') e = { type, x: VW + 70, y, baseY: y, w: 70, h: 50, hp: 1, maxHp: 1, vx: 255 + rank * 50, t: Math.random() * 6, wave: true, points: 180, fire: 99 };
    else if (type === 'spinner') e = { type, x: VW + 80, y, baseY: y, w: 76, h: 76, hp: 4, maxHp: 4, vx: 150 + rank * 35, t: 0, wave: true, points: 350, fire: 1.3 };
    else if (type === 'tank') e = { type, x: VW + 90, y, baseY: y, w: 98, h: 78, hp: 7, maxHp: 7, vx: 105 + rank * 25, t: 0, wave: false, points: 600, fire: .9 };
    else if (type === 'turret') e = { type, x: VW + 80, y: 574, baseY: 574, w: 74, h: 72, hp: 5, maxHp: 5, vx: 125, t: 0, wave: false, points: 480, fire: .7 };
    else if (type === 'jelly') e = { type, x: VW + 70, y: Math.min(y, 460), baseY: Math.min(y, 460), w: 62, h: 66, hp: 3, maxHp: 3, vx: 85 + rank * 20, t: Math.random() * 6, wave: true, points: 260, fire: 99 };
    else if (type === 'ember') e = { type, x: VW + 60, y: 606, baseY: 606, w: 44, h: 44, hp: 1, maxHp: 1, vx: 290 + rank * 50, t: Math.random() * 2, wave: false, points: 220, fire: 99, vy: -(330 + Math.random() * 180) };
    else if (type === 'glitch') e = { type, x: VW + 70, y, baseY: y, w: 58, h: 58, hp: 3, maxHp: 3, vx: 140, t: Math.random() * 6, wave: false, points: 320, fire: 1.7, tp: .6 + Math.random() * .6, blink: 0 };
    else if (type === 'racer') e = { type, x: VW + 90, y: clamp(y, 170, 510), baseY: clamp(y, 170, 510), w: 84, h: 46, hp: 3, maxHp: 3, vx: 285 + rank * 50, t: Math.random() * 6, wave: true, points: 420, fire: 1.25 };
    else if (type === 'manta') e = { type, x: VW + 90, y: Math.min(y, 455), baseY: Math.min(y, 455), w: 88, h: 52, hp: 4, maxHp: 4, vx: 125 + rank * 28, t: Math.random() * 6, wave: true, points: 440, fire: 1.45 };
    else if (type === 'walker') e = { type, x: VW + 90, y: 548, baseY: 548, w: 84, h: 92, hp: 8, maxHp: 8, vx: 92 + rank * 18, t: Math.random() * 2, wave: false, points: 760, fire: .85 };
    else if (type === 'seeker') e = { type, x: VW + 80, y, baseY: y, w: 68, h: 68, hp: 5, maxHp: 5, vx: 155 + rank * 30, t: Math.random() * 6, wave: true, points: 520, fire: 1.15 };
    else if (type === 'knight') e = { type, x: VW + 80, y: Math.min(y, 500), baseY: Math.min(y, 500), w: 72, h: 82, hp: 7, maxHp: 7, vx: 115 + rank * 20, t: Math.random() * 6, wave: true, points: 680, fire: 1.3 };
    // --- Stage-signature small fry --------------------------------------
    else if (type === 'crow') e = { type, x: VW + 70, y, baseY: y, w: 76, h: 54, hp: 2, maxHp: 2, vx: 235 + rank * 44, t: Math.random() * 6, wave: true, points: 210, fire: 99 };
    else if (type === 'alleycat') e = { type, x: VW + 80, y: 570, baseY: 570, w: 82, h: 64, hp: 4, maxHp: 4, vx: 155 + rank * 28, t: Math.random() * 6, wave: false, points: 390, fire: 1.8 };
    else if (type === 'neonmoth') e = { type, x: VW + 70, y, baseY: y, w: 78, h: 68, hp: 3, maxHp: 3, vx: 120 + rank * 26, t: Math.random() * 6, wave: true, points: 330, fire: 2 };
    else if (type === 'slagling') e = { type, x: VW + 70, y: 586, baseY: 586, w: 62, h: 54, hp: 3, maxHp: 3, vx: 132 + rank * 24, t: Math.random() * 6, wave: false, points: 360, fire: 2.1 };
    else if (type === 'rivetbeetle') e = { type, x: VW + 80, y, baseY: y, w: 82, h: 62, hp: 6, maxHp: 6, vx: 115 + rank * 22, t: Math.random() * 6, wave: true, points: 610, fire: 1.55 };
    else if (type === 'furnacehound') e = { type, x: VW + 90, y: 556, baseY: 556, w: 104, h: 82, hp: 8, maxHp: 8, vx: 168 + rank * 30, t: Math.random() * 6, wave: false, points: 850, fire: 1.45 };
    else if (type === 'cloudray') e = { type, x: VW + 90, y, baseY: y, w: 98, h: 60, hp: 4, maxHp: 4, vx: 142 + rank * 30, t: Math.random() * 6, wave: true, points: 520, fire: 1.8 };
    else if (type === 'voltbug') e = { type, x: VW + 70, y, baseY: y, w: 68, h: 66, hp: 3, maxHp: 3, vx: 190 + rank * 38, t: Math.random() * 6, wave: true, points: 430, fire: 1.4 };
    else if (type === 'packetwyrm') e = { type, x: VW + 120, y, baseY: y, w: 154, h: 64, hp: 10, maxHp: 10, vx: 92 + rank * 18, t: Math.random() * 6, wave: true, points: 1200, fire: 1.7 };
    else if (type === 'rosebud') e = { type, x: VW + 70, y, baseY: y, w: 72, h: 72, hp: 4, maxHp: 4, vx: 118 + rank * 24, t: Math.random() * 6, wave: true, points: 520, fire: 1.75 };
    else if (type === 'cardguard') e = { type, x: VW + 80, y: 554, baseY: 554, w: 74, h: 86, hp: 7, maxHp: 7, vx: 110 + rank * 20, t: Math.random() * 6, wave: false, points: 760, fire: 1.3 };
    else if (type === 'teacup') e = { type, x: VW + 80, y: 582, baseY: 582, w: 82, h: 56, hp: 5, maxHp: 5, vx: 145 + rank * 24, t: Math.random() * 6, wave: false, points: 590, fire: 1.65 };
    // --- AQUA HIGHWAY deep-sea fauna -------------------------------------
    // Dumbo octopus (メンダコ): the slowest thing in the stage, drifting on its
    // ear fins. Soft, cheap to kill, but it fogs the lane with ink on the way out.
    else if (type === 'dumbo') e = { type, x: VW + 80, y: Math.min(y, 480), baseY: Math.min(y, 480), w: 76, h: 74, hp: 3, maxHp: 3, vx: 76 + rank * 18, t: Math.random() * 6, wave: true, points: 380, fire: 2.1 };
    // Humpback anglerfish (チョウチンアンコウ): an ambush predator, so it barely
    // moves — its lure is the telegraph, and it burns brighter the nearer the shot.
    else if (type === 'angler') e = { type, x: VW + 90, y: clamp(y, 90, 500), baseY: clamp(y, 90, 500), w: 86, h: 78, hp: 6, maxHp: 6, vx: 62 + rank * 16, t: Math.random() * 6, wave: true, points: 620, fire: 1.9 };
    // Oarfish (リュウグウノツカイ): swims head-up like the real animal, so it is a
    // tall vertical ribbon — a moving pillar you route around rather than through.
    else if (type === 'oarfish') e = { type, x: VW + 70, y: clamp(y - 40, 40, 400), baseY: clamp(y - 40, 40, 400), w: 58, h: 186, hp: 5, maxHp: 5, vx: 108 + rank * 24, t: Math.random() * 6, wave: true, points: 700, fire: 2.4 };
    // Giant moray (巨大ウツボ): the stage's rare heavy, drawn at encounter scale —
    // the box below is only its head, and roughly 350 more pixels of body trail
    // off to the right of it. Holds station and lunges, jaws first, instead of
    // shooting; `lunge`/`recoil`/`jaw` drive both the dash and the art.
    else if (type === 'moray') e = { type, x: VW + 260, y: clamp(y, 60, 470), baseY: clamp(y, 60, 470), w: 150, h: 92, hp: 16, maxHp: 16, vx: 40 + rank * 10, t: Math.random() * 6, wave: true, points: 1800, fire: 2.8, lunge: 0, recoil: 0, jaw: 0 };
    else e = { type: 'cupid', x: VW + 70, y, baseY: y, w: 62, h: 58, hp: 3, maxHp: 3, vx: 120, t: Math.random() * 6, wave: true, points: 340, fire: 1.6 };
    const variantRoll = Math.random();
    // Stage 1 mostly fields plain enemies so the player learns the base patterns
    // before armored/elite variants start soaking shots.
    const vm = isStage1() ? STAGE1_EASE.variant : 1;
    e.variant = variantRoll < .11 * vm ? 'elite' : variantRoll < .31 * vm ? 'armored' : 'standard';
    if (formation?.elite) e.variant = 'elite';
    if (e.variant === 'armored') { e.hp = Math.ceil(e.hp * 1.45); e.maxHp = e.hp; e.vx *= .88; e.points = Math.round(e.points * 1.45); }
    if (e.variant === 'elite') { e.hp = Math.ceil(e.hp * 1.25); e.maxHp = e.hp; e.vx *= 1.2; e.fire *= .72; e.points = Math.round(e.points * 1.8); }
    const hpBonus = Math.floor(stageIndex / 2);
    e.hp += hpBonus; e.maxHp += hpBonus;
    e.vx *= 1 + stageIndex * .08;
    e.points = Math.round(e.points * (1 + stageIndex * .22));
    if (e.variant === 'armored') e.shield = Math.ceil(e.maxHp * .6);
    if (formation) { e.x += formation.xOffset || 0; e.formation = formation.shape; e.formationSlot = formation.slot || 0; }
    if (flank) {
      // Sweep in from behind the player and cross the screen rightward.
      e.flank = true; e.x = -e.w - 20;
      burst(30, e.y + e.h / 2, stages[stageIndex].accent2, 10, 200);
    }
    const canDive = ['bat', 'racer', 'cupid', 'knight', 'crow', 'voltbug'].includes(e.type);
    e.behavior = flank ? 'cruise' : formation ? (formation.shape === 'snake' ? 'snake' : 'formation') : canDive && Math.random() < .48 ? 'dive' : Math.random() < .24 ? 'stagger' : 'cruise';
    if (e.behavior === 'snake') e.wave = false;   // the chain sine replaces the solo bob
    e.fireMax = e.fire;
    enemies.push(e);
  }

  // A single fast air-type slipping in from the left so "shoot straight ahead
  // forever" stops being a safe strategy once a stage heats up.
  function spawnFlanker() {
    // Solo types are excluded too: a 10 HP moray crossing left-to-right behind
    // the player is a wall, not the quick jab this spawn is meant to be.
    const air = stages[stageIndex].spawnTable.filter(([t]) => !isGroundType(t) && !SOLO_TYPES.includes(t));
    const type = air.length ? air[Math.floor(Math.random() * air.length)][0] : 'drone';
    spawnEnemy(type, null, true);
  }

  function spawnFormation(elite = false) {
    // Re-roll once past a solo type: seven morays abreast is not a formation,
    // it is a locked door. One re-roll keeps the rest of the table's weighting.
    let type = pickSpawnType();
    if (SOLO_TYPES.includes(type)) type = pickSpawnType();
    if (SOLO_TYPES.includes(type)) { spawnEnemy(type); formationTimer = 3.2 + Math.random() * 2.4; return; }
    const groundType = isGroundType(type);
    // Stage 1 sticks to the classic vee/column entirely; the complex shapes
    // (vertical picket, slithering chain, staggered parallel rows) are the big
    // squads, so keeping them off stage 1 is most of the crowd reduction.
    const pool = groundType ? ['column']
      : isStage1() || Math.random() < .42 ? ['vee', 'column']
        : ['wall', 'snake', 'rows'];
    const shape = pool[Math.floor(Math.random() * pool.length)];
    const centerY = 140 + Math.random() * 300;
    // Squad size, shrunk on stage 1 — always at least 2 so a "formation" still
    // reads as a group rather than a lone straggler.
    const squad = n => isStage1() ? Math.max(2, Math.round(n * STAGE1_EASE.packSize)) : n;
    if (shape === 'wall') {
      // Vertical picket: five abreast filling most of the lane height.
      for (let i = 0; i < 5; i++) spawnEnemy(type, { y: 95 + i * 100, xOffset: 0, shape, slot: i, elite });
    } else if (shape === 'snake') {
      // Chain sharing one sine, phase-offset per slot — slithers as a body.
      for (let i = 0; i < 7; i++) spawnEnemy(type, { y: clamp(centerY, 190, 420), xOffset: i * 72, shape, slot: i, elite });
    } else if (shape === 'rows') {
      // Two staggered parallel rows sweeping in together.
      for (let row = 0; row < 2; row++) for (let i = 0; i < 4; i++) {
        spawnEnemy(type, { y: clamp(centerY + (row ? 115 : -115), 75, 535), xOffset: i * 96 + (row ? 48 : 0), shape, slot: i, elite });
      }
    } else {
      const count = groundType ? 2 : squad(Math.random() < .35 ? 4 : 3);
      for (let i = 0; i < count; i++) {
        const offset = i - (count - 1) / 2;
        const y = groundType ? 560 : clamp(centerY + (shape === 'vee' ? Math.abs(offset) * 58 : offset * 64), 75, 535);
        spawnEnemy(type, { y, xOffset: i * 82 + (shape === 'vee' ? Math.abs(offset) * 35 : 0), shape, slot: i, elite });
      }
    }
    formationTimer = 3.2 + Math.random() * 2.4;
  }

  // A destructible wall zone: a vertical column of stage-themed blocks with a
  // pass-through gap the player either threads or shoots open. Blocks are
  // ordinary `enemies` entities, so bullets, contact damage, combo chains and
  // the money payout all flow through the normal paths.
  function spawnBlockWall() {
    const cell = 92, cells = 6, top = 70;
    const gapSize = difficulties[difficultyKey].gapW >= 1.2 ? 2 : 1;   // easy gets a wider door
    const gapAt = 1 + Math.floor(Math.random() * (cells - gapSize - 1));
    for (let i = 0; i < cells; i++) {
      if (i >= gapAt && i < gapAt + gapSize) continue;
      const hp = 3 + stageIndex;
      enemies.push({
        type: 'block', x: VW + 80, y: top + i * cell, baseY: top + i * cell, w: cell, h: cell,
        hp, maxHp: hp, vx: 130, t: Math.random() * 4, wave: false, points: 90,
        fire: 999, fireMax: 999, behavior: 'cruise', variant: 'standard',
        seed: Math.floor(Math.random() * 999)
      });
    }
    blockWallTimer = 6;
  }

  // Big scripted formations for the 'setpiece' phase — each stage uses its own
  // signature enemies from the spawnTable, so no bespoke enemy code is needed.
  function runSetpiece(step) {
    const table = stages[stageIndex].spawnTable;
    const air = table.filter(([t]) => !isGroundType(t) && !SOLO_TYPES.includes(t));
    const ground = table.filter(([t]) => isGroundType(t));
    const airType = air.length ? air[step % air.length][0] : 'drone';
    const pattern = step % 5;
    // Set-pieces are the single biggest dumps of small fry in the route, so
    // stage 1 runs the same shapes with thinner ranks (min 2 keeps the shape
    // legible — a 1-wide "pincer" would just look broken).
    const squad = n => isStage1() ? Math.max(2, Math.round(n * STAGE1_EASE.packSize)) : n;
    if (pattern === 3) {
      // Snake chain slithering through mid-screen.
      const n = squad(8);
      for (let i = 0; i < n; i++) spawnEnemy(airType, { y: 300, xOffset: i * 72, shape: 'snake', slot: i });
      return;
    }
    if (pattern === 4) {
      // Wall zone: a destructible barrier arrives with three escorts behind it.
      spawnBlockWall();
      const n = squad(3);
      for (let i = 0; i < n; i++) spawnEnemy(airType, { y: 140 + i * 160, xOffset: 220 + i * 60, shape: 'column', slot: i });
      return;
    }
    if (pattern === 0) {
      // Double vee: one wing high, one wing low.
      const n = squad(5);
      for (const cy of [150, 420]) for (let i = 0; i < n; i++) {
        const off = i - (n - 1) / 2;
        spawnEnemy(airType, { y: clamp(cy + Math.abs(off) * 52, 75, 535), xOffset: Math.abs(off) * 70, shape: 'vee', slot: i });
      }
    } else if (pattern === 1 && ground.length) {
      // Ground column with air cover.
      const n = squad(3);
      for (let i = 0; i < n; i++) spawnEnemy(ground[i % ground.length][0], { y: 560, xOffset: i * 120, shape: 'column', slot: i });
      for (let i = 0; i < n; i++) spawnEnemy(airType, { y: 140 + i * 90, xOffset: i * 60, shape: 'column', slot: i });
    } else {
      // Pincer: two columns closing from top and bottom.
      const n = squad(4);
      for (let i = 0; i < n; i++) {
        spawnEnemy(airType, { y: 90 + i * 46, xOffset: i * 85, shape: 'column', slot: i });
        spawnEnemy(airType, { y: 530 - i * 46, xOffset: i * 85, shape: 'column', slot: i });
      }
    }
  }

  function spawnBoss() {
    // The last stage's boss is the whole game's climax, so it gets an extra
    // tankiness bonus on top of the normal per-stage ramp.
    const isFinalBoss = stageIndex === stages.length - 1;
    const bossHp = Math.round(difficulties[difficultyKey].bossHp * (1 + stageIndex * .65) * (isFinalBoss ? 1.3 : 1));
    // With a loaded sprite the hitbox takes the art's aspect ratio at a large
    // fixed height, so the visual and the collision box stay in sync (tall
    // sprites no longer get an invisible wide hitbox). 460×380 is the
    // procedural-art fallback.
    const sprite = frameReady(bossSets[stageIndex].idle[0]) ? bossSets[stageIndex].idle[0] : bossSprites[stageIndex];
    let w = 460, h = 380;
    if (sprite && sprite.complete && sprite.naturalWidth) {
      h = stageIndex === 4 ? 980 : stageIndex === 1 ? 640 : 560;
      w = Math.round(h * sprite.naturalWidth / sprite.naturalHeight);
    }
    // The contact box is pulled inside the artwork: several sprites are wide
    // enough to overlap the player's own movement limit, which turned simply
    // standing at the right edge into passive contact damage.
    const bossY = stageIndex === 4 ? 0 : stageIndex === 1 ? 30 : 90;
    const hitInset = Math.round(w * (stageIndex === 4 ? .40 : stageIndex === 1 ? .22 : .16));
    const hitInsetY = Math.round(h * (stageIndex === 4 ? .18 : .08));
    enemies.push({ type: 'boss', x: VW + 380, y: bossY, baseY: bossY, w, h, hp: bossHp, maxHp: bossHp, vx: 0, t: 0, wave: false, points: 18000 + stageIndex * 4000, fire: .7, sp: 2.8, hitInset, hitInsetY, tier: 0, tierBanner: 0, crit: false });
    bossState = 'active';
    musicStep = 0; musicClock = 0;
    clearEnemyFire();
    shake = 18; flash = .55;
    playBgm(stageIndex === stages.length - 1 ? 'finalBoss' : 'bossBattle', true);
    sfx('warning');
    if (isFinalBoss) royalSfx('entrance');
    else { sfx('boss'); sfx('bossRoar'); sfx('bossQuake'); }
    bossVoice(stageIndex, 'appear');
  }

  function spawnMidBoss() {
    const baseHp = difficulties[difficultyKey].midHp;
    const hp = Math.round(baseHp * 1.5 * (1 + stageIndex * .48));
    const midSprite = frameReady(midSets[stageIndex].idle[0]) ? midSets[stageIndex].idle[0] : wardenSprite;
    let w = 280, h = 230;
    if (midSprite.complete && midSprite.naturalWidth) {
      h = 340; w = Math.round(h * midSprite.naturalWidth / midSprite.naturalHeight);
    }
    enemies.push({ type: 'midboss', x: VW + 240, y: 140, baseY: 140, w, h, hp, maxHp: hp, vx: 0, t: 0, wave: false, points: 6200 + stageIndex * 1200, fire: .55, sp: 2.1, variant: 'standard' });
    bossState = 'midboss-active';
    clearEnemyFire(); shake = 14; flash = .45;
    playBgm('midBoss', true); sfx('boss'); sfx('warning');
  }

  function updateMidBoss(e, dt) {
    stepPoseTimers(e, dt);
    const midPark = VW - e.w - 50;
    if (e.x > midPark) e.x -= 300 * dt;
    e.y = clamp(e.baseY + Math.sin(e.t * (1.25 + stageIndex * .1)) * (70 + stageIndex * 6), 20, VH - e.h - 30);
    const fg = difficulties[difficultyKey].fireGap;
    e.fire -= dt / fg; e.sp -= dt / fg;
    const engaged = e.x <= midPark + 20;
    const rage = e.hp < e.maxHp * .45;
    // Mini-beam on its own clock: one thin aimed beam that teaches the
    // beam-dodge grammar before the stage boss uses the wide ones.
    e.beamT = (e.beamT === undefined ? 4.5 : e.beamT - dt / fg);
    if (engaged && e.beamT <= 0) {
      const D = difficulties[difficultyKey];
      hazards.push({
        kind: 'beam', x: e.x + 26, y: e.y + e.h * .45, w: 1100, h: 50 / D.gapW, ang: Math.PI,
        warn: 1.0 * D.telMul, live: .24, fade: .18, lock: .6 * D.telMul, aim: true, t: 0,
        damage: 28, color: stages[stageIndex].accent2,
      });
      e.attackT = .5; sfx('boss'); shake = Math.max(shake, 6);
      e.beamT = rage ? 4.4 : 6;
    }
    if (engaged && e.fire <= 0) {
      const ox = e.x + 12, oy = e.y + e.h / 2;
      const aim = Math.atan2(player.y + 45 - oy, player.x - ox);
      const count = Math.max(4, Math.round((rage ? 9 : 6) * difficulties[difficultyKey].barrage));
      for (let i = 0; i < count; i++) {
        const a = aim + (i - (count - 1) / 2) * .17;
        enemyBullets.push({ x: ox, y: oy, vx: Math.cos(a) * (270 + stageIndex * 22), vy: Math.sin(a) * (270 + stageIndex * 22), r: 10, life: 6.5, damage: 21 + stageIndex * 2, boss: true, volt: stageIndex === 3, fire: stageIndex === 2, heart: stageIndex === 4, bubble: stageIndex === 1 });
      }
      burst(ox, oy, stages[stageIndex].accent2, 16, 230); e.fire = rage ? .38 : .54;
      e.attackT = .45; shake = Math.max(shake, 5);
    }
    if (engaged && e.sp <= 0) {
      e.attackT = .55;
      const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
      const count = Math.max(10, Math.round((rage ? 20 : 14) * difficulties[difficultyKey].barrage));
      for (let i = 0; i < count; i++) {
        const a = i / count * Math.PI * 2 + e.t * .4;
        enemyBullets.push({ x: cx, y: cy, vx: Math.cos(a) * 195, vy: Math.sin(a) * 195, r: 9, life: 6, damage: 19 + stageIndex * 2, boss: true });
      }
      // Side cannons
      for (const side of [-1, 1]) {
        for (let i = 0; i < 4; i++) {
          enemyBullets.push({ x: cx + side * 55, y: cy, vx: -210, vy: (i - 1.5) * 80, r: 8, life: 5.5, damage: 18 + stageIndex * 2, boss: true });
        }
      }
      shockwaves.push({ x: cx, y: cy, r: 20, speed: 400, life: .7, max: .7, color: stages[stageIndex].accent2 });
      shockwaves.push({ x: cx, y: cy, r: 8, speed: 260, life: .5, max: .5, color: '#fff' });
      sfx('boss'); shake = Math.max(shake, 9); e.sp = rage ? 2.1 : 2.9;
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
    if (e.type === 'alleycat') {
      // The cat swats a neon sign shard along the pavement.
      enemyBullets.push({ x: e.x + 4, y: e.y + 43, vx: Math.cos(aim) * 265, vy: -170, gravity: 360, r: 8, life: 4.5, damage: 15, heart: true });
      return;
    }
    if (e.type === 'neonmoth') {
      for (const spread of [-.28, 0, .28]) enemyBullets.push({ x: e.x + 16, y: e.y + 34, vx: Math.cos(aim + spread) * 155, vy: Math.sin(aim + spread) * 155, r: 8, life: 5.5, damage: 13, lure: true, drift: 55 });
      return;
    }
    if (e.type === 'slagling') {
      enemyBullets.push({ x: e.x + 10, y: e.y + 22, vx: Math.cos(aim) * 180, vy: -235, gravity: 430, r: 10, life: 4.5, damage: 18, fire: true });
      return;
    }
    if (e.type === 'rivetbeetle') {
      for (const spread of [-.12, .12]) enemyBullets.push({ x: e.x + 8, y: e.y + 31, vx: Math.cos(aim + spread) * 290, vy: Math.sin(aim + spread) * 290, r: 8, life: 5, damage: 17, fire: true });
      return;
    }
    if (e.type === 'furnacehound') {
      for (let i = 0; i < 4; i++) enemyBullets.push({ x: e.x + 5, y: e.y + 35, vx: Math.cos(aim + (i - 1.5) * .13) * 240, vy: Math.sin(aim + (i - 1.5) * .13) * 240, r: 9, life: 4.5, damage: 18, fire: true });
      return;
    }
    if (e.type === 'cloudray') {
      for (const spread of [-.2, .2]) enemyBullets.push({ x: e.x + 10, y: e.y + 31, vx: Math.cos(aim + spread) * 210, vy: Math.sin(aim + spread) * 210, r: 9, life: 5.5, damage: 17, volt: true, drift: 65 });
      return;
    }
    if (e.type === 'voltbug') {
      enemyBullets.push({ x: e.x + 12, y: e.y + 33, vx: Math.cos(aim) * 340, vy: Math.sin(aim) * 340, r: 8, life: 4.5, damage: 17, volt: true, homing: .3 });
      return;
    }
    if (e.type === 'packetwyrm') {
      for (let i = 0; i < 5; i++) enemyBullets.push({ x: e.x + 8, y: e.y + 32, vx: Math.cos(aim + (i - 2) * .16) * 245, vy: Math.sin(aim + (i - 2) * .16) * 245, r: 9, life: 5.5, damage: 18, volt: true });
      return;
    }
    if (e.type === 'rosebud') {
      for (const spread of [-.24, 0, .24]) enemyBullets.push({ x: e.x + 18, y: e.y + 36, vx: Math.cos(aim + spread) * 190, vy: Math.sin(aim + spread) * 190, r: 9, life: 6, damage: 16, heart: true, homing: .28 });
      return;
    }
    if (e.type === 'cardguard') {
      enemyBullets.push({ x: e.x + 4, y: e.y + 32, vx: Math.cos(aim) * 315, vy: Math.sin(aim) * 315, r: 10, life: 5, damage: 20, heart: true });
      return;
    }
    if (e.type === 'teacup') {
      for (const spread of [-.18, .18]) enemyBullets.push({ x: e.x + 10, y: e.y + 18, vx: Math.cos(aim + spread) * 170, vy: Math.sin(aim + spread) * 170 - 80, gravity: 80, r: 10, life: 5.5, damage: 16, bubble: true });
      return;
    }
    // Dumbo octopus: a slow ink screen, not aimed fire. Three blots fanned
    // downward-forward that swell as they drift — area denial you swim around.
    if (e.type === 'dumbo') {
      for (const spread of [-.42, 0, .42]) {
        enemyBullets.push({ x: e.x + 30, y: e.y + 58, vx: Math.cos(aim + spread) * 120, vy: Math.sin(aim + spread) * 120 + 30, r: 13, life: 4.4, damage: 11, ink: true, drift: 40 });
      }
      return;
    }
    // Anglerfish: sheds its bait. Two cold lights that home lazily — the lure
    // glow on the fish itself is the wind-up, so this is never a surprise.
    if (e.type === 'angler') {
      for (const spread of [-.14, .14]) {
        enemyBullets.push({ x: e.x + 14, y: e.y + 20, vx: Math.cos(aim + spread) * 175, vy: Math.sin(aim + spread) * 175, r: 8, life: 6, damage: 16, lure: true, homing: .55 });
      }
      return;
    }
    // Oarfish: a single hard water-jet from the mouth at the top of the ribbon.
    if (e.type === 'oarfish') {
      const my = e.y + 30;
      const a2 = Math.atan2((player.y + 45) - my, player.x - e.x);
      enemyBullets.push({ x: e.x + 10, y: my, vx: Math.cos(a2) * 300, vy: Math.sin(a2) * 300, r: 9, life: 5, damage: 18, bubble: true });
      return;
    }
    // Giant moray: it does not shoot. Its "shot" is the strike — it coils back,
    // then dashes jaws-first (updateEnemies drives `lunge`), and the pharyngeal
    // jaw fires forward as a short-range bite the instant the dash commits.
    if (e.type === 'moray') {
      e.lunge = .62; e.jaw = 1;
      enemyBullets.push({ x: e.x + 34, y: e.y + 52, vx: Math.cos(aim) * 260, vy: Math.sin(aim) * 260, r: 10, life: 1.1, damage: 22, bubble: true });
      sfx('boom');
      return;
    }
    const speed = ['tank', 'turret', 'walker'].includes(e.type) ? 250 : ['glitch', 'racer', 'seeker'].includes(e.type) ? 330 : 205;
    const count = e.type === 'spinner' ? 3 : e.type === 'seeker' ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const base = aim + (i - (count - 1) / 2) * .2;
      enemyBullets.push({ x: e.x, y: e.y + e.h / 2, vx: Math.cos(base) * speed, vy: Math.sin(base) * speed, r: ['tank', 'walker'].includes(e.type) ? 11 : 8, life: 5, damage: ['tank', 'walker'].includes(e.type) ? 25 : 18, volt: e.type === 'seeker' });
    }
  }

  // Each boss leaves the field its own way. Three rules hold for all of them:
  // it never happens in act one, something is always still shooting while the
  // boss is gone, and the whole round is capped — the player's DPS is paused
  // for the duration, so it has to buy real spectacle.
  const BOSS_HIDE = [
    { style: 'afterimage', out: .55, away: 1.6, back: .70, cd: 15 },
    { style: 'submerge', out: .50, away: 2.0, back: .55, cd: 16 },
    { style: 'ascend', out: .60, away: 2.0, back: .55, cd: 14 },
    { style: 'glitchout', out: .35, away: 1.1, back: .35, cd: 11 },
    { style: 'throne', out: .70, away: 2.4, back: .90, cd: 13 },
  ];

  function startBossHide(e) {
    if (e.mode && e.mode.startsWith('hide')) return;
    const cfg = BOSS_HIDE[stageIndex];
    e.mode = 'hideOut'; e.hideClock = cfg.out; e.hideT = cfg.cd;
    e.homeX = VW - e.w - 40; e.homeY = e.y;
    e.hideAtk = 0; e.dissolve = 0; e.fade = 1; e.tel = 0; e.telType = null;
    sfx('teleport');
  }

  function updateBossHide(e, dt) {
    const cfg = BOSS_HIDE[stageIndex];
    e.hideClock -= dt;
    e.ghost = e.mode === 'hideAway';
    if (e.mode === 'hideOut') {
      hideExit(e, dt, cfg);
      if (e.hideClock <= 0) { e.mode = 'hideAway'; e.hideClock = cfg.away; e.hideAtk = 0; }
      return;
    }
    if (e.mode === 'hideAway') {
      hideAttack(e, dt);
      if (e.hideClock <= 0) { e.mode = 'hideBack'; e.hideClock = cfg.back; hideEnter(e); }
      return;
    }
    const k = Math.min(1, dt * 6);
    e.x += (e.homeX - e.x) * k; e.y += (e.homeY - e.y) * k;
    e.fade = 1 - clamp(e.hideClock / cfg.back, 0, 1);
    e.dissolve = Math.max(0, e.dissolve - dt / Math.max(.01, cfg.back));
    if (e.hideClock <= 0) {
      e.mode = 'hover'; e.x = e.homeX; e.y = e.homeY;
      e.fade = 1; e.ghost = false; e.dissolve = 0;
    }
  }

  function hideExit(e, dt, cfg) {
    const k = 1 - clamp(e.hideClock / cfg.out, 0, 1);
    if (cfg.style === 'afterimage') {
      // The mask slides out to the right leaving three decoys behind.
      e.x += 980 * dt; e.fade = 1 - k;
      if (!e.mirageMade) {
        e.mirageMade = true;
        // 40% scale, stacked with an alternating x offset. At full size the
        // three copies overlap into one continuous shape; this reads as three
        // separate figures while staying clear of the player's reach (x<893).
        const mw = e.w * .4, mh = e.h * .4;
        [30, 248, 466].forEach((my, i) => {
          enemies.push({ type: 'mirage', x: e.homeX + 40 + (i % 2) * 95, y: my, baseY: my, w: mw, h: mh, hp: 1, maxHp: 1, vx: 0, t: 0, wave: false, points: 0, fire: .9 });
        });
      }
    } else if (cfg.style === 'submerge') {
      e.y += 940 * dt; e.fade = 1 - k * .7;
      for (let i = 0; i < 3; i++) particles.push({ x: e.x + Math.random() * e.w, y: GROUND_Y + 90, vx: (Math.random() - .5) * 40, vy: -50 - Math.random() * 60, life: .8, max: .8, size: 4 + Math.random() * 4, color: '#65fff2', gravity: -60 });
    } else if (cfg.style === 'ascend') {
      e.y -= 1000 * dt; e.fade = 1 - k * .6;
      burstDebris(e.x + e.w * .5, e.y + e.h, ['#ff5a36', '#ffb347'], 2, 200);
    } else if (cfg.style === 'glitchout') {
      e.dissolve = k;
    } else {
      // throne: the queen rises with her skirt darkening half the screen.
      e.y -= 620 * dt; e.fade = 1 - k * .5;
    }
  }

  function hideAttack(e, dt) {
    const cfg = BOSS_HIDE[stageIndex];
    const D = difficulties[difficultyKey];
    e.hideAtk -= dt;
    if (cfg.style === 'afterimage') {
      if (e.hideAtk <= 0) { e.hideAtk = .9; for (const m of enemies) if (m.type === 'mirage') bossFan(m, 3); }
    } else if (cfg.style === 'submerge') {
      // Geysers: a short floor marker, then a column erupting out of the water.
      if (e.hideAtk <= 0) {
        e.hideAtk = .75;
        e.geyserX = clamp(player.x + 56 + (Math.random() - .5) * 420, 70, VW - 90);
        e.geyserT = .55;
      }
      if (e.geyserT > 0) { e.geyserT -= dt; if (e.geyserT <= 0) sirenRockSpout(e.geyserX); }
    } else if (cfg.style === 'ascend') {
      if (e.hideAtk <= 0) {
        e.hideAtk = .62;
        e.telX = clamp(player.x + 56 + (Math.random() - .5) * 260, 60, VW - 200);
        bossPillar(e.telX);
      }
    } else if (cfg.style === 'glitchout') {
      if (e.hideAtk <= 0) {
        e.hideAtk = .35; lightning = .35;
        bossStrike(clamp(player.x + 56 + (e.hideClock > .7 ? -95 : 95), 60, VW - 100));
      }
    } else {
      // throne: heart rain with a safe column sliding on a sine, so standing still loses.
      e.rainT = (e.rainT || 0) - dt;
      if (e.rainT <= 0) {
        e.rainT = .11 / D.barrage;
        const safeX = VW * .35 + Math.sin(e.t * 1.35) * VW * .26;
        const half = 95 * D.gapW;
        const x = 40 + Math.random() * (VW * .62);
        if (Math.abs(x - safeX) > half) enemyBullets.push({ x, y: -30, vx: 0, vy: 300, r: 10, life: 4, damage: 14, heart: true, grazeMul: .4 });
      }
    }
  }

  function hideEnter(e) {
    const cfg = BOSS_HIDE[stageIndex];
    if (cfg.style === 'afterimage') {
      // Reappear centred on whichever decoy survived, not at its top-left.
      const decoy = enemies.find(m => m.type === 'mirage');
      if (decoy) e.homeY = clamp(decoy.y + decoy.h / 2 - e.h / 2, 16, Math.max(40, VH - e.h - 24));
      for (const m of enemies) if (m.type === 'mirage') { burst(m.x + m.w / 2, m.y + m.h / 2, stages[0].accent, 18, 240); m.hp = 0; }
      e.mirageMade = false;
      e.x = e.homeX; e.y = e.homeY;
      bossFan(e, 9);
    } else if (cfg.style === 'submerge') {
      // Surfaces behind the player on the far left — the one moment she is flanked.
      e.x = 120; e.y = e.homeY;
      shockwaves.push({ x: e.x + e.w / 2, y: e.homeY + e.h / 2, r: 14, speed: 520, life: .8, max: .8, color: '#65fff2' });
      sirenOrbVolley(e); sfx('bubble');
    } else if (cfg.style === 'ascend') {
      // Comes down somewhere in the player's half — the only boss that can end
      // up on her left — and throws fire along the floor in both directions.
      e.x = 300 + Math.random() * 420; e.y = -e.h;
      shake = 26; flash = .5; sfx('fireball');
      const impact = e.x + e.w * .5;
      for (const dir of [0, Math.PI]) {
        hazards.push({
          kind: 'field', x: impact, y: GROUND_Y + 120, w: 900, h: 120 / difficulties[difficultyKey].gapW,
          ang: dir, warn: .42, live: .5, fade: .25, lock: 0, t: 0, damage: 20, color: '#ff8a35',
        });
      }
    } else if (cfg.style === 'glitchout') {
      e.x = clamp(VW - e.w - 80 - Math.random() * 200, 200, VW - e.w - 40);
      e.y = clamp(40 + Math.random() * 300, 16, Math.max(40, VH - e.h - 24));
      bossVoltRing(e); bossRailgun(e, 1);
    } else {
      e.x = VW * .5; e.y = -580;
      for (let i = 0; i < 3; i++) shockwaves.push({ x: VW * .5, y: 300, r: 10 + i * 40, speed: 480, life: .9, max: .9, color: '#ff3e9d' });
      bossHeartRing(e);
    }
  }

  // The defeated boss's last seconds: the ground rumbles the whole time, the
  // body settles slowly, and embers stream off it while the sprite burns away
  // strip by strip (drawDeathDissolve). Ends on one clean white pop.
  function updateDyingBoss(e, dt) {
    e.dying -= dt;
    const k = clamp(1 - e.dying / e.dyingMax, 0, 1);
    shake = Math.max(shake, 9 * (1 - k * .55));
    // The final queen has authored collapse poses; keep their shared baseline
    // stable so the kneeling/prone cells land on the floor instead of sliding
    // through it. Other bosses retain the old heavy downward settling motion.
    e.y += (e.type === 'boss' && stageIndex === 4 ? 3 : 12) * dt;
    for (let i = 0; i < 2; i++) {
      particles.push({
        x: e.x + Math.random() * e.w, y: e.y + Math.random() * e.h,
        vx: (Math.random() - .5) * 70, vy: -30 - Math.random() * 90,
        life: .5 + Math.random() * .6, max: 1.1, size: 3 + Math.random() * 5,
        color: Math.random() < .4 ? '#ffe15a' : Math.random() < .7 ? stages[stageIndex].accent2 : '#fff',
        gravity: -30,
      });
    }
    if (e.dying <= 0) {
      const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
      burst(cx, cy, '#fff', 34, 430);
      shockwaves.push({ x: cx, y: cy, r: 18, speed: 640, life: .8, max: .8, color: '#fff' });
      flash = Math.max(flash, .45); sfx('boom');
    }
  }

  // HP is cut into acts rather than one 50% flip. Crossing a line is an event:
  // the screen clears, a banner names the act, and the boss unlocks patterns.
  // The queen carries 3.2x the HP of stage one, so she gets an extra act.
  function bossTiers(idx) { return idx === 4 ? [.70, .40, .18] : [.55, .25]; }

  function bossBreak(e, idx) {
    clearEnemyFire();
    shake = 12 + e.tier * 5;
    flash = .40 + e.tier * .16;
    hitStop = Math.max(hitStop, .12 + e.tier * .03);
    shockwaves.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, r: 24, speed: 620, life: .85, max: .85, color: stages[idx].accent2 });
    shockwaves.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, r: 10, speed: 380, life: 1.1, max: 1.1, color: '#fff' });
    burst(e.x + e.w / 2, e.y + e.h / 2, stages[idx].accent2, 40, 420);
    burstDebris(e.x + e.w / 2, e.y + e.h / 2, ['#fff', stages[idx].accent], 14, 300);
    e.tierBanner = 1.9;
    sfx('boss');
    if (idx === 4) royalSfx('phase'); else sfx('bossSuperHit');
    bossVoice(idx, e.tier >= 2 ? 'attack' : 'serious');
    e.sp = .9; e.fire = .5;
    if (idx === 4 && e.tier === 1) summonConsorts(e);
    if (e.tier >= 1) startBossHide(e);
  }

  // One place that arms a telegraph, so every attack pays the same reaction tax.
  function bossTelegraph(e, type, sec, opts = {}) {
    e.telType = type; e.telMax = sec; e.tel = sec;
    e.telX = opts.x; e.telY = opts.y;
    if (stageIndex === 1) e.attackIdx = type === 'claw' ? 0 : type === 'tailslam' ? 2 : 1;
    if (stageIndex === 4) {
      e.attackIdx = type === 'cannon' ? 3 : type === 'ring' ? 2
        : type === 'lattice' || type === 'curtain' || type === 'curtain2' || type === 'wave' ? 1 : 0;
      royalSfx('charge');
    } else sfx('boss');
  }

  function updateBoss(e, dt) {
    const idx = stageIndex;
    stepPoseTimers(e, dt);
    if (e.mode && e.mode.startsWith('hide')) { updateBossHide(e, dt); return; }
    const parkX = VW - e.w - 40;
    if (e.x > parkX && e.mode !== 'dash' && e.mode !== 'return') e.x -= 250 * dt;
    const tiers = bossTiers(idx);
    const want = tiers.filter(t => e.hp <= e.maxHp * t).length;
    if (want > (e.tier || 0)) { e.tier = want; bossBreak(e, idx); }
    // phase2 stays as a derived value: the HUD, BGM, voice lines and the rage
    // multiplier all still read it.
    e.phase2 = (e.tier || 0) >= 1;
    e.tierBanner = Math.max(0, (e.tierBanner || 0) - dt);
    if (!e.crit && e.hp <= e.maxHp * .25) {
      e.crit = true;
      shake = Math.max(shake, 16); flash = Math.max(flash, .35);
      hitStop = Math.max(hitStop, .09);
      shockwaves.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, r: 20, speed: 620, life: .7, max: .7, color: BOSS_TINT[idx].crit });
      burstDebris(e.x + e.w / 2, e.y + e.h / 2, [BOSS_TINT[idx].crit, '#fff'], 22, 380);
      sfx('bossSuperHit'); bossVoice(idx, 'hurt');
      if (idx === 4) bossCrit = Math.max(bossCrit, .001);
    }
    const engaged = e.x < parkX + 30;
    const rageMul = [1, 1.14, 1.34, 1.5][e.tier || 0] / difficulties[difficultyKey].fireGap;
    e.fire -= dt * rageMul;
    e.sp = e.sp === undefined ? 3.5 : e.sp - dt * rageMul;
    // Retreats are gated on their own cooldown and never happen in act one.
    e.hideT = Math.max(0, (e.hideT === undefined ? BOSS_HIDE[idx].cd : e.hideT) - dt);
    if (e.tel > 0) {
      e.tel -= dt;
      // A rising rumble under the windup, so a long telegraph builds instead of waiting.
      shake = Math.max(shake, Math.pow(1 - e.tel / (e.telMax || 1), 3) * 7);
      if (e.tel <= 0) executeBossSpecial(e);
    } else if (e.followUp > 0) {
      e.followUp -= dt;
      if (e.followUp <= 0) { e.telType = e.followType; e.tel = .001; e.telMax = .001; }
    } else if (engaged && (e.tier || 0) >= 1 && e.hideT <= 0) {
      startBossHide(e);
      return;
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
        if (engaged && e.sp <= 0 && !(e.tel > 0)) {
          // From act two the mask adds the crossbeam scissors to the deck.
          const roll = Math.random();
          const pick = e.tier >= 1
            ? (roll < .34 ? 'crossbeam' : roll < .67 ? 'curtain' : 'dash')
            : 'dash';
          bossTelegraph(e, pick, telFor(pick === 'curtain' ? 90 : 70), {
            y: pick === 'curtain' ? clamp(player.y + 55, 130, 590) : clamp(player.y - 30, 40, 480),
          });
          e.sp = [5.2, 3.8, 3.0][e.tier || 0];
        }
      }
    } else if (idx === 1) {
      e.y = bobY(e.baseY + 30, 80);
      if (engaged && e.fire <= 0) { sirenOrbVolley(e); e.fire = e.phase2 ? .52 : .74; }
      if (engaged && e.sp <= 0 && !(e.tel > 0)) {
        const roll = Math.random();
        const pick = e.tier >= 2
          ? (roll < .34 ? 'claw' : roll < .67 ? 'abyssorb' : 'tailslam')
          : e.tier >= 1
            ? (roll < .48 ? 'claw' : roll < .78 ? 'abyssorb' : 'tailslam')
            : (roll < .58 ? 'claw' : 'abyssorb');
        bossTelegraph(e, pick, telFor(pick === 'tailslam' ? 90 : pick === 'abyssorb' ? 70 : 55), {
          x: clamp(player.x + 56, 100, VW - 120), y: clamp(player.y + 55, 100, 620),
        });
        e.sp = [4.7, 3.4, 2.8][e.tier || 0];
      }
    } else if (idx === 2) {
      e.y = bobY(e.baseY + 50, 55);
      if (engaged && e.fire <= 0) {
        if (e.phase2) { bossFlameSweep(e); e.fire = .12; } else { bossFireball(e); e.fire = .85; }
      }
      if (engaged && e.sp <= 0 && !(e.tel > 0)) {
        // Act two adds the horizontal heat press to the wall/pillar deck.
        const roll = Math.random();
        const pick = e.tier >= 1
          ? (roll < .34 ? 'heatbeam' : roll < .67 ? 'heatwall' : 'pillar')
          : 'pillar';
        bossTelegraph(e, pick, telFor(60), { x: clamp(player.x + 56, 90, VW - 140) });
        e.sp = [4.0, 2.8, 2.2][e.tier || 0];
      }
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
      if (engaged && e.sp <= 0 && !(e.tel > 0)) {
        const pick = e.tier >= 1 && Math.random() < .5 ? 'railgun' : 'strike';
        bossTelegraph(e, pick, pick === 'railgun' ? telFor(40) : telFor(60), { x: clamp(player.x + 56, 60, VW - 100) });
        e.sp = [3.8, 2.5, 2.0][e.tier || 0];
      }
    } else {
      // The queen in three acts: the pattern pool widens each time, and the
      // spiral gains arms. Her HP is untouched — length was never the problem.
      e.y = bobY(e.baseY + 35, 75);
      e.spiral = (e.spiral || 0) + dt * [2.4, 3.0, 3.4, 3.9][e.tier || 0];
      if (engaged && e.fire <= 0) {
        bossHeartSpiral(e, e.tier >= 2 ? 5 : e.tier >= 1 ? 3 : 2);
        e.fire = [.26, .20, .17, .15][e.tier || 0];
      }
      if (engaged && e.sp <= 0 && !(e.tel > 0)) {
        const pool = ['curtain', 'fan', 'lattice', 'ring', 'cannon'];
        const pick = pool[Math.floor(Math.random() * [2, 3, 4, 5][e.tier || 0])];
        bossTelegraph(e, pick, pick === 'cannon' ? telFor(40) : telFor(pick === 'curtain' ? 90 : 50), {
          y: clamp(player.y + 55, 130, 590),
        });
        e.sp = [4.0, 3.2, 2.6, 2.2][e.tier || 0];
      }
    }
  }

  // Consorts orbit the queen and shoot on their own clock. They are ordinary
  // enemies to every other system, so they die, score and collide normally.
  function updateConsort(e, dt) {
    const boss = enemies.find(b => b.type === 'boss');
    if (!boss) { e.hp = 0; return; }
    e.orbit += dt * 1.1;
    e.x = boss.x + boss.w * .35 + Math.cos(e.orbit) * 170;
    e.y = clamp(boss.y + boss.h * .45 + Math.sin(e.orbit) * 170, 20, VH - e.h - 30);
    e.fire -= dt / difficulties[difficultyKey].fireGap;
    if (e.fire <= 0) {
      e.fire = 1.6;
      const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
      const a = Math.atan2(player.y + 45 - cy, player.x + 40 - cx);
      enemyBullets.push({ x: cx, y: cy, vx: Math.cos(a) * 230, vy: Math.sin(a) * 230, r: 9, life: 6, damage: 14, heart: true, homing: .8 });
    }
  }

  function executeBossSpecial(e) {
    e.attackT = .6;
    // A battle cry on some attacks — throttled so it punctuates rather than spams.
    if (Math.random() < .6) bossVoice(stageIndex, 'attack', { throttle: 5.5 });
    const type = e.telType; e.telType = null;
    if (type === 'dash') { e.mode = 'dash'; e.y = e.telY; sfx('boss'); }
    else if (type === 'wave') { stageIndex === 4 ? bossHeartWall(e) : bossBubbleWall(e); }
    else if (type === 'pillar') bossPillar(e.telX);
    else if (type === 'strike') bossStrike(e.telX);
    else if (type === 'fan') bossFan(e, 7);
    else if (type === 'ring') bossHeartRing(e);
    else if (type === 'curtain') { bossCurtain(e, 0); e.followUp = .95; e.followType = 'curtain2'; }
    else if (type === 'curtain2') bossCurtain(e, 1);
    else if (type === 'heatwall') bossHeatWall(e);
    else if (type === 'crossbeam') bossCrossBeam(e);
    else if (type === 'heatbeam') bossHeatBeam(e);
    else if (type === 'flood') bossDataFlood(e);
    else if (type === 'claw') sirenClawRake(e);
    else if (type === 'abyssorb') sirenAbyssOrb(e);
    else if (type === 'tailslam') sirenTailSlam(e);
    else if (type === 'railgun') bossRailgun(e, e.phase2 ? 3 : 2);
    else if (type === 'cannon') bossHeartCannon(e);
    else if (type === 'lattice') bossRoseLattice(e);
  }

  function bossFan(e, n) {
    if (stageIndex === 4) { setBossAttackPose(e, 0, .62); e.fire = Math.max(e.fire, .72); }
    else e.attackT = .45;
    const ox = stageIndex === 4 ? e.x + e.w * .27 : e.x + 18;
    const oy = stageIndex === 4 ? e.y + e.h * .36 : e.y + e.h / 2;
    n = Math.max(5, Math.round((n + 2) * difficulties[difficultyKey].barrage));
    const aim = Math.atan2(player.y + 45 - oy, player.x - ox);
    for (let i = 0; i < n; i++) {
      const a = aim + (i - (n - 1) / 2) * .19;
      enemyBullets.push({ x: ox, y: oy, vx: Math.cos(a) * 285, vy: Math.sin(a) * 285, r: 10, life: 6, damage: 24, boss: true });
    }
    burst(ox, oy, '#ff3e9d', 15, 240); shake = Math.max(shake, 4);
    if (stageIndex === 4) royalSfx('cast');
  }

  function bossBubbles(e) {
    e.attackT = .45;
    const ox = e.x + 20, oy = e.y + e.h / 2;
    const aim = Math.atan2(player.y + 45 - oy, player.x - ox);
    for (let i = -1; i <= 1; i++) {
      const a = aim + i * .3;
      enemyBullets.push({ x: ox, y: oy, vx: Math.cos(a) * 190, vy: Math.sin(a) * 190, r: 11, life: 7, damage: 17, bubble: true, drift: 220 });
    }
    sfx('bubble');
  }

  function sirenOrbVolley(e) {
    setBossAttackPose(e, 1, .5); // attack2: both hands launch a purple orb
    const ox = e.x + 28, oy = e.y + e.h * .4;
    const aim = Math.atan2(player.y + 45 - oy, player.x + 40 - ox);
    for (const spread of [-.2, 0, .2]) {
      const a = aim + spread;
      enemyBullets.push({ x: ox, y: oy, vx: Math.cos(a) * 235, vy: Math.sin(a) * 235, r: 11, life: 6.5, damage: 18, abyss: true, drift: 42 });
    }
    burst(ox, oy, '#ca55ff', 12, 220); sfx('boss');
  }

  function sirenClawRake(e) {
    setBossAttackPose(e, 0, .72); // attack1: extended claws and painted slash arcs
    e.fire = Math.max(e.fire, .8);
    const ox = e.x + 30, oy = e.y + e.h * .36;
    const aim = Math.atan2(player.y + 45 - oy, player.x + 40 - ox);
    const n = Math.max(3, Math.round(4 * difficulties[difficultyKey].barrage));
    for (let i = 0; i < n; i++) {
      const a = aim + (i - (n - 1) / 2) * .18;
      enemyBullets.push({ x: ox, y: oy, vx: Math.cos(a) * 350, vy: Math.sin(a) * 350, r: 15, life: 4.2, damage: 23, claw: true, grazeMul: .55 });
    }
    burst(ox, oy, '#e45cff', 18, 300); shake = Math.max(shake, 8); sfx('hurt');
  }

  function sirenAbyssOrb(e) {
    setBossAttackPose(e, 1, .85); // attack2: the large illustrated magic sphere
    e.fire = Math.max(e.fire, .95);
    const ox = e.x + 26, oy = e.y + e.h * .4;
    const aim = Math.atan2(player.y + 45 - oy, player.x + 40 - ox);
    enemyBullets.push({ x: ox, y: oy, vx: Math.cos(aim) * 165, vy: Math.sin(aim) * 165, r: 30, life: 8, damage: 32, abyss: true, homing: .22, grazeMul: .35, giant: true });
    const satellites = Math.max(4, Math.round(5 * difficulties[difficultyKey].barrage));
    for (let i = 0; i < satellites; i++) {
      const a = aim + (i - (satellites - 1) / 2) * .16;
      enemyBullets.push({ x: ox, y: oy, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, r: 8, life: 6, damage: 15, abyss: true });
    }
    shockwaves.push({ x: ox, y: oy, r: 12, speed: 420, life: .7, max: .7, color: '#d75cff' });
    shake = Math.max(shake, 11); flash = Math.max(flash, .18); sfx('special');
  }

  function sirenTailSlam(e) {
    setBossAttackPose(e, 2, .9); // attack3: raised tail smashing rock and seabed
    e.fire = Math.max(e.fire, 1.0);
    const x = e.telX === undefined ? clamp(player.x + 56, 100, VW - 120) : e.telX;
    const D = difficulties[difficultyKey];
    const rocks = Math.max(7, Math.round(10 * D.barrage));
    for (let i = 0; i < rocks; i++) {
      const spread = (i - (rocks - 1) / 2) * 21;
      enemyBullets.push({ x: x + spread, y: 685 + Math.abs(spread) * .08, vx: spread * .32, vy: -430 - Math.random() * 170, gravity: 650, r: 10 + Math.random() * 6, life: 3.1, damage: 22, rock: true, grazeMul: .45 });
    }
    hazards.push({ kind: 'field', x, y: 650, w: 390, h: 72 / D.gapW, ang: Math.PI, warn: .08, live: .35, fade: .32, lock: 0, t: 0, damage: 28, color: '#b832ff' });
    burstDebris(x, 650, ['#6d5a75', '#c94cff', '#ffffff'], 26, 420);
    shockwaves.push({ x, y: 650, r: 18, speed: 560, life: .8, max: .8, color: '#d75cff' });
    shake = Math.max(shake, 18); flash = Math.max(flash, .25); sfx('bossQuake');
  }

  function bossBubbleWall(e) {
    // Opening measured in px and anchored to where the player was told to be.
    const half = 112 * difficulties[difficultyKey].gapW;
    const gapY = e.telY === undefined ? clamp(player.y + 55, 130, 590) : e.telY;
    for (let i = 0; i < 8; i++) {
      const y = 60 + i * 85;
      if (Math.abs(y - gapY) < half) continue;
      enemyBullets.push({ x: e.x - 30, y, vx: -235, vy: 0, r: 13, life: 8, damage: 20, bubble: true, grazeMul: .4 });
    }
    sfx('boss');
  }

  function bossFireball(e) {
    e.attackT = .45;
    const ox = e.x + 20, oy = e.y + e.h / 2;
    for (const lead of [0, 90, -90]) {
      enemyBullets.push({ x: ox, y: oy, vx: (player.x + lead - ox) / 1.3, vy: -300 - Math.random() * 110, gravity: 430, r: 12, life: 6, damage: 22, fire: true });
    }
    burst(ox, oy, '#ff8a35', 10, 200); sfx('fireball');
  }

  function bossFlameSweep(e) {
    e.attackT = .45;
    e.sweep = (e.sweep || 2.6) + .13;
    const a = Math.PI - Math.sin(e.sweep) * .85;
    const ox = e.x + 20, oy = e.y + e.h / 2;
    enemyBullets.push({ x: ox, y: oy, vx: Math.cos(a) * 330, vy: Math.sin(a) * 330, r: 10, life: 4, damage: 17, fire: true });
  }

  function bossPillar(x) {
    for (let i = 0; i < 8; i++) {
      enemyBullets.push({ x: x + (Math.random() - .5) * 26, y: 690 + i * 38, vx: 0, vy: -580, r: 13, life: 3.2, damage: 21, fire: true });
    }
    burst(x, 655, '#ff8a35', 26, 360); shake = Math.max(shake, 12); sfx('fireball');
  }

  function bossVoltShot(e) {
    e.attackT = .45;
    const ox = e.x + 20, oy = e.y + e.h / 2;
    const aim = Math.atan2(player.y + 45 - oy, player.x - ox);
    for (let i = -1; i <= 1; i++) {
      const a = aim + i * .22;
      enemyBullets.push({ x: ox, y: oy, vx: Math.cos(a) * 360, vy: Math.sin(a) * 360, r: 8, life: 5, damage: 18, volt: true });
    }
  }

  function bossStrike(x) {
    for (let i = 0; i < 9; i++) enemyBullets.push({ x: x + (Math.random() - .5) * 20, y: -30 - i * 42, vx: 0, vy: 660, r: 9, life: 2.6, damage: 21, volt: true });
    lightning = .45; lightningX = x; shake = Math.max(shake, 15); sfx('thunder');
  }

  function bossVoltRing(e) {
    e.attackT = .45;
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    const n = Math.max(10, Math.round(15 * difficulties[difficultyKey].barrage));
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      enemyBullets.push({ x: cx, y: cy, vx: Math.cos(a) * 240, vy: Math.sin(a) * 240, r: 8, life: 4, damage: 17, volt: true });
    }
    burst(cx, cy, '#72ff68', 10, 200);
  }

  function bossHeartSpiral(e, arms = 2) {
    setBossAttackPose(e, 2, .38);
    const cx = e.x + e.w * .27, cy = e.y + e.h * .36;
    for (let i = 0; i < arms; i++) {
      const a = e.spiral + i / arms * Math.PI * 2;
      enemyBullets.push({ x: cx, y: cy, vx: Math.cos(a) * 210, vy: Math.sin(a) * 210, r: 10, life: 6, damage: 21, heart: true, grazeMul: .7 });
    }
  }

  function bossHeartWall(e) {
    setBossAttackPose(e, 1, .72);
    e.fire = Math.max(e.fire, .82);
    // The opening is measured in pixels, not lanes: one 85px lane leaves 59px of
    // real clearance, narrower than the player's own 68px airborne hitbox.
    const half = 112 * difficulties[difficultyKey].gapW;
    const gapY = e.telY === undefined ? clamp(player.y + 55, 130, 590) : e.telY;
    for (let i = 0; i < 8; i++) {
      const y = 60 + i * 85;
      if (Math.abs(y - gapY) < half) continue;
      enemyBullets.push({ x: e.x - 30, y, vx: -245, vy: 0, r: 11, life: 8, damage: 24, heart: true, grazeMul: .4 });
    }
    royalSfx('cast');
  }

  function bossHeartRing(e) {
    setBossAttackPose(e, 2, .8);
    e.fire = Math.max(e.fire, .9);
    const cx = e.x + e.w * .27, cy = e.y + e.h * .36;
    const n = Math.max(8, Math.round(13 * difficulties[difficultyKey].barrage));
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      enemyBullets.push({ x: cx, y: cy, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, r: 10, life: 7, damage: 23, heart: true, homing: .5 });
    }
    burst(cx, cy, '#ff9ccf', 12, 210); royalSfx('cast');
  }

  // A full-height wall of shot with one corridor, opened at the height the
  // player was standing when the telegraph fired. At a real 168 px/s there is
  // no reaching a randomly placed gap, so anchoring it is the only fair option.
  function bossCurtain(e, side) {
    if (stageIndex === 4) { setBossAttackPose(e, 1, .68); e.fire = Math.max(e.fire, .78); }
    const D = difficulties[difficultyKey];
    const half = 112 * D.gapW;                    // easy 168 / normal 112 / hard 95
    const anchor = e.telY === undefined ? player.y + 55 : e.telY;
    const cy = side === 0 ? clamp(anchor, 45 + half, 655 - half)
                          : clamp(700 - anchor, 45 + half, 655 - half);
    const pitch = 62 / D.barrage;
    const sp = side === 0 ? 230 : 190;            // the answering wave is slower
    const tag = stageIndex === 4 ? { heart: true } : stageIndex === 1 ? { bubble: true }
              : stageIndex === 2 ? { fire: true } : stageIndex === 3 ? { volt: true } : {};
    for (let y = 45; y <= 665; y += pitch) {
      if (Math.abs(y - cy) < half) continue;
      enemyBullets.push({ x: VW + 26, y, vx: -sp, vy: 0, r: 12, life: 9, damage: 20, grazeMul: .4, ...tag });
    }
    e.curtainY = cy;
    if (stageIndex === 4) { if (side === 0) royalSfx('cast'); }
    else sfx('boss');
  }

  // Inverse of the curtain: columns of fire everywhere except the lane the
  // player already occupies, so the read is "hold still", plus floor rollers
  // to punish sitting on the ground.
  function bossHeatWall(e) {
    const D = difficulties[difficultyKey];
    const half = 100 * D.gapW;
    const safe = e.telX;
    for (const off of [-560, -370, -185, 185, 370, 560]) {
      const x = safe + off;
      if (x < 40 || x > VW - 60) continue;
      if (Math.abs(off) < half + 45) continue;
      bossPillar(x);
    }
    const rollers = Math.max(4, Math.round(6 * D.barrage));
    for (let i = 0; i < rollers; i++) {
      enemyBullets.push({ x: e.x - 20, y: 604 + i * 14, vx: -260, vy: 0, r: 14, life: 6, damage: 21, fire: true, grazeMul: .4 });
    }
  }

  function golemGeyser(x) {
    for (let i = 0; i < 10; i++) {
      enemyBullets.push({ x: x + (Math.random() - .5) * 34, y: 700 + i * 36, vx: 0, vy: -540, r: 14, life: 3.2, damage: 21, bubble: true, grazeMul: .4 });
    }
    burst(x, 660, '#65fff2', 26, 340); shake = Math.max(shake, 11); sfx('bubble');
  }

  function sirenRockSpout(x) {
    for (let i = 0; i < 9; i++) {
      enemyBullets.push({ x: x + (Math.random() - .5) * 48, y: 690 + i * 24, vx: (Math.random() - .5) * 90, vy: -500 - Math.random() * 130, gravity: 620, r: 10 + Math.random() * 5, life: 3, damage: 20, rock: true, grazeMul: .4 });
    }
    burstDebris(x, 660, ['#65516d', '#c94cff', '#ffffff'], 18, 360);
    shockwaves.push({ x, y: 660, r: 14, speed: 430, life: .65, max: .65, color: '#c94cff' });
    shake = Math.max(shake, 12); sfx('bossQuake');
  }

  // Three screen-wide bands staggered by .8s. The first lands on the player's
  // own row, so the opening move is always forced.
  function bossDataFlood(e) {
    const D = difficulties[difficultyKey];
    const h = 78 / D.gapW;
    const py = clamp(player.y + 55, 70, 640);
    const rows = [py, clamp(py - 240, 70, 640), clamp(py + 240, 70, 640)];
    rows.forEach((y, i) => hazards.push({
      kind: 'beam', x: 0, y, w: VW, h, ang: 0,
      warn: telFor(h / 2 + 34) + i * .8, live: .48, fade: .24, lock: 0, t: 0,
      damage: 33, color: '#65fff2',
    }));
    sfx('boss');
  }

  // MASQUERADE's scissors: two aimed diagonal beams crossing in an X — the
  // safe spot is the wedge between the blades.
  function bossCrossBeam(e) {
    const D = difficulties[difficultyKey];
    const cx = e.x + 30, cy = e.y + e.h * .4;
    const aim = Math.atan2(player.y + 55 - cy, player.x + 56 - cx);
    for (const off of [-.35, .35]) {
      hazards.push({
        kind: 'beam', x: cx, y: cy, w: 1500, h: 68 / D.gapW, ang: aim + off,
        warn: 1.1 * D.telMul, live: .32, fade: .22, lock: .65 * D.telMul, aim: false, t: 0,
        damage: 33, color: '#ff3e9d',
      });
    }
    burst(cx, cy, '#ff3e9d', 14, 260); shake = Math.max(shake, 6);
    sfx('boss');
  }

  // INFERNO DJINN's press: two horizontal flame bands that leave a corridor at
  // the player's row — hold the line to survive.
  function bossHeatBeam(e) {
    const D = difficulties[difficultyKey];
    const h = 90 / D.gapW;
    const py = clamp(player.y + 55, 130, 590);
    const gap = 105 * D.gapW;
    for (const y of [py - gap - h / 2, py + gap + h / 2]) {
      hazards.push({
        kind: 'beam', x: 0, y, w: VW, h, ang: 0,
        warn: telFor(h / 2 + 34), live: .52, fade: .26, lock: 0, t: 0,
        damage: 34, color: '#ff8a35',
      });
    }
    for (let i = 0; i < 3; i++) delayedBursts.push({ x: e.x + 30, y: e.y + e.h * .4, t: .18 + i * .26, color: '#ffb347' });
    shake = Math.max(shake, 6); sfx('boss');
  }

  // Tracks the player, then commits. The freeze is the whole mechanic: dodge
  // after the lock, not before.
  function bossRailgun(e, shots) {
    const D = difficulties[difficultyKey];
    const cx = e.x + 30, cy = e.y + e.h * .42;
    for (let i = 0; i < shots; i++) {
      hazards.push({
        kind: 'beam', x: cx, y: cy, w: 1500, h: 62 / D.gapW, ang: Math.PI,
        warn: 1.15 * D.telMul + i * .62, live: .28, fade: .22,
        lock: (i === 0 ? .72 : .62) * D.telMul, aim: true, t: 0,
        damage: 35, color: '#72ff68',
      });
    }
    lightning = .35; lightningX = e.x; shake = Math.max(shake, 8); sfx('thunder');
  }

  // The queen's signature: a band thick enough to own a third of the screen.
  // Deliberately static — a sweeping version is unavoidable at the player's
  // real top speed, so instead a second band answers on the opposite side.
  function bossHeartCannon(e) {
    setBossAttackPose(e, 3, 1.05);
    e.fire = Math.max(e.fire, 1.15);
    const D = difficulties[difficultyKey];
    const h = D.gapW > 1.2 ? 200 : D.gapW < .9 ? 320 : 280;
    const py = clamp(player.y + 55, 60, 660);
    hazards.push({
      kind: 'beam', x: e.x + e.w * .24, y: py, w: 1400, h, ang: Math.PI,
      warn: telFor(h / 2 + 34), live: .62, fade: .32, lock: 0, t: 0,
      damage: 38, color: '#ff3e9d',
    });
    for (let i = 0; i < 4; i++) delayedBursts.push({ x: e.x + e.w * .27, y: e.y + e.h * .36, t: .26 + i * .28, color: '#ff9ccf' });
    shake = Math.max(shake, 14); royalSfx('impact');
  }

  // Four arms whose bullets leave at staggered speeds, so the volley unrolls
  // into a rose instead of a flat ring.
  function bossRoseLattice(e) {
    setBossAttackPose(e, 1, .75);
    e.fire = Math.max(e.fire, .85);
    const D = difficulties[difficultyKey];
    const arms = 4, per = Math.max(7, Math.round(9 * D.barrage));
    const cx = e.x + e.w * .27, cy = e.y + e.h * .36;
    for (let a = 0; a < arms; a++) {
      const ang = (e.spiral || 0) + a / arms * Math.PI * 2;
      for (let i = 0; i < per; i++) {
        enemyBullets.push({ x: cx, y: cy, vx: Math.cos(ang) * (120 + i * 26), vy: Math.sin(ang) * (120 + i * 26), r: 10, life: 7, damage: 18, heart: true, grazeMul: .4 });
      }
    }
    burst(cx, cy, '#ff5a9d', 12, 220);
    royalSfx('cast');
  }

  // Two shootable hearts orbiting the queen from act two, so she can never be
  // the only thing on screen worth watching.
  function summonConsorts(e) {
    for (const side of [-1, 1]) {
      enemies.push({ type: 'consort', x: e.x + 40, y: e.y + e.h / 2, w: 74, h: 74, hp: 8, maxHp: 8, vx: 0, t: 0, wave: false, points: 400, fire: 1.6, orbit: side > 0 ? 0 : Math.PI });
    }
  }

  function applyTestMaxLoadout() {
    player.power = 3; player.spread = 3; player.speed = 3;
    health = maxHealth; ammo = ammoMax; ammoPackStock = AMMO_PACK_MAX;
    // Do not use the regular invincibility timer here: drawPlayer intentionally
    // blinks that state at 25% opacity, which made the max-loadout preview look
    // translucent. hurt() itself ignores damage in this localhost-only mode.
    charmStock = 3; player.inv = 0;
    if (special !== 100) { special = 100; updateSpecialButton(); }
    if (bombStock !== 3) { bombStock = 3; updateBombButton(); }
  }

  function update(dt) {
    if (state === 'menu' && !paused) {
      // Attract mode for the title screen: keep the neon backdrop animating
      // (elapsed drives it and resetGame() zeroes it anyway) and fly Gro-chan
      // in a lazy figure-eight under the logo.
      elapsed += dt;
      player.x = 585 + Math.sin(elapsed * .55) * 70;
      player.y = 342 + Math.sin(elapsed * 1.1) * 30;
      player.grounded = false; player.frame += dt * 8;
      bgCam += (((player.y - 360) / 360) * 14 - bgCam) * Math.min(1, dt * 3);
      bgCamX += ((clamp(-(player.x - 560) / 560, -1, 1) * 16 - bgCamX)) * Math.min(1, dt * 3);
      stepShoppers(dt);
    }
    if (state !== 'playing' || paused) return;
    if (testMaxLoadout) applyTestMaxLoadout();
    elapsed += dt;
    if (bossState === 'waiting') stageTime += dt;
    stageBanner = Math.max(0, stageBanner - dt);
    continueBanner = Math.max(0, continueBanner - dt);
    powerDownBanner = Math.max(0, powerDownBanner - dt);
    charmFlash = Math.max(0, charmFlash - dt);
    ammoBanner = Math.max(0, ammoBanner - dt);
    reloadFlash = Math.max(0, reloadFlash - dt);
    const phaseInfo = currentPhase(stageTime);
    activePhase = phaseInfo.phase; activeTIn = phaseInfo.tIn;
    if (activePhase.id !== lastPhaseId) { lastPhaseId = activePhase.id; setpieceStep = 0; }
    // Scroll speed follows the phase's intensity (boss fights run hot), eased to avoid jumps.
    const intensity = bossState === 'waiting' ? (activePhase.intensity ?? .5) : .8;
    const targetSpeed = 1 + intensity * .45 + stageIndex * .08;
    gameSpeed += (targetSpeed - gameSpeed) * Math.min(1, dt * 1.2);
    shake = Math.max(0, shake - dt * 25); flash = Math.max(0, flash - dt * 3);
    specialFlash = Math.max(0, specialFlash - dt);
    bossVoiceCd = Math.max(0, bossVoiceCd - dt);
    player.inv = Math.max(0, player.inv - dt);
    player.hit = Math.max(0, player.hit - dt);
    bgCam += (((player.y - 360) / 360) * 14 - bgCam) * Math.min(1, dt * 3);
    bgCamX += ((clamp(-(player.x - 560) / 560, -1, 1) * 16 - bgCamX)) * Math.min(1, dt * 3);
    // Drift the front bokeh orbs; recycle off the left edge with a fresh lane.
    for (const b of bokeh) {
      b.x -= b.spd * dt * gameSpeed;
      if (b.x < -b.r * 2) { b.x = VW + b.r + Math.random() * 260; b.y = 60 + Math.random() * 560; }
    }
    stepShoppers(dt);
    comboTimer -= dt;
    if (comboTimer <= 0) combo = 0;

    const difficulty = difficulties[difficultyKey];
    // The supplied full-length tracks replace the old generated note loop.

    const bossAt = timelineTotal();
    const midAt = midbossStart();
if (bossState === 'waiting' && !midBossDone && stageTime >= midAt) {
      bossState = 'midboss-warning'; bossWarning = 3.0; enemies = []; clearEnemyFire(); bullets = []; sfx('warning');
      playBgm('midBoss', true);
    } else if (bossState === 'midboss-warning') {
      bossWarning -= dt;
      if (bossWarning <= 0) spawnMidBoss();
    } else if (bossState === 'waiting' && midBossDone && stageTime >= bossAt) {
      bossState = 'warning'; bossWarning = 3.6; enemies = []; clearEnemyFire(); bullets = []; sfx('warning'); voice('bossAppear');
    } else if (bossState === 'waiting' && !midBossDone && stageTime >= bossAt) {
      // Safety: if mid was skipped somehow, force mid first
      bossState = 'midboss-warning'; bossWarning = 2.5; enemies = []; clearEnemyFire(); sfx('warning');
      playBgm('midBoss', true);
    } else if (bossState === 'warning') {
      bossWarning -= dt;
      if (bossWarning <= 0) spawnBoss();
    } else if (bossState === 'transition' || bossState === 'final') {
      stageTransition -= dt;
      if (stageTransition <= 0) {
        if (bossState === 'final') finishGame(true);
        else {
          // Interlude slide first ('story' freezes update()), then the rest
          // stop between stages: heal up / buy upgrades with earned yen.
          state = 'story';
          showStory(STORY.interludes[stageIndex], openShop);
        }
      }
    }

    let ax = padInput.x, ay = padInput.y;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) ax--;
    if (keys.has('ArrowRight') || keys.has('KeyD')) ax++;
    if (keys.has('ArrowUp') || keys.has('KeyW')) ay--;
    if (keys.has('ArrowDown') || keys.has('KeyS')) ay++;
    // Motion-command buffer: log 8-way direction *changes* (numpad encoding,
    // 5 = neutral) with timestamps. checkMotion consumes this for ↓↘→ etc.
    {
      const mdx = Math.abs(ax) > .35 ? Math.sign(ax) : 0;
      const mdy = Math.abs(ay) > .35 ? Math.sign(ay) : 0;
      const dir = 5 + mdx - mdy * 3;
      if (dir !== lastMotionDir) {
        lastMotionDir = dir;
        motionBuf.push({ dir, t: elapsed });
        if (motionBuf.length > 12) motionBuf.shift();
      }
    }
    const speedBoost = 1 + (player.speed - 1) * .32;
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
    const maxMoveSpeed = (player.grounded ? 380 : 420) * (1 + (player.speed - 1) * .28);
    if (speed > maxMoveSpeed) { player.vx *= maxMoveSpeed / speed; player.vy *= maxMoveSpeed / speed; }
    // Face the direction of travel: flip to look back while retreating (moving left).
    // Hysteresis on vx so a near-still drift doesn't cause the sprite to jitter.
    if (player.vx < -60) player.facing = -1;
    else if (player.vx > 60) player.facing = 1;
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
    // While shooting, always face forward (right) even when moving left — this is the
    // retreat-and-fire pose. The backward flip only applies when she isn't shooting.
    if (firing) player.facing = 1;
    const canShoot = firing && !['transition', 'final', 'warning', 'midboss-warning'].includes(bossState);
    // A fresh fire press first offers itself to the motion commands; on a
    // successful special the normal shot sits out a beat.
    const firePressed = firing && !wasFiring;
    wasFiring = firing;
    if (firePressed && tryCommandMove()) player.fire = Math.max(player.fire, .16);
    // Drive the gait by distance travelled, not by a fixed clock. This keeps the
    // boots planted instead of skating at low speed, and standing fire stays idle.
    const walking = player.grounded && Math.abs(player.vx) > 24;
    if (walking) {
      player.walkPhase += Math.abs(player.vx) * dt / 36;
      const nextStep = Math.floor(player.walkPhase / 2);
      if (nextStep !== player.walkStep) {
        player.walkStep = nextStep;
        burst(player.x + (player.vx > 0 ? 38 : 80), GROUND_Y + 153, '#8ffcff', 3, 48);
      }
    }
    player.frame += dt * (player.grounded ? 8 : 10);
    player.fire -= dt; player.missileFire -= dt;
    if (canShoot && player.fire <= 0) {
      // A stocked full-reload pack (shop only) fires automatically the instant
      // the mag would run dry, refilling to max before the pea-shot ever shows.
      if (ammo <= 0 && ammoPackStock > 0) {
        ammoPackStock--; ammo = ammoMax; reloadFlash = 1.6;
        const cx = player.x + player.w / 2, cy = player.y + player.h / 2;
        burst(cx, cy, '#a8ffa0', 30, 340); shockwaves.push({ x: cx, y: cy, r: 10, speed: 640, life: .6, max: .6, color: '#72ff68' });
        shake = Math.max(shake, 6); sfx('power');
      }
      if (ammo > 0) {
        ammo--;
        shoot();
        player.fire = player.grounded ? .12 : .13;
        if (ammo === 0) { ammoBanner = 2; sfx('shield'); }
      } else {
        shootPea();
        player.fire = .28;
      }
    }
    if (canShoot && player.power >= 2 && player.missileFire <= 0) {
      shootMissile();
      player.missileFire = player.power >= 3 ? .75 : 1.05;
    }

    spawnTimer -= dt;
    formationTimer -= dt;
    blockWallTimer -= dt;
    if (bossState === 'waiting' && stageBanner <= 1.2 && spawnTimer <= 0) {
      const inten = activePhase.intensity ?? .5;
      const mode = activePhase.mode;
      // Stage 1 keeps fewer enemies alive at once and leaves longer gaps between
      // waves, so the lane stays readable while the player is still learning.
      const easeCap = isStage1() ? STAGE1_EASE.cap : 0;
      // The quiet modes already run on caps of 3-5, so they only give back 1 —
      // the full -2 there would empty the lane instead of calming it.
      const easeCapLow = Math.min(easeCap, 1);
      const easeGap = isStage1() ? STAGE1_EASE.spawnGap : 1;
      if (mode === 'calm') {
        if (enemies.length < 3 - easeCapLow) spawnEnemy();
        spawnTimer = (1.4 + Math.random() * .8) * easeGap;
      } else if (mode === 'trickle') {
        if (enemies.length < 5 - easeCapLow) spawnEnemy();
        spawnTimer = (.7 + Math.random() * .4) * difficulty.spawn * easeGap;
      } else if (mode === 'setpiece') {
        // Scripted launches happen below; keep only a light filler trickle here.
        if (enemies.length < 4 - easeCapLow) spawnEnemy();
        spawnTimer = (1.1 + Math.random() * .5) * easeGap;
      } else if (mode === 'formation') {
        if (inten >= .5 && Math.random() < (.1 + .2 * inten) / easeGap) spawnFlanker();
        const cap = Math.round(7 + 4 * inten) + stageIndex - easeCap;
        if (enemies.length < cap) {
          spawnFormation(activePhase.elite);
          if (Math.random() < .4 && enemies.length < cap) spawnFormation(activePhase.elite);
        }
        spawnTimer = (1.2 + Math.random() * .5) * easeGap;
      } else { // assault
        // Hot phases also roll rear flankers so the player has to watch their back.
        if (inten >= .5 && Math.random() < (.1 + .2 * inten) / easeGap) spawnFlanker();
        // From stage 2 on, hot phases occasionally drop a destructible wall
        // zone in the lane (personal cooldown keeps them an event, not a wallpaper).
        if (stageIndex >= 1 && blockWallTimer <= 0 && Math.random() < .12) spawnBlockWall();
        const cap = Math.round(6 + 4 * inten) + stageIndex - easeCap;
        if (formationTimer <= 0 && enemies.length < cap) {
          spawnFormation();
          // Bonus second pack for volume
          if (Math.random() < .55 / easeGap && enemies.length < cap) spawnFormation();
          spawnTimer = (1.05 + Math.random() * .35) * easeGap;
        } else if (enemies.length < cap) {
          spawnEnemy();
          if (Math.random() < .45 / easeGap && enemies.length < cap) spawnEnemy();
          if (Math.random() < .44 * inten / easeGap && enemies.length < cap) spawnEnemy();
          spawnTimer = ((.32 + Math.random() * .28) * difficulty.spawn * easeGap) / (gameSpeed * (.6 + inten * .8));
        } else {
          spawnTimer = .35;
        }
      }
    }
    // Set-piece events fire at exact offsets within the phase, outside the spawnTimer gate.
    if (bossState === 'waiting' && stageBanner <= 1.2 && activePhase.mode === 'setpiece'
      && setpieceStep < SETPIECE_TIMES.length && activeTIn >= SETPIECE_TIMES[setpieceStep] * timeScale()) {
      runSetpiece(setpieceStep);
      setpieceStep++;
    }
    pickupTimer -= dt;
    if (pickupTimer <= 0 && (bossState === 'waiting' || bossState === 'active' || bossState === 'midboss-active')) {
      // Ammo carves a need-weighted slice off the front of the pool — a dry
      // player sees crates often, a full one rarely. A rare life capsule sits
      // behind it on stages 2+ (hard-capped per run).
      const ammoSlice = .10 + .25 * (1 - ammo / ammoMax);
      const lifeOk = stageIndex >= 1 && lifeDropsSpawned < 3;
      const roll0 = Math.random();
      let type;
      if (roll0 < ammoSlice) type = 'ammo';
      else if (lifeOk && roll0 < ammoSlice + .025) { type = 'life'; lifeDropsSpawned++; }
      else {
        const roll = Math.random();
        // Once all upgrades are maxed, mostly drop heals so 5-minute stages don't
        // shower the player with dead pickups.
        const allMaxed = player.power >= 3 && player.spread >= 3 && player.speed >= 3;
        const bombRoom = bombStock < 3;
        // Bomb carves a small slice out of the tail of each branch, falling back
        // to heal once stocked up so the drop pool doesn't waste rolls on it.
        type = allMaxed
          ? (roll < .74 ? 'heal' : roll < .81 ? 'power' : roll < .88 ? 'spread' : roll < .95 ? 'speed' : bombRoom ? 'bomb' : 'heal')
          : roll < .26 ? 'heal' : roll < .49 ? 'power' : roll < .70 ? 'spread' : roll < .91 ? 'speed' : bombRoom ? 'bomb' : 'heal';
      }
      pickups.push({ type, kind: type === 'heal' ? (Math.random() < .5 ? 'drink' : 'burger') : null, x: VW + 30, y: 100 + Math.random() * (VH - 240), r: 19, t: 0 });
      pickupTimer = (8 + Math.random() * 7) * (activePhase.mode === 'calm' ? 1.6 : 1);
    }

    for (const s of stars) { s.x -= s.s * 15 * dt * gameSpeed; s.a += dt * 2; if (s.x < -5) { s.x = VW + 5; s.y = Math.random() * VH * .75; } }
    for (const c of clouds) { c.x -= c.v * dt * gameSpeed; if (c.x < -220 * c.s) { c.x = VW + 150; c.y = 80 + Math.random() * 390; } }
    updateAmbient(dt);
    updateSceneLayers(dt);
    // Bikini trickle-regen. Fractional carries are accumulated and spent whole,
    // so HP and ammo tick up in visible steps instead of drifting by 0.02/frame.
    // Deliberately does NOT run while dead or during the between-stage lull.
    if (bikiniOn() && health > 0) {
      bikiniRegenHp += BIKINI_HP_PER_SEC * dt;
      if (bikiniRegenHp >= 1 && health < maxHealth) {
        const heal = Math.min(Math.floor(bikiniRegenHp), maxHealth - health);
        health += heal; bikiniRegenHp -= Math.floor(bikiniRegenHp);
        if (heal > 0 && Math.random() < .5) {
          particles.push({ x: player.x + 20 + Math.random() * 70, y: player.y + 100, vx: 0, vy: -70, life: .5, max: .5, color: '#7dffb0', size: 4, gravity: 0 });
        }
      } else if (health >= maxHealth) bikiniRegenHp = 0;
      bikiniRegenAmmo += BIKINI_AMMO_PER_SEC * dt;
      if (bikiniRegenAmmo >= 1 && ammo < ammoMax) {
        ammo = Math.min(ammoMax, ammo + Math.floor(bikiniRegenAmmo));
        bikiniRegenAmmo -= Math.floor(bikiniRegenAmmo);
      } else if (ammo >= ammoMax) bikiniRegenAmmo = 0;
    }
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
      // Slow incoming fire on easier settings so gaps are readable and dodgeable.
      const eb = difficulty.bulletSpeed;
      b.x += b.vx * dt * eb; b.y += b.vy * dt * eb; b.life -= dt;
      if (!b.grazed && player.inv <= 0) {
        const dx = b.x - (player.x + 56), dy = b.y - (player.y + 55);
        const grazeRange = b.r + 48;
        if (dx * dx + dy * dy < grazeRange * grazeRange) {
          // Wide patterns carry a reduced rate: a single big attack sweeping past
          // would otherwise hand back most of the bomb that answers it.
          b.grazed = true; special = Math.min(100, special + 2.2 * (b.grazeMul || 1)); score += 4;
          burst(b.x, b.y, '#ffe15a', 3, 80); sfx('graze');
        }
      }
    }
    for (const e of enemies) {
      e.t += dt;
      e.hit = Math.max(0, (e.hit || 0) - dt);
      if (e.dying > 0) { updateDyingBoss(e, dt); continue; }
      if (e.type === 'boss') { updateBoss(e, dt); continue; }
      if (e.type === 'midboss') { updateMidBoss(e, dt); continue; }
      if (e.type === 'consort') { updateConsort(e, dt); continue; }
      if (e.type === 'mirage') { e.fire -= dt; continue; }
      // Flankers sweep in from behind (left) and cross rightward, slightly slower.
      e.x -= (e.flank ? -.75 : 1) * e.vx * dt * gameSpeed * difficulty.speed;
      if (e.behavior === 'dive' && e.x < 1040 && e.x > 380) {
        const targetY = clamp(player.y + 20 + Math.sin(e.t * 5) * 45, 60, 575);
        e.baseY += (targetY - e.baseY) * dt * (e.type === 'racer' ? 2.8 : 1.55);
      } else if (e.behavior === 'stagger') {
        e.x += Math.sin(e.t * 5 + (e.formationSlot || 0)) * 70 * dt;
      } else if (e.behavior === 'snake') {
        // Whole-chain sine with a per-slot phase lag → the formation slithers
        // like one body instead of bobbing individually.
        e.y = clamp(e.baseY + Math.sin(e.t * 2.2 - (e.formationSlot || 0) * .55) * 130, 60, 600);
      }
      if (e.type === 'ember') {
        e.vy += 820 * dt; e.y += e.vy * dt;
        if (e.y >= e.baseY) { e.y = e.baseY; e.vy = -(330 + Math.random() * 200); burst(e.x + 20, e.y + 40, '#ff8a35', 5, 120); }
      } else if (e.type === 'glitch') {
        e.blink = Math.max(0, e.blink - dt);
        e.tp -= dt;
        if (e.tp <= 0) { e.tp = .8 + Math.random() * .7; e.y = clamp(e.y + (Math.random() - .5) * 260, 60, 580); e.blink = .22; burst(e.x + 29, e.y + 29, '#72ff68', 8, 170); }
      } else if (e.type === 'moray') {
        // Strike / recoil / hold. Base movement above already creeps it leftward
        // at its (deliberately low) vx; this branch only adds the strike itself,
        // so a moray crosses the lane in a couple of lunges rather than drifting.
        e.jaw = Math.max(0, (e.jaw || 0) - dt * 1.7);
        if (e.lunge > 0) {
          e.lunge -= dt;
          e.x -= 560 * dt * gameSpeed;
          e.y += ((player.y + 40) - e.y) * dt * 3.4;   // tracks Gro-chan mid-strike
          if (e.lunge <= 0) { e.recoil = .4; e.baseY = e.y; }
        } else if (e.recoil > 0) {
          e.recoil -= dt;
          e.x += 300 * dt * gameSpeed;                 // pulls its head back to coil again
        } else {
          e.y = e.baseY + Math.sin(e.t * 1.15) * 34;
        }
      } else if (e.wave) {
        const amp = e.type === 'bat' ? 55 : e.type === 'spinner' ? 42 : e.type === 'jelly' ? 74 : e.type === 'cupid' ? 62 : e.type === 'manta' ? 46 : e.type === 'knight' ? 28
          : e.type === 'dumbo' ? 66 : e.type === 'angler' ? 26 : e.type === 'oarfish' ? 52
            : e.type === 'crow' ? 48 : e.type === 'neonmoth' ? 68 : e.type === 'rivetbeetle' ? 34
              : e.type === 'cloudray' ? 56 : e.type === 'voltbug' ? 76 : e.type === 'packetwyrm' ? 42 : e.type === 'rosebud' ? 52 : 30;
        const freq = e.type === 'jelly' ? 1.5 : e.type === 'manta' ? 1.2 : e.type === 'cupid' ? 2.2 : e.type === 'knight' ? 1.7
          : e.type === 'dumbo' ? 1.1 : e.type === 'angler' ? .8 : e.type === 'oarfish' ? .9
            : e.type === 'crow' ? 2.4 : e.type === 'neonmoth' ? 1.35 : e.type === 'rivetbeetle' ? 2
              : e.type === 'cloudray' ? 1.1 : e.type === 'voltbug' ? 2.8 : e.type === 'packetwyrm' ? 1.25 : e.type === 'rosebud' ? 1.5 : 3.2;
        e.y = e.baseY + Math.sin(e.t * freq) * amp;
      }
      e.fire -= dt / (difficulty.fireGap * (isStage1() ? STAGE1_EASE.fire : 1));
      if (e.fire <= 0 && e.x < VW - 90) {
        enemyShoot(e);
        const cadence = e.type === 'tank' ? 1.1 : e.type === 'turret' ? 1.4 : e.type === 'spinner' ? 1.8 : e.type === 'glitch' ? 1.9 : e.type === 'cupid' ? 2 : e.type === 'racer' ? 1.5 : e.type === 'manta' ? 1.9 : e.type === 'walker' ? 1.25 : e.type === 'seeker' ? 1.45 : e.type === 'knight' ? 1.7
          : e.type === 'dumbo' ? 2.4 : e.type === 'angler' ? 2.2 : e.type === 'oarfish' ? 2.6 : e.type === 'moray' ? 2.9
            : e.type === 'alleycat' ? 2.1 : e.type === 'neonmoth' ? 2.35 : e.type === 'slagling' ? 2.4 : e.type === 'rivetbeetle' ? 1.9
              : e.type === 'furnacehound' ? 1.75 : e.type === 'cloudray' ? 2.1 : e.type === 'voltbug' ? 1.75 : e.type === 'packetwyrm' ? 2.2
                : e.type === 'rosebud' ? 2.15 : e.type === 'cardguard' ? 1.75 : e.type === 'teacup' ? 2.05 : 2.1 + Math.random();
        e.fire = cadence * (e.variant === 'elite' ? .76 : 1);
        e.fireMax = e.fire;
      }
    }
    for (const p of pickups) { p.x -= 130 * dt; p.t += dt; }
    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.gravity || 0) * dt; p.life -= dt; p.vx *= Math.pow(.08, dt); if (p.vr) p.rot = (p.rot || 0) + p.vr * dt; }
    for (const r of shockwaves) { r.r += r.speed * dt; r.life -= dt; }
    // Hazards run on one clock: [0,warn) telegraphs, [warn,warn+live) is lethal,
    // the rest is the afterglow. Aiming ones track the player until `lock`
    // seconds remain, then commit — that freeze is what makes them dodgeable.
    for (const hz of hazards) {
      hz.t += dt * difficulty.bulletSpeed;
      if (hz.aim && hz.t < hz.warn - hz.lock) {
        const want = Math.atan2(player.y + 55 - hz.y, player.x + 56 - hz.x);
        let d = want - hz.ang;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        hz.ang += clamp(d, -2.4 * dt, 2.4 * dt);
      }
    }
    hazards = hazards.filter(hz => hz.t < hz.warn + hz.live + hz.fade);
    if (bossCrit > 0 && bossCrit < 1) bossCrit = Math.min(1, bossCrit + dt * .9);
    for (const d of delayedBursts) {
      d.t -= dt;
      if (d.t <= 0) { burst(d.x, d.y, d.color, 18, 300); shake = Math.max(shake, 8); if (d.boom) sfx('boom'); }
    }
    delayedBursts = delayedBursts.filter(d => d.t > 0);

    collisions();
    bullets = bullets.filter(b => b.life > 0 && b.x < VW + 80 && b.y > -30 && b.y < VH + 30);
    enemyBullets = enemyBullets.filter(b => b.life > 0 && b.x > -40 && b.x < VW + 240 && b.y > -400 && b.y < VH + 400);
    // Bosses are exempt from the left cull: they leave the screen deliberately
    // during a retreat, and deleting one strands bossState in 'active' forever.
    // The moray gets a much later left cull than everything else: its head is
    // long past the edge while ~350px of body is still crossing the screen, and
    // culling on the head would delete the animal out from under its own tail.
    enemies = enemies.filter(e => (e.hp > 0 || e.dying > 0) && (e.type === 'boss' || e.x > (e.type === 'moray' ? -560 : -130)) && (!e.flank || e.x < VW + 170));
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
        if (b.life > 0 && e.hp > 0 && !e.ghost && circleRect(b.x, b.y, b.r, e.x, e.y, e.w, e.h)) {
          // Piercing shots pass through: each enemy takes a tick at most every
          // .3s (absolute-time stamp, no per-frame bookkeeping) and the bullet
          // keeps flying to hit whoever stands behind.
          if (b.pierce) {
            if ((e.pierceCd || 0) > elapsed) continue;
            e.pierceCd = elapsed + .3;
          } else b.life = 0;
          let damage = b.damage || 1;
          if (e.shield > 0) {
            const absorbed = Math.min(e.shield, damage); e.shield -= absorbed; damage -= absorbed;
            shockwaves.push({ x: b.x, y: b.y, r: 3, speed: 130, life: .24, max: .24, color: '#a8b7d6' }); sfx('shield');
          }
          e.hp -= damage; e.hit = .11; special = Math.min(100, special + .35 + (b.missile ? .5 : 0)); shake = 3; burst(b.x, b.y, '#31e8ff', 5, 150); burstDebris(b.x, b.y, ['#c9d6ec', '#8fa3c8'], 2, 140); sfx('hit');
          // Bosses hit back harder in feel: a heavier kick and chips in their own colour.
          if (e.type === 'boss' || e.type === 'midboss') {
            shake = Math.max(shake, e.crit ? 5 : 4);
            burstDebris(b.x, b.y, [BOSS_TINT[stageIndex].hit, '#ffffff'], 2, 200);
          }
          if (e.hp <= 0) destroyEnemy(e); else hitStop = Math.max(hitStop, .02);
          if (!b.pierce) break;
        }
      }
    }
    // One source of damage per frame. The body and bullet passes used to run
    // independently, so a contact hit and a bullet hit could both land in the
    // same frame for 56 damage and a double power-down.
    if (player.inv <= 0) {
      let struck = false;
      for (const e of enemies) {
        if (e.hp > 0 && !e.ghost && rects(hitX, hitY, hitW, hitH, e.x + (e.hitInset || 0), e.y + (e.hitInsetY || 0), e.w - (e.hitInset || 0) * 2, e.h - (e.hitInsetY || 0) * 2)) {
          if (e.type === 'block') {
            // Body-slamming a wall chips the block but hurts less than an
            // enemy ram — bulldozing through is possible, just costly.
            e.hp -= 4; e.hit = .2;
            if (e.hp <= 0) destroyEnemy(e);
            hurt(18); struck = true; break;
          }
          if (e.type !== 'boss' && e.type !== 'midboss') { e.hp = 0; destroyEnemy(e); }
          hurt(e.type === 'boss' ? 38 : e.type === 'midboss' ? 32 : 28); struck = true; break;
        }
      }
      if (!struck) for (const b of enemyBullets) {
        if (b.life > 0 && circleRect(b.x, b.y, b.r, hitX, hitY, hitW, hitH)) { b.life = 0; hurt(b.damage || 20); struck = true; break; }
      }
      if (!struck) for (const hz of hazards) {
        const el = hz.t - hz.warn;
        if (hz.dead || el < 0 || el > hz.live) continue;
        if (hazardHitsBox(hz, hitX, hitY, hitW, hitH)) {
          hz.dead = true;   // a given beam can only ever hit once
          hurt(Math.round(hz.damage * difficulties[difficultyKey].hazardDmg));
          struck = true; break;
        }
      }
    }
    for (const p of pickups) {
      if (!p.taken && circleRect(p.x, p.y, p.r, player.x, player.y, player.w, player.h)) {
        p.taken = true; score += 50; special = Math.min(100, special + 6);
        if (p.type === 'power') player.power = Math.min(3, player.power + 1);
        else if (p.type === 'spread') player.spread = Math.min(3, player.spread + 1);
        else if (p.type === 'speed') player.speed = Math.min(3, player.speed + 1);
        else if (p.type === 'bomb') { bombStock = Math.min(3, bombStock + 1); updateBombButton(); }
        else if (p.type === 'ammo') { ammo = Math.min(ammoMax, ammo + 40); }
        else if (p.type === 'life') { maxHealth += 15; health = Math.min(maxHealth, health + 15); voice('heal'); }
        else { health = Math.min(maxHealth, health + 32); voice('heal'); }
        burst(p.x, p.y, p.type === 'power' ? '#ff8a35' : p.type === 'spread' ? '#31e8ff' : p.type === 'speed' ? '#72ff68' : p.type === 'bomb' ? '#c9d6ec' : p.type === 'ammo' ? '#a8ffa0' : p.type === 'life' ? '#ffd76a' : '#ffe15a', 22, 260); sfx('power');
      }
    }
  }

  function destroyEnemy(e, allowChain = true) {
    combo++; comboTimer = 2.2;
    totalKills++; stageKills++;
    special = Math.min(100, special + (e.type === 'boss' ? 30 : e.type === 'midboss' ? 20 : e.variant === 'elite' ? 8 : 4));
    const mult = Math.min(5, 1 + Math.floor(combo / 5));
    // Money scale: points are legacy score values, paid out at 1/10 as yen.
    score += Math.round(e.points * mult * difficulties[difficultyKey].score / 10);
    if (e.type === 'block') {
      // Rubble reward: walls occasionally feed the ammo/heal economy.
      if (Math.random() < .14) {
        const t = Math.random() < .6 ? 'ammo' : 'heal';
        pickups.push({ type: t, kind: t === 'heal' ? (Math.random() < .5 ? 'drink' : 'burger') : null, x: e.x + e.w / 2, y: e.y + e.h / 2, r: 19, t: 0 });
      }
      burstDebris(e.x + e.w / 2, e.y + e.h / 2, ['#8fa3c8', '#5b6f94'], 6, 220);
    }
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
    const ex = e.x + e.w / 2, ey = e.y + e.h / 2;
    const organicKill = isOrganic(e.type);
    burst(ex, ey, e.type === 'bat' ? '#ff3e9d' : organicKill ? '#8ffcff' : '#ffe15a', isMajor ? (isBoss ? 90 : 55) : e.type === 'tank' ? 28 : 15, isMajor ? (isBoss ? 520 : 420) : e.type === 'tank' ? 330 : 240);
    // Machines throw shrapnel; creatures don't. Organics scatter pale scales and
    // a puff of their own colour instead of dark metal chunks.
    burstDebris(ex, ey, organicKill ? ['#cfe6ff', '#7fb8c9', '#3a5f72'] : [stages[stageIndex].accent2, '#5a4058', '#2a1f2c'], isMajor ? (isBoss ? 26 : 18) : e.type === 'tank' ? 12 : 7, isMajor ? 420 : e.type === 'tank' ? 300 : 220);
    // A dumbo octopus inks the water as it dies — the real animal's last resort.
    if (e.type === 'dumbo') burst(ex, ey, '#5a1a72', 18, 170);
    shake = isMajor ? (isBoss ? 28 : 20) : e.type === 'tank' ? 12 : 6; flash = isMajor ? (isBoss ? 1 : .6) : e.type === 'tank' ? .35 : .12; sfx(isMajor ? 'bigBoom' : 'boom');
    hitStop = Math.max(hitStop, isMajor ? (isBoss ? .12 : .09) : e.type === 'tank' ? .05 : .03);
    if (isMajor) {
      // FF-style death: the body stays on the field as a corpse and burns away
      // over a few seconds (updateDyingBoss / drawDeathDissolve) instead of
      // vanishing on the killing frame. The culling filter keeps it alive
      // while e.dying > 0; hp<=0 already makes it non-collidable everywhere.
      // Give the queen's authored fall enough screen time to read: stagger,
      // kneel, then remain down. Other bosses keep the compact dissolve.
      e.dying = e.dyingMax = isBoss && stageIndex === 4 ? 7.2 : isBoss ? 3.4 : 2.2;
      e.tel = 0; e.telType = null; e.mode = null; e.ghost = false; e.fade = 1;
      sfx('bossQuake');
    }
    if (isBoss) {
      // Her court dies with her.
      for (const m of enemies) {
        if (m.type === 'consort' || m.type === 'mirage') { burst(m.x + m.w / 2, m.y + m.h / 2, '#ff9ccf', 12, 220); m.hp = 0; }
      }
    }
    if (isMidBoss) {
      // No free heal — recovery comes from items (the mid boss drops one below).
      midBossDone = true; bossState = 'waiting'; clearEnemyFire(); bullets = [];
      special = Math.min(100, special + 30);
      // Ensure the post-mid stretch has volume before the main boss.
      stageTime = Math.max(stageTime, midbossStart() + 1.2);
      pickups.push({ type: 'power', x: e.x + e.w / 2, y: e.y + e.h / 2, r: 19, t: 0 });
      const drop = Math.random() < .5 ? 'spread' : 'heal';
      pickups.push({ type: drop, kind: drop === 'heal' ? (Math.random() < .5 ? 'drink' : 'burger') : null, x: e.x + e.w / 2 + 40, y: e.y + e.h / 2 - 20, r: 19, t: 0 });
      // The stage-3 mid boss guards the run's one guaranteed life capsule.
      if (stageIndex === 2) pickups.push({ type: 'life', x: e.x + e.w / 2 - 44, y: e.y + e.h / 2 + 16, r: 19, t: 0 });
      playBgm(`stage${stageIndex}`, true);
      stageBanner = 2.2;
    }
    if (isBoss) {
      bossState = stageIndex === stages.length - 1 ? 'final' : 'transition';
      // The final clear card waits until the queen has visibly hit the floor.
      // This also creates a deliberate breath before the ending cutscene.
      stageTransition = stageIndex === stages.length - 1 ? 10.5 : 4.6;
      clearEnemyFire(); bullets = []; musicStep = 0; musicClock = 0;
      sfx('bossCollapse'); sfx('thunder'); bossVoice(stageIndex, 'death');
      if (stageIndex === stages.length - 1) setTimeout(() => sfx('fireworks'), 650);
      const stage = stages[stageIndex];
      for (let i = 0; i < 14; i++) {
        delayedBursts.push({ x: e.x + Math.random() * e.w, y: e.y + Math.random() * e.h, t: .08 + i * .11, color: i % 3 ? '#ffe15a' : stage.accent2, boom: i % 2 === 0 });
      }
      const noDamageBonus = stageDamaged ? 0 : 500;
      const timeBonus = Math.max(0, Math.round((timelineTotal() + 120 - (elapsed - stageStart)) * 5));
      stageResult = { kills: stageKills, time: elapsed - stageStart, noDamageBonus, timeBonus };
      score += (noDamageBonus + timeBonus) * difficulties[difficultyKey].score;
    }
  }

  function hurt(damage) {
    if (testMaxLoadout) {
      health = maxHealth;
      player.inv = 0;
      return;
    }
    health = Math.max(0, health - damage * difficulties[difficultyKey].damage); player.inv = 1.4; player.hit = .45; combo = 0; shake = 18; flash = .7; hitStop = Math.max(hitStop, .07);
    stageDamaged = true;
    // Getting hit knocks the shot power down one level (Gradius-style risk/reward),
    // unless a stocked charm (shop-only) cancels this one demotion.
    if (player.power > 1) {
      if (charmStock > 0) { charmStock--; charmFlash = 1.2; sfx('shield'); }
      else { player.power--; powerDownBanner = 1.4; }
    }
    burst(player.x + player.w / 2, player.y + player.h / 2, '#ff3e9d', 28, 330); sfx('hurt');
    if (health <= 0) {
      if (continuesLeft > 0) doContinue();
      else finishGame(false);
    } else {
      voice('hurt');
    }
  }

  // Arcade-style in-place revive: full HP, brief invulnerability, bullet sweep.
  // Score / power-ups / position are all kept.
  function doContinue() {
    continuesLeft--;
    health = maxHealth;
    ammo = ammoMax;   // a revive never strands the player dry
    continueBanner = 3;
    player.inv = 4;
    bossCrit = 0;
    clearEnemyFire();
    const cx = player.x + player.w / 2, cy = player.y + player.h / 2;
    shockwaves.push({ x: cx, y: cy, r: 20, speed: 900, life: 1, max: 1, color: '#ffe15a' });
    burst(cx, cy, '#ffe15a', 40, 420);
    flash = .5; shake = 10;
    sfx('special');
  }

  // Between-stage shop: gameplay freezes (state 'shop' skips update()), the
  // player spends earned yen, then leaveShop() performs the stage advance that
  // used to happen inline in the transition timer.
  // The onigiri heals the same ballpark as an in-stage food drop (+32) — the
  // shop sells items, it doesn't hand out full recoveries.
  //
  // Every chip caps out, so a shop of only capped goods runs out of things to
  // sell long before the run ends and the money piles up with nowhere to go.
  // The vitamin is the uncapped sink: always purchasable, and its price climbs
  // each time so late money buys less and less rather than nothing at all.
  const VITAMIN_BASE = 2000, VITAMIN_STEP = 1200;
  const shopItems = [
    // Ordered to match the on-screen grid: attack stats, then immediate
    // recovery, then run-long insurance (charm / continues / max HP).
    { id: 'buyPower', price: () => 2600, can: () => player.power < 3, apply: () => player.power++, status: () => `Lv ${player.power}/3` },
    { id: 'buyWide', price: () => 2600, can: () => player.spread < 3, apply: () => player.spread++, status: () => `Lv ${player.spread}/3` },
    { id: 'buySpeed', price: () => 1800, can: () => player.speed < 3, apply: () => player.speed++, status: () => `Lv ${player.speed}/3` },
    { id: 'buyHeal', price: () => 600, can: () => health < maxHealth, apply: () => { health = Math.min(maxHealth, health + 40); }, status: () => `HP ${Math.ceil(health)}/${maxHealth}` },
    // The stage-transition top-up only reaches 60% — a full magazine is a purchase.
    { id: 'buyAmmo', price: () => 900, can: () => ammo < ammoMax, apply: () => { ammo = Math.min(ammoMax, ammo + 120); }, status: () => `いま ${ammo}/${ammoMax}` },
    // Stocked emergency full reloads (up to 5): auto-fire the instant the mag
    // hits empty, refilling to max before the pea-shot fallback ever shows —
    // same "buy a stock, it saves you automatically" shape as the charm.
    { id: 'buyBikini', price: () => 3200, keepStatus: true, can: () => !bikiniOwned, apply: () => { bikiniOwned = true; }, status: () => !bikiniOwned ? 'みしゅとく' : bikiniOn() ? 'そうびちゅう' : 'つぎのステージから' },
    { id: 'buyAmmoPack', price: () => 1200, can: () => ammoPackStock < AMMO_PACK_MAX, apply: () => ammoPackStock++, status: () => `もちもの ${ammoPackStock}/${AMMO_PACK_MAX}` },
    // Consumed automatically in hurt() to cancel one power-down — cheap
    // insurance against the Gradius-style demotion on getting hit.
    { id: 'buyCharm', price: () => 2200, can: () => charmStock < 3, apply: () => charmStock++, status: () => `のこり ${charmStock}/3` },
    // Continues start at 3 and can be stocked up to 5 — the shop must be able
    // to raise the count above the starting value, not just refill losses.
    { id: 'buyHeart', price: () => 4000, can: () => continuesLeft < 5, apply: () => continuesLeft++, status: () => `のこり ${continuesLeft}/5` },
    {
      id: 'buyMaxHp', price: () => VITAMIN_BASE + VITAMIN_STEP * vitaminsBought,
      can: () => true,
      apply: () => { vitaminsBought++; maxHealth += 15; health += 15; },
      status: () => `さいだい ${maxHealth}`,
    },
  ];
  shopItems.forEach(item => {
    item.btn = document.querySelector('#' + item.id);
    item.btn.addEventListener('click', () => {
      if (state !== 'shop' || !item.can() || score < item.price()) return;
      score -= item.price();
      item.apply();
      sfx('power');
      if (item.id === 'buyHeal' || item.id === 'buyMaxHp') voice('heal');
      updateShop();
    });
  });

  function updateShop() {
    shopMoney.textContent = yen(score);
    for (const item of shopItems) {
      const maxed = !item.can();
      const cost = item.price();
      item.btn.disabled = maxed || score < cost;
      item.btn.querySelector('.shop-status').textContent = maxed && !item.keepStatus ? 'MAX' : item.status();
      // Priced from the table rather than the markup, so the vitamin's rising
      // cost shows up on the button.
      item.btn.querySelector('.shop-price').textContent = maxed ? '—' : yen(cost);
    }
  }

  function openShop() {
    state = 'shop';
    voice('clear');
    shopNext.textContent = `STAGE ${stageIndex + 2}  ${stages[stageIndex + 1].name}`;
    updateShop();
    shopScreen.classList.add('is-visible');
    pauseButton.classList.remove('is-visible');
    specialButton.classList.remove('is-visible');
    bombButton.classList.remove('is-visible');
  }

  function leaveShop() {
    if (state !== 'shop') return;
    shopScreen.classList.remove('is-visible');
    // No automatic heal on stage clear — HP carries over; recovery is item-based
    // (in-stage drops or the shop's onigiri).
    stageIndex++; stageTime = 0; stageBanner = 3; bossState = 'waiting'; midBossDone = false; spawnTimer = 1.2; pickupTimer = 4;
    player.inv = 2;
    // Stage transition tops the magazine up to 60% — the shop's ammo pack is
    // the way to launch with a full one.
    ammo = Math.max(ammo, Math.round(ammoMax * .6));
    stageResult = null; bossCrit = 0; tintCache.clear(); setupStage(); musicStep = 0; musicClock = 0;
    state = 'playing';
    pauseButton.classList.add('is-visible');
    specialButton.classList.add('is-visible');
    bombButton.classList.add('is-visible');
    updateSpecialButton();
    updateBombButton();
    playBgm(`stage${stageIndex}`, true);
  }

  function finishGame(cleared) {
    state = 'over';
    gameShell.classList.toggle('is-game-over', !cleared);
    gameOverBlackout.classList.toggle('is-visible', !cleared);
    if (!cleared) playBgm('gameOver', true);
    voice(cleared ? 'clear' : 'gameover');
    pauseButton.classList.remove('is-visible', 'is-paused');
    specialButton.classList.remove('is-visible', 'is-ready');
    bombButton.classList.remove('is-visible', 'is-ready');
    pauseLabel.classList.remove('is-visible');
    if (cleared) score += 2500 * difficulties[difficultyKey].score;
    // Hard-mode clear unlocks the secret soundtrack page. The flag persists in
    // localStorage; links on the title/result screens follow it from then on.
    let soundtrackJustUnlocked = false;
    if (cleared && difficultyKey === 'hard' && !localStorage.getItem('grochan-hard-clear')) {
      localStorage.setItem('grochan-hard-clear', '1');
      soundtrackJustUnlocked = true;
    }
    refreshSoundtrackLinks(cleared);
    document.querySelector('#soundtrackUnlockNote')?.classList.toggle('is-hidden', !soundtrackJustUnlocked);
    resultTitle.textContent = cleared ? 'ALL CLEAR!' : 'GAME OVER';
    statKills.textContent = String(totalKills);
    statStage.textContent = cleared ? 'ALL' : `${stageIndex + 1} / ${stages.length}`;
    statTime.textContent = `${elapsed.toFixed(1)}s`;
    const record = score > highScore;
    if (record) { highScore = score; localStorage.setItem('grochan-money-best', String(highScore)); }
    finalScore.textContent = yen(score);
    menuHighScore.textContent = yen(highScore);
    newRecord.classList.toggle('is-hidden', !record);
    // On a full clear, roll the ending slides then the cameo screen; the RESULT
    // card follows once the player continues. A game over shows its own slide
    // before RESULT. The ending theme starts exactly when the cameo screen
    // appears, not underneath the preceding cutscene slides.
    clearTimeout(resultTimeout);
    if (cleared) resultTimeout = setTimeout(() => showStory(
      STORY.ending,
      () => { endingScreen.classList.add('is-visible'); playBgm('ending', true); },
      { typeDelay: 82 }
    ), 1200);
    else resultTimeout = setTimeout(() => showStory(STORY.gameover, () => gameOverScreen.classList.add('is-visible')), 450);
  }

  // On a full clear, the ending cameo hands off to a scrolling staff roll
  // (creditting the AI tools behind the game, aliased to their in-game
  // counterparts). The scroll runs once, then holds on a static FIN card —
  // it does NOT auto-advance to RESULT; a click / ENTER moves on at any time,
  // whether the roll is still scrolling or already resting on FIN.
  function showStaffRoll() {
    endingScreen.classList.remove('is-visible');
    staffRollFin.classList.remove('is-shown');
    staffRollScreen.classList.add('is-visible', 'is-rolling');
  }
  function landOnFin() { staffRollFin.classList.add('is-shown'); }
  function finishStaffRoll() {
    if (!staffRollScreen.classList.contains('is-visible')) return;
    staffRollScreen.classList.remove('is-visible', 'is-rolling');
    gameOverScreen.classList.add('is-visible');
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (.35 + Math.random() * .65);
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: .35 + Math.random() * .55, max: .9, color, size: 3 + Math.random() * 7, gravity: 90 });
    }
  }

  // Chunky angular debris (armor plating, casing fragments) that tumbles as it
  // flies — used alongside burst() for a heavier, more physical impact feel.
  function burstDebris(x, y, colors, count, speed) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (.4 + Math.random() * .6);
      const color = Array.isArray(colors) ? colors[i % colors.length] : colors;
      particles.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60,
        life: .4 + Math.random() * .5, max: .9, color, size: 6 + Math.random() * 10,
        gravity: 260, shape: 'shard', rot: Math.random() * Math.PI * 2, vr: (Math.random() - .5) * 14
      });
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
    drawForeground(stages[stageIndex]);
    // Foreground architecture may occlude sprites, but never the interface.
    if (state === 'playing' || state === 'over') drawHUD();
    if (state === 'menu' && menuStep === 'title') drawTitleScreen();
    ctx.restore();
    if (fpsShow) drawFpsMeter();
  }

  // Canvas-drawn title over the live Shibuya backdrop: neon logo, twinkling
  // stars, pulsing hearts. The HTML overlay keeps only the interactive parts
  // (difficulty select / start button) anchored to the bottom of the screen.
  function drawTitleScreen() {
    const t = elapsed;
    ctx.save();
    const wash = cachedGrad('titleWash', () => {
      const g = ctx.createLinearGradient(0, 0, 0, VH * .62);
      g.addColorStop(0, 'rgba(6,3,20,.78)');
      g.addColorStop(.55, 'rgba(6,3,20,.4)');
      g.addColorStop(1, 'rgba(6,3,20,0)');
      return g;
    });
    ctx.fillStyle = wash; ctx.fillRect(0, 0, VW, VH * .62);
    const cx = VW / 2, ly = 176 + Math.sin(t * 1.3) * 5;
    ctx.textAlign = 'center';
    const spark = [[150, 92], [318, 212], [986, 118], [1122, 238], [520, 66], [846, 252], [236, 60], [1046, 58]];
    ctx.fillStyle = '#ffe15a';
    spark.forEach(([sx, sy], i) => {
      const tw = Math.max(0, Math.sin(t * 2.2 + i * 1.7));
      if (tw < .25) return;
      ctx.globalAlpha = tw * .85;
      starPath(sx, sy, 3 + 7 * tw, 3, 4); ctx.fill();
    });
    ctx.globalAlpha = .9;
    ctx.fillStyle = '#31e8ff'; ctx.font = '12px "Press Start 2P", monospace';
    ctx.fillText('NEON KAWAII SHOOTER', cx, ly - 100);
    ctx.globalAlpha = 1;
    // Character-name tag: small, above the main logo (GRO-CHAN is the mascot,
    // SKY BLASTER is the game's actual title and gets the big glow treatment).
    ctx.font = '16px "Press Start 2P", monospace';
    ctx.fillStyle = '#ffd7ea';
    ctx.save(); ctx.shadowColor = '#ff3e9d'; ctx.shadowBlur = 10;
    ctx.fillText('GRO-CHAN', cx, ly - 64);
    ctx.restore();
    ctx.font = '48px "Press Start 2P", monospace';
    ctx.fillStyle = '#411c73'; ctx.fillText('SKY BLASTER', cx + 5, ly + 6);
    ctx.save();
    ctx.shadowColor = '#ff3e9d'; ctx.shadowBlur = 30;
    ctx.fillStyle = cachedGrad('titleLogo', () => {
      const g = ctx.createLinearGradient(0, 112, 0, 188);
      g.addColorStop(0, '#ffffff'); g.addColorStop(.45, '#ffd7ea'); g.addColorStop(1, '#ff3e9d');
      return g;
    });
    ctx.fillText('SKY BLASTER', cx, ly);
    ctx.restore();
    for (const side of [-1, 1]) {
      const pulse = 1 + Math.sin(t * 3 + side) * .12;
      ctx.save(); ctx.globalAlpha = .9; ctx.shadowColor = '#ff3e9d'; ctx.shadowBlur = 16;
      ctx.fillStyle = '#ff3e9d';
      heartPath(cx + side * 300, ly - 14, 17 * pulse); ctx.fill();
      ctx.restore();
    }
    // Single start prompt for the title screen: drawn as an actual button
    // (matches .main-button's yellow-fill + hard pink drop-shadow look) so it
    // reads as clickable rather than just decorative blinking text.
    ctx.font = '12px "Press Start 2P", monospace';
    const label = 'クリック / ENTER でスタート';
    const labelW = ctx.measureText(label).width;
    const padX = 22, padY = 15, btnW = labelW + padX * 2, btnH = padY * 2 + 12;
    const promptCx = cx, promptCy = ly + 55;
    const pulse = 1 + Math.sin(t * 2.4) * .035;
    ctx.save();
    ctx.translate(promptCx, promptCy); ctx.scale(pulse, pulse); ctx.translate(-promptCx, -promptCy);
    const btnX = promptCx - btnW / 2, btnY = promptCy - btnH / 2;
    ctx.fillStyle = '#ff3e9d';
    ctx.fillRect(btnX + 5, btnY + 5, btnW, btnH);
    ctx.fillStyle = '#ffe15a';
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.fillStyle = '#1c0a30';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, promptCx, promptCy + 1);
    ctx.restore();
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    ctx.restore();
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

  // A slow, low-amplitude sway shared by the backdrop and foreground so the
  // whole world gently breathes like a hand-held camera. Kept off the HUD and
  // gameplay sprites (which draw in drawGame) so only scenery drifts.
  function camBreath() { return { x: Math.sin(elapsed * .07) * 4, y: Math.cos(elapsed * .05) * 3 }; }

  // 64px tile of paired light/dark speckle, built once and reused as a repeating
  // pattern. Half the pixels lift and half drop by the same tiny amount, so it
  // dithers the sky's gradient steps away without tinting or brightening it.
  let skyDitherPattern;
  function skyDither() {
    if (skyDitherPattern !== undefined) return skyDitherPattern;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const img = g.createImageData(64, 64);
    for (let i = 0; i < 64 * 64; i++) {
      const v = Math.sin(i * 12.9898) * 43758.5453;
      const f = v - Math.floor(v);
      const tone = f < .5 ? 0 : 255;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = tone;
      // Deliberately near-invisible: dither you can see is just noise.
      img.data[i * 4 + 3] = 2 + ((f * 100) % 5);
    }
    g.putImageData(img, 0, 0);
    skyDitherPattern = ctx.createPattern(c, 'repeat');
    return skyDitherPattern;
  }

  function drawBackdrop() {
    const stage = stages[stageIndex];
    const br = camBreath();
    ctx.save();
    ctx.translate(br.x, br.y);
    const g = cachedGrad('sky' + stageIndex, () => {
      const grad = ctx.createLinearGradient(0, 0, 0, VH);
      grad.addColorStop(0, stage.sky[0]); grad.addColorStop(.52, stage.sky[1]); grad.addColorStop(1, stage.sky[2]);
      return grad;
    });
    ctx.fillStyle = g; ctx.fillRect(-30, -30, VW + 60, VH + 60);
    // A three-stop gradient stretched over 720px bands visibly on a flat panel.
    // One tile of paired light/dark noise breaks the steps up without shifting
    // the sky's brightness — the cheapest realism in the whole backdrop.
    const dp = skyDither();
    if (dp) { ctx.save(); ctx.fillStyle = dp; ctx.fillRect(-30, -30, VW + 60, VH + 60); ctx.restore(); }
    const dir = backgroundDirector();
    // Chapter tint goes under the scenery — it should read as the light in the
    // air, not as a filter over the buildings.
    drawChapterWash(stage, dir);
    const theme = stage.theme;
    if (theme === 'neon') drawNeonBackdrop(stage);
    else if (theme === 'aqua') drawAquaBackdrop(stage);
    else if (theme === 'factory') drawFactoryBackdrop(stage);
    else if (theme === 'storm') drawStormBackdrop(stage);
    else drawPalaceBackdrop(stage);
    // Landmarks and inhabitants must come AFTER the theme backdrop: several
    // backdrops (neon especially) repaint the whole sky band opaquely, so
    // anything drawn under them is simply erased. They stay below the volume
    // pass, so real foreground geometry still occludes them.
    drawFarLandmarks(stage, dir);
    drawMotes(stage, dir, true);
    drawLifeLayer(stage, dir);
    // A dedicated volume pass sits above the flat scenic layers but below
    // particles/gameplay. Every stage gets large objects with visible top/side
    // faces, a shared vanishing point and strong scale separation.
    drawStageVolume(stage);
    // The route is more than a looping panorama: phase, mid-boss and boss state
    // direct one-off scenic beats and lighting changes for the whole stage.
    // Kept below ambient/gameplay so even the largest spectacle cannot cover
    // enemies, bullets or the HUD.
    drawStageDirection(stage);
    drawAmbient();
    drawNearScenery(stage);
    drawMotes(stage, dir, false);
    drawAtmosphere(stage);
    ctx.restore();
  }

  // Vertical camera parallax: layers shift with the player's height. The gameplay
  // plane is the focal plane (zero shift), far layers shift most, foreground
  // shifts the opposite way. bgCam is eased in update().
  function bgLayer(depth, fn) {
    ctx.save();
    ctx.translate(bgCamX * depth, bgCam * depth);
    fn();
    ctx.restore();
  }

  // --- Route-aware background direction ---------------------------------
  // Stateless by design: ?stage, Shift+T/M/B and continues can jump anywhere
  // in the route without leaving an animation controller out of sync.
  const BG_PHASE_ORDER = ['opening', 'buildup', 'formationA', 'breather1', 'midboss', 'recover', 'assault2', 'setpiece', 'breather2', 'eliteRush', 'finalPush'];
  // Each 5-minute route is read as three chapters. The chapter index drives the
  // far-landmark set, the light wash and the mote colour, so the stage reads as
  // a journey rather than one looping panorama. Derived from stageTime, so it
  // stays stateless like the rest of the director.
  const CHAPTERS = 3;
  function backgroundDirector() {
    const route = clamp(stageTime / Math.max(1, timelineTotal()), 0, 1);
    const phaseIndex = Math.max(0, BG_PHASE_ORDER.indexOf(activePhase.id));
    const boss = ['warning', 'active', 'transition', 'final'].includes(bossState);
    const mid = ['midboss-warning', 'midboss-active'].includes(bossState);
    const setpiece = bossState === 'waiting' && activePhase.mode === 'setpiece';
    const setT = setpiece ? clamp(activeTIn / Math.max(1, activePhase.dur * timeScale()), 0, 1) : 0;
    const warning = bossState === 'warning' || bossState === 'midboss-warning';
    const energy = boss ? 1 : mid ? .78 : clamp((activePhase.intensity || .25) * .82 + route * .18, .18, 1);
    // Boss fights pin the final chapter: the arena shouldn't slide back to the
    // opening vista just because the fight ran past the timeline total.
    const chapF = boss || mid ? CHAPTERS - .001 : clamp(route, 0, .999) * CHAPTERS;
    const chapter = Math.floor(chapF);
    const chapterT = chapF - chapter;                 // 0..1 progress inside it
    const chapterIn = clamp(chapterT * 5, 0, 1);      // cross-fade at the seam
    return { route, phaseIndex, boss, mid, setpiece, setT, warning, energy, chapter, chapterT, chapterIn, q: bgQuality() };
  }

  // --- Scene chapters, inhabitants and weather ---------------------------
  // One shared implementation; each theme supplies parameters. That keeps all
  // five stages moving in step instead of drifting into five bespoke systems.
  //
  // NOTE ON COST: the frame is fill-rate bound, not JS bound (a CPU profile of
  // the palace runs ~90% idle while the frame still costs 16ms). So detail is
  // added as many SMALL marks rather than more full-screen blended layers, and
  // nothing here uses shadowBlur or a screen-sized gradient.

  // Per-chapter far-landmark silhouettes + light wash. `band` is the y range
  // the landmarks occupy, `wash` tints the sky for that leg of the route.
  const SCENE_CHAPTERS = {
    neon: [
      { label: '繁華街', wash: '#ff3e9d', washA: .05, mote: '#ffd6f2' },
      { label: '高速道路', wash: '#31e8ff', washA: .07, mote: '#cfefff' },
      { label: 'タワー直下', wash: '#8a6cff', washA: .09, mote: '#e0d4ff' }
    ],
    aqua: [
      { label: '沿岸', wash: '#65fff2', washA: .05, mote: '#dffffb' },
      { label: '外洋', wash: '#2f8cff', washA: .07, mote: '#bfe4ff' },
      { label: '深海', wash: '#041b3d', washA: .12, mote: '#8fd8ff' }
    ],
    factory: [
      { label: '搬入路', wash: '#ff9f43', washA: .05, mote: '#ffd9a8' },
      { label: '溶鉱炉', wash: '#ff5a36', washA: .08, mote: '#ffb98a' },
      { label: '排熱塔', wash: '#ffe15a', washA: .07, mote: '#ffe9b8' }
    ],
    storm: [
      { label: '外縁', wash: '#72ff68', washA: .05, mote: '#c9ffc4' },
      { label: '演算層', wash: '#31e8ff', washA: .07, mote: '#bff6ff' },
      { label: '中枢', wash: '#48b849', washA: .09, mote: '#d8ffd4' }
    ],
    palace: [
      { label: '外苑', wash: '#ffe15a', washA: .05, mote: '#ffe9c0' },
      { label: '回廊', wash: '#ff3e9d', washA: .07, mote: '#ffd0e8' },
      { label: '玉座前', wash: '#d82065', washA: .10, mote: '#ffc0dc' }
    ]
  };

  // Background inhabitants. Each entry: n=count, y=[min,max] spawn band,
  // sc=[min,max] scale, v=[min,max] px/s drift, depth=parallax factor.
  const LIFE = {
    neon: [
      { kind: 'birdV', n: 3, y: [90, 200], sc: [.5, .9], v: [26, 46], depth: .22 },
      { kind: 'copter', n: 2, y: [120, 260], sc: [.6, 1], v: [34, 58], depth: .3 },
      { kind: 'blimp', n: 1, y: [110, 190], sc: [.9, 1.2], v: [12, 20], depth: .18 }
    ],
    aqua: [
      { kind: 'school', n: 4, y: [300, 520], sc: [.6, 1.1], v: [30, 62], depth: .34 },
      { kind: 'gull', n: 3, y: [90, 210], sc: [.5, .9], v: [40, 70], depth: .24 },
      { kind: 'ray', n: 2, y: [340, 470], sc: [.7, 1.1], v: [18, 32], depth: .3 }
    ],
    factory: [
      { kind: 'pod', n: 3, y: [150, 300], sc: [.6, 1], v: [40, 74], depth: .3 },
      { kind: 'copter', n: 2, y: [110, 230], sc: [.5, .85], v: [30, 52], depth: .26 },
      { kind: 'crow', n: 3, y: [130, 260], sc: [.45, .8], v: [34, 60], depth: .22 }
    ],
    storm: [
      { kind: 'moth', n: 5, y: [140, 420], sc: [.5, .95], v: [26, 56], depth: .3 },
      { kind: 'sentry', n: 2, y: [120, 280], sc: [.6, 1], v: [22, 40], depth: .26 },
      { kind: 'pod', n: 2, y: [180, 330], sc: [.5, .85], v: [38, 66], depth: .3 }
    ],
    palace: [
      { kind: 'wisp', n: 5, y: [180, 460], sc: [.5, 1], v: [14, 30], depth: .28 },
      { kind: 'dove', n: 3, y: [120, 280], sc: [.5, .9], v: [30, 54], depth: .24 },
      { kind: 'banner', n: 2, y: [100, 200], sc: [.8, 1.1], v: [10, 18], depth: .16 }
    ]
  };

  // Airborne particulate, two depth bands. `drift` is the sideways bias and
  // `fall` the vertical one, so one pool covers snow-like, rising and
  // sideways-blown looks without per-theme update code.
  const WEATHER = {
    neon: { n: 26, fall: [10, 34], drift: [-46, -14], size: [1.5, 3.4], a: .30, shape: 'streak' },
    aqua: { n: 30, fall: [-30, -8], drift: [-26, -6], size: [1.5, 3.8], a: .26, shape: 'dot' },
    factory: { n: 28, fall: [-16, 26], drift: [-58, -20], size: [1.5, 3.6], a: .30, shape: 'dot' },
    storm: { n: 26, fall: [16, 52], drift: [-70, -30], size: [1.2, 3], a: .28, shape: 'streak' },
    palace: { n: 26, fall: [12, 34], drift: [-34, -10], size: [2, 4.4], a: .28, shape: 'petal' }
  };

  const rand = (lo, hi) => lo + Math.random() * (hi - lo);

  function initSceneLayers() {
    const theme = stages[stageIndex].theme;
    lifeAgents = [];
    for (const spec of LIFE[theme] || []) {
      for (let i = 0; i < spec.n; i++) {
        lifeAgents.push({
          kind: spec.kind, depth: spec.depth,
          x: Math.random() * (VW + 300) - 150, y: rand(spec.y[0], spec.y[1]),
          sc: rand(spec.sc[0], spec.sc[1]), v: rand(spec.v[0], spec.v[1]),
          dir: Math.random() < .78 ? -1 : 1,       // mostly with the scroll
          phase: Math.random() * 6.28, seed: Math.random() * 1000
        });
      }
    }
    const w = WEATHER[theme];
    motes = [];
    if (w) {
      for (let i = 0; i < w.n; i++) {
        motes.push({
          x: Math.random() * (VW + 120) - 60, y: Math.random() * (VH + 80) - 40,
          vy: rand(w.fall[0], w.fall[1]), vx: rand(w.drift[0], w.drift[1]),
          s: rand(w.size[0], w.size[1]), spin: Math.random() * 6.28,
          spinV: rand(-2, 2), far: i % 2 === 0, a: rand(.55, 1)
        });
      }
    }
  }

  function updateSceneLayers(dt) {
    const speed = gameSpeed;
    for (const a of lifeAgents) {
      a.x += a.dir * a.v * dt * (a.dir < 0 ? speed : 1);
      a.phase += dt * (1.4 + a.sc);
      if (a.dir < 0 && a.x < -220) { a.x = VW + rand(40, 260); a.y = rand(80, 470); }
      else if (a.dir > 0 && a.x > VW + 220) { a.x = -rand(40, 260); a.y = rand(80, 470); }
    }
    for (const m of motes) {
      const par = m.far ? .55 : 1.25;      // near motes travel visibly faster
      m.x += m.vx * dt * par * speed; m.y += m.vy * dt * par;
      m.spin += m.spinV * dt;
      if (m.x < -70) m.x = VW + 60;
      if (m.x > VW + 70) m.x = -60;
      if (m.y > VH + 50) m.y = -40;
      if (m.y < -50) m.y = VH + 40;
    }
  }

  function drawStageDirection(stage) {
    const d = backgroundDirector();
    if (stage.theme === 'neon') drawNeonDirection(stage, d);
    else if (stage.theme === 'aqua') drawAquaDirection(stage, d);
    else if (stage.theme === 'factory') drawFactoryDirection(stage, d);
    else if (stage.theme === 'storm') drawStormDirection(stage, d);
    else drawPalaceDirection(stage, d);
    drawScenicLightEcho(stage, d);
  }

  // --- Chapter light wash ------------------------------------------------
  // One gradient per frame tinting the upper half toward the current chapter's
  // colour. Cheap (a single fill) and it does most of the work of making the
  // three legs of a route feel like different places.
  function drawChapterWash(stage, d) {
    const set = SCENE_CHAPTERS[stage.theme];
    if (!set || !sceneLayersOn) return;
    const cur = set[Math.min(set.length - 1, d.chapter)];
    const prev = set[Math.max(0, Math.min(set.length - 1, d.chapter - 1))];
    const mix = d.chapterIn;
    ctx.save();
    for (const [c, w] of [[prev, 1 - mix], [cur, mix]]) {
      if (w <= .01) continue;
      const g = ctx.createLinearGradient(0, 0, 0, VH * .82);
      g.addColorStop(0, hexA(c.wash, c.washA * w * (.75 + d.energy * .45)));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(-30, -30, VW + 60, VH * .82);
    }
    ctx.restore();
  }

  // --- Background inhabitants --------------------------------------------
  // Small, cheap silhouettes that move on their own clock. Volume of *marks*
  // is what sells a living world; none of these is bigger than ~40px.
  function drawLifeLayer(stage, d) {
    if (d.q <= 0 || !sceneLayersOn) return;
    const dim = d.boss ? .5 : 1;   // don't compete with the boss for attention
    for (const a of lifeAgents) {
      ctx.save();
      ctx.translate(a.x + bgCamX * a.depth, a.y + bgCam * a.depth);
      ctx.scale(a.dir < 0 ? a.sc : -a.sc, a.sc);
      ctx.globalAlpha = .5 * dim;
      drawLifeAgent(a, stage);
      ctx.restore();
    }
  }

  function drawLifeAgent(a, stage) {
    const flap = Math.sin(a.phase * 3);
    if (a.kind === 'birdV' || a.kind === 'gull' || a.kind === 'crow' || a.kind === 'dove') {
      // A little skein of 3, each wing-beat phase-offset so the group ripples.
      const col = a.kind === 'crow' ? '#1b1226' : a.kind === 'dove' ? '#ffe9f4' : a.kind === 'gull' ? '#eaf6ff' : '#20143a';
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.lineCap = 'round';
      const n = a.kind === 'birdV' ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const bx = i * 15, by = Math.abs(i - 1) * 8 + Math.sin(a.phase * 3 + i) * 2;
        const w = 8 + Math.sin(a.phase * 3 + i * .8) * 5;
        ctx.beginPath();
        ctx.moveTo(bx - 9, by + w * .5); ctx.quadraticCurveTo(bx, by - 2, bx + 9, by + w * .5);
        ctx.stroke();
      }
      return;
    }
    if (a.kind === 'school') {
      // Fish school: a tight cloud of darts sharing one sine.
      ctx.fillStyle = hexA(stage.accent, .8);
      for (let i = 0; i < 7; i++) {
        const fx = (i % 4) * 13, fy = Math.floor(i / 4) * 11 + Math.sin(a.phase * 2 + i * .7) * 3;
        ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + 9, fy + 2.5); ctx.lineTo(fx, fy + 5);
        ctx.closePath(); ctx.fill();
      }
      return;
    }
    if (a.kind === 'ray') {
      ctx.fillStyle = hexA(stage.accent2, .7);
      const w = 26, h = 7 + flap * 3;
      ctx.beginPath(); ctx.moveTo(-w, 0);
      ctx.quadraticCurveTo(0, -h, w, 0); ctx.quadraticCurveTo(0, h * .8, -w, 0);
      ctx.closePath(); ctx.fill();
      ctx.fillRect(w - 2, -1, 12, 2);   // tail
      return;
    }
    if (a.kind === 'copter') {
      ctx.fillStyle = '#241634';
      ctx.fillRect(-11, -3, 22, 7); ctx.fillRect(9, -1, 9, 3);
      ctx.strokeStyle = hexA(stage.accent, .85); ctx.lineWidth = 1.5;
      const r = 15 * (.4 + Math.abs(Math.cos(a.phase * 7)) * .6);
      ctx.beginPath(); ctx.moveTo(-r, -6); ctx.lineTo(r, -6); ctx.stroke();
      ctx.fillStyle = Math.sin(a.phase * 5) > 0 ? '#ff5a5a' : 'rgba(255,90,90,.25)';
      ctx.fillRect(-12, 1, 3, 3);
      return;
    }
    if (a.kind === 'blimp' || a.kind === 'pod') {
      const w = a.kind === 'blimp' ? 34 : 20, h = a.kind === 'blimp' ? 12 : 9;
      ctx.fillStyle = a.kind === 'blimp' ? '#2a1c46' : '#3a2a1e';
      ctx.beginPath(); ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = hexA(stage.accent, .55);
      ctx.fillRect(-w * .5, -1.5, w, 3);           // lit band along the hull
      ctx.fillStyle = '#150e24'; ctx.fillRect(-5, h - 1, 10, 4);
      return;
    }
    if (a.kind === 'moth') {
      // Glitchy data moth: two triangular wings that stutter rather than flap.
      const st = Math.sin(a.phase * 9) > .3 ? 1 : .45;
      ctx.fillStyle = hexA(stage.accent, .75 * st);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-11, -8 * st); ctx.lineTo(-9, 5); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(11, -8 * st); ctx.lineTo(9, 5); ctx.closePath(); ctx.fill();
      return;
    }
    if (a.kind === 'sentry') {
      ctx.fillStyle = '#0e2018';
      ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(11, 0); ctx.lineTo(0, 9); ctx.lineTo(-11, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = hexA(stage.accent, .3 + Math.abs(Math.sin(a.phase * 2)) * .7);
      ctx.fillRect(-3, -2, 6, 4);
      return;
    }
    if (a.kind === 'wisp') {
      // Floating candle flame: a teardrop with a soft core.
      const f = 1 + Math.sin(a.phase * 4) * .18;
      ctx.fillStyle = hexA('#ffd98a', .6);
      ctx.beginPath(); ctx.ellipse(0, 0, 4 * f, 7 * f, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = hexA('#fff6d8', .85);
      ctx.beginPath(); ctx.ellipse(0, 1, 1.8 * f, 3.4 * f, 0, 0, Math.PI * 2); ctx.fill();
      return;
    }
    // banner — a hanging pennant rippling on its pole
    ctx.fillStyle = hexA(stage.accent2, .6);
    ctx.beginPath(); ctx.moveTo(0, -14);
    for (let i = 0; i <= 4; i++) {
      const t = i / 4;
      ctx.lineTo(t * 26, -14 + Math.sin(a.phase * 2 + t * 3) * 3 + t * 2);
    }
    for (let i = 4; i >= 0; i--) {
      const t = i / 4;
      ctx.lineTo(t * 26, 6 + Math.sin(a.phase * 2 + t * 3) * 3 + t * 2);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2a1030'; ctx.fillRect(-2, -18, 3, 30);
  }

  // --- Weather / particulate ---------------------------------------------
  // `far` motes draw behind the action at low alpha, near ones in front of the
  // scenery but still under gameplay. Two passes so the air has depth.
  function drawMotes(stage, d, far) {
    if (d.q <= 0 || !sceneLayersOn) return;
    const w = WEATHER[stage.theme];
    if (!w) return;
    const set = SCENE_CHAPTERS[stage.theme];
    const col = set ? set[Math.min(set.length - 1, d.chapter)].mote : '#ffffff';
    const base = w.a * (far ? .55 : 1) * (d.boss ? .7 : 1);
    ctx.save();
    for (const m of motes) {
      if (m.far !== far) continue;
      const s = m.s * (far ? .7 : 1);
      ctx.globalAlpha = base * m.a;
      ctx.fillStyle = col;
      if (w.shape === 'streak') {
        ctx.fillRect(m.x, m.y, s * .8, s * 3.2);
      } else if (w.shape === 'petal') {
        ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.spin);
        ctx.beginPath(); ctx.ellipse(0, 0, s, s * .5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(m.x, m.y, s * .6, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  // --- Per-chapter far landmarks -----------------------------------------
  // Big, flat, low-contrast silhouettes on the deepest layer. They cross-fade
  // at the chapter seam, so the far skyline visibly changes as the route runs.
  function drawFarLandmarks(stage, d) {
    const sets = FAR_LANDMARKS[stage.theme];
    if (!sets || d.q <= 0 || !sceneLayersOn) return;
    const cur = d.chapter, prev = Math.max(0, cur - 1);
    ctx.save();
    ctx.translate(bgCamX * .1, bgCam * .1);
    if (prev !== cur && d.chapterIn < 1) {
      ctx.globalAlpha = 1 - d.chapterIn;
      sets[Math.min(sets.length - 1, prev)](stage, d);
    }
    ctx.globalAlpha = prev === cur ? 1 : d.chapterIn;
    sets[Math.min(sets.length - 1, cur)](stage, d);
    ctx.restore();
  }

  // Shared helper: a scrolling row of silhouette shapes on the far plane.
  function farRow(stage, { y, speed, gap, alpha, color, draw }) {
    const off = ((elapsed * speed) % gap + gap) % gap;
    ctx.save();
    ctx.globalAlpha = (ctx.globalAlpha || 1) * alpha;
    ctx.fillStyle = color;
    for (let i = -1; i * gap - off < VW + gap; i++) {
      const x = i * gap - off;
      draw(x, y, i);
    }
    ctx.restore();
  }

  const FAR_LANDMARKS = {
    neon: [
      // Ch.1 繁華街 — a dense low skyline of narrow buildings.
      (s) => farRow(s, {
        y: 300, speed: 9, gap: 132, alpha: .3, color: '#1a1040',
        draw: (x, y, i) => {
          const h = 150 + ((i * 37) % 5) * 34;
          ctx.fillRect(x, y - h, 88, h);
          ctx.fillStyle = hexA(s.accent, .16);
          for (let r = 0; r < 4; r++) ctx.fillRect(x + 10, y - h + 14 + r * 24, 68, 6);
          ctx.fillStyle = '#1a1040';
        }
      }),
      // Ch.2 高速道路 — elevated expressway pylons marching to the horizon.
      (s) => farRow(s, {
        y: 214, speed: 14, gap: 210, alpha: .32, color: '#221252',
        draw: (x, y) => {
          ctx.fillRect(x + 84, y, 26, 150);
          ctx.fillRect(x, y - 16, 210, 18);
          ctx.fillStyle = hexA(s.accent2, .2); ctx.fillRect(x, y - 20, 210, 4);
          ctx.fillStyle = '#221252';
        }
      }),
      // Ch.3 タワー直下 — we are UNDER the tower now: two colossal legs stride
      // through frame and its underbelly truss caps the sky. Framing the open
      // sky band is the only way a landmark this big reads over the dense city.
      (s) => {
        // A dark silhouette is invisible against this stage's dark sky, so the
        // structure reads through EDGE LIGHT (neon lattice) rather than fill.
        ctx.save();
        const drift = (elapsed * 11) % 900;
        for (const base of [220 - drift, 1120 - drift, 2020 - drift]) {
          if (base < -260 || base > VW + 260) continue;
          // Leg: splayed, wider at the bottom, vanishing behind the skyline.
          ctx.globalAlpha = .55; ctx.fillStyle = '#0b0620';
          ctx.beginPath();
          ctx.moveTo(base - 30, 0); ctx.lineTo(base + 30, 0);
          ctx.lineTo(base + 104, 320); ctx.lineTo(base + 48, 320);
          ctx.closePath(); ctx.fill();
          ctx.globalAlpha = .5; ctx.strokeStyle = s.accent; ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(base - 30, 0); ctx.lineTo(base + 48, 320); ctx.moveTo(base + 30, 0); ctx.lineTo(base + 104, 320);
          ctx.stroke();
          ctx.globalAlpha = .32;
          for (let i = 1; i < 8; i++) {
            const t = i / 8, yy = t * 320;
            const l = base - 30 + t * 78, r = base + 30 + t * 74;
            ctx.beginPath(); ctx.moveTo(l, yy); ctx.lineTo(r, yy);
            ctx.moveTo(l, yy); ctx.lineTo(r + 9, yy - 40); ctx.stroke();
          }
        }
        // Underbelly truss capping the frame, lit along its lower edge.
        ctx.globalAlpha = .62; ctx.fillStyle = '#070418';
        ctx.fillRect(-30, -30, VW + 60, 82);
        ctx.globalAlpha = .75; ctx.strokeStyle = s.accent2; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-30, 52); ctx.lineTo(VW + 30, 52); ctx.stroke();
        ctx.globalAlpha = .3; ctx.lineWidth = 2;
        for (let i = 0; i < 16; i++) {
          const x = ((i * 96 - drift * .5) % (VW + 96) + VW + 96) % (VW + 96) - 48;
          ctx.beginPath(); ctx.moveTo(x, 52); ctx.lineTo(x + 48, 8); ctx.lineTo(x + 96, 52); ctx.stroke();
        }
        for (let i = 0; i < 7; i++) {
          const x = ((i * 190 - drift * .5) % (VW + 190) + VW + 190) % (VW + 190) - 95;
          ctx.globalAlpha = .45 + Math.abs(Math.sin(elapsed * 1.6 + i)) * .5;
          ctx.fillStyle = '#ff5a5a'; ctx.fillRect(x - 5, 54, 10, 9);
        }
        ctx.restore();
      }
    ],
    aqua: [
      // Ch.1 沿岸 — headlands and a distant harbour crane line.
      (s) => farRow(s, {
        y: 236, speed: 7, gap: 240, alpha: .26, color: '#123c68',
        draw: (x, y) => {
          ctx.beginPath(); ctx.moveTo(x, y + 90); ctx.lineTo(x + 70, y - 26); ctx.lineTo(x + 150, y + 20); ctx.lineTo(x + 230, y + 90);
          ctx.closePath(); ctx.fill();
        }
      }),
      // Ch.2 外洋 — open water: only far container ships on the horizon.
      (s) => farRow(s, {
        y: 268, speed: 11, gap: 330, alpha: .24, color: '#17456f',
        draw: (x, y) => {
          ctx.fillRect(x, y, 132, 13);
          ctx.fillRect(x + 88, y - 20, 22, 20);
          for (let i = 0; i < 5; i++) ctx.fillRect(x + 8 + i * 15, y - 9, 12, 9);
        }
      }),
      // Ch.3 深海 — the light is gone; only trench walls and bioluminescence.
      (s) => {
        ctx.save(); ctx.globalAlpha = (ctx.globalAlpha || 1) * .4;
        ctx.fillStyle = '#03142c';
        const off = (elapsed * 9) % 300;
        for (let i = -1; i * 300 - off < VW + 300; i++) {
          const x = i * 300 - off;
          ctx.beginPath(); ctx.moveTo(x, 470); ctx.lineTo(x + 60, 150); ctx.lineTo(x + 140, 240); ctx.lineTo(x + 210, 120); ctx.lineTo(x + 290, 470);
          ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = hexA(s.accent, .5);
        for (let i = 0; i < 14; i++) {
          const x = ((i * 173 - elapsed * 9) % (VW + 120) + VW + 120) % (VW + 120) - 60;
          const y = 180 + ((i * 97) % 240);
          ctx.globalAlpha = (.2 + Math.abs(Math.sin(elapsed * 1.3 + i)) * .5) * .4;
          ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }
    ],
    factory: [
      // Ch.1 搬入路 — long low warehouse roofs and stacked containers.
      (s) => farRow(s, {
        y: 226, speed: 10, gap: 200, alpha: .28, color: '#3a1c34',
        draw: (x, y) => {
          ctx.fillRect(x, y, 176, 96);
          ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + 88, y - 30); ctx.lineTo(x + 182, y); ctx.closePath(); ctx.fill();
          ctx.fillStyle = hexA(s.accent2, .18);
          for (let i = 0; i < 3; i++) ctx.fillRect(x + 16 + i * 54, y + 26, 34, 20);
          ctx.fillStyle = '#3a1c34';
        }
      }),
      // Ch.2 溶鉱炉 — furnace stacks with glowing mouths.
      (s) => farRow(s, {
        y: 250, speed: 13, gap: 168, alpha: .3, color: '#4a1f2f',
        draw: (x, y, i) => {
          const h = 150 + ((i * 53) % 4) * 40;
          ctx.fillRect(x + 30, y, 54, h);
          ctx.fillStyle = hexA('#ff8a35', .22 + Math.abs(Math.sin(elapsed * 1.1 + i)) * .18);
          ctx.fillRect(x + 34, y + 4, 46, 16);
          ctx.fillStyle = '#4a1f2f';
        }
      }),
      // Ch.3 排熱塔 — hyperboloid cooling towers venting into the sunset.
      (s) => farRow(s, {
        y: 210, speed: 8, gap: 300, alpha: .3, color: '#552438',
        draw: (x, y) => {
          ctx.beginPath();
          ctx.moveTo(x + 30, y + 240); ctx.quadraticCurveTo(x + 86, y + 90, x + 64, y);
          ctx.lineTo(x + 152, y); ctx.quadraticCurveTo(x + 130, y + 90, x + 186, y + 240);
          ctx.closePath(); ctx.fill();
        }
      })
    ],
    storm: [
      // Ch.1 外縁 — a low ridge of server cabinets.
      (s) => farRow(s, {
        y: 250, speed: 10, gap: 148, alpha: .28, color: '#0d2a26',
        draw: (x, y, i) => {
          const h = 90 + ((i * 41) % 4) * 30;
          ctx.fillRect(x, y - h + 90, 108, h);
          ctx.fillStyle = hexA(s.accent, .2);
          for (let r = 0; r < 5; r++) ctx.fillRect(x + 8, y - h + 100 + r * 15, 92, 3);
          ctx.fillStyle = '#0d2a26';
        }
      }),
      // Ch.2 演算層 — floating compute slabs at several depths.
      (s) => farRow(s, {
        y: 260, speed: 15, gap: 190, alpha: .26, color: '#10352c',
        draw: (x, y, i) => {
          const yy = y + Math.sin(elapsed * .5 + i) * 22 + ((i * 31) % 3) * 60;
          ctx.fillRect(x, yy, 140, 26);
          ctx.fillStyle = hexA(s.accent2, .25); ctx.fillRect(x, yy - 3, 140, 3);
          ctx.fillStyle = '#10352c';
        }
      }),
      // Ch.3 中枢 — one vast column of stacked rings around the core.
      (s) => {
        const cx = 880;
        ctx.save(); ctx.globalAlpha = (ctx.globalAlpha || 1) * .3;
        ctx.strokeStyle = hexA(s.accent, .5); ctx.lineWidth = 3;
        for (let i = 0; i < 11; i++) {
          const yy = 70 + i * 38, rw = 60 + Math.sin(i * .7 + elapsed * .6) * 26 + i * 6;
          ctx.beginPath(); ctx.ellipse(cx, yy, rw, 9, 0, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.fillStyle = hexA(s.accent2, .18); ctx.fillRect(cx - 16, 70, 32, 420);
        ctx.restore();
      }
    ],
    palace: [
      // Ch.1 外苑 — garden hedges and topiary against the outer wall.
      (s) => farRow(s, {
        y: 250, speed: 8, gap: 170, alpha: .26, color: '#3d1030',
        draw: (x, y) => {
          ctx.fillRect(x, y + 40, 150, 60);
          for (let i = 0; i < 3; i++) {
            ctx.beginPath(); ctx.arc(x + 28 + i * 46, y + 30, 22, 0, Math.PI * 2); ctx.fill();
          }
        }
      }),
      // Ch.2 回廊 — a receding arcade of arches.
      (s) => farRow(s, {
        y: 250, speed: 12, gap: 150, alpha: .28, color: '#4a1440',
        draw: (x, y) => {
          ctx.fillRect(x, y, 26, 230);
          ctx.beginPath(); ctx.moveTo(x + 26, y + 40);
          ctx.quadraticCurveTo(x + 75, y - 34, x + 124, y + 40);
          ctx.lineTo(x + 124, y + 4); ctx.quadraticCurveTo(x + 75, y - 66, x + 26, y + 4);
          ctx.closePath(); ctx.fill();
        }
      }),
      // Ch.3 玉座前 — the throne hall's great rose window and banners.
      (s) => {
        // No full-width fill here: the palace is the one stage with no frame
        // budget to spare, and a flat band across the nave only muddies it.
        ctx.save(); ctx.globalAlpha = (ctx.globalAlpha || 1) * .3;
        ctx.strokeStyle = hexA(s.accent, .45); ctx.lineWidth = 3;
        const cx = 640, cy = 210, r = 120;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, r * .55, 0, Math.PI * 2); ctx.stroke();
        for (let i = 0; i < 12; i++) {
          const ang = i / 12 * Math.PI * 2 + elapsed * .04;
          ctx.beginPath(); ctx.moveTo(cx + Math.cos(ang) * r * .55, cy + Math.sin(ang) * r * .55);
          ctx.lineTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r); ctx.stroke();
        }
        ctx.restore();
      }
    ]
  };

  // Shared material response along the bottom of frame. It makes lightning,
  // furnace fire, signs and stained glass feel like lights in one world rather
  // than independent glowing shapes.
  function drawScenicLightEcho(stage, d) {
    if (d.q <= 0) return;
    const event = d.setpiece ? Math.sin(d.setT * Math.PI) : 0;
    const pulse = d.boss ? .85 + Math.sin(elapsed * 2.2) * .15 : .45 + d.energy * .35;
    const y = stage.theme === 'palace' ? 610 : stage.theme === 'factory' ? 630 : 600;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < (d.q >= 2 ? 5 : 3); i++) {
      const x = 110 + i * 260 + Math.sin(elapsed * .35 + i * 2.1) * 55;
      const w = 70 + event * 100 + (i % 2) * 35;
      const g = ctx.createLinearGradient(x, y, x, 724);
      g.addColorStop(0, hexA(i % 2 ? stage.accent2 : stage.accent, .08 * pulse));
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x + 5, y);
      ctx.lineTo(x + w, 724); ctx.lineTo(x - w, 724); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function drawNeonDirection(stage, d) {
    // The route gradually becomes busier; calm/set-piece beats let the famous
    // crossing fill with commuters instead of adding more permanent buildings.
    if (d.q > 0 && (d.setpiece || activePhase.mode === 'calm')) {
      const strength = d.setpiece ? Math.sin(d.setT * Math.PI) : .45;
      ctx.save(); ctx.globalAlpha = .18 + strength * .32;
      const count = d.q >= 2 ? 30 : 17;
      for (let i = 0; i < count; i++) {
        const lane = i % 3, dir = lane === 1 ? -1 : 1;
        const u = (elapsed * (.045 + lane * .008) + i / count) % 1;
        const x = dir > 0 ? -80 + u * 1440 : 1360 - u * 1440;
        const y = 586 + lane * 25 + Math.sin(i * 3.7) * 7;
        const s = .55 + lane * .16;
        ctx.fillStyle = i % 4 === 0 ? stage.accent2 : i % 4 === 1 ? stage.accent : '#d9d1ff';
        ctx.beginPath(); ctx.arc(x, y - 17 * s, 5 * s, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(x - 4 * s, y - 12 * s, 8 * s, 17 * s);
        ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 2 * s;
        ctx.beginPath(); ctx.moveTo(x, y + 3 * s); ctx.lineTo(x - 6 * s, y + 15 * s);
        ctx.moveTo(x, y + 3 * s); ctx.lineTo(x + 6 * s, y + 15 * s); ctx.stroke();
      }
      ctx.restore();
    }
    // MASQUERADE hijacks the district screens and kills the city fill light.
    if (d.boss || d.warning) {
      const a = d.warning ? .12 + Math.sin(elapsed * 12) * .05 : .16;
      ctx.save(); ctx.fillStyle = `rgba(3,0,18,${a})`; ctx.fillRect(0, 0, VW, VH);
      ctx.translate(475, 148);
      ctx.globalAlpha = d.warning ? .65 : .42; ctx.fillStyle = '#080313'; ctx.fillRect(0, 0, 330, 114);
      ctx.strokeStyle = stage.accent2; ctx.lineWidth = 3; ctx.shadowColor = stage.accent2; ctx.shadowBlur = 18; ctx.strokeRect(0, 0, 330, 114);
      ctx.textAlign = 'center'; ctx.font = '16px "Press Start 2P", monospace'; ctx.fillStyle = '#ffd8ef';
      ctx.fillText('LIKE  LIKE  LIKE', 165, 48);
      ctx.font = '11px "Press Start 2P", monospace'; ctx.fillStyle = stage.accent;
      ctx.fillText('MASQUERADE OWNS THE NIGHT', 165, 78);
      for (let y = 8; y < 110; y += 8) { ctx.globalAlpha = .1; ctx.fillRect(4, y, 322, 1); }
      ctx.restore();
    }
  }

  function drawAquaDirection(stage, d) {
    // One immense bridge tower crosses the camera during the scripted route
    // beat. Its cables sweep the whole composition, making forward travel clear.
    if (d.setpiece) {
      const u = clamp(d.setT * 1.25, 0, 1), x = 1450 - u * 1740;
      ctx.save(); ctx.globalAlpha = .82;
      drawVolumeBox(x - 108, 116, 46, 500, 28, '#123e69', '#04162b', '#4b91b5', .9, stage.accent);
      drawVolumeBox(x + 62, 116, 46, 500, 28, '#123e69', '#04162b', '#4b91b5', .9, stage.accent);
      for (const by of [176, 304, 430]) {
        drawVolumeBox(x - 104, by, 208, 24, 18, '#174b76', '#061b31', '#58a5c5', .82, hexA(stage.accent, .8));
      }
      ctx.strokeStyle = hexA(stage.accent, .72); ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(x, 100); ctx.quadraticCurveTo(x - 420, 185, x - 760, 560);
      ctx.moveTo(x, 100); ctx.quadraticCurveTo(x + 420, 185, x + 760, 560); ctx.stroke();
      ctx.lineWidth = 2; ctx.globalAlpha = .5;
      for (let k = -7; k <= 7; k++) {
        const hx = x + k * 82, top = 142 + Math.abs(k) * 24;
        ctx.beginPath(); ctx.moveTo(hx, top); ctx.lineTo(hx, 570); ctx.stroke();
      }
      ctx.restore();
    }
    // ABYSS SIREN stains the sea with a violet magic lattice while retaining
    // enough transparency for the ocean and projectiles to read.
    if (d.boss || d.warning) {
      const flick = d.warning ? .5 + Math.sin(elapsed * 14) * .35 : .55;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .12 * flick;
      ctx.strokeStyle = '#c94cff'; ctx.lineWidth = 1;
      for (let y = 300; y < 660; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VW, y + 18); ctx.stroke(); }
      for (let x = -100; x < VW + 100; x += 64) { ctx.beginPath(); ctx.moveTo(VW / 2, 300); ctx.lineTo(x, 680); ctx.stroke(); }
      for (let i = 0; i < 20; i++) {
        const px = (i * 193 + elapsed * (28 + i % 3 * 9)) % (VW + 100) - 50;
        const py = 160 + (i * 47) % 390;
        ctx.fillStyle = i % 3 ? '#c94cff' : '#ffffff'; ctx.fillRect(px, py, 5 + i % 6, 5 + i % 6);
      }
      ctx.restore();
    }
  }

  function drawFactoryDirection(stage, d) {
    const event = d.setpiece ? Math.sin(d.setT * Math.PI) : 0;
    // A ladle pour is the stage's singular industrial spectacle. The stream
    // lights the smoke, grating and nearby machine silhouettes as one event.
    if (event > .02) {
      const x = 770 + Math.sin(d.setT * Math.PI * 2) * 80;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = .28 + event * .45; ctx.shadowColor = '#ff6a25'; ctx.shadowBlur = 28;
      ctx.fillStyle = '#24121b'; ctx.beginPath(); ctx.ellipse(x, 245, 94, 48, -.16, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ff9f43'; ctx.lineWidth = 7; ctx.stroke();
      const stream = ctx.createLinearGradient(x, 260, x, 660);
      stream.addColorStop(0, '#fff7a0'); stream.addColorStop(.35, '#ffb12e'); stream.addColorStop(1, '#ff3b18');
      ctx.strokeStyle = stream; ctx.lineWidth = 14 + event * 12;
      ctx.beginPath(); ctx.moveTo(x - 58, 270); ctx.bezierCurveTo(x - 35, 370, x + 20, 500, x - 10, 667); ctx.stroke();
      ctx.globalAlpha = event * .18; ctx.fillStyle = '#ff6a25'; ctx.fillRect(0, 320, VW, 360);
      ctx.restore();
    }
    // Repeating presses wake up with route intensity; during the boss the hall
    // drops into silhouette and furnace apertures become the only key lights.
    if (d.q > 0) {
      ctx.save(); ctx.globalAlpha = .22 + d.energy * .25; ctx.fillStyle = '#10080e';
      for (let i = 0; i < 6; i++) {
        const x = 80 + i * 225, travel = (Math.sin(elapsed * (1.5 + i * .08) + i) + 1) * 22;
        ctx.fillRect(x, 250, 34, 210 + travel); ctx.fillRect(x - 26, 438 + travel, 86, 24);
      }
      ctx.restore();
    }
    if (d.boss || d.warning) {
      ctx.save(); ctx.fillStyle = `rgba(16,2,8,${d.warning ? .18 : .24})`; ctx.fillRect(0, 0, VW, VH);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const x = 90 + i * 280, hot = .55 + Math.sin(elapsed * 5 + i) * .25;
        const g = ctx.createRadialGradient(x, 590, 4, x, 590, 120);
        g.addColorStop(0, `rgba(255,235,120,${.32 * hot})`); g.addColorStop(.25, `rgba(255,70,20,${.2 * hot})`); g.addColorStop(1, 'rgba(255,40,10,0)');
        ctx.fillStyle = g; ctx.fillRect(x - 120, 470, 240, 220);
      }
      ctx.restore();
    }
  }

  function drawStormDirection(stage, d) {
    // Lightning briefly reveals the outline of a colossal command construct
    // behind the cloud deck. The boss keeps only its dim visor visible.
    const reveal = Math.max(Math.min(1, lightning * 4), d.boss ? .22 : 0);
    if (reveal > .02) {
      ctx.save(); ctx.globalAlpha = reveal * .38; ctx.strokeStyle = '#baffd4'; ctx.lineWidth = 4;
      ctx.shadowColor = stage.accent; ctx.shadowBlur = 22;
      ctx.beginPath(); ctx.moveTo(470, 455); ctx.lineTo(448, 260); ctx.lineTo(520, 176);
      ctx.lineTo(590, 208); ctx.lineTo(640, 126); ctx.lineTo(690, 208);
      ctx.lineTo(760, 176); ctx.lineTo(832, 260); ctx.lineTo(810, 455); ctx.stroke();
      ctx.fillStyle = stage.accent2; ctx.globalAlpha = reveal * .7;
      ctx.fillRect(574, 252, 48, 8); ctx.fillRect(658, 252, 48, 8);
      ctx.restore();
    }
    // During the route set-piece, server towers overload from left to right.
    if (d.setpiece && d.q > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 9; i++) {
        const local = clamp((d.setT * 1.35 - i * .085) * 4, 0, 1);
        if (!local) continue;
        const x = 70 + i * 145, a = Math.sin(local * Math.PI);
        ctx.globalAlpha = a * .42; ctx.fillStyle = i % 2 ? stage.accent2 : stage.accent;
        ctx.fillRect(x, 210, 4, 410);
        ctx.beginPath(); ctx.arc(x + 2, 212, 10 + a * 22, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    if (d.boss || d.warning) {
      ctx.save(); ctx.globalAlpha = d.warning ? .16 : .09; ctx.fillStyle = '#9affbf';
      for (let i = 0; i < 16; i++) {
        const y = (i * 53 + elapsed * (70 + i % 4 * 20)) % VH;
        const x = (i * 181) % VW; ctx.fillRect(x, y, 50 + (i * 31) % 170, 2 + i % 3);
      }
      ctx.restore();
    }
  }

  function drawPalaceDirection(stage, d) {
    // The ceremonial doors open only for the late-route processional beat,
    // revealing the throne rather than leaving another ornament permanently on.
    if (d.setpiece) {
      const open = Math.sin(clamp(d.setT * 1.15, 0, 1) * Math.PI * .5);
      const gap = open * 138;
      ctx.save(); ctx.globalAlpha = .72;
      for (const side of [-1, 1]) {
        const x = VW / 2 + side * gap;
        ctx.fillStyle = '#26081f'; ctx.strokeStyle = '#ffe15a'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(x, 280); ctx.lineTo(x + side * 165, 324); ctx.lineTo(x + side * 165, 640); ctx.lineTo(x, 640); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ff3e9d'; heartPath(x + side * 80, 450, 20); ctx.fill();
      }
      ctx.restore();
    }
    if (d.boss || d.warning || bossCrit > 0) {
      const crit = clamp(bossCrit, 0, 1), force = d.warning ? .35 + Math.sin(elapsed * 10) * .15 : .45 + crit * .55;
      // Cracks grow outward from the rose window as the queen loses control.
      ctx.save(); ctx.globalAlpha = .24 + crit * .34; ctx.strokeStyle = crit > .45 ? '#ff4055' : '#ffe5f2'; ctx.lineWidth = 2;
      ctx.shadowColor = '#ff315c'; ctx.shadowBlur = 10;
      for (let i = 0; i < 13; i++) {
        const a = i / 13 * Math.PI * 2 + .12, len = 100 + force * (120 + (i * 37) % 110);
        ctx.beginPath(); ctx.moveTo(640, 205);
        const mx = 640 + Math.cos(a) * len * .52, my = 205 + Math.sin(a) * len * .52;
        ctx.lineTo(mx, my); ctx.lineTo(640 + Math.cos(a + (i % 2 ? .08 : -.08)) * len, 205 + Math.sin(a + (i % 2 ? .08 : -.08)) * len); ctx.stroke();
      }
      // A row of candles goes dark from the outside inward through the fight.
      const extinguished = d.warning ? 2 : Math.floor(4 + crit * 8);
      for (let i = 0; i < 12; i++) {
        const x = 190 + i * 82; ctx.fillStyle = '#d7a65a'; ctx.fillRect(x, 594, 5, 35);
        if (i < extinguished / 2 || i >= 12 - Math.ceil(extinguished / 2)) continue;
        ctx.globalAlpha = .55; ctx.fillStyle = '#ffe9a0';
        ctx.beginPath(); ctx.ellipse(x + 2, 588, 4, 10 + Math.sin(elapsed * 6 + i) * 2, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .08 + crit * .15;
      const blood = ctx.createLinearGradient(640, 480, 640, 720);
      blood.addColorStop(0, 'rgba(255,20,70,0)'); blood.addColorStop(1, '#ff143e'); ctx.fillStyle = blood;
      ctx.beginPath(); ctx.moveTo(570, 480); ctx.lineTo(710, 480); ctx.lineTo(980, 720); ctx.lineTo(300, 720); ctx.closePath(); ctx.fill(); ctx.restore();
    }
  }

  // A second haze wash painted BETWEEN the far and mid layers, so distant
  // structures visibly sink into the atmosphere before nearer ones draw on top.
  function drawDepthHaze(stage, alpha) {
    const haze = cachedGrad('hazeMid' + stageIndex, () => {
      const grad = ctx.createLinearGradient(0, 240, 0, 620);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(.7, hexA(stage.sky[1], .34));
      grad.addColorStop(1, hexA(stage.sky[2], .2));
      return grad;
    });
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = haze; ctx.fillRect(0, 240, VW, 380); ctx.restore();
  }

  // Perspective ground plane: horizontals bunch toward the horizon and verticals
  // converge on the same vanishing point drawCity uses (VW/2). Extracted from the
  // storm stage's drawHoloGrid so every stage can have a receding floor.
  function drawGroundPlane(stage, { horizonY = 566, bottom = 668, color = null, alpha = .14, speed = 70, gap = 96 } = {}) {
    ctx.save(); ctx.strokeStyle = color || stage.accent; ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const t = i / 10, y = horizonY + (bottom - horizonY) * t * t;
      ctx.globalAlpha = alpha * (.3 + t * .9);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VW, y); ctx.stroke();
    }
    const drift = (elapsed * speed) % gap;
    ctx.globalAlpha = alpha * .8;
    for (let x = -400; x < VW + 400; x += gap) {
      ctx.beginPath(); ctx.moveTo(VW / 2 + (x - VW / 2) * .12, horizonY); ctx.lineTo(x - drift, bottom + 46); ctx.stroke();
    }
    ctx.restore();
  }

  // --- Shared pseudo-3D foundation ---------------------------------------
  // proj3 projects a world point through a fixed-focal pinhole camera onto the
  // screen. x/y are screen units on the z=0 gameplay plane, z recedes into the
  // scene (px). Parallax from bgCamX/bgCam grows with depth via camK, making
  // this the continuous version of the discrete bgLayer(depth) steps
  // (bgLayer(.5)≈z 6000 / .32≈2400 / .15≈1200 / .1≈700).
  const FOCAL = 900, HORIZON_Y = 560;
  const camK = z => Math.min(1, Math.max(0, z) / 1400);
  function proj3(x, y, z) {
    const s = FOCAL / (FOCAL + z), k = camK(z);
    return {
      x: VW / 2 + (x - VW / 2 + bgCamX * k) * s,
      y: HORIZON_Y + (y - HORIZON_Y + bgCam * k) * s,
      s
    };
  }

  // Project four [x,y,z] corners and fill the resulting quad.
  function quad3(corners, fill, alpha = 1) {
    ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = fill;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const p = proj3(corners[i][0], corners[i][1], corners[i][2]);
      i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
    }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }

  // Run an existing screen-space painter at depth z: same projection as proj3
  // applied via the CTM, so legacy draw helpers can be pushed into the scene
  // without rewriting their coordinates.
  function bgLayerZ(z, fn) {
    const s = FOCAL / (FOCAL + z), k = camK(z);
    ctx.save();
    ctx.translate(VW / 2 + bgCamX * k * s, HORIZON_Y + bgCam * k * s);
    ctx.scale(s, s);
    ctx.translate(-VW / 2, -HORIZON_Y);
    fn();
    ctx.restore();
  }

  // Aerial perspective: sink a colour toward the stage's mid-sky with distance.
  // Denser air (smaller FOG_D) reads as storm murk, thinner as palace clarity.
  // z is bucketed to 100px so the string cache stays tiny.
  const FOG_D = { neon: 2200, aqua: 2600, factory: 1800, storm: 1400, palace: 3200 };
  const fogCache = new Map();
  function fogMix(hex, z) {
    const bucket = Math.max(0, Math.round(z / 100));
    const key = stageIndex + hex + '|' + bucket;
    let c = fogCache.get(key);
    if (!c) {
      const stage = stages[stageIndex];
      const f = 1 - Math.exp(-bucket * 100 / (FOG_D[stage.theme] || 2200));
      const a = parseInt(hex.slice(1), 16), b = parseInt(stage.sky[1].slice(1), 16);
      const ch = sh => Math.round(((a >> sh) & 255) + (((b >> sh) & 255) - ((a >> sh) & 255)) * f);
      c = `rgb(${ch(16)},${ch(8)},${ch(0)})`;
      fogCache.set(key, c);
    }
    return c;
  }

  // Scalar fog factor (0..1) for washing baked facades that fogMix can't tint.
  const fogAmount = z => 1 - Math.exp(-Math.max(0, z) / (FOG_D[stages[stageIndex].theme] || 2200));

  // Four-normal Lambert-ish face shading with a per-stage key light. boost
  // (0..1, quantized to .1) lets lightning / boss states punch the lit faces
  // without allocating new colour strings per frame. Callers feed the result
  // into drawVolumeBox / quad3 fills; the primitives stay untouched.
  const STAGE_LIGHT = {
    neon: { color: '#31e8ff', faces: { top: 1.12, front: 1, left: .82, right: .72 }, tint: .1 },
    aqua: { color: '#9fd8ff', faces: { top: 1.18, front: 1, left: .8, right: .7 }, tint: .12 },
    factory: { color: '#ff9f43', faces: { top: .9, front: .78, left: 1.24, right: .64 }, tint: .3 },
    storm: { color: '#c9ffe2', faces: { top: 1.25, front: .92, left: .8, right: .8 }, tint: .18 },
    palace: { color: '#ffe15a', faces: { top: 1.3, front: 1, left: .84, right: .74 }, tint: .2 }
  };
  const litCache = new Map();
  function faceLit(hex, normal, boost = 0) {
    const q = Math.max(0, Math.min(10, Math.round(boost * 10)));
    const key = stageIndex + hex + normal + q;
    let c = litCache.get(key);
    if (!c) {
      const L = STAGE_LIGHT[stages[stageIndex].theme];
      const f = (L.faces[normal] || 1) * (1 + q * .05);
      const t = Math.min(1, L.tint * Math.max(0, f - .95) + q * .04);
      const n = parseInt(hex.slice(1), 16), l = parseInt(L.color.slice(1), 16);
      const ch = sh => {
        const base = Math.min(255, ((n >> sh) & 255) * f);
        return Math.round(base + (((l >> sh) & 255) - base) * t);
      };
      c = `rgb(${ch(16)},${ch(8)},${ch(0)})`;
      litCache.set(key, c);
    }
    return c;
  }

  // Linear mix of two '#rrggbb' colours as an rgba() string.
  function mixHexA(a, b, t, alpha = 1) {
    const ha = parseInt(a.slice(1), 16), hb = parseInt(b.slice(1), 16);
    const ch = sh => Math.round(((ha >> sh) & 255) + (((hb >> sh) & 255) - ((ha >> sh) & 255)) * t);
    return `rgba(${ch(16)},${ch(8)},${ch(0)},${alpha})`;
  }

  // Painter's-algorithm queue for scenes whose elements interleave in depth
  // (palace columns / chandeliers / god rays). Other stages keep the cheaper
  // back-to-front call order and never touch this.
  const volQueue = [];
  function volPush(z, fn) { volQueue.push({ z, fn }); }
  function volFlush() {
    volQueue.sort((a, b) => b.z - a.z);
    for (const v of volQueue) v.fn();
    volQueue.length = 0;
  }

  // True-perspective extruded box. World x-span [x0,x1], y-span [yTop,yBase]
  // (y grows downward), z-span [z0,z1]. Paints the visible side face, then the
  // top/underside when the camera can see it, then the front face — and returns
  // the front rect (all four front corners share z0, so it projects to an
  // axis-aligned rect) so callers can blit a baked facade into it.
  function boxZ(x0, x1, yTop, yBase, z0, z1, front, side, topCol, alpha = 1) {
    const a0 = proj3(x0, yTop, z0), b0 = proj3(x1, yTop, z0);
    const c0 = proj3(x1, yBase, z0), d0 = proj3(x0, yBase, z0);
    const a1 = proj3(x0, yTop, z1), b1 = proj3(x1, yTop, z1);
    const c1 = proj3(x1, yBase, z1), d1 = proj3(x0, yBase, z1);
    const poly = pts => {
      ctx.beginPath();
      for (let i = 0; i < 4; i++) i ? ctx.lineTo(pts[i].x, pts[i].y) : ctx.moveTo(pts[i].x, pts[i].y);
      ctx.closePath(); ctx.fill();
    };
    ctx.save(); ctx.globalAlpha *= alpha;
    if (side) {
      ctx.fillStyle = side;
      if (b1.x < b0.x - .4) poly([b0, b1, c1, c0]);        // right face swings toward the VP
      else if (a1.x > a0.x + .4) poly([a0, a1, d1, d0]);   // left face
    }
    if (topCol) {
      if (yTop > HORIZON_Y + 2) { ctx.fillStyle = topCol; poly([a0, b0, b1, a1]); }
      else if (yBase < HORIZON_Y - 2) { ctx.fillStyle = topCol; poly([d0, c0, c1, d1]); }
    }
    if (front) { ctx.fillStyle = front; ctx.fillRect(a0.x, a0.y, c0.x - a0.x, c0.y - a0.y); }
    ctx.restore();
    return { x: a0.x, y: a0.y, w: c0.x - a0.x, h: c0.y - a0.y, s: a0.s };
  }

  // Inverse of proj3 on the x axis: the world x that lands on screen x `sx`
  // at projection scale s. Used to pin far landmarks to a composition spot.
  const worldXAt = (sx, s) => VW / 2 + (sx - VW / 2) / s;

  // Backdrop quality tier driven by the fps EMA — the generalized form of
  // drawBokeh's fps<45 skip. 2=full, 1=no reflections/heat shimmer, 0=drop all
  // enrichment so the worst case never costs more than the pre-3D backdrop.
  const bgQuality = () => fpsAvg >= 55 ? 2 : fpsAvg >= 45 ? 1 : 0;

  // Extruded box primitive used by the stage-volume pass. The back face shifts
  // toward the screen-centre vanishing point, so left and right objects expose
  // opposite side faces instead of looking like uniformly skewed cardboard.
  function drawVolumeBox(x, y, w, h, depth, front, side, top, alpha = 1, edge = null) {
    const cx = x + w / 2;
    const sx = Math.sign(VW / 2 - cx) * depth;
    const sy = -depth * .48;
    ctx.save(); ctx.globalAlpha = alpha;
    // top plane
    ctx.fillStyle = top;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y);
    ctx.lineTo(x + w + sx, y + sy); ctx.lineTo(x + sx, y + sy); ctx.closePath(); ctx.fill();
    // side plane facing the viewer
    ctx.fillStyle = side;
    if (sx > 0) {
      ctx.beginPath(); ctx.moveTo(x + w, y); ctx.lineTo(x + w + sx, y + sy);
      ctx.lineTo(x + w + sx, y + h + sy); ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.fill();
    } else {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + sx, y + sy);
      ctx.lineTo(x + sx, y + h + sy); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = front; ctx.fillRect(x, y, w, h);
    if (edge) {
      ctx.globalAlpha = alpha * .75; ctx.strokeStyle = edge; ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    }
    ctx.restore();
  }

  // Shared perspective floor. Bands use a quadratic distribution, while rays
  // converge on a movable vanishing point. The floor can therefore read as wet
  // asphalt, bridge deck, steel grating, data glass or polished marble.
  function drawVolumeFloor(stage, {
    horizon = 570, bottom = 735, vanishingX = VW / 2,
    color = null, alpha = .2, bands = 12, speed = 80
  } = {}) {
    ctx.save(); ctx.strokeStyle = color || stage.accent; ctx.lineWidth = 1.4;
    const phase = (elapsed * speed) % 1;
    for (let i = 0; i < bands; i++) {
      const t = (i + phase) / bands;
      const y = horizon + (bottom - horizon) * t * t;
      ctx.globalAlpha = alpha * (.2 + t * .95);
      ctx.beginPath(); ctx.moveTo(-40, y); ctx.lineTo(VW + 40, y); ctx.stroke();
    }
    ctx.globalAlpha = alpha * .75;
    for (let x = -480; x <= VW + 480; x += 120) {
      ctx.beginPath(); ctx.moveTo(vanishingX, horizon); ctx.lineTo(x, bottom); ctx.stroke();
    }
    ctx.restore();
  }

  function drawStageVolume(stage) {
    if (stage.theme === 'neon') drawNeonVolume(stage);
    else if (stage.theme === 'aqua') drawAquaVolume(stage);
    else if (stage.theme === 'factory') drawFactoryVolume(stage);
    else if (stage.theme === 'storm') drawStormVolume(stage);
    else drawPalaceVolume(stage);
  }

  function drawNeonVolume(stage) {
    bgLayer(.08, () => {
      // Two close high-rises turn the skyline into a city canyon. Their visible
      // inner faces react oppositely to camera yaw, which makes lateral movement
      // feel like looking between real buildings.
      const sway = bgCamX * -.35;
      drawVolumeBox(-54 + sway, 238, 142, 398, 38, '#0a0820', '#05040f', '#30205c', .62, hexA(stage.accent, .38));
      drawVolumeBox(VW - 86 + sway, 190, 154, 446, 42, '#100825', '#060310', '#402060', .66, hexA(stage.accent2, .42));
      ctx.save(); ctx.globalAlpha = .62;
      for (const [x, y, c, text] of [[18, 330, stage.accent, '東京'], [VW - 72, 286, stage.accent2, '深夜']]) {
        ctx.fillStyle = '#08051a'; ctx.fillRect(x, y, 58, 126);
        ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.shadowColor = c; ctx.shadowBlur = 14; ctx.strokeRect(x, y, 58, 126);
        ctx.fillStyle = c; ctx.font = '20px "DotGothic16", monospace'; ctx.textAlign = 'center';
        [...text].forEach((ch, i) => ctx.fillText(ch, x + 29, y + 40 + i * 36));
      }
      ctx.restore();
    });
    drawVolumeFloor(stage, { horizon: 604, bottom: 740, color: '#b9d8ff', alpha: .16, speed: .48 });
  }

  function drawAquaVolume(stage) {
    bgLayer(.1, () => {
      const deckY = 548;
      // Suspension bridge deck with a visible top slab and underside.
      ctx.save(); ctx.globalAlpha = .68;
      ctx.fillStyle = '#173e63';
      ctx.beginPath(); ctx.moveTo(-80, deckY); ctx.lineTo(VW + 80, deckY - 4);
      ctx.lineTo(VW + 80, deckY + 18); ctx.lineTo(-80, deckY + 25); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#061a32';
      ctx.beginPath(); ctx.moveTo(-80, deckY + 18); ctx.lineTo(VW + 80, deckY + 12);
      ctx.lineTo(VW + 80, deckY + 38); ctx.lineTo(-80, deckY + 46); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = hexA(stage.accent, .72); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-80, deckY); ctx.lineTo(VW + 80, deckY - 4); ctx.stroke();
      // The main suspension cable spans the whole screen, with hangers reaching
      // the deck. Its broad silhouette remains readable even behind a huge boss.
      const cableY = x => {
        if (x < 318) return 330 + Math.pow((318 - x) / 318, 2) * 122;
        if (x > 956) return 330 + Math.pow((x - 956) / 324, 2) * 122;
        return 330 + (1 - Math.pow((x - 637) / 319, 2)) * 132;
      };
      ctx.save(); ctx.shadowColor = stage.accent; ctx.shadowBlur = 12;
      ctx.strokeStyle = hexA(stage.accent, .78); ctx.lineWidth = 5;
      ctx.beginPath();
      for (let x = -40; x <= VW + 40; x += 16) x === -40 ? ctx.moveTo(x, cableY(x)) : ctx.lineTo(x, cableY(x));
      ctx.stroke(); ctx.shadowBlur = 0; ctx.lineWidth = 2; ctx.globalAlpha = .62;
      for (let x = 18; x < VW; x += 64) {
        ctx.beginPath(); ctx.moveTo(x, cableY(x)); ctx.lineTo(x, deckY); ctx.stroke();
      }
      ctx.restore();
      // Extruded double-leg bridge towers with luminous crossbeams.
      for (const tx of [318, 956]) {
        drawVolumeBox(tx - 43, 326, 22, 224, 14, '#0a2a50', '#041327', '#31709b', .92, hexA(stage.accent, .65));
        drawVolumeBox(tx + 21, 326, 22, 224, 14, '#0a2a50', '#041327', '#31709b', .92, hexA(stage.accent, .65));
        drawVolumeBox(tx - 52, 350, 104, 20, 13, '#123d65', '#06192f', '#4f91b4', .9, stage.accent);
        drawVolumeBox(tx - 52, 418, 104, 16, 11, '#102f55', '#06192f', '#4386aa', .86, hexA(stage.accent, .8));
        ctx.save(); ctx.globalAlpha = .42; ctx.fillStyle = stage.accent;
        ctx.fillRect(tx - 38, 338, 4, 202); ctx.fillRect(tx + 28, 338, 4, 202); ctx.restore();
      }
      // Underside truss: X-braces between the deck slab and its shadow band
      // turn the flat underside into readable steelwork.
      ctx.save(); ctx.globalAlpha = .5; ctx.strokeStyle = '#0d3357'; ctx.lineWidth = 2;
      for (let x = -64; x < VW + 64; x += 64) {
        ctx.beginPath(); ctx.moveTo(x, deckY + 22); ctx.lineTo(x + 64, deckY + 42); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + 64, deckY + 22); ctx.lineTo(x, deckY + 42); ctx.stroke();
      }
      ctx.restore();
      // Piers carry the deck down to the sea; each casts a smeared reflection.
      for (const px of [120, 500, 780, 1160]) {
        drawVolumeBox(px - 14, deckY + 40, 28, 80, 9, '#0a2444', '#04101f', '#123a5e', .8);
        if (bgQuality() >= 1) drawWaterStreak(px, deckY + 124, 16, 46, stage.accent, .13);
      }
      // Tower reflections smear below the deck line.
      if (bgQuality() >= 1) for (const tx of [318, 956]) {
        drawWaterStreak(tx - 32, deckY + 50, 12, 88, stage.accent, .16);
        drawWaterStreak(tx + 32, deckY + 50, 12, 88, stage.accent, .16);
      }
      // Deck lane streaks shrink toward the centre.
      ctx.fillStyle = 'rgba(255,255,255,.45)';
      const laneOff = (elapsed * 150) % 92;
      for (let x = -laneOff; x < VW + 100; x += 92) ctx.fillRect(x, deckY + 6, 42, 3);
      ctx.restore();
    });
    drawVolumeFloor(stage, { horizon: 557, bottom: 735, color: stage.accent, alpha: .11, speed: .4 });
    drawAquaGround(stage);
    drawAquaTraffic(stage);
  }

  function drawFactoryVolume(stage) {
    bgLayer(.08, () => {
      const scroll = (elapsed * 42) % 430;
      // Repeating steel gantries become smaller toward the horizon. Visible beam
      // tops and side planes keep the frame from reading as flat rectangles.
      for (let i = -1; i < 5; i++) {
        const x = i * 430 - scroll;
        drawVolumeBox(x, 276, 28, 374, 18, '#1a0b17', '#09050b', '#6a2d34', .58, hexA(stage.accent2, .38));
        drawVolumeBox(x + 286, 276, 28, 374, 18, '#1a0b17', '#09050b', '#6a2d34', .58, hexA(stage.accent2, .38));
        drawVolumeBox(x, 276, 314, 24, 18, '#2a101e', '#0c070d', '#8a3f39', .62, hexA(stage.accent, .4));
        ctx.save(); ctx.globalAlpha = .24; ctx.strokeStyle = stage.accent; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(x + 28, 300); ctx.lineTo(x + 286, 370);
        ctx.moveTo(x + 286, 300); ctx.lineTo(x + 28, 370); ctx.stroke(); ctx.restore();
      }
      // Large cylindrical pipe crosses the lower scene with a shaded underside.
      const py = 604;
      const pipe = ctx.createLinearGradient(0, py - 18, 0, py + 25);
      pipe.addColorStop(0, '#9a4a46'); pipe.addColorStop(.38, '#3d1b28'); pipe.addColorStop(1, '#120812');
      ctx.globalAlpha = .52; ctx.fillStyle = pipe; ctx.fillRect(-30, py - 18, VW + 60, 43);
      ctx.fillStyle = hexA(stage.accent, .48); ctx.fillRect(-30, py - 17, VW + 60, 3);
      for (let x = -40 - (elapsed * 66) % 160; x < VW + 80; x += 160) {
        ctx.fillStyle = '#160b14'; ctx.fillRect(x, py - 25, 13, 57);
        ctx.fillStyle = '#7c3539'; ctx.fillRect(x + 3, py - 21, 3, 48);
      }
    });
    drawVolumeFloor(stage, { horizon: 650, bottom: 742, color: '#ffb347', alpha: .17, speed: .7 });
    drawFactoryGround(stage);
    drawFactoryPipeworks(stage);
  }

  function drawStormVolume(stage) {
    const surge = .3 + Math.min(1, lightning * 2.5) * .7;
    bgLayer(.06, () => {
      // Floating data cubes rotate by swapping the apparent extrusion vector;
      // their faces brighten together when lightning surges.
      const cubes = [[164, 248, 54, .7], [1065, 205, 78, 1.5], [820, 400, 42, 2.4], [430, 150, 34, 3.1]];
      for (const [x, y, size, phase] of cubes) {
        const bob = Math.sin(elapsed * .8 + phase) * 12;
        const d = 15 + Math.abs(Math.sin(elapsed * .34 + phase)) * 20;
        drawVolumeBox(x, y + bob, size, size, d, '#07362d', '#021814', '#166c58', .32 + surge * .3, hexA(stage.accent, surge));
        ctx.save(); ctx.globalAlpha = .2 + surge * .35; ctx.strokeStyle = stage.accent2;
        ctx.beginPath(); ctx.moveTo(x + size * .25, y + bob + size * .5); ctx.lineTo(x + size * .75, y + bob + size * .5);
        ctx.moveTo(x + size * .5, y + bob + size * .25); ctx.lineTo(x + size * .5, y + bob + size * .75); ctx.stroke(); ctx.restore();
      }
      // Data-tunnel ribs frame a receding corridor around the play field.
      ctx.save(); ctx.strokeStyle = hexA(stage.accent, .16 + surge * .2); ctx.lineWidth = 4;
      for (let i = 0; i < 7; i++) {
        const t = i / 7, inset = 18 + t * 110, top = 88 + t * 54, bottom = 648 - t * 24;
        ctx.globalAlpha = .2 + (1 - t) * .25;
        ctx.beginPath(); ctx.moveTo(inset, bottom); ctx.lineTo(inset, top); ctx.lineTo(VW - inset, top); ctx.lineTo(VW - inset, bottom); ctx.stroke();
      }
      ctx.restore();
    });
    drawVolumeFloor(stage, { horizon: 566, bottom: 736, color: stage.accent, alpha: .22 + surge * .04, speed: .62 });
    drawStormGround(stage);
  }

  function drawPalaceVolume(stage) {
    const dim = 1 - palaceBossMix * .3;
    bgLayer(.08, () => {
      // Ribbed gothic vault: six arches recede toward the throne's vanishing
      // point. Extruded pillars carry a dark vault web closed by a gold rib —
      // the ceiling of a cathedral nave rather than a row of beams.
      for (let i = 5; i >= 0; i--) {
        const t = i / 6, inset = 72 + t * 350, topY = 228 + t * 190;
        const baseY = 650, pw = 46 - t * 24, depth = 24 - t * 13;
        const alpha = (.26 + (1 - t) * .42) * dim;
        drawVolumeBox(inset, topY, pw, baseY - topY, depth, '#2c0a24', '#10030e', '#7b2051', alpha, hexA('#ffe15a', .32));
        drawVolumeBox(VW - inset - pw, topY, pw, baseY - topY, depth, '#2c0a24', '#10030e', '#7b2051', alpha, hexA('#ffe15a', .32));
        const span = VW / 2 - inset - pw / 2;
        ctx.save();
        ctx.globalAlpha = alpha * .8;
        ctx.strokeStyle = '#22071c'; ctx.lineWidth = 30 - t * 12;
        ctx.beginPath(); ctx.ellipse(VW / 2, topY + 26, span, 190 - t * 88, 0, Math.PI * 1.02, Math.PI * 1.98); ctx.stroke();
        ctx.globalAlpha = alpha * .9;
        ctx.strokeStyle = faceLit('#8a6a1f', 'top', Math.min(1, bossCrit) * .4); ctx.lineWidth = 4.5 - t * 2;
        ctx.beginPath(); ctx.ellipse(VW / 2, topY + 26, span - (15 - t * 6), 176 - t * 82, 0, Math.PI * 1.03, Math.PI * 1.97); ctx.stroke();
        ctx.restore();
      }
    });
    // The guardian effigies stand proud of the vault ribs — drawn here, after
    // the architecture, so the dark rib pillars never bury their gold.
    drawPalaceStatues(stage);
    drawVolumeFloor(stage, { horizon: 506, bottom: 744, color: '#ffd27a', alpha: .17 * dim, speed: .34 });
    drawPalaceGround(stage);
  }

  // Foreground occlusion band drawn over gameplay: fast, dark, translucent
  // silhouettes confined below y≈660 so the flight lane stays readable.
  function drawForeground(stage) {
    const speed = (stage.theme === 'aqua' ? 92 : stage.theme === 'palace' ? 72 : 118) * 1.45;
    const br = camBreath();
    ctx.save();
    ctx.translate(bgCamX * -.4 + br.x * 1.6, bgCam * -.4 + br.y * 1.6);
    ctx.globalAlpha = .42; ctx.fillStyle = '#050212';
    const off = ((elapsed * speed) % 420 + 420) % 420;
    for (let i = -1; i < 5; i++) {
      const x = i * 420 - off;
      if (stage.theme === 'neon') {
        ctx.fillRect(x, 688, 340, 12);
        ctx.fillRect(x + 20, 666, 10, 34); ctx.fillRect(x + 300, 666, 10, 34);
      } else if (stage.theme === 'aqua') {
        ctx.beginPath(); ctx.moveTo(x, VH + 4);
        for (let k = 0; k <= 340; k += 34) ctx.lineTo(x + k, 692 + Math.sin((x + k) * .045 + elapsed * 3) * 9);
        ctx.lineTo(x + 340, VH + 4); ctx.closePath(); ctx.fill();
      } else if (stage.theme === 'factory') {
        ctx.fillRect(x, 680, 360, 10);
        ctx.fillRect(x + 40, 672, 14, 26); ctx.fillRect(x + 210, 672, 14, 26);
      } else if (stage.theme === 'storm') {
        ctx.beginPath(); ctx.moveTo(x, 676);
        ctx.quadraticCurveTo(x + 170, 706, x + 340, 676); ctx.lineTo(x + 340, 684);
        ctx.quadraticCurveTo(x + 170, 714, x, 684); ctx.closePath(); ctx.fill();
        ctx.fillRect(x - 4, 664, 8, 36);
      } else {
        for (let k = 0; k < 340; k += 46) { ctx.beginPath(); ctx.arc(x + k, 704, 24, Math.PI, 0); ctx.fill(); }
      }
    }
    ctx.restore();
    drawStageForegroundFrame(stage);
    drawBokeh(stage);
  }

  // Very close architecture is drawn after gameplay and therefore genuinely
  // occludes sprites at the extreme edges. This is the strongest depth cue in
  // the scene, but it is deliberately limited to the outer ~8% of the frame.
  function drawStageForegroundFrame(stage) {
    const ox = bgCamX * -.75;
    ctx.save(); ctx.translate(ox, bgCam * -.55);
    if (stage.theme === 'neon') {
      drawVolumeBox(-58, 92, 78, 578, 34, '#050313', '#020108', '#29154a', .72, hexA(stage.accent, .3));
      drawVolumeBox(VW - 18, 58, 82, 612, 36, '#070316', '#020108', '#371748', .74, hexA(stage.accent2, .34));
    } else if (stage.theme === 'aqua') {
      ctx.globalAlpha = .7; ctx.strokeStyle = '#06152a'; ctx.lineWidth = 18;
      ctx.beginPath(); ctx.moveTo(-5, 690); ctx.quadraticCurveTo(110, 210, 240, -30); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(VW + 5, 690); ctx.quadraticCurveTo(VW - 110, 210, VW - 240, -30); ctx.stroke();
      ctx.strokeStyle = hexA(stage.accent, .28); ctx.lineWidth = 3;
      for (let y = 150; y < 650; y += 70) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(70, y - 90); ctx.moveTo(VW, y); ctx.lineTo(VW - 70, y - 90); ctx.stroke(); }
    } else if (stage.theme === 'factory') {
      const pipe = ctx.createLinearGradient(0, 0, 95, 0); pipe.addColorStop(0, '#080408'); pipe.addColorStop(.55, '#5c2831'); pipe.addColorStop(1, '#140811');
      ctx.globalAlpha = .78; ctx.fillStyle = pipe; ctx.fillRect(-30, 100, 78, 570); ctx.fillRect(VW - 48, 64, 78, 606);
      ctx.strokeStyle = '#160b12'; ctx.lineWidth = 13;
      for (let y = 180; y < 650; y += 150) { ctx.strokeRect(-12, y, 74, 42); ctx.strokeRect(VW - 62, y + 55, 74, 42); }
      ctx.fillStyle = hexA(stage.accent, .5); ctx.fillRect(42, 104, 4, 560); ctx.fillRect(VW - 48, 68, 4, 596);
    } else if (stage.theme === 'storm') {
      drawVolumeBox(-64, 116, 86, 558, 46, '#020d0b', '#010504', '#155b49', .7, hexA(stage.accent, .48));
      drawVolumeBox(VW - 22, 90, 88, 584, 48, '#020d0b', '#010504', '#155b49', .7, hexA(stage.accent2, .46));
    } else {
      drawVolumeBox(-54, 84, 82, 590, 38, '#170315', '#070106', '#6f1746', .76, hexA('#ffe15a', .38));
      drawVolumeBox(VW - 28, 84, 82, 590, 38, '#170315', '#070106', '#6f1746', .76, hexA('#ffe15a', .38));
      ctx.globalAlpha = .35; ctx.fillStyle = '#7b174e';
      ctx.beginPath(); ctx.moveTo(12, 84); ctx.quadraticCurveTo(115, 180, 28, 330); ctx.lineTo(-20, 330); ctx.lineTo(-20, 84); ctx.fill();
      ctx.beginPath(); ctx.moveTo(VW - 12, 84); ctx.quadraticCurveTo(VW - 115, 180, VW - 28, 330); ctx.lineTo(VW + 20, 330); ctx.lineTo(VW + 20, 84); ctx.fill();
      // gilded fillet + heart studs on the near pillars
      ctx.globalAlpha = .7; ctx.fillStyle = '#c9a13b';
      ctx.fillRect(20, 84, 4, 590); ctx.fillRect(VW - 24, 84, 4, 590);
      ctx.fillStyle = '#ffe15a';
      for (let y = 150; y < 650; y += 125) { heartPath(22, y, 6); ctx.fill(); heartPath(VW - 22, y, 6); ctx.fill(); }
    }
    ctx.restore();
  }

  // Defocused foreground light orbs: big, soft, low-alpha radial gradients that
  // race past faster than anything else and shift hardest with the camera, so
  // the scene reads as if shot through a lens with a shallow focal plane. Alpha
  // stays low and blending stays normal (not additive) to keep the flight lane
  // readable. Auto-skips when the frame budget is tight.
  function drawBokeh(stage) {
    if (fpsAvg < 45) return;
    ctx.save();
    ctx.translate(bgCamX * -.8, bgCam * -.8);
    for (const b of bokeh) {
      const y = b.y + Math.sin(elapsed * b.bobV + b.bob) * 14;
      const col = b.tint ? stage.accent2 : stage.accent;
      const g = ctx.createRadialGradient(b.x, y, 0, b.x, y, b.r);
      g.addColorStop(0, hexA(col, b.a * 1.6));
      g.addColorStop(.55, hexA(col, b.a));
      g.addColorStop(1, hexA(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(b.x, y, b.r, 0, Math.PI * 2); ctx.fill();
      // A brighter core hints at the iris without lifting overall brightness.
      ctx.globalAlpha = b.a * 3;
      ctx.fillStyle = hexA(col, .5);
      ctx.beginPath(); ctx.arc(b.x, y, b.r * .16, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  // Atmospheric perspective: distant layers fade into a haze the colour of the sky,
  // and a warm glow leaks up from the neon ground for depth.
  function drawAtmosphere(stage) {
    ctx.save();
    // Aerial perspective is densest along the horizon and thins BOTH ways — up
    // into clear sky and down into the near ground. A ramp that just gets
    // heavier toward the bottom of the screen fogs the foreground, which is the
    // one part of the frame that should stay crisp.
    const haze = cachedGrad('haze' + stageIndex, () => {
      const grad = ctx.createLinearGradient(0, 250, 0, 690);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(.5, hexA(stage.sky[1], .12));
      grad.addColorStop(.8, hexA(stage.sky[1], .34));   // the horizon band itself
      grad.addColorStop(1, hexA(stage.sky[1], .14));
      return grad;
    });
    ctx.fillStyle = haze; ctx.fillRect(0, 250, VW, 440);
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

  // Baked high-rise facade: a window grid with a deterministic mix of lit,
  // dark and curtained cells, plus one vertical neon sign strip. Bake once,
  // blit into whatever perspective rect boxZ hands back.
  function neonTowerSprite(v) {
    return bakeSprite('neonTower' + v, 96, 340, bc => {
      const g = bc.createLinearGradient(0, 0, 96, 0);
      g.addColorStop(0, '#191243'); g.addColorStop(.42, '#241a57'); g.addColorStop(1, '#0d0930');
      bc.fillStyle = g; bc.fillRect(0, 0, 96, 340);
      let s = v * 977 + 13;
      const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
      const cols = ['#31e8ff', '#ff3e9d', '#ffe15a', '#8d7bff'];
      for (let fy = 10; fy < 332; fy += 14) {
        const floorLit = rnd() > .3;
        for (let fx = 7; fx < 88; fx += 12) {
          const r = rnd();
          bc.fillStyle = (!floorLit || r < .35) ? 'rgba(8,6,28,.9)' : hexA(cols[(r * 17 | 0) % 4], .28 + r * .6);
          bc.fillRect(fx, fy, 8, 9);
        }
      }
      const sx2 = v % 2 ? 78 : 4, c = cols[v % 4];
      bc.fillStyle = '#07051d'; bc.fillRect(sx2, 26, 14, 118);
      bc.strokeStyle = c; bc.lineWidth = 2; bc.strokeRect(sx2 + 1, 27, 12, 116);
      bc.fillStyle = c;
      for (let i = 0; i < 5; i++) bc.fillRect(sx2 + 4, 34 + i * 22, 6, 12);
      bc.fillStyle = '#2a1e5e'; bc.fillRect(0, 0, 96, 6);
      bc.fillStyle = hexA(c, .8); bc.fillRect(0, 0, 96, 2);
    });
  }

  // True-3D city canyon: two ranks of extruded towers cross the scene through
  // the shared pinhole camera — near facades slide faster than far ones
  // automatically, side faces aim at the one vanishing point and each rank
  // sinks into the haze with distance. Bases anchor to the near-city ground
  // band so nothing floats.
  function drawNeonCanyon(stage) {
    const q = bgQuality();
    if (!q) return;
    const ranks = q === 2 ? [[1900, 470, .55], [950, 590, .78]] : [[950, 590, .78]];
    for (const [z, gap, alpha] of ranks) {
      const s = FOCAL / (FOCAL + z);
      const yBase = HORIZON_Y + 78 / s;               // projected base ≈ y638, behind the near city strip
      const t0 = elapsed * 120;
      const half = (VW / 2 + 90) / s;
      const k0 = Math.floor((VW / 2 - half + t0) / gap), k1 = Math.ceil((VW / 2 + half + t0) / gap);
      const fog = fogAmount(z);
      const side = fogMix('#0a0726', z);
      for (let k = k0; k <= k1; k++) {
        const wx = k * gap - t0;
        const h = 560 + (((k * 73) % 7) + 7) % 7 * 62;
        const bw = gap * .62;
        const r = boxZ(wx, wx + bw, yBase - h, yBase, z, z + 280, null, side, null, alpha);
        if (r.x > VW + 60 || r.x + r.w < -60) continue;
        ctx.save(); ctx.globalAlpha = alpha;
        blit(neonTowerSprite(((k % 4) + 4) % 4), r.x, r.y, r.w, r.h);
        ctx.globalAlpha = alpha * fog * .85;
        ctx.fillStyle = stage.sky[1]; ctx.fillRect(r.x, r.y, r.w, r.h);
        // rooftop antenna with a blinking aviation beacon on every third tower
        if (((k % 3) + 3) % 3 === 0) {
          const ax = r.x + r.w * .5;
          ctx.globalAlpha = alpha * .8; ctx.strokeStyle = '#241a57'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(ax, r.y); ctx.lineTo(ax, r.y - 34 * r.s); ctx.stroke();
          const tw = .5 + Math.sin(elapsed * 2.4 + k * 1.7) * .5;
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha * tw;
          ctx.fillStyle = '#ff5a5a';
          ctx.beginPath(); ctx.arc(ax, r.y - 34 * r.s, 1.6 + 1.8 * r.s, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }
    }
  }

  function drawNeonBackdrop(stage) {
    bgLayer(.5, () => {
      drawMoon(970, 145, 42, '#fff3aa', 'rgba(255,225,90,A)');
      drawSkyRibbons();
      drawStars(90, '#ffe15a', '#8defff');
      for (const c of clouds) drawCloud(c, '#d7ddff', .11);
    });
    bgLayer(.34, () => {
      for (const p of bgProps) if (p.kind === 'searchlight') drawSearchlight(p, stage);
      // Ultra-far third skyline: three city depths with haze between them.
      drawCity((elapsed * -3) % 60, 468, stage.far, 26, .16, 5);
      drawCity((elapsed * -7) % 80, 505, stage.far, 40, .32, 8);
      drawTokyoTower(stage);
      draw109Tower(stage);
    });
    drawDepthHaze(stage, .55);
    drawNeonCanyon(stage);
    bgLayer(.15, () => {
      for (const p of bgProps) if (p.kind === 'car') drawFlyingCar(p, stage);
      drawCity((elapsed * -20) % 120, 600, stage.city, 54, .78, 18);
      drawTokyoExpressway(stage);
      drawNeonRail(stage);
      for (const p of bgProps) if (p.kind === 'speaker') drawSpeaker(p, stage);
      drawStorefronts(stage);
      drawShibuyaScreen(stage);
    });
    drawScrambleCrossing(stage);
    drawGroundLayer();
    drawGroundPlane(stage, { horizonY: 606, bottom: 704, alpha: .1, speed: 90, gap: 110 });
    drawTokyoRoadLights(stage);
    drawShoppers();
  }

  // Giant club-speaker stack pumping with the BGM: two cabinets, cones that
  // swell with the bass level (real AnalyserNode over http, sin-pulse on
  // file://) and a dust ring that pops on each hard beat.
  function drawSpeaker(p, stage) {
    const level = musicLevel();
    const base = 648;
    if (level > .8 && elapsed - p.ringT > .35) p.ringT = elapsed;
    ctx.save();
    ctx.translate(p.x, 0);
    for (let c = 0; c < 2; c++) {
      const cy = base - 118 - c * 122, cw = 118, ch = 118;
      drawVolumeBox(-cw / 2, cy, cw, ch, 12, '#120b30', '#07051d', '#2a1e5e', .92, hexA(stage.accent2, .3 + level * .35));
      // woofer + tweeter, scaled by the live bass level
      const cones = [[cy + ch * .62, 34], [cy + ch * .24, 17]];
      for (const [wy, wr] of cones) {
        const s = 1 + level * .12;
        ctx.save(); ctx.translate(0, wy); ctx.scale(s, s);
        ctx.fillStyle = '#07051d'; ctx.beginPath(); ctx.arc(0, 0, wr, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = hexA(stage.accent, .55 + level * .4); ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, wr - 2, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, 0, wr * .55, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = hexA(stage.accent2, .5 + level * .5);
        ctx.beginPath(); ctx.arc(0, 0, wr * .2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
    // beat ring: a fast additive pulse leaving the woofer on hard beats
    const ringAge = elapsed - p.ringT;
    if (ringAge >= 0 && ringAge < .4 && bgQuality() > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (1 - ringAge / .4) * .5;
      ctx.strokeStyle = stage.accent; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, base - 118 + 118 * .62 - 122, 36 + ringAge * 190, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    // grounding shadow
    ctx.fillStyle = 'rgba(5,2,18,.5)';
    ctx.beginPath(); ctx.ellipse(0, base, 66, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // A compact neon commuter train threads between the high-rises. The repeating
  // lit windows and reflected rail glow add life without entering the main flight
  // lane; it sits behind the storefront row and moves slower than nearby traffic.
  function drawNeonRail(stage) {
    const railY = 420;
    const trainX = VW + 300 - (elapsed * 78) % 2200;
    ctx.save();
    ctx.globalAlpha = .58;
    ctx.fillStyle = '#08051c'; ctx.fillRect(-40, railY + 31, VW + 80, 13);
    ctx.fillStyle = hexA(stage.accent2, .5); ctx.fillRect(-40, railY + 31, VW + 80, 2);
    for (let x = -80; x < VW + 100; x += 184) {
      ctx.fillStyle = '#0c0820'; ctx.fillRect(x, railY + 40, 12, 74);
      ctx.fillStyle = hexA(stage.accent, .18); ctx.fillRect(x + 3, railY + 44, 3, 68);
    }
    ctx.translate(trainX, railY);
    const cars = 3;
    for (let i = 0; i < cars; i++) {
      const x = -i * 154;
      const body = ctx.createLinearGradient(x, 0, x, 31);
      body.addColorStop(0, '#755b9d'); body.addColorStop(.28, '#2c244d'); body.addColorStop(1, '#0a081b');
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.roundRect(x - 146, 0, 144, 31, i === 0 ? [15, 4, 4, 15] : 4); ctx.fill();
      ctx.fillStyle = hexA(stage.accent, .85); ctx.fillRect(x - 137, 6, 24, 13);
      ctx.fillStyle = hexA(stage.accent2, .7);
      for (let w = 0; w < 4; w++) ctx.fillRect(x - 104 + w * 23, 6, 16, 13);
      ctx.fillStyle = 'rgba(255,255,255,.32)'; ctx.fillRect(x - 137, 5, 116, 2);
      ctx.fillStyle = '#090619'; ctx.fillRect(x - 126, 27, 20, 5); ctx.fillRect(x - 43, 27, 20, 5);
    }
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .3;
    ctx.fillStyle = stage.accent2; ctx.fillRect(-cars * 154 + 8, 32, cars * 154 - 16, 4);
    ctx.restore();
  }

  // A distant, unmistakably Tokyo red-and-white lattice tower. The tapered
  // truss, observation decks and aviation beacons are kept translucent so it
  // anchors the location without competing with bullets in the play lane.
  function drawTokyoTower(stage) {
    const loop = 2280;
    const base = 300 - (elapsed * 4) % loop;
    for (let r = 0; r < 2; r++) {
      const cx = base + r * loop;
      if (cx < -170 || cx > VW + 170) continue;
      const baseY = 512, topY = 162, h = baseY - topY;
      const halfAt = y => 6 + ((y - topY) / h) * 70;
      ctx.save(); ctx.globalAlpha = .66;

      // soft amber halo behind the tower
      const halo = ctx.createRadialGradient(cx, 322, 5, cx, 322, 180);
      halo.addColorStop(0, hexA('#ff7048', .14));
      halo.addColorStop(1, 'rgba(255,80,50,0)');
      ctx.fillStyle = halo; ctx.fillRect(cx - 180, 142, 360, 370);

      // four tapered legs and alternating white/red truss sections
      ctx.lineCap = 'round'; ctx.lineWidth = 4;
      for (let seg = 0; seg < 10; seg++) {
        const y0 = topY + seg * h / 10, y1 = topY + (seg + 1) * h / 10;
        const w0 = halfAt(y0), w1 = halfAt(y1);
        const col = seg % 3 === 1 ? '#f3edf7' : '#ff4f48';
        ctx.strokeStyle = col;
        ctx.beginPath();
        ctx.moveTo(cx - w0, y0); ctx.lineTo(cx - w1, y1);
        ctx.moveTo(cx + w0, y0); ctx.lineTo(cx + w1, y1);
        ctx.moveTo(cx - w0, y0); ctx.lineTo(cx + w1, y1);
        ctx.moveTo(cx + w0, y0); ctx.lineTo(cx - w1, y1);
        ctx.stroke();
        ctx.globalAlpha = .42;
        ctx.beginPath(); ctx.moveTo(cx - w1, y1); ctx.lineTo(cx + w1, y1); ctx.stroke();
        ctx.globalAlpha = .66;
      }

      // observation decks, antenna and blinking beacons
      for (const [y, w] of [[286, 82], [318, 104]]) {
        const deck = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
        deck.addColorStop(0, '#5a1830'); deck.addColorStop(.5, '#ff9a54'); deck.addColorStop(1, '#4a1329');
        ctx.fillStyle = deck; ctx.fillRect(cx - w / 2, y, w, 10);
        ctx.fillStyle = '#fff0c8'; ctx.fillRect(cx - w * .38, y + 3, w * .76, 2);
      }
      ctx.fillStyle = '#eee9f4'; ctx.fillRect(cx - 2, topY - 57, 4, 58);
      ctx.fillStyle = Math.sin(elapsed * 4) > 0 ? '#fff' : '#ff3e9d';
      ctx.shadowColor = '#ff3e9d'; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.arc(cx, topY - 58, 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  // Shuto Expressway-inspired elevated road. The top, fascia and dark underside
  // use different values, while columns shrink toward the horizon. Two traffic
  // streams move at different speeds to reinforce depth and direction.
  function drawTokyoExpressway(stage) {
    const horizonY = 505;
    const roadY = x => horizonY + Math.sin(x * .0032 + elapsed * .035) * 13;
    ctx.save(); ctx.globalAlpha = .82;

    // repeating supports recede into the skyline
    const supportOff = (elapsed * 14) % 250;
    for (let x = -180 - supportOff; x < VW + 220; x += 250) {
      const y = roadY(x), lean = (x - VW / 2) * .025;
      ctx.fillStyle = '#0a0a22';
      ctx.beginPath();
      ctx.moveTo(x - 12, y + 30); ctx.lineTo(x + 14, y + 30);
      ctx.lineTo(x + 25 + lean, 606); ctx.lineTo(x - 22 + lean, 606);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = hexA(stage.accent, .13); ctx.fillRect(x - 8, y + 34, 4, 566 - y);
    }

    // road top, vertical fascia, then a deep underside shadow
    ctx.beginPath();
    for (let x = -60; x <= VW + 60; x += 40) x === -60 ? ctx.moveTo(x, roadY(x)) : ctx.lineTo(x, roadY(x));
    for (let x = VW + 60; x >= -60; x -= 40) ctx.lineTo(x, roadY(x) + 13);
    ctx.closePath(); ctx.fillStyle = '#302b4f'; ctx.fill();

    ctx.beginPath();
    for (let x = -60; x <= VW + 60; x += 40) x === -60 ? ctx.moveTo(x, roadY(x) + 13) : ctx.lineTo(x, roadY(x) + 13);
    for (let x = VW + 60; x >= -60; x -= 40) ctx.lineTo(x, roadY(x) + 31);
    ctx.closePath();
    const fascia = ctx.createLinearGradient(0, horizonY + 10, 0, horizonY + 42);
    fascia.addColorStop(0, '#18152f'); fascia.addColorStop(1, '#070718');
    ctx.fillStyle = fascia; ctx.fill();

    ctx.strokeStyle = hexA(stage.accent, .46); ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = -60; x <= VW + 60; x += 40) x === -60 ? ctx.moveTo(x, roadY(x) + 1) : ctx.lineTo(x, roadY(x) + 1);
    ctx.stroke();

    // barrier posts provide a readable scale reference
    const postOff = (elapsed * 22) % 44;
    ctx.strokeStyle = '#7774a0'; ctx.lineWidth = 2;
    for (let x = -44 - postOff; x < VW + 44; x += 44) {
      const y = roadY(x);
      ctx.beginPath(); ctx.moveTo(x, y - 8); ctx.lineTo(x, y + 2); ctx.lineTo(x + 34, roadY(x + 34) + 2); ctx.stroke();
    }

    drawTokyoTraffic(stage, roadY, 92, 95, 1);
    drawTokyoTraffic(stage, roadY, 132, 118, -1);
    ctx.restore();
  }

  function drawTokyoTraffic(stage, roadY, speed, spacing, dir) {
    const travel = VW + spacing * 3;
    const offset = (elapsed * speed) % travel;
    for (let i = -2; i < Math.ceil(VW / spacing) + 3; i++) {
      const x = dir > 0
        ? (i * spacing + offset) % travel - spacing
        : VW + spacing - (i * spacing + offset) % travel;
      if (x < -60 || x > VW + 60 || (i + stageIndex) % 3 === 0) continue;
      const y = roadY(x) - 6;
      ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
      ctx.fillStyle = i % 4 === 0 ? '#d8d7e8' : i % 4 === 1 ? '#291a4b' : '#18243c';
      ctx.fillRect(-15, -5, 31, 7); ctx.fillRect(-8, -10, 17, 6);
      ctx.fillStyle = '#75dfff'; ctx.fillRect(-5, -9, 8, 4);
      const lamp = dir > 0 ? '#fff3a8' : stage.accent2;
      ctx.fillStyle = lamp; ctx.shadowColor = lamp; ctx.shadowBlur = 8;
      ctx.fillRect(13, -2, 4, 3);
      ctx.globalAlpha = .16; ctx.fillRect(17, -2, 30, 3);
      ctx.restore();
    }
  }

  // Moving lamp and tail-light reflections on the wet foreground asphalt. Long,
  // tapered streaks sit below y=660 so gameplay silhouettes remain uncluttered.
  function drawTokyoRoadLights(stage) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const travel = VW + 260, off = (elapsed * 240) % travel;
    for (let i = 0; i < 8; i++) {
      const x = (i * 210 + off) % travel - 130;
      const c = i % 3 ? stage.accent2 : '#ffe6a0';
      const glow = ctx.createLinearGradient(0, 660, 0, VH);
      glow.addColorStop(0, hexA(c, .24)); glow.addColorStop(1, hexA(c, 0));
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.moveTo(x - 5, 660); ctx.lineTo(x + 6, 660);
      ctx.lineTo(x + 24, VH); ctx.lineTo(x - 20, VH); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = .7; ctx.fillStyle = c;
      ctx.fillRect(x - 4, 663, 4, 2); ctx.fillRect(x + 3, 663, 4, 2);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
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

  // Shibuya-style row of actual shops lining the street. Each entry is a whole
  // storefront — facade, lit interior with patrons, awning, entrance and a neon
  // sign mounted on it — so the signs read as belonging to real buildings rather
  // than floating text. They scroll at the same speed as the near city behind.
  const SHOPS = [
    { x: 40,   w: 178, text: 'ラーメン', c: '#ffe15a', v: false, awn: '#c0143b', kind: 'ramen' },
    { x: 288,  w: 150, text: 'カラオケ', c: '#ff3e9d', v: true,  awn: '#3a1c6e', kind: 'karaoke' },
    { x: 500,  w: 186, text: '居酒屋',   c: '#31e8ff', v: false, awn: '#b5321f', kind: 'izakaya' },
    { x: 754,  w: 150, text: '薬粧',     c: '#ff8a35', v: true,  awn: '#1f6e4a', kind: 'pharmacy' },
    { x: 968,  w: 178, text: '安い！',   c: '#72ff68', v: false, awn: '#7a1c5a', kind: 'discount' },
    { x: 1204, w: 196, text: 'SHIBUYA', c: '#ff3e9d', v: false, awn: '#243a8a', kind: 'fashion' }
  ];
  const SHOP_STRIP = 1460;

  // Walk the shoppers along the street: the world scrolls left at the shop speed
  // (~20px/s) and each person adds their own gait on top, so some overtake and
  // some drift back. They wrap around either edge.
  function stepShoppers(dt) {
    for (const p of shoppers) {
      p.x += (p.dir * p.spd - 20) * dt * gameSpeed;
      p.phase += dt * (4.5 + p.spd * .12);
      if (p.x < -50) p.x = VW + 50 + Math.random() * 90;
      else if (p.x > VW + 60) p.x = -50 - Math.random() * 90;
    }
  }

  // Chibi pedestrians with swinging legs and shopping bags — the "customers" that
  // make the storefronts feel like an open, lived-in shopping street.
  function drawShoppers() {
    for (const p of shoppers) {
      const s = p.scale, bob = Math.abs(Math.sin(p.phase)) * 2 * s, swing = Math.sin(p.phase) * 4;
      ctx.save();
      ctx.globalAlpha = .32; ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(p.x, p.baseY + 2, 9 * s, 3 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.translate(p.x, p.baseY - bob); ctx.scale(p.dir * s, s);
      ctx.lineCap = 'round';
      // legs
      ctx.strokeStyle = '#160f1e'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(swing, 0); ctx.moveTo(0, -14); ctx.lineTo(-swing, 0); ctx.stroke();
      // coat / torso
      ctx.fillStyle = p.coat;
      ctx.beginPath(); ctx.moveTo(-6, -13); ctx.lineTo(6, -13); ctx.lineTo(5, -30); ctx.lineTo(-5, -30); ctx.closePath(); ctx.fill();
      // arm + shopping bag
      if (p.bag) {
        ctx.strokeStyle = '#160f1e'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(5, -25); ctx.lineTo(11, -15); ctx.stroke();
        ctx.fillStyle = p.bagC; ctx.fillRect(8, -15, 7, 10);
        ctx.strokeStyle = shade(p.bagC, .7); ctx.strokeRect(8, -15, 7, 10);
      }
      // head + hair
      ctx.fillStyle = '#f0c9a0'; ctx.beginPath(); ctx.arc(0, -34, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#241626'; ctx.beginPath(); ctx.arc(0, -35, 5, Math.PI, 0); ctx.fill();
      ctx.restore();
    }
  }

  function drawStorefronts(stage) {
    const scroll = (elapsed * 20) % SHOP_STRIP;
    for (let repeat = 0; repeat < 3; repeat++) for (const s of SHOPS) {
      const x = s.x - scroll + repeat * SHOP_STRIP;
      if (x < -280 || x > VW + 60) continue;
      drawShop(x, s, stage);
    }
  }

  function drawShopSign(bx, by, bw, bh, s) {
    const on = (Math.floor(elapsed * 2 + bx * .07) % 11) !== 0;
    ctx.save();
    ctx.fillStyle = '#0b0929'; ctx.fillRect(bx, by, bw, bh);
    ctx.shadowColor = s.c; ctx.shadowBlur = on ? 14 : 2;
    ctx.strokeStyle = on ? s.c : '#3a2a66'; ctx.lineWidth = 3; ctx.strokeRect(bx + 1.5, by + 1.5, bw - 3, bh - 3);
    ctx.fillStyle = on ? s.c : '#4a3a76';
    ctx.textAlign = 'center';
    if (s.v) {
      ctx.font = '17px "DotGothic16", monospace';
      [...s.text].forEach((ch, i) => ctx.fillText(ch, bx + bw / 2, by + 24 + i * 22));
    } else {
      ctx.font = s.text === 'SHIBUYA' ? '13px "Press Start 2P", monospace' : '18px "DotGothic16", monospace';
      ctx.fillText(s.text, bx + bw / 2, by + bh / 2 + 7);
    }
    ctx.restore();
  }

  function drawShop(x, s, stage) {
    const base = 604, top = 452, w = s.w, h = base - top;
    const gf = base - 76;                       // ground-floor shopfront top
    const warm = s.kind === 'pharmacy' ? '#8fffe0' : '#ffbf66';
    ctx.save();

    // Facade block with a touch of side shading for volume.
    ctx.fillStyle = '#0d0b24'; ctx.fillRect(x, top, w, h);
    ctx.fillStyle = 'rgba(0,0,0,.34)'; ctx.fillRect(x + w - 9, top, 9, h);
    ctx.fillStyle = hexA(s.c, .5); ctx.fillRect(x, top, w, 3);

    // Dim upper-floor windows.
    ctx.fillStyle = hexA(stage.accent, .1);
    for (let yy = top + 12; yy < gf - 22; yy += 22)
      for (let xx = x + 12; xx < x + w - 14; xx += 26)
        if ((xx + yy) % 3 !== 0) ctx.fillRect(xx, yy, 15, 12);

    // Lit ground-floor interior: warm gradient with patron silhouettes.
    const winTop = gf + 2, winBot = base - 6;
    const glow = ctx.createLinearGradient(0, winTop, 0, winBot);
    glow.addColorStop(0, '#241704'); glow.addColorStop(1, hexA(warm, .92));
    ctx.fillStyle = glow; ctx.fillRect(x + 6, winTop, w - 12, winBot - winTop);
    ctx.fillStyle = 'rgba(9,5,18,.85)';
    const seats = Math.max(2, Math.floor(w / 58));
    for (let i = 0; i < seats; i++) {
      const px = x + 22 + i * ((w - 40) / seats) + Math.sin(elapsed * .8 + i + s.x) * 1.4;
      ctx.beginPath(); ctx.arc(px, base - 32, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(px - 7, base - 26, 14, 22);
    }
    ctx.strokeStyle = hexA(s.c, .5); ctx.lineWidth = 2; ctx.strokeRect(x + 6, winTop, w - 12, winBot - winTop);

    // Entrance: split noren for the eateries, glowing glass door for the rest.
    const dw = 48, dx = x + w / 2 - dw / 2;
    if (s.kind === 'ramen' || s.kind === 'izakaya') {
      const pw = dw / 3 - 2;
      for (let p = 0; p < 3; p++) {
        const sway = Math.sin(elapsed * 1.6 + p) * 2, lx = dx + p * (pw + 2);
        ctx.fillStyle = p % 2 ? shade(s.awn, 1.3) : s.awn;
        ctx.beginPath();
        ctx.moveTo(lx, winTop + 2); ctx.lineTo(lx + pw, winTop + 2);
        ctx.lineTo(lx + pw + sway, winTop + 30); ctx.lineTo(lx + sway, winTop + 30);
        ctx.closePath(); ctx.fill();
      }
    } else {
      ctx.fillStyle = hexA(s.c, .28); ctx.fillRect(dx, winTop + 4, dw, winBot - winTop - 8);
      ctx.strokeStyle = hexA(s.c, .7); ctx.lineWidth = 2; ctx.strokeRect(dx, winTop + 4, dw, winBot - winTop - 8);
    }

    // Striped fabric awning with a scalloped hem over the shopfront.
    const ay = gf, ah = 15;
    for (let i = 0; i * 18 < w - 4; i++) {
      ctx.fillStyle = i % 2 ? s.awn : shade(s.awn, 1.45);
      ctx.fillRect(x + 2 + i * 18, ay - ah, Math.min(18, w - 4 - i * 18), ah);
    }
    ctx.fillStyle = s.awn;
    for (let i = 0; i * 18 < w - 16; i++) { ctx.beginPath(); ctx.arc(x + 11 + i * 18, ay, 9, 0, Math.PI); ctx.fill(); }

    // Red paper lantern by the entrance of the eateries.
    if (s.kind === 'ramen' || s.kind === 'izakaya') {
      const lx = x + w - 24, ly = gf + 16;
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(lx - 1, gf - 8, 2, 22);
      ctx.save(); ctx.shadowColor = '#ff5a36'; ctx.shadowBlur = 14; ctx.fillStyle = '#ff5233';
      ctx.beginPath(); ctx.ellipse(lx, ly, 11, 15, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(lx - 11, ly - 2, 22, 2);
    }

    // Neon shop sign: a blade sign for vertical text, a marquee otherwise.
    if (s.v) drawShopSign(x + 8, top + 16, 34, s.text.length * 22 + 18, s);
    else {
      const sw = Math.min(w - 16, s.text.length * 20 + 22);
      drawShopSign(x + w / 2 - sw / 2, top + 20, sw, 34, s);
    }

    // Warm light spilling from the doorway onto the pavement.
    const spill = ctx.createLinearGradient(0, base, 0, base + 48);
    spill.addColorStop(0, hexA(warm, .2)); spill.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = spill;
    const cx = x + w / 2;
    ctx.beginPath();
    ctx.moveTo(cx - 32, base); ctx.lineTo(cx + 32, base);
    ctx.lineTo(cx + 58, base + 48); ctx.lineTo(cx - 58, base + 48);
    ctx.closePath(); ctx.fill();

    ctx.restore();
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

  // Per-theme walk surfaces. Stage 1's neon street has its own drawGroundLayer;
  // these give the other stages an equally distinct ground band (y=650 down),
  // matching where the player lands and ground enemies stand.
  function drawAquaGround(stage) {
    const ground = 650;
    // open sea filling the band, foam lines rolling under the deck
    const sea = cachedGrad('aquaNearSea', () => {
      const gr = ctx.createLinearGradient(0, ground, 0, VH);
      gr.addColorStop(0, '#0b3f66'); gr.addColorStop(1, '#031225');
      return gr;
    });
    ctx.fillStyle = sea; ctx.fillRect(0, ground, VW, VH - ground);
    // Near swell: this is the closest water on screen, so the rolling rows are
    // big and slow with bright crest specular — the camera-side counterpart of
    // drawOcean's fog-sunk far bands.
    ctx.save();
    for (let i = 0; i < 4; i++) {
      const t = i / 3;
      const y0 = 662 + i * 19, amp = 5 + t * 7;
      const pts = [];
      for (let x = -30; x <= VW + 30; x += 26) {
        pts.push({ x, y: y0 + Math.sin(x * (.02 - t * .008) + elapsed * (1.3 + t * .8) + i * 2.1) * amp });
      }
      ctx.globalAlpha = .5;
      ctx.fillStyle = ['#0e4a75', '#0a3a60', '#07294a', '#041b35'][i];
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (const p2 of pts) ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(VW + 30, VH + 30); ctx.lineTo(-30, VH + 30);
      ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = i % 2 ? stage.accent : '#bdf3ff'; ctx.lineWidth = 1.4 + t * 1.4; ctx.globalAlpha = .1 + t * .16;
      ctx.beginPath();
      for (let j = 1; j < pts.length; j++) {
        if (pts[j].y < pts[j - 1].y) { ctx.moveTo(pts[j - 1].x, pts[j - 1].y); ctx.lineTo(pts[j].x, pts[j].y); }
      }
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
    // the highway deck the player actually walks on
    const deck = ctx.createLinearGradient(0, ground - 26, 0, ground + 16);
    deck.addColorStop(0, '#41586e'); deck.addColorStop(.55, '#22384c'); deck.addColorStop(1, '#0d1c2c');
    ctx.fillStyle = deck; ctx.fillRect(0, ground - 26, VW, 42);
    ctx.fillStyle = hexA(stage.accent, .9); ctx.fillRect(0, ground - 26, VW, 3);
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    const dashOff = (elapsed * 240) % 84;
    for (let x = -dashOff; x < VW + 90; x += 84) ctx.fillRect(x, ground - 7, 40, 4);
    // guardrail on the sea side
    ctx.fillStyle = 'rgba(190,235,248,.8)'; ctx.fillRect(0, ground - 48, VW, 4);
    const railOff = (elapsed * 240) % 120;
    ctx.fillStyle = '#9fd9e8';
    for (let x = -railOff; x < VW + 130; x += 120) ctx.fillRect(x, ground - 46, 5, 22);
  }

  function drawFactoryGround(stage) {
    const ground = 650;
    const base = ctx.createLinearGradient(0, ground, 0, VH);
    base.addColorStop(0, '#2a1520'); base.addColorStop(1, '#0c060d');
    ctx.fillStyle = base; ctx.fillRect(0, ground, VW, VH - ground);
    // riveted steel plates with furnace glow leaking between them
    const off = (elapsed * 150) % 150;
    for (let x = -off - 150; x < VW + 150; x += 150) {
      const glow = .5 + Math.sin(elapsed * 3 + x * .02) * .3;
      ctx.fillStyle = hexA('#ff7a2d', .3 + glow * .3); ctx.fillRect(x - 9, ground + 16, 11, 40);
      ctx.fillStyle = '#3a2030'; ctx.fillRect(x + 2, ground + 14, 146, 46);
      ctx.fillStyle = 'rgba(255,255,255,.09)'; ctx.fillRect(x + 2, ground + 14, 146, 5);
      ctx.fillStyle = '#61374a';
      for (const rx of [10, 136]) { ctx.fillRect(x + rx, ground + 22, 4, 4); ctx.fillRect(x + rx, ground + 50, 4, 4); }
    }
    // hazard-striped lip along the walk edge
    ctx.fillStyle = '#1b0d15'; ctx.fillRect(0, ground, VW, 12);
    const hz = (elapsed * 150) % 48;
    ctx.fillStyle = '#ffcf4d';
    for (let x = -hz; x < VW + 48; x += 48) {
      ctx.beginPath(); ctx.moveTo(x, ground + 12); ctx.lineTo(x + 18, ground); ctx.lineTo(x + 30, ground); ctx.lineTo(x + 12, ground + 12); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = hexA(stage.accent2, .8); ctx.fillRect(0, ground, VW, 2);
  }

  function drawStormGround(stage) {
    const ground = 650;
    const base = ctx.createLinearGradient(0, ground, 0, VH);
    base.addColorStop(0, '#07231d'); base.addColorStop(1, '#020a09');
    ctx.fillStyle = base; ctx.fillRect(0, ground, VW, VH - ground);
    // scrolling circuit traces with nodes
    const off = (elapsed * 180) % 160;
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const y = ground + 18 + i * 20, jog = i % 2 ? 8 : -8;
      ctx.globalAlpha = .5 - i * .12; ctx.strokeStyle = stage.accent; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = -off + i * 40 - 160; x < VW + 160; x += 160) {
        ctx.moveTo(x, y); ctx.lineTo(x + 90, y); ctx.lineTo(x + 104, y + jog); ctx.lineTo(x + 150, y + jog);
      }
      ctx.stroke();
      ctx.fillStyle = hexA(stage.accent2, .7);
      for (let x = -off + i * 40 - 160; x < VW + 160; x += 160) ctx.fillRect(x + 88, y - 3, 6, 6);
    }
    ctx.restore();
    // flickering glitch tiles
    const tick = Math.floor(elapsed * 6);
    for (let k = 0; k < 4; k++) {
      if ((tick + k) % 3) continue;
      const gx = (k * 397 + tick * 131) % (VW + 80) - 40;
      ctx.fillStyle = hexA(stage.accent, .16); ctx.fillRect(gx, ground + 8 + (k % 2) * 30, 46, 18);
    }
    ctx.fillStyle = hexA(stage.accent, .85); ctx.fillRect(0, ground, VW, 3);
  }

  function drawPalaceGround(stage) {
    const ground = 650;
    const base = cachedGrad('palGroundBase', () => {
      const g = ctx.createLinearGradient(0, ground, 0, VH);
      g.addColorStop(0, '#3a0f2e'); g.addColorStop(1, '#12030f');
      return g;
    });
    ctx.fillStyle = base; ctx.fillRect(0, ground, VW, VH - ground);
    // True-perspective marble checker: rows bunch quadratically toward the
    // horizon and column seams converge on the throne's vanishing point while
    // scrolling with the stage.
    const VPX = 640, rows = 3, tileW = 130;
    const drift = (elapsed * 1.1) % 2;
    ctx.save(); ctx.globalAlpha = .8;
    for (let r = 0; r < rows; r++) {
      const t0 = r / rows, t1 = (r + 1) / rows;
      const y0 = ground + 2 + 68 * Math.pow(t0, 1.4), y1 = ground + 2 + 68 * Math.pow(t1, 1.4);
      const s0 = (y0 - 520) / 200, s1 = (y1 - 520) / 200;
      for (let k = -9; k < 19; k++) {
        const wx0 = (k - drift) * tileW, wx1 = wx0 + tileW;
        const ax = VPX + (wx0 - VPX) * s0, bx = VPX + (wx1 - VPX) * s0;
        const cx2 = VPX + (wx1 - VPX) * s1, dx = VPX + (wx0 - VPX) * s1;
        if (Math.max(bx, cx2) < -40 || Math.min(ax, dx) > VW + 40) continue;
        ctx.fillStyle = (k + r) % 2 ? '#4a1136' : '#2c0a26';
        ctx.beginPath(); ctx.moveTo(ax, y0); ctx.lineTo(bx, y0); ctx.lineTo(cx2, y1); ctx.lineTo(dx, y1); ctx.closePath(); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(255,225,90,.22)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, y1); ctx.lineTo(VW, y1); ctx.stroke();
    }
    ctx.restore();
    // Coloured light pooling on the polished floor: the rose window's glass
    // beneath the vanishing point, plus a faint gold glint under each
    // chandelier. Mirrors without a mirror pass.
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const mix = Math.max(palaceBossMix * .6, Math.min(1, bossCrit));
    const pool = ctx.createRadialGradient(640, 688, 8, 640, 688, 230);
    pool.addColorStop(0, mixHexA('#ff9ccf', '#ff2a3c', mix, .12 + Math.sin(elapsed * .8) * .03));
    pool.addColorStop(.6, mixHexA('#ffd76a', '#ff2a3c', mix, .05));
    pool.addColorStop(1, 'rgba(255,120,60,0)');
    ctx.fillStyle = pool; ctx.beginPath(); ctx.ellipse(640, 688, 230, 26, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = .5 * (1 - palaceBossMix * .45);
    for (const gx of [300, 985]) {
      const gl = ctx.createRadialGradient(gx, 682, 3, gx, 682, 70);
      gl.addColorStop(0, 'rgba(255,215,106,.22)'); gl.addColorStop(1, 'rgba(255,180,60,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.ellipse(gx, 682, 70, 12, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // Mirror-polish reflections: stained glass drops colour smears below each
    // window and the guardian statues leave tall gold smears; loose gold
    // glints slide by with the floor. All additive and low alpha.
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const winMix = Math.max(palaceBossMix * .6, Math.min(1, bossCrit));
    for (let i = 0; i < PALACE_WINDOWS.length; i++) {
      const wx = PALACE_WINDOWS[i][0] + 37;
      const g2 = ctx.createLinearGradient(0, ground, 0, ground + 64);
      g2.addColorStop(0, mixHexA('#ff9ccf', '#ff2a3c', winMix, .12 + Math.sin(elapsed * .8 + i) * .03));
      g2.addColorStop(1, 'rgba(255,60,120,0)');
      ctx.fillStyle = g2; ctx.fillRect(wx - 26, ground, 52, 64);
    }
    for (const sx2 of [188, 1092]) {
      const g3 = ctx.createLinearGradient(0, ground, 0, ground + 54);
      g3.addColorStop(0, 'rgba(255,215,106,.14)'); g3.addColorStop(1, 'rgba(255,180,60,0)');
      ctx.fillStyle = g3; ctx.fillRect(sx2 - 22, ground, 44, 54);
    }
    ctx.fillStyle = '#ffe6a0';
    for (let i = 0; i < 6; i++) {
      const tw = Math.max(0, Math.sin(elapsed * 1.7 + i * 2.4));
      if (tw < .4) continue;
      ctx.globalAlpha = (tw - .4) * .5;
      const gx = ((i * 227 - elapsed * 40) % (VW + 80) + VW + 80) % (VW + 80) - 40;
      const gy = ground + 14 + (i * 37) % 46;
      ctx.beginPath(); ctx.moveTo(gx - 5, gy); ctx.lineTo(gx, gy - 3); ctx.lineTo(gx + 5, gy); ctx.lineTo(gx, gy + 3); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // heart-emblem red carpet runner
    const cy = ground + 32;
    ctx.fillStyle = '#8e1440'; ctx.fillRect(0, cy - 14, VW, 34);
    ctx.fillStyle = '#c92460'; ctx.fillRect(0, cy - 10, VW, 26);
    ctx.fillStyle = '#ffe15a'; ctx.fillRect(0, cy - 14, VW, 3); ctx.fillRect(0, cy + 17, VW, 3);
    const hoff = (elapsed * 100) % 170;
    ctx.fillStyle = '#ffd7ea';
    for (let x = -hoff; x < VW + 170; x += 170) { heartPath(x, cy + 3, 7); ctx.fill(); }
    ctx.fillStyle = hexA(stage.accent2, .8); ctx.fillRect(0, ground, VW, 3);
  }

  // Cumulus, not three arcs on a rectangle: a crown of six unequal lobes over a
  // flat base, with the shadowed underside and the top-left lit rim a real cloud
  // has. The lobe sizes are hashed off the cloud's own y/scale, so each one is
  // individual and stays that way as it drifts (no per-frame randomness).
  function drawCloud(c, color = '#d7ddff', alpha = .11) {
    const s = c.s, base = c.y + 30 * s;
    const seed = c.y * .37 + c.s * 11.3;
    const n = k => { const v = Math.sin(seed + k * 2.7) * 43758.5453; return v - Math.floor(v); };
    const lobes = [];
    for (let i = 0; i < 6; i++) {
      const t = i / 5, swell = Math.sin(t * Math.PI);
      lobes.push({
        x: c.x + (14 + t * 122) * s,
        y: c.y + (30 - swell * 13 - n(i) * 7) * s,
        r: (11 + swell * 20 + n(i + 9) * 9) * s,
      });
    }
    const path = () => {
      ctx.beginPath(); ctx.moveTo(c.x + 2 * s, base);
      for (const L of lobes) ctx.arc(L.x, L.y, L.r, Math.PI, 0);
      ctx.lineTo(c.x + 148 * s, base); ctx.closePath();
    };
    ctx.save();
    ctx.globalAlpha = alpha; ctx.fillStyle = color;
    path(); ctx.fill();
    path(); ctx.clip();
    // Flat, shadowed base — the single detail that stops a cloud reading as a blob.
    ctx.globalAlpha = alpha * .5; ctx.fillStyle = '#0a1030';
    ctx.fillRect(c.x - 10 * s, base - 13 * s, 175 * s, 26 * s);
    // Lit crown, on the same top-left key light the rest of the game uses.
    ctx.globalAlpha = alpha * .75; ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(c.x + 58 * s, c.y + 6 * s, 52 * s, 11 * s, -.13, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
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
    bgLayer(.5, () => {
      drawMoon(210, 120, 36, '#eafcff', 'rgba(160,240,255,A)');
      drawStars(50, '#eafcff', '#8defff');
      for (const c of clouds) drawCloud(c, '#eaf6ff', .16);
    });
    bgLayer(.32, () => {
      drawAquaCoastline(stage);
      // Second, dimmer island row drifting far behind the main pair.
      const idrift = Math.sin(elapsed * .05) * 8;
      ctx.save(); ctx.globalAlpha = .28; ctx.fillStyle = stage.far;
      ctx.beginPath(); ctx.ellipse(250 + idrift, 549, 120, 26, 0, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.ellipse(620 + idrift, 545, 66, 17, 0, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.ellipse(1000 + idrift, 551, 145, 30, 0, Math.PI, 0); ctx.fill();
      ctx.restore();
    });
    drawDepthHaze(stage, .4);
    // A second span of the same highway sinks into the haze near the horizon —
    // the strongest single depth anchor the open sea can get.
    bgLayerZ(2100, () => {
      ctx.save(); ctx.globalAlpha = .9;
      ctx.fillStyle = fogMix('#0a2a50', 2100);
      ctx.fillRect(-260, 538, VW + 520, 18);
      for (const tx of [140, 1140]) { ctx.fillRect(tx - 13, 372, 26, 172); ctx.fillRect(tx - 22, 396, 44, 10); }
      ctx.strokeStyle = fogMix('#65fff2', 2100); ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(-260, 402); ctx.quadraticCurveTo(640, 566, 1540, 402); ctx.stroke();
      ctx.restore();
    });
    bgLayer(.15, () => {
      ctx.save(); ctx.globalAlpha = .5; ctx.fillStyle = stage.far;
      ctx.beginPath(); ctx.ellipse(430, 560, 150, 42, 0, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.ellipse(780, 566, 90, 26, 0, Math.PI, 0); ctx.fill();
      ctx.restore();
      for (const p of bgProps) if (p.kind === 'lighthouse') drawLighthouse(p);
    });
    drawOcean(stage);
    drawAquaTanker(stage);
    // Light smears on the water under the lighthouse lamp, aligned to its layer.
    if (bgQuality() >= 1) bgLayer(.15, () => {
      for (const p of bgProps) if (p.kind === 'lighthouse') drawWaterStreak(p.x, 570, 26, 78, '#ffe15a', .26);
    });
    for (const p of bgProps) {
      if (p.kind === 'fish') drawFish(p, stage);
      else if (p.kind === 'bigFish') { drawBigFishShadow(p, stage); drawBigFish(p, stage); }
    }
    drawHighway(stage);
  }

  // Tiny autonomous cars make the vast bridge feel inhabited. Two lanes move at
  // different speeds, with soft headlight pools sliding over the wet deck.
  function drawAquaTraffic(stage) {
    ctx.save(); ctx.globalAlpha = .72;
    const lanes = [[620, -1, 631], [430, 1, 642]];
    for (let lane = 0; lane < lanes.length; lane++) {
      const [speed, dir, y] = lanes[lane];
      const phase = (elapsed * speed) % 430;
      for (let i = -1; i < 5; i++) {
        const x = dir > 0 ? i * 430 + phase - 180 : VW - (i * 430 + phase) + 180;
        const c = (i + lane) % 2 ? stage.accent : stage.accent2;
        ctx.fillStyle = '#07162b';
        ctx.beginPath(); ctx.roundRect(x - 25, y - 10, 50, 14, 7); ctx.fill();
        ctx.fillStyle = hexA(c, .65); ctx.fillRect(x - 10, y - 8, 23, 6);
        ctx.fillStyle = dir > 0 ? '#fff1a8' : '#ff5a70';
        ctx.fillRect(x + dir * 22 - 3, y - 5, 6, 4);
        const beam = ctx.createLinearGradient(x, y, x + dir * 64, y);
        beam.addColorStop(0, hexA(c, .16)); beam.addColorStop(1, hexA(c, 0));
        ctx.fillStyle = beam; ctx.fillRect(dir > 0 ? x + 25 : x - 89, y - 7, 64, 10);
      }
    }
    ctx.restore();
  }

  // Dense Tokyo-bay silhouette: lit towers, a rotating ferris wheel and port
  // cranes give the open water a recognizable destination instead of empty sky.
  function drawAquaCoastline(stage) {
    const base = 552, off = (elapsed * -5) % 86;
    ctx.save(); ctx.globalAlpha = .62;
    for (let i = -1; i < 18; i++) {
      const x = i * 86 + off;
      const h = 54 + ((i * 47 + 190) % 125 + 125) % 125;
      const w = 42 + ((i * 19) % 30 + 30) % 30;
      const g = ctx.createLinearGradient(x, base - h, x, base);
      g.addColorStop(0, '#174f78'); g.addColorStop(1, '#061b35');
      ctx.fillStyle = g; ctx.fillRect(x, base - h, w, h);
      ctx.fillStyle = i % 3 ? hexA(stage.accent, .35) : hexA(stage.accent2, .4);
      for (let yy = base - h + 14; yy < base - 10; yy += 17) {
        for (let xx = x + 7; xx < x + w - 5; xx += 13) if ((xx + yy + i) % 4 > 1) ctx.fillRect(xx, yy, 4, 6);
      }
      if (i % 5 === 0) { ctx.fillStyle = '#0b2e50'; ctx.fillRect(x + w * .48, base - h - 30, 3, 30); }
    }
    // Ferris wheel landmark with moving cabins.
    const fx = 1040 + off * .16, fy = 440, r = 72, rot = elapsed * .12;
    ctx.globalAlpha = .42; ctx.strokeStyle = stage.accent; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(fx, fy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      const a = rot + i * Math.PI / 6, px = fx + Math.cos(a) * r, py = fy + Math.sin(a) * r;
      ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(px, py); ctx.stroke();
      ctx.fillStyle = i % 2 ? stage.accent2 : '#ffe15a'; ctx.fillRect(px - 4, py - 3, 8, 7);
    }
    ctx.fillStyle = '#08213c'; ctx.fillRect(fx - 5, fy, 10, base - fy); ctx.fillRect(fx - 52, base - 8, 104, 8);
    // Container cranes punctuate the opposite shore.
    ctx.strokeStyle = hexA(stage.accent2, .7); ctx.lineWidth = 5;
    for (const gx of [120, 270, 740]) {
      ctx.beginPath(); ctx.moveTo(gx, base); ctx.lineTo(gx, base - 105); ctx.lineTo(gx + 72, base - 105); ctx.lineTo(gx + 96, base - 70); ctx.stroke();
      ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(gx + 62, base - 103); ctx.lineTo(gx + 62, base - 44); ctx.stroke(); ctx.lineWidth = 5;
    }
    ctx.restore();
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

  // Broken vertical light streak — how a point light smears over rolling water.
  // Slices shear sideways with independent phases so the streak shimmers.
  function drawWaterStreak(x, topY, w, h, color, alpha = .3) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const n = 7;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const sw = w * (1 - t * .5) * (.6 + Math.abs(Math.sin(elapsed * 2.1 + i * 1.4 + x * .05)) * .6);
      ctx.globalAlpha = alpha * (1 - t * .8);
      ctx.fillStyle = color;
      ctx.fillRect(x - sw / 2 + Math.sin(elapsed * 1.6 + i * 2.2 + x * .11) * (3 + t * 7), topY + t * h, sw, h / n * .55);
    }
    ctx.restore();
  }

  function drawOcean(stage) {
    const top = 556;
    const g = cachedGrad('oceanBase', () => {
      const gr = ctx.createLinearGradient(0, top, 0, VH);
      gr.addColorStop(0, '#0a3a66'); gr.addColorStop(1, '#031228');
      return gr;
    });
    ctx.fillStyle = g; ctx.fillRect(0, top, VW, VH - top);
    const q = bgQuality();
    if (q > 0) {
      // Perspective swell: polyline bands whose spacing comes from inverting
      // the pinhole projection (y -> z), so wave rows bunch physically toward
      // the horizon. Far rows sink into the sky via fogMix; crest back-slopes
      // catch an accent specular, brighter as the water nears the camera.
      const NB = 12, bottom = 700, lerpHex = (a, b, t) => {
        const ha = parseInt(a.slice(1), 16), hb = parseInt(b.slice(1), 16);
        const ch = sh => (Math.round(((ha >> sh) & 255) + (((hb >> sh) & 255) - ((ha >> sh) & 255)) * t)).toString(16).padStart(2, '0');
        return '#' + ch(16) + ch(8) + ch(0);
      };
      let prev = null;
      ctx.save();
      for (let i = 0; i <= NB; i++) {
        const t = i / NB;
        const y0 = 560.5 + (bottom - 560.5) * t * t;
        // The visible strip is only ~90px tall, so the raw pinhole distance
        // saturates the fog — scale it down to keep contrast in the near rows.
        const z = FOCAL * ((bottom - HORIZON_Y) / (y0 - HORIZON_Y) - 1) * .28;
        const amp = .8 + 15 * Math.pow(t, 1.6), freq = .015 - .009 * t, spd = .8 + t * 1.2;
        const pts = [];
        for (let x = -40; x <= VW + 40; x += 32) {
          pts.push({ x, y: y0 + Math.sin(x * freq + elapsed * spd + i * 2.4) * amp });
        }
        if (prev) {
          ctx.globalAlpha = .95;
          ctx.fillStyle = fogMix(lerpHex('#1a5c8c', '#04182e', t), z);
          ctx.beginPath();
          ctx.moveTo(prev[0].x, prev[0].y - 1);
          for (const p2 of prev) ctx.lineTo(p2.x, p2.y - 1);
          for (let j = pts.length - 1; j >= 0; j--) ctx.lineTo(pts[j].x, pts[j].y + 1);
          ctx.closePath(); ctx.fill();
          // Specular on segments whose slope faces the light (descending left).
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = stage.accent; ctx.lineWidth = 1 + t * 2; ctx.globalAlpha = .08 + .3 * t;
          ctx.beginPath();
          for (let j = 1; j < pts.length; j++) {
            if (pts[j].y < pts[j - 1].y) { ctx.moveTo(pts[j - 1].x, pts[j - 1].y); ctx.lineTo(pts[j].x, pts[j].y); }
          }
          ctx.stroke();
          ctx.globalCompositeOperation = 'source-over';
        }
        prev = pts;
      }
      ctx.restore();
    }
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
    // Expanding surface ripples where the big fish broke the water. Perspective
    // ellipses, not radial shockwaves (those read as a gameplay hazard cue).
    if (aquaRings.length) {
      aquaRings = aquaRings.filter(r => elapsed - r.birth > -2 && elapsed - r.birth < 1.5);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const r of aquaRings) {
        const a = elapsed - r.birth;
        if (a < 0) continue;
        const k = a / 1.5;
        ctx.globalAlpha = .32 * (1 - k);
        ctx.strokeStyle = '#bfefff'; ctx.lineWidth = 2.6 - k * 1.6;
        ctx.beginPath(); ctx.ellipse(r.x, r.y, 26 + k * 200, (26 + k * 200) * .2, 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }
  }

  // A laden container ship crawls across the bay behind the bridge — the slow,
  // huge landmark that sells the scale of open water. Hull, superstructure and
  // container stacks are all genuine projected volumes at one depth, so the
  // whole ship shrinks, fogs and parallaxes as a single object.
  function drawAquaTanker(stage) {
    if (bgQuality() < 1) return;
    const z = 1500, s = FOCAL / (FOCAL + z);
    const hullL = 940, wl = 597, deckY = wl - 128;
    const spanW = (VW + 160) / s + 1400;   // short off-screen rest: the ship is a near-permanent landmark
    const x0 = VW / 2 + spanW / 2 - (elapsed * 30) % spanW - hullL; // bow (left edge) world x
    const p0 = proj3(x0, deckY, z), p1 = proj3(x0 + hullL, deckY, z);
    if (p1.x < -80 || p0.x > VW + 80) return;
    ctx.save();
    // hull with a raked bow (sailing left) + boot-top stripe + deck rail
    quad3([[x0, deckY, z], [x0 + hullL, deckY, z], [x0 + hullL, wl, z], [x0 + 52, wl, z]], fogMix('#0b2038', z), .94);
    quad3([[x0 + 40, wl - 9, z], [x0 + hullL, wl - 9, z], [x0 + hullL, wl, z], [x0 + 52, wl, z]], fogMix('#6e2233', z), .9);
    quad3([[x0, deckY, z], [x0 + hullL, deckY, z], [x0 + hullL, deckY + 6, z], [x0, deckY + 6, z]], fogMix('#9fd8ff', z), .5);
    // container stacks
    const cols = ['#1e6f8f', '#8f4a2c', '#3c7a4f', '#6f2f56', '#2c5f8f'];
    let ci = 0;
    for (let cx2 = x0 + 110; cx2 + 96 < x0 + hullL - 200; cx2 += 106) {
      const tiers = 2 + ((ci * 7) % 2);
      for (let tk = 0; tk < tiers; tk++) {
        boxZ(cx2, cx2 + 96, deckY - 27 * (tk + 1), deckY - 27 * tk, z, z + 70,
          fogMix(cols[(ci + tk) % 5], z), fogMix('#061626', z), null, .92);
      }
      ci++;
    }
    // bridge castle at the stern, lit rows of windows, funnel and mast light
    const cr = boxZ(x0 + hullL - 172, x0 + hullL - 46, deckY - 116, deckY, z, z + 80,
      fogMix('#a9bcca', z), fogMix('#25394c', z), null, .95);
    ctx.globalAlpha = .8; ctx.fillStyle = hexA(stage.accent, .75);
    for (let row = 0; row < 2; row++)
      for (let wk = 0; wk < 5; wk++)
        ctx.fillRect(cr.x + cr.w * .12 + wk * cr.w * .16, cr.y + cr.h * (.16 + row * .24), cr.w * .09, cr.h * .1);
    boxZ(x0 + hullL - 128, x0 + hullL - 96, deckY - 152, deckY - 116, z, z + 30,
      fogMix('#7a2334', z), fogMix('#3a1220', z), null, .92);
    const mast = proj3(x0 + hullL - 112, deckY - 158, z);
    const tw = .5 + Math.sin(elapsed * 1.8) * .5;
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = tw * .85;
    ctx.fillStyle = '#ffe15a'; ctx.beginPath(); ctx.arc(mast.x, mast.y, 2.2, 0, Math.PI * 2); ctx.fill();
    // bow wake: white shear lines trailing back along the waterline
    const bowP = proj3(x0 + 46, wl, z);
    ctx.globalAlpha = .3; ctx.strokeStyle = '#bfefff'; ctx.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) {
      const wy = bowP.y + 1 + i * 2.4;
      ctx.beginPath(); ctx.moveTo(bowP.x + 4, wy);
      ctx.lineTo(bowP.x + 34 + i * 26 + Math.sin(elapsed * 2 + i * 1.8) * 7, wy + 1);
      ctx.stroke();
    }
    ctx.restore();
    // smeared light reflection under the castle
    drawWaterStreak((cr.x + cr.w / 2), bowP.y + 2, 22, 44, '#9fd8ff', .1);
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

  // A wide directional plume — droplets kick up and arc toward the camera
  // instead of a symmetric puff in place, so the splash reads as something
  // physically thrown by a huge body hitting the water. Cosmetic only: plain
  // particles, not a shockwave ring (that reads as a gameplay hazard cue).
  function splashRipple(x, y = 574) {
    // Surface rings spread out from the entry point with a slight stagger.
    for (let i = 0; i < 3; i++) aquaRings.push({ x: x - 10 + i * 20, y: y + 14, birth: elapsed + i * .18 });
    for (let i = 0; i < 46; i++) {
      const a = -Math.PI / 2 + (Math.random() - .5) * 2.6;
      const v = 300 + Math.random() * 420;
      particles.push({
        x, y, vx: Math.cos(a) * v - 170, vy: Math.sin(a) * v,
        life: .5 + Math.random() * .7, max: 1.2, color: '#dff6ff',
        size: 4 + Math.random() * 11, gravity: 360,
      });
    }
  }

  // Dark displacement patch + accent glint tracking the leaping fish across the
  // water — it anchors the huge airborne body to the sea it left. Widest at
  // take-off/entry, tightest at the apex, like a real cast shadow.
  function drawBigFishShadow(p, stage) {
    const ph = p.phase || 0;
    if (ph <= 0 || ph > BIGFISH_DUR) return;
    const t = ph / BIGFISH_DUR;
    const lift = Math.sin(t * Math.PI);
    const x = p.x - t * BIGFISH_TRAVEL;
    const rx = 330 * (1 - lift * .5);
    ctx.save();
    ctx.globalAlpha = .3 * lift; ctx.fillStyle = '#03101f';
    ctx.beginPath(); ctx.ellipse(x, 594, rx, 15, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .2 * lift;
    ctx.strokeStyle = stage.accent; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(x, 594, rx + 16, 19, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  function drawBigFish(p, stage) {
    if ((p.phase || 0) > BIGFISH_DUR) return;
    const t = (p.phase || 0) / BIGFISH_DUR;
    const x = p.x - t * BIGFISH_TRAVEL;
    const y = 575 - Math.sin(t * Math.PI) * BIGFISH_ARC;
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.cos(t * Math.PI) * .32); ctx.scale(BIGFISH_SCALE, BIGFISH_SCALE);
    ctx.globalAlpha = .95;
    // Nose trails toward -x (direction of travel); the lunate tail fin and
    // tapered peduncle sit on the +x side. ~1000px nose-to-tail so a single
    // leap spans most of the screen width at the apex.
    const body = ctx.createLinearGradient(0, -95, 0, 90);
    body.addColorStop(0, stage.accent2); body.addColorStop(.42, stage.accent); body.addColorStop(1, '#dff6ff');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-450, 0);
    // top: nose -> brow -> back (widest near the dorsal base) -> peduncle
    ctx.quadraticCurveTo(-430, -58, -300, -70);
    ctx.quadraticCurveTo(-120, -80, 60, -62);
    ctx.quadraticCurveTo(220, -42, 330, -22);
    ctx.quadraticCurveTo(385, -12, 420, -7);
    ctx.lineTo(420, 7);
    // bottom: peduncle -> belly (bulges lower/rounder than the back) -> nose
    ctx.quadraticCurveTo(385, 12, 330, 24);
    ctx.quadraticCurveTo(180, 56, 0, 69);
    ctx.quadraticCurveTo(-160, 78, -320, 56);
    ctx.quadraticCurveTo(-410, 36, -450, 0);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = stage.accent2;
    // Second dorsal + anal fin (small, near the tail) — drawn first so the
    // big dorsal and pectoral fins layer over them.
    ctx.beginPath(); ctx.moveTo(280, -26); ctx.lineTo(312, -58); ctx.lineTo(250, -38); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(270, 30); ctx.lineTo(300, 60); ctx.lineTo(240, 42); ctx.closePath(); ctx.fill();
    // Lunate tail fin: swept crescent lobes with an inward notch, tuna/shark-style.
    ctx.beginPath();
    ctx.moveTo(415, -8);
    ctx.quadraticCurveTo(462, -72, 566, -148);
    ctx.quadraticCurveTo(498, -54, 468, 0);
    ctx.quadraticCurveTo(498, 54, 566, 148);
    ctx.quadraticCurveTo(462, 72, 415, 8);
    ctx.closePath(); ctx.fill();
    // Tall sail-like dorsal fin.
    ctx.beginPath();
    ctx.moveTo(-45, -64); ctx.quadraticCurveTo(-12, -178, 62, -196); ctx.quadraticCurveTo(72, -122, 92, -56);
    ctx.closePath(); ctx.fill();
    // Pectoral fin, swept back beneath the head.
    ctx.beginPath();
    ctx.moveTo(-225, 42); ctx.quadraticCurveTo(-268, 132, -186, 176); ctx.quadraticCurveTo(-144, 104, -142, 50);
    ctx.closePath(); ctx.fill();
    // Gill slits.
    ctx.strokeStyle = hexA(stage.accent2, .55); ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(-345 + i * 14, -34); ctx.quadraticCurveTo(-352 + i * 14, 0, -345 + i * 14, 32); ctx.stroke();
    }
    // Eye + mouth line.
    ctx.fillStyle = '#0a1c30'; ctx.beginPath(); ctx.arc(-378, -18, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#eafcff'; ctx.beginPath(); ctx.arc(-382, -22, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#0a1c30'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-448, 4); ctx.quadraticCurveTo(-428, 18, -400, 12); ctx.stroke();
    // Belly sheen streaks — the only "scale" texture, kept sparse so the
    // silhouette still reads clean at speed.
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .28; ctx.strokeStyle = '#eafcff'; ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const bx = -260 + i * 90;
      ctx.beginPath(); ctx.moveTo(bx, 32); ctx.quadraticCurveTo(bx + 24, 48, bx + 48, 32); ctx.stroke();
    }
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

  // Crepuscular rays fan up from the low sun and cut through the smoky air.
  // Additive triangles with breathing alpha; count follows the quality tier.
  function drawSunGodRays(stage) {
    const q = bgQuality();
    if (!q) return;
    const rays = q === 2 ? 6 : 4;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < rays; i++) {
      const phi = -Math.PI + .38 + i * ((Math.PI - .76) / (rays - 1)) + Math.sin(elapsed * .1 + i * 2.3) * .04;
      const len = 880, w = 46 + (i * 37 % 54);
      ctx.save();
      ctx.translate(640, 468); ctx.rotate(phi);
      const g = cachedGrad('facRay' + i + '_' + rays, () => {
        const gr = ctx.createLinearGradient(0, 0, len, 0);
        gr.addColorStop(0, 'rgba(255,190,90,.15)'); gr.addColorStop(.5, 'rgba(255,140,60,.05)'); gr.addColorStop(1, 'rgba(255,120,50,0)');
        return gr;
      });
      ctx.fillStyle = g;
      ctx.globalAlpha = .55 + Math.sin(elapsed * .7 + i * 1.9) * .25;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len, -w / 2); ctx.lineTo(len, w / 2); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // Twin hyperboloid cooling towers on the far horizon, steam peeling off
  // their throats into the sunset — the classic heavy-industry silhouette that
  // reads instantly even as a fog-sunk shape.
  function drawCoolingTowers(stage) {
    const q = bgQuality();
    const z = 2600, s = FOCAL / (FOCAL + z);
    bgLayerZ(z, () => {
      for (const [sx, w, h, ph] of [[425, 620, 980, 0], [872, 700, 1080, 2.2]]) {
        const cx = worldXAt(sx, s);
        const base = 588, top = base - h;
        const sunSide = sx < 640 ? 1 : -1;
        ctx.save();
        ctx.fillStyle = fogMix('#301430', z);
        ctx.beginPath();
        ctx.moveTo(cx - w / 2, base);
        ctx.bezierCurveTo(cx - w * .16, base - h * .5, cx - w * .38, base - h * .78, cx - w * .3, top);
        ctx.lineTo(cx + w * .3, top);
        ctx.bezierCurveTo(cx + w * .38, base - h * .78, cx + w * .16, base - h * .5, cx + w / 2, base);
        ctx.closePath(); ctx.fill();
        // throat ellipse + hot rim on the sun-facing flank
        ctx.fillStyle = fogMix('#1a0a1c', z);
        ctx.beginPath(); ctx.ellipse(cx, top, w * .3, w * .06, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = .75; ctx.strokeStyle = hexA('#ff9f43', .5); ctx.lineWidth = 3 / s;
        ctx.beginPath();
        if (sunSide > 0) {
          ctx.moveTo(cx + w / 2, base);
          ctx.bezierCurveTo(cx + w * .16, base - h * .5, cx + w * .38, base - h * .78, cx + w * .3, top);
        } else {
          ctx.moveTo(cx - w / 2, base);
          ctx.bezierCurveTo(cx - w * .16, base - h * .5, cx - w * .38, base - h * .78, cx - w * .3, top);
        }
        ctx.stroke();
        // steam column drifting downwind, backlit by the low sun
        if (q >= 1) {
          ctx.globalCompositeOperation = 'lighter';
          for (let i = 0; i < 4; i++) {
            const t = (elapsed * .06 + ph + i * .25) % 1;
            const sy = top - 30 - t * 340;
            const sxo = Math.sin(elapsed * .5 + i * 2 + ph) * (24 + t * 60) + t * 130 * sunSide;
            const r = w * .17 * (.6 + t);
            const g2 = ctx.createRadialGradient(cx + sxo, sy, r * .2, cx + sxo, sy, r);
            g2.addColorStop(0, `rgba(255,205,150,${(.1 * (1 - t)).toFixed(3)})`);
            g2.addColorStop(1, 'rgba(255,160,90,0)');
            ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(cx + sxo, sy, r, 0, Math.PI * 2); ctx.fill();
          }
        }
        ctx.restore();
      }
    });
  }

  // Baked smelting shed: corrugated steel wall backlit by the sunset, with a
  // white-hot furnace mouth under a brick arch. Live flicker goes on top.
  function furnaceShedSprite() {
    return bakeSprite('furnaceShed', 190, 120, bc => {
      const g = bc.createLinearGradient(0, 0, 0, 120);
      g.addColorStop(0, '#3a1626'); g.addColorStop(1, '#150a14');
      bc.fillStyle = g; bc.fillRect(0, 10, 190, 110);
      bc.fillStyle = '#4e2030'; bc.fillRect(0, 0, 190, 12);
      bc.fillStyle = 'rgba(255,159,67,.5)'; bc.fillRect(0, 0, 190, 3);
      bc.globalAlpha = .4; bc.fillStyle = '#0d0510';
      for (let x = 8; x < 190; x += 14) bc.fillRect(x, 14, 4, 106);
      bc.globalAlpha = 1;
      const mx = 95, my = 92;
      bc.fillStyle = '#241019';
      bc.beginPath(); bc.moveTo(mx - 46, 120); bc.lineTo(mx - 46, my - 18);
      bc.quadraticCurveTo(mx, my - 62, mx + 46, my - 18); bc.lineTo(mx + 46, 120); bc.closePath(); bc.fill();
      const mg = bc.createRadialGradient(mx, 112, 4, mx, 112, 52);
      mg.addColorStop(0, '#fff3b0'); mg.addColorStop(.4, '#ffb347'); mg.addColorStop(.75, '#ff5a36'); mg.addColorStop(1, '#7a1c14');
      bc.fillStyle = mg;
      bc.beginPath(); bc.moveTo(mx - 36, 120); bc.lineTo(mx - 36, my - 10);
      bc.quadraticCurveTo(mx, my - 48, mx + 36, my - 10); bc.lineTo(mx + 36, 120); bc.closePath(); bc.fill();
      bc.fillStyle = '#170a17'; bc.fillRect(mx - 36, 108, 72, 4); bc.fillRect(mx - 5, 84, 10, 36);
      for (let i = 0; i < 4; i++) { bc.fillStyle = i % 2 ? '#ffe15a' : '#221018'; bc.fillRect(174, 16 + i * 12, 12, 12); }
    });
  }

  // A rank of smelting sheds recedes past the camera in true perspective, each
  // furnace mouth spilling flickering molten light onto the ground haze.
  function drawFurnaceRow(stage) {
    const q = bgQuality();
    if (!q) return;
    const z = 1050, s = FOCAL / (FOCAL + z), gap = 620, t0 = elapsed * 46;
    const yBase = HORIZON_Y + 58 / s;      // projected base ≈ y618, in front of the near skyline strip
    const half = (VW / 2 + 130) / s;
    const k0 = Math.floor((VW / 2 - half + t0) / gap), k1 = Math.ceil((VW / 2 + half + t0) / gap);
    const spr = furnaceShedSprite();
    const fog = fogAmount(z);
    for (let k = k0; k <= k1; k++) {
      const wx = k * gap - t0;
      const r = boxZ(wx, wx + 400, yBase - 260, yBase, z, z + 300, null, fogMix('#12060f', z), null, .9);
      if (r.x > VW + 80 || r.x + r.w < -80) continue;
      ctx.save();
      ctx.globalAlpha = .9; blit(spr, r.x, r.y, r.w, r.h);
      ctx.globalAlpha = fog * .7; ctx.fillStyle = stage.sky[1]; ctx.fillRect(r.x, r.y, r.w, r.h);
      const mx = r.x + r.w / 2, my = r.y + r.h * .95;
      const flick = .6 + Math.sin(elapsed * 6.3 + k * 2.1) * .25;
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .5 * flick;
      const g2 = ctx.createRadialGradient(mx, my, 3, mx, my, r.w * .3);
      g2.addColorStop(0, 'rgba(255,240,170,.8)'); g2.addColorStop(.5, 'rgba(255,140,60,.3)'); g2.addColorStop(1, 'rgba(255,90,30,0)');
      ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(mx, my, r.w * .3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  function drawFactoryBackdrop(stage) {
    bgLayer(.5, () => {
      drawMoon(640, 468, 88, '#ffb347', 'rgba(255,120,60,A)');
      drawSunGodRays(stage);
      ctx.save(); ctx.globalAlpha = .45; ctx.fillStyle = stage.sky[1];
      for (let i = 0; i < 4; i++) ctx.fillRect(530, 448 + i * 20, 220, 5 + i * 3);
      ctx.restore();
      for (const c of clouds) drawCloud(c, '#ffd9a0', .13);
      drawFactoryFlares(stage);
    });
    drawCoolingTowers(stage);
    // Far duplicate tank row sunk into the haze behind the main refinery.
    bgLayer(.32, () => drawRefineryTanks(stage, .55, .38, -150));
    // Extra chimney rank deep in the haze — pure silhouettes, fog-tinted.
    bgLayerZ(1500, () => {
      ctx.save(); ctx.globalAlpha = .9; ctx.fillStyle = fogMix('#241028', 1500);
      for (const [x, w, h] of CHIMNEYS) ctx.fillRect(x * 1.18 - 60, 560 - h * .82, w, h * .82);
      ctx.restore();
    });
    drawDepthHaze(stage, .5);
    bgLayer(.15, () => {
      drawRefineryTanks(stage);
      drawCranes(stage);
      drawChimneys();
    });
    // gear/hammer are intentionally screen-fixed props — keep them outside bgLayer.
    for (const p of bgProps) if (p.kind === 'gear') drawGear(p, stage);
    drawCity((elapsed * -20) % 120, 600, stage.city, 54, .8, 18);
    drawFurnaceRow(stage);
    for (const p of bgProps) if (p.kind === 'hammer') drawHammerPress(p, stage);
    drawConveyor(stage);
    drawMoltenRiver(stage);
  }

  // Foreground pressure manifold: layered pipes, animated gauges and brief steam
  // releases make the machinery feel connected instead of a collection of props.
  function drawFactoryPipeworks(stage) {
    const y = 622, drift = (elapsed * 54) % 460;
    ctx.save(); ctx.globalAlpha = .62;
    const pipe = ctx.createLinearGradient(0, y - 16, 0, y + 19);
    pipe.addColorStop(0, '#8b4850'); pipe.addColorStop(.32, '#3c2130'); pipe.addColorStop(1, '#130a12');
    ctx.fillStyle = pipe; ctx.fillRect(-30, y - 16, VW + 60, 35);
    ctx.fillStyle = hexA(stage.accent2, .38); ctx.fillRect(-30, y - 15, VW + 60, 3);
    for (let i = -1; i < 5; i++) {
      const x = i * 460 - drift;
      ctx.fillStyle = '#130a12'; ctx.fillRect(x - 8, y - 22, 16, 47);
      ctx.strokeStyle = '#743b47'; ctx.lineWidth = 3; ctx.strokeRect(x - 8, y - 22, 16, 47);
      ctx.fillStyle = '#251323'; ctx.beginPath(); ctx.arc(x + 68, y, 24, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = hexA(stage.accent, .62); ctx.lineWidth = 3; ctx.stroke();
      ctx.save(); ctx.translate(x + 68, y); ctx.rotate(-1.9 + Math.sin(elapsed * 1.7 + i) * .8);
      ctx.strokeStyle = '#ffe15a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(15, 0); ctx.stroke(); ctx.restore();
      ctx.fillStyle = hexA(stage.accent, .7); ctx.beginPath(); ctx.arc(x + 68, y, 3, 0, Math.PI * 2); ctx.fill();
      // short periodic steam puff, confined below the combat lane
      const vent = (elapsed * .55 + i * .27) % 1;
      if (vent < .18) {
        ctx.globalAlpha = (.18 - vent) * 2.5;
        ctx.fillStyle = '#ffe7d6';
        for (let p = 0; p < 3; p++) {
          ctx.beginPath(); ctx.arc(x + 130 + p * 7, y - 18 - vent * 95 - p * 6, 9 + p * 4, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = .62;
      }
    }
    ctx.restore();
  }

  // Monumental blast furnaces and flare stacks build a readable industrial
  // horizon behind the smaller tanks and gantries.
  function drawFactoryFlares(stage) {
    ctx.save(); ctx.globalAlpha = .52;
    for (const [x, w, h] of [[70, 118, 300], [1010, 142, 350]]) {
      const y = 570 - h;
      const g = ctx.createLinearGradient(x, y, x + w, y);
      g.addColorStop(0, '#160914'); g.addColorStop(.45, '#6b2934'); g.addColorStop(1, '#10070e');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x + 18, 570); ctx.lineTo(x, y + 70); ctx.lineTo(x + 22, y); ctx.lineTo(x + w - 22, y); ctx.lineTo(x + w, y + 70); ctx.lineTo(x + w - 18, 570); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = hexA(stage.accent, .45); ctx.lineWidth = 3;
      for (let yy = y + 48; yy < 548; yy += 48) { ctx.beginPath(); ctx.moveTo(x + 7, yy); ctx.lineTo(x + w - 7, yy); ctx.stroke(); }
      ctx.fillStyle = '#10070e'; ctx.fillRect(x + w * .42, y - 82, w * .16, 88);
      ctx.fillStyle = hexA(stage.accent2, .5); ctx.fillRect(x + w * .42, y - 78, w * .16, 4);
    }
    // Animated gas flares create a hot focal point above the machinery.
    for (const [x, y, phase] of [[137, 177, 0], [1091, 135, 1.7], [845, 250, 3.1]]) {
      const flick = 1 + Math.sin(elapsed * 7 + phase) * .18;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .72;
      const fg = ctx.createRadialGradient(x, y, 2, x, y, 38 * flick);
      fg.addColorStop(0, '#fff6a0'); fg.addColorStop(.35, '#ff9a32'); fg.addColorStop(1, 'rgba(255,60,20,0)');
      ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(x, y, 38 * flick, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd45a'; ctx.beginPath(); ctx.moveTo(x, y - 30 * flick); ctx.quadraticCurveTo(x + 18, y - 4, x, y + 8); ctx.quadraticCurveTo(x - 16, y - 5, x, y - 30 * flick); ctx.fill();
      ctx.restore();
    }
    // Heat shimmer wavering above the flare tips (full quality only) — soft
    // additive blobs that wander on offset phases, no displacement filters.
    if (bgQuality() === 2) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const [x, y] of [[137, 177], [1091, 135], [845, 250]]) {
        for (let i = 0; i < 3; i++) {
          const wob = Math.sin(elapsed * (3.1 + i * .9) + x + i * 2) * (6 + i * 5);
          const hy = y - 42 - i * 34;
          const g2 = ctx.createRadialGradient(x + wob, hy, 2, x + wob, hy, 26);
          g2.addColorStop(0, 'rgba(255,170,90,.10)'); g2.addColorStop(1, 'rgba(255,140,60,0)');
          ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(x + wob, hy, 26, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.restore();
    }
    ctx.restore();
  }

  // Refinery storage tanks: riveted cylindrical silhouettes with glowing
  // window slits and a ground pipe stub, giving the skyline industrial depth.
  // scale/alpha/shiftX allow a smaller, dimmer duplicate row deeper in the scene;
  // the transform keeps the tanks anchored to their y=560 ground line.
  function drawRefineryTanks(stage, scale = 1, alpha = .8, shiftX = 0) {
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.translate(shiftX, 560 * (1 - scale)); ctx.scale(scale, scale);
    for (const [x, r, h] of REFINERY_TANKS) {
      const topY = 560 - h;
      const g = ctx.createLinearGradient(x - r, 0, x + r, 0);
      g.addColorStop(0, '#170a17'); g.addColorStop(.32, '#3d1e33'); g.addColorStop(.58, '#241129'); g.addColorStop(1, '#0f0710');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - r, topY + 16); ctx.quadraticCurveTo(x, topY - 10, x + r, topY + 16);
      ctx.lineTo(x + r, 560); ctx.lineTo(x - r, 560); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2c1428';
      ctx.beginPath(); ctx.ellipse(x, topY + 16, r, 11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = .28; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
      for (let yy = topY + 42; yy < 556; yy += 32) { ctx.beginPath(); ctx.moveTo(x - r, yy); ctx.lineTo(x + r, yy); ctx.stroke(); }
      ctx.globalAlpha = .8;
      for (let yy = topY + 30; yy < 552; yy += 32) {
        ctx.fillStyle = hexA(stage.accent, .35 + Math.sin(elapsed * 2 + x * .1 + yy) * .2);
        ctx.fillRect(x - r * .4, yy, r * .8, 5);
      }
      ctx.fillStyle = '#160810'; ctx.fillRect(x + r - 5, 560 - 26, 26, 26);
    }
    ctx.restore();
  }

  // Hydraulic stamping press floating clear of the skyline (matching the
  // gears' airborne treatment): idles raised, slams down with an impact flash.
  function drawHammerPress(p, stage) {
    const cyc = 2.6, t = ((elapsed + p.phase * cyc) % cyc) / cyc;
    let ramT;
    if (t < .55) ramT = 0;
    else if (t < .62) ramT = (t - .55) / .07;
    else if (t < .78) ramT = 1;
    else ramT = 1 - (t - .78) / .22;
    const x = p.x, baseY = 468, topY = baseY - 108, spanW = 84, ramY = topY + 22 + ramT * 64;
    ctx.save();
    const postG = ctx.createLinearGradient(x - spanW / 2, 0, x - spanW / 2 + 10, 0);
    postG.addColorStop(0, hexA(stage.accent2, .55)); postG.addColorStop(.4, '#3a2438'); postG.addColorStop(1, '#160a17');
    ctx.fillStyle = postG;
    ctx.fillRect(x - spanW / 2, topY, 10, baseY - topY);
    ctx.fillRect(x + spanW / 2 - 10, topY, 10, baseY - topY);
    ctx.fillStyle = '#241229'; ctx.fillRect(x - spanW / 2 - 6, topY, spanW + 12, 16);
    ctx.fillStyle = hexA(stage.accent, .55); ctx.fillRect(x - spanW / 2 - 6, topY, spanW + 12, 3);
    // blinking warning light on the beam
    ctx.fillStyle = hexA(stage.accent, .5 + Math.sin(elapsed * 6) * .5);
    ctx.beginPath(); ctx.arc(x, topY + 8, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#33202e';
    ctx.fillRect(x - 4, topY + 16, 8, ramY - topY - 16);
    const ramG = ctx.createLinearGradient(x - 24, ramY, x - 24, ramY + 20);
    ramG.addColorStop(0, '#6a3448'); ramG.addColorStop(1, '#20101c');
    ctx.fillStyle = ramG; ctx.fillRect(x - 24, ramY, 48, 20);
    ctx.fillStyle = hexA(stage.accent2, .75); ctx.fillRect(x - 24, ramY, 48, 3);
    ctx.fillStyle = '#2c1421'; ctx.fillRect(x - 27, baseY, 54, 13);
    ctx.restore();
    if (t >= .6 && t < .75) {
      const it = 1 - (t - .6) / .15;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = it * .85;
      const fg = ctx.createRadialGradient(x, baseY + 4, 2, x, baseY + 4, 42);
      fg.addColorStop(0, stage.accent); fg.addColorStop(1, 'rgba(255,180,60,0)');
      ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(x, baseY + 4, 42, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  // Molten river glowing beneath the conveyor floor grating, with drifting flow glow.
  function drawMoltenRiver(stage) {
    const y0 = 686, y1 = VH;
    // Receding flow lines: quadratic spacing (perspective bunching) with the
    // near rows hotter, thicker and wobblier — the river reads as a surface,
    // not a flat glow strip.
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const t = i / 3, y = y0 + 3 + (y1 - y0 - 6) * t * t;
      ctx.globalAlpha = .14 + t * .3;
      ctx.strokeStyle = i % 2 ? '#ffb347' : '#ff7a2e'; ctx.lineWidth = 1.5 + t * 3;
      ctx.beginPath();
      for (let x = -40; x <= VW + 40; x += 34) {
        const yy = y + Math.sin(x * .03 + elapsed * (1.4 + t) + i * 2) * (1 + t * 2.5);
        x === -40 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const off = (elapsed * 42) % 100;
    for (let x = -off; x < VW + 100; x += 100) {
      const flick = .55 + Math.sin(elapsed * 3.1 + x * .04) * .3;
      const lg = ctx.createRadialGradient(x + 40, y1 - 4, 2, x + 40, y1 - 4, 66);
      lg.addColorStop(0, hexA('#ffb347', .5 * flick));
      lg.addColorStop(.55, hexA('#ff5a36', .25 * flick));
      lg.addColorStop(1, 'rgba(255,90,20,0)');
      ctx.fillStyle = lg; ctx.fillRect(x - 40, y0 - 20, 160, 70);
    }
    ctx.restore();
    ctx.save(); ctx.globalAlpha = .85; ctx.fillStyle = hexA('#ff7a2e', .8);
    ctx.fillRect(0, y1 - 3, VW, 3);
    ctx.restore();
  }

  function drawCranes(stage) {
    // Full black silhouettes against the sunset — backlight does the detailing
    // via a thin hot rim on the sun-facing edges.
    ctx.save(); ctx.globalAlpha = .82;
    for (const [x, h] of [[300, 130], [700, 100], [1150, 150]]) {
      ctx.fillStyle = '#170a17';
      ctx.fillRect(x, 560 - h, 10, h);
      ctx.fillRect(x - 60, 560 - h, 150, 8);
      ctx.fillRect(x + 78, 560 - h + 8, 4, 36);
      ctx.fillRect(x + 68, 560 - h + 44, 24, 14);
      ctx.fillStyle = 'rgba(255,159,67,.5)';
      ctx.fillRect(x < 640 ? x + 8 : x, 560 - h, 2, h);
      ctx.fillRect(x - 60, 560 - h, 150, 2);
    }
    ctx.restore();
  }

  function drawChimneys() {
    for (const [x, w, h] of CHIMNEYS) {
      const top = 560 - h, sunSide = x + w / 2 < 640 ? 1 : -1;
      // Cylinder shading: dark edges with the core highlight pushed toward the
      // sun, plus an elliptical cap so the stack reads as a tube, not a plank.
      const g = cachedGrad('chim' + x, () => {
        const gr = ctx.createLinearGradient(x, 0, x + w, 0);
        gr.addColorStop(0, '#1c0a20'); gr.addColorStop(.5 + sunSide * .22, '#43203f'); gr.addColorStop(1, '#150818');
        return gr;
      });
      ctx.fillStyle = g; ctx.fillRect(x, top, w, h);
      ctx.fillStyle = '#241028';
      ctx.beginPath(); ctx.ellipse(x + w / 2, top, w / 2, w * .16, 0, 0, Math.PI * 2); ctx.fill();
      // Backlit rim on the sun-facing edge — the low sun draws every stack's
      // outline in hot metal.
      ctx.save(); ctx.globalAlpha = .8; ctx.fillStyle = faceLit('#c46a3a', 'left', .2);
      ctx.fillRect(sunSide > 0 ? x + w - 3 : x, top, 3, h);
      ctx.restore();
      ctx.save(); ctx.globalAlpha = .5 + Math.sin(elapsed * 3 + x) * .3;
      ctx.fillStyle = '#ff5a36'; ctx.fillRect(x + 6, top + 6, w - 12, 5); ctx.restore();
      ctx.fillStyle = 'rgba(255,225,90,.22)'; ctx.fillRect(x, top + 20, w, 9);
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

  // Bake one puffy cumulonimbus slab. All the soft radial gradients happen
  // once here; runtime cost is a single drawImage per cloud.
  function stormCloudSprite(v) {
    return bakeSprite('stormCloud' + v, 320, 130, bc => {
      const blobs = [[52, 92, 40], [122, 74, 52], [196, 88, 46], [268, 98, 34], [158, 104, 50]];
      for (let i = 0; i < blobs.length; i++) {
        const r = blobs[i][2] * (1 + (((v * 31 + i * 17) % 7) - 3) * .06);
        const bx = blobs[i][0] + ((v * 53 + i * 29) % 26) - 13, by = blobs[i][1];
        const g = bc.createRadialGradient(bx, by - r * .25, r * .12, bx, by, r);
        g.addColorStop(0, '#16443a'); g.addColorStop(.55, '#0b2a22'); g.addColorStop(1, 'rgba(4,16,13,0)');
        bc.fillStyle = g; bc.beginPath(); bc.arc(bx, by, r, 0, Math.PI * 2); bc.fill();
      }
      // Moonlit top rims give the mass a readable upper surface.
      bc.globalCompositeOperation = 'lighter';
      bc.globalAlpha = .2; bc.strokeStyle = '#7fdcc0'; bc.lineWidth = 3;
      for (const [bx, by, r] of blobs) {
        bc.beginPath(); bc.arc(bx, by - 4, r * .78, Math.PI * 1.15, Math.PI * 1.85); bc.stroke();
      }
    });
  }

  // Three depth ranks of drifting cloud slabs. The nearest rank can flash from
  // the inside when a bolt lands close — intra-cloud lightning is what sells
  // the clouds as volumes rather than cardboard.
  function drawStormCloudRank(rank) {
    if (bgQuality() === 0 && rank !== 2) return;   // low fps: keep only the hero rank
    const cfg = [
      { n: 5, y: 84, sp: 5, s: 1, a: .5 },
      { n: 4, y: 128, sp: 11, s: 1.45, a: .68 },
      { n: 3, y: 168, sp: 20, s: 2, a: .88 },
    ][rank];
    ctx.save();
    for (let i = 0; i < cfg.n; i++) {
      const spr = stormCloudSprite((rank * 3 + i) % 4);
      const span = VW + 700;
      const x = span - ((i * 397 + rank * 151 + elapsed * cfg.sp) % span) - 350;
      const y = cfg.y + Math.sin(elapsed * .18 + i * 2 + rank) * 7 + ((i * 83) % 40);
      const w = 320 * cfg.s, h = 130 * cfg.s;
      ctx.globalAlpha = cfg.a;
      blit(spr, x, y, w, h);
      if (rank === 2 && lightning > 0 && Math.abs(x + w / 2 - lightningX) < 280) {
        const k = Math.min(1, lightning * 2.4);
        const cx2 = x + w / 2, cy2 = y + h * .55;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = k * .85;
        const g = ctx.createRadialGradient(cx2, cy2, 6, cx2, cy2, w * .4);
        g.addColorStop(0, 'rgba(224,255,242,.7)'); g.addColorStop(.5, 'rgba(120,255,190,.24)'); g.addColorStop(1, 'rgba(80,255,160,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx2, cy2, w * .4, h * .42, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        // Re-blit the slab thinly so the glow reads as inside the cloud.
        ctx.globalAlpha = cfg.a * .55; blit(spr, x, y, w, h);
      }
    }
    ctx.restore();
  }

  // Baked server-monolith face: obsidian slab with an LED matrix frozen in a
  // deterministic on/off pattern; live blinking dots and surge rims go on top.
  function mainframeSprite(v) {
    return bakeSprite('mainframe' + v, 84, 250, bc => {
      const g = bc.createLinearGradient(0, 0, 84, 0);
      g.addColorStop(0, '#0d3a30'); g.addColorStop(.5, '#062019'); g.addColorStop(1, '#03110d');
      bc.fillStyle = g; bc.fillRect(0, 0, 84, 250);
      bc.strokeStyle = 'rgba(114,255,104,.4)'; bc.lineWidth = 2; bc.strokeRect(1, 1, 82, 248);
      let s = v * 613 + 29;
      const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
      for (let y = 10; y < 240; y += 12) {
        for (let x = 8; x < 76; x += 10) {
          const r = rnd();
          bc.fillStyle = r > .72 ? '#72ff68' : r > .6 ? '#31e8ff' : 'rgba(10,40,32,.9)';
          bc.fillRect(x, y, 6, 7);
        }
      }
      bc.fillStyle = 'rgba(114,255,104,.5)'; bc.fillRect(40, 6, 3, 238);
    });
  }

  // Server monoliths standing in the cloud sea — genuine extruded volumes that
  // blink idly and flare edge-lit whenever a bolt lands near them.
  function drawMainframeRow(stage) {
    const q = bgQuality();
    if (!q) return;
    const z = 1500, s = FOCAL / (FOCAL + z), gap = 560, t0 = elapsed * 40;
    const yBase = HORIZON_Y + 42 / s;      // projected base ≈ y602, sunk toward the cloud sea
    const half = (VW / 2 + 110) / s;
    const k0 = Math.floor((VW / 2 - half + t0) / gap), k1 = Math.ceil((VW / 2 + half + t0) / gap);
    const surge = Math.min(1, lightning * 2.4);
    const fog = fogAmount(z);
    for (let k = k0; k <= k1; k++) {
      const wx = k * gap - t0;
      const h = 460 + (((k * 37) % 5) + 5) % 5 * 68;
      const r = boxZ(wx, wx + 230, yBase - h, yBase, z, z + 260, null, fogMix('#02100c', z), null, .85);
      if (r.x > VW + 80 || r.x + r.w < -80) continue;
      ctx.save(); ctx.globalAlpha = .85;
      blit(mainframeSprite(((k % 3) + 3) % 3), r.x, r.y, r.w, r.h);
      ctx.globalAlpha = fog * .72; ctx.fillStyle = stage.sky[1]; ctx.fillRect(r.x, r.y, r.w, r.h);
      // live blinking activity LEDs
      if (q === 2) {
        ctx.globalAlpha = .8; ctx.fillStyle = '#d8fff0';
        let sd = Math.abs(k * 131 + Math.floor(elapsed * 7) * 17) % 233280;
        for (let i = 0; i < 3; i++) {
          sd = (sd * 9301 + 49297) % 233280;
          ctx.fillRect(r.x + 4 + (sd % 20) / 20 * (r.w - 10), r.y + 8 + ((sd >> 3) % 100) / 100 * (r.h - 20), 2.4, 2.4);
        }
      }
      if (surge > 0 && Math.abs(r.x + r.w / 2 - lightningX) < 340) {
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = surge * .8;
        ctx.strokeStyle = stage.accent; ctx.lineWidth = 2;
        ctx.strokeRect(r.x + .5, r.y + .5, r.w - 1, r.h - 1);
      }
      // apex beacon
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = .4 + surge * .6; ctx.fillStyle = stage.accent2;
      ctx.fillRect(r.x + r.w / 2 - 1.5, r.y - 7, 3, 7);
      ctx.restore();
    }
  }

  function drawStormBackdrop(stage) {
    // Circuit seams pulse with each lightning flash for a synced "power surge".
    const surge = .32 + Math.min(1, lightning * 2.4) * .68;
    bgLayer(.5, () => {
      drawStars(26, '#8fffb0', '#4de3a0');
      drawStormCloudRank(0);
      drawCyberVortex(stage, surge);
      drawWireRings(stage, surge);
      drawDataRoutes(stage, surge);
    });
    bgLayer(.32, () => {
      drawStormCloudRank(1);
      // Ultra-far third spire ridge behind the existing two.
      drawDataSpires((elapsed * -3) % 90, 520, 30, .18, surge * .3);
      drawDataSpires((elapsed * -7) % 126, 545, 44, .34, surge * .5);
    });
    drawDepthHaze(stage, .4);
    drawMainframeRow(stage);
    bgLayer(.22, () => drawStormCloudRank(2));
    bgLayer(.15, () => {
      for (const p of bgProps) if (p.kind === 'code') drawCodeColumn(p, stage);
      for (const p of bgProps) if (p.kind === 'panel') drawPanel(p, stage);
      drawDataSpires((elapsed * -20) % 150, 618, 62, .95, surge);
    });
    drawHoloGrid(stage);
    drawStormGround(stage);
    drawLightningBolt(stage);
  }

  // Long packet routes arc through the storm like luminous air lanes. Packets
  // chase one another along the curves and brighten with the lightning surge.
  function drawDataRoutes(stage, surge) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const routes = [[-80, 220, 420, 80, 760, 300, stage.accent], [350, 80, 820, 180, 1360, 90, stage.accent2], [-120, 410, 520, 190, 1320, 360, '#d6ffd0']];
    for (let r = 0; r < routes.length; r++) {
      const [x0, y0, cx, cy, x1, y1, col] = routes[r];
      ctx.globalAlpha = .08 + surge * .11; ctx.strokeStyle = col; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(cx, cy, x1, y1); ctx.stroke();
      for (let i = 0; i < 5; i++) {
        const t = (elapsed * (.08 + r * .018) + i / 5 + r * .21) % 1;
        const u = 1 - t;
        const x = u * u * x0 + 2 * u * t * cx + t * t * x1;
        const y = u * u * y0 + 2 * u * t * cy + t * t * y1;
        ctx.globalAlpha = .22 + surge * .42; ctx.fillStyle = col;
        ctx.fillRect(x - 3, y - 3, 7, 7);
        ctx.globalAlpha = .1 + surge * .18; ctx.fillRect(x - 20, y - 1, 17, 2);
      }
    }
    ctx.restore();
  }

  // A giant data cyclone provides a clear focal silhouette. Broken arcs and
  // orbiting packets react to lightning without washing out the play field.
  function drawCyberVortex(stage, surge) {
    const cx = 640, cy = 292;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) {
      const r = 54 + i * 34, squash = .38 + i * .035;
      ctx.globalAlpha = (.055 + surge * .045) * (1 - i * .06);
      ctx.strokeStyle = i % 2 ? stage.accent2 : stage.accent; ctx.lineWidth = 2 + (i % 3);
      ctx.beginPath();
      ctx.ellipse(cx, cy + i * 12, r, r * squash, elapsed * (.045 + i * .006), .18 + i * .32, Math.PI * 1.45 + i * .28);
      ctx.stroke();
    }
    for (let i = 0; i < 22; i++) {
      const a = elapsed * (.15 + (i % 4) * .025) + i * 2.17;
      const r = 65 + (i * 37) % 215, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * .42 + (i % 5) * 8;
      ctx.globalAlpha = .12 + surge * .16; ctx.fillStyle = i % 3 ? stage.accent : '#d8fff0';
      ctx.fillRect(x, y, 4 + i % 5, 4 + i % 5);
    }
    const core = ctx.createRadialGradient(cx, cy, 3, cx, cy, 92);
    core.addColorStop(0, hexA('#eaffff', .25 + surge * .2)); core.addColorStop(.35, hexA(stage.accent, .12)); core.addColorStop(1, 'rgba(40,255,180,0)');
    ctx.globalAlpha = .75; ctx.fillStyle = core; ctx.beginPath(); ctx.arc(cx, cy, 92, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // Black obsidian data monoliths: tapered slabs with a glowing circuit seam and
  // node lights that surge on lightning. A right-side extrude gives real volume.
  function drawDataSpires(offset, ground, unit, alpha, seam) {
    const stage = stages[stageIndex];
    ctx.save(); ctx.globalAlpha = alpha;
    for (let i = -1; i < 15; i++) {
      const x = i * unit * 1.5 + offset;
      if (x < -unit * 2 || x > VW + unit) continue;
      const w = unit * (.5 + ((i * 53) % 7) / 12);
      const h = 96 + ((i * 71 + 40) % 230);
      const topY = ground - h, cap = 18, depth = unit * .3;
      // right extrude face
      ctx.fillStyle = '#020c0a';
      ctx.beginPath(); ctx.moveTo(x + w, topY + cap); ctx.lineTo(x + w + depth, topY + cap + depth * .5); ctx.lineTo(x + w + depth, ground); ctx.lineTo(x + w, ground); ctx.closePath(); ctx.fill();
      // tapered obsidian front
      const bg = ctx.createLinearGradient(x, topY, x, ground);
      bg.addColorStop(0, '#12463a'); bg.addColorStop(.5, '#0a2a22'); bg.addColorStop(1, '#03110d');
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.moveTo(x + w * .28, topY); ctx.lineTo(x + w * .72, topY); ctx.lineTo(x + w, topY + cap); ctx.lineTo(x + w, ground); ctx.lineTo(x, ground); ctx.lineTo(x, topY + cap); ctx.closePath(); ctx.fill();
      // left rim light
      ctx.globalAlpha = alpha * .5; ctx.fillStyle = hexA(stage.accent, .5); ctx.fillRect(x, topY + cap, 2, h - cap); ctx.globalAlpha = alpha;
      // glowing circuit seam + node bars
      ctx.save(); ctx.globalAlpha = alpha * seam; ctx.shadowColor = stage.accent; ctx.shadowBlur = 8; ctx.fillStyle = stage.accent;
      ctx.fillRect(x + w * .5 - 1, topY + cap, 2, h - cap - 6);
      for (let yy = topY + cap + 20; yy < ground - 12; yy += 42) ctx.fillRect(x + 5, yy, w - 10, 2);
      ctx.restore();
      // apex beacon
      ctx.save(); ctx.globalAlpha = alpha * (.4 + seam * .6); ctx.fillStyle = stage.accent2; ctx.shadowColor = stage.accent2; ctx.shadowBlur = 10;
      ctx.fillRect(x + w * .5 - 2, topY - 7, 4, 9); ctx.restore();
    }
    ctx.restore();
  }

  // Receding neon floor grid (perspective) for the data-realm feel.
  function drawHoloGrid(stage) {
    const horizon = 566, bottom = 662;
    ctx.save(); ctx.strokeStyle = stage.accent; ctx.lineWidth = 1;
    for (let i = 0; i <= 12; i++) {
      const t = i / 12, y = horizon + (bottom - horizon) * (t * t);
      ctx.globalAlpha = .05 + t * .16; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VW, y); ctx.stroke();
    }
    const drift = (elapsed * 70) % 96;
    ctx.globalAlpha = .13;
    for (let x = -400; x < VW + 400; x += 96) {
      ctx.beginPath(); ctx.moveTo(VW / 2 + (x - VW / 2) * .12, horizon); ctx.lineTo(x - drift, bottom + 46); ctx.stroke();
    }
    ctx.restore();
  }

  // Slow rotating wireframe rings — a quiet hero prop far in the sky.
  function drawWireRings(stage, surge) {
    const cx = 950, cy = 240;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 3; k++) {
      const rot = elapsed * (.3 + k * .16) + k;
      const rx = 66 + k * 30, ry = (66 + k * 30) * (.28 + Math.abs(Math.sin(rot)) * .55);
      ctx.globalAlpha = (.08 + surge * .12) * (1 - k * .18);
      ctx.strokeStyle = k % 2 ? stage.accent2 : stage.accent; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = .1 + surge * .2; ctx.fillStyle = stage.accent;
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
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
    const g = cachedGrad('stormSeaBase', () => {
      const gr = ctx.createLinearGradient(0, ground, 0, VH);
      gr.addColorStop(0, '#0b2a26'); gr.addColorStop(1, '#040d10');
      return gr;
    });
    ctx.fillStyle = g; ctx.fillRect(0, ground, VW, VH - ground);
    // Rolling cloud sea beneath the data plane: two ranks of baked cloud-top
    // strips drift and bob; a nearby strike lights their crests white-green.
    const strip = bakeSprite('stormSeaStrip', 320, 64, bc => {
      for (let i = 0; i < 6; i++) {
        const bx = 20 + i * 56 + (i * 37 % 18), r = 26 + (i * 29 % 14);
        const gg = bc.createRadialGradient(bx, 54 - (i % 3) * 6 - r * .2, r * .15, bx, 54 - (i % 3) * 6, r);
        gg.addColorStop(0, '#1b4a3e'); gg.addColorStop(.6, '#0d2c24'); gg.addColorStop(1, 'rgba(4,14,12,0)');
        bc.fillStyle = gg; bc.beginPath(); bc.arc(bx, 54 - (i % 3) * 6, r, 0, Math.PI * 2); bc.fill();
      }
    });
    ctx.save();
    for (let row = 0; row < 2; row++) {
      const off = (elapsed * (16 + row * 15)) % 320;
      const y = 646 + row * 22;
      ctx.globalAlpha = .85 - row * .3;
      for (let x = -320; x < VW + 320; x += 320) {
        blit(strip, x - off, y + Math.sin(elapsed * .7 + x * .01 + row * 2) * 4);
      }
    }
    if (lightning > 0) {
      const k = Math.min(1, lightning * 2.4);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = k * .5;
      const lg = ctx.createRadialGradient(lightningX, 652, 6, lightningX, 652, 180);
      lg.addColorStop(0, 'rgba(216,255,240,.6)'); lg.addColorStop(1, 'rgba(120,255,170,0)');
      ctx.fillStyle = lg; ctx.beginPath(); ctx.ellipse(lightningX, 652, 180, 40, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = stage.accent; ctx.fillRect(0, ground, VW, 3);
    ctx.save(); ctx.globalAlpha = .2; ctx.fillStyle = stage.accent;
    const off = (elapsed * 140) % 160;
    for (let x = -off; x < VW; x += 160) ctx.fillRect(x, ground + 16, 60, 3);
    ctx.restore();
  }

  // One jagged descent from (x, -20) to maxY using the same LCG as before, so a
  // given strike keeps its shape across frames. Optionally sprouts up to two
  // thinner child branches partway down.
  function strokeBolt(x, seed, maxY, width, branching) {
    let y = -20;
    const branches = [];
    ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(x, y);
    while (y < maxY) {
      seed = (seed * 9301 + 49297) % 233280;
      x += (seed / 233280 - .5) * 96; y += 42 + seed % 38;
      ctx.lineTo(x, y);
      if (branching && seed % 5 === 0 && y < maxY - 140) branches.push([x, y, seed * 3 + 11]);
    }
    ctx.stroke();
    for (const [bx, by, bs] of branches.slice(0, 2)) {
      let sx = bx, sy = by, s = bs;
      ctx.lineWidth = width * .45;
      ctx.beginPath(); ctx.moveTo(sx, sy);
      for (let k = 0; k < 4 && sy < maxY; k++) {
        s = (s * 9301 + 49297) % 233280;
        sx += (s / 233280 - .3) * 110; sy += 30 + s % 40;
        ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    }
  }

  function drawLightningBolt(stage) {
    // After-images of recent strikes linger briefly, like retinal ghosts.
    boltGhosts = boltGhosts.filter(g2 => elapsed - g2.born >= 0 && elapsed - g2.born < 1.1);
    ctx.save();
    for (const g2 of boltGhosts) {
      if (lightning > 0 && g2.x === lightningX) continue;
      ctx.globalAlpha = (1 - (elapsed - g2.born) / 1.1) * .15;
      ctx.strokeStyle = stage.accent;
      strokeBolt(g2.x, Math.floor(g2.x * 7), 560, 2.5, false);
    }
    if (lightning > 0) {
      if (!boltGhosts.some(g2 => g2.x === lightningX)) boltGhosts.push({ x: lightningX, born: elapsed });
      const k = Math.min(1, lightning * 2.4);
      ctx.globalAlpha = k * .22;
      ctx.fillStyle = '#d8fff0'; ctx.fillRect(-30, -30, VW + 60, VH + 60);
      ctx.globalAlpha = k * .9;
      ctx.strokeStyle = '#eaffff'; ctx.shadowColor = stage.accent; ctx.shadowBlur = 22;
      strokeBolt(lightningX, Math.floor(lightningX * 7), 560, 4, true);
    }
    ctx.restore();
  }

  function drawPalaceBackdrop(stage) {
    // Ease toward battle lighting while the queen is on stage, back to the
    // serene cathedral after. Reset in resetGame with the other stage state.
    const wantBossLight = stageIndex === 4 && ['active', 'transition', 'final'].includes(bossState) ? 1 : 0;
    palaceBossMix += (wantBossLight - palaceBossMix) * .02;
    // The queen's last act stains the whole sky. Fades in once and is reset by
    // resetGame / leaveShop / doContinue so it never leaks into another run.
    if (bossCrit > 0) {
      ctx.save(); ctx.globalAlpha = Math.min(1, bossCrit) * .55;
      const g = cachedGrad('critSky', () => {
        const r = ctx.createLinearGradient(0, 0, 0, VH);
        r.addColorStop(0, '#2a0008'); r.addColorStop(.5, '#7d0b25'); r.addColorStop(1, '#ff2a3c');
        return r;
      });
      ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH); ctx.restore();
    }
    bgLayer(.5, () => {
      drawRoseWindow(stage);
      ctx.save(); ctx.shadowColor = stage.accent2; ctx.shadowBlur = 42; ctx.fillStyle = '#ff6fb5';
      heartPath(980, 150, 56); ctx.fill(); ctx.restore();
      drawStars(70, '#ffe15a', '#ff9ccf');
      for (const c of clouds) drawCloud(c, '#f8c7e6', .08);
      ctx.save(); ctx.globalAlpha = .06; ctx.fillStyle = stage.accent;
      for (let i = 0; i < 4; i++) { const bx = 120 + i * 300 + Math.sin(elapsed * .4 + i) * 30; ctx.beginPath(); ctx.moveTo(bx, -30); ctx.lineTo(bx + 120, -30); ctx.lineTo(bx + 300, 660); ctx.lineTo(bx + 180, 660); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    });
    // The cathedral proper interleaves in depth — windows behind rays behind
    // the far colonnade, chandeliers hanging between the column rows — so the
    // palace is the one stage that uses the painter's queue.
    volPush(1600, () => bgLayer(.32, () => drawPalaceTowers(stage)));
    volPush(1300, () => bgLayer(.28, () => drawStainedGlassWall(stage)));
    volPush(1280, () => drawPalaceNave(stage, 1280, .5, false));
    volPush(1150, () => bgLayer(.2, () => drawGodRays(stage)));
    volPush(850, () => drawDepthHaze(stage, .45));
    volPush(700, () => bgLayer(.24, () => drawChandelier(stage, 985, 96, .62)));
    volPush(620, () => drawPalaceNave(stage, 620, .8, true));
    volPush(400, () => bgLayer(.15, () => drawPalaceThrone(stage)));
    volPush(160, () => bgLayer(.12, () => drawChandelier(stage, 300, 74, 1)));
    volFlush();
    drawPalaceFloor(stage);
    drawGroundPlane(stage, { horizonY: 652, bottom: 716, color: '#ff9ccf', alpha: .12, speed: 150, gap: 128 });
  }

  // --- Stained glass, god rays and chandeliers (palace) -------------------
  const PALACE_WINDOWS = [[190, 238], [398, 256], [828, 256], [1036, 238]];

  // Pointed gothic window baked once: lead mullions, jewel glass and a heart
  // medallion. Runtime cost is one drawImage + one soft glow.
  function palaceWindowSprite(v) {
    return bakeSprite('palWin' + v, 68, 150, bc => {
      const w = 64, h = 146, cxw = w / 2 + 2;
      const arch = () => {
        bc.beginPath(); bc.moveTo(2, h); bc.lineTo(2, 52);
        bc.quadraticCurveTo(2, 16, cxw, 5);
        bc.quadraticCurveTo(w + 2, 16, w + 2, 52);
        bc.lineTo(w + 2, h); bc.closePath();
      };
      bc.save(); arch(); bc.clip();
      const cols = ['#ff5a9d', '#c2277e', '#ffb3d4', '#ffd76a', '#a51c58', '#ff8bc0'];
      bc.globalAlpha = .85;
      for (let ry = 0; ry < 9; ry++) for (let cxi = 0; cxi < 4; cxi++) {
        bc.fillStyle = cols[(ry * 4 + cxi + v * 7) % cols.length];
        bc.fillRect(2 + cxi * 16, 5 + ry * 16, 16, 16);
      }
      bc.globalAlpha = .95; bc.fillStyle = '#ff2f6d';
      bc.beginPath();
      bc.moveTo(cxw, 74); bc.bezierCurveTo(cxw - 20, 52, cxw - 32, 80, cxw, 102);
      bc.bezierCurveTo(cxw + 32, 80, cxw + 20, 52, cxw, 74);
      bc.fill();
      bc.restore();
      bc.globalAlpha = 1;
      bc.strokeStyle = '#2a1c0a'; bc.lineWidth = 2;
      for (let ry = 1; ry < 9; ry++) { bc.beginPath(); bc.moveTo(4, 5 + ry * 16); bc.lineTo(w, 5 + ry * 16); bc.stroke(); }
      bc.beginPath(); bc.moveTo(cxw, 7); bc.lineTo(cxw, h); bc.stroke();
      bc.strokeStyle = '#3a2a10'; bc.lineWidth = 3; arch(); bc.stroke();
      bc.strokeStyle = '#ffe15a'; bc.lineWidth = 1.5; arch(); bc.stroke();
    });
  }

  function drawStainedGlassWall(stage) {
    ctx.save();
    for (let i = 0; i < PALACE_WINDOWS.length; i++) {
      const [wx, wy] = PALACE_WINDOWS[i];
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = .12 + Math.sin(elapsed * .8 + i * 1.7) * .05 + palaceBossMix * .08;
      const g = ctx.createRadialGradient(wx + 37, wy + 80, 8, wx + 37, wy + 80, 120);
      g.addColorStop(0, '#ff9ccf'); g.addColorStop(1, 'rgba(255,60,120,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(wx + 37, wy + 80, 120, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.globalAlpha = .85;
      blit(palaceWindowSprite(i % 3), wx, wy, 75, 165);
    }
    ctx.restore();
  }

  // Coloured light shafts falling from each window toward the nave centre.
  // Pink at peace, deep crimson while the queen fights, blood red at her end.
  function drawGodRays(stage) {
    const q = bgQuality();
    if (!q) return;
    const idx = q === 2 ? [0, 1, 2, 3] : [0, 3];
    const mix = Math.max(palaceBossMix * .6, Math.min(1, bossCrit));
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const i of idx) {
      const [wx, wy] = PALACE_WINDOWS[i];
      const fx = wx + 37 + (640 - wx - 37) * .5;
      const g = ctx.createLinearGradient(wx + 37, wy + 60, fx, 700);
      g.addColorStop(0, mixHexA('#ff9ccf', '#ff2a3c', mix, .2));
      g.addColorStop(1, mixHexA('#ff9ccf', '#ff2a3c', mix, 0));
      ctx.fillStyle = g;
      ctx.globalAlpha = .55 + Math.sin(elapsed * .5 + i * 2.1) * .18;
      ctx.beginPath();
      ctx.moveTo(wx + 10, wy + 46); ctx.lineTo(wx + 66, wy + 52);
      ctx.lineTo(fx + 130, 704); ctx.lineTo(fx - 130, 704);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  // Twin-tier gold chandelier. The pivot sits at the ceiling so the whole body
  // sways as a pendulum; candles dim during the boss fight (readability) and
  // the sway trebles in the queen's last act while the gold keeps shining.
  function drawChandelier(stage, x, topY, s) {
    const crit = Math.min(1, bossCrit);
    const sway = Math.sin(elapsed * (0.55 + crit * .9) + x) * (.035 + crit * .075);
    const candleA = 1 - palaceBossMix * .45;
    ctx.save();
    ctx.translate(x, -24); ctx.rotate(sway);
    ctx.strokeStyle = '#8a6a1f'; ctx.lineWidth = 3 * s;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, topY + 24); ctx.stroke();
    ctx.translate(0, topY + 24); ctx.scale(s, s);
    ctx.fillStyle = '#b3862d'; ctx.fillRect(-3, 0, 6, 84);
    ctx.beginPath(); ctx.arc(0, 92, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe15a'; ctx.fillRect(-3, 0, 6, 3);
    for (const [ty, r, n] of [[26, 34, 3], [58, 62, 5]]) {
      for (let i = 0; i < n; i++) {
        const cxi = -r + (2 * r * i) / (n - 1);
        ctx.strokeStyle = '#b3862d'; ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.moveTo(0, ty - 22); ctx.quadraticCurveTo(cxi * .85, ty + 6, cxi, ty); ctx.stroke();
        ctx.globalAlpha = candleA; ctx.fillStyle = '#f7ead0'; ctx.fillRect(cxi - 2, ty - 13, 4, 13);
        const flick = Math.sin(elapsed * (5.3 + crit * 6) + cxi + x) * 2.5;
        ctx.fillStyle = i % 2 ? '#ff9ccf' : '#ffd76a';
        ctx.beginPath(); ctx.ellipse(cxi, ty - 17 + flick * .4, 3, 6 + flick * .5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = '#7a5c1a'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.ellipse(0, ty, r + 7, 9, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = faceLit('#c9a13b', 'top', crit * .5); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, ty - 2, r + 7, 8, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .18 * candleA;
    const g = ctx.createRadialGradient(0, 44, 6, 0, 44, 110);
    g.addColorStop(0, '#ffd76a'); g.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 44, 110, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  // A distant heart-backed throne closes the central perspective and gives the
  // final arena an unmistakable destination. Candle rows flicker independently
  // while the silhouette stays dark enough to preserve bullet contrast.
  function drawPalaceThrone(stage) {
    const x = 640, y = 568, pulse = .72 + Math.sin(elapsed * 1.6) * .12;
    ctx.save(); ctx.globalAlpha = .72;
    const halo = ctx.createRadialGradient(x, y - 92, 10, x, y - 92, 126);
    halo.addColorStop(0, hexA(stage.accent2, .24 * pulse)); halo.addColorStop(1, hexA(stage.accent2, 0));
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(x, y - 92, 126, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a0823'; heartPath(x, y - 112, 70); ctx.fill();
    ctx.strokeStyle = '#ffe15a'; ctx.lineWidth = 4; ctx.stroke();
    const velvet = ctx.createLinearGradient(x - 62, y - 160, x + 62, y);
    velvet.addColorStop(0, '#a51c58'); velvet.addColorStop(.5, '#5b123d'); velvet.addColorStop(1, '#20071d');
    ctx.fillStyle = velvet;
    ctx.beginPath(); ctx.roundRect(x - 54, y - 158, 108, 146, [48, 48, 10, 10]); ctx.fill();
    ctx.fillStyle = '#160414'; ctx.fillRect(x - 72, y - 34, 144, 23); ctx.fillRect(x - 63, y - 12, 126, 18);
    ctx.fillStyle = '#ffe15a';
    for (const ox of [-48, -24, 0, 24, 48]) {
      const flick = Math.sin(elapsed * 5.3 + ox) * 3;
      ctx.fillRect(x + ox - 2, y - 2, 4, 24);
      ctx.fillStyle = ox % 48 ? '#ff9ccf' : '#ffe15a';
      ctx.beginPath(); ctx.ellipse(x + ox, y - 7 + flick, 4, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe15a';
    }
    ctx.restore();
  }

  // Monumental stained-glass rose window and hanging crowns make the final
  // stage feel like a throne room rather than another abstract neon tunnel.
  function drawRoseWindow(stage) {
    const cx = 640, cy = 300, r = 164;
    ctx.save(); ctx.globalAlpha = .56; ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = 5;
    // Heartbeat while the queen fights: the rose window pulses like the organ
    // it stands for. Imperceptible at rest (palaceBossMix eases to 0).
    const beat = 1 + palaceBossMix * .02 * Math.sin(elapsed * 3.4);
    ctx.translate(cx, cy); ctx.scale(beat, beat); ctx.translate(-cx, -cy);
    ctx.shadowColor = stage.accent2; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2;
    for (let i = 0; i < 16; i++) {
      const a = i * Math.PI / 8;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 38, cy + Math.sin(a) * 38); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.stroke();
      ctx.fillStyle = i % 2 ? hexA(stage.accent2, .16) : 'rgba(255,225,90,.1)';
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r - 8, a, a + Math.PI / 8); ctx.closePath(); ctx.fill();
    }
    ctx.lineWidth = 4;
    for (const rr of [42, 92, 132]) { ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = '#ff5a9d'; heartPath(cx, cy + 5, 38); ctx.fill();
    // Gilded sunburst tracery — spiked gold rays and pearl bosses around the
    // rim, with a crowned finial on top. Regalia, not just a window.
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#c9a13b';
    for (let i = 0; i < 24; i++) {
      const a = i * Math.PI / 12 + Math.PI / 24;
      const len = i % 3 === 0 ? 30 : 16;
      const x0 = cx + Math.cos(a) * (r + 4), y0 = cy + Math.sin(a) * (r + 4);
      const x1 = cx + Math.cos(a) * (r + 4 + len), y1 = cy + Math.sin(a) * (r + 4 + len);
      ctx.beginPath();
      ctx.moveTo(x0 + Math.sin(a) * 5, y0 - Math.cos(a) * 5);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x0 - Math.sin(a) * 5, y0 + Math.cos(a) * 5);
      ctx.closePath(); ctx.fill();
    }
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      ctx.fillStyle = i % 3 ? '#ffd76a' : '#ff9ccf';
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * (r + 14), cy + Math.sin(a) * (r + 14), 4.5, 0, Math.PI * 2); ctx.fill();
    }
    const fy = cy - r - 26;
    ctx.fillStyle = '#c9a13b'; ctx.fillRect(cx - 30, fy, 60, 12);
    ctx.fillStyle = '#ffe15a';
    for (const [ox, hh] of [[-24, 18], [-12, 26], [0, 34], [12, 26], [24, 18]]) {
      ctx.beginPath(); ctx.moveTo(cx + ox - 5, fy); ctx.lineTo(cx + ox, fy - hh); ctx.lineTo(cx + ox + 5, fy); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#ff5a9d';
    for (const ox of [-24, 0, 24]) { ctx.beginPath(); ctx.arc(cx + ox, fy - 4, 3, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    // Twin lesser roses flank the great window.
    for (const mx of [cx - 340, cx + 340]) {
      ctx.save(); ctx.globalAlpha = .42; ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(mx, 208, 56, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        ctx.beginPath(); ctx.moveTo(mx + Math.cos(a) * 14, 208 + Math.sin(a) * 14); ctx.lineTo(mx + Math.cos(a) * 56, 208 + Math.sin(a) * 56); ctx.stroke();
        ctx.fillStyle = i % 2 ? hexA(stage.accent2, .14) : 'rgba(255,225,90,.09)';
        ctx.beginPath(); ctx.moveTo(mx, 208); ctx.arc(mx, 208, 50, a, a + Math.PI / 4); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = '#ff5a9d'; heartPath(mx, 211, 15); ctx.fill();
      ctx.restore();
    }
    ctx.save(); ctx.globalAlpha = .46; ctx.strokeStyle = '#8b4770'; ctx.lineWidth = 4;
    for (const x of [205, 1075]) {
      ctx.beginPath(); ctx.moveTo(x, -20); ctx.lineTo(x, 168); ctx.stroke();
      ctx.fillStyle = '#36102c'; ctx.beginPath(); ctx.moveTo(x - 42, 168); ctx.lineTo(x + 42, 168); ctx.lineTo(x + 30, 205); ctx.lineTo(x - 30, 205); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ffe15a'; ctx.stroke();
      for (const ox of [-24, 0, 24]) { ctx.fillStyle = '#ff9ccf'; ctx.beginPath(); ctx.arc(x + ox, 202, 7, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
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

  // Fluted rose-marble column with a gilded two-tier capital and base, baked
  // once and blitted into whatever perspective rect boxZ returns.
  function palaceColumnSprite() {
    return bakeSprite('palColumn', 72, 460, bc => {
      const g = bc.createLinearGradient(8, 0, 64, 0);
      g.addColorStop(0, '#1c0618'); g.addColorStop(.3, '#5d1a50'); g.addColorStop(.52, '#3a0f33'); g.addColorStop(1, '#0e030c');
      bc.fillStyle = g; bc.fillRect(12, 34, 48, 396);
      bc.globalAlpha = .5; bc.fillStyle = '#0d020c';
      for (const fx of [22, 34, 46]) bc.fillRect(fx, 40, 3.5, 384);
      bc.globalAlpha = 1;
      bc.fillStyle = 'rgba(255,180,220,.16)'; bc.fillRect(26, 34, 6, 396);
      const gold = bc.createLinearGradient(0, 6, 0, 34);
      gold.addColorStop(0, '#ffdf7e'); gold.addColorStop(.5, '#c9a13b'); gold.addColorStop(1, '#7a5c1a');
      bc.fillStyle = gold; bc.fillRect(2, 18, 68, 16); bc.fillRect(8, 6, 56, 12);
      bc.fillStyle = '#ffe9a8'; bc.fillRect(2, 18, 68, 3); bc.fillRect(8, 6, 56, 2);
      bc.fillStyle = '#8a6a1f';
      for (let i = 0; i < 6; i++) bc.fillRect(8 + i * 11, 24, 5, 8);
      const gold2 = bc.createLinearGradient(0, 430, 0, 456);
      gold2.addColorStop(0, '#ffdf7e'); gold2.addColorStop(.6, '#b3862d'); gold2.addColorStop(1, '#5c420f');
      bc.fillStyle = gold2; bc.fillRect(4, 430, 64, 12); bc.fillRect(0, 442, 72, 14);
      bc.fillStyle = '#ffe9a8'; bc.fillRect(4, 430, 64, 3);
    });
  }

  // Crimson velvet banner with gold trim, fringe and the queen's crest.
  function palaceBannerSprite(v) {
    return bakeSprite('palBanner' + v, 90, 170, bc => {
      const g = bc.createLinearGradient(0, 0, 90, 0);
      g.addColorStop(0, '#5b0a26'); g.addColorStop(.45, '#9e1440'); g.addColorStop(1, '#3f0619');
      bc.fillStyle = g;
      bc.beginPath();
      bc.moveTo(4, 0); bc.lineTo(86, 0); bc.lineTo(86, 128); bc.lineTo(45, 156); bc.lineTo(4, 128);
      bc.closePath(); bc.fill();
      bc.globalAlpha = .35; bc.fillStyle = '#2a0311';
      for (const fx of [22, 45, 66]) bc.fillRect(fx, 6, 6, 118 + (fx === 45 ? 26 : 0));
      bc.globalAlpha = 1;
      bc.fillStyle = '#c9a13b'; bc.fillRect(0, 0, 90, 7);
      bc.strokeStyle = '#c9a13b'; bc.lineWidth = 3;
      bc.beginPath(); bc.moveTo(4, 128); bc.lineTo(45, 156); bc.lineTo(86, 128); bc.stroke();
      bc.fillStyle = '#ffe15a';
      for (let i = 0; i < 5; i++) {
        const t = i / 4, fx = 8 + t * 74, fy = 131 + (1 - Math.abs(t - .5) * 2) * 26;
        bc.beginPath(); bc.moveTo(fx - 3, fy); bc.lineTo(fx, fy + 10); bc.lineTo(fx + 3, fy); bc.closePath(); bc.fill();
      }
      // crest: gold ring around a heart, or a crown
      bc.strokeStyle = '#ffd76a'; bc.lineWidth = 3.5;
      bc.beginPath(); bc.arc(45, 62, 26, 0, Math.PI * 2); bc.stroke();
      if (v === 0) {
        bc.fillStyle = '#ff5a9d';
        bc.beginPath();
        bc.moveTo(45, 52); bc.bezierCurveTo(31, 40, 24, 58, 45, 78);
        bc.bezierCurveTo(66, 58, 59, 40, 45, 52);
        bc.fill();
      } else {
        bc.fillStyle = '#ffd76a'; bc.fillRect(31, 66, 28, 8);
        for (const [ox, hh] of [[-10, 12], [0, 18], [10, 12]]) {
          bc.beginPath(); bc.moveTo(45 + ox - 4, 66); bc.lineTo(45 + ox, 66 - hh); bc.lineTo(45 + ox + 4, 66); bc.closePath(); bc.fill();
        }
      }
    });
  }

  // Colossal gilded guardian effigy: crowned queen figure with thorn wings and
  // a greatsword planted point-down. Baked once; the halo, aura and wartime
  // ember eyes are applied live so the statues answer the fight.
  function palaceStatueSprite() {
    return bakeSprite('palStatue', 200, 430, bc => {
      const cx = 100;
      bc.strokeStyle = 'rgba(255,215,106,.55)'; bc.lineWidth = 5;
      bc.beginPath(); bc.arc(cx, 96, 36, 0, Math.PI * 2); bc.stroke();
      bc.strokeStyle = 'rgba(255,215,106,.22)'; bc.lineWidth = 10;
      bc.beginPath(); bc.arc(cx, 96, 46, 0, Math.PI * 2); bc.stroke();
      // folded thorn wings, drawn behind the body
      for (const dir of [-1, 1]) {
        const g = bc.createLinearGradient(cx, 60, cx + dir * 95, 240);
        g.addColorStop(0, '#a87c22'); g.addColorStop(1, '#2e1f0a');
        bc.fillStyle = g;
        bc.beginPath();
        bc.moveTo(cx + dir * 20, 160);
        bc.quadraticCurveTo(cx + dir * 90, 116, cx + dir * 94, 34);
        bc.quadraticCurveTo(cx + dir * 62, 98, cx + dir * 52, 122);
        bc.quadraticCurveTo(cx + dir * 80, 172, cx + dir * 58, 236);
        bc.quadraticCurveTo(cx + dir * 38, 202, cx + dir * 18, 198);
        bc.closePath(); bc.fill();
        bc.strokeStyle = 'rgba(255,225,144,.3)'; bc.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          bc.beginPath();
          bc.moveTo(cx + dir * (26 + i * 5), 172 + i * 10);
          bc.quadraticCurveTo(cx + dir * (64 + i * 8), 128 - i * 8, cx + dir * (86 - i * 5), 54 + i * 24);
          bc.stroke();
        }
      }
      // robe: tall tapered gold gown with fold shadows
      const robe = bc.createLinearGradient(0, 190, 0, 372);
      robe.addColorStop(0, '#e8c766'); robe.addColorStop(.55, '#b3862d'); robe.addColorStop(1, '#5c420f');
      bc.fillStyle = robe;
      bc.beginPath(); bc.moveTo(cx - 20, 196); bc.lineTo(cx + 20, 196);
      bc.lineTo(cx + 56, 372); bc.lineTo(cx - 56, 372); bc.closePath(); bc.fill();
      bc.globalAlpha = .35; bc.strokeStyle = '#3a2a10'; bc.lineWidth = 3;
      for (const fx of [-30, -12, 8, 26]) {
        bc.beginPath(); bc.moveTo(cx + fx * .4, 206); bc.lineTo(cx + fx, 368); bc.stroke();
      }
      bc.globalAlpha = 1;
      // armored torso, spiked pauldrons, chest heart gem
      const chest = bc.createLinearGradient(0, 140, 0, 200);
      chest.addColorStop(0, '#f5dc8a'); chest.addColorStop(1, '#9a7420');
      bc.fillStyle = chest;
      bc.beginPath(); bc.moveTo(cx - 26, 142); bc.lineTo(cx + 26, 142);
      bc.lineTo(cx + 20, 200); bc.lineTo(cx - 20, 200); bc.closePath(); bc.fill();
      bc.fillStyle = '#c9a13b';
      for (const dir of [-1, 1]) {
        bc.beginPath(); bc.moveTo(cx + dir * 20, 148);
        bc.lineTo(cx + dir * 52, 132); bc.lineTo(cx + dir * 30, 168); bc.closePath(); bc.fill();
      }
      bc.fillStyle = '#8a6a1f'; bc.beginPath(); bc.arc(cx, 172, 13, 0, Math.PI * 2); bc.fill();
      bc.fillStyle = '#ff5a9d';
      bc.beginPath();
      bc.moveTo(cx, 166); bc.bezierCurveTo(cx - 9, 158, cx - 14, 170, cx, 181);
      bc.bezierCurveTo(cx + 14, 170, cx + 9, 158, cx, 166);
      bc.fill();
      // gauntlets + greatsword planted point-down
      bc.fillStyle = '#c9a13b'; bc.fillRect(cx - 22, 208, 44, 12);
      bc.fillStyle = '#e8c766'; bc.fillRect(cx - 7, 196, 14, 14);
      const blade = bc.createLinearGradient(cx - 5, 0, cx + 5, 0);
      blade.addColorStop(0, '#d8cfae'); blade.addColorStop(.5, '#fdf6d8'); blade.addColorStop(1, '#8f8560');
      bc.fillStyle = blade;
      bc.beginPath(); bc.moveTo(cx - 5, 220); bc.lineTo(cx + 5, 220);
      bc.lineTo(cx + 5, 350); bc.lineTo(cx, 368); bc.lineTo(cx - 5, 350); bc.closePath(); bc.fill();
      // stern visored head under a five-spike crown
      bc.fillStyle = '#e8c766'; bc.fillRect(cx - 13, 100, 26, 40);
      bc.fillStyle = '#1a0812'; bc.fillRect(cx - 13, 112, 26, 9);
      bc.fillStyle = '#ffd76a'; bc.fillRect(cx - 18, 88, 36, 12);
      for (const [ox, hh] of [[-15, 20], [-7.5, 30], [0, 42], [7.5, 30], [15, 20]]) {
        bc.beginPath(); bc.moveTo(cx + ox - 4, 90); bc.lineTo(cx + ox, 90 - hh); bc.lineTo(cx + ox + 4, 90); bc.closePath(); bc.fill();
      }
      // two-tier stone pedestal with gold trims
      bc.fillStyle = '#2c0a26'; bc.fillRect(cx - 58, 372, 116, 28);
      bc.fillStyle = '#1c0618'; bc.fillRect(cx - 70, 400, 140, 30);
      bc.fillStyle = '#c9a13b'; bc.fillRect(cx - 58, 372, 116, 4); bc.fillRect(cx - 70, 400, 140, 4);
    });
  }

  // Two colossal effigies flank the nave ahead of the throne — fixed guardians
  // at the end of the hall that make the approach feel ceremonial. Their eyes
  // smoulder red while the queen fights.
  function drawPalaceStatues(stage) {
    const z = 1180, s = FOCAL / (FOCAL + z);
    const spr = palaceStatueSprite();
    const h = 780 * s, w = h * 200 / 430;
    for (const side of [-1, 1]) {
      const wx = worldXAt(VW / 2 + side * 452, s);
      const p = proj3(wx, HORIZON_Y + 92 / s, z);   // feet on the marble's leading edge
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(p.x, p.y - h * .55, 10, p.x, p.y - h * .55, h * .6);
      g.addColorStop(0, 'rgba(255,215,106,.16)'); g.addColorStop(1, 'rgba(255,180,60,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y - h * .55, h * .6, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      blit(spr, p.x - w / 2, p.y - h, w, h);
      // gold bloom: a faint additive re-blit keeps the effigies luminous even
      // through the nave haze and the queen's battle lighting
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .26;
      blit(spr, p.x - w / 2, p.y - h, w, h);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      if (palaceBossMix > .02) {
        const ey = p.y - h + h * .27, ew = w * .13;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = palaceBossMix * (.55 + Math.sin(elapsed * 2.6 + side) * .2);
        ctx.fillStyle = '#ff2a3c';
        ctx.fillRect(p.x - ew / 2, ey, ew, Math.max(2, h * .02));
        const g2 = ctx.createRadialGradient(p.x, ey + 2, 1, p.x, ey + 2, ew * 1.6);
        g2.addColorStop(0, 'rgba(255,42,60,.5)'); g2.addColorStop(1, 'rgba(255,42,60,0)');
        ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(p.x, ey + 2, ew * 1.6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  // True-3D nave arcade: extruded marble columns march down the hall through
  // the shared camera, tied by gold arches. The dressed (near) rank hangs the
  // queen's velvet banners between arches and burns a torchère at every base.
  function drawPalaceNave(stage, z, alpha, dressed) {
    const q = bgQuality();
    const s = FOCAL / (FOCAL + z), gap = 330, t0 = elapsed * 96, colW = 54;
    const dim = 1 - palaceBossMix * .28;
    const crit = Math.min(1, bossCrit);
    const yBase = HORIZON_Y + 92 / s, yTop = yBase - 430;   // bases pinned to the y=652 marble edge
    const half = (VW / 2 + 170) / s;
    const k0 = Math.floor((VW / 2 - half + t0) / gap), k1 = Math.ceil((VW / 2 + half + t0) / gap);
    const spr = palaceColumnSprite();
    // gold arches spring between neighbouring capitals, behind the columns
    ctx.save(); ctx.globalAlpha = alpha * dim * .9;
    for (let k = k0; k < k1; k++) {
      const a = proj3(k * gap - t0 + colW / 2, yTop + 8, z);
      const b = proj3((k + 1) * gap - t0 + colW / 2, yTop + 8, z);
      if (Math.max(a.x, b.x) < -80 || Math.min(a.x, b.x) > VW + 80) continue;
      const apexY = Math.min(a.y, b.y) - 92 * s;
      ctx.strokeStyle = '#2b0a22'; ctx.lineWidth = 17 * s;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo((a.x + b.x) / 2, apexY, b.x, b.y); ctx.stroke();
      ctx.strokeStyle = faceLit('#c9a13b', 'top', crit * .4); ctx.lineWidth = 3.5 * s;
      ctx.beginPath(); ctx.moveTo(a.x, a.y - 5 * s); ctx.quadraticCurveTo((a.x + b.x) / 2, apexY - 5 * s, b.x, b.y - 5 * s); ctx.stroke();
    }
    ctx.restore();
    for (let k = k0; k <= k1; k++) {
      const wx = k * gap - t0;
      const r = boxZ(wx, wx + colW, yTop, yBase, z, z + 150, null, hexA('#0c020a', .9), null, alpha * dim);
      if (r.x > VW + 90 || r.x + r.w < -90) continue;
      ctx.save(); ctx.globalAlpha = alpha * dim;
      blit(spr, r.x, r.y, r.w, r.h);
      ctx.restore();
      if (dressed && q >= 1) {
        // velvet banner hanging from the arch midpoint, swaying gently
        const bp = proj3(wx + gap / 2 + colW / 2, yTop + 30, z);
        const bw = 96 * s, bh = 180 * s;
        ctx.save(); ctx.globalAlpha = alpha * (1 - palaceBossMix * .35);
        ctx.translate(bp.x, bp.y); ctx.rotate(Math.sin(elapsed * .7 + k * 1.9) * .05);
        blit(palaceBannerSprite(((k % 2) + 2) % 2), -bw / 2, 0, bw, bh);
        ctx.restore();
        // torchère at the column base; candles dim while the queen fights
        const fp = proj3(wx + colW / 2, yBase, z);
        const candleA = (1 - palaceBossMix * .45) * alpha;
        const flick = Math.sin(elapsed * 5.7 + k * 2.3) * 2 * s;
        ctx.save();
        ctx.fillStyle = '#8a6a1f'; ctx.fillRect(fp.x - 2 * s, fp.y - 46 * s, 4 * s, 46 * s);
        ctx.fillStyle = '#c9a13b'; ctx.fillRect(fp.x - 7 * s, fp.y - 52 * s, 14 * s, 7 * s);
        ctx.globalAlpha = candleA; ctx.fillStyle = '#ffd76a';
        ctx.beginPath(); ctx.ellipse(fp.x, fp.y - 58 * s + flick * .4, 4 * s, 9 * s + flick, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = candleA * .3;
        const g2 = ctx.createRadialGradient(fp.x, fp.y - 56 * s, 2, fp.x, fp.y - 56 * s, 44 * s);
        g2.addColorStop(0, '#ffd76a'); g2.addColorStop(1, 'rgba(255,150,60,0)');
        ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(fp.x, fp.y - 56 * s, 44 * s, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
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
      else if (a.kind === 'smoke') {
        // Backlit volumetric puff: dark two-lobe body with a thin hot rim on
        // the crescent that faces the low sun.
        const al = Math.max(0, Math.min(.22, a.life * .09));
        ctx.globalAlpha = al; ctx.fillStyle = '#3a2038';
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(a.x - a.r * .55, a.y + a.r * .4, a.r * .66, 0, Math.PI * 2); ctx.fill();
        const th = Math.atan2(468 - a.y, 640 - a.x);
        ctx.globalAlpha = al * 1.7; ctx.strokeStyle = 'rgba(255,170,80,.9)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r - 1, th - .95, th + .95); ctx.stroke();
      }
      else if (a.kind === 'spark') { ctx.globalAlpha = Math.max(0, Math.min(1, a.life * 1.6)); ctx.fillStyle = '#ffe15a'; ctx.fillRect(a.x, a.y, 4, 4); ctx.fillStyle = 'rgba(255,138,53,.6)'; ctx.fillRect(a.x - a.vx * .02, a.y - a.vy * .02, 3, 3); }
      else if (a.kind === 'rain') { ctx.globalAlpha = .32 + Math.min(1, lightning * 2.4) * .3; ctx.strokeStyle = '#9fe8d8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x + a.vx * .022, a.y + a.vy * .022); ctx.stroke(); }
      else if (a.kind === 'fwspark') {
        // Long-exposure-like streak, white-hot seed and irregular glitter.
        ctx.globalCompositeOperation = 'lighter';
        const fa = clamp(a.life / (a.max || 1), 0, 1) * (.72 + Math.sin(elapsed * 22 + a.x * .13) * .28);
        ctx.strokeStyle = a.color || '#ffe15a';
        // A broad translucent stroke supplies the glow without Canvas shadowBlur,
        // which was the main GPU/CPU stall when hundreds of sparks overlapped.
        ctx.globalAlpha = fa * .22; ctx.lineWidth = (a.size || 2) + 4;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x - a.vx * .065, a.y - a.vy * .065); ctx.stroke();
        ctx.globalAlpha = fa; ctx.lineWidth = a.size || 2;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x - a.vx * .065, a.y - a.vy * .065); ctx.stroke();
        ctx.globalAlpha = Math.min(1, fa * 1.25); ctx.fillStyle = '#fff';
        ctx.fillRect(a.x - 1, a.y - 1, 2, 2);
      }
      else if (a.kind === 'fwflash') {
        // The burst's initial bloom: one soft additive sphere that pops the
        // whole shell before the glitter takes over.
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.max(0, a.life / .3) * .8;
        const fg = ctx.createRadialGradient(a.x, a.y, 3, a.x, a.y, 70);
        fg.addColorStop(0, '#fff'); fg.addColorStop(.35, a.color || '#ffe15a'); fg.addColorStop(1, 'rgba(255,200,120,0)');
        ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(a.x, a.y, 70, 0, Math.PI * 2); ctx.fill();
      }
      else if (a.kind === 'fwsmoke') {
        // Two flat translucent lobes suggest lit smoke. Per-particle radial
        // gradients looked good but dominated frame time during the finale.
        const sa = clamp(a.life / (a.max || 2.8), 0, 1) * .16;
        ctx.globalAlpha = sa; ctx.fillStyle = '#b99ca8';
        ctx.beginPath(); ctx.arc(a.x - a.r * .18, a.y - a.r * .12, a.r * .72, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = sa * .55; ctx.fillStyle = '#40384f';
        ctx.beginPath(); ctx.arc(a.x + a.r * .24, a.y + a.r * .14, a.r, 0, Math.PI * 2); ctx.fill();
      }
      else if (a.kind === 'dust') {
        // Gold motes twinkling inside the god rays.
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.max(0, Math.min(.5, a.life * .14)) * (.6 + Math.sin(elapsed * 3 + a.x) * .4);
        ctx.fillStyle = '#ffe6a0'; ctx.fillRect(a.x, a.y, 2.5, 2.5);
      }
      else {
        // Petal-like tumbling hearts; they bruise dark red in the last act.
        ctx.globalAlpha = .28 + Math.sin(a.a) * .16;
        ctx.fillStyle = bossCrit > 0 ? '#c22a4e' : '#ff9ccf';
        ctx.translate(a.x, a.y); ctx.rotate(Math.sin(a.a * .7) * .5);
        heartPath(0, 0, a.s); ctx.fill();
      }
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
    // Aerial perspective, through the same fogMix model every other backdrop
    // layer already uses so the city agrees with them. `alpha` encodes how far
    // back a layer sits, so it maps straight onto a depth: distant blocks take
    // on the sky's colour and lose face-to-face contrast, which is what reads
    // as distance. Fading alone just makes them thin, not far away.
    const z = (1 - alpha) * 2000;
    const front = fogMix(color, z);
    const sideCol = fogMix(mixHex(color, '#000000', .42), z);
    const edge = fogMix(stage.accent, z * .5);
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
      // Lit windows. A single colour at one brightness reads as a printed
      // pattern; a real tower has most windows dark, the lit ones at scattered
      // brightnesses, and a minority burning warm incandescent among the neon.
      const cool = fogMix(i % 3 ? stage.accent : stage.accent2, z * .6);
      const warm = fogMix('#ffd79a', z * .6);
      for (let yy = topY + 14; yy < ground - 10; yy += 18) {
        for (let xx = x + 8; xx < x + w - 6; xx += 14) {
          const s = (xx * 7 + yy * 13 + i * 31) & 1023;
          if (s % 5 < 2) continue;                       // most panes are dark
          ctx.globalAlpha = alpha * (.42 + (s % 9) / 13);
          ctx.fillStyle = s % 13 === 0 ? warm : cool;
          ctx.fillRect(xx, yy, 4, 6);
        }
      }
      ctx.globalAlpha = alpha;
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
    } else if (boss.telType === 'curtain') {
      // Paint the danger, then outline the corridor in white — the player reads
      // "go between the lines" far faster than "avoid the shaded parts".
      const half = 112 * difficulties[difficultyKey].gapW;
      ctx.fillStyle = stages[stageIndex].accent2;
      ctx.fillRect(0, 40, VW, Math.max(0, boss.telY - half - 40));
      ctx.fillRect(0, boss.telY + half, VW, Math.max(0, 680 - (boss.telY + half)));
      ctx.globalAlpha = Math.min(1, p * 2.4); ctx.fillStyle = '#fff';
      ctx.fillRect(0, boss.telY - half, VW, 3); ctx.fillRect(0, boss.telY + half - 3, VW, 3);
    } else if (boss.telType === 'heatwall') {
      const half = 100 * difficulties[difficultyKey].gapW;
      ctx.fillStyle = '#ff8a35';
      ctx.fillRect(0, 300, Math.max(0, boss.telX - half), 380);
      ctx.fillRect(boss.telX + half, 300, Math.max(0, VW - (boss.telX + half)), 380);
      ctx.globalAlpha = Math.min(1, p * 2.4); ctx.fillStyle = '#fff';
      ctx.fillRect(boss.telX - half, 300, 3, 380); ctx.fillRect(boss.telX + half - 3, 300, 3, 380);
    } else {
      ctx.fillStyle = stages[stageIndex].accent2;
      ctx.beginPath(); ctx.arc(boss.x + boss.w / 2, boss.y + boss.h / 2, 130 + Math.sin(elapsed * 16) * 14, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // While the queen is away, the heart rain leaves one moving column open.
  function drawHideTelegraph() {
    const boss = enemies.find(e => e.type === 'boss');
    if (!boss || boss.mode !== 'hideAway') return;
    ctx.save();
    if (BOSS_HIDE[stageIndex].style === 'throne') {
      const safeX = VW * .35 + Math.sin(boss.t * 1.35) * VW * .26;
      const half = 95 * difficulties[difficultyKey].gapW;
      const g = ctx.createLinearGradient(safeX - half, 0, safeX + half, 0);
      g.addColorStop(0, hexA('#ffe15a', 0)); g.addColorStop(.5, hexA('#ffe15a', .22)); g.addColorStop(1, hexA('#ffe15a', 0));
      ctx.fillStyle = g; ctx.fillRect(safeX - half, 0, half * 2, VH);
      ctx.globalAlpha = .5; ctx.fillStyle = '#fff';
      ctx.fillRect(safeX - half, 0, 2, VH); ctx.fillRect(safeX + half - 2, 0, 2, VH);
    } else if (BOSS_HIDE[stageIndex].style === 'submerge' && boss.geyserT > 0) {
      ctx.globalAlpha = .2 + Math.abs(Math.sin(elapsed * 18)) * .2;
      ctx.fillStyle = '#c94cff'; ctx.fillRect(boss.geyserX - 32, 636, 64, 24);
    } else if (BOSS_HIDE[stageIndex].style === 'ascend') {
      // A shadow on the floor growing as the djinn falls from directly above.
      const k = 1 - clamp(boss.hideClock / BOSS_HIDE[2].away, 0, 1);
      ctx.globalAlpha = .18 + k * .3; ctx.fillStyle = '#1a0a06';
      ctx.beginPath(); ctx.ellipse(boss.telX || VW / 2, GROUND_Y + 130, 30 + k * 120, 16 + k * 30, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  const TEL_LABEL = {
    curtain: '鏡のカーテン', heatwall: 'ヒートウォール', flood: 'データ・フラッド',
    railgun: 'チャージ・レールガン', cannon: 'ハートブレイク・キャノン', lattice: 'ローズ・ラティス',
    pillar: '火柱', strike: '雷撃', dash: '突進', wave: '波', fan: '扇', ring: 'リング',
    crossbeam: 'クロスシザー', heatbeam: 'ヒートプレス', claw: '深淵の爪',
    abyssorb: 'アビス・オーブ', tailslam: '深海テールクラッシュ',
  };

  // Drawn over the boss rather than under it: a charge orb at the muzzle, rings
  // collapsing into it, a countdown arc, and the attack's name.
  function drawBossTelegraphOverlay() {
    const boss = enemies.find(e => e.type === 'boss' && e.tel > 0 && e.telType);
    if (!boss) return;
    const tp = clamp(1 - boss.tel / (boss.telMax || 1), 0, 1);
    const mx = stageIndex === 4 ? boss.x + boss.w * .27 : boss.x + 40;
    const my = stageIndex === 4 ? boss.y + boss.h * .36 : boss.y + boss.h * .42;
    const col = BOSS_TINT[stageIndex].hit;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const r = 8 + tp * tp * 62;
    const g = ctx.createRadialGradient(mx, my, 1, mx, my, r * 1.9);
    g.addColorStop(0, 'rgba(255,255,255,.98)'); g.addColorStop(.3, hexA(col, .85)); g.addColorStop(1, hexA(col, 0));
    ctx.fillStyle = g;
    if (stageIndex === 4) { heartPath(mx, my, r * 1.4); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(mx, my, r * 1.9, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const k = (tp * 2.2 + i / 3) % 1;
      ctx.globalAlpha = (1 - k) * .8;
      ctx.beginPath(); ctx.arc(mx, my, r + (1 - k) * 180, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
    ctx.save(); ctx.globalAlpha = .55; ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(boss.x + boss.w / 2, boss.y + boss.h / 2, 96, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * tp); ctx.stroke();
    ctx.restore();
    if (tp > .35 && TEL_LABEL[boss.telType]) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (tp - .35) * 3) * (.7 + Math.sin(elapsed * 14) * .3);
      ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
      ctx.font = '20px "DotGothic16", monospace';
      ctx.fillText(TEL_LABEL[boss.telType], VW / 2, 116);
      ctx.restore(); ctx.textAlign = 'left';
    }
  }

  // Hazard telegraph: a thin sight line that swells toward full thickness, then
  // snaps bright white the moment the angle locks. Drawn under every actor.
  function drawHazardWarnings() {
    for (const hz of hazards) {
      if (hz.t >= hz.warn) continue;
      const k = clamp(hz.t / Math.max(.01, hz.warn), 0, 1);
      const locked = hz.t > hz.warn - hz.lock;
      ctx.save(); ctx.translate(hz.x, hz.y); if (hz.ang) ctx.rotate(hz.ang);
      ctx.globalAlpha = (locked ? .34 : .16) + Math.abs(Math.sin(elapsed * (locked ? 30 : 14))) * .14;
      ctx.fillStyle = hz.color; ctx.fillRect(0, -hz.h / 2 * k, hz.w, hz.h * k);
      ctx.globalAlpha = locked ? .9 : .5; ctx.fillStyle = '#fff'; ctx.fillRect(0, -1.5, hz.w, 3);
      ctx.restore();
    }
  }

  // Hazard body: layered gradients rather than shadowBlur, matching how the
  // rest of the game fakes light. Chevrons streaming along the beam sell speed.
  function drawHazards() {
    for (const hz of hazards) {
      const el = hz.t - hz.warn;
      if (el < 0) continue;
      const a = el < hz.live ? 1 : Math.max(0, 1 - (el - hz.live) / hz.fade);
      if (a <= 0) continue;
      ctx.save(); ctx.translate(hz.x, hz.y); if (hz.ang) ctx.rotate(hz.ang);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
      const bg = ctx.createLinearGradient(0, -hz.h * 1.2, 0, hz.h * 1.2);
      bg.addColorStop(0, hexA(hz.color, 0)); bg.addColorStop(.5, hexA(hz.color, .30)); bg.addColorStop(1, hexA(hz.color, 0));
      ctx.fillStyle = bg; ctx.fillRect(0, -hz.h * 1.2, hz.w, hz.h * 2.4);
      const g = ctx.createLinearGradient(0, -hz.h / 2, 0, hz.h / 2);
      g.addColorStop(0, hexA(hz.color, 0)); g.addColorStop(.5, hz.color); g.addColorStop(1, hexA(hz.color, 0));
      ctx.fillStyle = g; ctx.fillRect(0, -hz.h / 2, hz.w, hz.h);
      ctx.fillStyle = `rgba(255,255,255,${.85 * a})`; ctx.fillRect(0, -hz.h * .13, hz.w, hz.h * .26);
      ctx.globalAlpha = a * .5; ctx.fillStyle = '#fff';
      const off = (elapsed * 900) % 64;
      for (let d = -64; d < hz.w; d += 64) {
        ctx.beginPath(); ctx.moveTo(d + off, -hz.h * .4); ctx.lineTo(d + off + 22, 0);
        ctx.lineTo(d + off, hz.h * .4); ctx.lineTo(d + off + 9, 0); ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = a;
      const mz = ctx.createRadialGradient(0, 0, 2, 0, 0, hz.h * 1.7);
      mz.addColorStop(0, 'rgba(255,255,255,.95)'); mz.addColorStop(.4, hexA(hz.color, .6)); mz.addColorStop(1, hexA(hz.color, 0));
      ctx.fillStyle = mz; ctx.beginPath(); ctx.arc(0, 0, hz.h * 1.7, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }

  // The queen's skirt hanging over the field while she is aloft. Drawn under
  // every actor so it darkens the stage rather than hiding the fight.
  function drawThroneShadow() {
    const boss = enemies.find(e => e.type === 'boss');
    if (stageIndex !== 4 || !boss || !boss.mode || !boss.mode.startsWith('hide')) return;
    const rise = clamp((90 - boss.y) / 700, 0, 1);
    if (rise <= 0) return;
    ctx.save();
    heartPath(VW * .72, -140 + rise * .55 * VH, 520);
    ctx.fillStyle = 'rgba(20,2,14,.62)'; ctx.fill();
    ctx.restore();
  }

  function drawGame() {
    drawThroneShadow();
    drawBossTelegraph();
    drawHideTelegraph();
    drawHazardWarnings();
    for (const p of pickups) drawPickup(p);
    ctx.globalCompositeOperation = 'lighter';
    for (const b of bullets) drawPlayerBullet(b);
    ctx.globalCompositeOperation = 'source-over';
    for (const b of enemyBullets) drawEnemyBullet(b);
    drawHazards();
    for (const r of shockwaves) {
      ctx.save(); ctx.globalAlpha = Math.max(0, r.life / r.max); ctx.strokeStyle = r.color; ctx.lineWidth = 5 + r.life * 8; ctx.shadowColor = r.color; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    for (const e of enemies) drawEnemy(e);
    drawBossTelegraphOverlay();
    if (state === 'playing' || state === 'over' || (state === 'menu' && menuStep === 'title')) drawPlayer();
    // Additive blending makes overlapping sparks glow white-hot like real light.
    ctx.globalCompositeOperation = 'lighter';
    for (const p of particles) {
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a; ctx.fillStyle = p.color;
      if (p.shape === 'shard') {
        // Angular chunk of debris tumbling as it flies, instead of a soft glow blob.
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0);
        ctx.fillRect(-p.size * .5, -p.size * .22, p.size, p.size * .44);
        ctx.restore();
      } else {
        const s = Math.ceil(p.size); ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s);
        if (p.size > 4) { ctx.globalAlpha = a * .4; ctx.fillRect(Math.round(p.x) - 2, Math.round(p.y) - 2, s + 4, s + 4); }
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    drawVignette();
    if (specialFlash > 0) {
      const sg = ctx.createRadialGradient(player.x + 55, player.y + 52, 20, player.x + 55, player.y + 52, 760);
      sg.addColorStop(0, `rgba(255,255,255,${specialFlash * .52})`); sg.addColorStop(.35, `rgba(255,225,90,${specialFlash * .25})`); sg.addColorStop(1, 'rgba(255,62,157,0)');
      ctx.fillStyle = sg; ctx.fillRect(0, 0, VW, VH);
    }
    if (flash > 0) { ctx.globalAlpha = flash * .45; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1; }
  }

  // On-screen draw boxes for Gro-chan, one entry per sprite sheet. The three
  // sheets were authored independently, so their cells do NOT share a character
  // scale: drawn at their old sizes the flight pose came out ~11% smaller than
  // the walk pose and the airborne damage frame ~17% smaller than the grounded
  // one — the same girl visibly shrank the instant she left the floor.
  //
  // Every box below is now scaled so the *head* matches the ground sheet (the
  // scale reference, since it owns idle + walk), and each keeps its cell's own
  // aspect so nothing is squashed. `ox`/`oy` are offsets from player.x/player.y
  // chosen to hold the body centre still, so switching sheets never jumps.
  const PLAYER_DRAW = {
    ground: { ox: -30, oy: -24, w: 177, h: 183 },   // 298×308 cell, the reference
    fly: { ox: -22, oy: -31, w: 150, h: 185 },      // 248×305 cell (was 132×167)
    jump: { ox: -19, oy: -33, w: 145, h: 189 },     // 250×325 cell (was 128×175)
    hurtGround: { ox: -30, oy: -24, w: 177, h: 183 },
    hurtAir: { ox: -35, oy: -30, w: 177, h: 183 },  // was 147×152 — the big offender
  };

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
      const tx = player.x + 16, ty = player.y + 80 + bob;
      const th = ctx.createRadialGradient(tx, ty, 2, tx, ty, 42);
      th.addColorStop(0, hexA('#8ffcff', .8 * flick)); th.addColorStop(.5, hexA('#31e8ff', .32 * flick)); th.addColorStop(1, 'rgba(49,232,255,0)');
      ctx.fillStyle = th; ctx.beginPath(); ctx.ellipse(tx - 10, ty, 40 * flick, 15, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(49,232,255,.18)'; ctx.beginPath(); ctx.ellipse(player.x + 56, player.y + (player.grounded ? 155 : 100), 54, 11, 0, 0, Math.PI * 2); ctx.fill();
    // Mirror the sprite horizontally when retreating (facing left). Pivot on the
    // visual center so the flip stays put; shadow/thruster above are left un-mirrored.
    ctx.save();
    if (player.facing === -1) { const pivot = player.x + 56; ctx.translate(pivot, 0); ctx.scale(-1, 1); ctx.translate(-pivot, 0); }
    if (player.hit > 0 && hurtFrames.length) {
      // Damage/hurt: play the 4-frame knock-around animation once over HURT_DUR. Cells are
      // uniform and ground-aligned, so drawn size is constant in BOTH states now; only the
      // anchor moves — feet on the floor when grounded, tucked up a touch while airborne.
      const HURT_DUR = .45;
      const hf = bikiniOn() && bikiniHurt.length ? bikiniHurt : hurtFrames;
      const idx = Math.max(0, Math.min(hf.length - 1,
        Math.floor((1 - player.hit / HURT_DUR) * hf.length)));
      const d = player.grounded ? PLAYER_DRAW.hurtGround : PLAYER_DRAW.hurtAir;
      ctx.drawImage(hf[idx], player.x + d.ox, player.y + d.oy + (player.grounded ? 0 : bob), d.w, d.h);
    } else if (player.takeoff > 0 && (bikiniOn() && bikiniJump ? bikiniJump : jumpFrame)) {
      // Jump / takeoff cell from the sheet.
      const d = PLAYER_DRAW.jump;
      ctx.drawImage(bikiniOn() && bikiniJump ? bikiniJump : jumpFrame, player.x + d.ox, player.y + d.oy + bob, d.w, d.h);
    } else if (player.grounded && (bikiniOn() && bikiniGround.length ? bikiniGround : groundFrames).length) {
      // Ground: distance-synchronised frames plus a small body lift make each
      // planted step read clearly. Shooting alone does not fake a walk cycle.
      const gf = bikiniOn() && bikiniGround.length ? bikiniGround : groundFrames;
      const walking = Math.abs(player.vx) > 24;
      const walkLift = walking ? Math.abs(Math.sin(player.walkPhase * Math.PI / 2)) * 3 : 0;
      const frame = walking
        ? gf[1 + (Math.floor(player.walkPhase) % 4)]
        : gf[0];
      if (walking && Math.abs(player.vx) > 110) {
        const dir = Math.sign(player.vx);
        ctx.save();
        ctx.globalAlpha *= .35; ctx.strokeStyle = '#8ffcff'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        for (let i = 0; i < 2; i++) {
          const sx = player.x + 55 - dir * (48 + i * 16);
          const sy = player.y + 137 + i * 10;
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - dir * (18 + i * 8), sy); ctx.stroke();
        }
        ctx.restore();
      }
      const dg = PLAYER_DRAW.ground;
      ctx.drawImage(frame, player.x + dg.ox, player.y + dg.oy - walkLift, dg.w, dg.h);
    } else if ((bikiniOn() && bikiniFly.length ? bikiniFly : spriteFrames).length) {
      const ff = bikiniOn() && bikiniFly.length ? bikiniFly : spriteFrames;
      const frame = ff[Math.floor(player.frame) % ff.length];
      const d = PLAYER_DRAW.fly;
      ctx.drawImage(frame, player.x + d.ox, player.y + d.oy + bob, d.w, d.h);
    } else {
      ctx.fillStyle = '#ff3e9d'; ctx.fillRect(player.x + 20, player.y + 20, 70, 65);
    }
    ctx.restore();
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
    if (b.pierce) {
      // ハートウェーブ: hue-cycling giant heart with an additive halo and a
      // white core so it still reads as friendly fire.
      const hue = ((b.hue || 0) + elapsed * 300) % 360;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `hsla(${hue},100%,70%,.25)`;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `hsla(${(hue + 120) % 360},100%,70%,.14)`;
      ctx.beginPath(); ctx.arc(b.x - b.r * 1.3, b.y, b.r + 6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.save();
      const pulse = 1 + Math.sin(elapsed * 10 + (b.hue || 0)) * .08;
      ctx.translate(b.x, b.y); ctx.scale(pulse, pulse);
      ctx.fillStyle = `hsl(${hue},100%,62%)`; heartPath(0, 2, b.r); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.9)'; heartPath(-b.r * .12, -b.r * .1, b.r * .44); ctx.fill();
      ctx.restore();
      return;
    }
    if (b.spark) {
      // スパークライザー: crackling green volt bolt (player-side flavor).
      b.seed ??= Math.floor(Math.random() * 1000);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(114,255,104,.35)'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#d6ffd0'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
      const t0 = elapsed * 11 + b.seed;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const ang = t0 + i * Math.PI / 2, rr = b.r + 3 + Math.abs(Math.sin(t0 * 1.7 + i)) * 6;
        ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + Math.cos(ang) * rr, b.y + Math.sin(ang) * rr);
      }
      ctx.stroke();
      ctx.fillStyle = '#f2fff0'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * .6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      return;
    }
    if (b.pea) {
      // Empty-mag fallback pellet: small, pale, short tail — visibly weaker.
      ctx.fillStyle = 'rgba(201,214,236,.3)';
      ctx.beginPath(); ctx.moveTo(b.x - 16, b.y); ctx.lineTo(b.x + 3, b.y - size * .7); ctx.lineTo(b.x + 3, b.y + size * .7); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#c9d6ec'; ctx.beginPath(); ctx.arc(b.x + 3, b.y, size, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.x + 4, b.y - 1, size * .45, 0, Math.PI * 2); ctx.fill();
      return;
    }
    // Velocity-oriented three-layer comet trail (pink → yellow → white) + star head.
    const a = Math.atan2(b.vy || 0, b.vx || 1);
    const spd = Math.hypot(b.vx || 0, b.vy || 0) || 600;
    const len = 22 + spd * .028 + b.damage * 4;
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(a);
    ctx.fillStyle = 'rgba(255,62,157,.22)';
    ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(7, -size); ctx.lineTo(7, size); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,225,90,.5)';
    ctx.beginPath(); ctx.moveTo(-len * .58, 0); ctx.lineTo(9, -size * .62); ctx.lineTo(9, size * .62); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.beginPath(); ctx.moveTo(-len * .3, 0); ctx.lineTo(10, -size * .34); ctx.lineTo(10, size * .34); ctx.closePath(); ctx.fill();
    if (b.damage >= 3) {
      // Max power: hue-cycling rainbow orb. The white core and the directional
      // comet tail stay — they're what keeps friendly fire unmistakable.
      const hue = ((b.hue || 0) + elapsed * 420) % 360;
      ctx.fillStyle = `hsla(${hue},100%,70%,.3)`;
      ctx.beginPath(); ctx.arc(8, 0, size * 1.15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `hsl(${hue},100%,64%)`;
    } else {
      ctx.fillStyle = '#ffe15a';
    }
    ctx.beginPath(); ctx.arc(8, 0, size * .72, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(9, 0, size * .34, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawEnemyBullet(b) {
    if (b.abyss) {
      const pulse = 1 + Math.sin(elapsed * 12 + b.x * .03) * .1;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const glow = ctx.createRadialGradient(b.x, b.y, 1, b.x, b.y, b.r * 2.3);
      glow.addColorStop(0, '#ffffff'); glow.addColorStop(.2, '#f2b6ff'); glow.addColorStop(.55, 'rgba(201,76,255,.72)'); glow.addColorStop(1, 'rgba(113,25,181,0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 2.3 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#f19cff'; ctx.lineWidth = b.giant ? 4 : 2;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (1.25 + .14 * Math.sin(elapsed * 8)), elapsed * 2, elapsed * 2 + Math.PI * 1.55); ctx.stroke();
      ctx.restore(); return;
    }
    if (b.claw) {
      const a = Math.atan2(b.vy || 0, b.vx || -1);
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(a); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = '#f29aff'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath(); ctx.arc(0, i * 8, b.r * 1.35, -.78, .78); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(201,76,255,.42)'; ctx.lineWidth = 11;
      ctx.beginPath(); ctx.arc(0, 0, b.r * 1.55, -.72, .72); ctx.stroke();
      ctx.restore(); return;
    }
    if (b.rock) {
      b.seed ??= Math.floor(Math.random() * 1000);
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(elapsed * 3 + b.seed);
      ctx.fillStyle = '#3d3348'; ctx.strokeStyle = '#c94cff'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * Math.PI * 2, rr = b.r * (.72 + ((b.seed + i * 37) % 30) / 100);
        ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#786785'; ctx.beginPath(); ctx.arc(-b.r * .2, -b.r * .25, b.r * .22, 0, Math.PI * 2); ctx.fill();
      ctx.restore(); return;
    }
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
    if (b.ink) {
      // Cephalopod ink: a ragged, slowly-swelling blot rather than a clean orb.
      b.seed ??= Math.floor(Math.random() * 1000);
      const grow = 1 + (1 - Math.min(1, b.life / 4)) * .5;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.seed * .01 + elapsed * .5);
      ctx.fillStyle = 'rgba(24,6,34,.32)';
      ctx.beginPath(); ctx.arc(0, 0, (b.r + 9) * grow, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2a0a3a'; ctx.beginPath();
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * Math.PI * 2;
        const rr = b.r * grow * (.78 + ((b.seed + i * 61) % 40) / 100);
        ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath(); ctx.fill();
      // Ink is nearly the colour of the water it hangs in, so it gets a lit rim
      // — otherwise a lethal blot is invisible against the AQUA HIGHWAY blues.
      ctx.strokeStyle = 'rgba(214,130,255,.85)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(198,120,224,.55)'; ctx.beginPath(); ctx.arc(-b.r * .3, -b.r * .3, b.r * .3, 0, Math.PI * 2); ctx.fill();
      ctx.restore(); return;
    }
    if (b.lure) {
      // Bioluminescent bait shed by the anglerfish — cold light, no tail.
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const p = .7 + Math.sin(elapsed * 11 + b.x * .05) * .3;
      const g = ctx.createRadialGradient(b.x, b.y, 1, b.x, b.y, b.r + 14);
      g.addColorStop(0, hexA('#f2ffff', .95)); g.addColorStop(.3, hexA('#65fff2', .6 * p)); g.addColorStop(1, 'rgba(101,255,242,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * .5, 0, Math.PI * 2); ctx.fill();
      ctx.restore(); return;
    }
    if (b.fire) {
      ctx.save(); ctx.globalAlpha = .3; ctx.fillStyle = '#ff8a35'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 8, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1; ctx.fillStyle = '#ff5a36'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe15a'; ctx.beginPath(); ctx.arc(b.x - b.vx * .008, b.y - b.vy * .008, b.r * .5, 0, Math.PI * 2); ctx.fill(); ctx.restore(); return;
    }
    if (b.volt) {
      b.seed ??= Math.floor(Math.random() * 1000);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(114,255,104,.4)'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 7, 0, Math.PI * 2); ctx.fill();
      // Crackling electric spark: jittering spikes around a bright core.
      ctx.strokeStyle = '#d6ffd0'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      const t0 = elapsed * 9 + b.seed;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const ang = t0 + i * Math.PI / 2, r = b.r + 2 + Math.abs(Math.sin(t0 * 1.7 + i)) * 5;
        ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + Math.cos(ang) * r, b.y + Math.sin(ang) * r);
      }
      ctx.stroke();
      ctx.fillStyle = '#eaffea'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * .62, 0, Math.PI * 2); ctx.fill();
      ctx.restore(); return;
    }
    // Default orb with a comet tail trailing opposite its travel.
    const a = Math.atan2(b.vy || 0, b.vx || -1);
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(a);
    ctx.fillStyle = 'rgba(255,62,157,.28)';
    ctx.beginPath(); ctx.moveTo(-b.r * 3.4, 0); ctx.lineTo(b.r * .6, -b.r); ctx.lineTo(b.r * .6, b.r); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,62,157,.25)'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff3e9d'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd7ea'; ctx.beginPath(); ctx.arc(b.x - b.r * .3, b.y - b.r * .3, b.r * .42, 0, Math.PI * 2); ctx.fill();
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
    g.addColorStop(0, enemyTopColor(front)); g.addColorStop(.4, front); g.addColorStop(1, enemySideColor(front));
    rctx.fillStyle = g; rctx.fillRect(x, y, w, h);
    // Plastic gloss across the upper face + crisp top rim → reads as a lit volume.
    const gl = rctx.createLinearGradient(x, y, x, y + h * .58);
    gl.addColorStop(0, 'rgba(255,255,255,.3)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
    rctx.fillStyle = gl; rctx.fillRect(x + 2, y + 1, w - 4, h * .5);
    rctx.fillStyle = 'rgba(255,255,255,.4)'; rctx.fillRect(x + 2, y, w - 4, 1.5);
    rctx.fillStyle = 'rgba(255,255,255,.16)'; rctx.fillRect(x, y, 2, h);          // left rim
    const sh = Math.max(3, h * .18);
    rctx.fillStyle = 'rgba(0,0,0,.16)'; rctx.fillRect(x, y + h - sh, w, sh);       // grounded shade
  }
  function drawCylinder3D(x, y, w, h, front) {
    const g = rctx.createLinearGradient(x, y, x + w, y);
    g.addColorStop(0, enemySideColor(front)); g.addColorStop(.2, enemyTopColor(front)); g.addColorStop(.5, front); g.addColorStop(.8, enemySideColor(front)); g.addColorStop(1, shade(front, .32));
    rctx.fillStyle = g; rctx.fillRect(x, y, w, h);
    rctx.fillStyle = hexA('#ffffff', .32); rctx.fillRect(x + w * .16, y + 1, w * .12, h - 2);
    rctx.fillStyle = hexA('#ffffff', .12); rctx.fillRect(x + w * .42, y + 1, w * .08, h - 2);
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
    // Async blink: phase is seeded from eye position so different enemies/spots
    // blink out of sync without needing any per-enemy timer state.
    const seed = (x1 * 12.9898 + x2 * 78.233) % 6.28;
    if (((elapsed * .6 + seed) % 3.4) < .1) {
      rctx.strokeStyle = '#120b2e'; rctx.lineWidth = Math.max(2, s * .22); rctx.lineCap = 'round';
      rctx.beginPath(); rctx.moveTo(x1, y + s * .5); rctx.lineTo(x1 + s, y + s * .5);
      rctx.moveTo(x2, y + s * .5); rctx.lineTo(x2 + s, y + s * .5); rctx.stroke();
      return;
    }
    rctx.fillStyle = '#120b2e'; rctx.fillRect(x1, y, s, s); rctx.fillRect(x2, y, s, s);
    rctx.fillStyle = '#fff'; rctx.fillRect(x1 + 2, y + 1, pupil, pupil); rctx.fillRect(x2 + 2, y + 1, pupil, pupil);
  }
  // Single round eye for the sea-life enemies. Fish are drawn in profile, so the
  // paired square eyes of drawKawaiiEyes read as a face where an animal has a
  // head — this keeps the kawaii glint and the blink, on real fish anatomy
  // (dark sclera ring, wet highlight, a pupil that tracks Gro-chan).
  function drawFishEye(cx, cy, r, e) {
    const seed = (cx * 12.9898 + cy * 78.233) % 6.28;
    if (((elapsed * .6 + seed) % 3.9) < .1) {
      rctx.strokeStyle = '#0a0a14'; rctx.lineWidth = Math.max(2, r * .45); rctx.lineCap = 'round';
      rctx.beginPath(); rctx.moveTo(cx - r, cy); rctx.lineTo(cx + r, cy); rctx.stroke();
      return;
    }
    rctx.fillStyle = '#f4f8ff'; rctx.beginPath(); rctx.arc(cx, cy, r, 0, Math.PI * 2); rctx.fill();
    rctx.fillStyle = 'rgba(20,18,40,.35)'; rctx.beginPath(); rctx.arc(cx, cy, r, Math.PI, Math.PI * 2); rctx.fill();
    // Pupil drifts toward the player — a whole shoal glancing at Gro-chan.
    const dx = clamp(((player.x + 56) - ((e?.x || 0) + cx)) * .004, -1, 1);
    const dy = clamp(((player.y + 60) - ((e?.y || 0) + cy)) * .004, -1, 1);
    rctx.fillStyle = '#0d0b1c';
    rctx.beginPath(); rctx.arc(cx + dx * r * .3, cy + dy * r * .3, r * .55, 0, Math.PI * 2); rctx.fill();
    rctx.fillStyle = 'rgba(255,255,255,.92)';
    rctx.beginPath(); rctx.arc(cx - r * .3, cy - r * .35, r * .26, 0, Math.PI * 2); rctx.fill();
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

  // Decoy copies of MASQUERADE: flat single-colour silhouettes so the real one
  // is tellable at a glance once it returns, but only at a glance.
  function drawMirage(e) {
    const sprite = frameReady(bossSets[0].idle[0]) ? bossSets[0].idle[0] : bossSprites[0];
    ctx.globalAlpha = (ctx.globalAlpha || 1) * (.42 + Math.sin(elapsed * 6 + e.y) * .12);
    if (frameReady(sprite)) {
      const px = e.h / sprite.naturalHeight;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tintSprite(sprite, stages[0].accent), 0, 0, sprite.naturalWidth * px, e.h);
    } else {
      ctx.fillStyle = stages[0].accent;
      ctx.beginPath(); ctx.roundRect(e.w * .2, e.h * .1, e.w * .6, e.h * .8, 30); ctx.fill();
    }
  }

  // The queen's consorts: small beating hearts on an orbit.
  function drawConsort(e) {
    const pulse = 1 + Math.sin(e.t * 8) * .08;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(e.w / 2, e.h / 2, 2, e.w / 2, e.h / 2, e.w * .8);
    g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(.4, hexA('#ff3e9d', .7)); g.addColorStop(1, hexA('#ff3e9d', 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.w / 2, e.h / 2, e.w * .8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = e.hit > 0 ? '#fff' : '#ff3e9d';
    heartPath(e.w / 2, e.h / 2, e.w * .34 * pulse); ctx.fill();
    ctx.fillStyle = '#ffd7ea';
    heartPath(e.w / 2 - 3, e.h / 2 - 4, e.w * .12); ctx.fill();
  }

  // Destructible wall cell, drawn in local (0,0)-(w,h) space. One themed face
  // per stage; damage reads as two stages of procedural cracks.
  function drawBlock(e) {
    const stage = stages[stageIndex];
    const theme = stage.theme, w = e.w, h = e.h;
    const flash = e.hit > 0 ? Math.min(1, e.hit * 6) : 0;
    ctx.save();
    if (theme === 'neon') {
      // ビル看板ブロック: dark tower chunk with a glowing ad panel.
      drawBox3D(0, 4, w - 8, h - 8, '#241a57', 8);
      ctx.fillStyle = '#08051d'; ctx.fillRect(10, 16, w - 28, h - 34);
      ctx.strokeStyle = stage.accent; ctx.lineWidth = 2.5; ctx.strokeRect(10, 16, w - 28, h - 34);
      ctx.fillStyle = hexA(stage.accent2, .85); ctx.font = '17px "DotGothic16", monospace'; ctx.textAlign = 'center';
      ctx.fillText(e.seed % 2 ? '危' : '止', 10 + (w - 28) / 2, 16 + (h - 34) / 2 + 7);
      ctx.textAlign = 'left';
    } else if (theme === 'aqua') {
      // 錆コンテナ: corrugated shipping box with rivets.
      drawBox3D(0, 4, w - 8, h - 8, '#8f4a2c', 8);
      ctx.globalAlpha = .4; ctx.fillStyle = '#3a1c10';
      for (let x = 10; x < w - 14; x += 12) ctx.fillRect(x, 10, 4, h - 20);
      ctx.globalAlpha = 1; ctx.fillStyle = '#d8b08a';
      for (const [rx, ry] of [[8, 10], [w - 16, 10], [8, h - 18], [w - 16, h - 18]]) { ctx.beginPath(); ctx.arc(rx, ry, 2.5, 0, Math.PI * 2); ctx.fill(); }
    } else if (theme === 'factory') {
      // 耐熱ブロック: dark slab with molten seams.
      drawBox3D(0, 4, w - 8, h - 8, '#3a1626', 8);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = hexA('#ff8a35', .5 + Math.sin(elapsed * 3 + e.seed) * .25); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(8, h * .38); ctx.lineTo(w * .4, h * .46); ctx.lineTo(w * .55, h * .3); ctx.lineTo(w - 12, h * .4); ctx.stroke();
      ctx.restore();
    } else if (theme === 'storm') {
      // データキューブ: wireframe cube with a scrolling glyph column.
      drawBox3D(0, 4, w - 8, h - 8, '#062019', 8);
      ctx.strokeStyle = hexA(stage.accent, .7); ctx.lineWidth = 2; ctx.strokeRect(6, 10, w - 20, h - 20);
      ctx.fillStyle = stage.accent;
      const off = Math.floor(elapsed * 6 + e.seed) % 4;
      for (let i = 0; i < 4; i++) ctx.globalAlpha = i === off ? .9 : .3, ctx.fillRect(w / 2 - 4, 16 + i * 16, 8, 10);
      ctx.globalAlpha = 1;
    } else {
      // 薔薇レンガ: velvet-toned brick with a gold-heart inlay.
      drawBox3D(0, 4, w - 8, h - 8, '#5b123d', 8);
      ctx.strokeStyle = 'rgba(255,225,90,.4)'; ctx.lineWidth = 2;
      ctx.strokeRect(8, 12, w - 24, h - 24);
      ctx.fillStyle = '#ffe15a'; heartPath(w / 2 - 4, h / 2, 11); ctx.fill();
    }
    // Damage cracks: two stages keyed to remaining HP.
    const ratio = e.hp / e.maxHp;
    if (ratio < .7) {
      ctx.strokeStyle = 'rgba(10,6,20,.75)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(w * .3, 8); ctx.lineTo(w * .42, h * .34); ctx.lineTo(w * .28, h * .58); ctx.stroke();
      if (ratio < .35) {
        ctx.beginPath(); ctx.moveTo(w * .72, h * .2); ctx.lineTo(w * .58, h * .5); ctx.lineTo(w * .74, h * .82); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(w * .42, h * .34); ctx.lineTo(w * .66, h * .4); ctx.stroke();
      }
    }
    if (flash > 0) { ctx.globalAlpha = flash * .5; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w - 4, h); }
    ctx.restore();
  }

  // Hand-authored silhouettes for the four non-aqua stage rosters.  Each one
  // has a readable locomotion loop and a visible source for its projectile;
  // this keeps them feeling like characters rather than palette-swapped guns.
  function drawSignatureEnemy(e) {
    if (e.type === 'crow') {
      const flap = Math.sin(e.t * 11), tail = Math.sin(e.t * 4) * 3;
      // Wing undersides first. Six separate primaries flex from a shared wrist,
      // so the bird reads as feathers and joints rather than two black triangles.
      ctx.fillStyle = '#120b2a';
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(38, 27); ctx.quadraticCurveTo(40 + s * 25, 17 - flap * s * 13, 39 + s * 37, 6 - flap * s * 17);
        ctx.quadraticCurveTo(44 + s * 22, 34, 38, 40); ctx.closePath(); ctx.fill();
        const primaryCount = [3, 5, 6][bgQuality()];
        for (let i = 0; i < primaryCount; i++) {
          const rootX = 39 + s * (8 + i * 3), rootY = 25 - flap * s * (3 + i), len = 20 + i * 3;
          const feather = ctx.createLinearGradient(rootX, rootY, rootX + s * len, rootY - 12);
          feather.addColorStop(0, '#3a2a67'); feather.addColorStop(.5, i % 2 ? '#20183f' : '#2d2053'); feather.addColorStop(1, '#090719');
          ctx.strokeStyle = feather; ctx.lineWidth = 6 - i * .45; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(rootX, rootY); ctx.quadraticCurveTo(rootX + s * len * .55, rootY - flap * s * 8, rootX + s * len, rootY - 10 - flap * s * 7); ctx.stroke();
        }
      }
      const body = ctx.createRadialGradient(28, 18, 2, 42, 31, 31);
      body.addColorStop(0, '#7864ad'); body.addColorStop(.35, '#30265e'); body.addColorStop(1, '#0b0920');
      ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(42, 31, 25, 18, -.12, 0, Math.PI * 2); ctx.fill();
      // Breast contour feathers overlap like scales and catch the Tokyo neon.
      ctx.strokeStyle = 'rgba(177,139,235,.32)'; ctx.lineWidth = 1.4;
      for (let row = 0; row < 3; row++) for (let i = 0; i < 4 - row; i++) {
        const fx = 32 + i * 8 + row * 4, fy = 29 + row * 6;
        ctx.beginPath(); ctx.arc(fx, fy, 5, .1, Math.PI - .1); ctx.stroke();
      }
      ctx.fillStyle = '#16102f';
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(59, 30 + i * 3); ctx.lineTo(76 + i * 2, 18 + i * 8 + tail); ctx.lineTo(62, 40); ctx.closePath(); ctx.fill(); }
      // Head, throat hackles and a two-piece beak with an actual gape.
      ctx.fillStyle = '#21183e'; ctx.beginPath(); ctx.arc(24, 29, 15, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(24, 38); ctx.lineTo(34, 47); ctx.lineTo(40, 36); ctx.closePath(); ctx.fill();
      const beak = ctx.createLinearGradient(2, 29, 20, 39); beak.addColorStop(0, '#ff92c8'); beak.addColorStop(.55, '#c53379'); beak.addColorStop(1, '#58143e');
      ctx.fillStyle = beak; ctx.beginPath(); ctx.moveTo(16, 27); ctx.lineTo(-2, 34); ctx.lineTo(17, 36); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#1a0921'; ctx.beginPath(); ctx.moveTo(16, 36); ctx.lineTo(1, 36); ctx.lineTo(18, 41); ctx.closePath(); ctx.fill();
      // Legs tuck under flight posture; silver tag marks this urban flock.
      ctx.strokeStyle = '#9b5794'; ctx.lineWidth = 2.5; for (const x of [39,49]) { ctx.beginPath(); ctx.moveTo(x, 43); ctx.lineTo(x - 2, 50); ctx.lineTo(x - 8, 52); ctx.stroke(); }
      ctx.fillStyle = '#31e8ff'; ctx.beginPath(); ctx.roundRect(48, 37, 10, 7, 2); ctx.fill(); ctx.fillStyle = '#140d29'; ctx.font = '5px monospace'; ctx.fillText('109', 49, 42);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = hexA('#31e8ff', .45);
      ctx.beginPath(); ctx.ellipse(39, 19, 15, 4, -.25, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      drawFishEye(27, 27, 5.5, e);
      ctx.fillStyle = '#ffe15a'; ctx.beginPath(); ctx.arc(27, 27, 1.3, 0, Math.PI * 2); ctx.fill();
      return true;
    }
    if (e.type === 'alleycat') {
      const run = Math.sin(e.t * 10), ear = Math.max(0, Math.sin(e.t * 3));
      // A counter-balancing tail has three fur volumes and a luminous tip.
      ctx.strokeStyle = '#281441'; ctx.lineWidth = 13; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(68, 35); ctx.bezierCurveTo(88, 17, 95, 42, 78, 48); ctx.stroke();
      ctx.strokeStyle = '#7040a8'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(69, 33); ctx.bezierCurveTo(88, 19, 92, 40, 79, 45); ctx.stroke();
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#31e8ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(84, 43); ctx.quadraticCurveTo(92, 38, 87, 31); ctx.stroke(); ctx.restore();
      // Four anatomically jointed legs with shoulder, hock, paw and toe pads.
      for (let i = 0; i < 4; i++) {
        const lx = 31 + i * 12, phase = i % 2 ? -run : run, kneeX = lx + phase * 6;
        ctx.strokeStyle = '#25113d'; ctx.lineWidth = 9; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(lx, 41); ctx.lineTo(kneeX, 52); ctx.lineTo(lx + phase * 12, 62); ctx.stroke();
        ctx.fillStyle = '#9b58c5'; ctx.beginPath(); ctx.ellipse(lx + phase * 14, 63, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff8ac2'; for (let t = 0; t < 3; t++) { ctx.beginPath(); ctx.arc(lx + phase * 10 + t * 3, 63, 1, 0, Math.PI * 2); ctx.fill(); }
      }
      const fur = ctx.createLinearGradient(15, 12, 69, 55);
      fur.addColorStop(0, '#b85cff'); fur.addColorStop(.48, '#6330a2'); fur.addColorStop(1, '#26113d');
      ctx.fillStyle = fur; ctx.beginPath(); ctx.ellipse(50, 35, 29, 18, 0, 0, Math.PI * 2); ctx.fill();
      // Shoulder and haunch masses prevent a sausage torso; striped fur follows them.
      ctx.fillStyle = 'rgba(194,112,255,.28)'; ctx.beginPath(); ctx.ellipse(34, 34, 13, 14, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(65, 36, 14, 15, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#3c1b60'; ctx.lineWidth = 4;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(43 + i * 8, 20); ctx.quadraticCurveTo(47 + i * 8, 28, 43 + i * 8, 35); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(20, 31, 17, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(8, 20); ctx.lineTo(11, 5 - ear * 3); ctx.lineTo(21, 18); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(23, 17); ctx.lineTo(33, 6 + ear * 3); ctx.lineTo(34, 23); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e06db5'; ctx.beginPath(); ctx.moveTo(11, 17); ctx.lineTo(12, 10); ctx.lineTo(17, 18); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(26, 17); ctx.lineTo(32, 11); ctx.lineTo(32, 21); ctx.closePath(); ctx.fill();
      // Muzzle volume, nose, mouth and cheek tufts.
      ctx.fillStyle = '#c786dd'; ctx.beginPath(); ctx.ellipse(7, 38, 11, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff8ac2'; ctx.beginPath(); ctx.moveTo(1, 34); ctx.lineTo(-4, 38); ctx.lineTo(2, 41); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#2b123e'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(1, 41); ctx.quadraticCurveTo(7, 45, 12, 40); ctx.stroke();
      drawKawaiiEyes(10, 31, 23, 9, 3);
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1;
      for (const s of [-1, 1]) for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.moveTo(6, 39 + s * 2); ctx.lineTo(-11, 38 + s * (5 + i * 4)); ctx.stroke(); }
      // Reflective collar, brass bell and a tiny Shibuya ward tag.
      ctx.fillStyle = '#31e8ff'; ctx.fillRect(31, 22, 29, 5); ctx.fillStyle = '#ffe15a'; ctx.beginPath(); ctx.arc(43, 29, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff3e9d'; ctx.beginPath(); ctx.roundRect(50, 24, 10, 9, 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '5px monospace'; ctx.fillText('渋', 52, 30);
      return true;
    }
    if (e.type === 'neonmoth') {
      const beat = Math.sin(e.t * 6.5) * 7, charge = clamp(1 - e.fire / Math.max(.1, e.fireMax), 0, 1);
      for (const s of [-1, 1]) {
        const wing = ctx.createLinearGradient(39, 12, 39 + s * 35, 58);
        wing.addColorStop(0, '#fff0b8'); wing.addColorStop(.35, '#ff70c9'); wing.addColorStop(1, '#55218e');
        // Separate forewing and scalloped hindwing, both with a dark underside.
        ctx.fillStyle = '#2a1546'; ctx.beginPath(); ctx.moveTo(39, 31); ctx.quadraticCurveTo(39 + s * 36, -1 + beat, 39 + s * 41, 17 + beat); ctx.quadraticCurveTo(39 + s * 29, 38, 39, 40); ctx.fill();
        ctx.fillStyle = wing; ctx.beginPath(); ctx.moveTo(39, 30); ctx.bezierCurveTo(39 + s * 18, 7 + beat, 39 + s * 35, 2 + beat, 39 + s * 38, 17 + beat); ctx.quadraticCurveTo(39 + s * 27, 34, 39, 37); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(39, 35); ctx.quadraticCurveTo(39 + s * 31, 36 - beat * .3, 39 + s * 31, 56 - beat * .2); ctx.quadraticCurveTo(39 + s * 12, 54, 39, 42); ctx.closePath(); ctx.fill();
        // Veins radiate from the thorax; eye-spots have three concentric pigments.
        ctx.strokeStyle = 'rgba(89,26,97,.5)'; ctx.lineWidth = 1.3;
        const veinCount = [3, 4, 5][bgQuality()];
        for (let i = 0; i < veinCount; i++) { ctx.beginPath(); ctx.moveTo(39, 34); ctx.lineTo(39 + s * (16 + i * 5), 13 + i * 7 + beat * .3); ctx.stroke(); }
        const ox = 39 + s * 24, oy = 22 + beat * .25; ctx.fillStyle = '#481059'; ctx.beginPath(); ctx.arc(ox, oy, 8, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#31e8ff'; ctx.beginPath(); ctx.arc(ox, oy, 5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ffe15a'; ctx.beginPath(); ctx.arc(ox, oy, 2, 0, Math.PI * 2); ctx.fill();
      }
      // Fuzzy thorax, segmented abdomen and six folded legs.
      ctx.fillStyle = '#1d1031'; ctx.beginPath(); ctx.ellipse(39, 39, 7, 25, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#7b3d86'; ctx.lineWidth = 2; for (let y = 30; y < 58; y += 6) { ctx.beginPath(); ctx.moveTo(33, y); ctx.lineTo(45, y); ctx.stroke(); }
      const fuzz = ctx.createRadialGradient(34, 22, 1, 39, 25, 14); fuzz.addColorStop(0, '#ffe5ae'); fuzz.addColorStop(.45, '#f28bc8'); fuzz.addColorStop(1, '#582060'); ctx.fillStyle = fuzz; ctx.beginPath(); ctx.ellipse(39, 25, 12, 14, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#8f4a92'; ctx.lineWidth = 1.5; for (const s of [-1,1]) for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(36 + s * 3, 29 + i * 4); ctx.lineTo(39 + s * (12 + i * 2), 34 + i * 5); ctx.stroke(); }
      // Feathery antennae: a central shaft with paired comb teeth.
      ctx.strokeStyle = '#ffb3dc'; ctx.lineWidth = 2;
      for (const s of [-1,1]) { ctx.beginPath(); ctx.moveTo(37 + s * 2, 16); ctx.quadraticCurveTo(32 + s * 11, 2, 24 + s * 15, 7); ctx.stroke(); for (let i = 0; i < 4; i++) { const ax = 34 + s * (i * 3), ay = 13 - i * 3; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + s * 7, ay - 3); ctx.stroke(); } }
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .25 + charge * .55; ctx.fillStyle = '#ffe15a';
      ctx.beginPath(); ctx.arc(39, 37, 12 + charge * 9, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      drawKawaiiEyes(33, 27, 40, 5, 2);
      return true;
    }
    if (e.type === 'slagling') {
      const bubble = Math.sin(e.t * 4), hop = Math.abs(Math.sin(e.t * 5)) * 4;
      ctx.save(); ctx.translate(0, -hop);
      // Three viscous feet stretch independently; the body is molten material,
      // not a flame icon sitting on the floor.
      for (let i = 0; i < 3; i++) {
        const sx = 14 + i * 18, step = Math.sin(e.t * 5 + i * 2.1) * 4;
        ctx.fillStyle = '#34110b'; ctx.beginPath(); ctx.ellipse(sx + step, 49, 12, 6, -.12 * step, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,107,38,.45)'; ctx.beginPath(); ctx.ellipse(sx + step - 2, 47, 6, 2, 0, 0, Math.PI * 2); ctx.fill();
      }
      const slag = ctx.createRadialGradient(21, 18, 3, 31, 32, 30);
      slag.addColorStop(0, '#fff09a'); slag.addColorStop(.28, '#ff9f43'); slag.addColorStop(.65, '#9a2817'); slag.addColorStop(1, '#2b1110');
      ctx.fillStyle = slag; ctx.beginPath(); ctx.moveTo(5, 45); ctx.quadraticCurveTo(8, 12, 24, 17 + bubble * 3);
      ctx.quadraticCurveTo(35, 2, 43, 22); ctx.quadraticCurveTo(60, 19, 58, 47); ctx.closePath(); ctx.fill();
      // Cooled basalt rafts ride over the liquid core. Their irregular edges,
      // bevels and orange seams are what make it read as slag rather than jelly.
      const plates = [[10,27,21,18,29,28,20,36,9,34], [31,13,42,10,49,21,40,27,29,23], [34,35,48,28,56,37,51,46,39,47]];
      for (const p of plates) {
        ctx.fillStyle = '#3b2929'; ctx.beginPath(); ctx.moveTo(p[0], p[1]);
        for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#79513b'; ctx.lineWidth = 1.4; ctx.stroke();
      }
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#ffe15a'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(14, 35); ctx.lineTo(24, 27); ctx.lineTo(31, 38); ctx.lineTo(42, 29); ctx.lineTo(51, 36); ctx.stroke(); ctx.restore();
      // Surface blisters rise, brighten and burst into tiny sparks.
      for (let i = 0; i < 4; i++) {
        const k = (e.t * .8 + i * .27) % 1, bx = 16 + (i * 17) % 38, by = 29 - k * 24;
        ctx.fillStyle = hexA(i % 2 ? '#ff8a35' : '#ffe15a', 1 - k);
        ctx.beginPath(); ctx.arc(bx, by, 3.5 - k * 2.4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#211418'; ctx.beginPath(); ctx.ellipse(29, 40, 19, 9, 0, 0, Math.PI * 2); ctx.fill();
      drawKawaiiEyes(18, 40, 41, 9, 3);
      ctx.restore(); return true;
    }
    if (e.type === 'rivetbeetle') {
      const buzz = Math.sin(e.t * 20) * 5;
      // Amber flight wings unfold from below the heavy iron elytra.
      for (const s of [-1, 1]) {
        ctx.save(); ctx.translate(44, 31); ctx.scale(1, s);
        const membrane = ctx.createLinearGradient(0, 0, 35, 18 + buzz);
        membrane.addColorStop(0, 'rgba(255,225,90,.65)'); membrane.addColorStop(1, 'rgba(255,90,54,.08)');
        ctx.fillStyle = membrane; ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(18, 2, 38, 8 + buzz, 35, 21 + buzz); ctx.quadraticCurveTo(14, 15, 0, 5); ctx.fill();
        ctx.strokeStyle = 'rgba(96,35,18,.45)'; ctx.lineWidth = 1;
        for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(3, 3); ctx.lineTo(8 + i * 6, 4 + i * 3 + buzz * .5); ctx.stroke(); }
        ctx.restore();
      }
      // Six articulated legs, each with a bright hot joint and hooked foot.
      for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
        const hipX = 31 + i * 16, hipY = 31 + side * 9, kneeX = hipX + 7, kneeY = hipY + side * (12 + i * 2);
        ctx.strokeStyle = '#32181b'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(kneeX, kneeY); ctx.lineTo(kneeX + 11, kneeY + side * 5); ctx.stroke();
        ctx.fillStyle = '#ff9f43'; ctx.beginPath(); ctx.arc(kneeX, kneeY, 2.5, 0, Math.PI * 2); ctx.fill();
      }
      const shell = ctx.createLinearGradient(10, 8, 70, 55);
      shell.addColorStop(0, '#ffe7a0'); shell.addColorStop(.3, '#d96b2c'); shell.addColorStop(.72, '#743122'); shell.addColorStop(1, '#291316');
      ctx.fillStyle = shell; ctx.beginPath(); ctx.ellipse(46, 31, 31, 24, 0, 0, Math.PI * 2); ctx.fill();
      // Split elytra with forged ribs, countersunk rivets and scorched edges.
      ctx.strokeStyle = '#351518'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(47, 8); ctx.quadraticCurveTo(45, 30, 47, 54); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,224,150,.25)'; ctx.lineWidth = 1.5;
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(47, 31, 10 + i * 7, s < 0 ? Math.PI * .55 : -Math.PI * .45, s < 0 ? Math.PI * 1.45 : Math.PI * .45); ctx.stroke(); }
      for (const x of [28, 64]) for (const y of [18, 31, 44]) {
        ctx.fillStyle = '#3a1b1b'; ctx.beginPath(); ctx.arc(x, y, 3.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffcd59'; ctx.beginPath(); ctx.arc(x - 1, y - 1, 1.3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,245,210,.25)'; ctx.beginPath(); ctx.ellipse(34, 17, 12, 4, -.35, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#36151a'; ctx.beginPath(); ctx.ellipse(15, 31, 14, 17, 0, 0, Math.PI * 2); ctx.fill();
      // Stag-beetle mandibles, antenna clubs and a segmented throat collar.
      ctx.strokeStyle = '#e59b49'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(8, 22); ctx.quadraticCurveTo(-8, 10, -9, 22); ctx.lineTo(-2, 27); ctx.moveTo(8, 40); ctx.quadraticCurveTo(-8, 52, -9, 40); ctx.lineTo(-2, 35); ctx.stroke();
      ctx.strokeStyle = '#7e492c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(11, 19); ctx.quadraticCurveTo(0, 4, -7, 12); ctx.moveTo(11, 43); ctx.quadraticCurveTo(0, 58, -7, 50); ctx.stroke();
      ctx.strokeStyle = '#c7652b'; for (let x = 23; x < 31; x += 4) { ctx.beginPath(); ctx.moveTo(x, 17); ctx.lineTo(x, 45); ctx.stroke(); }
      drawKawaiiEyes(8, 31, 20, 8, 3); return true;
    }
    if (e.type === 'furnacehound') {
      const run = Math.sin(e.t * 9), charge = clamp(1 - e.fire / Math.max(.1, e.fireMax), 0, 1);
      // Chimney and exhaust live behind the silhouette. Smoke is layered puffs,
      // so the hound reads as a mobile furnace before its face is even visible.
      ctx.fillStyle = '#32171a'; ctx.fillRect(67, 4, 18, 28); ctx.fillStyle = '#79412e'; ctx.fillRect(64, 2, 24, 7);
      for (let i = 0; i < 3; i++) {
        const k = (e.t * .7 + i * .31) % 1;
        ctx.fillStyle = `rgba(70,45,49,${.32 * (1 - k)})`; ctx.beginPath(); ctx.arc(76 + Math.sin(e.t + i) * 6, 1 - k * 25, 7 + k * 8, 0, Math.PI * 2); ctx.fill();
      }
      for (let i = 0; i < 4; i++) {
        const x = 35 + i * 16, ph = i % 2 ? -run : run;
        ctx.strokeStyle = '#351817'; ctx.lineWidth = 11; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x, 54); ctx.lineTo(x + ph * 8, 72); ctx.lineTo(x + ph * 14, 78); ctx.stroke();
        ctx.fillStyle = '#8b3d29'; ctx.beginPath(); ctx.arc(x + ph * 8, 72, 5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ff9f43'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + ph * 7, 76); ctx.lineTo(x + ph * 14 + 8, 79); ctx.stroke();
      }
      const hide = ctx.createLinearGradient(12, 10, 94, 69);
      hide.addColorStop(0, '#ffbd63'); hide.addColorStop(.36, '#bd482d'); hide.addColorStop(1, '#391519');
      ctx.fillStyle = hide; ctx.beginPath(); ctx.ellipse(61, 43, 39, 24, 0, 0, Math.PI * 2); ctx.fill();
      // Iron rib cage contains the pulsing white-hot firebox.
      ctx.fillStyle = '#1d1216'; ctx.beginPath(); ctx.roundRect(47, 27, 43, 32, 9); ctx.fill();
      const core = ctx.createRadialGradient(63, 40, 2, 67, 44, 22);
      core.addColorStop(0, '#fffbd0'); core.addColorStop(.3, '#ffe15a'); core.addColorStop(.7, '#ff5a36'); core.addColorStop(1, '#501719');
      ctx.fillStyle = core; ctx.beginPath(); ctx.ellipse(68, 43, 20, 14, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#4b2522'; ctx.lineWidth = 5;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(66, 43, 17 + i * 5, -1.1 + i * .08, 1.1 - i * .08); ctx.stroke(); }
      ctx.fillStyle = '#2c171a'; ctx.beginPath(); ctx.moveTo(88, 29); ctx.lineTo(105, 21); ctx.lineTo(96, 38); ctx.lineTo(106, 46); ctx.lineTo(88, 52); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(28, 28); ctx.lineTo(10, 20); ctx.lineTo(15, 36); ctx.lineTo(4, 48); ctx.lineTo(30, 58); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#291016'; ctx.beginPath(); ctx.moveTo(15, 36); ctx.lineTo(-3, 43); ctx.lineTo(16, 51); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffe6ab'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(11 + i * 4, 40); ctx.lineTo(13 + i * 4, 49); ctx.lineTo(16 + i * 4, 40); ctx.fill(); }
      ctx.fillStyle = '#291016'; ctx.beginPath(); ctx.moveTo(39, 22); ctx.lineTo(44, 3); ctx.lineTo(52, 24); ctx.moveTo(66, 20); ctx.lineTo(74, 1); ctx.lineTo(79, 25); ctx.fill();
      // Copper brow plate, cheek vents and a glowing nose ring give the head a
      // built, handled history instead of a flat dog profile.
      ctx.fillStyle = '#a95332'; ctx.beginPath(); ctx.moveTo(9, 22); ctx.lineTo(33, 20); ctx.lineTo(39, 31); ctx.lineTo(16, 34); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ffbd63'; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(27 + i * 4, 36); ctx.lineTo(30 + i * 4, 43); ctx.stroke(); }
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .25 + charge * .6; ctx.fillStyle = '#ff5a36'; ctx.beginPath(); ctx.arc(13, 43, 12 + charge * 11, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      drawKawaiiEyes(22, 33, 36, 8, 3); return true;
    }
    if (e.type === 'cloudray') {
      const flap = Math.sin(e.t * 4.2) * 9, charge = clamp(1 - e.fire / Math.max(.1, e.fireMax), 0, 1);
      // Long forked tail with charge crawling from the root to the tip.
      ctx.strokeStyle = '#174839'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(75, 31); ctx.quadraticCurveTo(98, 22, 111, 36); ctx.quadraticCurveTo(119, 46, 127, 37); ctx.stroke();
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = hexA('#72ff68', .5 + charge * .5); ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(83, 30); ctx.lineTo(94, 37); ctx.lineTo(101, 31); ctx.lineTo(112, 43); ctx.lineTo(119, 37); ctx.lineTo(129, 44); ctx.stroke(); ctx.restore();
      const cloud = ctx.createLinearGradient(0, 4, 0, 59);
      cloud.addColorStop(0, '#e9fff2'); cloud.addColorStop(.42, '#79cfa0'); cloud.addColorStop(1, '#174839');
      ctx.fillStyle = cloud; ctx.beginPath(); ctx.moveTo(6, 31); ctx.quadraticCurveTo(31, 7 + flap, 50, 20);
      ctx.quadraticCurveTo(72, 2 - flap, 94, 31); ctx.quadraticCurveTo(70, 45 + flap, 50, 39); ctx.quadraticCurveTo(28, 50 - flap, 6, 31); ctx.fill();
      // Billowing lobes make the wings volumetric cloud banks, while the darker
      // underside preserves the manta silhouette against rain and scanlines.
      const lobes = [[24,21,17,10],[45,15,20,12],[68,22,18,11],[31,39,19,10],[57,40,22,10]];
      for (let i = 0; i < (bgQuality() ? lobes.length : 3); i++) {
        const [x,y,rx,ry] = lobes[i], lg = ctx.createRadialGradient(x - 5, y - 5, 1, x, y, rx);
        lg.addColorStop(0, i < 3 ? 'rgba(244,255,250,.72)' : 'rgba(130,220,173,.45)'); lg.addColorStop(1, 'rgba(23,72,57,0)');
        ctx.fillStyle = lg; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
      }
      // Electrical capillaries are visible through the thin storm membrane.
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = hexA('#bfffb9', .28 + charge * .38); ctx.lineWidth = 1.5;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(43, 30); ctx.lineTo(55 + s * 10, 22 + s * flap * .25); ctx.lineTo(73 + s * 13, 29 + s * 8); ctx.stroke(); }
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,.42)'; ctx.beginPath(); ctx.ellipse(36, 20, 24, 6, -.2, 0, Math.PI * 2); ctx.fill();
      // Cephalic lobes curl around a dark mouth, borrowing the unmistakable ray anatomy.
      ctx.strokeStyle = '#2b765a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(19, 25); ctx.quadraticCurveTo(2, 20, 5, 30); ctx.moveTo(19, 37); ctx.quadraticCurveTo(2, 42, 5, 32); ctx.stroke();
      ctx.fillStyle = '#0b2a22'; ctx.beginPath(); ctx.ellipse(11, 31, 5, 7, 0, 0, Math.PI * 2); ctx.fill();
      drawFishEye(23, 29, 5, e); drawFishEye(36, 31, 5, e); return true;
    }
    if (e.type === 'voltbug') {
      const buzz = Math.sin(e.t * 22) * 4, charge = clamp(1 - e.fire / Math.max(.1, e.fireMax), 0, 1);
      // Four transparent wings with visible veins. The rear pair lags a few
      // frames, avoiding the flat two-oval propeller look of the first pass.
      for (const [side, rear] of [[-1,0],[-1,1],[1,0],[1,1]]) {
        const wy = 33 + side * (13 + rear * 7) + side * buzz * (rear ? -.55 : 1);
        ctx.fillStyle = rear ? 'rgba(49,232,255,.17)' : 'rgba(180,255,210,.28)';
        ctx.beginPath(); ctx.ellipse(44 + rear * 7, wy, 29 - rear * 5, 8, side * (.18 + rear * .12), 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = rear ? 'rgba(49,232,255,.42)' : 'rgba(190,255,205,.55)'; ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(24, 33); ctx.lineTo(50 + i * 7, wy + side * (i - 1) * 2); ctx.stroke(); }
      }
      // Six dangling legs catch and release tiny static arcs.
      for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
        const x = 27 + i * 12, y = 33 + side * 12;
        ctx.strokeStyle = '#0a3928'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 7, y + side * 9); ctx.lineTo(x + 13, y + side * 6); ctx.stroke();
        if (charge > .65 && i === 1) { ctx.strokeStyle = '#d6ffd0'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + 11, y + side * 6); ctx.lineTo(x + 15, y + side * 11); ctx.lineTo(x + 19, y + side * 7); ctx.stroke(); }
      }
      const shell = ctx.createRadialGradient(22, 20, 2, 38, 33, 29);
      shell.addColorStop(0, '#efffeb'); shell.addColorStop(.28, '#72ff68'); shell.addColorStop(.7, '#177247'); shell.addColorStop(1, '#06251d');
      ctx.fillStyle = shell; ctx.beginPath(); ctx.ellipse(41, 33, 27, 18, 0, 0, Math.PI * 2); ctx.fill();
      // Separate luminous abdominal segments contract in sequence as it flies.
      ctx.strokeStyle = '#0c5236'; ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(45, 33, 8 + i * 6, -.75, .75); ctx.stroke(); }
      ctx.fillStyle = 'rgba(230,255,220,.42)'; ctx.beginPath(); ctx.ellipse(34, 24, 12, 4, -.25, 0, Math.PI * 2); ctx.fill();
      // Faceted compound eyes flank a small armored head.
      ctx.fillStyle = '#0a291e'; ctx.beginPath(); ctx.arc(14, 33, 14, 0, Math.PI * 2); ctx.fill();
      for (const sy of [-1,1]) { ctx.fillStyle = '#bfffb9'; ctx.beginPath(); ctx.ellipse(8, 33 + sy * 6, 5, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#174839'; ctx.beginPath(); ctx.arc(6, 33 + sy * 6, 1.8, 0, Math.PI * 2); ctx.fill(); }
      ctx.strokeStyle = '#72ff68'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(10, 24); ctx.quadraticCurveTo(-2, 5, -7, 18); ctx.moveTo(10, 42); ctx.quadraticCurveTo(-2, 61, -7, 48); ctx.stroke();
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .2 + charge * .65; ctx.strokeStyle = '#d6ffd0'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(38, 33, 30 + charge * 8, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      return true;
    }
    if (e.type === 'packetwyrm') {
      // A segmented data-dragon: its packets lag down the spine like a network queue.
      const pts = [];
      for (let i = 0; i < 7; i++) pts.push({ x: 28 + i * 20, y: 32 + Math.sin(e.t * 3 - i * .72) * (5 + i * .7) });
      // Dorsal packet fins and a translucent data wake sit behind the body.
      ctx.fillStyle = 'rgba(49,232,255,.12)'; ctx.beginPath(); ctx.moveTo(20, 32);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y - 24 + (i % 2) * 8);
      for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i].x, pts[i].y); ctx.closePath(); ctx.fill();
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i]; ctx.fillStyle = i % 2 ? '#31e8ff' : '#72ff68';
        ctx.beginPath(); ctx.moveTo(p.x - 7, p.y - 10); ctx.lineTo(p.x, p.y - 25 + (i % 2) * 7); ctx.lineTo(p.x + 7, p.y - 9); ctx.closePath(); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(49,232,255,.3)'; ctx.lineWidth = 15; ctx.lineCap = 'round'; ctx.beginPath();
      pts.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](p.x, p.y)); ctx.stroke();
      for (let i = pts.length - 1; i >= 0; i--) {
        const p = pts[i], r = 17 - i * 1.2, g = ctx.createRadialGradient(p.x - 5, p.y - 6, 1, p.x, p.y, r);
        g.addColorStop(0, '#eaffff'); g.addColorStop(.28, i % 2 ? '#31e8ff' : '#72ff68'); g.addColorStop(1, '#063b45');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
        // Each segment is a routed packet with header ticks and a checksum light.
        ctx.strokeStyle = 'rgba(2,38,46,.55)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, r * .72, -.8, .8); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.62)'; ctx.fillRect(p.x - 6, p.y - 7, 12, 3);
        ctx.fillStyle = i % 2 ? '#ffe15a' : '#ff3e9d'; ctx.beginPath(); ctx.arc(p.x + 6, p.y + 4, 2, 0, Math.PI * 2); ctx.fill();
      }
      // Dragon skull: swept horns, cheek fins, open jaw and fibre-optic whiskers.
      const head = ctx.createLinearGradient(0, 8, 25, 50); head.addColorStop(0, '#0c6670'); head.addColorStop(.5, '#083d4c'); head.addColorStop(1, '#021c28');
      ctx.fillStyle = head; ctx.beginPath(); ctx.moveTo(24, 18); ctx.lineTo(8, 10); ctx.lineTo(11, 25); ctx.lineTo(-4, 31); ctx.lineTo(8, 47); ctx.lineTo(25, 43); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d6ffd0'; ctx.beginPath(); ctx.moveTo(8, 32); ctx.lineTo(-12, 36); ctx.lineTo(7, 43); ctx.lineTo(20, 38); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#031820'; ctx.beginPath(); ctx.moveTo(7, 34); ctx.lineTo(-7, 36); ctx.lineTo(8, 39); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#31e8ff'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(13, 18); ctx.quadraticCurveTo(-1, 0, -11, 11); ctx.moveTo(19, 21); ctx.quadraticCurveTo(8, 1, 3, 7); ctx.stroke();
      ctx.strokeStyle = 'rgba(114,255,104,.72)'; ctx.lineWidth = 1.5; for (const s of [-1,1]) { ctx.beginPath(); ctx.moveTo(7, 35 + s * 4); ctx.quadraticCurveTo(-12, 27 + s * 18, -22, 35 + s * 13); ctx.stroke(); }
      drawKawaiiEyes(8, 28, 21, 11, 3); return true;
    }
    if (e.type === 'rosebud') {
      const open = .5 + Math.sin(e.t * 2.5) * .16, charge = clamp(1 - e.fire / Math.max(.1, e.fireMax), 0, 1);
      // A thorny prehensile stem curls behind the flower and visibly anchors its
      // locomotion. Thorns alternate sides like a real rose cane.
      ctx.strokeStyle = '#194b31'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(38, 39); ctx.bezierCurveTo(55, 48, 48, 67, 65, 72); ctx.stroke();
      ctx.strokeStyle = '#4bb566'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(38, 39); ctx.bezierCurveTo(55, 48, 48, 67, 65, 72); ctx.stroke();
      for (let i = 0; i < 4; i++) { const x = 46 + i * 5, y = 49 + i * 6, s = i % 2 ? -1 : 1; ctx.fillStyle = '#b7db55'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s * 11, y - 5); ctx.lineTo(x + s * 3, y + 4); ctx.closePath(); ctx.fill(); }
      // Two veined leaves twist in opposite directions as the stem bobs.
      for (const s of [-1, 1]) {
        const lx = 54 + s * 10, ly = 59;
        ctx.fillStyle = s < 0 ? '#287d4a' : '#43a85b'; ctx.beginPath(); ctx.moveTo(51, 58); ctx.quadraticCurveTo(lx, ly - 13, lx + s * 15, ly); ctx.quadraticCurveTo(lx, ly + 9, 51, 58); ctx.fill();
        ctx.strokeStyle = 'rgba(205,255,175,.42)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(52, 58); ctx.lineTo(lx + s * 12, ly); ctx.stroke();
      }
      // Green sepals clasp the bud from behind, preventing the petals from
      // reading as a free-floating pink circle.
      ctx.fillStyle = '#236d43';
      for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(36, 35); ctx.lineTo(36 + Math.cos(a) * 31, 35 + Math.sin(a) * 25); ctx.lineTo(36 + Math.cos(a + .45) * 17, 35 + Math.sin(a + .45) * 15); ctx.closePath(); ctx.fill(); }
      // Three nested petal whorls create a rose spiral rather than a daisy.
      const petalRings = bgQuality() ? 3 : 2;
      for (let ring = 0; ring < petalRings; ring++) for (let i = 7 - ring; i >= 0; i--) {
        const count = 8 - ring, a = i / count * Math.PI * 2 + e.t * .08 + ring * .42, r = (20 - ring * 6) * open;
        const px = 36 + Math.cos(a) * r, py = 33 + Math.sin(a) * r * .72, size = 14 - ring * 2;
        const petal = ctx.createRadialGradient(px - 4, py - 5, 1, px, py, size + 4);
        petal.addColorStop(0, ring === 2 ? '#fff0f8' : '#ffd2e9'); petal.addColorStop(.38, ring === 2 ? '#ff7fbc' : '#ff4f9b'); petal.addColorStop(1, '#68123f');
        ctx.fillStyle = petal; ctx.beginPath(); ctx.ellipse(px, py, size, size + 5, a + Math.PI / 2, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,220,238,.22)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(px, py, size * .65, a, a + Math.PI * .8); ctx.stroke();
      }
      ctx.fillStyle = '#4d0d32'; ctx.beginPath(); ctx.arc(36, 33, 12, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .2 + charge * .55; ctx.fillStyle = '#ffe15a'; ctx.beginPath(); ctx.arc(36, 32, 11 + charge * 8, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      drawKawaiiEyes(29, 34, 43, 6, 2); return true;
    }
    if (e.type === 'cardguard') {
      const march = Math.sin(e.t * 7) * 5;
      // Boots, arms and spear all sit behind the card plane, giving the thin
      // soldier a believable layered construction.
      for (const s of [-1, 1]) {
        ctx.strokeStyle = '#351126'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(31 + s * 14, 68); ctx.lineTo(31 + s * 14 + march * s, 82); ctx.stroke();
        ctx.fillStyle = '#6b274d'; ctx.beginPath(); ctx.ellipse(31 + s * 14 + march * s - 4, 83, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = '#6b274d'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(18, 32); ctx.lineTo(0, 44); ctx.moveTo(59, 31); ctx.lineTo(70, 41); ctx.stroke();
      ctx.fillStyle = '#fff0bd'; ctx.beginPath(); ctx.arc(0, 44, 6, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(70, 41, 6, 0, Math.PI * 2); ctx.fill();
      // Extruded card stock: dark side face and gold bottom edge.
      ctx.fillStyle = '#42112e'; ctx.beginPath(); ctx.roundRect(14, 6, 55, 72, 7); ctx.fill();
      ctx.fillStyle = '#9f6a38'; ctx.beginPath(); ctx.moveTo(10, 69); ctx.lineTo(63, 69); ctx.lineTo(69, 78); ctx.lineTo(16, 78); ctx.closePath(); ctx.fill();
      const card = ctx.createLinearGradient(12, 5, 67, 77); card.addColorStop(0, '#fff8dc'); card.addColorStop(.55, '#f1dca6'); card.addColorStop(1, '#9b653c');
      ctx.fillStyle = card; ctx.beginPath(); ctx.roundRect(8, 2, 55, 72, 7); ctx.fill();
      ctx.strokeStyle = '#d42362'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(14, 8, 43, 59, 3); ctx.stroke();
      // Corner indices, suit pip and embossed filigree make this an actual card.
      ctx.fillStyle = '#d42362'; ctx.font = 'bold 10px monospace'; ctx.fillText('Q', 16, 20); ctx.save(); ctx.translate(55, 61); ctx.rotate(Math.PI); ctx.fillText('Q', 0, 0); ctx.restore();
      ctx.fillStyle = '#d42362'; heartPath(36, 42, 14); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.35)'; heartPath(31, 36, 5); ctx.fill();
      ctx.strokeStyle = 'rgba(155,101,60,.35)'; ctx.lineWidth = 1; for (let y = 25; y < 60; y += 8) { ctx.beginPath(); ctx.moveTo(16, y); ctx.quadraticCurveTo(36, y - 7, 56, y); ctx.stroke(); }
      // Folded paper crown with bevel and five points.
      ctx.fillStyle = '#351126'; ctx.beginPath(); ctx.moveTo(12, 5); ctx.lineTo(23, -10); ctx.lineTo(34, 4); ctx.lineTo(45, -11); ctx.lineTo(59, 5); ctx.lineTo(58, 12); ctx.lineTo(14, 12); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8f315c'; ctx.beginPath(); ctx.moveTo(13, 3); ctx.lineTo(23, -7); ctx.lineTo(34, 5); ctx.lineTo(45, -8); ctx.lineTo(58, 3); ctx.lineTo(56, 8); ctx.lineTo(15, 8); ctx.closePath(); ctx.fill();
      // Halberd has a shaft, counterweight, blade and heart cutout.
      ctx.strokeStyle = '#ffe15a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(68, 18); ctx.lineTo(74, 72); ctx.stroke();
      ctx.fillStyle = '#fff1a8'; ctx.beginPath(); ctx.moveTo(68, 19); ctx.lineTo(74, 2); ctx.lineTo(81, 20); ctx.lineTo(75, 17); ctx.lineTo(72, 29); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d42362'; heartPath(74, 15, 4); ctx.fill(); ctx.fillStyle = '#8f315c'; ctx.beginPath(); ctx.arc(74, 73, 6, 0, Math.PI * 2); ctx.fill();
      drawKawaiiEyes(23, 28, 48, 7, 2); return true;
    }
    if (e.type === 'teacup') {
      const rattle = Math.sin(e.t * 8) * 3, steam = Math.sin(e.t * 3), charge = clamp(1 - e.fire / Math.max(.1, e.fireMax), 0, 1);
      // Tiny silver feet and a thick saucer establish a real tabletop object.
      for (const x of [22,57]) { ctx.fillStyle = '#6b2a55'; ctx.fillRect(x, 48, 7, 8); ctx.fillStyle = '#ffe15a'; ctx.beginPath(); ctx.ellipse(x + 2, 56, 8, 3, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#43152f'; ctx.beginPath(); ctx.ellipse(41, 53, 41, 9, 0, 0, Math.PI * 2); ctx.fill();
      const saucer = ctx.createLinearGradient(0, 44, 0, 55); saucer.addColorStop(0, '#fff8e8'); saucer.addColorStop(.45, '#e7a9c5'); saucer.addColorStop(1, '#84355e');
      ctx.fillStyle = saucer; ctx.beginPath(); ctx.ellipse(39, 49, 39, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffe15a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(39, 48, 31, 5, 0, 0, Math.PI * 2); ctx.stroke();
      const china = ctx.createLinearGradient(9, 5, 62, 49); china.addColorStop(0, '#fffbe8'); china.addColorStop(.45, '#ffcfdf'); china.addColorStop(1, '#a74475');
      ctx.fillStyle = china; ctx.beginPath(); ctx.moveTo(7, 10); ctx.quadraticCurveTo(10, 48, 48, 48); ctx.quadraticCurveTo(62, 32, 58, 10); ctx.closePath(); ctx.fill();
      // Handle gets a dark back rim and bright porcelain front rim for thickness.
      ctx.strokeStyle = '#6d234c'; ctx.lineWidth = 11; ctx.beginPath(); ctx.arc(60, 27, 16, -1.2, 1.2); ctx.stroke();
      ctx.strokeStyle = '#f5b4cf'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(59, 25, 15, -1.1, 1.1); ctx.stroke();
      // Gold rim, painted roses, vines and a hairline crack in the china.
      ctx.strokeStyle = '#ffe15a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(33, 10, 27, 7, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#4d9a55'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(14, 33); ctx.quadraticCurveTo(28, 22, 46, 35); ctx.stroke();
      for (const [x,y] of [[20,29],[36,31],[45,37]]) { ctx.fillStyle = '#e33c7d'; heartPath(x, y, 4); ctx.fill(); ctx.fillStyle = '#ffe15a'; ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI * 2); ctx.fill(); }
      ctx.strokeStyle = 'rgba(82,31,59,.45)'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(48, 12); ctx.lineTo(44, 21); ctx.lineTo(49, 27); ctx.lineTo(45, 34); ctx.stroke();
      // Tea surface swirls faster during wind-up; bubbles rise from the vortex.
      ctx.fillStyle = '#5e173e'; ctx.beginPath(); ctx.ellipse(33, 11, 27, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#e18a9f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(33 + Math.sin(e.t * 4) * 3, 11, 17 - charge * 4, 3, 0, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 3; i++) { const k = (e.t * (1 + charge) + i * .33) % 1; ctx.fillStyle = hexA('#ffd7ea', .7 * (1 - k)); ctx.beginPath(); ctx.arc(22 + i * 10 + Math.sin(e.t + i) * 3, 9 - k * 17, 2.5 - k, 0, Math.PI * 2); ctx.fill(); }
      // A teaspoon is carried like a lance and rattles against the saucer.
      ctx.save(); ctx.translate(11, 37); ctx.rotate(-.7 + rattle * .03); ctx.strokeStyle = '#d9dfeb'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-26, 16); ctx.stroke(); ctx.fillStyle = '#f8fbff'; ctx.beginPath(); ctx.ellipse(-30, 19, 8, 5, -.6, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(22 + i * 12, 6); ctx.quadraticCurveTo(13 + i * 15 + rattle, -7, 25 + i * 10 + steam * 4, -18); ctx.stroke(); }
      drawKawaiiEyes(20, 27, 45, 8, 2); return true;
    }
    return false;
  }

  function drawEnemy(e) {
    const stage = stages[stageIndex];
    // A boss that has left the field is neither drawn nor collidable; the
    // spectacle during that window belongs to whatever it left behind.
    if (e.ghost) return;
    ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y));
    if (e.fade !== undefined && e.fade < 1) ctx.globalAlpha = Math.max(0, e.fade);
    if (e.type === 'mirage') { drawMirage(e); ctx.restore(); return; }
    if (e.type === 'consort') { drawConsort(e); ctx.restore(); return; }
    if (e.type === 'block') { drawBlock(e); ctx.restore(); return; }
    // Flankers travel rightward — mirror the sprite so they face their heading.
    if (e.flank) { ctx.translate(e.w, 0); ctx.scale(-1, 1); }
    if (e.type !== 'boss' && e.type !== 'midboss') {
      // The two long sea creatures don't fill their box — the oarfish is a
      // vertical ribbon and the moray's body runs off past the right edge — so
      // a box-sized contact shadow would sit in open water beside them.
      if (e.type !== 'oarfish' && e.type !== 'moray' && e.type !== 'packetwyrm') drawEnemyShadow(e);
      drawEnemyUnderglow(e, stage.accent2);
    }
    if (drawSignatureEnemy(e)) {
      // Drawn above; the shared shield, damage and variant passes still follow.
    } else if (e.type === 'drone') {
      // Recon pod: spinning rotor mast, camera-lens face, blinking LEDs, thrusters.
      // Rotor blur disc + crossed blades on the mast.
      ctx.save(); ctx.translate(32, 6);
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(159,232,255,.16)';
      ctx.beginPath(); ctx.ellipse(0, 0, 30, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = '#bfeaff'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      const rb = e.t * 26; ctx.beginPath();
      ctx.moveTo(Math.cos(rb) * -28, Math.sin(rb) * -4); ctx.lineTo(Math.cos(rb) * 28, Math.sin(rb) * 4); ctx.stroke();
      ctx.fillStyle = '#31e8ff'; ctx.fillRect(-3, -4, 6, 8); ctx.restore();
      ctx.fillStyle = '#4a1f9e'; ctx.fillRect(30, 4, 4, 10);
      // Chassis.
      drawBox3D(6, 12, 50, 30, '#8b3fff', 8);
      drawBox3D(0, 20, 64, 14, '#5a28b8', 5);
      ctx.fillStyle = '#dba6ff'; ctx.fillRect(12, 16, 38, 5);
      drawKawaiiEyes(18, 38, 24, 10, 3);
      // Blinking status LEDs.
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const on = Math.floor(e.t * 6) % 2;
      ctx.fillStyle = on ? '#ff3e9d' : '#31e8ff'; ctx.fillRect(2, 24, 5, 5);
      ctx.fillStyle = on ? '#31e8ff' : '#ff3e9d'; ctx.fillRect(57, 24, 5, 5);
      const thr = .55 + Math.abs(Math.sin(e.t * 14)) * .45;
      ctx.fillStyle = hexA('#31e8ff', .75 * thr);
      ctx.beginPath(); ctx.ellipse(12, 46, 9 * thr, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(52, 46, 9 * thr, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
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
      // Twin recoiling cannons pointing at the player (recoil eased by e.recoil).
      const rec = (e.recoil || 0);
      ctx.save();
      const cann = ctx.createLinearGradient(-16, 0, 20, 0);
      cann.addColorStop(0, '#8a8fb5'); cann.addColorStop(.5, '#4a4f75'); cann.addColorStop(1, '#20233c');
      for (const cy of [30, 46]) {
        ctx.fillStyle = cann; ctx.fillRect(-16 + rec * 34, cy, 34, 8);
        ctx.fillStyle = '#0c0a1e'; ctx.fillRect(-20 + rec * 34, cy + 1, 8, 6);
      }
      ctx.restore();
      // Animated tread with rolling wheels.
      drawBox3D(2, 60, 88, 16, '#241035', 5);
      ctx.save(); ctx.fillStyle = '#0c0a1e';
      const to = (e.t * 60) % 16;
      for (let x = 4 - to; x < 90; x += 16) { ctx.beginPath(); ctx.arc(x, 68, 5, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,225,90,.5)'; for (let x = 4 - to; x < 90; x += 16) ctx.fillRect(x - 1, 67, 2, 2);
      ctx.restore();
      // Wedge armor skirt + hull + cyan turret cap.
      ctx.fillStyle = '#3a1c5e'; ctx.beginPath(); ctx.moveTo(4, 60); ctx.lineTo(14, 40); ctx.lineTo(80, 40); ctx.lineTo(90, 60); ctx.closePath(); ctx.fill();
      drawBox3D(8, 22, 82, 44, '#6943c8', 9);
      drawBox3D(18, 2, 56, 24, '#31e8ff', 6);
      ctx.fillStyle = '#120b2e'; ctx.fillRect(24, 28, 48, 24);
      drawKawaiiEyes(30, 54, 33, 11, 4);
      ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(22, 6, 20, 3);
    } else if (e.type === 'turret') {
      // Rotating radar fin above a pop-up dome.
      ctx.save(); ctx.translate(37, 22); ctx.rotate(Math.sin(e.t * 2) * .9);
      ctx.fillStyle = '#a8b7d6'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(26, -6); ctx.lineTo(26, 6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#31e8ff'; ctx.fillRect(-2, -10, 4, 12); ctx.restore();
      // Aiming barrel: pivots toward Gro-chan.
      const pivx = 34, pivy = 40;
      let ang = Math.atan2((player.y + 51) - (e.y + pivy), (player.x + 59) - (e.x + pivx));
      ang = clamp(ang, Math.PI * .62, Math.PI * 1.38);
      ctx.save(); ctx.translate(pivx, pivy); ctx.rotate(ang);
      const barrel = ctx.createLinearGradient(0, -5, 0, 5);
      barrel.addColorStop(0, '#ffe15a'); barrel.addColorStop(1, '#9a6a10');
      ctx.fillStyle = barrel; ctx.fillRect(0, -5, 40, 10);
      ctx.fillStyle = '#120b2e'; ctx.fillRect(36, -3, 8, 6); ctx.restore();
      // Dome base + hull.
      drawBox3D(6, 44, 62, 24, '#3a2068', 7);
      drawBox3D(14, 26, 46, 30, '#6943c8', 6);
      ctx.fillStyle = '#ff3e9d'; ctx.fillRect(20, 32, 30, 14);
      drawKawaiiEyes(24, 38, 35, 7, 2);
      drawCylinder3D(8, 66, 18, 5, '#31e8ff');
      drawCylinder3D(46, 66, 18, 5, '#31e8ff');
    } else if (e.type === 'jelly') {
      // Atolla wyvillei (クロカムリクラゲ). The deep groove ringing the bell is
      // the "crown" the coronate jellies are named for, and the single
      // hypertrophied trailing tentacle is its signature — twenty short ones
      // around the rim, then one enormously longer than the rest.
      //
      // Its famous burglar-alarm bioluminescence fires when the animal is
      // attacked, which is exactly when this one already scatters its dying
      // radial volley (see destroyEnemy). The light and the attack are one event.
      const pulse = Math.sin(e.t * 3.2);
      const bw = 28 + pulse * 3, bh = 15 - pulse * 3;
      const cx = 31, cy = 28;
      const alarm = clamp((e.hit || 0) * 7 + (e.hp / e.maxHp < .5 ? .3 : 0), 0, 1);
      // Trailing tentacle, streaming far below the bell.
      ctx.strokeStyle = 'rgba(255,120,128,.8)'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx + 5, cy + 8);
      ctx.bezierCurveTo(cx + 26, cy + 32, cx + 10, cy + 58, cx + 28 + Math.sin(e.t * 1.8) * 12, cy + 86);
      ctx.stroke();
      // Twenty marginal tentacles, all the same short length.
      ctx.strokeStyle = 'rgba(222,70,90,.75)'; ctx.lineWidth = 1.7;
      for (let i = 0; i < 20; i++) {
        const f = (i + .5) / 20, tx = cx - bw + f * bw * 2;
        const arc = Math.sqrt(Math.max(0, 1 - Math.pow((tx - cx) / bw, 2)));
        const sway = Math.sin(e.t * 4 + i * .8) * 5;
        const y0 = cy + bh * arc * .55;
        ctx.beginPath(); ctx.moveTo(tx, y0);
        ctx.quadraticCurveTo(tx + sway * .5, y0 + 11, tx + sway, y0 + 21);
        ctx.stroke();
      }
      // The stomach hanging under the bell — kept narrow and semi-transparent,
      // or it reads as a solid black band rather than an organ seen through jelly.
      ctx.globalAlpha = .7; ctx.fillStyle = '#5c0f26';
      ctx.beginPath(); ctx.ellipse(cx, cy + 1, bw * .62, bh * .8, 0, 0, Math.PI); ctx.fill();
      ctx.globalAlpha = 1;
      const bell = ctx.createRadialGradient(cx - 9, cy - 9, 2, cx, cy, bw);
      bell.addColorStop(0, '#ffd2c6'); bell.addColorStop(.34, '#e2445c'); bell.addColorStop(.8, '#8e1230'); bell.addColorStop(1, '#46081e');
      ctx.globalAlpha = .95; ctx.fillStyle = bell;
      ctx.beginPath(); ctx.ellipse(cx, cy, bw, bh, 0, Math.PI, 0); ctx.fill();
      ctx.globalAlpha = 1;
      // The crown groove.
      ctx.strokeStyle = 'rgba(58,6,22,.5)'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.ellipse(cx, cy, bw * .62, bh * .62, 0, Math.PI, 0); ctx.stroke();
      // Radial canals, visible through the jelly.
      ctx.strokeStyle = 'rgba(255,196,186,.28)'; ctx.lineWidth = 1.3;
      for (let i = 1; i < 8; i++) {
        const a = Math.PI + i * Math.PI / 8;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * bw * .24, cy + Math.sin(a) * bh * .24);
        ctx.lineTo(cx + Math.cos(a) * bw * .96, cy + Math.sin(a) * bh * .96);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,.32)';
      ctx.beginPath(); ctx.ellipse(cx - 10, cy - 8, 8, 3.5, -.5, 0, Math.PI * 2); ctx.fill();
      if (alarm > 0) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = alarm * (.55 + Math.sin(e.t * 22) * .45);
        const ag = ctx.createRadialGradient(cx, cy, 2, cx, cy, bw * 1.6);
        ag.addColorStop(0, 'rgba(127,220,255,.45)'); ag.addColorStop(1, 'rgba(127,220,255,0)');
        ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(cx, cy, bw * 1.6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#9fe6ff'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(cx, cy, bw * .8, bh * .8, 0, Math.PI, 0); ctx.stroke();
        ctx.restore();
      }
      // Rhopalia: the sensory bodies spaced around the rim, which really do
      // carry light-sensing ocelli. Two of them stand in as the face.
      drawFishEye(24, 22, 4.5, e); drawFishEye(38, 22, 4.5, e);
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
      // Mobula birostris (オニイトマキエイ), seen from above with the head to the
      // left like every other enemy. Three things separate a real manta from a
      // generic ray: the terminal mouth right at the FRONT of the head (a devil
      // ray's sits underneath), the pair of cephalic fins it rolls into horns
      // while cruising and unfurls to feed, and the white shoulder blaze — the
      // marking individual animals are actually catalogued by.
      const beat = e.t * 3.2;
      // The flap is a wave travelling outboard, so the tips always lag the
      // shoulders. A single shared sine makes both wings snap like a bird's.
      const tipU = Math.sin(beat) * 11, tipD = Math.sin(beat + .4) * 11;
      const midU = Math.sin(beat - .55) * 6, midD = Math.sin(beat - .15) * 6;
      const wing = (up) => {
        const t = up ? tipU : tipD, m = up ? midU : midD, s = up ? -1 : 1;
        ctx.moveTo(12, 26);
        ctx.quadraticCurveTo(30, 26 + s * (22 + m), 62, 26 + s * (26 + t));
        ctx.quadraticCurveTo(58, 26 + s * 12, 82, 26 + s * 5);
        ctx.lineTo(80, 26);
      };
      // Far side of the wings, offset down-right: the manta has real thickness.
      ctx.fillStyle = '#03121f';
      ctx.beginPath(); ctx.save(); ctx.translate(3, 4);
      wing(true); wing(false); ctx.closePath(); ctx.restore(); ctx.fill();
      // Dorsal surface.
      const skin = ctx.createLinearGradient(0, -4, 0, 58);
      skin.addColorStop(0, '#7fd6ff'); skin.addColorStop(.34, '#2f6fd8'); skin.addColorStop(.62, '#123f7d'); skin.addColorStop(1, '#061f3f');
      ctx.fillStyle = skin;
      ctx.beginPath(); wing(true); wing(false); ctx.closePath(); ctx.fill();
      ctx.save(); ctx.clip();
      // White shoulder blaze, one lobe per side of the spine.
      ctx.fillStyle = 'rgba(236,250,255,.82)';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(24, 26 + s * 3);
        ctx.quadraticCurveTo(38, 26 + s * 16, 56, 26 + s * 12);
        ctx.quadraticCurveTo(42, 26 + s * 6, 34, 26 + s * 2);
        ctx.closePath(); ctx.fill();
      }
      // Wing-tip highlight where the light catches the raised edge.
      ctx.fillStyle = 'rgba(255,255,255,.18)';
      ctx.beginPath(); ctx.ellipse(46, 26 + midU * .5 - 12, 20, 5, -.25, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // Cephalic fins: rolled forward horns, the manta's most distinctive part.
      // Lit paler than the body or they vanish into it against dark water.
      for (const s of [-1, 1]) {
        const curl = Math.sin(e.t * 2 + s) * .2;
        ctx.strokeStyle = '#0b2a4c'; ctx.lineWidth = 7; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(16, 26 + s * 7);
        ctx.quadraticCurveTo(1, 26 + s * (11 + curl * 8), 3, 26 + s * 2);
        ctx.stroke();
        ctx.strokeStyle = '#4f95d8'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(16, 26 + s * 7);
        ctx.quadraticCurveTo(1, 26 + s * (11 + curl * 8), 3, 26 + s * 2);
        ctx.stroke();
      }
      // Terminal mouth: a wide slot across the very front of the head, with the
      // pale lip a feeding manta shows. Rounded, not a bolted-on black box.
      ctx.fillStyle = '#04101c';
      ctx.beginPath(); ctx.ellipse(13, 26, 5, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(170,225,255,.45)';
      ctx.beginPath(); ctx.ellipse(13, 21, 4, 1.8, 0, 0, Math.PI * 2); ctx.fill();
      // Whip tail with the small dorsal fin at its base.
      ctx.fillStyle = '#123f7d';
      ctx.beginPath(); ctx.moveTo(74, 22); ctx.lineTo(82, 15); ctx.lineTo(84, 26); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#0d2f5c'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(80, 26);
      ctx.quadraticCurveTo(98, 26 + Math.sin(beat - 1) * 7, 116, 26 + Math.sin(beat - 1.8) * 11);
      ctx.stroke();
      // A manta's eyes sit on the sides of the head, so both are visible from
      // above — small and set back behind the cephalic fins, not up front.
      drawFishEye(22, 19, 3.4, e); drawFishEye(22, 33, 3.4, e);
    } else if (e.type === 'walker') {
      // Two-joint chicken-walker legs (thigh + shin) with a stepping gait.
      const step = Math.sin(e.t * 7) * 8;
      for (const [hipx, ph] of [[26, 0], [58, Math.PI]]) {
        const sw = Math.sin(e.t * 7 + ph) * 8;
        const kneeX = hipx - 8 + sw, kneeY = 66;
        const footX = hipx - 12 + sw * .3, footY = 90;
        ctx.strokeStyle = '#1a0c14'; ctx.lineWidth = 12; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(hipx, 56); ctx.lineTo(kneeX, kneeY); ctx.lineTo(footX, footY); ctx.stroke();
        ctx.strokeStyle = '#ff8a35'; ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.moveTo(hipx, 56); ctx.lineTo(kneeX, kneeY); ctx.lineTo(footX, footY); ctx.stroke();
        ctx.fillStyle = '#ffe15a'; ctx.beginPath(); ctx.arc(kneeX, kneeY, 3, 0, Math.PI * 2); ctx.fill();
      }
      // Shoulder cannon.
      const sc = ctx.createLinearGradient(0, 6, 0, 18);
      sc.addColorStop(0, '#8a8fb5'); sc.addColorStop(1, '#2a1c30');
      ctx.fillStyle = sc; ctx.fillRect(52, 6, 30, 11);
      ctx.fillStyle = '#0c0a1e'; ctx.fillRect(78, 8, 7, 7);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = hexA('#ff5a36', .5);
      ctx.beginPath(); ctx.arc(85, 11, 3 + Math.abs(Math.sin(e.t * 4)) * 2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      // Cockpit hull + canopy.
      drawBox3D(8, 16, 68, 46, '#6e3548', 8);
      drawBox3D(16, 4, 50, 18, '#d04b3f', 5);
      ctx.fillStyle = '#15080d'; ctx.fillRect(18, 26, 47, 22);
      drawKawaiiEyes(24, 48, 30, 11, 3);
      const canopy = ctx.createLinearGradient(20, 6, 40, 20);
      canopy.addColorStop(0, '#ffd6a0'); canopy.addColorStop(1, '#ff5a36');
      ctx.fillStyle = canopy; ctx.beginPath(); ctx.ellipse(40, 13, 18, 7, 0, Math.PI, 0); ctx.fill();
      // Chin gun.
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
    } else if (e.type === 'dumbo') {
      // Grimpoteuthis (メンダコ). Anatomy kept honest: a gelatinous bell mantle,
      // the pair of ear-like fins it actually rows with, and eight short arms
      // fused into a webbed umbrella it pulses. Colours stay neon-pink so it
      // still belongs on the same screen as the mecha.
      const flap = Math.sin(e.t * 3.1);
      const pulse = 1 + Math.sin(e.t * 2.1) * .07;
      // Ear fins: large, rounded and set high on the mantle, where they sit on
      // the real animal — they are its whole means of propulsion, not a detail.
      for (const s of [-1, 1]) {
        ctx.save(); ctx.translate(38 + s * 17, 16); ctx.rotate(s * (.14 + flap * .30));
        const fin = ctx.createLinearGradient(0, -14, 0, 12);
        fin.addColorStop(0, '#ffdcf1'); fin.addColorStop(.5, '#e777c8'); fin.addColorStop(1, '#8a2a80');
        ctx.fillStyle = fin;
        // A long, flat paddle tapering to a soft point — a swimming fin, not a
        // round mouse ear. These are the animal's only means of propulsion.
        ctx.beginPath(); ctx.moveTo(0, -5);
        ctx.bezierCurveTo(s * 18, -17, s * 36, -15, s * 41, -4);
        ctx.bezierCurveTo(s * 34, 4, s * 15, 8, 0, 7);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(96,16,80,.35)'; ctx.lineWidth = 1.2;
        for (let i = 1; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(s * 2, 0); ctx.lineTo(s * (8 + i * 7.5), -9 + i * 3.4); ctx.stroke(); }
        ctx.restore();
      }
      // Webbed arm skirt, hanging clear below the mantle and flaring wider than
      // it, with a scalloped hem — one lobe per arm — so the umbrella reads as
      // its own volume instead of merging into the bell.
      ctx.save(); ctx.translate(38, 40); ctx.scale(pulse, 2 - pulse);
      const web = ctx.createLinearGradient(0, -6, 0, 26);
      web.addColorStop(0, '#7b1f78'); web.addColorStop(.5, '#571459'); web.addColorStop(1, '#2a0730');
      ctx.fillStyle = web;
      ctx.beginPath();
      ctx.moveTo(-24, -6);
      ctx.quadraticCurveTo(-33, 8, -30, 17);
      for (let i = 0; i < 8; i++) {
        const x0 = -30 + i * 7.5;
        ctx.quadraticCurveTo(x0 + 3.75, 26 + Math.sin(e.t * 3 + i * .8) * 2.5, x0 + 7.5, 17);
      }
      ctx.quadraticCurveTo(33, 8, 24, -6);
      ctx.closePath(); ctx.fill();
      // Suckers picked out along the two front arms, the only ones facing us.
      ctx.fillStyle = 'rgba(255,190,235,.35)';
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(-13 + (i % 2) * 26, 2 + Math.floor(i / 2) * 6, 2, 0, Math.PI * 2); ctx.fill(); }
      // Cirri: the fine filaments that trail past the hem.
      ctx.strokeStyle = 'rgba(234,164,221,.85)'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
      for (let i = 0; i < 8; i++) {
        const ax = -26 + i * 7.5, sway = Math.sin(e.t * 3.4 + i * .8) * 5;
        ctx.beginPath(); ctx.moveTo(ax, 22); ctx.quadraticCurveTo(ax + sway * .5, 28, ax + sway, 33); ctx.stroke();
      }
      ctx.restore();
      // Bell mantle: a dome with a flat base, not a sphere — the profile is what
      // separates a dumbo octopus from the jellyfish two lanes over. The colour
      // drifts on a slow cycle because octopus skin genuinely does: expanding
      // and contracting chromatophores flush it darker and paler in waves.
      const flush = .5 + Math.sin(e.t * .9) * .5;
      const dome = ctx.createRadialGradient(28, 12, 3, 38, 26, 32);
      dome.addColorStop(0, flush > .5 ? '#fff2fa' : '#ffe0f2');
      dome.addColorStop(.42, flush > .5 ? '#f7a3e0' : '#e77ac6');
      dome.addColorStop(1, flush > .5 ? '#8b2483' : '#6a1563');
      ctx.fillStyle = dome;
      ctx.beginPath(); ctx.moveTo(13, 40);
      ctx.bezierCurveTo(10, 4, 66, 4, 63, 40);
      ctx.closePath(); ctx.fill();
      // Papillae: the skin bumps an octopus raises for texture, clipped to the bell.
      ctx.save(); ctx.clip();
      for (let i = 0; i < 14; i++) {
        const px = 15 + ((i * 37) % 48), py = 8 + ((i * 23) % 30);
        ctx.fillStyle = `rgba(255,255,255,${.06 + (i % 3) * .05})`;
        ctx.beginPath(); ctx.ellipse(px, py, 3.2, 2.2, .4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(120,20,105,.14)';
        ctx.beginPath(); ctx.ellipse(px, py + 2.6, 3.2, 1.6, .4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      // The U-shaped internal shell, visible through the jelly — a real Grimpoteuthis tell.
      ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 3.4;
      ctx.beginPath(); ctx.arc(38, 20, 15, .42, Math.PI - .42); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.4)';
      ctx.beginPath(); ctx.ellipse(27, 14, 9, 5, -.55, 0, Math.PI * 2); ctx.fill();
      // The eyes of a dumbo octopus are enormous for its size, and sit low and
      // wide on the bell rather than up front like a fish's.
      drawFishEye(29, 31, 7.5, e); drawFishEye(48, 31, 7.5, e);
    } else if (e.type === 'angler') {
      // Melanocetus (チョウチンアンコウ): a black sphere that is mostly mouth.
      // The illicium arcs over the snout and the esca on its tip is the only
      // real light in the frame — and it burns up as the shot charges, so the
      // lure is the wind-up telegraph rather than a bolted-on glow.
      const charge = e.fireMax > 0 ? clamp(1 - e.fire / e.fireMax, 0, 1) : .5;
      const glow = .3 + charge * .7 + Math.sin(e.t * 7) * .07;
      const gape = 5 + Math.sin(e.t * 2.1) * 3 + charge * 8;
      const lx = 13, ly = 13;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const lg = ctx.createRadialGradient(lx, ly, 1, lx, ly, 38);
      lg.addColorStop(0, hexA('#f2ffff', .9 * glow)); lg.addColorStop(.3, hexA('#65fff2', .5 * glow)); lg.addColorStop(1, 'rgba(101,255,242,0)');
      ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(lx, ly, 38, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#0b1620';
      ctx.beginPath(); ctx.moveTo(70, 32); ctx.lineTo(88, 20); ctx.lineTo(86, 62); ctx.lineTo(70, 54); ctx.closePath(); ctx.fill();
      const bg = ctx.createRadialGradient(40, 30, 3, 50, 46, 36);
      bg.addColorStop(0, '#31586c'); bg.addColorStop(.45, '#132430'); bg.addColorStop(1, '#04090f');
      ctx.fillStyle = bg; ctx.beginPath(); ctx.ellipse(50, 45, 30, 26, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .45 * glow;
      ctx.strokeStyle = '#65fff2'; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.ellipse(50, 45, 30, 26, 0, Math.PI * .78, Math.PI * 1.62); ctx.stroke(); ctx.restore();
      ctx.fillStyle = '#12060c';
      ctx.beginPath(); ctx.moveTo(48, 44); ctx.lineTo(15, 30 - gape * .4); ctx.lineTo(13, 56 + gape * .6); ctx.closePath(); ctx.fill();
      // Needle teeth: long and thin, the way a Melanocetus's are — chunky
      // triangles turn it into a cartoon shark.
      ctx.fillStyle = '#e6f4ff';
      for (let i = 0; i < 8; i++) {
        const p = .14 + (i / 7) * .86;    // offset off the hinge so they don't pile up there
        const ux = 46 - p * 31, uy = 44 - p * (13 + gape * .4);
        ctx.beginPath(); ctx.moveTo(ux, uy); ctx.lineTo(ux - 1.6, uy + 11); ctx.lineTo(ux + 2, uy + 10); ctx.closePath(); ctx.fill();
        const bx = 46 - p * 33, by = 44 + p * (11 + gape * .6);
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - 1.6, by - 11); ctx.lineTo(bx + 2, by - 10); ctx.closePath(); ctx.fill();
      }
      // Loose, flabby skin: a deep-sea angler has no scales and hangs slack, and
      // its stomach distends enormously — these folds are what sell that.
      ctx.strokeStyle = 'rgba(120,180,200,.16)'; ctx.lineWidth = 1.8;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.arc(50 + i * 7, 45, 20 - i * 4, -.9, 1.1); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(140,200,220,.2)'; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(38, 46, 15, -1.3, 1.5); ctx.stroke();   // gill slit behind the jaw
      // Pectoral fin with visible rays.
      ctx.fillStyle = 'rgba(60,110,132,.75)';
      ctx.beginPath(); ctx.moveTo(52, 58); ctx.quadraticCurveTo(48, 74, 62, 70); ctx.quadraticCurveTo(58, 62, 52, 58); ctx.fill();
      ctx.strokeStyle = 'rgba(180,230,245,.3)'; ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(53, 60); ctx.lineTo(50 + i * 4, 71); ctx.stroke(); }
      // Illicium: a fleshy rod, thicker at the base where it leaves the snout.
      ctx.strokeStyle = '#20394a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(44, 22); ctx.quadraticCurveTo(26, 0, lx, ly); ctx.stroke();
      ctx.strokeStyle = '#33566b'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(44, 22); ctx.quadraticCurveTo(27, 1, lx, ly); ctx.stroke();
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      // Esca filaments: the bait is a bulb with fine wisps trailing off it.
      ctx.strokeStyle = hexA('#9ffff2', .5 * glow); ctx.lineWidth = 1.4;
      for (let i = 0; i < 4; i++) {
        const a = -2.4 + i * .55 + Math.sin(e.t * 2.2 + i) * .22;
        ctx.beginPath(); ctx.moveTo(lx, ly);
        ctx.lineTo(lx + Math.cos(a) * 13, ly + Math.sin(a) * 13); ctx.stroke();
      }
      ctx.fillStyle = hexA('#eaffff', .95); ctx.beginPath(); ctx.arc(lx, ly, 5 + charge * 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      drawFishEye(35, 33, 4.5, e);
    } else if (e.type === 'oarfish') {
      // Regalecus glesne (リュウグウノツカイ). It hangs head-up and swims by
      // rippling the crimson dorsal fin alone while the body stays nearly
      // straight — that posture is what makes it a vertical pillar in the lane
      // instead of one more horizontal fish.
      const N = 12;
      const pts = [];
      for (let i = 0; i <= N; i++) pts.push({ x: 32 + Math.sin(e.t * 1.7 - i * .42) * (1 + i * .75), y: 30 + i * 13 });
      const half = i => 12 - i * .72;   // tapers to a thread at the tail
      // The crimson dorsal fin hugs the leading edge for the whole length, and
      // it is the only thing that ripples — the body itself stays nearly rigid.
      const finGrad = ctx.createLinearGradient(4, 0, 32, 0);
      finGrad.addColorStop(0, '#ff5a7e'); finGrad.addColorStop(.5, '#d81c46'); finGrad.addColorStop(1, '#7d0f2c');
      ctx.fillStyle = finGrad;
      // Starts below the head so the crest of head rays stays legible above it.
      ctx.beginPath();
      for (let i = 1; i <= N; i++) {
        const p = pts[i], edge = p.x - half(i);
        const web = 5 + Math.sin(e.t * 5 - i * .8) * 3.2;
        ctx[i > 1 ? 'lineTo' : 'moveTo'](edge - web, p.y);
      }
      for (let i = N; i >= 1; i--) ctx.lineTo(pts[i].x - half(i) + 1.5, pts[i].y);
      ctx.closePath(); ctx.fill();
      // Individual dorsal fin rays. On a real oarfish the whole fin is a comb of
      // several hundred separate rays, and it is the only part of it that moves.
      ctx.strokeStyle = 'rgba(122,10,38,.5)'; ctx.lineWidth = 1;
      for (let i = 1; i <= N; i += .5) {
        const j = Math.min(N, Math.round(i)), p = pts[j];
        const edge = p.x - half(j), web = 5 + Math.sin(e.t * 5 - i * .8) * 3.2;
        ctx.beginPath(); ctx.moveTo(edge + 1, p.y + (i - j) * 14); ctx.lineTo(edge - web, p.y + (i - j) * 14 - 2); ctx.stroke();
      }
      // Silver ribbon body, tapering to a point.
      ctx.beginPath();
      for (let i = 0; i <= N; i++) ctx[i ? 'lineTo' : 'moveTo'](pts[i].x - half(i), pts[i].y);
      ctx.lineTo(pts[N].x, pts[N].y + 12);
      for (let i = N; i >= 0; i--) ctx.lineTo(pts[i].x + half(i), pts[i].y);
      ctx.closePath();
      const silver = ctx.createLinearGradient(18, 0, 46, 0);
      silver.addColorStop(0, '#fbfeff'); silver.addColorStop(.3, '#d3e2f0'); silver.addColorStop(.66, '#8ba4bd'); silver.addColorStop(1, '#3b5570');
      ctx.fillStyle = silver; ctx.fill();
      ctx.save(); ctx.clip();
      // The dark flank bars of a real oarfish: soft, vertically stretched, not spots.
      ctx.fillStyle = 'rgba(40,62,92,.32)';
      for (let i = 2; i <= N; i += 2) { const p = pts[i]; ctx.beginPath(); ctx.ellipse(p.x + 2, p.y, 9, 5, 0, 0, Math.PI * 2); ctx.fill(); }
      // Guanine iridescence: the silver is a crystal layer, so it throws faint
      // colour bands rather than reading as flat grey metal.
      for (let i = 0; i < 5; i++) {
        const g2 = ctx.createLinearGradient(16, 30 + i * 34, 46, 62 + i * 34);
        g2.addColorStop(0, 'rgba(150,220,255,0)');
        g2.addColorStop(.5, i % 2 ? 'rgba(190,160,255,.22)' : 'rgba(140,235,255,.22)');
        g2.addColorStop(1, 'rgba(150,220,255,0)');
        ctx.fillStyle = g2; ctx.fillRect(14, 26 + i * 34, 34, 34);
      }
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(20, 30, 4, 150);   // specular strip
      ctx.restore();
      // Crest of elongated first dorsal rays, streaming up off the head.
      // Fanned apart at the tips so they read as separate rays, not a red slab.
      ctx.strokeStyle = '#ff3d63'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const bx = 25 + i * 4.5, sway = Math.sin(e.t * 3.6 - i * .7) * 6;
        const tip = bx - 14 + i * 7 + sway;
        ctx.beginPath(); ctx.moveTo(bx, 24); ctx.quadraticCurveTo((bx + tip) / 2, 11, tip, 0); ctx.stroke();
      }
      // Blunt head, small protrusible mouth, big round eye.
      const headG = ctx.createLinearGradient(19, 0, 45, 0);
      headG.addColorStop(0, '#ffffff'); headG.addColorStop(.55, '#cfdfee'); headG.addColorStop(1, '#67809b');
      ctx.fillStyle = headG;
      ctx.beginPath(); ctx.ellipse(32, 30, 13, 17, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#59718c';
      ctx.beginPath(); ctx.moveTo(21, 30); ctx.lineTo(12, 35); ctx.lineTo(21, 39); ctx.closePath(); ctx.fill();
      // Gill cover.
      ctx.strokeStyle = 'rgba(70,96,124,.5)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(38, 32, 9, -1.1, 1.1); ctx.stroke();
      drawFishEye(29, 27, 6, e);
      // The two long pelvic rays — the "oars" the common name comes from. They
      // hang outside the leading edge so they never cross the body.
      for (const s of [0, 1]) {
        const sway = Math.sin(e.t * 2.6 - s * 1.1) * 9;
        const x0 = 22 - s * 3, tipX = 8 - s * 5 + sway, tipY = 118 + s * 26;
        ctx.strokeStyle = '#e0244a'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x0, 44);
        ctx.quadraticCurveTo(x0 - 10 + sway * .4, (44 + tipY) / 2, tipX, tipY); ctx.stroke();
        ctx.fillStyle = '#e0244a';
        ctx.beginPath(); ctx.ellipse(tipX, tipY + 7, 4, 8, .25, 0, Math.PI * 2); ctx.fill();
      }
    } else if (e.type === 'moray') {
      drawGiantMoray(e);
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
      // Kept, but dialled back so the new per-boss damage colour reads through it.
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(.35, e.hit * 4);
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
    // Wind-up: a soft pulsing charge glow in the last stretch before the next shot,
    // telegraphing an attack without needing bespoke muzzle art per enemy type.
    if (e.fireMax > 0 && e.fire > 0) {
      const windup = 1 - e.fire / e.fireMax;
      if (windup > .78) {
        const wt = (windup - .78) / .22;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = wt * (.3 + Math.sin(e.t * 30) * .15);
        const wg = ctx.createRadialGradient(e.w * .5, e.h * .5, 1, e.w * .5, e.h * .5, e.w * .58);
        wg.addColorStop(0, 'rgba(255,255,255,.85)'); wg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = wg; ctx.beginPath(); ctx.arc(e.w * .5, e.h * .5, e.w * .55, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
    const organic = isOrganic(e.type);
    // Damage state. Machines spall — cracked plating and a spitting ember.
    // Flesh doesn't: a wounded creature gets torn edges and a bioluminescent
    // bleed instead, so the same "nearly dead" read works on both.
    if (e.maxHp > 1 && e.hp / e.maxHp < .4) {
      if (organic) {
        ctx.save(); ctx.globalAlpha = .55; ctx.strokeStyle = 'rgba(180,30,80,.75)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(e.w * .3, e.h * .3); ctx.quadraticCurveTo(e.w * .42, e.h * .44, e.w * .34, e.h * .6);
        ctx.moveTo(e.w * .58, e.h * .24); ctx.quadraticCurveTo(e.w * .66, e.h * .36, e.w * .6, e.h * .48);
        ctx.stroke(); ctx.restore();
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = .28 + Math.abs(Math.sin(e.t * 5)) * .22; ctx.fillStyle = '#ff5a8c';
        ctx.beginPath(); ctx.ellipse(e.w * .4, e.h * .45, e.w * .16, e.h * .13, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else {
        ctx.save(); ctx.globalAlpha = .5; ctx.strokeStyle = 'rgba(15,6,6,.6)'; ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(e.w * .32, e.h * .18); ctx.lineTo(e.w * .44, e.h * .48); ctx.lineTo(e.w * .34, e.h * .74);
        ctx.moveTo(e.w * .6, e.h * .14); ctx.lineTo(e.w * .68, e.h * .42);
        ctx.stroke(); ctx.restore();
        if (Math.sin(e.t * 11 + e.w) > .82) {
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .8; ctx.fillStyle = '#ffb347';
          ctx.beginPath(); ctx.arc(e.w * .4, e.h * .42, 2.2, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
      }
    }
    // Stage-color decal: a small squad-insignia badge ties every enemy back
    // to the current stage's palette, independent of the type's own colors.
    // Wildlife carries no unit markings, so organics are exempt.
    if (e.type !== 'ember' && !organic) {
      const stage = stages[stageIndex];
      ctx.save(); ctx.globalAlpha = .65; ctx.fillStyle = stage.accent2;
      ctx.beginPath(); ctx.roundRect(e.w - 14, e.h - 14, 9, 9, 2); ctx.fill();
      ctx.globalAlpha = .9; ctx.fillStyle = stage.accent;
      ctx.beginPath(); ctx.arc(e.w - 9.5, e.h - 9.5, 2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    if (e.variant === 'standard') return;
    if (organic) {
      // Same two tiers, read biologically: an elite is a bioluminescent display
      // animal, an armored one carries thickened plates of scute along its back.
      ctx.save();
      if (e.variant === 'elite') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = .45 + Math.sin(e.t * 4) * .18;
        const eg = ctx.createRadialGradient(e.w * .5, e.h * .45, 2, e.w * .5, e.h * .45, e.w * .62);
        eg.addColorStop(0, 'rgba(255,225,90,.55)'); eg.addColorStop(.6, 'rgba(255,120,200,.3)'); eg.addColorStop(1, 'rgba(255,120,200,0)');
        ctx.fillStyle = eg;
        ctx.beginPath(); ctx.ellipse(e.w * .5, e.h * .45, e.w * .6, e.h * .5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = .85; ctx.fillStyle = '#ffe15a';
        for (let i = 0; i < 5; i++) {
          const a = e.t * 1.6 + i * 1.26;
          ctx.beginPath(); ctx.arc(e.w * .5 + Math.cos(a) * e.w * .34, e.h * .45 + Math.sin(a) * e.h * .3, 2.4, 0, Math.PI * 2); ctx.fill();
        }
      } else {
        ctx.globalAlpha = .45; ctx.fillStyle = '#cfe6ff';
        for (let x = 12; x < e.w - 8; x += 15) {
          ctx.beginPath();
          ctx.ellipse(x, e.h * .2, 5, 3, -.3, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.restore();
      return;
    }
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

  // Gymnothorax javanicus — the giant moray, and the only regular enemy in the
  // game drawn at encounter scale. The 150×92 box is its HEAD; roughly 350 more
  // pixels of body trail off to the right of it and are never shootable, which
  // is exactly how you meet one over a reef: all you get is the head.
  //
  // Everything here is anatomy the real animal has and the earlier pass didn't:
  // the continuous dorsal-caudal-anal fin ribbon, two scales of blotching (fine
  // speckle on the head growing into big dark saddles down the body), the single
  // round gill opening, tubular anterior nostrils, a gold iris, recurved teeth of
  // graded length with the vomerine row behind them, and the mucus sheen morays
  // are covered in. The idle gape is gill pumping, not a chewing wobble.
  function drawGiantMoray(e) {
    const strike = e.lunge > 0 ? 1 : e.recoil > 0 ? .45 : 0;
    const N = 10, SEG = 34, HINGE_X = 128, HINGE_Y = 52;
    // Travelling wave: amplitude grows toward the tail and the phase lags with
    // distance, so the body swims as one muscle instead of bobbing in place.
    const seg = [];
    for (let i = 0; i <= N; i++) {
      seg.push({
        x: 140 + i * SEG,
        y: HINGE_Y + Math.sin(e.t * 2 - i * .5) * (4 + i * 3.2),
        r: 31 - i * 2.5,
      });
    }
    // Sample the spine between segments so fin rays and blotches can be placed
    // at any density without needing more segments.
    const at = u => {
      const i = Math.min(N - 1, Math.max(0, Math.floor(u))), f = clamp(u - i, 0, 1);
      const a = seg[i], b = seg[i + 1];
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, r: a.r + (b.r - a.r) * f };
    };
    const tipX = seg[N].x + 34, tipY = seg[N].y;
    // Stable per-index noise — Math.random() here would make the pattern crawl.
    const rnd = (i, k) => { const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };

    // --- median fin ribbon (dorsal → caudal → anal), drawn behind the body ---
    const dorsalH = u => 10 + Math.sin(u * .8 - e.t * 2.6) * 2.5 + Math.min(u, 1.5) * 3;
    const analH = u => 7 + Math.sin(u * .9 - e.t * 2.6 + 1) * 2;
    const fin = ctx.createLinearGradient(0, 4, 0, 96);
    fin.addColorStop(0, '#eaf3c2'); fin.addColorStop(.3, '#587f38'); fin.addColorStop(1, '#1e3a1e');
    // One simple non-self-intersecting loop: over the top, round the caudal tip,
    // back under the rear half as the anal fin, then flush along the belly. The
    // body is painted over the middle of it afterwards.
    ctx.fillStyle = fin;
    ctx.beginPath();
    for (let u = 0; u <= N; u += .25) { const p = at(u); ctx[u ? 'lineTo' : 'moveTo'](p.x, p.y - p.r - dorsalH(u)); }
    ctx.quadraticCurveTo(tipX + 14, tipY - 6, tipX + 12, tipY);
    ctx.quadraticCurveTo(tipX + 14, tipY + 6, seg[N].x, seg[N].y + seg[N].r + analH(N));
    for (let u = N; u >= 4; u -= .25) { const p = at(u); ctx.lineTo(p.x, p.y + p.r + analH(u)); }
    for (let u = 4; u >= 0; u -= .25) { const p = at(u); ctx.lineTo(p.x, p.y + p.r); }
    ctx.closePath(); ctx.fill();
    // Individual fin rays — faint and unevenly spaced, or they read as a zipper.
    ctx.strokeStyle = 'rgba(26,48,22,.15)'; ctx.lineWidth = 1.2;
    // Jittered spacing: evenly spaced rays read as a zip fastener, not a fin.
    // Thinned out first when frames get tight.
    const rayStep = [.9, .55, .3][bgQuality()];
    for (let u = .2; u <= N; u += rayStep + rnd(Math.round(u * 3), 41) * .3) {
      const p = at(u), len = (dorsalH(u) - 4) * (.5 + rnd(u * 7, 31) * .4);
      ctx.beginPath(); ctx.moveTo(p.x, p.y - p.r); ctx.lineTo(p.x + 2.5, p.y - p.r - len); ctx.stroke();
      if (u > 4.2) { ctx.beginPath(); ctx.moveTo(p.x, p.y + p.r); ctx.lineTo(p.x + 2, p.y + p.r + analH(u) - 2); ctx.stroke(); }
    }
    // Pale fin margin — the light edge that outlines a moray against dark water.
    ctx.strokeStyle = 'rgba(240,248,206,.5)'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let u = 0; u <= N; u += .25) { const p = at(u); ctx[u ? 'lineTo' : 'moveTo'](p.x, p.y - p.r - dorsalH(u)); }
    ctx.stroke();

    // --- body ------------------------------------------------------------
    ctx.beginPath();
    for (let u = 0; u <= N; u += .25) { const p = at(u); ctx[u ? 'lineTo' : 'moveTo'](p.x, p.y - p.r); }
    ctx.lineTo(tipX, tipY);
    for (let u = N; u >= 0; u -= .25) { const p = at(u); ctx.lineTo(p.x, p.y + p.r); }
    ctx.closePath();
    const skin = ctx.createLinearGradient(0, 8, 0, 96);
    skin.addColorStop(0, '#e2eda6'); skin.addColorStop(.3, '#8fb355'); skin.addColorStop(.62, '#5d8639'); skin.addColorStop(1, '#22401f');
    ctx.fillStyle = skin; ctx.fill();

    // Everything below is clipped to the body, so no blotch, sheen or belly
    // band can ever spill into the open water beside it.
    ctx.save(); ctx.clip();
    // Big dark saddles: the pattern that actually identifies a giant moray.
    // They start small behind the head and swell toward mid-body.
    for (let i = 0; i < 26; i++) {
      const u = .6 + i * .38;
      const p = at(u), grow = Math.min(1, u / 4);
      ctx.fillStyle = `rgba(30,54,26,${.34 + rnd(i, 3) * .2})`;
      ctx.beginPath();
      ctx.ellipse(p.x + rnd(i, 1) * 12 - 6, p.y + (rnd(i, 2) - .5) * p.r * 1.7,
        (7 + rnd(i, 4) * 8) * grow, (6 + rnd(i, 5) * 7) * grow, rnd(i, 6) * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Fine speckle, densest over the head end. This is by far the heaviest loop
    // on the animal, so it rides the same FPS-driven quality tier the background
    // uses — the big saddles above carry the pattern on their own if it's cut.
    const speckles = [18, 36, 54][bgQuality()];
    for (let i = 0; i < speckles; i++) {
      const u = rnd(i, 7) * rnd(i, 8) * N;   // biased toward u=0
      const p = at(u);
      ctx.fillStyle = `rgba(26,46,24,${.3 + rnd(i, 9) * .3})`;
      ctx.beginPath();
      ctx.arc(p.x + (rnd(i, 10) - .5) * 26, p.y + (rnd(i, 11) - .5) * p.r * 1.8, 1.4 + rnd(i, 12) * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Pale belly band.
    ctx.strokeStyle = 'rgba(246,252,216,.42)'; ctx.lineWidth = 9;
    ctx.beginPath();
    for (let u = 0; u <= N; u += .25) { const p = at(u); ctx[u ? 'lineTo' : 'moveTo'](p.x, p.y + p.r - 3); }
    ctx.stroke();
    // Mucus sheen: morays are coated in it, and it is the only specular on them.
    ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 5;
    ctx.beginPath();
    for (let u = .3; u <= N * .8; u += .25) { const p = at(u); ctx[u > .3 ? 'lineTo' : 'moveTo'](p.x, p.y - p.r * .55); }
    ctx.stroke();
    ctx.restore();

    // Single round gill opening behind the head — morays have one small pore
    // instead of a gill cover, and nothing else in the sea looks like it.
    // Placed past u=1.5 so the skull — which now reaches back to +44 to hide the
    // neck seam — does not paint over it.
    const gp = at(1.7);
    ctx.fillStyle = '#16280f';
    ctx.beginPath(); ctx.ellipse(gp.x, gp.y - 4, 7, 9, .2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.beginPath(); ctx.ellipse(gp.x, gp.y - 4, 4, 6, .2, 0, Math.PI * 2); ctx.fill();

    // --- head ------------------------------------------------------------
    // The gape is gill pumping: morays hold their mouth open to drive water over
    // the gills, so it is a hold-and-release rhythm, not a sine wobble.
    const pump = Math.pow(Math.max(0, Math.sin(e.t * 1.7)), .55);
    const open = .09 + pump * .2 + strike * .5;
    // Dark red throat. The hinge is at the BACK of the skull, so the gape is
    // widest at the snout — the wedge has to open forward to match, or the
    // interior shows through behind the jaws instead of between them.
    // It stops well short of the snout tips so the rounded jaw ends always cover
    // its corners, and its height tracks `open` — a fixed wedge sized for a full
    // strike leaves a red sliver hanging below the jaw on every idle frame.
    const gap = 10 + open * 70;
    ctx.fillStyle = '#31101a';
    ctx.beginPath();
    ctx.moveTo(HINGE_X + 20, HINGE_Y - 4); ctx.lineTo(HINGE_X - 70, HINGE_Y - gap * .5);
    ctx.lineTo(HINGE_X - 70, HINGE_Y + gap); ctx.lineTo(HINGE_X + 20, HINGE_Y + 6);
    ctx.closePath(); ctx.fill();

    // Lower jaw. Deep and short — long shallow jaws read as a crocodile, which
    // is the one silhouette this must not be. Its dorsal edge sits exactly on
    // the hinge line (y=0), as does the skull's ventral edge, so the two meet
    // when `open` is 0 and the teeth of both rows stay clear of each other.
    // Negative angle: the hinge is behind the jaw, so this is what drops the
    // snout end and opens the mouth. Positive would swing it shut.
    ctx.save(); ctx.translate(HINGE_X, HINGE_Y);
    // Both jaw gradients span the same world range as the body's (see `skin`),
    // so head and body shade identically and the join never shows as a seam.
    // Built BEFORE the rotate on purpose: a gradient created after it tilts with
    // the jaw, and the shading drifts out of step with the body it joins.
    const lj = ctx.createLinearGradient(0, 8 - HINGE_Y, 0, 96 - HINGE_Y);
    lj.addColorStop(0, '#e2eda6'); lj.addColorStop(.3, '#8fb355'); lj.addColorStop(.62, '#5d8639'); lj.addColorStop(1, '#22401f');
    ctx.rotate(-open);
    ctx.fillStyle = lj;
    ctx.beginPath(); ctx.moveTo(44, 0);
    ctx.lineTo(-82, 0); ctx.quadraticCurveTo(-95, 6, -84, 18); ctx.lineTo(44, 26);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(246,252,216,.35)'; ctx.fillRect(-78, 14, 96, 4);
    // Recurved teeth, longest at the front — a moray's front canines are fangs.
    ctx.fillStyle = '#f4f9e8';
    for (let i = 0; i < 11; i++) {
      const f = i / 10, tx = -76 + i * 9, len = 13 - f * 7;
      ctx.beginPath(); ctx.moveTo(tx, 1); ctx.quadraticCurveTo(tx + 1.5, -len * .6, tx + 3.6, -len);
      ctx.quadraticCurveTo(tx + 4.4, -len * .5, tx + 3.8, 1);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();

    // Upper head: deep cranium with a brow bulge over the eye, blunt snout.
    ctx.save(); ctx.translate(HINGE_X, HINGE_Y);
    const head = ctx.createLinearGradient(0, 8 - HINGE_Y, 0, 96 - HINGE_Y);
    head.addColorStop(0, '#e2eda6'); head.addColorStop(.3, '#8fb355'); head.addColorStop(.62, '#5d8639'); head.addColorStop(1, '#22401f');
    ctx.rotate(open * .45);
    ctx.fillStyle = head;
    // The rear runs back to ~+48 so it overlaps the body's flat leading cut by a
    // wide margin, and it is cut on a diagonal: any residual mismatch along a
    // slanted join disappears, where a vertical one would read as a hard seam.
    ctx.beginPath(); ctx.moveTo(52, -30);
    ctx.bezierCurveTo(-8, -48, -44, -40, -70, -24);
    ctx.quadraticCurveTo(-93, -12, -84, 0);
    ctx.lineTo(38, 8);
    ctx.closePath(); ctx.fill();
    // Head speckle, clipped to the skull.
    ctx.save(); ctx.clip();
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = `rgba(26,46,24,${.25 + rnd(i, 21) * .3})`;
      ctx.beginPath();
      ctx.arc(-82 + rnd(i, 22) * 104, -42 + rnd(i, 23) * 44, 1.3 + rnd(i, 24) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,.16)';
    ctx.beginPath(); ctx.ellipse(-24, -34, 34, 7, -.14, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // Upper tooth row, hanging from the skull's ventral edge.
    ctx.fillStyle = '#f4f9e8';
    for (let i = 0; i < 11; i++) {
      const f = i / 10, tx = -74 + i * 9, len = 12 - f * 6;
      ctx.beginPath(); ctx.moveTo(tx, -1); ctx.quadraticCurveTo(tx + 1.5, len * .6, tx + 3.6, len);
      ctx.quadraticCurveTo(tx + 4.4, len * .5, tx + 3.8, -1);
      ctx.closePath(); ctx.fill();
    }
    // Vomerine teeth: the extra row morays carry on the roof of the mouth,
    // set back from the jaw line and shorter.
    ctx.fillStyle = 'rgba(244,249,232,.8)';
    for (let i = 0; i < 5; i++) { const tx = -40 + i * 9; ctx.beginPath(); ctx.moveTo(tx, -3); ctx.lineTo(tx - 1.6, 4); ctx.lineTo(tx + 1.8, 3); ctx.closePath(); ctx.fill(); }
    // Anterior nostrils are short tubes on the snout tip; the posterior pair are
    // plain pores just ahead of the eye. Both are moray-specific tells.
    ctx.fillStyle = '#41702f';
    ctx.beginPath(); ctx.roundRect(-78, -22, 5, 9, 2); ctx.fill();
    ctx.beginPath(); ctx.roundRect(-68, -28, 5, 9, 2); ctx.fill();
    ctx.fillStyle = 'rgba(20,40,18,.6)';
    ctx.beginPath(); ctx.arc(-44, -28, 2.2, 0, Math.PI * 2); ctx.fill();
    // Eye: gold iris, set high and well forward. The slit pupil tracks Gro-chan
    // the same way drawFishEye's does — being watched by the thing sizing you up
    // is most of what makes a moray unnerving.
    const ex = clamp(((player.x + 56) - (e.x + HINGE_X - 33)) * .006, -1, 1);
    const ey = clamp(((player.y + 60) - (e.y + HINGE_Y - 24)) * .006, -1, 1);
    ctx.fillStyle = '#1c2f14';
    ctx.beginPath(); ctx.arc(-33, -24, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8c24a';
    ctx.beginPath(); ctx.arc(-33, -24, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(120,80,10,.5)';
    for (let i = 0; i < 10; i++) {   // iris striations
      const a = i * Math.PI / 5;
      ctx.beginPath(); ctx.moveTo(-33 + Math.cos(a) * 3, -24 + Math.sin(a) * 3);
      ctx.lineTo(-33 + Math.cos(a) * 7, -24 + Math.sin(a) * 7); ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.fillStyle = '#0d1408';
    ctx.beginPath(); ctx.ellipse(-33 + ex * 2.5, -24 + ey * 2.5, 3, 5.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.beginPath(); ctx.arc(-36, -27, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Pharyngeal jaw: morays carry a second set of jaws in the throat that
    // launches forward to drag prey back. It fires on the strike and retracts.
    if (e.jaw > 0) {
      ctx.save(); ctx.globalAlpha = Math.min(1, e.jaw * 1.4);
      const reach = 52 * e.jaw;
      // Kept narrow, and darker than the outer jaws, so the red throat still
      // frames it — a pale slab filling the whole gape reads as a blocked mouth
      // rather than as a second set of jaws coming out of one.
      const pj = ctx.createLinearGradient(0, HINGE_Y - 14, 0, HINGE_Y + 14);
      pj.addColorStop(0, '#8fb46a'); pj.addColorStop(.5, '#5d833f'); pj.addColorStop(1, '#35522a');
      ctx.fillStyle = pj;
      ctx.beginPath();
      ctx.moveTo(HINGE_X - 6, HINGE_Y - 15); ctx.lineTo(HINGE_X - 46 - reach, HINGE_Y - 9);
      ctx.quadraticCurveTo(HINGE_X - 56 - reach, HINGE_Y + 1, HINGE_X - 46 - reach, HINGE_Y + 11);
      ctx.lineTo(HINGE_X - 6, HINGE_Y + 16);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(22,8,12,.75)'; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.fillStyle = '#f4f9e8';
      for (let i = 0; i < 6; i++) {
        const tx = HINGE_X - 42 - reach + i * 7.5;
        ctx.beginPath(); ctx.moveTo(tx, HINGE_Y - 8); ctx.lineTo(tx - 1.4, HINGE_Y - 1); ctx.lineTo(tx + 1.8, HINGE_Y - 2); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(tx, HINGE_Y + 10); ctx.lineTo(tx - 1.4, HINGE_Y + 3); ctx.lineTo(tx + 1.8, HINGE_Y + 4); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawMidBoss(e) {
    const stage = stages[stageIndex], pulse = 6 + Math.sin(e.t * 7) * 4;
    // Generated WARDEN sprite (one design recolored by each stage's glow) in
    // the 158×132 authoring box; procedural art remains the loading fallback.
    const midSprite = pickPoseFrame(midSets[stageIndex], e) || (frameReady(wardenSprite) ? wardenSprite : null);
    if (midSprite) {
      // Hitbox carries the sprite aspect (see spawnMidBoss) → fill the box.
      const hurt = e.hurtT > 0;
      const breath = Math.sin(e.t * 3.2) * .03;
      ctx.save();
      ctx.translate(79, 132);
      ctx.rotate(Math.sin(e.t * 1.8) * .05 + (hurt ? Math.sin(e.t * 48) * .05 : 0));
      ctx.scale(1 - breath, 1 + breath);
      ctx.translate(-79, -132);
      ctx.shadowColor = hurt ? 'rgba(255,80,80,.95)' : hexA(stage.accent, .9);
      ctx.shadowBlur = hurt ? 26 : 18 + Math.sin(e.t * 7) * 6;
      ctx.imageSmoothingEnabled = false;
      // Same undistorted, size-stable math as drawBoss.
      const midIdle = frameReady(midSets[stageIndex].idle[0]) ? midSets[stageIndex].idle[0] : midSprite;
      const px = e.h / midIdle.naturalHeight;
      const kx = e.w / 158, ky = e.h / 132;
      const dw = midSprite.naturalWidth * px / kx, dh = midSprite.naturalHeight * px / ky;
      const mdx = (158 - dw) / 2, mdy = 132 - dh + Math.sin(e.t * 2.6) * 4;
      if (e.dying > 0) { drawDeathDissolve(midSprite, mdx, mdy, dw, dh, e); ctx.restore(); return; }
      ctx.drawImage(midSprite, mdx, mdy, dw, dh);
      ctx.restore();
      return;
    }
    // Procedural fallback corpse: no strips to tear, so fade and judder.
    if (e.dying > 0) {
      ctx.globalAlpha *= Math.max(0, e.dying / e.dyingMax);
      ctx.translate((Math.random() - .5) * 6, 0);
    }
    const acc = stage.accent2, TAU = Math.PI * 2;
    // Rounded 3D side thruster pods (drawn behind the shell).
    for (const [gx, gw] of [[-2 - pulse * .6, 30 + pulse], [130, 30 + pulse]]) {
      ctx.save(); ctx.shadowColor = stage.accent; ctx.shadowBlur = 10;
      const pod = ctx.createLinearGradient(0, 52, 0, 78);
      pod.addColorStop(0, shade(stage.accent, 1.35)); pod.addColorStop(.5, stage.accent); pod.addColorStop(1, shade(stage.accent, .5));
      ctx.fillStyle = pod; ctx.beginPath(); ctx.roundRect(gx, 54, gw, 22, 10); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.roundRect(gx + 4, 57, gw - 8, 5, 3); ctx.fill();
      ctx.restore();
    }
    // Extruded back → depth.
    ctx.fillStyle = '#120720'; ctx.beginPath(); ctx.roundRect(26, 20, 112, 100, 30); ctx.fill();
    // Main shell with top-lit gradient.
    ctx.save(); ctx.shadowColor = acc; ctx.shadowBlur = 18;
    const shell = ctx.createLinearGradient(0, 14, 0, 118);
    shell.addColorStop(0, shade(acc, 1.4)); shell.addColorStop(.5, acc); shell.addColorStop(1, shade(acc, .42));
    ctx.fillStyle = shell; ctx.beginPath(); ctx.roundRect(22, 14, 112, 100, 30); ctx.fill();
    ctx.shadowBlur = 0; ctx.restore();
    // Shading passes (gloss + occlusion) clipped to the shell.
    ctx.save(); ctx.beginPath(); ctx.roundRect(22, 14, 112, 100, 30); ctx.clip();
    let gp = ctx.createLinearGradient(0, 14, 0, 72);
    gp.addColorStop(0, 'rgba(255,255,255,.42)'); gp.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gp; ctx.fillRect(22, 14, 112, 58);
    gp = ctx.createLinearGradient(0, 82, 0, 114);
    gp.addColorStop(0, 'rgba(10,3,20,0)'); gp.addColorStop(1, 'rgba(10,3,20,.55)');
    ctx.fillStyle = gp; ctx.fillRect(22, 82, 112, 32);
    ctx.restore();
    // Stage motif crest — gives each stage's warden a distinct silhouette accent.
    ctx.fillStyle = stage.accent;
    if (stageIndex === 0) {
      // Neon Warden: twin antennae with glowing heart bobbles, echoing the stage1 boss.
      ctx.strokeStyle = shade(stage.accent, .6); ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(56, 20); ctx.lineTo(46, 2); ctx.moveTo(100, 20); ctx.lineTo(110, 2); ctx.stroke();
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = hexA(stage.accent2, .85);
      ctx.beginPath(); ctx.arc(46, 0, 5, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(110, 0, 5, 0, TAU); ctx.fill(); ctx.restore();
      ctx.fillStyle = '#ffd7ea'; heartPath(46, 0, 4); ctx.fill(); heartPath(110, 0, 4); ctx.fill();
    } else if (stageIndex === 1) {
      // Tidal Warden: a swept dorsal fin.
      ctx.fillStyle = stage.accent;
      ctx.beginPath(); ctx.moveTo(58, 20); ctx.quadraticCurveTo(78, -16, 98, 20); ctx.quadraticCurveTo(78, 6, 58, 20); ctx.closePath(); ctx.fill();
    } else if (stageIndex === 2) {
      // Cinder Warden: flickering flame spikes.
      const fl = Math.sin(e.t * 12) * 4;
      ctx.fillStyle = '#ffe15a';
      ctx.beginPath(); ctx.moveTo(52, 20); ctx.lineTo(60, -6 - fl); ctx.lineTo(68, 20); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(72, 20); ctx.lineTo(80, -14 + fl); ctx.lineTo(88, 20); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(92, 20); ctx.lineTo(100, -6 - fl); ctx.lineTo(108, 20); ctx.closePath(); ctx.fill();
    } else if (stageIndex === 3) {
      // Glitch Warden: an angular circuit antenna with a blinking node.
      ctx.strokeStyle = stage.accent; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(78, 20); ctx.lineTo(78, 4); ctx.lineTo(94, -8); ctx.stroke();
      ctx.save(); ctx.globalAlpha = .5 + Math.sin(e.t * 9) * .5; ctx.fillStyle = stage.accent;
      ctx.fillRect(90, -12, 8, 8); ctx.restore();
    } else {
      // Velvet Warden: a soft heart crest, matching the final boss.
      heartPath(78, 26, 7); ctx.fill();
    }
    // Glossy bevelled visor.
    ctx.fillStyle = shade(acc, 1.45); ctx.beginPath(); ctx.roundRect(42, 46, 72, 40, 16); ctx.fill();
    const visor = ctx.createLinearGradient(0, 48, 0, 84);
    visor.addColorStop(0, '#2a1440'); visor.addColorStop(1, '#050210');
    ctx.fillStyle = visor; ctx.beginPath(); ctx.roundRect(45, 48, 66, 34, 13); ctx.fill();
    // Glowing eyes.
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const ex of [64, 92]) {
      const eg = ctx.createRadialGradient(ex, 64, 1, ex, 64, 11);
      eg.addColorStop(0, '#ffffff'); eg.addColorStop(.4, hexA(stage.accent, .9)); eg.addColorStop(1, hexA(stage.accent, 0));
      ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(ex, 64, 11, 0, TAU); ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = stage.accent; ctx.beginPath(); ctx.arc(64, 64, 4, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(92, 64, 4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(62, 62, 1.6, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(90, 62, 1.6, 0, TAU); ctx.fill();
    // Glowing belly core.
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const core = ctx.createRadialGradient(78, 98, 1, 78, 98, 13 + pulse * .3);
    core.addColorStop(0, '#ffffff'); core.addColorStop(.4, '#ffe15a'); core.addColorStop(1, hexA(stage.accent2, 0));
    ctx.fillStyle = core; ctx.beginPath(); ctx.arc(78, 98, 13 + pulse * .3, 0, TAU); ctx.fill();
    ctx.restore();
    // Rounded feet.
    for (const fx of [30, 98]) {
      const ft = ctx.createLinearGradient(0, 112, 0, 126);
      ft.addColorStop(0, shade(stage.accent, 1.2)); ft.addColorStop(1, shade(stage.accent, .45));
      ctx.fillStyle = ft; ctx.beginPath(); ctx.roundRect(fx, 112, 30, 12, 6); ctx.fill();
    }
  }



  // Rounded, bevelled visor plate — replaces flat black fillRect face panels
  // on bosses 2-5 with the same glossy-shell language as the stage1 boss.
  function drawVisorPanel(x, y, w, h, r, base, top) {
    ctx.fillStyle = shade(base, .7); ctx.beginPath(); ctx.roundRect(x - 3, y - 3, w + 6, h + 6, r + 3); ctx.fill();
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, top); g.addColorStop(1, base);
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.clip();
    const gl = ctx.createLinearGradient(x, y, x, y + h * .6);
    gl.addColorStop(0, 'rgba(255,255,255,.22)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gl; ctx.fillRect(x, y, w, h);
    ctx.restore();
  }
  // Soft additive glow behind an eye pupil so it reads as lit, not painted-on.
  function drawGlowDot(cx, cy, r, color) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, r);
    g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(.4, hexA(color, .9)); g.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // FF-style defeat: a white-hot blink first, then the sprite tears into
  // horizontal strips that drift up and burn out in a staggered order, each
  // strip glowing in the boss's stage colour at the moment it goes. Runs in
  // the caller's authoring-box space, so both boss and mid boss can use it.
  function drawDeathDissolve(sprite, dx0, dy0, dw, dh, e) {
    const k = clamp(1 - e.dying / e.dyingMax, 0, 1);
    ctx.shadowBlur = 0;
    if (k < .2) {
      ctx.drawImage(sprite, dx0 + (Math.random() - .5) * 5, dy0, dw, dh);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = .4 + Math.abs(Math.sin(elapsed * 30)) * .5;
      ctx.drawImage(tintSprite(sprite, '#ffffff'), dx0, dy0, dw, dh);
      return;
    }
    const kk = (k - .2) / .8;
    const strips = 16, sh = sprite.naturalHeight / strips;
    const glowTint = tintSprite(sprite, stages[stageIndex].accent2);
    for (let i = 0; i < strips; i++) {
      const dieAt = ((i * 53 + 7) % strips) / strips * .55;
      const local = clamp((kk - dieAt) / .45, 0, 1);
      if (local >= 1) continue;
      const sy = sh * i;
      const ox = Math.sin(i * 2.1 + elapsed * 20) * local * 30;
      const rise = local * local * 110;
      const dx = dx0 + ox, dy = dy0 + dh * i / strips - rise, dhs = dh / strips + 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1 - local;
      ctx.drawImage(sprite, 0, sy, sprite.naturalWidth, sh, dx, dy, dw, dhs);
      const glow = local * (1 - local) * 2;   // peaks mid-burn: the tearing edge
      if (glow > .05) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = glow;
        ctx.drawImage(glowTint, 0, sy, sprite.naturalWidth, sh, dx, dy, dw, dhs);
      }
    }
  }

  function drawBoss(e) {
    const stage = stages[stageIndex];
    // Generated pixel-art boss sprite (side view, facing the player). Drawn
    // into the same 230×190 authoring box the procedural art used, so the
    // caller's hitbox scaling keeps working. Procedural art is the fallback
    // until the image finishes loading.
    const finalDefeat = e.dying > 0 && stageIndex === 4;
    let sprite;
    if (finalDefeat) {
      // Sheet 2 begins with a coherent defeat run: clutch chest, reel back,
      // hunch, kneel, lie prone. Hold the prone cell for the quiet aftermath;
      // the remaining recovery cells are used by the normal 8-frame hurt cycle.
      const fall = readyFrames(bossSets[stageIndex].hurt).slice(0, 5);
      const k = clamp(1 - e.dying / e.dyingMax, 0, .999);
      const step = k < .12 ? 0 : k < .25 ? 1 : k < .39 ? 2 : k < .54 ? 3 : 4;
      sprite = fall[Math.min(step, fall.length - 1)];
    }
    sprite ||= pickPoseFrame(bossSets[stageIndex], e) || (frameReady(bossSprites[stageIndex]) ? bossSprites[stageIndex] : null);
    if (sprite) {
      // The spawn hitbox already carries the art's aspect ratio, so filling the
      // whole 230×190 authoring box draws the sprite undistorted. The main
      // animation is the pose switch (idle / attack windup+strike / pained
      // hurt); body language on top: breathing, a hard forward lean while
      // dashing, a pain jitter while hurt, a strobe while teleporting.
      const hurt = e.hurtT > 0;
      const breath = finalDefeat ? 0 : Math.sin(e.t * 2.6) * .022;
      let lean = Math.sin(e.t * 1.4) * .02;
      if (e.mode === 'dash') lean = -.18;
      else if (e.mode === 'return') lean = .09;
      if (hurt) lean += .06 + Math.sin(e.t * 46) * .035;
      ctx.save();
      // Flicker for a teleport strobe (e.blink) and for the whole windup of an
      // incoming special attack (e.tel > 0) — same tell, so the player reads
      // "something is about to happen" the same way either time.
      if (e.blink > 0 || e.tel > 0) ctx.globalAlpha = .3 + Math.abs(Math.sin(e.t * 34)) * .6;
      ctx.translate(115, 190);
      ctx.rotate(lean);
      ctx.scale(1 - breath, 1 + breath);
      ctx.translate(-115, -190);
      const tint = BOSS_TINT[stageIndex];
      const crit = e.hp / e.maxHp < .25;
      ctx.shadowColor = hurt ? 'rgba(255,80,80,.95)' : crit ? hexA(tint.crit, .95) : hexA(stage.accent2, .85);
      ctx.shadowBlur = hurt ? 34 : 26 + Math.sin(e.t * 5) * 8;
      ctx.imageSmoothingEnabled = false;
      // Undistorted, size-stable fit: every frame is drawn at the same
      // world-pixels-per-source-pixel scale, derived from the idle frame that
      // sized the hitbox. Pose frames with different canvas sizes (a wide kick,
      // a crouched hurt) then keep the character the same size instead of
      // being re-fit — and the local box's non-uniform scale is divided out.
      const idleF = frameReady(bossSets[stageIndex].idle[0]) ? bossSets[stageIndex].idle[0] : sprite;
      const px = e.h / idleF.naturalHeight;
      const kx = e.w / 230, ky = e.h / 190;
      const dw = sprite.naturalWidth * px / kx, dh = sprite.naturalHeight * px / ky;
      const dx0 = (230 - dw) / 2 + (hurt ? Math.sin(e.t * 52) * 3 : 0);
      // Living art deliberately extends below the viewport to sell her scale.
      // During the authored collapse, progressively lift that off-screen
      // baseline onto the palace floor (world y=650), so the prone body rests
      // on visible tiles rather than sinking beneath the canvas.
      const deathK = finalDefeat ? clamp(1 - e.dying / e.dyingMax, 0, 1) : 0;
      const floorT = finalDefeat ? clamp((deathK - .28) / .28, 0, 1) : 0;
      const floorLift = 67 * floorT * floorT * (3 - 2 * floorT);
      const dy0 = 190 - dh - floorLift + (finalDefeat ? 0 : Math.sin(e.t * 2.2) * 5);
      if (e.dying > 0) {
        if (finalDefeat) {
          // Do not shred the authored prone pose. It remains solid for most of
          // the aftermath, then exhales away just before the ending begins.
          const k = clamp(1 - e.dying / e.dyingMax, 0, 1);
          ctx.globalAlpha *= k < .82 ? 1 : clamp((1 - k) / .18, 0, 1);
          ctx.drawImage(sprite, dx0, dy0, dw, dh);
        } else {
          drawDeathDissolve(sprite, dx0, dy0, dw, dh, e);
        }
        ctx.restore(); return;
      }
      // Dissolving into scanlines: the sprite is sliced and the strips drift
      // apart. Has to happen here, before the early return below.
      if (e.dissolve > 0) {
        ctx.shadowBlur = 0;
        for (let i = 0; i < 14; i++) {
          const sy = sprite.naturalHeight * i / 14;
          const oy = Math.sin(i * 1.7 + elapsed * 8) * e.dissolve * (i % 2 ? 260 : -260);
          ctx.globalAlpha = Math.max(0, 1 - e.dissolve * (i / 14 + .3));
          ctx.drawImage(sprite, 0, sy, sprite.naturalWidth, sprite.naturalHeight / 14,
            dx0 + oy, dy0 + dh * i / 14, dw, dh / 14 + 1);
        }
        ctx.restore();
        return;
      }
      ctx.drawImage(sprite, dx0, dy0, dw, dh);
      // Damage colour, painted through the sprite's own alpha so no box shows.
      // A landed shot flashes additively; below 25% HP the body sits in its
      // wounded colour and pulses. Only ever one pass per frame.
      const hitA = Math.min(.62, (e.hit || 0) * 5);
      const critA = crit ? .20 + Math.abs(Math.sin(e.t * 6.5)) * .18 : 0;
      if (hitA > .02 || critA > 0) {
        ctx.shadowBlur = 0;
        const useHit = hitA > critA;
        ctx.globalCompositeOperation = useHit ? 'lighter' : 'source-over';
        ctx.globalAlpha = Math.max(hitA, critA);
        ctx.drawImage(tintSprite(sprite, useHit ? tint.hit : tint.crit), dx0, dy0, dw, dh);
      }
      ctx.restore();
      return;
    }
    // Procedural fallback corpse: no strips to tear, so fade and judder.
    if (e.dying > 0) {
      ctx.globalAlpha *= Math.max(0, e.dying / e.dyingMax);
      ctx.translate((Math.random() - .5) * 6, 0);
    }
    const pulse = 4 + Math.sin(e.t * 5) * 3;
    // shared soft, rounded drop shadow (no hard rectangular corners behind the body)
    ctx.save(); ctx.globalAlpha = .32; ctx.fillStyle = '#05030c';
    ctx.translate(10, 10); ctx.beginPath(); ctx.roundRect(24, 24, e.w - 48, e.h - 34, 34); ctx.fill(); ctx.restore();
    if (stageIndex === 0) {
      const TAU = Math.PI * 2;
      // Shoulder pods (rounded 3D bumps) — drawn first so the head overlaps them.
      for (const [gx, gw] of [[2 - pulse, 34 + pulse], [194, 34 + pulse]]) {
        ctx.save(); ctx.shadowColor = stage.accent; ctx.shadowBlur = 12;
        const pod = ctx.createLinearGradient(0, 96, 0, 132);
        pod.addColorStop(0, shade(stage.accent, 1.35)); pod.addColorStop(.5, stage.accent); pod.addColorStop(1, shade(stage.accent, .5));
        ctx.fillStyle = pod; ctx.beginPath(); ctx.roundRect(gx, 96, gw, 32, 13); ctx.fill();
        ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.roundRect(gx + 5, 100, gw - 10, 6, 3); ctx.fill();
        ctx.restore();
      }
      // Extruded back shell → volume/depth.
      ctx.fillStyle = '#2a0a20'; ctx.beginPath(); ctx.roundRect(30, 30, 180, 148, 36); ctx.fill();
      // Antennae with glowing heart bobbles.
      ctx.strokeStyle = '#7a1848'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(72, 36); ctx.lineTo(58, 4); ctx.moveTo(158, 36); ctx.lineTo(172, 4); ctx.stroke();
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = hexA(stage.accent2, .85);
      ctx.beginPath(); ctx.arc(57, 2, 8 + Math.sin(e.t * 4) * 1.5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(173, 2, 8 + Math.sin(e.t * 4 + 1) * 1.5, 0, TAU); ctx.fill(); ctx.restore();
      ctx.fillStyle = '#ffd7ea'; heartPath(57, 2, 6); ctx.fill(); heartPath(173, 2, 6); ctx.fill();

      // Main head shell with top-lit vertical gradient.
      ctx.save(); ctx.shadowColor = stage.accent2; ctx.shadowBlur = 22;
      const shell = ctx.createLinearGradient(0, 18, 0, 176);
      shell.addColorStop(0, '#ffb4d8'); shell.addColorStop(.32, '#ff5aa6'); shell.addColorStop(.64, '#ff3e9d'); shell.addColorStop(1, '#66123f');
      ctx.fillStyle = shell; ctx.beginPath(); ctx.roundRect(24, 22, 180, 150, 34); ctx.fill();
      ctx.shadowBlur = 0; ctx.restore();
      // Shading passes clipped to the shell: top gloss, left rim, bottom-right occlusion.
      ctx.save(); ctx.beginPath(); ctx.roundRect(24, 22, 180, 150, 34); ctx.clip();
      let gp = ctx.createLinearGradient(0, 22, 0, 100);
      gp.addColorStop(0, 'rgba(255,255,255,.45)'); gp.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gp; ctx.fillRect(24, 22, 180, 78);
      gp = ctx.createLinearGradient(24, 0, 66, 0);
      gp.addColorStop(0, 'rgba(255,255,255,.3)'); gp.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gp; ctx.fillRect(24, 22, 42, 150);
      gp = ctx.createLinearGradient(0, 112, 0, 172);
      gp.addColorStop(0, 'rgba(38,4,24,0)'); gp.addColorStop(1, 'rgba(38,4,24,.6)');
      ctx.fillStyle = gp; ctx.fillRect(24, 112, 180, 60);
      gp = ctx.createLinearGradient(150, 0, 204, 0);
      gp.addColorStop(0, 'rgba(38,4,24,0)'); gp.addColorStop(1, 'rgba(38,4,24,.5)');
      ctx.fillStyle = gp; ctx.fillRect(150, 22, 54, 150);
      ctx.restore();

      // Kawaii cheek blush.
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .5; ctx.fillStyle = '#ff8ac2';
      ctx.beginPath(); ctx.ellipse(60, 134, 15, 9, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(170, 134, 15, 9, 0, 0, TAU); ctx.fill(); ctx.restore();

      // Glossy visor "screen" face — bevelled, not a hard black hole.
      ctx.fillStyle = '#ffd0e6'; ctx.beginPath(); ctx.roundRect(45, 56, 140, 64, 24); ctx.fill();
      const visor = ctx.createLinearGradient(0, 58, 0, 118);
      visor.addColorStop(0, '#2a1440'); visor.addColorStop(.5, '#140826'); visor.addColorStop(1, '#050210');
      ctx.fillStyle = visor; ctx.beginPath(); ctx.roundRect(48, 59, 134, 58, 21); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.roundRect(48, 59, 134, 58, 21); ctx.clip();
      const vg = ctx.createLinearGradient(48, 59, 120, 117);
      vg.addColorStop(0, 'rgba(255,255,255,.18)'); vg.addColorStop(.5, 'rgba(255,255,255,0)');
      ctx.fillStyle = vg; ctx.fillRect(48, 59, 134, 58);
      ctx.restore();

      // Glowing heart eyes with shine.
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const ex of [86, 144]) {
        const eg = ctx.createRadialGradient(ex, 86, 1, ex, 86, 17);
        eg.addColorStop(0, 'rgba(255,255,255,.95)'); eg.addColorStop(.4, hexA(stage.accent2, .9)); eg.addColorStop(1, 'rgba(255,62,157,0)');
        ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(ex, 86, 17, 0, TAU); ctx.fill();
      }
      ctx.restore();
      ctx.fillStyle = stage.accent2; heartPath(86, 88, 10); ctx.fill(); heartPath(144, 88, 10); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(82, 82, 3.4, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(140, 82, 3.4, 0, TAU); ctx.fill();

      // Golden heart mouth.
      ctx.save(); ctx.shadowColor = '#ffe15a'; ctx.shadowBlur = 10; ctx.fillStyle = '#ffe15a'; heartPath(115, 150, 15); ctx.fill(); ctx.restore();
      ctx.fillStyle = '#fff6c0'; heartPath(112, 146, 5); ctx.fill();

      // Rounded feet.
      for (const fx of [28, 144]) {
        const ft = ctx.createLinearGradient(0, 164, 0, 182);
        ft.addColorStop(0, shade(stage.accent, 1.25)); ft.addColorStop(1, shade(stage.accent, .45));
        ctx.fillStyle = ft; ctx.beginPath(); ctx.roundRect(fx, 164, 58, 16, 8); ctx.fill();
      }
    } else if (stageIndex === 1) {
      ctx.shadowColor = '#65fff2'; ctx.shadowBlur = 16;
      ctx.fillStyle = '#061828';
      ctx.beginPath(); ctx.moveTo(155, 100); ctx.quadraticCurveTo(236, 65 + Math.sin(e.t * 3) * 20, 232, 32); ctx.quadraticCurveTo(205, 100, 232, 166); ctx.quadraticCurveTo(214, 126, 155, 126); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#0d2c52';
      ctx.beginPath(); ctx.moveTo(150, 95); ctx.quadraticCurveTo(232, 60 + Math.sin(e.t * 3) * 20, 228, 28); ctx.quadraticCurveTo(200, 95, 228, 162 + Math.sin(e.t * 3) * 15); ctx.quadraticCurveTo(210, 122, 150, 122); ctx.closePath(); ctx.fill();
      const body = ctx.createRadialGradient(70, 70, 10, 100, 100, 90);
      body.addColorStop(0, '#65fff2'); body.addColorStop(.4, '#2f8cff'); body.addColorStop(1, '#071d42');
      ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(100, 95, 68, 55, 0, 0, Math.PI * 2); ctx.fill();
      drawVisorPanel(45, 68, 95, 42, 18, '#030a1e', '#0d3a5c');
      for (const ex of [66, 124]) drawGlowDot(ex, 89, 15, '#65fff2');
      ctx.fillStyle = '#65fff2'; ctx.beginPath(); ctx.roundRect(58, 82, 16, 14, 6); ctx.fill(); ctx.beginPath(); ctx.roundRect(116, 82, 16, 14, 6); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(63, 87, 3, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(121, 87, 3, 0, Math.PI * 2); ctx.fill();
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
      ctx.fillStyle = '#180509'; ctx.beginPath(); ctx.roundRect(60, 112, 110, 48, 12); ctx.fill();
      for (let i = 0; i < 4; i++) {
        ctx.save(); ctx.globalAlpha = .55 + Math.sin(e.t * 6 + i) * .4;
        ctx.fillStyle = '#ff5a36'; ctx.fillRect(66 + i * 27, 118, 18, 36); ctx.restore();
      }
      drawVisorPanel(70, 76, 26, 18, 8, '#7a2708', '#ffb347'); drawVisorPanel(134, 76, 26, 18, 8, '#7a2708', '#ffb347');
      for (const ex of [83, 147]) drawGlowDot(ex, 85, 11, '#ffe15a');
      ctx.fillStyle = '#180509'; ctx.beginPath(); ctx.roundRect(78, 80, 10, 10, 4); ctx.fill(); ctx.beginPath(); ctx.roundRect(142, 80, 10, 10, 4); ctx.fill();
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
      drawVisorPanel(75, 78, 30, 14, 7, '#0b2e18', '#164636'); drawVisorPanel(125, 78, 30, 14, 7, '#0b2e18', '#164636');
      for (const ex of [90, 140]) drawGlowDot(ex, 85, 12, '#72ff68');
      ctx.fillStyle = '#d6ffd0'; ctx.beginPath(); ctx.roundRect(83, 82, 9, 6, 3); ctx.fill(); ctx.beginPath(); ctx.roundRect(133, 82, 9, 6, 3); ctx.fill();
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
      drawVisorPanel(70, 68, 34, 28, 13, '#1a0313', '#4a0e34'); drawVisorPanel(126, 68, 34, 28, 13, '#1a0313', '#4a0e34');
      for (const ex of [87, 143]) drawGlowDot(ex, 83, 14, '#ffe15a');
      ctx.fillStyle = '#ffe15a'; heartPath(87, 84, 9); ctx.fill(); heartPath(143, 84, 9); ctx.fill();
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
    const aura = p.type === 'heal' ? '#72ff68' : p.type === 'power' ? '#ff8a35' : p.type === 'spread' ? '#31e8ff' : p.type === 'bomb' ? '#c9d6ec' : p.type === 'ammo' ? '#a8ffa0' : p.type === 'life' ? '#ffd76a' : '#ffe15a';
    const ag = ctx.createRadialGradient(0, 8, 2, 0, 8, 26);
    ag.addColorStop(0, hexA(aura, .55)); ag.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ag; ctx.beginPath(); ctx.ellipse(0, 10, 20, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (p.type === 'heal') {
      if (p.kind === 'burger') drawBurgerPickup(p.t);
      else drawEnergyDrinkPickup(p.t);
    } else if (p.type === 'power') drawPowerPickup(p.t);
    else if (p.type === 'spread') drawSpreadPickup(p.t);
    else if (p.type === 'bomb') drawBombPickup(p.t);
    else if (p.type === 'ammo') drawAmmoPickup(p.t);
    else if (p.type === 'life') drawLifePickup(p.t);
    else drawSpeedPickup(p.t);
    ctx.restore();
  }

  // 弾薬クレート: boxy magazine with brass rounds peeking out.
  function drawAmmoPickup(t) {
    ctx.save();
    ctx.fillStyle = '#c8a25a';
    for (let i = 0; i < 3; i++) {
      const bx = -9 + i * 9;
      ctx.beginPath(); ctx.moveTo(bx, -18); ctx.lineTo(bx + 3, -12); ctx.lineTo(bx - 3, -12); ctx.closePath(); ctx.fill();
      ctx.fillRect(bx - 3, -12, 6, 5);
    }
    drawBox3D(-15, -8, 30, 22, '#3f7a4f', 6);
    ctx.fillStyle = '#eafff0'; ctx.font = '6px "Press Start 2P", monospace'; ctx.textAlign = 'center';
    ctx.fillText('AMMO', 0, 6);
    ctx.textAlign = 'left';
    ctx.restore();
  }

  // 金のハートカプセル: the rare max-HP-up. A stronger pulse and gold trim
  // sell the rarity next to the everyday food drops.
  function drawLifePickup(t) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .35 + Math.sin(t * 6) * .18;
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 27);
    g.addColorStop(0, '#ffe15a'); g.addColorStop(1, 'rgba(255,215,90,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 27, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    ctx.beginPath(); ctx.roundRect(-12, -17, 24, 34, 12); ctx.fill();
    ctx.strokeStyle = '#c9a13b'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(-12, -17, 24, 34, 12); ctx.stroke();
    ctx.fillStyle = '#ffd76a'; heartPath(0, 1, 10); ctx.fill();
    ctx.fillStyle = '#ff5a9d'; heartPath(0, 1, 5.5); ctx.fill();
    // orbiting sparkle
    const sa = t * 3;
    ctx.fillStyle = '#fff';
    starPath(Math.cos(sa) * 17, Math.sin(sa) * 19, 3.5, 1.6, 4); ctx.fill();
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

  function drawBombPickup(t) {
    // Round cartoon bomb: dark shell, lit fuse, drifting spark.
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(0, 15, 12, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    const shell = ctx.createRadialGradient(-4, -4, 2, 0, 2, 14);
    shell.addColorStop(0, '#5a6580'); shell.addColorStop(.45, '#2a3350'); shell.addColorStop(1, '#0c1022');
    ctx.fillStyle = shell;
    ctx.beginPath(); ctx.arc(0, 3, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.ellipse(-5, -3, 3.5, 2.4, -.5, 0, Math.PI * 2); ctx.fill();
    // cap + fuse
    ctx.fillStyle = '#9aa3b5'; ctx.fillRect(-3, -14, 6, 4);
    ctx.strokeStyle = '#c8a25a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -14); ctx.quadraticCurveTo(6, -20, 3, -25); ctx.stroke();
    // spark
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = hexA('#ffe15a', .7 + Math.sin(t * 14) * .3);
    ctx.beginPath(); ctx.arc(3, -25, 3 + Math.sin(t * 12) * 1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = hexA('#c9d6ec', .5 + Math.sin(t * 9) * .3);
    ctx.beginPath(); ctx.arc(6, -3, 16, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawHUD() {
    ctx.save();
    const stage = stages[stageIndex];
    ctx.fillStyle = 'rgba(10,6,31,.82)'; ctx.fillRect(24, 23, 286, 70); ctx.fillRect(VW - 356, 23, 332, 70);
    ctx.strokeStyle = 'rgba(49,232,255,.6)'; ctx.strokeRect(24.5, 23.5, 286, 70); ctx.strokeRect(VW - 356.5, 23.5, 332, 70);
    ctx.fillStyle = '#31e8ff'; ctx.font = '10px "Press Start 2P", monospace'; ctx.fillText('MONEY', 42, 45);
    ctx.fillStyle = '#fff'; ctx.font = '22px "Press Start 2P", monospace'; ctx.fillText(yen(score), 42, 77);
    ctx.fillStyle = 'rgba(10,6,31,.84)'; ctx.fillRect(24, 99, 286, 26); ctx.strokeStyle = 'rgba(255,225,90,.55)'; ctx.strokeRect(24.5, 99.5, 286, 26);
    ctx.fillStyle = '#2d2144'; ctx.fillRect(91, 107, 207, 10); ctx.fillStyle = special >= 100 ? '#ffe15a' : '#ff3e9d'; ctx.fillRect(91, 107, 207 * special / 100, 10);
    ctx.fillStyle = special >= 100 ? '#ffe15a' : '#fff'; ctx.font = '7px "Press Start 2P", monospace'; ctx.fillText('SPECIAL', 34, 116);
    // Magazine strip mirrors the SPECIAL bar; goes red and blinks when nearly dry.
    const ammoLow = ammo <= ammoMax * .25;
    ctx.fillStyle = 'rgba(10,6,31,.84)'; ctx.fillRect(24, 131, 286, 26); ctx.strokeStyle = 'rgba(114,255,104,.5)'; ctx.strokeRect(24.5, 131.5, 286, 26);
    ctx.fillStyle = '#1d3122'; ctx.fillRect(91, 139, 152, 10);
    ctx.fillStyle = ammoLow ? (Math.floor(elapsed * 10) % 2 ? '#ff5a36' : '#ffb347') : '#72ff68';
    ctx.fillRect(91, 139, 152 * ammo / ammoMax, 10);
    ctx.fillStyle = ammoLow ? '#ff8a6a' : '#fff'; ctx.font = '7px "Press Start 2P", monospace'; ctx.fillText('AMMO', 34, 148);
    if (ammoPackStock > 0) {
      // Stocked spare magazines: a small badge in the panel's top-right
      // corner, clear of the bar, the AMMO label and the numeric readout.
      ctx.fillStyle = '#a8ffa0'; ctx.font = '6px "Press Start 2P", monospace';
      ctx.textAlign = 'right'; ctx.fillText(`SPARE×${ammoPackStock}`, 304, 138); ctx.textAlign = 'left';
    }
    ctx.fillStyle = ammoLow ? '#ff8a6a' : '#fff'; ctx.font = '7px "Press Start 2P", monospace';
    ctx.textAlign = 'right'; ctx.fillText(String(ammo), 298, 148); ctx.textAlign = 'left';
    ctx.fillStyle = '#fff'; ctx.font = '9px "Press Start 2P", monospace'; ctx.fillText('HP', VW - 336, 48);
    ctx.fillStyle = '#21163f'; ctx.fillRect(VW - 336, 57, 286, 18);
    const hpWidth = 286 * health / maxHealth;
    ctx.fillStyle = health > 50 ? '#31e8ff' : health > 25 ? '#ffe15a' : '#ff3e9d'; ctx.fillRect(VW - 336, 57, hpWidth, 18);
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(VW - 332, 60, Math.max(0, hpWidth - 8), 3);
    ctx.textAlign = 'right'; ctx.fillStyle = '#fff'; ctx.font = '9px "Press Start 2P", monospace'; ctx.fillText(`${Math.ceil(health)} / ${maxHealth}`, VW - 48, 48); ctx.textAlign = 'left';
    // POWER label flashes red for a moment after a hit knocks the level down.
    ctx.fillStyle = powerDownBanner > 0 && Math.floor(elapsed * 10) % 2 === 0 ? '#ff5a36' : '#ffe15a';
    ctx.font = '7px "Press Start 2P", monospace'; ctx.fillText(`POWER ${player.power}`, VW - 336, 88);
    ctx.fillStyle = '#31e8ff'; ctx.fillText(`WIDE ${player.spread}`, VW - 220, 88);
    ctx.fillStyle = '#72ff68'; ctx.fillText(`SPEED ${player.speed}`, VW - 126, 88);
    // Remaining continues: up to five hearts just under the HP panel (3 to
    // start, expandable via the shop), spent/empty slots dimmed.
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < continuesLeft ? '#ff3e9d' : 'rgba(255,255,255,.18)';
      heartPath(VW - 46 - (4 - i) * 24, 110, 9);
      ctx.fill();
    }
    if (combo > 1 && comboTimer > 0) {
      ctx.textAlign = 'center'; ctx.fillStyle = '#ffe15a'; ctx.font = '18px "Press Start 2P", monospace'; ctx.fillText(`${combo} COMBO!`, VW / 2, 61);
      ctx.fillStyle = '#fff'; ctx.font = '10px "Press Start 2P", monospace'; ctx.fillText(`SCORE ×${Math.min(5, 1 + Math.floor(combo / 5))}`, VW/2, 84);
    } else {
      ctx.textAlign = 'center'; ctx.fillStyle = stage.accent; ctx.font = '10px "Press Start 2P", monospace'; ctx.fillText(`STAGE ${stageIndex + 1} / ${stages.length}`, VW / 2, 48);
      ctx.fillStyle = '#fff'; ctx.font = '9px "Press Start 2P", monospace'; ctx.fillText(stage.name, VW / 2, 70); ctx.textAlign = 'left';
    }
    // A dying corpse keeps rendering but is no longer "the boss" — the HP bar
    // leaves with the killing blow, like the fight is already over.
    const boss = enemies.find(e => (e.type === 'boss' || e.type === 'midboss') && !(e.dying > 0));
    if (boss) {
      ctx.fillStyle = 'rgba(10,6,31,.9)'; ctx.fillRect(330, VH - 52, 620, 28);
      ctx.fillStyle = '#311848'; ctx.fillRect(338, VH - 44, 604, 12);
      const ratio = Math.max(0, boss.hp / boss.maxHp);
      ctx.fillStyle = stage.accent2; ctx.fillRect(338, VH - 44, 604 * ratio, 12);
      // Notches at the act boundaries, so how much fight is left is legible.
      if (boss.type === 'boss') {
        ctx.fillStyle = 'rgba(10,6,31,.85)';
        for (const t of bossTiers(stageIndex)) ctx.fillRect(338 + 604 * t - 1, VH - 44, 2, 12);
      }
      ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '9px "Press Start 2P", monospace'; ctx.fillText(boss.type === 'midboss' ? `MID BOSS  ${stage.midBoss}` : `BOSS  ${stage.boss}`, VW / 2, VH - 58);
      if (boss.type === 'boss' && boss.tier > 0) {
        // Press Start 2P has no Japanese glyphs — DotGothic16 is the house font
        // for Japanese text elsewhere in this file.
        const labels = stageIndex === 4
          ? ['', '第二幕 嫉妬', '第三幕 絶唱', '最終幕 断末魔']
          : ['', '- 本気モード -', '- 断末魔 -'];
        // Gold rather than the boss's crit tint: several of those are dark
        // enough to vanish against their own stage's floor decoration.
        ctx.fillStyle = boss.tierBanner > 0 && Math.floor(elapsed * 12) % 2 === 0 ? '#fff' : (boss.crit ? '#ffe15a' : stage.accent2);
        ctx.font = '15px "DotGothic16", monospace';
        ctx.fillText(labels[boss.tier] || '', VW / 2, VH - 16);
      }
      ctx.textAlign = 'left';
    }
    if (bossState === 'warning' || bossState === 'midboss-warning') {
      ctx.globalAlpha = .55 + Math.sin(bossWarning * 12) * .35; ctx.fillStyle = stage.accent2; ctx.fillRect(0, 292, VW, 102);
      ctx.globalAlpha = 1; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '28px "Press Start 2P", monospace'; ctx.fillText('WARNING', VW / 2, 344);
      ctx.font = '11px "Press Start 2P", monospace'; ctx.fillText(bossState === 'midboss-warning' ? 'MID BOSS APPROACHING' : 'BOSS APPROACHING', VW / 2, 374); ctx.textAlign = 'left';
    }
    if (continueBanner > 0) {
      const a = Math.min(1, continueBanner, (3 - continueBanner) * 3);
      ctx.save(); ctx.globalAlpha = a * (.75 + Math.sin(elapsed * 10) * .25);
      ctx.textAlign = 'center'; ctx.fillStyle = '#ffe15a'; ctx.font = '26px "Press Start 2P", monospace';
      ctx.fillText('CONTINUE!', VW / 2, 330);
      ctx.fillStyle = '#fff'; ctx.font = '21px "DotGothic16", monospace';
      ctx.fillText(`のこり ${continuesLeft} 回`, VW / 2, 366);
      ctx.restore(); ctx.textAlign = 'left';
    }
    if (powerDownBanner > 0) {
      // Rising "POWER DOWN" tag over Gro-chan so the demotion is impossible to miss.
      const a = Math.min(1, powerDownBanner * 2.5);
      ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center';
      ctx.fillStyle = '#ff5a36'; ctx.font = '10px "Press Start 2P", monospace';
      ctx.fillText('POWER DOWN', player.x + player.w / 2, player.y - 18 - (1.4 - powerDownBanner) * 40);
      ctx.restore(); ctx.textAlign = 'left';
    }
    if (reloadFlash > 0) {
      // A stocked pack auto-fired: celebrate the save so it reads as a reward,
      // not a silent number change.
      const a = Math.min(1, reloadFlash * 2.2);
      ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center';
      ctx.fillStyle = '#72ff68'; ctx.font = '15px "DotGothic16", monospace';
      ctx.fillText('スペアマガジン！', player.x + player.w / 2, player.y - 40 - (1.6 - reloadFlash) * 30);
      ctx.restore(); ctx.textAlign = 'left';
    }
    if (ammoBanner > 0) {
      // Rising "弾切れ!" tag over Gro-chan the moment the magazine empties.
      const a = Math.min(1, ammoBanner * 2.5);
      ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center';
      ctx.fillStyle = '#ff5a36'; ctx.font = '16px "DotGothic16", monospace';
      ctx.fillText('弾切れ! AMMO EMPTY', player.x + player.w / 2, player.y - 40 - (2 - ammoBanner) * 26);
      ctx.restore(); ctx.textAlign = 'left';
    }
    if (charmFlash > 0) {
      // Rising "おまもり!" tag confirms the charm ate the power-down instead.
      const a = Math.min(1, charmFlash * 2.5);
      ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center';
      ctx.fillStyle = '#c9d6ec'; ctx.font = '16px "DotGothic16", monospace';
      ctx.fillText('おまもり発動!', player.x + player.w / 2, player.y - 18 - (1.2 - charmFlash) * 40);
      ctx.restore(); ctx.textAlign = 'left';
    }
    if (stageBanner > 0) {
      const alpha = Math.min(1, stageBanner, (3 - stageBanner) * 2);
      const slide = (1 - Math.min(1, alpha)) * 26;
      ctx.save(); ctx.globalAlpha = Math.max(0, alpha);
      const bx = 150, by = 254 + slide, bw = VW - 300, bh = 180;
      // Glowing bevelled card instead of a flat wash — same neon-panel language as the HUD.
      const bg = ctx.createLinearGradient(0, by, 0, by + bh);
      bg.addColorStop(0, 'rgba(14,8,34,.92)'); bg.addColorStop(1, 'rgba(6,3,16,.92)');
      ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 18); ctx.fill();
      ctx.save(); ctx.shadowColor = stage.accent; ctx.shadowBlur = 16; ctx.strokeStyle = hexA(stage.accent, .85); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 18); ctx.stroke(); ctx.restore();
      ctx.strokeStyle = stage.accent2; ctx.lineWidth = 3;
      for (const [cx, cy, dx, dy] of [[bx, by, 1, 1], [bx + bw, by, -1, 1], [bx, by + bh, 1, -1], [bx + bw, by + bh, -1, -1]]) {
        ctx.beginPath(); ctx.moveTo(cx, cy + dy * 22); ctx.lineTo(cx, cy); ctx.lineTo(cx + dx * 22, cy); ctx.stroke();
      }
      ctx.textAlign = 'center'; ctx.fillStyle = stage.accent; ctx.font = '16px "Press Start 2P", monospace'; ctx.fillText(`STAGE ${stageIndex + 1}`, VW / 2, by + 50);
      ctx.fillStyle = '#fff'; ctx.font = '23px "Press Start 2P", monospace'; ctx.fillText(stage.name, VW / 2, by + 94);
      ctx.fillStyle = '#ffd7ea'; ctx.font = '19px "DotGothic16", monospace'; ctx.fillText(stage.subtitle, VW / 2, by + 130);
      ctx.fillStyle = stage.accent2; ctx.font = '9px "Press Start 2P", monospace'; ctx.fillText(`BOSS: ${stage.boss}`, VW / 2, by + 160);
      ctx.restore(); ctx.textAlign = 'left';
    }
    const showClearCard = bossState === 'transition' || (bossState === 'final' && stageTransition <= 2.8);
    if (showClearCard && state === 'playing') {
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

  // --- BGM analyser (music-reactive scenery) -------------------------------
  // Only attempted over http(s): on file:// createMediaElementSource reroutes
  // the element through a CORS-silenced graph and the BGM goes mute forever.
  // Each Audio element may be wrapped in a source exactly once (a second call
  // throws), hence the Map. Any failure flips musicReactive off for good and
  // the procedural sin-pulse below takes over — same visual grammar, no audio
  // dependency.
  let bgmAnalyser = null, bgmAnalyserData = null;
  let musicReactive = location.protocol.startsWith('http');
  const bgmSources = new Map();
  function ensureBgmAnalyser(audioEl) {
    if (!musicReactive || !audioEl || !soundOn) return;
    try {
      ensureAudio();
      if (!audioCtx) return;
      if (!bgmAnalyser) {
        bgmAnalyser = audioCtx.createAnalyser();
        bgmAnalyser.fftSize = 256;
        bgmAnalyserData = new Uint8Array(bgmAnalyser.frequencyBinCount);
        bgmAnalyser.connect(audioCtx.destination);
      }
      if (!bgmSources.has(audioEl)) {
        const src = audioCtx.createMediaElementSource(audioEl);
        src.connect(bgmAnalyser);
        bgmSources.set(audioEl, src);
      }
    } catch (_) {
      musicReactive = false;
    }
  }
  // Bass level 0..1, computed at most once per frame (elapsed-keyed cache).
  let musicLevelT = -1, musicLevelVal = 0;
  function musicLevel() {
    if (musicLevelT === elapsed) return musicLevelVal;
    musicLevelT = elapsed;
    if (musicReactive && bgmAnalyser && audioCtx && audioCtx.state === 'running' && soundOn) {
      bgmAnalyser.getByteFrequencyData(bgmAnalyserData);
      let sum = 0;
      for (let i = 0; i < 9; i++) sum += bgmAnalyserData[i];
      musicLevelVal = Math.min(1, sum / (9 * 190));
    } else {
      musicLevelVal = .5 + .5 * Math.sin(elapsed * 7.4);
    }
    return musicLevelVal;
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
    if (!pad) { padInput.x = 0; padInput.y = 0; padInput.fire = false; padInput.special = false; padInput.bomb = false; padStartWasDown = false; padActionWasDown = false; padSpecialWasDown = false; padBombWasDown = false; return; }
    const deadzone = value => Math.abs(value) < .18 ? 0 : value;
    padInput.x = deadzone(pad.axes[0] || 0) + ((pad.buttons[15]?.pressed ? 1 : 0) - (pad.buttons[14]?.pressed ? 1 : 0));
    padInput.y = deadzone(pad.axes[1] || 0) + ((pad.buttons[13]?.pressed ? 1 : 0) - (pad.buttons[12]?.pressed ? 1 : 0));
    padInput.x = clamp(padInput.x, -1, 1); padInput.y = clamp(padInput.y, -1, 1);
    padInput.fire = Boolean(pad.buttons[0]?.pressed || pad.buttons[1]?.pressed || pad.buttons[2]?.pressed || (pad.buttons[7]?.value || 0) > .25);
    padInput.special = Boolean(pad.buttons[3]?.pressed || (pad.buttons[6]?.value || 0) > .5);
    padInput.bomb = Boolean(pad.buttons[4]?.pressed || pad.buttons[5]?.pressed);
    const startDown = Boolean(pad.buttons[9]?.pressed);
    const actionDown = Boolean(pad.buttons[0]?.pressed);
    if (startDown && !padStartWasDown && state === 'playing') togglePause();
    if (actionDown && !padActionWasDown && state !== 'playing') {
      if (storySlides) advanceStory();
      else if (state === 'menu') { if (menuStep === 'title') showHowto(); else showOpening(); }
      else if (state === 'opening') resetGame();
      else if (state === 'over') {
        if (endingScreen.classList.contains('is-visible')) showStaffRoll();
        else if (staffRollScreen.classList.contains('is-visible')) finishStaffRoll();
        else resetGame();
      }
      else if (state === 'shop') leaveShop();
    }
    if (padInput.special && !padSpecialWasDown && state === 'playing') useSpecial();
    if (padInput.bomb && !padBombWasDown && state === 'playing') useBomb();
    padStartWasDown = startDown; padActionWasDown = actionDown;
    padSpecialWasDown = padInput.special;
    padBombWasDown = padInput.bomb;
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

  // The final queen gets a miniature sound stack rather than one effect: a
  // sampled impact/charge layer, a low ceremonial chord and glassy upper bells.
  // It reuses bundled audio only, so the finale stays offline and dependency-free.
  function royalSfx(kind) {
    if (!soundOn) return;
    if (kind === 'entrance') {
      sfx('bossRoar'); sfx('bossQuake');
      setTimeout(() => sfx('bossSuperHit'), 150);
    } else if (kind === 'phase') {
      sfx('bossSuperHit'); sfx('bossRoar');
      setTimeout(() => sfx('special'), 90);
    } else if (kind === 'impact') {
      sfx('special'); sfx('bossSuperHit');
      setTimeout(() => sfx('bigBoom'), 80);
    } else if (kind === 'cast') {
      sfx('special');
      setTimeout(() => sfx('bossSuperHit'), 70);
    } else {
      sfx('boss');
    }
    try {
      ensureAudio();
      if (!audioCtx) return;
      const now = audioCtx.currentTime;
      const root = kind === 'entrance' || kind === 'phase' ? 98 : kind === 'impact' ? 73.42 : 146.83;
      const ratios = [1, 1.25, 1.5, 2, 3];
      ratios.forEach((ratio, i) => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = i < 2 ? 'triangle' : 'sine';
        o.frequency.setValueAtTime(root * ratio, now + i * .018);
        if (i >= 3) o.frequency.exponentialRampToValueAtTime(root * ratio * 1.012, now + .5);
        o.connect(g); g.connect(audioCtx.destination);
        const gain = i < 2 ? .032 : .018;
        g.gain.setValueAtTime(.001, now + i * .018);
        g.gain.exponentialRampToValueAtTime(gain, now + .035 + i * .018);
        g.gain.exponentialRampToValueAtTime(.001, now + (kind === 'entrance' ? 1.25 : .72) + i * .05);
        o.start(now + i * .018); o.stop(now + (kind === 'entrance' ? 1.3 : .8) + i * .05);
      });
    } catch (_) { /* optional finale embellishment */ }
  }

  function setPaused(value) {
    if (state !== 'playing') return;
    paused = value;
    pauseLabel.classList.toggle('is-visible', paused);
    pauseButton.classList.toggle('is-paused', paused);
    pauseButton.textContent = paused ? '▶' : '❚❚';
    specialButton.disabled = paused || special < 100;
    bombButton.disabled = paused || bombStock <= 0;
    if (paused) pauseBgm();
    else { lastTime = performance.now(); playBgm(desiredBgmKey()); }
  }
  function togglePause() { setPaused(!paused); }

  function frame(now) {
    const raw = (now - lastTime) / 1000;
    let dt = clamp(raw || 0, 0, .033);
    // Quality adaptation must run even when the F1 readout is hidden. The old
    // guard left fpsAvg frozen at 60, so expensive background tiers never
    // backed off on a struggling device.
    if (raw > 0 && raw < 1) fpsAvg += (1 / raw - fpsAvg) * .1;
    lastTime = now;
    // Brief hitstop on hard impacts: real time keeps ticking (so it self-clears)
    // but gameplay dt is crushed to a near-freeze for a punchy, readable hit.
    if (hitStop > 0) { hitStop = Math.max(0, hitStop - dt); dt *= .15; }
    pollGamepad(); update(dt); draw(); requestAnimationFrame(frame);
  }

  function pad(n) { return Math.floor(n).toString().padStart(6, '0'); }
  function yen(n) { return '¥' + Math.floor(n).toLocaleString('ja-JP'); }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function rects(ax, ay, aw, ah, bx, by, bw, bh) { return ax < bx+bw && ax+aw > bx && ay < by+bh && ay+ah > by; }
  function circleRect(cx, cy, r, x, y, w, h) { const nx = clamp(cx, x, x+w); const ny = clamp(cy, y, y+h); return (cx-nx)**2 + (cy-ny)**2 < r*r; }
  // Beam vs box: inflate the box by the beam's half-thickness, then clip the
  // beam's centre line against it (Liang-Barsky). Corners read as rounded on a
  // rotated beam, which is the forgiving direction.
  function hazardHitsBox(hz, bx, by, bw, bh) {
    const pad = hz.h / 2;
    const x0 = bx - pad, y0 = by - pad, x1 = bx + bw + pad, y1 = by + bh + pad;
    const dx = Math.cos(hz.ang || 0) * hz.w, dy = Math.sin(hz.ang || 0) * hz.w;
    let t0 = 0, t1 = 1;
    const edges = [[-dx, hz.x - x0], [dx, x1 - hz.x], [-dy, hz.y - y0], [dy, y1 - hz.y]];
    for (const [p, q] of edges) {
      if (p === 0) { if (q < 0) return false; continue; }
      const r = q / p;
      if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
      else { if (r < t0) return false; if (r < t1) t1 = r; }
    }
    return true;
  }
  // Telegraph budget. The player's real terminal vertical speed is 168 px/s on
  // keyboard at SPEED 1 — the fixed point of (v + 1250*dt) * pow(.0009, dt) at
  // 60 fps. The 420/655 clamp on line ~1455 is never reached; only pointer
  // steering, which is a proportional controller, pins to it. Budget 150 px/s
  // for a 12% margin, plus .30s of reaction time.
  function telFor(px) { return clamp(.30 + px / 150, .65, 2.2) * difficulties[difficultyKey].telMul; }
  function heartPath(cx, cy, s) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * .75);
    ctx.bezierCurveTo(cx - s * 1.15, cy + s * .1, cx - s * 1.02, cy - s * .78, cx, cy - s * .22);
    ctx.bezierCurveTo(cx + s * 1.02, cy - s * .78, cx + s * 1.15, cy + s * .1, cx, cy + s * .75);
    ctx.closePath();
  }
  function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
  function shade(hex, f) { const n = parseInt(hex.slice(1), 16); const r = Math.min(255, Math.round(((n >> 16) & 255) * f)); const g = Math.min(255, Math.round(((n >> 8) & 255) * f)); const b = Math.min(255, Math.round((n & 255) * f)); return `rgb(${r},${g},${b})`; }
  // Blend two hex colours. Used for aerial perspective: distant scenery is mixed
  // toward the sky's own colour rather than just faded out, which is what the
  // air between camera and subject actually does to it.
  // Returns hex, not rgb(), so results compose: mixHex(mixHex(...), ...) works,
  // and hexA/shade still accept the output.
  function mixHex(a, b, t) {
    const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16), k = clamp(t, 0, 1);
    const m = (s) => Math.round(((x >> s) & 255) + (((y >> s) & 255) - ((x >> s) & 255)) * k);
    return '#' + ((1 << 24) | (m(16) << 16) | (m(8) << 8) | m(0)).toString(16).slice(1);
  }

  function starPath(cx, cy, outer, inner, points) { ctx.beginPath(); for (let i=0;i<points*2;i++){ const a=-Math.PI/2+i*Math.PI/points; const r=i%2?inner:outer; const x=cx+Math.cos(a)*r, y=cy+Math.sin(a)*r; i?ctx.lineTo(x,y):ctx.moveTo(x,y); } ctx.closePath(); }

  addEventListener('resize', resize);
  addEventListener('keydown', e => {
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
    keys.add(e.code);
    if (e.code === 'F1') { e.preventDefault(); fpsShow = !fpsShow; }
    if ((e.code === 'Escape' || e.code === 'KeyP') && state === 'playing') togglePause();
    if (e.code === 'KeyX' && !e.repeat) useSpecial();
    if (e.code === 'KeyC' && !e.repeat) useBomb();
    if ((e.code === 'Enter' || e.code === 'Space') && storySlides) { if (!e.repeat) advanceStory(); return; }
    if (e.code === 'Enter' && state === 'menu') { if (menuStep === 'title') showHowto(); else showOpening(); }
    else if (e.code === 'Enter' && state === 'opening') resetGame();
    else if (e.code === 'Enter' && state === 'over') {
      if (endingScreen.classList.contains('is-visible')) showStaffRoll();
      else if (staffRollScreen.classList.contains('is-visible')) finishStaffRoll();
      else resetGame();
    }
    else if (e.code === 'Enter' && state === 'shop') leaveShop();
    if (e.code === 'Escape' && state === 'menu' && menuStep === 'howto') showTitle();
    if (state === 'menu' && menuStep === 'howto' && !e.repeat) {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') stepDifficulty(-1);
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') stepDifficulty(1);
    }
    // Hidden debug keys: Shift+N skips a stage, Shift+M summons its mid boss, Shift+B summons its boss.
    if (e.shiftKey && e.code === 'KeyN' && state === 'playing' && !paused) {
      enemies = []; clearEnemyFire(); bullets = [];
      bossState = stageIndex === stages.length - 1 ? 'final' : 'transition';
      stageTransition = 2.4;
      stageResult = { kills: stageKills, time: elapsed - stageStart, noDamageBonus: stageDamaged ? 0 : 5000, timeBonus: 0 };
    }
    if (e.shiftKey && e.code === 'KeyM' && state === 'playing' && !paused && bossState === 'waiting' && !midBossDone) {
      stageTime = midbossStart();
    } else if (e.shiftKey && e.code === 'KeyM' && state === 'playing' && !paused && bossState === 'midboss-active') {
      // Second press instantly defeats the mid boss through the normal kill flow,
      // so the post-mid phases (setpiece/eliteRush) can be tested without fighting.
      const mid = enemies.find(en => en.type === 'midboss');
      if (mid) { mid.hp = 0; destroyEnemy(mid, false); }
    }
    if (e.shiftKey && e.code === 'KeyB' && state === 'playing' && !paused && (bossState === 'waiting' || bossState === 'midboss-active')) {
      midBossDone = true; enemies = enemies.filter(en => en.type !== 'midboss'); bossState = 'waiting'; stageTime = 9999;
    }
    // Shift+T fast-forwards the stage timeline 30s (stops just short of the mid/boss
    // trigger so each encounter still needs its own key) — for testing late phases.
    if (e.shiftKey && e.code === 'KeyT' && state === 'playing' && !paused && bossState === 'waiting') {
      const capAt = (midBossDone ? timelineTotal() : midbossStart()) - 1;
      stageTime = Math.min(stageTime + 30, Math.max(stageTime, capAt));
    }
  });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
  canvas.addEventListener('pointerdown', e => { if (state !== 'playing' || paused) return; pointer.active = true; const p = screenToWorld(e.clientX, e.clientY); pointer.x=p.x; pointer.y=p.y; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => { if (!pointer.active) return; const p=screenToWorld(e.clientX,e.clientY); pointer.x=p.x; pointer.y=p.y; });
  canvas.addEventListener('pointerup', () => pointer.active = false);
  canvas.addEventListener('pointercancel', () => pointer.active = false);
  titleScreen.addEventListener('click', showHowto);
  startButton.addEventListener('click', showOpening);
  nextStageButton.addEventListener('click', leaveShop);
  launchButton.addEventListener('click', resetGame);
  endingButton.addEventListener('click', showStaffRoll);
  staffRollScreen.addEventListener('click', finishStaffRoll);
  staffRollTrack.addEventListener('animationend', landOnFin);
  storyScreen.addEventListener('click', advanceStory);
  retryButton.addEventListener('click', resetGame);
  titleButton.addEventListener('click', returnToTitle);
  const difficultyOrder = ['easy', 'normal', 'hard'];
  function setDifficulty(key) {
    if (!difficulties[key] || key === difficultyKey) return;
    difficultyKey = key;
    difficultyButtons.forEach(item => item.classList.toggle('is-active', item.dataset.difficulty === key));
    sfx('power');
  }
  function stepDifficulty(dir) {
    const i = difficultyOrder.indexOf(difficultyKey);
    const next = difficultyOrder[Math.min(difficultyOrder.length - 1, Math.max(0, i + dir))];
    setDifficulty(next);
  }
  difficultyButtons.forEach(button => button.addEventListener('click', () => setDifficulty(button.dataset.difficulty)));
  soundButton.addEventListener('click', () => {
    soundOn = !soundOn;
    soundButton.textContent = soundOn ? '♪ ON' : '♪ OFF';
    soundButton.classList.toggle('is-muted', !soundOn);
    if (soundOn) {
      ensureAudio();
      if (!paused) playBgm(desiredBgmKey());
      sfx('power');
    } else {
      pauseBgm(); pauseSampledSfx();
      if (currentVoice) currentVoice.pause();
      if (bossCurrentVoice) bossCurrentVoice.pause();
    }
  });
  pauseButton.addEventListener('click', togglePause);
  specialButton.addEventListener('click', useSpecial);
  bombButton.addEventListener('click', useBomb);
  resumeButton.addEventListener('click', () => setPaused(false));
  pauseTitleButton.addEventListener('click', returnToTitle);
  addEventListener('gamepadconnected', event => {
    controllerStatus.textContent = `🎮 ${event.gamepad.id.includes('Xbox') ? 'XBOX' : 'CONTROLLER'} READY`;
    controllerStatus.classList.add('is-visible');
    setTimeout(() => controllerStatus.classList.remove('is-visible'), 2400);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') setPaused(true); });

  // Read-only state snapshot for automated testing (see also Shift+N / Shift+B).
  Object.defineProperty(window, 'GRO_DEBUG', { get: () => ({ state, bossState, stageIndex, health, special, score, totalKills, continuesLeft, bombStock, charmStock, ammo, ammoMax, ammoPackStock, bikiniOwned, bikiniOn: bikiniOn(), musicReactive, hardClear: !!localStorage.getItem('grochan-hard-clear'), stageTime, phaseId: activePhase.id, enemies: enemies.length, blocks: enemies.filter(en => en.type === 'block').length, flankers: enemies.filter(en => en.flank).length, playerBullets: bullets.length, enemyBullets: enemyBullets.length, hazards: hazards.length, grounded: player.grounded, playerY: player.y, power: player.power, firing: keys.has('Space') || keys.has('KeyZ') || pointer.active || padInput.fire, walkFrames: walkFrames.length }) });
  // Boss-fight test hooks, alongside the Shift+N/M/B keys and ?boss=N above:
  // they let a headless run drive a boss to any state without playing the fight.
  // Local only — these can set a boss's HP directly, which has no place on the
  // published page. Served from a host or from file://, they never exist.
  const LOCAL_DEV = ['localhost', '127.0.0.1', '::1', ''].includes(location.hostname);
  if (LOCAL_DEV) {
    window.__hz = () => hazards.length;
    window.__fwCount = () => ambient.filter(a => a.kind === 'fwspark').length;
    window.__bgm = () => ({ key: currentBgmKey, paused: currentBgmKey ? bgmTracks[currentBgmKey].paused : null, t: currentBgmKey ? bgmTracks[currentBgmKey].currentTime : 0, reactive: musicReactive, wired: bgmSources.size });
    window.__grant = n => { score += n; };
    window.__wall = () => spawnBlockWall();
    // Art check: drop one enemy of a given type at a fixed spot and freeze the
    // field, so a screenshot shows the sprite instead of whatever the spawner
    // happened to roll. __hold keeps it parked for inspection.
    window.__clearEnemies = () => { enemies = enemies.filter(en => en.type === 'boss' || en.type === 'midboss'); };
    window.__enemies = () => enemies.map(en => ({ type: en.type, x: Math.round(en.x), y: Math.round(en.y), hp: en.hp, lunge: en.lunge || 0 }));
    window.__spawn = (type, x, y, hold = true, over = null) => {
      spawnEnemy(type);
      const en = enemies[enemies.length - 1];
      en.x = x; en.y = y; en.baseY = y; en.variant = 'standard'; en.shield = 0;
      if (hold) { en.vx = 0; en.wave = false; en.behavior = 'cruise'; }
      if (over) Object.assign(en, over);
      return en.type;
    };
    window.__drop = (type, kind = null) => { pickups.push({ type, kind, x: player.x + 260, y: player.y + 40, r: 19, t: 0 }); };
    window.__setAmmo = n => { ammo = clamp(n, 0, ammoMax); };
    window.__grantBikini = (on = true) => { bikiniOwned = !!on; };
    window.__bikiniDump = () => ({ idle: bikiniIdle, jump: bikiniJump, fly: bikiniFly, ground: bikiniGround, hurt: bikiniHurt });
    window.__frameDump = () => ({
      bikini: { fly: bikiniFly, ground: bikiniGround },
      normal: { fly: spriteFrames, ground: groundFrames }
    });
    window.__grantAmmoPack = () => { ammoPackStock = Math.min(AMMO_PACK_MAX, ammoPackStock + 1); };
    window.__bgLayers = on => { sceneLayersOn = !!on; };
    window.__bgDir = () => backgroundDirector();
    window.__bossMaxHp = () => { const b = enemies.find(en => en.type === 'boss' || en.type === 'midboss'); return b ? b.maxHp : null; };
    window.__setSpecial = n => { special = clamp(n, 0, 100); updateSpecialButton(); };
    window.__grantBomb = () => { bombStock = Math.min(3, bombStock + 1); updateBombButton(); };
    window.__grantCharm = () => { charmStock = Math.min(3, charmStock + 1); };
    window.__setPower = n => { player.power = clamp(n, 1, 3); };
    window.__hurt = (n = 20) => hurt(n);
    window.__maxHp = () => maxHealth;
    window.__openShop = () => { openShop(); };
    window.__types = () => enemies.map(en => en.type);
    window.__boss = () => {
      const b = enemies.find(en => en.type === 'boss');
      return b ? { tier: b.tier, hp: b.hp, maxHp: b.maxHp, telType: b.telType, mode: b.mode, ghost: !!b.ghost, crit: !!b.crit, dying: b.dying || 0, x: b.x, y: b.y } : null;
    };
    window.__parkBoss = () => {
      const b = enemies.find(en => en.type === 'boss');
      if (b) { b.x = VW - b.w - 40; b.y = b.baseY; b.mode = null; b.ghost = false; b.fade = 1; }
    };
    window.__setBossDying = progress => {
      const b = enemies.find(en => en.type === 'boss' && en.dying > 0);
      if (b) b.dying = b.dyingMax * (1 - clamp(progress, 0, .99));
    };
    window.__damage = n => { const b = enemies.find(en => en.type === 'boss'); if (b) b.hp = Math.max(1, b.hp - n); };
    window.__D = () => difficulties[difficultyKey];
    window.__telFor = px => telFor(px);
    window.__setDiff = k => { difficultyKey = k; };
    window.__armTelegraph = (type, sec) => { const b = enemies.find(en => en.type === 'boss'); if (b) bossTelegraph(b, type, sec, { x: clamp(player.x + 56, 90, VW - 140), y: clamp(player.y + 55, 130, 590) }); };
    window.__setHp = frac => { const b = enemies.find(en => en.type === 'boss'); if (b) b.hp = Math.max(1, Math.round(b.maxHp * frac)); };
    window.__hide = () => { const b = enemies.find(en => en.type === 'boss'); if (b) { b.tier = Math.max(1, b.tier); startBossHide(b); } };
    window.__forceAttack = type => {
      const b = enemies.find(en => en.type === 'boss');
      if (!b) throw new Error('no boss');
      b.telType = type; b.telX = clamp(player.x + 56, 90, VW - 140); b.telY = clamp(player.y + 55, 130, 590);
      executeBossSpecial(b);
    };
  }

  // Menu theme: try to start it immediately (works when audio is already
  // unlocked, e.g. after returning from a run), and arm a one-shot gesture so a
  // fresh load's first interaction kicks it off, since browsers block autoplay.
  // Resolves via desiredBgmKey() rather than a hardcoded 'title' so it also
  // recovers correctly if the very first gesture lands after the game has
  // already moved on (e.g. the ?ending / ?staffroll direct-test modes, which
  // jump straight past the title screen with no earlier click to unlock audio).
  playBgm('title');
  const startMenuBgm = () => { if (soundOn) { ensureAudio(); playBgm(desiredBgmKey()); } };
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => addEventListener(ev, startMenuBgm, { once: true }));

  resize(); initBackdrop(); setupStage(); requestAnimationFrame(frame);

  // --- Test modes: ?stage=N starts at the beginning of a stage; ?boss=N and
  // ?mid=N start just before that encounter with normal trash spawns held back.
  // ?power=1..3 and ?wide=1..3 set weapon levels for direct combat checks.
  // localhost-only ?max=1 locks every combat stat/resource and HP at full.
  // N is 1..5. If multiple modes are present, boss > mid > stage takes priority.
  // ?ending=1 skips straight to the full-clear ending -> staff roll -> RESULT
  // sequence, bypassing gameplay entirely.
  {
    const q = new URLSearchParams(location.search);
    const directPower = clamp(parseInt(q.get('power'), 10) || 1, 1, 3);
    const directWide = clamp(parseInt(q.get('wide'), 10) || 1, 1, 3);
    testMaxLoadout = LOCAL_DEV && q.get('max') === '1';
    // Dev switch for the soundtrack unlock: ?unlock=1 sets the flag, ?unlock=0 clears it.
    if (q.get('unlock') !== null) {
      if (q.get('unlock') === '0') localStorage.removeItem('grochan-hard-clear');
      else localStorage.setItem('grochan-hard-clear', '1');
      refreshSoundtrackLinks();
    }
    // ?shop=N drops straight into the rest stop that follows stage N, with a
    // test float so every item is actually buyable. N must be < the last stage
    // (there is no shop after the final one).
    // ?bikini=1 hands over the costume so it can be inspected without playing
    // to the shop first. Applied after resetGame(), which clears it.
    const wantBikini = q.get('bikini') === '1';
    const shopN = parseInt(q.get('shop'), 10);
    const shopJump = shopN >= 1 && shopN < stages.length;
    if (shopJump) {
      setTimeout(() => {
        resetGame();
        player.power = directPower;
        player.spread = directWide;
        if (testMaxLoadout) applyTestMaxLoadout();
        if (wantBikini) bikiniOwned = true;
        stageIndex = shopN - 1;
        stageResult = { kills: 0, time: 0, noDamageBonus: 0, timeBonus: 0 };
        score += 30000;
        setupStage();
        openShop();
      }, 140);
    }
    const bossN = parseInt(q.get('boss'), 10);
    const midN = parseInt(q.get('mid'), 10);
    const directStageN = parseInt(q.get('stage'), 10);
    const mode = bossN ? 'boss' : midN ? 'mid' : directStageN ? 'stage' : null;
    const n = bossN || midN || directStageN;
    if (!shopJump && n >= 1 && n <= stages.length) {
      setTimeout(() => {
        resetGame();
        player.power = directPower;
        player.spread = directWide;
        if (testMaxLoadout) applyTestMaxLoadout();
        if (wantBikini) bikiniOwned = true;
        stageIndex = n - 1; stageBanner = mode === 'stage' ? 3 : 0; bossState = 'waiting';
        midBossDone = mode === 'boss';
        spawnTimer = mode === 'stage' ? .7 : 999;
        pickupTimer = mode === 'stage' ? 6 : 999;
        stageResult = null; setupStage(); musicStep = 0; musicClock = 0;
        stageTime = mode === 'boss' ? timelineTotal() - .5 : mode === 'mid' ? midbossStart() - .5 : 0;
        enemies = []; clearEnemyFire();
        playBgm(`stage${stageIndex}`, true);
      }, 120);
    } else if (q.get('staffroll')) {
      // Jumps straight past the ending cutscene + cameo card into the staff
      // roll itself, for a one-click check of just the credits. resetGame()
      // kicks off its own title->stage0 crossfade (~900ms); finishGame() is
      // held back until that settles so its ending-BGM crossfade has a clean
      // "previous" track to fade from instead of colliding mid-fade. It then
      // cancels the (real, click-through) cutscene before it can display and
      // replicates what its done-callback would have done — show the cameo
      // beat and start the ending theme — before jumping into the roll.
      setTimeout(() => {
        resetGame(); stageIndex = stages.length - 1;
        setTimeout(() => {
          finishGame(true);
          setTimeout(() => { cancelStory(); playBgm('ending', true); showStaffRoll(); }, 600);
        }, 950);
      }, 120);
    } else if (q.get('ending')) {
      // Same idea as ?staffroll but stops at the cameo card instead of
      // continuing into the roll.
      setTimeout(() => {
        resetGame(); stageIndex = stages.length - 1;
        setTimeout(() => {
          finishGame(true);
          setTimeout(() => { cancelStory(); endingScreen.classList.add('is-visible'); playBgm('ending', true); }, 600);
        }, 950);
      }, 120);
    }
  }
})();

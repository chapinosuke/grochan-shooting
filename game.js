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
    bossCollapse: { src: 'assets/sfx/boss-collapse.mp3', volume: .46, pool: 1, max: 3.5 }
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
    { char: 'swordman', rate: 0.72 },             // st2 SERVER GOLEM 鋼鉄巨人
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
  let bossCrit = 0;      // 0..1 fade of the palace's blood-red sky in the queen's last act
  let bgCam = 0;
  let bgCamX = 0;        // horizontal camera yaw, eased from player.x (parallax)
  let bokeh = [];        // front-of-camera defocused light orbs
  let shoppers = [];     // pedestrians walking the shopping street (neon stage)
  let formationTimer = 3;
  let fpsShow = false;   // F1 toggles a verification-only FPS readout
  let fpsAvg = 60;       // EMA of 1/rawDt
  const padInput = { x: 0, y: 0, fire: false, special: false, bomb: false };
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
    easy: { spawn: 1.08, speed: .8, damage: .55, timeScale: 1.06, bossHp: 300, score: .8, midHp: 90, bulletSpeed: .68, fireGap: 2.2, barrage: .72, gapW: 1.5, telMul: 1.3, hazardDmg: .6 },
    normal: { spawn: .72, speed: 1.05, damage: 1.05, timeScale: 1, bossHp: 560, score: 1, midHp: 170, bulletSpeed: 1, fireGap: 1, barrage: 1, gapW: 1, telMul: 1, hazardDmg: 1 },
    hard: { spawn: .55, speed: 1.28, damage: 1.35, timeScale: .92, bossHp: 800, score: 1.45, midHp: 240, bulletSpeed: 1.08, fireGap: .9, barrage: 1.28, gapW: .85, telMul: .92, hazardDmg: 1.15 }
  };
  const stages = [
    {
      name: 'TOKYO MIDNIGHT', boss: 'MASQUERADE', midBoss: 'HEART BREAKER', theme: 'neon', subtitle: '渋谷スクランブル、眠らない東京の夜',
      sky: ['#120b3e', '#3b1878', '#f044a0'], far: '#28145e', city: '#100b34', accent: '#31e8ff', accent2: '#ff3e9d',
      spawnTable: [['drone', 5], ['bat', 4], ['spinner', 3], ['tank', 2], ['racer', 4], ['seeker', 1]],
      melody: [440, 523.25, 659.25, 523.25, 392, 493.88, 587.33, 493.88, 349.23, 440, 523.25, 659.25, 392, 493.88, 659.25, 783.99],
      bass: [110, 110, 98, 98, 87.31, 87.31, 98, 123.47]
    },
    {
      name: 'AQUA HIGHWAY', boss: 'SERVER GOLEM', midBoss: 'DEEP BLUE DIVA', theme: 'aqua', subtitle: '潮風のハイウェイを駆け抜けろ',
      sky: ['#041b3d', '#075987', '#20c5c9'], far: '#123c68', city: '#071d42', accent: '#65fff2', accent2: '#2f8cff',
      spawnTable: [['bat', 3], ['jelly', 5], ['drone', 2], ['spinner', 3], ['manta', 4], ['racer', 2]],
      melody: [392, 440, 523.25, 587.33, 659.25, 587.33, 523.25, 440, 349.23, 392, 440, 523.25, 587.33, 523.25, 440, 392],
      bass: [98, 98, 87.31, 87.31, 110, 110, 87.31, 73.42]
    },
    {
      name: 'SUNSET FACTORY', boss: 'INFERNO DJINN', midBoss: 'BLAZE EMPRESS', theme: 'factory', subtitle: '燃える夕日と鋼鉄の罠',
      sky: ['#351036', '#a42f4f', '#ff9f43'], far: '#592141', city: '#28132e', accent: '#ffe15a', accent2: '#ff5a36',
      spawnTable: [['tank', 5], ['turret', 4], ['ember', 5], ['drone', 2], ['walker', 4], ['spinner', 2]],
      melody: [329.63, 329.63, 392, 329.63, 311.13, 329.63, 392, 440, 329.63, 329.63, 392, 493.88, 440, 392, 329.63, 293.66],
      bass: [82.41, 82.41, 82.41, 82.41, 77.78, 77.78, 98, 98]
    },
    {
      name: 'CYBER STORM', boss: 'BOT GENERAL', midBoss: 'VOLT PHANTOM', theme: 'storm', subtitle: '雷鳴とどろく電脳空域',
      sky: ['#071d24', '#13554b', '#48b849'], far: '#164636', city: '#071f25', accent: '#72ff68', accent2: '#31e8ff',
      spawnTable: [['glitch', 5], ['spinner', 4], ['bat', 2], ['turret', 3], ['seeker', 4], ['racer', 2]],
      melody: [293.66, 349.23, 440, 349.23, 293.66, 369.99, 440, 587.33, 293.66, 349.23, 466.16, 440, 349.23, 293.66, 246.94, 293.66],
      bass: [73.42, 73.42, 87.31, 87.31, 73.42, 73.42, 92.5, 110]
    },
    {
      name: 'HEART PALACE', boss: 'QUEEN OF HEARTBREAK', midBoss: 'LORD CENSOR', theme: 'palace', subtitle: '決戦、ハートの女王の宮殿',
      sky: ['#25051d', '#72114e', '#d82065'], far: '#4d123d', city: '#21061d', accent: '#ffe15a', accent2: '#ff3e9d',
      spawnTable: [['cupid', 5], ['drone', 2], ['bat', 3], ['spinner', 3], ['tank', 3], ['knight', 4], ['seeker', 2]],
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
      [{ img: 'assets/images/story/int2_transmission.webp', text: 'SERVER GOLEMの中には、ぬすまれたハートがぎっしり。「……気をつけて。それ、炎上の燃料にされてる……」くろ子の通信だ！' }],
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
  // Stage bosses: the four hand-made SNS villains + the queen finale.
  const bossSets = [
    loadSet('masquerade', SHEET_COUNTS),
    loadSet('server-golem', SHEET_COUNTS),
    loadSet('inferno-djinn', SHEET_COUNTS),
    loadSet('bot-general', SHEET_COUNTS),
    loadSet('stage5', GEN_COUNTS),
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
    { hit: '#ffffff', crit: '#ff8a35' },  // SERVER GOLEM white spray -> warning amber
    { hit: '#7ad7ff', crit: '#fff3bd' },  // INFERNO DJINN doused blue -> white heat
    { hit: '#ff4d4d', crit: '#72ff68' },  // BOT GENERAL   error red -> glitch green
    { hit: '#ffffff', crit: '#7a1848' },  // QUEEN         pure white -> bruised violet
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
      if (f.length) return f[Math.floor(e.t * 5) % f.length];
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
      e.hurtT = .4; e.hurtCd = 1.3;
      if (e.type === 'boss' && Math.random() < .35) bossVoice(stageIndex, 'hurt', { throttle: 3 });
    }
    // rotate through the attack frames: each newly-triggered attack (the
    // timer jumping up) advances to the next pose in the set
    if ((e.attackT || 0) > (e.prevAttackT || 0)) e.attackIdx = ((e.attackIdx || 0) + 1) % 3;
    e.prevAttackT = e.attackT || 0;
  }

  let storySlides = null, storyStep = 0, storyDone = null;
  let storyTyping = null, storyFullText = '';
  function showStory(slides, done) {
    if (!slides || !slides.length) { if (done) done(); return; }
    storySlides = slides; storyStep = -1; storyDone = done;
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
    }, 55);
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
  let nearProps = [];
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
    totalKills = 0; stageResult = null; lightning = 0; delayedBursts = [];
    special = 35; specialFlash = 0; formationTimer = 2.8;
    continuesLeft = 3; continueBanner = 0; powerDownBanner = 0;
    bombStock = 0; charmStock = 0; charmFlash = 0;
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
    else e = { type: 'cupid', x: VW + 70, y, baseY: y, w: 62, h: 58, hp: 3, maxHp: 3, vx: 120, t: Math.random() * 6, wave: true, points: 340, fire: 1.6 };
    const variantRoll = Math.random();
    e.variant = variantRoll < .11 ? 'elite' : variantRoll < .31 ? 'armored' : 'standard';
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
    const canDive = ['bat', 'racer', 'cupid', 'knight'].includes(e.type);
    e.behavior = flank ? 'cruise' : formation ? 'formation' : canDive && Math.random() < .48 ? 'dive' : Math.random() < .24 ? 'stagger' : 'cruise';
    e.fireMax = e.fire;
    enemies.push(e);
  }

  // A single fast air-type slipping in from the left so "shoot straight ahead
  // forever" stops being a safe strategy once a stage heats up.
  function spawnFlanker() {
    const GROUND_TYPES = ['tank', 'turret', 'ember', 'walker'];
    const air = stages[stageIndex].spawnTable.filter(([t]) => !GROUND_TYPES.includes(t));
    const type = air.length ? air[Math.floor(Math.random() * air.length)][0] : 'drone';
    spawnEnemy(type, null, true);
  }

  function spawnFormation(elite = false) {
    const type = pickSpawnType();
    const groundType = ['tank', 'turret', 'ember', 'walker'].includes(type);
    const count = groundType ? 2 : (Math.random() < .35 ? 4 : 3);
    const shape = Math.random() < .5 ? 'vee' : 'column';
    const centerY = 140 + Math.random() * 300;
    for (let i = 0; i < count; i++) {
      const offset = i - (count - 1) / 2;
      const y = groundType ? 560 : clamp(centerY + (shape === 'vee' ? Math.abs(offset) * 58 : offset * 64), 75, 535);
      spawnEnemy(type, { y, xOffset: i * 82 + (shape === 'vee' ? Math.abs(offset) * 35 : 0), shape, slot: i, elite });
    }
    formationTimer = 3.2 + Math.random() * 2.4;
  }

  // Big scripted formations for the 'setpiece' phase — each stage uses its own
  // signature enemies from the spawnTable, so no bespoke enemy code is needed.
  function runSetpiece(step) {
    const table = stages[stageIndex].spawnTable;
    const GROUND_TYPES = ['tank', 'turret', 'ember', 'walker'];
    const air = table.filter(([t]) => !GROUND_TYPES.includes(t));
    const ground = table.filter(([t]) => GROUND_TYPES.includes(t));
    const airType = air.length ? air[step % air.length][0] : 'drone';
    const pattern = step % 3;
    if (pattern === 0) {
      // Double vee: one wing high, one wing low.
      for (const cy of [150, 420]) for (let i = 0; i < 5; i++) {
        const off = i - 2;
        spawnEnemy(airType, { y: clamp(cy + Math.abs(off) * 52, 75, 535), xOffset: Math.abs(off) * 70, shape: 'vee', slot: i });
      }
    } else if (pattern === 1 && ground.length) {
      // Ground column with air cover.
      for (let i = 0; i < 3; i++) spawnEnemy(ground[i % ground.length][0], { y: 560, xOffset: i * 120, shape: 'column', slot: i });
      for (let i = 0; i < 3; i++) spawnEnemy(airType, { y: 140 + i * 90, xOffset: i * 60, shape: 'column', slot: i });
    } else {
      // Pincer: two columns closing from top and bottom.
      for (let i = 0; i < 4; i++) {
        spawnEnemy(airType, { y: 90 + i * 46, xOffset: i * 85, shape: 'column', slot: i });
        spawnEnemy(airType, { y: 530 - i * 46, xOffset: i * 85, shape: 'column', slot: i });
      }
    }
  }

  function spawnBoss() {
    const bossHp = Math.round(difficulties[difficultyKey].bossHp * (1 + stageIndex * .55));
    // With a loaded sprite the hitbox takes the art's aspect ratio at a large
    // fixed height, so the visual and the collision box stay in sync (tall
    // sprites no longer get an invisible wide hitbox). 460×380 is the
    // procedural-art fallback.
    const sprite = frameReady(bossSets[stageIndex].idle[0]) ? bossSets[stageIndex].idle[0] : bossSprites[stageIndex];
    let w = 460, h = 380;
    if (sprite && sprite.complete && sprite.naturalWidth) {
      h = 560; w = Math.round(h * sprite.naturalWidth / sprite.naturalHeight);
    }
    // The contact box is pulled inside the artwork: several sprites are wide
    // enough to overlap the player's own movement limit, which turned simply
    // standing at the right edge into passive contact damage.
    enemies.push({ type: 'boss', x: VW + 380, y: 90, baseY: 90, w, h, hp: bossHp, maxHp: bossHp, vx: 0, t: 0, wave: false, points: 18000 + stageIndex * 4000, fire: .7, sp: 2.8, hitInset: Math.round(w * .16), hitInsetY: Math.round(h * .08), tier: 0, tierBanner: 0, crit: false });
    bossState = 'active';
    musicStep = 0; musicClock = 0;
    clearEnemyFire();
    shake = 18; flash = .55;
    playBgm(stageIndex === stages.length - 1 ? 'finalBoss' : 'bossBattle', true);
    sfx('boss'); sfx('warning'); sfx('bossRoar'); sfx('bossQuake');
    bossVoice(stageIndex, 'appear');
  }

  function spawnMidBoss() {
    const baseHp = difficulties[difficultyKey].midHp;
    const hp = Math.round(baseHp * (1 + stageIndex * .38));
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
    if (engaged && e.fire <= 0) {
      const ox = e.x + 12, oy = e.y + e.h / 2;
      const aim = Math.atan2(player.y + 45 - oy, player.x - ox);
      const count = rage ? 7 : 5;
      for (let i = 0; i < count; i++) {
        const a = aim + (i - (count - 1) / 2) * .17;
        enemyBullets.push({ x: ox, y: oy, vx: Math.cos(a) * (270 + stageIndex * 22), vy: Math.sin(a) * (270 + stageIndex * 22), r: 10, life: 6.5, damage: 16 + stageIndex, boss: true, volt: stageIndex === 3, fire: stageIndex === 2, heart: stageIndex === 4, bubble: stageIndex === 1 });
      }
      burst(ox, oy, stages[stageIndex].accent2, 10, 190); e.fire = rage ? .42 : .58;
      e.attackT = .45;
    }
    if (engaged && e.sp <= 0) {
      e.attackT = .55;
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
      if (e.geyserT > 0) { e.geyserT -= dt; if (e.geyserT <= 0) golemGeyser(e.geyserX); }
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
      bossBubbles(e); sfx('bubble');
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
    e.y += 12 * dt;
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
    sfx('boss'); sfx('bossSuperHit');
    bossVoice(idx, e.tier >= 2 ? 'attack' : 'serious');
    e.sp = .9; e.fire = .5;
    if (idx === 4 && e.tier === 1) summonConsorts(e);
    if (e.tier >= 1) startBossHide(e);
  }

  // One place that arms a telegraph, so every attack pays the same reaction tax.
  function bossTelegraph(e, type, sec, opts = {}) {
    e.telType = type; e.telMax = sec; e.tel = sec;
    e.telX = opts.x; e.telY = opts.y;
    sfx('boss');
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
          const pick = e.tier >= 1 && Math.random() < .5 ? 'curtain' : 'dash';
          bossTelegraph(e, pick, telFor(pick === 'curtain' ? 90 : 70), {
            y: pick === 'curtain' ? clamp(player.y + 55, 130, 590) : clamp(player.y - 30, 40, 480),
          });
          e.sp = [5.2, 3.8, 3.0][e.tier || 0];
        }
      }
    } else if (idx === 1) {
      e.y = bobY(e.baseY + 30, 80);
      if (engaged && e.fire <= 0) { bossBubbles(e); e.fire = e.phase2 ? .48 : .7; }
      if (engaged && e.sp <= 0 && !(e.tel > 0)) {
        const pick = e.tier >= 1 && Math.random() < .45 ? 'flood' : 'wave';
        bossTelegraph(e, pick, pick === 'flood' ? telFor(40) : telFor(90), { y: clamp(player.y + 55, 130, 590) });
        e.sp = [4.6, 3.2, 2.6][e.tier || 0];
      }
    } else if (idx === 2) {
      e.y = bobY(e.baseY + 50, 55);
      if (engaged && e.fire <= 0) {
        if (e.phase2) { bossFlameSweep(e); e.fire = .12; } else { bossFireball(e); e.fire = .85; }
      }
      if (engaged && e.sp <= 0 && !(e.tel > 0)) {
        const pick = e.tier >= 1 && Math.random() < .5 ? 'heatwall' : 'pillar';
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
        bossHeartSpiral(e, e.tier >= 2 ? 4 : 2);
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
    else if (type === 'flood') bossDataFlood(e);
    else if (type === 'railgun') bossRailgun(e, e.phase2 ? 3 : 2);
    else if (type === 'cannon') bossHeartCannon(e);
    else if (type === 'lattice') bossRoseLattice(e);
  }

  function bossFan(e, n) {
    e.attackT = .45;
    const ox = e.x + 18, oy = e.y + e.h / 2;
    n = Math.max(4, Math.round(n * difficulties[difficultyKey].barrage));
    const aim = Math.atan2(player.y + 45 - oy, player.x - ox);
    for (let i = 0; i < n; i++) {
      const a = aim + (i - (n - 1) / 2) * .19;
      enemyBullets.push({ x: ox, y: oy, vx: Math.cos(a) * 285, vy: Math.sin(a) * 285, r: 10, life: 6, damage: 18, boss: true });
    }
    burst(ox, oy, '#ff3e9d', 9, 190);
  }

  function bossBubbles(e) {
    e.attackT = .45;
    const ox = e.x + 20, oy = e.y + e.h / 2;
    const aim = Math.atan2(player.y + 45 - oy, player.x - ox);
    for (let i = -1; i <= 1; i++) {
      const a = aim + i * .3;
      enemyBullets.push({ x: ox, y: oy, vx: Math.cos(a) * 190, vy: Math.sin(a) * 190, r: 11, life: 7, damage: 13, bubble: true, drift: 220 });
    }
    sfx('bubble');
  }

  function bossBubbleWall(e) {
    // Opening measured in px and anchored to where the player was told to be.
    const half = 112 * difficulties[difficultyKey].gapW;
    const gapY = e.telY === undefined ? clamp(player.y + 55, 130, 590) : e.telY;
    for (let i = 0; i < 8; i++) {
      const y = 60 + i * 85;
      if (Math.abs(y - gapY) < half) continue;
      enemyBullets.push({ x: e.x - 30, y, vx: -235, vy: 0, r: 13, life: 8, damage: 15, bubble: true, grazeMul: .4 });
    }
    sfx('boss');
  }

  function bossFireball(e) {
    e.attackT = .45;
    const ox = e.x + 20, oy = e.y + e.h / 2;
    for (const lead of [0, 90]) {
      enemyBullets.push({ x: ox, y: oy, vx: (player.x + lead - ox) / 1.3, vy: -300 - Math.random() * 110, gravity: 430, r: 12, life: 6, damage: 17, fire: true });
    }
    sfx('fireball');
  }

  function bossFlameSweep(e) {
    e.attackT = .45;
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
    e.attackT = .45;
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
    e.attackT = .45;
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    const n = Math.max(8, Math.round(12 * difficulties[difficultyKey].barrage));
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      enemyBullets.push({ x: cx, y: cy, vx: Math.cos(a) * 240, vy: Math.sin(a) * 240, r: 8, life: 4, damage: 13, volt: true });
    }
  }

  function bossHeartSpiral(e, arms = 2) {
    e.attackT = .45;
    const cx = e.x + 40, cy = e.y + e.h / 2;
    for (let i = 0; i < arms; i++) {
      const a = e.spiral + i / arms * Math.PI * 2;
      enemyBullets.push({ x: cx, y: cy, vx: Math.cos(a) * 210, vy: Math.sin(a) * 210, r: 10, life: 6, damage: 16, heart: true, grazeMul: .7 });
    }
  }

  function bossHeartWall(e) {
    // The opening is measured in pixels, not lanes: one 85px lane leaves 59px of
    // real clearance, narrower than the player's own 68px airborne hitbox.
    const half = 112 * difficulties[difficultyKey].gapW;
    const gapY = e.telY === undefined ? clamp(player.y + 55, 130, 590) : e.telY;
    for (let i = 0; i < 8; i++) {
      const y = 60 + i * 85;
      if (Math.abs(y - gapY) < half) continue;
      enemyBullets.push({ x: e.x - 30, y, vx: -245, vy: 0, r: 11, life: 8, damage: 18, heart: true, grazeMul: .4 });
    }
    sfx('boss');
  }

  function bossHeartRing(e) {
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    const n = Math.max(6, Math.round(10 * difficulties[difficultyKey].barrage));
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      enemyBullets.push({ x: cx, y: cy, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, r: 10, life: 7, damage: 18, heart: true, homing: .5 });
    }
    sfx('boss');
  }

  // A full-height wall of shot with one corridor, opened at the height the
  // player was standing when the telegraph fired. At a real 168 px/s there is
  // no reaching a randomly placed gap, so anchoring it is the only fair option.
  function bossCurtain(e, side) {
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
      enemyBullets.push({ x: VW + 26, y, vx: -sp, vy: 0, r: 12, life: 9, damage: 15, grazeMul: .4, ...tag });
    }
    e.curtainY = cy;
    sfx('boss');
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
    const rollers = Math.max(3, Math.round(5 * D.barrage));
    for (let i = 0; i < rollers; i++) {
      enemyBullets.push({ x: e.x - 20, y: 604 + i * 14, vx: -260, vy: 0, r: 14, life: 6, damage: 16, fire: true, grazeMul: .4 });
    }
  }

  function golemGeyser(x) {
    for (let i = 0; i < 9; i++) {
      enemyBullets.push({ x: x + (Math.random() - .5) * 34, y: 700 + i * 40, vx: 0, vy: -520, r: 14, life: 3.2, damage: 16, bubble: true, grazeMul: .4 });
    }
    burst(x, 660, '#65fff2', 20, 300); shake = 9; sfx('bubble');
  }

  // Three screen-wide bands staggered by .8s. The first lands on the player's
  // own row, so the opening move is always forced.
  function bossDataFlood(e) {
    const D = difficulties[difficultyKey];
    const h = 70 / D.gapW;
    const py = clamp(player.y + 55, 70, 640);
    const rows = [py, clamp(py - 240, 70, 640), clamp(py + 240, 70, 640)];
    rows.forEach((y, i) => hazards.push({
      kind: 'beam', x: 0, y, w: VW, h, ang: 0,
      warn: telFor(h / 2 + 34) + i * .8, live: .45, fade: .22, lock: 0, t: 0,
      damage: 26, color: '#65fff2',
    }));
    sfx('boss');
  }

  // Tracks the player, then commits. The freeze is the whole mechanic: dodge
  // after the lock, not before.
  function bossRailgun(e, shots) {
    const D = difficulties[difficultyKey];
    const cx = e.x + 30, cy = e.y + e.h * .42;
    for (let i = 0; i < shots; i++) {
      hazards.push({
        kind: 'beam', x: cx, y: cy, w: 1500, h: 56 / D.gapW, ang: Math.PI,
        warn: 1.15 * D.telMul + i * .62, live: .26, fade: .2,
        lock: (i === 0 ? .72 : .62) * D.telMul, aim: true, t: 0,
        damage: 28, color: '#72ff68',
      });
    }
    lightning = .3; lightningX = e.x; sfx('thunder');
  }

  // The queen's signature: a band thick enough to own a third of the screen.
  // Deliberately static — a sweeping version is unavoidable at the player's
  // real top speed, so instead a second band answers on the opposite side.
  function bossHeartCannon(e) {
    const D = difficulties[difficultyKey];
    const h = D.gapW > 1.2 ? 190 : D.gapW < .9 ? 300 : 260;
    const py = clamp(player.y + 55, 60, 660);
    hazards.push({
      kind: 'beam', x: e.x + 20, y: py, w: 1400, h, ang: Math.PI,
      warn: telFor(h / 2 + 34), live: .6, fade: .3, lock: 0, t: 0,
      damage: 30, color: '#ff3e9d',
    });
    for (let i = 0; i < 3; i++) delayedBursts.push({ x: e.x + 40, y: e.y + e.h * .4, t: .3 + i * .32, color: '#ff9ccf' });
    sfx('bossSuperHit');
  }

  // Four arms whose bullets leave at staggered speeds, so the volley unrolls
  // into a rose instead of a flat ring.
  function bossRoseLattice(e) {
    const D = difficulties[difficultyKey];
    const arms = 4, per = Math.max(6, Math.round(8 * D.barrage));
    const cx = e.x + 40, cy = e.y + e.h * .45;
    for (let a = 0; a < arms; a++) {
      const ang = (e.spiral || 0) + a / arms * Math.PI * 2;
      for (let i = 0; i < per; i++) {
        enemyBullets.push({ x: cx, y: cy, vx: Math.cos(ang) * (120 + i * 26), vy: Math.sin(ang) * (120 + i * 26), r: 10, life: 7, damage: 14, heart: true, grazeMul: .4 });
      }
    }
    sfx('boss');
  }

  // Two shootable hearts orbiting the queen from act two, so she can never be
  // the only thing on screen worth watching.
  function summonConsorts(e) {
    for (const side of [-1, 1]) {
      enemies.push({ type: 'consort', x: e.x + 40, y: e.y + e.h / 2, w: 74, h: 74, hp: 8, maxHp: 8, vx: 0, t: 0, wave: false, points: 400, fire: 1.6, orbit: side > 0 ? 0 : Math.PI });
    }
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
    elapsed += dt;
    if (bossState === 'waiting') stageTime += dt;
    stageBanner = Math.max(0, stageBanner - dt);
    continueBanner = Math.max(0, continueBanner - dt);
    powerDownBanner = Math.max(0, powerDownBanner - dt);
    charmFlash = Math.max(0, charmFlash - dt);
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
      const inten = activePhase.intensity ?? .5;
      const mode = activePhase.mode;
      if (mode === 'calm') {
        if (enemies.length < 3) spawnEnemy();
        spawnTimer = 1.4 + Math.random() * .8;
      } else if (mode === 'trickle') {
        if (enemies.length < 5) spawnEnemy();
        spawnTimer = (.7 + Math.random() * .4) * difficulty.spawn;
      } else if (mode === 'setpiece') {
        // Scripted launches happen below; keep only a light filler trickle here.
        if (enemies.length < 4) spawnEnemy();
        spawnTimer = 1.1 + Math.random() * .5;
      } else if (mode === 'formation') {
        if (inten >= .5 && Math.random() < .1 + .2 * inten) spawnFlanker();
        const cap = Math.round(7 + 4 * inten) + stageIndex;
        if (enemies.length < cap) {
          spawnFormation(activePhase.elite);
          if (Math.random() < .4 && enemies.length < cap) spawnFormation(activePhase.elite);
        }
        spawnTimer = 1.2 + Math.random() * .5;
      } else { // assault
        // Hot phases also roll rear flankers so the player has to watch their back.
        if (inten >= .5 && Math.random() < .1 + .2 * inten) spawnFlanker();
        const cap = Math.round(6 + 4 * inten) + stageIndex;
        if (formationTimer <= 0 && enemies.length < cap) {
          spawnFormation();
          // Bonus second pack for volume
          if (Math.random() < .55 && enemies.length < cap) spawnFormation();
          spawnTimer = 1.05 + Math.random() * .35;
        } else if (enemies.length < cap) {
          spawnEnemy();
          if (Math.random() < .45 && enemies.length < cap) spawnEnemy();
          if (Math.random() < .44 * inten && enemies.length < cap) spawnEnemy();
          spawnTimer = ((.32 + Math.random() * .28) * difficulty.spawn) / (gameSpeed * (.6 + inten * .8));
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
      const roll = Math.random();
      // Once all upgrades are maxed, mostly drop heals so 5-minute stages don't
      // shower the player with dead pickups.
      const allMaxed = player.power >= 3 && player.spread >= 3 && player.speed >= 3;
      const bombRoom = bombStock < 3;
      // Bomb carves a small slice out of the tail of each branch, falling back
      // to heal once stocked up so the drop pool doesn't waste rolls on it.
      const type = allMaxed
        ? (roll < .74 ? 'heal' : roll < .81 ? 'power' : roll < .88 ? 'spread' : roll < .95 ? 'speed' : bombRoom ? 'bomb' : 'heal')
        : roll < .26 ? 'heal' : roll < .49 ? 'power' : roll < .70 ? 'spread' : roll < .91 ? 'speed' : bombRoom ? 'bomb' : 'heal';
      pickups.push({ type, kind: type === 'heal' ? (Math.random() < .5 ? 'drink' : 'burger') : null, x: VW + 30, y: 100 + Math.random() * (VH - 240), r: 19, t: 0 });
      pickupTimer = (8 + Math.random() * 7) * (activePhase.mode === 'calm' ? 1.6 : 1);
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
      e.fire -= dt / difficulty.fireGap;
      if (e.fire <= 0 && e.x < VW - 90) {
        enemyShoot(e);
        const cadence = e.type === 'tank' ? 1.1 : e.type === 'turret' ? 1.4 : e.type === 'spinner' ? 1.8 : e.type === 'glitch' ? 1.9 : e.type === 'cupid' ? 2 : e.type === 'racer' ? 1.5 : e.type === 'manta' ? 1.9 : e.type === 'walker' ? 1.25 : e.type === 'seeker' ? 1.45 : e.type === 'knight' ? 1.7 : 2.1 + Math.random();
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
    enemies = enemies.filter(e => (e.hp > 0 || e.dying > 0) && (e.type === 'boss' || e.x > -130) && (!e.flank || e.x < VW + 170));
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
          b.life = 0;
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
          break;
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
        else { health = Math.min(maxHealth, health + 32); voice('heal'); }
        burst(p.x, p.y, p.type === 'power' ? '#ff8a35' : p.type === 'spread' ? '#31e8ff' : p.type === 'speed' ? '#72ff68' : p.type === 'bomb' ? '#c9d6ec' : '#ffe15a', 22, 260); sfx('power');
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
    burst(ex, ey, e.type === 'bat' ? '#ff3e9d' : '#ffe15a', isMajor ? (isBoss ? 90 : 55) : e.type === 'tank' ? 28 : 15, isMajor ? (isBoss ? 520 : 420) : e.type === 'tank' ? 330 : 240);
    burstDebris(ex, ey, [stages[stageIndex].accent2, '#5a4058', '#2a1f2c'], isMajor ? (isBoss ? 26 : 18) : e.type === 'tank' ? 12 : 7, isMajor ? 420 : e.type === 'tank' ? 300 : 220);
    shake = isMajor ? (isBoss ? 28 : 20) : e.type === 'tank' ? 12 : 6; flash = isMajor ? (isBoss ? 1 : .6) : e.type === 'tank' ? .35 : .12; sfx(isMajor ? 'bigBoom' : 'boom');
    hitStop = Math.max(hitStop, isMajor ? (isBoss ? .12 : .09) : e.type === 'tank' ? .05 : .03);
    if (isMajor) {
      // FF-style death: the body stays on the field as a corpse and burns away
      // over a few seconds (updateDyingBoss / drawDeathDissolve) instead of
      // vanishing on the killing frame. The culling filter keeps it alive
      // while e.dying > 0; hp<=0 already makes it non-collidable everywhere.
      e.dying = e.dyingMax = isBoss ? 3.4 : 2.2;
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
      playBgm(`stage${stageIndex}`, true);
      stageBanner = 2.2;
    }
    if (isBoss) {
      bossState = stageIndex === stages.length - 1 ? 'final' : 'transition'; stageTransition = 4.6;
      clearEnemyFire(); bullets = []; musicStep = 0; musicClock = 0;
      sfx('bossCollapse'); sfx('thunder'); bossVoice(stageIndex, 'death');
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
      item.btn.querySelector('.shop-status').textContent = maxed ? 'MAX' : item.status();
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
    if (cleared) resultTimeout = setTimeout(() => showStory(STORY.ending, () => { endingScreen.classList.add('is-visible'); playBgm('ending', true); }), 450);
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
    const theme = stage.theme;
    if (theme === 'neon') drawNeonBackdrop(stage);
    else if (theme === 'aqua') drawAquaBackdrop(stage);
    else if (theme === 'factory') drawFactoryBackdrop(stage);
    else if (theme === 'storm') drawStormBackdrop(stage);
    else drawPalaceBackdrop(stage);
    // A dedicated volume pass sits above the flat scenic layers but below
    // particles/gameplay. Every stage gets large objects with visible top/side
    // faces, a shared vanishing point and strong scale separation.
    drawStageVolume(stage);
    drawAmbient();
    drawNearScenery(stage);
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
    bgLayer(.08, () => {
      // Nested arches shrink toward the central throne-room vanishing point.
      // Each arch is built from extruded pillars and a top beam, creating a
      // corridor rather than a single flat row of columns.
      for (let i = 5; i >= 0; i--) {
        const t = i / 6, inset = 72 + t * 350, topY = 228 + t * 190;
        const baseY = 650, pw = 46 - t * 24, depth = 24 - t * 13;
        const alpha = .26 + (1 - t) * .42;
        drawVolumeBox(inset, topY, pw, baseY - topY, depth, '#2c0a24', '#10030e', '#7b2051', alpha, hexA('#ffe15a', .32));
        drawVolumeBox(VW - inset - pw, topY, pw, baseY - topY, depth, '#2c0a24', '#10030e', '#7b2051', alpha, hexA('#ffe15a', .32));
        drawVolumeBox(inset, topY, VW - inset * 2, 22, depth, '#3a0d2d', '#130411', '#9a2b61', alpha, hexA(stage.accent2, .42));
        ctx.save(); ctx.globalAlpha = alpha * .55; ctx.strokeStyle = '#ffe15a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(VW / 2, topY + 22, (VW - inset * 2) * .22, Math.PI, 0); ctx.stroke(); ctx.restore();
      }
    });
    drawVolumeFloor(stage, { horizon: 506, bottom: 744, color: '#ffd27a', alpha: .17, speed: .34 });
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
    bgLayer(.15, () => {
      for (const p of bgProps) if (p.kind === 'car') drawFlyingCar(p, stage);
      drawCity((elapsed * -20) % 120, 600, stage.city, 54, .78, 18);
      drawTokyoExpressway(stage);
      drawNeonRail(stage);
      drawStorefronts(stage);
      drawShibuyaScreen(stage);
    });
    drawScrambleCrossing(stage);
    drawGroundLayer();
    drawGroundPlane(stage, { horizonY: 606, bottom: 704, alpha: .1, speed: 90, gap: 110 });
    drawTokyoRoadLights(stage);
    drawShoppers();
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
    const sea = ctx.createLinearGradient(0, ground, 0, VH);
    sea.addColorStop(0, '#0b3f66'); sea.addColorStop(1, '#031225');
    ctx.fillStyle = sea; ctx.fillRect(0, ground, VW, VH - ground);
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const y = 676 + i * 16;
      ctx.globalAlpha = .3 - i * .08; ctx.strokeStyle = '#bdf3ff'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = -20; x <= VW + 20; x += 16) {
        const yy = y + Math.sin(x * .045 + elapsed * (2.2 - i * .5) + i * 2) * 4;
        if (x === -20) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
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
    const base = ctx.createLinearGradient(0, ground, 0, VH);
    base.addColorStop(0, '#3a0f2e'); base.addColorStop(1, '#12030f');
    ctx.fillStyle = base; ctx.fillRect(0, ground, VW, VH - ground);
    // marble tiles with gold seams
    const off = (elapsed * 100) % 110;
    ctx.save(); ctx.globalAlpha = .55;
    for (let x = -off - 110; x < VW + 110; x += 110) {
      ctx.strokeStyle = 'rgba(255,225,90,.5)'; ctx.lineWidth = 2; ctx.strokeRect(x, ground + 8, 104, 58);
      ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(x + 4, ground + 12, 44, 20);
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
    bgLayer(.15, () => {
      ctx.save(); ctx.globalAlpha = .5; ctx.fillStyle = stage.far;
      ctx.beginPath(); ctx.ellipse(430, 560, 150, 42, 0, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.ellipse(780, 566, 90, 26, 0, Math.PI, 0); ctx.fill();
      ctx.restore();
      for (const p of bgProps) if (p.kind === 'lighthouse') drawLighthouse(p);
    });
    drawOcean(stage);
    for (const p of bgProps) if (p.kind === 'fish') drawFish(p, stage);
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
    bgLayer(.5, () => {
      drawMoon(640, 468, 88, '#ffb347', 'rgba(255,120,60,A)');
      ctx.save(); ctx.globalAlpha = .45; ctx.fillStyle = stage.sky[1];
      for (let i = 0; i < 4; i++) ctx.fillRect(530, 448 + i * 20, 220, 5 + i * 3);
      ctx.restore();
      for (const c of clouds) drawCloud(c, '#ffd9a0', .13);
      drawFactoryFlares(stage);
    });
    // Far duplicate tank row sunk into the haze behind the main refinery.
    bgLayer(.32, () => drawRefineryTanks(stage, .55, .38, -150));
    drawDepthHaze(stage, .5);
    bgLayer(.15, () => {
      drawRefineryTanks(stage);
      drawCranes(stage);
      drawChimneys();
    });
    // gear/hammer are intentionally screen-fixed props — keep them outside bgLayer.
    for (const p of bgProps) if (p.kind === 'gear') drawGear(p, stage);
    drawCity((elapsed * -20) % 120, 600, stage.city, 54, .8, 18);
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
    // Circuit seams pulse with each lightning flash for a synced "power surge".
    const surge = .32 + Math.min(1, lightning * 2.4) * .68;
    bgLayer(.5, () => {
      drawStars(26, '#8fffb0', '#4de3a0');
      drawCyberVortex(stage, surge);
      drawWireRings(stage, surge);
      drawDataRoutes(stage, surge);
      for (const c of clouds) drawCloud(c, '#03120f', .55);
    });
    bgLayer(.32, () => {
      // Ultra-far third spire ridge behind the existing two.
      drawDataSpires((elapsed * -3) % 90, 520, 30, .18, surge * .3);
      drawDataSpires((elapsed * -7) % 126, 545, 44, .34, surge * .5);
    });
    drawDepthHaze(stage, .4);
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
    bgLayer(.32, () => {
      drawPalaceTowers(stage);
      // Middle colonnade row between the towers and the hero colonnade.
      drawColonnade(.6, .4, 34);
    });
    drawDepthHaze(stage, .45);
    bgLayer(.15, () => {
      drawPalaceThrone(stage);
      drawColonnade();
    });
    drawPalaceFloor(stage);
    drawGroundPlane(stage, { horizonY: 652, bottom: 716, color: '#ff9ccf', alpha: .12, speed: 150, gap: 128 });
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
    ctx.restore();
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

  // scale/alpha/speed allow a smaller, slower duplicate row deeper in the scene;
  // the transform keeps the columns anchored to their y=652 base line.
  function drawColonnade(scale = 1, alpha = .85, speed = 60) {
    const off = (elapsed * -speed) % 260;
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.translate(0, 652 * (1 - scale)); ctx.scale(scale, scale);
    for (let i = -1; i < Math.ceil(VW / scale / 260) + 1; i++) {
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
      ctx.fillStyle = '#ff8a35'; ctx.fillRect(boss.geyserX - 32, 636, 64, 24);
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
  };

  // Drawn over the boss rather than under it: a charge orb at the muzzle, rings
  // collapsing into it, a countdown arc, and the attack's name.
  function drawBossTelegraphOverlay() {
    const boss = enemies.find(e => e.type === 'boss' && e.tel > 0 && e.telType);
    if (!boss) return;
    const tp = clamp(1 - boss.tel / (boss.telMax || 1), 0, 1);
    const mx = boss.x + 40, my = boss.y + boss.h * .42;
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
    // Mirror the sprite horizontally when retreating (facing left). Pivot on the
    // visual center so the flip stays put; shadow/thruster above are left un-mirrored.
    ctx.save();
    if (player.facing === -1) { const pivot = player.x + 56; ctx.translate(pivot, 0); ctx.scale(-1, 1); ctx.translate(-pivot, 0); }
    if (player.hit > 0 && hurtFrames.length) {
      // Damage/hurt: play the 4-frame knock-around animation once over HURT_DUR. Cells are
      // uniform and ground-aligned, so drawn size is constant (never pops bigger); feet sit
      // on the floor when grounded, tucked up a touch while airborne.
      const HURT_DUR = .45;
      const idx = Math.max(0, Math.min(hurtFrames.length - 1,
        Math.floor((1 - player.hit / HURT_DUR) * hurtFrames.length)));
      const hy = player.grounded ? player.y - 24 : player.y - 23 + bob;
      const hx = player.grounded ? player.x - 30 : player.x - 22;
      const hh = player.grounded ? 183 : 152;
      ctx.drawImage(hurtFrames[idx], hx, hy, hh * (298 / 308), hh);
    } else if (player.takeoff > 0 && jumpFrame) {
      // Jump / takeoff cell from the sheet.
      ctx.drawImage(jumpFrame, player.x - 10, player.y - 26 + bob, 128, 175);
    } else if (player.grounded && groundFrames.length) {
      // Ground: distance-synchronised frames plus a small body lift make each
      // planted step read clearly. Shooting alone does not fake a walk cycle.
      const walking = Math.abs(player.vx) > 24;
      const walkLift = walking ? Math.abs(Math.sin(player.walkPhase * Math.PI / 2)) * 3 : 0;
      const frame = walking
        ? groundFrames[1 + (Math.floor(player.walkPhase) % 4)]
        : groundFrames[0];
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
      ctx.drawImage(frame, player.x - 30, player.y - 24 - walkLift, 177, 183);
    } else if (spriteFrames.length) {
      const frame = spriteFrames[Math.floor(player.frame) % spriteFrames.length];
      ctx.drawImage(frame, player.x - 13, player.y - 22 + bob, 132, 167);
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
    ctx.fillStyle = b.damage >= 3 ? '#ff8a35' : '#ffe15a';
    ctx.beginPath(); ctx.arc(8, 0, size * .72, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(9, 0, size * .34, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
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

  function drawEnemy(e) {
    const stage = stages[stageIndex];
    // A boss that has left the field is neither drawn nor collidable; the
    // spectacle during that window belongs to whatever it left behind.
    if (e.ghost) return;
    ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y));
    if (e.fade !== undefined && e.fade < 1) ctx.globalAlpha = Math.max(0, e.fade);
    if (e.type === 'mirage') { drawMirage(e); ctx.restore(); return; }
    if (e.type === 'consort') { drawConsort(e); ctx.restore(); return; }
    // Flankers travel rightward — mirror the sprite so they face their heading.
    if (e.flank) { ctx.translate(e.w, 0); ctx.scale(-1, 1); }
    if (e.type !== 'boss' && e.type !== 'midboss') {
      drawEnemyShadow(e);
      drawEnemyUnderglow(e, stage.accent2);
    }
    if (e.type === 'drone') {
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
    // Damage state: cracked plating + occasional ember once badly hurt.
    if (e.maxHp > 1 && e.hp / e.maxHp < .4) {
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
    // Stage-color decal: a small squad-insignia badge ties every enemy back
    // to the current stage's palette, independent of the type's own colors.
    if (e.type !== 'ember') {
      const stage = stages[stageIndex];
      ctx.save(); ctx.globalAlpha = .65; ctx.fillStyle = stage.accent2;
      ctx.beginPath(); ctx.roundRect(e.w - 14, e.h - 14, 9, 9, 2); ctx.fill();
      ctx.globalAlpha = .9; ctx.fillStyle = stage.accent;
      ctx.beginPath(); ctx.arc(e.w - 9.5, e.h - 9.5, 2, 0, Math.PI * 2); ctx.fill();
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
    const sprite = pickPoseFrame(bossSets[stageIndex], e) || (frameReady(bossSprites[stageIndex]) ? bossSprites[stageIndex] : null);
    if (sprite) {
      // The spawn hitbox already carries the art's aspect ratio, so filling the
      // whole 230×190 authoring box draws the sprite undistorted. The main
      // animation is the pose switch (idle / attack windup+strike / pained
      // hurt); body language on top: breathing, a hard forward lean while
      // dashing, a pain jitter while hurt, a strobe while teleporting.
      const hurt = e.hurtT > 0;
      const breath = Math.sin(e.t * 2.6) * .022;
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
      const dy0 = 190 - dh + Math.sin(e.t * 2.2) * 5;
      if (e.dying > 0) { drawDeathDissolve(sprite, dx0, dy0, dw, dh, e); ctx.restore(); return; }
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
    const aura = p.type === 'heal' ? '#72ff68' : p.type === 'power' ? '#ff8a35' : p.type === 'spread' ? '#31e8ff' : p.type === 'bomb' ? '#c9d6ec' : '#ffe15a';
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
    if (fpsShow && raw > 0 && raw < 1) fpsAvg += (1 / raw - fpsAvg) * .1;
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
  Object.defineProperty(window, 'GRO_DEBUG', { get: () => ({ state, bossState, stageIndex, health, special, score, totalKills, continuesLeft, bombStock, charmStock, stageTime, phaseId: activePhase.id, enemies: enemies.length, flankers: enemies.filter(en => en.flank).length, playerBullets: bullets.length, enemyBullets: enemyBullets.length, hazards: hazards.length, grounded: player.grounded, playerY: player.y, power: player.power, firing: keys.has('Space') || keys.has('KeyZ') || pointer.active || padInput.fire, walkFrames: walkFrames.length }) });
  // Boss-fight test hooks, alongside the Shift+N/M/B keys and ?boss=N above:
  // they let a headless run drive a boss to any state without playing the fight.
  // Local only — these can set a boss's HP directly, which has no place on the
  // published page. Served from a host or from file://, they never exist.
  const LOCAL_DEV = ['localhost', '127.0.0.1', '::1', ''].includes(location.hostname);
  if (LOCAL_DEV) {
    window.__hz = () => hazards.length;
    window.__grant = n => { score += n; };
    window.__grantBomb = () => { bombStock = Math.min(3, bombStock + 1); updateBombButton(); };
    window.__grantCharm = () => { charmStock = Math.min(3, charmStock + 1); };
    window.__setPower = n => { player.power = clamp(n, 1, 3); };
    window.__hurt = (n = 20) => hurt(n);
    window.__maxHp = () => maxHealth;
    window.__openShop = () => { openShop(); };
    window.__types = () => enemies.map(en => en.type);
    window.__boss = () => {
      const b = enemies.find(en => en.type === 'boss');
      return b ? { tier: b.tier, hp: b.hp, maxHp: b.maxHp, telType: b.telType, mode: b.mode, ghost: !!b.ghost, crit: !!b.crit, x: b.x, y: b.y } : null;
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
  // N is 1..5. If multiple modes are present, boss > mid > stage takes priority.
  // ?ending=1 skips straight to the full-clear ending -> staff roll -> RESULT
  // sequence, bypassing gameplay entirely.
  {
    const q = new URLSearchParams(location.search);
    const bossN = parseInt(q.get('boss'), 10);
    const midN = parseInt(q.get('mid'), 10);
    const directStageN = parseInt(q.get('stage'), 10);
    const mode = bossN ? 'boss' : midN ? 'mid' : directStageN ? 'stage' : null;
    const n = bossN || midN || directStageN;
    if (n >= 1 && n <= stages.length) {
      setTimeout(() => {
        resetGame();
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

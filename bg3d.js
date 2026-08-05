// bg3d.js — Three.js 製ステージ背景レイヤー
// ユーザー指示により Three.js を導入(AGENTS.md の「ライブラリ禁止」の唯一の例外。
// CDN 禁止は維持: assets/lib/three.module.min.js を同梱)。
//
// 役割: 空〜遠景〜中景を本物の3Dシーン(パース・フォグ・ライティング)で描き、
// オフスクリーン WebGL キャンバスに毎フレームレンダリングする。game.js の
// drawBackdrop() が window.GRO_BG3D.render() を呼び、返った true のとき
// このキャンバスを drawImage で合成し、旧2Dの遠景パスをスキップする。
// チャプターウォッシュ・住人・モート・ステージ演出・近景・雰囲気の各2Dレイヤーは
// この上に従来どおり重なる(ネオン×カワイイの手描き感はそこで維持する)。
//
// WebGL が使えない / モジュールが読めない(file:// 等)場合は GRO_BG3D が
// ready にならず、game.js が従来の2D描画へ自動フォールバックする。
//
// 座標系: 1unit≈1m。カメラは原点付近に固定し、世界が -x へ流れる(横スクロール)。
// 2D 側の HORIZON_Y=560/720 に合わせてカメラを少し見上げ、地平線を画面の
// 約78%の高さに置く。ゲームプレイ面は z=0(2Dキャンバス)、3Dは z<-15 のみ使う。

import * as THREE from './assets/lib/three.module.min.js';

(() => {
  const VW = 1280, VH = 720;
  const api = { ready: false, canvas: null, render: () => false, setQuality: () => {} };
  window.GRO_BG3D = api;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    return; // WebGL なし → 2D フォールバック
  }
  renderer.setClearColor(0x000000, 0);        // 空は2D側のグラデーションを透かす
  renderer.setSize(VW, VH, false);
  api.canvas = renderer.domElement;
  renderer.domElement.addEventListener('webglcontextlost', () => { api.ready = false; });

  // 60fps を割ったら bgQuality に合わせて内部解像度を落とす(0.5x〜1x)
  const Q_SCALE = [.5, .7, 1];
  let curQ = 2;
  api.setQuality = q => {
    q = Math.max(0, Math.min(2, q | 0));
    if (q === curQ) return;
    curQ = q;
    renderer.setSize(Math.round(VW * Q_SCALE[q]), Math.round(VH * Q_SCALE[q]), false);
  };

  const camera = new THREE.PerspectiveCamera(55, VW / VH, .5, 900);
  camera.position.set(0, 0, 0);
  camera.rotation.order = 'YXZ';
  const CAM_PITCH = .283;                      // 地平線 ≈ 画面78% (HORIZON_Y=560相当)
  camera.rotation.x = CAM_PITCH;

  // ---------------------------------------------------------------- helpers
  const rand = (lo, hi) => lo + Math.random() * (hi - lo);
  const pick = a => a[(Math.random() * a.length) | 0];

  function makeTex(w, h, draw, { repX = 1, repY = 1 } = {}) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repX, repY);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 2;
    return t;
  }

  // 放射グラデーションのソフトスプライト(光球・雲・煙・霧に使い回す)
  function softTex(color = '#ffffff', size = 128, innerStop = 0) {
    return makeTex(size, size, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, color);
      if (innerStop > 0) gr.addColorStop(innerStop, color);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
  }

  function sprite(tex, color, scale, opacity = 1, blend = THREE.AdditiveBlending) {
    const m = new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity, blending: blend, depthWrite: false, fog: false });
    const s = new THREE.Sprite(m);
    s.scale.set(scale, scale, 1);
    return s;
  }

  // ビルの窓テクスチャ: ランダムに灯った窓のグリッド
  function windowTex(base, litColors, cols, rows, litProb) {
    return makeTex(cols * 6, rows * 8, (g, w, h) => {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        if (Math.random() > litProb) continue;
        g.fillStyle = pick(litColors);
        g.globalAlpha = rand(.5, 1);
        g.fillRect(x * 6 + 1, y * 8 + 2, 4, 4);
      }
      g.globalAlpha = 1;
    });
  }

  // 無限スクロール帯: 同じレイアウトを2枚並べ、親を span でラップする。
  // 親を -span から始めることで初期カバレッジが [-span, +span] になり、
  // ステージ開始時から画面全体に街が敷き詰められている(0 始まりだと左半分が
  // 空で「街に入っていく」ように見えてしまう)。ラップ域 (-1.5span, -0.5span]
  // でも両側が埋まるよう、各帯の span は可視幅の2倍以上にしてある。
  function makeScroller(buildFn, span, k = 1) {
    const parent = new THREE.Group();
    const a = buildFn();
    const b = a.clone();
    b.position.x = span;
    parent.add(a, b);
    parent.position.x = -span;
    return {
      group: parent,
      k, span,
      update(dx) {
        parent.position.x -= dx * this.k;
        if (parent.position.x <= -span * 1.5) parent.position.x += span;
      }
    };
  }

  // 個別の流れ物(車・魚・データ粒)。範囲を出たら右へ戻す
  function makeMovers(list) {
    return {
      list,
      update(dx, dt) {
        for (const m of list) {
          m.obj.position.x -= dx * (m.k ?? 1) + (m.v || 0) * dt;
          if (m.obj.position.x < m.min) m.obj.position.x += m.span;
          else if (m.obj.position.x > m.min + m.span) m.obj.position.x -= m.span;
        }
      }
    };
  }

  function starField(n, spread, yMin, z, size, colors) {
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      pos[i * 3] = rand(-spread, spread);
      pos[i * 3 + 1] = rand(yMin, yMin + spread * .9);
      pos[i * 3 + 2] = z - rand(0, 120);
      c.set(pick(colors)).multiplyScalar(rand(.4, 1));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({ size, vertexColors: true, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, sizeAttenuation: false });
    return new THREE.Points(geo, mat);
  }

  const lambert = o => new THREE.MeshLambertMaterial(o);
  const basic = o => new THREE.MeshBasicMaterial(o);

  // ------------------------------------------------------------ actor overlay
  // 弾・敵エフェクト用の第2レイヤー。直交カメラでゲームのワールド座標
  // (1280x720、y下向き)にピクセル一致させ、透過キャンバスに毎フレーム描画。
  // game.js の drawGame() が敵スプライトの直前に drawImage で合成する
  // (アンダーグローは敵の下に、弾トレイルは敵に隠される正しい前後関係になる)。
  // 全てイミディエイトモードの InstancedMesh: 毎フレーム配列を舐めて行列を
  // 書き直すだけなので、弾や敵のライフサイクル管理を一切持たない。
  let actor = null;
  function initActors() {
    const renderer2 = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' });
    renderer2.setClearColor(0x000000, 0);
    renderer2.setSize(VW, VH, false);
    const scene = new THREE.Scene();
    const cam = new THREE.OrthographicCamera(0, VW, 0, VH, -500, 500);

    // テクスチャ: トレイル(尾へ減衰する光条)/ ハロー / ローター / 炎
    const streakTex = makeTex(128, 32, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0)');
      gr.addColorStop(.72, 'rgba(255,255,255,.55)');
      gr.addColorStop(1, 'rgba(255,255,255,.95)');
      g.fillStyle = gr;
      g.beginPath(); g.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, 6.3); g.fill();
    });
    const haloTex = softTex('#ffffff');
    // オーバーレイは純粋な加算光レイヤーなので、テクスチャは全て
    // 「透明地に明るい形」で描く(暗い色は 'lighter' 合成では消えるだけ)。
    const rotorTex = makeTex(64, 64, g => {
      g.translate(32, 32);
      g.strokeStyle = 'rgba(150,180,230,.45)'; g.lineWidth = 3;
      g.beginPath(); g.arc(0, 0, 28, 0, 6.3); g.stroke();      // ブレの円
      g.fillStyle = 'rgba(190,210,255,.55)';
      for (let b = 0; b < 3; b++) {
        g.rotate(Math.PI * 2 / 3);
        g.beginPath(); g.ellipse(15, 0, 14, 3.6, 0, 0, 6.3); g.fill();
      }
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(0, 0, 3.4, 0, 6.3); g.fill();
    });
    // 衝撃波: 中心が空いた柔らかい光の輪。板をスケールするだけで爆風になる
    // (トーラスだと太さまで比例して伸び、巨大な「フラフープ」に見えてしまう)
    const shockTex = makeTex(128, 128, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, 'rgba(255,255,255,0)');
      gr.addColorStop(.62, 'rgba(255,255,255,0)');
      gr.addColorStop(.82, 'rgba(255,255,255,.85)');
      gr.addColorStop(.93, 'rgba(255,255,255,.35)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    const flameTex = makeTex(64, 32, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w, 0);
      gr.addColorStop(0, 'rgba(255,255,255,.95)');
      gr.addColorStop(.35, 'rgba(255,255,255,.6)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.beginPath(); g.ellipse(w * .3, h / 2, w * .3, h * .34, 0, 0, 6.3); g.fill();
      g.beginPath(); g.ellipse(w * .55, h / 2, w * .42, h * .2, 0, 0, 6.3); g.fill();
    });

    // layer: 'under' = 敵スプライトの下に合成 / 'over' = 自機の上に合成。
    // 同じレンダラで2回描いて2回 drawImage する(合成順を art の前後関係に合わせる)。
    // side: DoubleSide は必須。このカメラは top=0 / bottom=VH の上下反転
    // 直交投影(画面座標にピクセル一致させるため)なので投影の行列式が負になり、
    // 全ての面の巻き方向が裏返る。FrontSide のままだと板ポリゴンは
    // 裏面カリングで丸ごと消え、閉じた立体だけが(内側の面で)生き残る。
    function inst(geo, matOpts, max, order, layer) {
      const m = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({
        transparent: true, depthWrite: false, depthTest: false, fog: false,
        side: THREE.DoubleSide, ...matOpts
      }), max);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.count = 0;
      m.frustumCulled = false;
      m.renderOrder = order;
      m.userData.layer = layer || 'under';
      scene.add(m);
      return m;
    }
    // 全プールが AdditiveBlending。合成側も 'lighter' なので、この層は
    // 「光を足すだけ」= 2Dアートを一切覆い隠さない、というのが設計上の契約。
    const add = { blending: THREE.AdditiveBlending };
    const plane = new THREE.PlaneGeometry(1, 1);
    const pools = {
      // --- under: 機体パーツと光(カワイイ2Dスプライトの下に潜り込む) ---
      glow: inst(plane, { map: haloTex, ...add }, 80, 1),      // 敵アンダーグロー
      aura: inst(plane, { map: shockTex, ...add }, 40, 1),     // ボスのエネルギー環
      wing: inst(plane, { map: haloTex, ...add }, 120, 2),     // 主翼(発光パネルとして)
      pod: inst(plane, { map: haloTex, ...add }, 120, 2),      // エンジンポッド
      canopy: inst(plane, { map: haloTex, ...add }, 60, 3),    // キャノピーのハイライト
      ring: inst(new THREE.TorusGeometry(1, .07, 6, 26), { ...add }, 60, 3),
      flame: inst(plane, { map: flameTex, ...add }, 120, 4),   // スラスター
      rotor: inst(plane, { map: rotorTex, ...add }, 60, 4),
      trail: inst(plane, { map: streakTex, ...add }, 240, 5),  // 自機弾トレイル
      halo: inst(plane, { map: haloTex, ...add }, 240, 6),
      ebShard: inst(new THREE.OctahedronGeometry(1, 0), { ...add }, 420, 7),
      ebHalo: inst(plane, { map: haloTex, ...add }, 420, 8),
      // --- over: 戦闘エフェクト(敵・自機の手前で弾ける) ---
      fxBall: inst(plane, { map: haloTex, ...add }, 140, 10, 'over'),
      fxRing: inst(plane, { map: shockTex, ...add }, 90, 11, 'over'),
      fxShard: inst(new THREE.TetrahedronGeometry(1, 0), { ...add }, 220, 12, 'over'),
      fxSpark: inst(plane, { map: streakTex, ...add }, 320, 13, 'over')
    };
    const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(),
      _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();
    // dim は 0..1 の減衰。加算合成のプールでは「色を黒へ寄せる = 消える」なので、
    // マテリアル共有の InstancedMesh でも1インスタンスずつフェードできる
    // (opacity はマテリアル単位なのでインスタンス別には効かない)。
    function put(pool, i, x, y, sx, sy, sz, rx, ry, rz, color, dim) {
      _p.set(x, y, 0);
      _e.set(rx, ry, rz);
      _q.setFromEuler(_e);
      _s.set(sx, sy, sz);
      _m.compose(_p, _q, _s);
      pool.setMatrixAt(i, _m);
      if (color !== undefined) {
        _c.set(color);
        if (dim !== undefined) _c.multiplyScalar(Math.max(0, Math.min(1, dim)));
        pool.setColorAt(i, _c);
      }
    }
    function flush(pool, n) {
      pool.count = Math.min(n, pool.instanceMatrix.count);
      pool.instanceMatrix.needsUpdate = true;
      if (pool.instanceColor) pool.instanceColor.needsUpdate = true;
    }

    // 敵タイプ → 3D装飾の割り当て(カワイイ2Dスプライトはそのまま、下に実3Dの
    // メカ部品と光を足す)。ここに無いタイプはアンダーグローのみ。
    const ROTOR = new Set(['drone', 'seeker', 'spinner', 'cloudray']);
    const THRUST = new Set(['racer', 'drone', 'seeker', 'walker', 'rivetbeetle', 'turret', 'bat',
      'tank', 'cupid', 'packetwyrm', 'pod', 'crow']);
    const RING = new Set(['glitch', 'voltbug', 'packetwyrm', 'teacup', 'spinner']);
    // 翼: 機体幅より外へ張り出すので、スプライトの外側だけが実3Dの板として見える
    const WING = new Set(['racer', 'manta', 'crow', 'bat', 'cloudray', 'drone', 'cupid', 'seeker']);
    // エンジンポッド/砲塔基部: 重量級の下面に円筒を回す
    const POD = new Set(['tank', 'walker', 'turret', 'rivetbeetle', 'knight', 'cardguard', 'furnacehound']);
    // ガラスキャノピー: additive の薄いドームでハイライトだけ乗せる
    const CANOPY = new Set(['drone', 'tank', 'racer', 'walker', 'seeker', 'spinner']);
    const GLOW_COL = [0xff3e9d, 0x2f8cff, 0xff5a36, 0x31e8ff, 0xff3e9d]; // ステージ別
    const FLAME_COL = [0x31e8ff, 0x65fff2, 0xffe15a, 0x72ff68, 0xffd06a];
    // 加算レイヤーなので機体パーツは「照らされたパネルの明るさ」を指定する
    const HULL_COL = [0x6878c8, 0x4a86b8, 0xb06a58, 0x4a9a80, 0xb06890];

    return {
      renderer2, scene, cam, pools, put, flush,
      ROTOR, THRUST, RING, WING, POD, CANOPY, GLOW_COL, FLAME_COL, HULL_COL,
      fx: [], t: 0
    };
  }

  // 戦闘エフェクトの発火口。game.js から発砲/着弾/撃破/ボム時に呼ぶ。
  // 各エフェクトは自前の寿命と粒子配列を持ち、renderActors('under') で更新される。
  api.fx = function (kind, x, y, opts) {
    if (!actor || actor.fx.length >= 64) return;
    const o = opts || {};
    const col = o.color !== undefined ? o.color : 0xffe15a;
    const size = o.size || 1;
    const e = { kind, x, y, t: 0, color: col, size, dir: o.dir === undefined ? 0 : o.dir };
    if (kind === 'muzzle') {
      e.life = .1;
      e.sparks = spawnBits(4, 260, 520, e.dir, .5);
    } else if (kind === 'impact') {
      e.life = .28;
      e.sparks = spawnBits(7, 180, 460, e.dir + Math.PI, 1.5);
    } else if (kind === 'explode') {
      e.life = .62 + size * .1;
      e.sparks = spawnBits(10, 220, 620, 0, 6.3);
      e.shards = spawnBits(9, 160, 460, 0, 6.3);
    } else if (kind === 'nova') {
      e.life = .95;
      e.sparks = spawnBits(16, 340, 900, 0, 6.3);
    } else return;
    actor.fx.push(e);
  };
  // 扇状に飛ぶ破片/火花の初速をまとめて作る(baseAng ± spread/2)
  function spawnBits(n, vLo, vHi, baseAng, spread) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = baseAng + (Math.random() - .5) * spread;
      const v = vLo + Math.random() * (vHi - vLo);
      out.push({ vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: Math.random() * 6.3, rv: (Math.random() - .5) * 16, s: .6 + Math.random() * .8 });
    }
    return out;
  }

  api.renderActors = function (s, layer) {
    if (!api.ready) return false;
    try {
      if (!actor) {
        actor = initActors();
        api.actorCanvas = actor.renderer2.domElement;
      }
      const A = actor, P = A.pools;
      // 'over' パスは 'under' で組んだインスタンスを可視レイヤだけ差し替えて
      // もう一度描くだけ。ここで時間を進めると2倍速になるので進めない。
      if (layer !== 'over') {
        // ゲーム側の dt を使う(ヒットストップで凍り、スローで伸びる)。
        // 無い場合だけ実時間にフォールバック。
        let dt = s.dt;
        if (dt === undefined) {
          const now = performance.now() / 1000;
          dt = now - lastActorT;
          lastActorT = now;
        }
        dt = Math.min(.1, Math.max(0, dt));
        A.t += dt;
        buildActorFrame(A, s, dt);
      }
      for (const k in P) P[k].visible = P[k].userData.layer === (layer === 'over' ? 'over' : 'under');
      A.renderer2.render(A.scene, A.cam);
      return true;
    } catch (e) {
      console.warn('bg3d actor render failed', e);
      api.renderActors = () => false;
      return false;
    }
  };

  let lastActorT = performance.now() / 1000;

  function buildActorFrame(A, s, dt) {
    const P = A.pools, t = A.t;
    const st = Math.max(0, Math.min(4, s.stage | 0));
    let nGlow = 0, nAura = 0, nWing = 0, nPod = 0, nCanopy = 0, nRing = 0,
      nFlame = 0, nRotor = 0, nTrail = 0, nHalo = 0, nEB = 0,
      nBall = 0, nFxRing = 0, nFxShard = 0, nSpark = 0;
    const hull = A.HULL_COL[st];

    // --- 敵の3D装飾 ----------------------------------------------------
    // 敵は左上アンカー(当たり判定が e.x..e.x+w)なので中心を計算して使う。
    for (const e of (s.enemies || [])) {
      if (e.x < -200 || e.x > VW + 200 || e.ghost) continue;
      const w = e.w || 60, h = e.h || 60;
      const cx = e.x + w / 2, cy = e.y + h / 2;
      const dir = e.flank ? -1 : 1;              // フランカーは右向きに飛ぶ
      const boss = e.type === 'boss' || e.type === 'midboss';
      const hit = e.hit > 0 ? 1 : 0;             // 被弾フレームは光を強める
      // 全員: 機体下面のアンダーグロー(スプライトの下に light pool)
      A.put(P.glow, nGlow++, cx, cy + h * .38, w * (1.6 + hit * .5), h * (.7 + hit * .3), 1,
        0, 0, 0, hit ? 0xffffff : A.GLOW_COL[st]);
      if (boss) {
        // ボス: 巨体を包むエネルギーの二重環 + 軌道を回る光球
        const R = Math.max(w, h) * 1.35;
        A.put(P.aura, nAura++, cx, cy, R, R * .62, 1, 0, 0, t * .5, A.GLOW_COL[st], .75);
        A.put(P.aura, nAura++, cx, cy, R * .74, R * .5, 1, 0, 0, -t * .7, 0xffffff, .5);
        for (let o = 0; o < 5; o++) {
          const a = t * 1.1 + o * 1.2566;
          A.put(P.halo, nHalo++, cx + Math.cos(a) * R * .48, cy + Math.sin(a) * R * .22,
            30, 30, 1, 0, 0, 0, A.GLOW_COL[st]);
        }
      } else {
        if (A.WING.has(e.type)) {
          // 上下2枚の発光パネル。上反角がゆっくり呼吸して板っぽさを消す
          const dih = .16 + .1 * Math.sin(t * 2.4 + e.x * .05);
          for (const sgn of [-1, 1]) {
            A.put(P.wing, nWing++, cx - dir * w * .06, cy + sgn * h * .16,
              w * 1.7, h * .34, 1, 0, 0, sgn * dih * dir, hull, .85);
          }
          // 翼端灯
          A.put(P.halo, nHalo++, cx - dir * w * .82, cy, 18, 18, 1, 0, 0, 0, A.FLAME_COL[st]);
        }
        if (A.POD.has(e.type)) {
          for (const sgn of [-1, 1]) {
            A.put(P.pod, nPod++, cx - dir * w * .1, cy + sgn * h * .36,
              w * 1.05, h * .3, 1, 0, 0, 0, hull, .8);
          }
        }
        if (A.CANOPY.has(e.type)) {
          A.put(P.canopy, nCanopy++, cx + dir * w * .16, cy - h * .16,
            w * .62, h * .5, 1, 0, 0, 0, 0x9fd8ff, .5);
        }
        if (A.THRUST.has(e.type)) {
          const fl = .8 + .35 * Math.sin(t * 21 + e.x * .13);
          A.put(P.flame, nFlame++, cx + dir * w * .62, cy, w * .9 * fl, w * .3, 1,
            0, 0, dir < 0 ? Math.PI : 0, A.FLAME_COL[st]);
          A.put(P.halo, nHalo++, cx + dir * w * .5, cy, w * .5, w * .5, 1, 0, 0, 0, A.FLAME_COL[st]);
        }
        if (A.ROTOR.has(e.type)) {
          A.put(P.rotor, nRotor++, cx, cy - h * .48, w * .58, w * .58, 1, 0, 0, t * 21 + e.x, 0xffffff, .8);
        }
        if (A.RING.has(e.type)) {
          const r = Math.max(w, h) * .72;
          A.put(P.ring, nRing++, cx, cy, r, r, r, 1.25, 0, t * 1.7 + e.x * .01, 0x31e8ff);
        }
      }
    }

    // --- 自機: スラスター炎とアンダーグロー(スプライトの下) --------------
    const pl = s.player;
    if (pl && !pl.grounded) {
      const pcx = pl.x + pl.w / 2, pcy = pl.y + pl.h * .58;
      const fl = .85 + .3 * Math.sin(t * 26);
      A.put(P.flame, nFlame++, pcx - pl.w * .42, pcy, pl.w * .8 * fl, pl.h * .22, 1, 0, 0, Math.PI, 0x8defff);
      A.put(P.halo, nHalo++, pcx - pl.w * .3, pcy, pl.w * .5, pl.w * .5, 1, 0, 0, 0, 0x31e8ff);
      A.put(P.glow, nGlow++, pcx, pcy + pl.h * .22, pl.w * 1.5, pl.h * .5, 1, 0, 0, 0, 0xff9ecf);
    }

    // --- 自機弾: 速度方向に伸びる光のトレイル + ハロー -------------------
    for (const b of (s.bullets || [])) {
      if (nTrail >= 240) break;
      const sp = Math.hypot(b.vx, b.vy) || 1;
      const ang = Math.atan2(b.vy, b.vx);
      const len = Math.max(26, Math.min(120, sp * .09)) + b.r * 2;
      const wid = b.missile ? 13 : Math.max(6, b.r * 1.7);
      const col = b.pierce ? 0x9ffff6 : b.missile ? 0xffab5a : b.spark ? 0xffe15a
        : b.pea ? 0xd8ffd4 : _hue(b.hue);
      A.put(P.trail, nTrail++, b.x - Math.cos(ang) * len * .42, b.y - Math.sin(ang) * len * .42,
        len, wid, 1, 0, 0, ang, col, .85);
      // ハローは弾芯(2D)を包む程度に留める — 大きすぎると弾幕が読めなくなる
      A.put(P.halo, nHalo++, b.x, b.y, b.r * 3, b.r * 3, 1, 0, 0, 0, col, .8);
      // ミサイルは煙の代わりに減衰する残光を後方へ置く
      if (b.missile && nTrail < 238) {
        A.put(P.trail, nTrail++, b.x - Math.cos(ang) * len, b.y - Math.sin(ang) * len,
          len * .8, wid * .55, 1, 0, 0, ang, 0xff6a3a);
      }
    }

    // --- 敵弾: 属性色ハロー + 回転する結晶シャード -----------------------
    let i = 0;
    for (const b of (s.enemyBullets || [])) {
      if (nEB >= 420) break;
      const col = b.volt ? 0x8dff7a : b.fire ? 0xffab5a : b.heart ? 0xff9ecf
        : b.bubble ? 0x7ae8ff : b.boss ? 0xff5aa8 : 0xff4a92;
      A.put(P.ebHalo, nEB, b.x, b.y, b.r * 4.6, b.r * 4.6, 1, 0, 0, 0, col);
      A.put(P.ebShard, nEB++, b.x, b.y, b.r * .95, b.r * .95, b.r * .95,
        t * 2.3 + i * .7, t * 3.1 + i * 1.3, 0, col);
      i++;
    }

    // --- 戦闘エフェクト(over レイヤ) -----------------------------------
    for (let f = A.fx.length - 1; f >= 0; f--) {
      const e = A.fx[f];
      e.t += dt;
      const p = e.t / e.life;                    // 0..1 進行
      if (p >= 1) { A.fx.splice(f, 1); continue; }
      const fade = 1 - p;
      const ease = fade * fade;                  // リング/火球はここで一気に消す
      if (e.kind === 'muzzle') {
        const g = 1 - p * p;
        A.put(P.fxBall, nBall++, e.x, e.y, 92 * g, 62 * g, 1, 0, 0, e.dir, 0xffffff, ease);
        A.put(P.fxBall, nBall++, e.x + Math.cos(e.dir) * 26, e.y + Math.sin(e.dir) * 26,
          150 * g, 40 * g, 1, 0, 0, e.dir, e.color, ease);
      } else if (e.kind === 'impact') {
        // fxRing は shockTex を貼った板なので、スケール = 衝撃波の直径。
        const d = 26 + p * 120;
        A.put(P.fxRing, nFxRing++, e.x, e.y, d, d * .82, 1, 0, 0, e.t * 5, e.color, ease);
        A.put(P.fxBall, nBall++, e.x, e.y, 74 * fade, 74 * fade, 1, 0, 0, 0, 0xffffff, ease);
      } else if (e.kind === 'explode') {
        const sz = e.size;
        // 火球: 一気に膨らんでから萎む
        const g = Math.sin(Math.min(1, p * 1.6) * Math.PI * .5);
        const fb = 210 * sz * g * (1 - p * .35);
        A.put(P.fxBall, nBall++, e.x, e.y, fb, fb, 1, 0, 0, e.t, p < .3 ? 0xffffff : e.color, ease);
        // 二重の衝撃波(外に走る爆風と、内側で潰れる白いコア)
        const d1 = 40 + p * 420 * sz, d2 = 24 + p * 260 * sz;
        A.put(P.fxRing, nFxRing++, e.x, e.y, d1, d1 * .78, 1, 0, 0, e.t * 1.4, e.color, ease);
        A.put(P.fxRing, nFxRing++, e.x, e.y, d2, d2 * .92, 1, 0, 0, -e.t * 2, 0xffffff, ease * ease);
      } else if (e.kind === 'nova') {
        for (let k = 0; k < 3; k++) {
          const pp = Math.max(0, p - k * .12);
          const d = 60 + pp * 1250 * e.size;
          A.put(P.fxRing, nFxRing++, e.x, e.y, d, d * .8, 1, 0, 0, e.t * (.6 + k * .4),
            k === 1 ? 0xffffff : e.color, ease * (1 - k * .25));
        }
        A.put(P.fxBall, nBall++, e.x, e.y, 420 * e.size * fade, 420 * e.size * fade, 1, 0, 0, 0, e.color, ease);
      }
      // 火花: 重力を受けて尾を引きながら飛ぶ
      if (e.sparks) for (const sp of e.sparks) {
        if (nSpark >= 320) break;
        const px = e.x + sp.vx * e.t, py = e.y + sp.vy * e.t + 340 * e.t * e.t;
        const vy = sp.vy + 680 * e.t;
        const ang = Math.atan2(vy, sp.vx);
        const len = (18 + Math.hypot(sp.vx, vy) * .045) * sp.s;
        A.put(P.fxSpark, nSpark++, px, py, len, 5 * sp.s * fade, 1, 0, 0, ang,
          p < .45 ? 0xffffff : e.color, ease);
      }
      // 破片: 灼熱の装甲片が回転しながら散り、飛びながら冷めていく
      if (e.shards) for (const sh of e.shards) {
        if (nFxShard >= 220) break;
        const px = e.x + sh.vx * e.t, py = e.y + sh.vy * e.t + 420 * e.t * e.t;
        const sc = 11 * sh.s * (1 - p * .5) * e.size;
        A.put(P.fxShard, nFxShard++, px, py, sc, sc, sc,
          sh.r + sh.rv * e.t, sh.r * 1.7 + sh.rv * e.t * .7, 0,
          p < .3 ? 0xffffff : hull, ease);
      }
    }

    A.flush(P.glow, nGlow); A.flush(P.aura, nAura); A.flush(P.wing, nWing);
    A.flush(P.pod, nPod); A.flush(P.canopy, nCanopy); A.flush(P.ring, nRing);
    A.flush(P.flame, nFlame); A.flush(P.rotor, nRotor);
    A.flush(P.trail, nTrail); A.flush(P.halo, nHalo);
    A.flush(P.ebShard, nEB); A.flush(P.ebHalo, nEB);
    A.flush(P.fxBall, nBall); A.flush(P.fxRing, nFxRing);
    A.flush(P.fxShard, nFxShard); A.flush(P.fxSpark, nSpark);
  }
  // デバッグ用: 各インスタンスプールの生存数と発火中のエフェクト数。
  // 描画が出ないときに「積んでいないのか / 描けていないのか」を切り分ける。
  // 検証用: ステージ2のクジラを今すぐ跳ねさせる(待ち時間を飛ばす)
  api.breach = function () {
    const e = entries[1];
    if (e && e.breach) e.breach();
  };

  api.stats = function (stage) {
    const out = {};
    if (actor) {
      out.fx = actor.fx.length;
      for (const k in actor.pools) out[k] = actor.pools[k].count;
    }
    const e = entries[stage === undefined ? -1 : stage];
    if (e && e.debug) Object.assign(out, e.debug());
    return out;
  };

  const _hueColor = new THREE.Color();
  function _hue(hue) {
    return _hueColor.setHSL(((hue || 0) % 360) / 360, .95, .72).getHex();
  }

  // ---------------------------------------------------------------- scenes
  // 各ビルダーは { scene, update(dt, state) } を返す。state は game.js から:
  // { stage, speed, camX, camY, energy, boss, warning, chapter, chapterT, quality }
  const builders = [buildNeon, buildAqua, buildFactory, buildStorm, buildPalace];
  const entries = [null, null, null, null, null];
  function getEntry(i) {
    if (!entries[i]) {
      try { entries[i] = builders[i](); }
      catch (e) { console.warn('bg3d scene build failed', i, e); entries[i] = { scene: null, update: () => {} }; }
    }
    return entries[i];
  }

  // 基本流速 (unit/s, gameSpeed=1)。2D側のパララックス体系に合わせること:
  // ゲームプレイ面の路面(2D drawGroundPlane)が 90px/s、旧2D店先が 20px/s なので、
  // 3Dの見かけ速度(= SCROLL × 691.6/|z|)はどの深度でも 90px/s を超えてはいけない。
  // 4 u/s → z=-52 で 53px/s・z=-95 の商店街で 29px/s・z=-300 で 9px/s と正しい遠近順になる。
  // (26 だった頃は商店街が 189px/s で手前の道より速く流れ、奥行きが逆転して見えた)
  const SCROLL = 4;

  // ============================================================ STAGE 1
  // TOKYO MIDNIGHT — 夜の渋谷。ビル群の峡谷、東京タワー、首都高の車列。
  function buildNeon() {
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x31166e, 45, 430);
    scene.add(new THREE.HemisphereLight(0x8a4fd0, 0x140a3a, 1.1));
    const moonLight = new THREE.DirectionalLight(0xbfa8ff, .9);
    moonLight.position.set(120, 180, -160);
    scene.add(moonLight);

    // 月 + 星(2D版は x970,y145 に月 → 画面右上に対応する遠方へ)
    const moon = sprite(softTex('#fff3aa', 128, .38), 0xfff3aa, 66, .95);
    moon.position.set(170, 235, -430);
    scene.add(moon);
    const moonGlow = sprite(softTex('#ffe15a'), 0xffe15a, 190, .3);
    moonGlow.position.copy(moon.position);
    scene.add(moonGlow);
    scene.add(starField(360, 420, 30, -420, 2.2, ['#ffe15a', '#8defff', '#ffffff']));

    // 地面: 暗い街路にネオンの照り返しが走る
    const streetTex = makeTex(256, 256, (g, w, h) => {
      g.fillStyle = '#0d0830'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 90; i++) {
        g.fillStyle = pick(['#31e8ff', '#ff3e9d', '#ffe15a', '#241a67']);
        g.globalAlpha = rand(.05, .3);
        g.fillRect(rand(0, w), rand(0, h), rand(2, 22), rand(1, 3));
      }
      g.globalAlpha = 1;
    }, { repX: 30, repY: 12 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 480), lambert({ map: streetTex, color: 0x9a86ff }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -17, -250);
    scene.add(ground);

    // ビル帯を3深度に。窓テクスチャは深度ごとに解像感を変える
    const winFar = windowTex('#150d3f', ['#ffd97a', '#8defff'], 10, 22, .34);
    const winMid = windowTex('#181045', ['#ffd97a', '#8defff', '#ff9ecf'], 14, 30, .4);
    const winNear = windowTex('#1a1150', ['#ffe15a', '#31e8ff', '#ff3e9d', '#fff'], 18, 40, .42);
    const winShop = windowTex('#221345', ['#ffd97a', '#ff9ecf', '#8defff'], 10, 14, .5);
    const beaconTex = softTex('#ff5a5a');
    const signColors = [0xff3e9d, 0x31e8ff, 0xffe15a, 0x8a6cff, 0x65fff2];

    function cityBelt(z, span, count, hLo, hHi, wLo, wHi, tex, tint, deco) {
      return () => {
        const grp = new THREE.Group();
        // 窓は emissiveMap で自己発光させ、照明に頼らず夜景として光らせる
        const mat = lambert({ map: tex, color: tint, emissive: 0xffffff, emissiveIntensity: .85, emissiveMap: tex });
        const matSide = lambert({ color: new THREE.Color(tint).multiplyScalar(.55) });
        const roofMat = lambert({ color: 0x241a57 });
        for (let i = 0; i < count; i++) {
          const h = rand(hLo, hHi), w = rand(wLo, wHi), d = w * rand(.8, 1.4);
          const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [matSide, matSide, matSide, matSide, mat, mat]);
          const bx = (i / count) * span + rand(-4, 4), top = -17 + h;
          b.position.set(bx, -17 + h / 2, z + rand(-14, 14));
          grp.add(b);
          if (Math.random() < .3) {             // 屋上の航空障害灯
            const bc = sprite(beaconTex, 0xff5a5a, 2.4, .9);
            bc.position.set(bx, top + 1.2, b.position.z);
            bc.userData.blink = rand(0, 6.28);
            grp.add(bc);
          }
          if (!deco) continue;
          // 屋上のディテール: 給水塔 / アンテナ / 屋上看板
          const r = Math.random();
          if (r < .3) {                          // 給水塔
            const tank = new THREE.Mesh(new THREE.CylinderGeometry(w * .16, w * .16, w * .3, 8), roofMat);
            tank.position.set(bx + w * .22, top + w * .16, b.position.z);
            grp.add(tank);
            const legs = new THREE.Mesh(new THREE.CylinderGeometry(w * .14, w * .18, w * .12, 4, 1, true), roofMat);
            legs.position.set(tank.position.x, top + w * .05, b.position.z);
            grp.add(legs);
          } else if (r < .6) {                   // アンテナマスト
            const mast = new THREE.Mesh(new THREE.CylinderGeometry(.14, .26, rand(5, 9), 4), roofMat);
            mast.position.set(bx - w * .2, top + mast.geometry.parameters.height / 2, b.position.z);
            grp.add(mast);
          } else if (r < .85) {                  // 屋上ネオン看板
            const col = pick(signColors);
            const bb = new THREE.Mesh(new THREE.PlaneGeometry(w * .8, rand(2.6, 4.2)),
              basic({ color: col, transparent: true, opacity: .8, fog: false }));
            bb.position.set(bx, top + 2.6, b.position.z + 1);
            bb.userData.flick = Math.random() < .4 ? rand(1.5, 5) : 0;
            grp.add(bb);
            const frame = new THREE.Mesh(new THREE.BoxGeometry(w * .84, .3, .3), roofMat);
            frame.position.set(bx, top + .8, b.position.z + 1);
            grp.add(frame);
          }
        }
        return grp;
      };
    }
    // 近づくほど本数を減らして空へ抜ける隙間を作る(壁一面の窓にしない)
    const beltFar = makeScroller(cityBelt(-300, 760, 34, 70, 150, 14, 26, winFar, 0x6a5abf), 760);
    const beltMid = makeScroller(cityBelt(-170, 560, 19, 45, 100, 10, 20, winMid, 0x8f7ce0, true), 560);
    const beltNear = makeScroller(cityBelt(-125, 520, 9, 26, 62, 8, 15, winNear, 0xb9a8ff, true), 520);
    scene.add(beltFar.group, beltMid.group, beltNear.group);

    // ネオン看板: 近景ビル帯の手前に発光パネル(縦看板と横看板)
    const signBelt = makeScroller(() => {
      const grp = new THREE.Group();
      for (let i = 0; i < 12; i++) {
        const vertical = Math.random() < .5;
        const w = vertical ? rand(2, 3.4) : rand(6, 12);
        const h = vertical ? rand(9, 18) : rand(2.4, 4.4);
        const col = pick(signColors);
        const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
          basic({ color: col, transparent: true, opacity: .85, fog: false }));
        p.position.set(rand(0, 440), rand(-8, 16), rand(-72, -58));
        p.userData.flick = Math.random() < .35 ? rand(1.5, 5) : 0;
        grp.add(p);
        const glow = sprite(softTex('#ffffff'), col, Math.max(w, h) * 2.1, .22);
        glow.position.copy(p.position);
        grp.add(glow);
      }
      return grp;
    }, 440);
    scene.add(signBelt.group);

    // --- 実3Dの商店街(旧2D店先の置き換え) ---------------------------
    // 店構え(光る店内・庇・袖看板)+ 提灯 + 自販機 + 電柱と電線 + 街灯。
    // z≈-75 なら1階の店先が画面下端の街路帯(スクランブル交差点の高さ)に乗る。
    const KATA = 'ラメンカオケバニクスシヤミルドパチゲソ酒屋堂茶焼鳥寿司薬局花星夢恋';
    const shopWord = n => Array.from({ length: n }, () => KATA[(Math.random() * KATA.length) | 0]).join('');
    function glyphTex(text, fg, bg, vertical) {
      const fs = 24, pad = 8;
      const w = vertical ? fs + pad * 2 : text.length * fs + pad * 2;
      const h = vertical ? text.length * fs + pad * 2 : fs + pad * 2;
      return makeTex(w, h, g => {
        g.fillStyle = bg; g.fillRect(0, 0, w, h);
        g.font = `bold ${fs - 3}px "Hiragino Sans", sans-serif`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.shadowColor = fg; g.shadowBlur = 8; g.fillStyle = fg;
        if (vertical) { for (let i = 0; i < text.length; i++) g.fillText(text[i], w / 2, pad + fs * (i + .5)); }
        else g.fillText(text, w / 2, h / 2);
      });
    }
    function shopFrontTex(warm) {
      return makeTex(128, 64, g => {
        g.fillStyle = '#241448'; g.fillRect(0, 0, 128, 64);
        const gr = g.createLinearGradient(0, 10, 0, 58);
        gr.addColorStop(0, warm ? '#ffd98a' : '#9fe8ff');
        gr.addColorStop(1, warm ? '#ff9a4a' : '#4a90d8');
        g.fillStyle = gr; g.fillRect(8, 12, 74, 46);              // 店内の光
        g.fillStyle = 'rgba(40,16,60,.8)';
        for (let i = 0; i < 3; i++) g.fillRect(10, 22 + i * 12, 70, 3);   // 棚
        for (let i = 0; i < 4; i++) g.fillRect(14 + i * 17, 26, 8, 24);   // 商品の影
        g.fillStyle = warm ? '#5a2a78' : '#2a3a78'; g.fillRect(90, 14, 30, 44); // ドア
        g.fillStyle = '#ffe9b8'; g.fillRect(94, 18, 22, 20);
      });
    }
    const shopFronts = [shopFrontTex(true), shopFrontTex(false), shopFrontTex(true)];
    const awningTexes = [
      makeTex(64, 32, g => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#e84a6a' : '#f8f0e0'; g.fillRect(i * 8, 0, 8, 32); } }),
      makeTex(64, 32, g => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#2f8cff' : '#f8f0e0'; g.fillRect(i * 8, 0, 8, 32); } }),
      makeTex(64, 32, g => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#31a86a' : '#ffe15a'; g.fillRect(i * 8, 0, 8, 32); } })
    ];
    const lanternTex = softTex('#ff7a5a', 64, .45);
    const signFgs = ['#ff3e9d', '#31e8ff', '#ffe15a', '#65fff2', '#ff9ecf'];
    const streetBelt = makeScroller(() => {
      const grp = new THREE.Group();
      const SPAN = 420;
      const wallMat = lambert({ map: winShop, color: 0x8f7cd8, emissive: 0xffffff, emissiveIntensity: .7, emissiveMap: winShop });
      const darkMat = lambert({ color: 0x2c2160 });
      for (let i = 0; i < 11; i++) {
        const w = rand(18, 26), h = rand(24, 32), d = 12;
        // z=-95: 1階の店先(y-17〜-9)が画面下端の街路帯(スクランブル交差点の高さ)に
        // ちょうど乗り、庇と看板まで見切れず入る
        const x = i * (SPAN / 11) + rand(-3, 3), z = -95;
        // 上階(窓) + 1階店先
        const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [darkMat, darkMat, darkMat, darkMat, wallMat, wallMat]);
        body.position.set(x, -17 + h / 2, z);
        grp.add(body);
        const front = new THREE.Mesh(new THREE.PlaneGeometry(w - 2, 10),
          basic({ map: pick(shopFronts), fog: false }));
        front.position.set(x, -11.6, z + d / 2 + .06);
        grp.add(front);
        // 庇(ストライプの半円筒)
        const awn = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, w - 3, 10, 1, true, 0, Math.PI),
          basic({ map: pick(awningTexes), side: THREE.DoubleSide, fog: false }));
        awn.rotation.z = Math.PI / 2;
        awn.rotation.y = Math.PI / 2;
        awn.position.set(x, -6.6, z + d / 2 + 1);
        grp.add(awn);
        // 袖看板(縦) or 軒上看板(横)
        const fg = pick(signFgs);
        const vertical = Math.random() < .55;
        const word = shopWord(vertical ? 3 + (Math.random() < .4 ? 1 : 0) : 3);
        const gt = glyphTex(word, fg, '#1a0f38', vertical);
        const sw = vertical ? 4.2 : 12, sh = vertical ? 4.2 * (gt.image.height / gt.image.width) : 4;
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), basic({ map: gt, transparent: true, fog: false }));
        sign.position.set(vertical ? x - w / 2 + .8 : x, vertical ? -17 + h * .55 : -6.4, z + d / 2 + (vertical ? 1.4 : .5));
        grp.add(sign);
        const glow = sprite(softTex('#ffffff'), new THREE.Color(fg).getHex(), Math.max(sw, sh) * 1.9, .2);
        glow.position.copy(sign.position);
        grp.add(glow);
        // 自販機(4割)/ 提灯列(3割)
        if (Math.random() < .4) {
          const vm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 3.4, 1.4), lambert({ color: pick([0xe84a4a, 0x2f8cff, 0xf8f0e0]) }));
          vm.position.set(x + w / 2 - 1.4, -15.3, z + d / 2 + 1.2);
          grp.add(vm);
          const vglow = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.4), basic({ color: 0xd8f4ff, fog: false }));
          vglow.position.set(vm.position.x, -15.1, vm.position.z + .72);
          grp.add(vglow);
        }
        if (Math.random() < .35) {
          for (let L = 0; L < 6; L++) {
            const lx = x - w / 2 + 2 + L * ((w - 4) / 5);
            const lan = sprite(lanternTex, 0xff8a5a, 2.1, .95);
            lan.position.set(lx, -7.2 - Math.sin((L / 5) * Math.PI) * 1.1, z + d / 2 + 1.6);
            grp.add(lan);
          }
        }
      }
      return grp;
    }, 420);
    // 2D側が画面下端に不透明な街路帯(交差点・地面)を描くので、店列は +7 持ち上げて
    // 店先・庇・看板が街路帯のすぐ上(買い物客の背後)に並ぶようにする。
    streetBelt.group.position.y = 7;
    scene.add(streetBelt.group);

    // 電柱 + 電線(カテナリー)+ 街灯
    const utilBelt = makeScroller(() => {
      const grp = new THREE.Group();
      const SPAN = 300, GAP = 60;
      const poleMat = lambert({ color: 0x241a4e });
      const wireMat = basic({ color: 0x9a86d8, transparent: true, opacity: .5, fog: false });
      for (let i = 0; i <= SPAN / GAP; i++) {
        const x = i * GAP;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(.32, .44, 24, 6), poleMat);
        pole.position.set(x, -5, -58); grp.add(pole);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(4.6, .3, .3), poleMat);
        arm.position.set(x, 5.4, -58); grp.add(arm);
        const trans = new THREE.Mesh(new THREE.CylinderGeometry(.7, .7, 1.8, 6), poleMat);
        trans.position.set(x + .9, 3.6, -58); grp.add(trans);
        // 街灯(電柱の腕から)
        const lamp = sprite(softTex('#ffd9a0'), 0xffd9a0, 4.2, .9);
        lamp.position.set(x + 1.8, 1.8, -57); grp.add(lamp);
        if (i === SPAN / GAP) break;
        // 隣の柱まで垂れる電線 ×2段
        for (const wy of [5.2, 4.2]) {
          const N = 6;
          for (let s2 = 0; s2 < N; s2++) {
            const ta = s2 / N, tb = (s2 + 1) / N;
            const sag = 1.7;
            const ya = wy - Math.sin(ta * Math.PI) * sag, yb = wy - Math.sin(tb * Math.PI) * sag;
            const xa = x + GAP * ta, xb = x + GAP * tb;
            const len = Math.hypot(xb - xa, yb - ya);
            const wseg = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, len, 3), wireMat);
            wseg.position.set((xa + xb) / 2, (ya + yb) / 2, -58);
            wseg.rotation.z = Math.atan2(yb - ya, xb - xa) - Math.PI / 2;
            grp.add(wseg);
          }
        }
      }
      return grp;
    }, 300);
    scene.add(utilBelt.group);

    // 夜行電車: 光る窓の列が高架を高速で駆け抜ける
    const trainWin = makeTex(256, 32, g => {
      g.fillStyle = '#1a2a3e'; g.fillRect(0, 0, 256, 32);
      g.fillStyle = '#b8e845'; g.fillRect(0, 0, 256, 5);       // ラインカラー
      for (let i = 0; i < 12; i++) { g.fillStyle = '#ffe9b8'; g.fillRect(6 + i * 21, 10, 14, 14); }
    });
    const train = new THREE.Group();
    const trainBody = new THREE.Mesh(new THREE.BoxGeometry(46, 3, 2.6),
      [basic({ color: 0x1a2a3e }), basic({ color: 0x1a2a3e }), basic({ color: 0x24344a }), basic({ color: 0x101c2c }),
       basic({ map: trainWin, fog: false }), basic({ map: trainWin, fog: false })]);
    train.add(trainBody);
    const headlight = sprite(softTex('#fff6d8'), 0xfff6d8, 4, .95);
    headlight.position.set(-23.5, -.4, 0);
    train.add(headlight);
    train.position.set(320, -3.4, -62);
    scene.add(train);

    // 渋谷ビジョン: ビル壁面の大型LEDスクリーン(虹色パターンが流れる)
    const visionTex = makeTex(128, 96, g => {
      const cols = ['#ff3e9d', '#ffe15a', '#31e8ff', '#31a86a', '#ff9a4a', '#8a6cff'];
      for (let i = 0; i < 6; i++) { g.fillStyle = cols[i]; g.fillRect(i * 22, 0, 22, 96); }
      g.fillStyle = 'rgba(255,255,255,.85)';
      for (let i = 0; i < 30; i++) g.fillRect(rand(0, 128), rand(0, 96), rand(3, 10), rand(2, 5));
    }, { repX: 1, repY: 1 });
    const vision = new THREE.Group();
    const vFrameMat = lambert({ color: 0x241a57 });
    const vScreen = new THREE.Mesh(new THREE.PlaneGeometry(24, 14), basic({ map: visionTex, fog: false }));
    vision.add(vScreen);
    const vFrame = new THREE.Mesh(new THREE.BoxGeometry(25.4, 15.4, 1.2), vFrameMat);
    vFrame.position.z = -.7; vision.add(vFrame);
    const vGlow = sprite(softTex('#ffffff'), 0xffb8e0, 34, .22);
    vGlow.position.z = 1; vision.add(vGlow);
    vision.position.set(60, 26, -118);
    vision.userData = { span: 1100, min: -320 };
    scene.add(vision);

    // 東京タワー: 円錐2段 + 展望台 + 骨組みリング。ゆっくり流れて時々通過する
    const tower = new THREE.Group();
    const towerMat = lambert({ color: 0xff7a45, emissive: 0x772211 });
    const whiteMat = lambert({ color: 0xffe9dd, emissive: 0x443322 });
    const t1 = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 16, 46, 4, 1, true), towerMat);
    t1.position.y = 23; tower.add(t1);
    const t2 = new THREE.Mesh(new THREE.CylinderGeometry(.6, 3.4, 34, 4, 1, true), towerMat);
    t2.position.y = 62; tower.add(t2);
    const deck1 = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 5.8, 3.4, 8), whiteMat);
    deck1.position.y = 45; tower.add(deck1);
    const deck2 = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 2.2, 8), whiteMat);
    deck2.position.y = 74; tower.add(deck2);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(.16, .3, 12, 4), whiteMat);
    antenna.position.y = 84; tower.add(antenna);
    const towerTip = sprite(beaconTex, 0xff4444, 3, 1);
    towerTip.position.y = 91; towerTip.userData.blink = 0; tower.add(towerTip);
    for (let i = 0; i < 7; i++) {               // ライトアップの光点リング
      const ring = new THREE.Group();
      const y = 6 + i * 6.2, r = 16 - i * 1.9;
      for (let j = 0; j < 10; j++) {
        const a = (j / 10) * Math.PI * 2;
        const lp = sprite(softTex('#ffb066'), 0xffb066, 2.2, .8);
        lp.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
        ring.add(lp);
      }
      tower.add(ring);
    }
    tower.position.set(240, -17, -240);
    tower.userData = { span: 1500, min: -560 };
    scene.add(tower);

    // 首都高: 高架リボン + 支柱 + 街灯。車のライトが両方向に流れる
    // (y/z は画面下端の街路帯に桁が見える高さに合わせてある)
    const hwY = -8, hwZ = -52;
    const hwBelt = makeScroller(() => {
      const grp = new THREE.Group();
      const deckMat = lambert({ color: 0x2c2160 });
      const deck = new THREE.Mesh(new THREE.BoxGeometry(360, 1.4, 9), deckMat);
      deck.position.set(180, hwY, hwZ); grp.add(deck);
      const railMat = basic({ color: 0x31e8ff, transparent: true, opacity: .5 });
      for (const dz of [-4.5, 4.5]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(360, .22, .14), railMat);
        rail.position.set(180, hwY + 1.6, hwZ + dz); grp.add(rail);
      }
      for (let i = 0; i < 15; i++) {
        const px = i * 24;
        const pylon = new THREE.Mesh(new THREE.BoxGeometry(2.4, 8, 5), deckMat);
        pylon.position.set(px, hwY - 4.7, hwZ); grp.add(pylon);
        const lamp = sprite(softTex('#ffd9a0'), 0xffd9a0, 3.4, .85);
        lamp.position.set(px, hwY + 4.6, hwZ); grp.add(lamp);
      }
      return grp;
    }, 360);
    scene.add(hwBelt.group);

    // 車: 白(こちら向き)と赤(去り)のヘッドライト連
    const carMovers = [];
    const carGroup = new THREE.Group();
    for (let i = 0; i < 22; i++) {
      const toward = i % 2 === 0;
      const c = sprite(softTex(toward ? '#fff6d8' : '#ff6a6a'), toward ? 0xfff6d8 : 0xff6a6a, 1.7, .95);
      c.position.set(rand(-180, 260), hwY + 1.1, hwZ + (toward ? 2.2 : -2.2));
      carGroup.add(c);
      carMovers.push({ obj: c, min: -200, span: 480, v: toward ? rand(7, 12) : rand(-11, -6), k: 1 });
    }
    scene.add(carGroup);
    const cars = makeMovers(carMovers);

    // サーチライトの光条(遠景から扇状に)
    const beams = [];
    for (let i = 0; i < 3; i++) {
      const beam = new THREE.Mesh(new THREE.PlaneGeometry(9, 240),
        basic({ color: 0x7a5aff, transparent: true, opacity: .16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      beam.position.set(-160 + i * 170, 105, -260);
      beam.userData.ph = rand(0, 6.28);
      scene.add(beam); beams.push(beam);
    }

    const flickables = [];
    const blinkers = [];
    scene.traverse(o => {
      if (!o.userData) return;
      if (o.userData.flick) flickables.push(o);
      if (o.userData.blink !== undefined) blinkers.push(o);
    });

    let t = 0;
    return {
      scene,
      update(dt, s) {
        t += dt;
        const dx = SCROLL * (s.speed || 1) * dt;
        beltFar.update(dx); beltMid.update(dx); beltNear.update(dx);
        signBelt.update(dx); hwBelt.update(dx);
        streetBelt.update(dx); utilBelt.update(dx);
        streetTex.offset.x += dx * (30 / 1400);   // ビル・高架と同じ世界速度で路面も流す
        cars.update(dx, dt);
        tower.position.x -= dx;
        if (tower.position.x < tower.userData.min) tower.position.x += tower.userData.span;
        // 夜行電車: スクロール+自走で時々駆け抜ける
        train.position.x -= dx + 22 * dt;
        if (train.position.x < -420) train.position.x = 420 + rand(60, 700);
        // 大型ビジョン: 映像が流れ続ける
        visionTex.offset.x += dt * .13;
        vision.position.x -= dx;
        if (vision.position.x < vision.userData.min) vision.position.x += vision.userData.span;
        for (const b of blinkers) b.material.opacity = .35 + .65 * Math.max(0, Math.sin(t * 2.4 + b.userData.blink));
        for (const f of flickables) f.material.opacity = Math.sin(t * f.userData.flick * 3) > -.85 ? .85 : .25;
        for (const beam of beams) {
          beam.rotation.z = Math.sin(t * .17 + beam.userData.ph) * .5;
          beam.material.opacity = .07 + .05 * Math.sin(t * .6 + beam.userData.ph);
        }
        moonGlow.material.opacity = .26 + .06 * Math.sin(t * .8);
      }
    };
  }

  // ============================================================ STAGE 2
  // AQUA HIGHWAY — 潮風の海上ハイウェイ。月夜の海面、吊り橋、島影、灯台。
  // (近景の橋・タンカー・魚は game.js の2Dパスが上に重なる)
  function buildAqua() {
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0a4a7d, 30, 340);
    scene.add(new THREE.HemisphereLight(0x54c8e8, 0x032040, 1.2));
    const moonLight = new THREE.DirectionalLight(0xcaf2ff, 1.0);
    moonLight.position.set(-120, 200, -160);
    scene.add(moonLight);

    // 月(2D版は x210,y120 → 画面左上の遠方へ)+ 星
    const moon = sprite(softTex('#eafcff', 128, .4), 0xeafcff, 52, .95);
    moon.position.set(-180, 225, -430);
    scene.add(moon);
    const moonGlow = sprite(softTex('#a0f0ff'), 0xa0f0ff, 140, .3);
    moonGlow.position.copy(moon.position);
    scene.add(moonGlow);
    scene.add(starField(220, 420, 40, -420, 2, ['#eafcff', '#8defff']));

    // 海面: 波のきらめきテクスチャ + 月光の帯
    const seaTex = makeTex(256, 256, (g, w, h) => {
      g.fillStyle = '#0a3358'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 150; i++) {
        g.fillStyle = pick(['#1c5b8e', '#65fff2', '#2f8cff', '#0e4470']);
        g.globalAlpha = rand(.12, .5);
        g.fillRect(rand(0, w), rand(0, h), rand(4, 26), rand(1, 2.4));
      }
      g.globalAlpha = 1;
    }, { repX: 24, repY: 10 });
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(1500, 520),
      lambert({ map: seaTex, color: 0xd6f4ff, emissive: 0x14496e, emissiveIntensity: .5 }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, -17, -260);
    scene.add(sea);
    // 水平線の照り返し: 空と海の境目に走る明るい帯。「ここから下は水面」という
    // 一番強い手掛かりで、これが無いと下半分がただの暗い面に見える。
    const horizonSheen = new THREE.Mesh(new THREE.PlaneGeometry(1500, 26),
      basic({ color: 0x9fe8ff, transparent: true, opacity: .3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    horizonSheen.rotation.x = -Math.PI / 2;
    horizonSheen.position.set(0, -16.7, -470);
    scene.add(horizonSheen);
    // 近景水面のツヤ: 手前ほど明るい加算の面。フォグで沈む near 側を持ち上げ、
    // 画面下端が「暗い床」ではなく「光を返す水」に見えるようにする。
    const sheenTex = makeTex(32, 128, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, 'rgba(255,255,255,0)');
      gr.addColorStop(.55, 'rgba(255,255,255,.35)');
      gr.addColorStop(1, 'rgba(255,255,255,.85)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    const nearSheen = new THREE.Mesh(new THREE.PlaneGeometry(1500, 240),
      new THREE.MeshBasicMaterial({
        map: sheenTex, transparent: true, opacity: .22, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false
      }));
    nearSheen.rotation.x = -Math.PI / 2;
    nearSheen.position.set(0, -16.95, -130);
    scene.add(nearSheen);
    // 月光が海面に落ちる光帯
    const moonPath = new THREE.Mesh(new THREE.PlaneGeometry(34, 300),
      basic({ color: 0xbaf6ff, transparent: true, opacity: .14, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    moonPath.rotation.x = -Math.PI / 2;
    moonPath.position.set(-180, -16.7, -240);
    scene.add(moonPath);
    // 対岸の街明かり: 水平線に沿う淡い光の帯
    const coastGlow = new THREE.Mesh(new THREE.PlaneGeometry(900, 7),
      basic({ color: 0x65fff2, transparent: true, opacity: .12, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    coastGlow.position.set(0, -14, -320);
    scene.add(coastGlow);

    // うねり: 海面に寝かせた光の帯がカメラへ向かって流れる。旧2Dの遠近波
    // (drawOcean)を3Dで置き換えるもので、橋脚との前後関係も正しく出る。
    const crestTex = makeTex(128, 32, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, 'rgba(255,255,255,0)');
      gr.addColorStop(.5, 'rgba(255,255,255,.9)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      for (let i = 0; i < 9; i++) {              // 途切れた波頭にして直線に見せない
        const x = i * 15 + rand(-3, 3);
        g.fillRect(x, 0, rand(6, 12), h);
      }
    }, { repX: 7, repY: 1 });
    // 手前ほど帯を太く明るくする。近景(z>-60)は画面下端いっぱいに広がるので、
    // ここが「海の上を飛んでいる」感じを作る主役になる。
    const swell = [];
    const SWELL_NEAR = -18, SWELL_FAR = -300;
    for (let i = 0; i < 26; i++) {
      const crest = new THREE.Mesh(new THREE.PlaneGeometry(1500, 5),
        new THREE.MeshBasicMaterial({
          map: crestTex, transparent: true, opacity: .3, depthWrite: false,
          blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false
        }));
      crest.rotation.x = -Math.PI / 2;
      crest.position.set(0, -16.9, SWELL_FAR + (SWELL_NEAR - SWELL_FAR) * (i / 26));
      crest.userData.ph = rand(0, 6.28);
      scene.add(crest);
      swell.push(crest);
    }

    // 白波: 海面に散る泡の塊。波頭と違って個別に流れるので、水面が「動く面」に見える
    const capTex = makeTex(64, 32, (g, w, h) => {
      g.fillStyle = 'rgba(255,255,255,.9)';
      for (let i = 0; i < 22; i++) {
        g.globalAlpha = rand(.25, .9);
        g.beginPath();
        g.ellipse(rand(6, w - 6), rand(6, h - 6), rand(2, 7), rand(1.5, 4), 0, 0, 6.3);
        g.fill();
      }
      g.globalAlpha = 1;
    });
    const caps = [];
    for (let i = 0; i < 26; i++) {
      const cap = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          map: capTex, transparent: true, opacity: .5, depthWrite: false,
          blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false
        }));
      cap.rotation.x = -Math.PI / 2;
      const z = rand(SWELL_FAR, SWELL_NEAR);
      cap.position.set(rand(-320, 320), -16.85, z);
      cap.userData.ph = rand(0, 6.28);
      scene.add(cap);
      caps.push(cap);
    }

    // 月光のきらめき: 月の真下に伸びる、ちらちら光る帯(海面である最大の手掛かり)
    const glitterTex = makeTex(64, 128, (g, w, h) => {
      for (let i = 0; i < 90; i++) {
        const y = rand(0, h);
        const spread = 4 + (y / h) * (w * .42);   // 手前ほど横に広がる
        g.globalAlpha = rand(.2, .95) * (.35 + y / h * .65);
        g.fillStyle = '#dffbff';
        g.fillRect(w / 2 + rand(-spread, spread), y, rand(2, 7), 1.6);
      }
      g.globalAlpha = 1;
    });
    const glitter = new THREE.Mesh(new THREE.PlaneGeometry(150, 420),
      new THREE.MeshBasicMaterial({
        map: glitterTex, transparent: true, opacity: .5, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false
      }));
    glitter.rotation.x = -Math.PI / 2;
    glitter.position.set(-180, -16.8, -150);   // 月(x=-180)の真下に伸ばす
    scene.add(glitter);

    // 吊り橋: AQUA HIGHWAY の名物ランドマーク。**背景の遠景**として置く。
    // 近景に置くと桁が飛行ラインを横切り「海の上を飛んでいる」感じが消えるため、
    // z=-150 の遠方へ下げてある(海面より上に立ち、水平線寄りに小さく見える)。
    // 桁の高さ: z=-150 で画面y=600 になる世界y ≈ -7.7(カメラ pitch 0.283 / fov55 から逆算)。
    // z を動かすときは必ず両方を再計算すること。
    const BRIDGE_Z = -150, DECK_Y = -7.7;
    const hwBelt = makeScroller(() => {
      const grp = new THREE.Group();
      const conc = lambert({ color: 0x2a6a8e });
      const cableMat = basic({ color: 0x65fff2, transparent: true, opacity: .55 });
      const SPAN = 210;                          // 主塔間隔
      const deck = new THREE.Mesh(new THREE.BoxGeometry(420, 2.2, 11), conc);
      deck.position.set(210, DECK_Y - 1.1, BRIDGE_Z); grp.add(deck);
      // 桁側面の帯と、路側の防護柵(海上の高架だと一目で分かる要素)
      const edge = new THREE.Mesh(new THREE.BoxGeometry(420, .5, .4),
        basic({ color: 0x65fff2, transparent: true, opacity: .5 }));
      edge.position.set(210, DECK_Y - .2, BRIDGE_Z + 5.6); grp.add(edge);
      for (let i = 0; i < 60; i++) {             // 防護柵の支柱
        const post = new THREE.Mesh(new THREE.BoxGeometry(.35, 1.9, .35), conc);
        post.position.set(i * 7, DECK_Y + .9, BRIDGE_Z + 5.6); grp.add(post);
      }
      const rail2 = new THREE.Mesh(new THREE.BoxGeometry(420, .35, .3), conc);
      rail2.position.set(210, DECK_Y + 1.8, BRIDGE_Z + 5.6); grp.add(rail2);
      for (let i = 0; i < 3; i++) {              // 主塔(H型)
        const px = i * SPAN;
        for (const dz of [-4, 4]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(2.2, 46, 2.6), conc);
          leg.position.set(px, 6, BRIDGE_Z + dz); grp.add(leg);
        }
        const cross = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 10.6), conc);
        cross.position.set(px, 24, BRIDGE_Z); grp.add(cross);
        const beacon = sprite(softTex('#ff6a6a'), 0xff6a6a, 2.6, .9);
        beacon.position.set(px, 30, BRIDGE_Z);
        beacon.userData.blink = i * 2.1;
        grp.add(beacon);
        for (const ly of [4, 13, 21]) {          // 主塔の航路灯(視認性のため)
          const tl = sprite(softTex('#9ffff4'), 0x9ffff4, 2.2, .8);
          tl.position.set(px, ly, BRIDGE_Z + 4.5);
          grp.add(tl);
        }
      }
      // メインケーブル: 放物線を短い円柱でつなぐ
      for (let seg = 0; seg < 2; seg++) {
        const x0 = seg * SPAN, x1 = (seg + 1) * SPAN;
        const N = 12;
        for (let j = 0; j < N; j++) {
          const ta = j / N, tb = (j + 1) / N;
          const ya = 28 - Math.sin(ta * Math.PI) * 26, yb = 28 - Math.sin(tb * Math.PI) * 26;
          const xa = x0 + (x1 - x0) * ta, xb = x0 + (x1 - x0) * tb;
          const len = Math.hypot(xb - xa, yb - ya);
          const c = new THREE.Mesh(new THREE.CylinderGeometry(.28, .28, len, 4), cableMat);
          c.position.set((xa + xb) / 2, (ya + yb) / 2, BRIDGE_Z);
          c.rotation.z = Math.atan2(yb - ya, xb - xa) - Math.PI / 2;
          grp.add(c);
          if (j % 2 === 0) {                     // ハンガーロープ(桁まで垂らす)
            const hgr = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, ya - DECK_Y, 3), cableMat);
            hgr.position.set(xa, (ya + DECK_Y) / 2, BRIDGE_Z);
            grp.add(hgr);
          }
        }
      }
      for (let i = 0; i < 11; i++) {             // 橋上灯
        const lamp = sprite(softTex('#9ffff4'), 0x9ffff4, 3, .85);
        lamp.position.set(i * 42, DECK_Y + 3.4, BRIDGE_Z);
        grp.add(lamp);
      }
      // 中間橋脚: 桁から海面(y=-17)へ落ちる支柱と、水際の白い泡。
      // 「海に浮いた道」ではなく「海上の高架」に見せる決め手。
      for (let i = 0; i < 8; i++) {
        const px = i * 52 + 26;
        const pier = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2, 11, 8), conc);
        pier.position.set(px, DECK_Y - 6.5, BRIDGE_Z);
        grp.add(pier);
        const foam = sprite(softTex('#dffffb'), 0xdffffb, 9, .5);
        foam.position.set(px, -16.6, BRIDGE_Z + 1);
        grp.add(foam);
      }
      return grp;
    }, 420);
    scene.add(hwBelt.group);

    // 島影: なだらかな丘 + 遠景の海山
    const isleBelt = makeScroller(() => {
      const grp = new THREE.Group();
      const hillM = lambert({ color: 0x0e3d68 });
      const rockM = lambert({ color: 0x123c60 });
      for (let i = 0; i < 6; i++) {
        const x = i * 130 + rand(-24, 24), z = rand(-235, -175);
        const r = rand(20, 46);
        const hill = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2), hillM);
        hill.position.set(x, -18, z);
        hill.scale.y = rand(.4, .7);
        grp.add(hill);
        if (Math.random() < .5) {
          const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(3, 8), 0), rockM);
          rock.position.set(x + rand(-r, r), -17, z + rand(-14, 14));
          grp.add(rock);
        }
        // 港町の灯: 島の裾に暖色の光点をぱらぱらと
        const nLights = 3 + ((i * 7) % 4);
        for (let L = 0; L < nLights; L++) {
          const tl = sprite(softTex('#ffd9a0'), pick([0xffd9a0, 0xffe9c0, 0x9ffff4]), rand(2, 3.4), .85);
          tl.position.set(x + rand(-r * .8, r * .8), -17 + rand(.5, r * .22), z + rand(4, 16));
          grp.add(tl);
        }
      }
      return grp;
    }, 780);
    scene.add(isleBelt.group);

    // 灯台: 紅白ストライプ + 回転ビーム。島とともにゆっくり通過する
    const lh = new THREE.Group();
    const lhStripe = makeTex(32, 96, g => {
      g.fillStyle = '#f8f0e0'; g.fillRect(0, 0, 32, 96);
      g.fillStyle = '#e84a4a';
      for (let i = 0; i < 3; i++) g.fillRect(0, i * 32, 32, 16);
    });
    const lhBody = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.6, 26, 10), lambert({ map: lhStripe }));
    lhBody.position.y = 13; lh.add(lhBody);
    const lhTop = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 4, 8), lambert({ color: 0x27354d }));
    lhTop.position.y = 28; lh.add(lhTop);
    const lhLamp = sprite(softTex('#ffe15a'), 0xffe15a, 8, .95);
    lhLamp.position.y = 28; lh.add(lhLamp);
    const beamGeo = new THREE.PlaneGeometry(90, 5);
    beamGeo.translate(45, 0, 0);                 // 根元を灯室に
    const lhBeams = new THREE.Group();
    for (const rot of [0, Math.PI]) {
      const beam = new THREE.Mesh(beamGeo, basic({ color: 0xfff2b0, transparent: true, opacity: .2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      beam.rotation.y = rot;
      lhBeams.add(beam);
    }
    lhBeams.position.y = 28;
    lh.add(lhBeams);
    const lhIsle = new THREE.Mesh(new THREE.SphereGeometry(9, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), lambert({ color: 0x0e3d68 }));
    lhIsle.scale.y = .5;
    lh.add(lhIsle);
    lh.position.set(150, -18, -150);
    lh.userData = { span: 1100, min: -420 };
    scene.add(lh);

    // 対岸の街のスカイライン(淡い窓明かりのシルエット)
    const winCoast = windowTex('#0a2440', ['#9fe8ff', '#ffd9a0'], 8, 12, .3);
    const coastBelt = makeScroller(() => {
      const grp = new THREE.Group();
      const mat = lambert({ map: winCoast, color: 0x2a5a80, emissive: 0xffffff, emissiveIntensity: .6, emissiveMap: winCoast });
      const side = lambert({ color: 0x0c2c48 });
      for (let i = 0; i < 16; i++) {
        const h = rand(9, 30), w = rand(14, 26);
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), [side, side, side, side, mat, mat]);
        b.position.set(i * 56 + rand(-10, 10), -18 + h / 2, rand(-330, -300));
        grp.add(b);
      }
      return grp;
    }, 900);
    scene.add(coastBelt.group);

    // ベイサイドの観覧車: リング+スポーク+色とりどりのゴンドラ灯がゆっくり回る
    const ferris = new THREE.Group();
    const ferrisMat = basic({ color: 0x65fff2, transparent: true, opacity: .7 });
    const wheel = new THREE.Group();
    wheel.add(new THREE.Mesh(new THREE.TorusGeometry(20, .5, 6, 40), ferrisMat));
    wheel.add(new THREE.Mesh(new THREE.TorusGeometry(13, .3, 5, 30), ferrisMat));
    for (let i = 0; i < 8; i++) {
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, 40, 4), ferrisMat);
      spoke.rotation.z = (i / 8) * Math.PI;
      wheel.add(spoke);
    }
    const gondCols = [0xff9ecf, 0xffe15a, 0x65fff2, 0x9ffff4, 0xff6a6a, 0xb08aff];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const gd = sprite(softTex('#ffffff', 64, .3), gondCols[i % gondCols.length], 3.4, .95);
      gd.position.set(Math.cos(a) * 20, Math.sin(a) * 20, 0);
      wheel.add(gd);
    }
    ferris.add(wheel);
    const hub = sprite(softTex('#ffffff'), 0xffffff, 4, .9);
    ferris.add(hub);
    for (const sx of [-1, 1]) {                  // 支持脚
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(.5, .8, 30, 4), lambert({ color: 0x123c60 }));
      leg.position.set(sx * 7, -14, 0);
      leg.rotation.z = sx * .24;
      ferris.add(leg);
    }
    ferris.position.set(430, 4, -250);
    ferris.userData = { span: 1500, min: -600 };
    scene.add(ferris);

    // 風力タービン(島の上で回る)
    const turbBelt = makeScroller(() => {
      const grp = new THREE.Group();
      const white = lambert({ color: 0xdaf0f8 });
      for (let i = 0; i < 4; i++) {
        const x = i * 190 + rand(-20, 20), z = rand(-215, -185);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(.5, 1, 26, 6), white);
        pole.position.set(x, -18 + 13, z);
        grp.add(pole);
        const hubG = new THREE.Group();
        for (let b = 0; b < 3; b++) {
          const blade = new THREE.Mesh(new THREE.PlaneGeometry(.9, 10), lambert({ color: 0xdaf0f8, side: THREE.DoubleSide }));
          blade.geometry.translate(0, 5, 0);
          blade.rotation.z = (b / 3) * Math.PI * 2;
          hubG.add(blade);
        }
        hubG.position.set(x, -18 + 26, z + .8);
        hubG.userData.turb = rand(0, 6.28);
        grp.add(hubG);
      }
      return grp;
    }, 760);
    scene.add(turbBelt.group);
    const turbines = [];
    turbBelt.group.traverse(o => { if (o.userData && o.userData.turb !== undefined) turbines.push(o); });

    // コンテナ港: ガントリークレーンと色とりどりのコンテナ山。
    // **外洋の遠景**として z=-235 に置く。手前に寄せると水面の帯を埋め尽くし、
    // 「海の上を飛んでいる」ではなく「港の中にいる」画になる。
    const PORT_Z = -235;
    const portBelt = makeScroller(() => {
      const grp = new THREE.Group();
      const steel = lambert({ color: 0x14405e });
      const contCols = [0xe84a4a, 0x2f8cff, 0x31a86a, 0xffe15a, 0xb08aff];
      for (let c = 0; c < 2; c++) {              // クレーン
        const x = c * 330 + 60;
        const frame = new THREE.Group();
        for (const lx of [-9, 9]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(1.6, 30, 2), steel);
          leg.position.set(lx, 15, 0); frame.add(leg);
        }
        const boom = new THREE.Mesh(new THREE.BoxGeometry(38, 1.8, 2.2), steel);
        boom.position.set(4, 30, 0); frame.add(boom);
        const cab = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 3), steel);
        cab.position.set(-4, 27, 0); frame.add(cab);
        const lampC = sprite(softTex('#ffd9a0'), 0xffd9a0, 3, .85);
        lampC.position.set(18, 29, 0); frame.add(lampC);
        frame.position.set(x, -18, PORT_Z);
        grp.add(frame);
      }
      for (let i = 0; i < 9; i++) {              // コンテナ山(密度を落として水面を空ける)
        const stack = 1 + ((i * 5) % 3);
        for (let sY = 0; sY < stack; sY++) {
          const box = new THREE.Mesh(new THREE.BoxGeometry(7, 3, 3.2), lambert({ color: pick(contCols) }));
          box.position.set(i * 34 + rand(-4, 4), -18 + 1.5 + sY * 3.1, PORT_Z + rand(-8, 8));
          grp.add(box);
        }
      }
      return grp;
    }, 660);
    scene.add(portBelt.group);

    // 航路ブイ(明滅しながら波に揺れる)
    const buoys = [];
    for (let i = 0; i < 5; i++) {
      const bu = new THREE.Group();
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1, 2.6, 6), lambert({ color: i % 2 ? 0xe84a4a : 0x31a86a }));
      cone.position.y = .6; bu.add(cone);
      const bl = sprite(softTex(i % 2 ? '#ff6a6a' : '#7dff9a'), i % 2 ? 0xff6a6a : 0x7dff9a, 2.2, .9);
      bl.position.y = 2.4; bu.add(bl);
      bu.position.set(rand(-220, 240), -17, rand(-95, -55));
      bu.userData = { ph: rand(0, 6.28), min: -250, span: 500, light: bl };
      scene.add(bu); buoys.push(bu);
    }

    // 帆船(ゆっくり滑り、波でわずかに揺れる)
    const boats = [];
    for (let i = 0; i < 3; i++) {
      const bo = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(6.5, 1.4, 2), lambert({ color: 0x1c4a6e }));
      hull.position.y = .5; bo.add(hull);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(.12, .16, 7, 4), lambert({ color: 0xdaf0f8 }));
      mast.position.y = 4.4; bo.add(mast);
      const sailShape = new THREE.Shape();
      sailShape.moveTo(0, 0); sailShape.lineTo(0, 6); sailShape.lineTo(3.4, .4); sailShape.lineTo(0, 0);
      const sail = new THREE.Mesh(new THREE.ShapeGeometry(sailShape),
        lambert({ color: 0xf4fbff, side: THREE.DoubleSide, emissive: 0x223a4a }));
      sail.position.set(.15, 1.2, 0);
      bo.add(sail);
      const cabinLight = sprite(softTex('#ffd9a0'), 0xffd9a0, 1.6, .9);
      cabinLight.position.set(-2, 1.4, 0); bo.add(cabinLight);
      bo.position.set(rand(-200, 240), -16.6, rand(-150, -105));
      bo.userData = { ph: rand(0, 6.28), v: rand(1.5, 3.5) * pick([-1, 1]), min: -260, span: 520 };
      scene.add(bo); boats.push(bo);
    }

    // --- ザトウクジラ: 実3Dのブリーチング -----------------------------
    // 旧2Dの巨大魚(平面のカートゥーン)の置き換え。旋盤形状の流線型ボディに
    // 尾びれ・胸びれ・背びれ・喉の畝を付け、海中→跳躍→着水を繰り返す。
    // 着水と離水では水しぶきを出すので、海面との関係がはっきり読める。
    function buildWhale() {
      const g = new THREE.Group();
      // 夜の逆光でも塊が読めるよう、emissive で最低限の明度を持たせる
      const skin = lambert({ color: 0x3a6285, emissive: 0x0e2236, emissiveIntensity: .8 });
      const belly = lambert({ color: 0xbcdcec, emissive: 0x24404e, emissiveIntensity: .6 });
      const dark = lambert({ color: 0x101f30 });
      const L = 26;                              // 半長(全長52ユニット)
      const prof = [];
      for (let i = 0; i <= 16; i++) {
        const u = i / 16;                        // 0=尾 1=鼻先
        // 尾で細く、胴の前寄りで最大、鼻先で丸く落とす実際のシルエット
        const r = .45 + 4.9 * Math.sin(Math.pow(u, .72) * Math.PI * .94);
        prof.push(new THREE.Vector2(Math.max(.4, r), -L + 2 * L * u));
      }
      const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 16), skin);
      body.rotation.z = -Math.PI / 2;            // 旋盤のY軸を機首方向(+X)へ倒す
      g.add(body);
      // 白い腹側: 同じ形をひと回り小さくして下へずらす
      const under = new THREE.Mesh(new THREE.LatheGeometry(prof, 16), belly);
      under.rotation.z = -Math.PI / 2;
      under.scale.set(.97, .62, .93);
      under.position.y = -1.9;
      g.add(under);
      // 喉の畝(ザトウクジラの特徴)
      for (let i = 0; i < 7; i++) {
        const pleat = new THREE.Mesh(new THREE.BoxGeometry(20, .12, .5), dark);
        pleat.position.set(9, -3.1, -2.4 + i * .8);
        g.add(pleat);
      }
      // 尾びれ: 2枚の平たい三角
      for (const sgn of [-1, 1]) {
        const fluke = new THREE.Mesh(new THREE.ConeGeometry(6.4, 11, 4), skin);
        fluke.scale.set(1, 1, .18);
        fluke.rotation.z = Math.PI / 2 + sgn * .34;
        fluke.position.set(-L - 3.6, sgn * 1.2, 0);
        g.add(fluke);
      }
      // 胸びれ: 長い(全長の1/3)のがザトウクジラ
      for (const sgn of [-1, 1]) {
        const pec = new THREE.Mesh(new THREE.BoxGeometry(15, .6, 2.6), belly);
        pec.position.set(4, -2.2, sgn * 4.4);
        pec.rotation.y = sgn * .5;
        pec.rotation.z = -.28;
        g.add(pec);
      }
      const dorsal = new THREE.Mesh(new THREE.ConeGeometry(1.9, 4.2, 4), skin);
      dorsal.scale.set(1, 1, .3);
      dorsal.position.set(-8, 4.4, 0);
      dorsal.rotation.z = -.5;
      g.add(dorsal);
      // 口の線と目
      const mouth = new THREE.Mesh(new THREE.BoxGeometry(17, .3, .3), dark);
      mouth.position.set(13, -2.2, 0);
      g.add(mouth);
      for (const sgn of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(.62, 6, 5), dark);
        eye.position.set(11.5, -.6, sgn * 3.4);
        g.add(eye);
      }
      // 潮吹き(噴気孔から立つ霧柱)。跳躍の頂点で一瞬だけ出す
      const blow = sprite(softTex('#eaffff'), 0xeaffff, 12, 0);
      blow.position.set(-2, 7, 0);
      g.add(blow);
      g.userData.blow = blow;
      return g;
    }
    const whale = buildWhale();
    // 素の全長52ユニットでは z=-130 で約275pxにしかならず「巨大」に見えない。
    // 2倍で全長104ユニット ≒ 550px(可視幅の半分弱)。跳躍高度もこれに合わせてある。
    whale.scale.setScalar(2);
    whale.position.set(0, -40, -130);
    whale.userData.wait = rand(3, 8);
    whale.userData.p = -1;                       // -1 = 潜航中
    scene.add(whale);

    // 水しぶき: 離水・着水の瞬間に海面へ広がる泡のプール
    const splashes = [];
    for (let i = 0; i < 10; i++) {
      const sp = sprite(softTex('#f0ffff'), 0xf0ffff, 10, 0, THREE.NormalBlending);
      sp.visible = false;
      scene.add(sp);
      splashes.push(sp);
    }
    function splash(x, z, size) {
      for (const sp of splashes) {
        if (sp.visible) continue;
        sp.visible = true;
        sp.position.set(x + rand(-6, 6), -15.5, z);
        sp.userData = { t: 0, life: .9 + Math.random() * .5, size: size * rand(.7, 1.3) };
        return;
      }
    }

    // 貨物船: 航海灯を灯した長い船体が水平線寄りをゆっくり横切る
    const cargo = new THREE.Group();
    const hullMat = lambert({ color: 0x16304a });
    const cHull = new THREE.Mesh(new THREE.BoxGeometry(58, 6, 9), hullMat);
    cHull.position.y = 1; cargo.add(cHull);
    const cDeck = new THREE.Mesh(new THREE.BoxGeometry(50, 1.4, 8), lambert({ color: 0x24506e }));
    cDeck.position.y = 4.4; cargo.add(cDeck);
    for (let i = 0; i < 9; i++) {                // 甲板のコンテナ
      const cc = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 6.4),
        lambert({ color: pick([0xe84a4a, 0x2f8cff, 0x31a86a, 0xffe15a]) }));
      cc.position.set(-22 + i * 5.4, 6.6, 0);
      cargo.add(cc);
    }
    const bridgeHouse = new THREE.Mesh(new THREE.BoxGeometry(8, 8, 8), lambert({ color: 0xdae8f0 }));
    bridgeHouse.position.set(-24, 9, 0); cargo.add(bridgeHouse);
    // 航海灯とブリッジの窓明かり。遠景はフォグで沈むので、灯りが無いと
    // ただの板に見える(船だと分かるのは灯りのおかげ)。
    for (const [lx, ly, lc, sz] of [[-24, 13, 0xfff2c0, 4.4], [29, 6, 0x7dff9a, 3.6],
      [-31, 6, 0xff6a6a, 3.6], [-24, 9, 0xffe9b8, 5.4], [6, 9, 0xfff2c0, 3]]) {
      const nav = sprite(softTex('#ffffff'), lc, sz, .95);
      nav.position.set(lx, ly, 4); cargo.add(nav);
    }
    const wake = sprite(softTex('#dffffb'), 0xdffffb, 40, .35, THREE.NormalBlending);
    wake.position.set(-40, -.4, 0);
    wake.scale.set(46, 9, 1);
    cargo.add(wake);
    cargo.position.set(200, -17, -205);
    cargo.userData = { min: -420, span: 900 };
    scene.add(cargo);

    // 跳ねる魚群: 小さな銀色の紡錘が水面を出入りする
    const jumpers = [];
    for (let i = 0; i < 12; i++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 5), lambert({ color: 0xbfe4f5 }));
      f.scale.set(2.6, .8, .5);
      f.position.set(rand(-260, 260), -18, rand(-120, -55));
      f.userData = { ph: rand(0, 6.28), sp: rand(.7, 1.4) };
      scene.add(f);
      jumpers.push(f);
    }

    // 波しぶき/海鳥の羽ばたきに見える白い粒
    const N_SPRAY = 90;
    const sprayPos = new Float32Array(N_SPRAY * 3);
    for (let i = 0; i < N_SPRAY; i++) {
      sprayPos[i * 3] = rand(-240, 240);
      sprayPos[i * 3 + 1] = rand(-16, -4);
      sprayPos[i * 3 + 2] = rand(-190, -40);
    }
    const sprayGeo = new THREE.BufferGeometry();
    sprayGeo.setAttribute('position', new THREE.BufferAttribute(sprayPos, 3));
    const spray = new THREE.Points(sprayGeo, new THREE.PointsMaterial({ color: 0xd8fcff, size: 2, transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: false }));
    scene.add(spray);

    const blinkers = [];
    hwBelt.group.traverse(o => { if (o.userData && o.userData.blink !== undefined) blinkers.push(o); });

    let t = 0;
    return {
      scene,
      // 検証用: クジラの跳躍を即座に始めさせる(待ち時間が長く撮影しにくいため)
      breach() { if (whale.userData.p < 0) whale.userData.wait = 0; },
      debug: () => ({
        whaleX: Math.round(whale.position.x), whaleY: Math.round(whale.position.y),
        whaleZ: Math.round(whale.position.z), whaleP: +whale.userData.p.toFixed(2)
      }),
      update(dt, s) {
        t += dt;
        const dx = SCROLL * (s.speed || 1) * dt;
        hwBelt.update(dx); isleBelt.update(dx * .85);
        coastBelt.update(dx * .6); turbBelt.update(dx * .85); portBelt.update(dx * .9);
        lh.position.x -= dx * .85;
        if (lh.position.x < lh.userData.min) lh.position.x += lh.userData.span;
        lhBeams.rotation.y = t * .9;
        // 観覧車: ゆっくり回りながら遠景を通過
        wheel.rotation.z = t * .12;
        ferris.position.x -= dx * .75;
        if (ferris.position.x < ferris.userData.min) ferris.position.x += ferris.userData.span;
        for (const tb of turbines) tb.rotation.z = t * 1.4 + tb.userData.turb;
        for (const bu of buoys) {
          bu.position.x -= dx * .9;
          if (bu.position.x < bu.userData.min) bu.position.x += bu.userData.span;
          bu.position.y = -17 + Math.sin(t * 1.6 + bu.userData.ph) * .5;
          bu.rotation.z = Math.sin(t * 1.2 + bu.userData.ph) * .12;
          bu.userData.light.material.opacity = .3 + .7 * Math.max(0, Math.sin(t * 2.6 + bu.userData.ph));
        }
        for (const bo of boats) {
          bo.position.x -= dx * .9 - bo.userData.v * dt;
          if (bo.position.x < bo.userData.min) bo.position.x += bo.userData.span;
          else if (bo.position.x > bo.userData.min + bo.userData.span) bo.position.x -= bo.userData.span;
          bo.position.y = -16.6 + Math.sin(t * 1.3 + bo.userData.ph) * .3;
          bo.rotation.z = Math.sin(t * .9 + bo.userData.ph) * .06;
        }
        seaTex.offset.x += dx * (24 / 1500);      // 橋・島と同じ世界速度
        seaTex.offset.y = Math.sin(t * .4) * .012; // うねり
        // 波頭はカメラへ迫るほど速く・太く・明るくなる(遠近の手掛かり)
        const span = SWELL_NEAR - SWELL_FAR;
        for (const c of swell) {
          const near = (c.position.z - SWELL_FAR) / span;   // 0=遠 1=近
          c.position.z += (4 + near * 46) * dt;
          if (c.position.z > SWELL_NEAR) c.position.z = SWELL_FAR;
          c.position.x = Math.sin(t * .5 + c.userData.ph) * 26;
          c.scale.set(1, 1 + near * 5, 1);
          c.material.opacity = (.07 + near * .5) * (.8 + .2 * Math.sin(t * 1.4 + c.userData.ph));
        }
        // 白波: 流れながら横にも漂い、泡が明滅する
        for (const c of caps) {
          const near = (c.position.z - SWELL_FAR) / span;
          c.position.z += (4 + near * 46) * dt;
          c.position.x -= dx * .5;
          if (c.position.z > SWELL_NEAR) {
            c.position.z = SWELL_FAR;
            c.position.x = rand(-320, 320);
          }
          if (c.position.x < -340) c.position.x += 680;
          const s = 10 + near * 46;
          c.scale.set(s, s * .55, 1);
          c.material.opacity = (.1 + near * .45) * (.6 + .4 * Math.sin(t * 2.2 + c.userData.ph));
        }
        glitter.material.opacity = .42 + .12 * Math.sin(t * 1.9);
        glitterTex.offset.y -= dt * .12;          // きらめきが手前へ流れる

        // --- クジラのブリーチング -------------------------------------
        const W = whale.userData;
        if (W.p < 0) {                            // 潜航中: 次の跳躍を待つ
          W.wait -= dt;
          whale.position.x -= dx * .8 + 6 * dt;
          if (whale.position.x < -300) whale.position.x += 620;
          if (W.wait <= 0) {
            W.p = 0;
            W.dur = 3.4 + Math.random() * 1.2;
            // 跳躍高度: 海面(y=-17)を 30ユニット以上抜けないと体が出ない。
            // 開始xは画面中央寄り(z=-130 での可視幅は概ね ±110ユニット)。
            W.arc = 62 + Math.random() * 14;      // 体が大きい分だけ高く抜く
            whale.position.set(rand(-45, 45), -46, -130 + rand(-25, 25));
            whale.rotation.y = Math.random() < .5 ? 0 : Math.PI;   // 向きも振る
          }
        } else {
          const prevY = whale.position.y;
          W.p += dt / W.dur;
          if (W.p >= 1) {                         // 着水しきったら潜航へ
            W.p = -1; W.wait = 5 + Math.random() * 8;
            whale.position.y = -46;
          } else {
            const s = Math.sin(W.p * Math.PI);     // 0→1→0 の放物線
            whale.position.y = -46 + W.arc * s;
            whale.position.x += (whale.rotation.y ? -1 : 1) * 11 * dt - dx * .8;
            // 上昇中は機首上げ、下降中は機首下げ(実際の跳躍の姿勢)
            whale.rotation.z = Math.cos(W.p * Math.PI) * .85;
            whale.userData.blow.material.opacity =
              W.p > .42 && W.p < .6 ? .8 * Math.sin((W.p - .42) / .18 * Math.PI) : 0;
            // 海面(y=-17)を横切った瞬間に水しぶき
            if (prevY < -17 && whale.position.y >= -17) splash(whale.position.x, whale.position.z, 62);
            if (prevY > -17 && whale.position.y <= -17) splash(whale.position.x, whale.position.z, 88);
          }
        }
        for (const sp of splashes) {
          if (!sp.visible) continue;
          const u = sp.userData;
          u.t += dt;
          const q = u.t / u.life;
          if (q >= 1) { sp.visible = false; continue; }
          const sc = u.size * (.4 + q * 1.3);
          sp.scale.set(sc, sc * .5, 1);
          sp.material.opacity = .75 * (1 - q) * (q < .12 ? q / .12 : 1);
        }

        cargo.position.x -= dx * .55 + 3.5 * dt;
        if (cargo.position.x < cargo.userData.min) cargo.position.x += cargo.userData.span;
        for (const f of jumpers) {                // 水面を出入りする魚群
          f.position.x -= dx * .9;
          if (f.position.x < -280) f.position.x += 560;
          const a = Math.sin(t * f.userData.sp + f.userData.ph);
          f.position.y = -18 + Math.max(0, a) * 5.5;
          f.rotation.z = Math.cos(t * f.userData.sp + f.userData.ph) * .7;
        }
        for (const b of blinkers) b.material.opacity = .3 + .7 * Math.max(0, Math.sin(t * 2.2 + b.userData.blink));
        const p = sprayGeo.attributes.position.array;
        for (let i = 0; i < N_SPRAY; i++) {
          p[i * 3] -= dx * .9;
          p[i * 3 + 1] += Math.sin(t * 2 + i) * dt * 1.4;
          if (p[i * 3] < -250) p[i * 3] += 500;
        }
        sprayGeo.attributes.position.needsUpdate = true;
        moonGlow.material.opacity = .26 + .06 * Math.sin(t * .7);
        // 外洋→深海チャプターはフォグを濃く、月光を落とす
        const deep = Math.min(2, s.chapter + (s.chapterT || 0)) / 2;
        scene.fog.far = 340 - deep * 90;
        moonLight.intensity = 1.0 - deep * .35;
      }
    };
  }

  // ============================================================ STAGE 3
  // SUNSET FACTORY — 夕焼けの製鉄所。煙突、タンク、パイプ、炉の火明かり。
  function buildFactory() {
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x5e1c30, 30, 330);   // 浅いピンクだと全体が同じ明度に潰れる
    scene.add(new THREE.HemisphereLight(0xff9f6a, 0x38101e, 1.05));
    const sunLight = new THREE.DirectionalLight(0xffb066, 1.3);
    sunLight.position.set(-140, 60, -220);
    scene.add(sunLight);

    // 沈む夕日 + 大きな残光
    const sun = sprite(softTex('#fff0c0', 128, .5), 0xffd27a, 110, 1);
    sun.position.set(-140, 95, -430);
    scene.add(sun);
    const sunGlow = sprite(softTex('#ff9f43'), 0xff9f43, 320, .4);
    sunGlow.position.copy(sun.position);
    scene.add(sunGlow);

    // 地面: 鉄板 + オレンジの照り返し
    const floorTex = makeTex(256, 256, (g, w, h) => {
      g.fillStyle = '#331020'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 60; i++) {
        g.fillStyle = pick(['#5a1d2c', '#ff7a36', '#2a0c1a']);
        g.globalAlpha = rand(.08, .3);
        g.fillRect(rand(0, w), rand(0, h), rand(4, 40), rand(1, 4));
      }
      g.globalAlpha = 1;
    }, { repX: 26, repY: 10 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1500, 520), lambert({ map: floorTex, color: 0xffb08a }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -17, -260);
    scene.add(ground);

    // 遠景: 製油所シルエット(塔・球タンク・骨組み)
    const farBelt = makeScroller(() => {
      const grp = new THREE.Group();
      const m = lambert({ color: 0x4a1830 });
      for (let i = 0; i < 20; i++) {
        const x = i * 36 + rand(-8, 8), z = rand(-260, -210);
        const kind = Math.random();
        let mesh;
        if (kind < .4) mesh = new THREE.Mesh(new THREE.CylinderGeometry(rand(2, 4), rand(2.4, 4.6), rand(36, 78), 6), m);
        else if (kind < .7) mesh = new THREE.Mesh(new THREE.BoxGeometry(rand(10, 26), rand(20, 50), rand(10, 20)), m);
        else mesh = new THREE.Mesh(new THREE.SphereGeometry(rand(7, 13), 8, 6), m);
        mesh.position.set(x, -17 + (mesh.geometry.parameters.height ? mesh.geometry.parameters.height / 2 : mesh.geometry.parameters.radius * .8), z);
        grp.add(mesh);
        if (Math.random() < .4) {
          const lamp = sprite(softTex('#ff6a3a'), 0xff6a3a, 2.6, .8);
          lamp.position.set(x, mesh.position.y * 2 + 4, z);
          lamp.userData.blink = rand(0, 6.28);
          grp.add(lamp);
        }
      }
      return grp;
    }, 720);
    scene.add(farBelt.group);

    // 冷却塔(双曲面)+ 立ち上る蒸気
    const coolBelt = makeScroller(() => {
      const grp = new THREE.Group();
      const profile = [[10, 0], [7.6, 9], [6.2, 18], [6.6, 27], [7.8, 36]].map(([r, y]) => new THREE.Vector2(r, y));
      const mat = lambert({ color: 0x5a2036 });
      for (let i = 0; i < 2; i++) {
        const tower = new THREE.Mesh(new THREE.LatheGeometry(profile, 14), mat);
        tower.position.set(i * 330 + 80, -17, rand(-230, -195));
        grp.add(tower);
        tower.userData.steamAnchor = { x: tower.position.x, top: -17 + 36, z: tower.position.z };
      }
      return grp;
    }, 640);
    const coolSteams = [];
    coolBelt.group.traverse(o => {
      if (o.userData && o.userData.steamAnchor) {
        for (let i = 0; i < 4; i++) {
          const st = sprite(softTex('#e8c8d8', 128, .1), 0xe8c8d8, 10, .3, THREE.NormalBlending);
          st.userData.anchor = o;
          st.userData.ph = i / 4;
          o.parent.add(st);
          coolSteams.push(st);
        }
      }
    });
    scene.add(coolBelt.group);

    // フレアスタック: 細い塔の先で炎が揺れる(製油所の名物)
    const flareBelt = makeScroller(() => {
      const grp = new THREE.Group();
      const mat = lambert({ color: 0x6a2438 });
      for (let i = 0; i < 3; i++) {
        const x = i * 170 + rand(-16, 16), z = rand(-150, -120), h = rand(30, 42);
        const stack = new THREE.Mesh(new THREE.CylinderGeometry(.8, 1.3, h, 6), mat);
        stack.position.set(x, -17 + h / 2, z);
        grp.add(stack);
        const flame = sprite(softTex('#ffd27a', 128, .3), 0xff9a3a, 7, .95);
        flame.position.set(x, -17 + h + 2.6, z);
        flame.userData.flame = rand(0, 6.28);
        grp.add(flame);
        const flameCore = sprite(softTex('#fff0c0', 128, .5), 0xffe9b8, 3.4, .95);
        flameCore.position.set(x, -17 + h + 2, z);
        flameCore.userData.flame = rand(0, 6.28);
        grp.add(flameCore);
        const glow = sprite(softTex('#ff9f43'), 0xff7a36, 26, .3);
        glow.position.set(x, -17 + h + 4, z);
        grp.add(glow);
      }
      return grp;
    }, 510);
    const flames = [];
    flareBelt.group.traverse(o => { if (o.userData && o.userData.flame !== undefined) flames.push(o); });
    scene.add(flareBelt.group);

    // 送電鉄塔と電線
    const pylonBelt = makeScroller(() => {
      const grp = new THREE.Group();
      const mat = lambert({ color: 0x481a2c });
      const wireMat = basic({ color: 0x8a4a5a, transparent: true, opacity: .5, fog: false });
      const GAP = 96, N_PY = 5;
      for (let i = 0; i < N_PY; i++) {
        const x = i * GAP;
        const body = new THREE.Mesh(new THREE.CylinderGeometry(1, 4.6, 34, 4, 1, true), mat);
        body.position.set(x, -17 + 17, -168);
        body.rotation.y = Math.PI / 4;
        grp.add(body);
        for (const [ay, aw] of [[10, 12], [15, 9]]) {
          const arm = new THREE.Mesh(new THREE.BoxGeometry(aw, .7, .7), mat);
          arm.position.set(x, ay, -168);
          grp.add(arm);
        }
        if (i === N_PY - 1) continue;
        for (const [wy, wx0] of [[10, 5.4], [15, 4]]) {
          const N = 6;
          for (let s2 = 0; s2 < N; s2++) {
            const ta = s2 / N, tb = (s2 + 1) / N;
            const sag = 3.4;
            const ya = wy - Math.sin(ta * Math.PI) * sag, yb = wy - Math.sin(tb * Math.PI) * sag;
            const xa = x + wx0 + (GAP - wx0 * 2) * ta, xb = x + wx0 + (GAP - wx0 * 2) * tb;
            const len = Math.hypot(xb - xa, yb - ya);
            const wseg = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, len, 3), wireMat);
            wseg.position.set((xa + xb) / 2, (ya + yb) / 2, -168);
            wseg.rotation.z = Math.atan2(yb - ya, xb - xa) - Math.PI / 2;
            grp.add(wseg);
          }
        }
      }
      return grp;
    }, 480);
    scene.add(pylonBelt.group);

    // --- 製鉄所の「稼働している」要素 ---------------------------------
    // 溶鋼の川: 発光する帯が地表を流れる。emissiveMap でスクロールさせるので
    // ジオメトリは1枚で済む。工場が「動いている」ことを示す一番大きな光源。
    const moltenTex = makeTex(256, 32, (g, w, h) => {
      g.fillStyle = '#7a1a06'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 60; i++) {
        g.fillStyle = pick(['#ffd27a', '#ff8a2a', '#ffee9a', '#ff5a18']);
        g.globalAlpha = rand(.35, 1);
        g.fillRect(rand(0, w), rand(2, h - 6), rand(8, 40), rand(3, 9));
      }
      g.globalAlpha = 1;
      g.fillStyle = '#2a0a08'; g.fillRect(0, 0, w, 3); g.fillRect(0, h - 3, w, 3);
    }, { repX: 12, repY: 1 });
    const molten = new THREE.Mesh(new THREE.PlaneGeometry(1500, 15),
      lambert({ map: moltenTex, color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1, emissiveMap: moltenTex }));
    molten.rotation.x = -Math.PI / 2;
    molten.position.set(0, -16.4, -150);
    scene.add(molten);
    const moltenGlow = [];
    for (let i = 0; i < 7; i++) {
      const gl = sprite(softTex('#ff9a3a'), 0xff8a30, 78, .45);
      gl.position.set(-220 + i * 78, -11, -148);
      scene.add(gl); moltenGlow.push(gl);
    }

    // 取鍋(とりべ)クレーン: 発光する取鍋を吊った天井クレーンが往復し、
    // ときどき鋳型へ湯を注ぐ。注ぐ瞬間は火花が跳ね、周囲が明るくなる。
    const ladleRig = new THREE.Group();
    const rigMat = lambert({ color: 0x5a2038 });
    const rigBeam = new THREE.Mesh(new THREE.BoxGeometry(150, 3, 4), rigMat);
    rigBeam.position.y = 34; ladleRig.add(rigBeam);
    for (const lx of [-72, 72]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(3.4, 51, 4), rigMat);
      leg.position.set(lx, 8.5, 0); ladleRig.add(leg);
    }
    const trolley = new THREE.Group();
    const tBody = new THREE.Mesh(new THREE.BoxGeometry(9, 4, 6), rigMat);
    tBody.position.y = 30; trolley.add(tBody);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, 18, 4), rigMat);
    cable.position.y = 19; trolley.add(cable);
    const ladle = new THREE.Mesh(new THREE.CylinderGeometry(5, 3.6, 8, 10), lambert({ color: 0x7a3040 }));
    ladle.position.y = 6; trolley.add(ladle);
    const ladleHeat = sprite(softTex('#ffb04a'), 0xff9a2a, 20, .55);
    ladleHeat.position.y = 10; trolley.add(ladleHeat);
    // 注湯: 取鍋の口から下へ伸びる光の筋(注いでいる間だけ見える)
    const pour = new THREE.Mesh(new THREE.CylinderGeometry(.9, 1.5, 20, 6),
      basic({ color: 0xffd27a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    pour.position.set(0, -6, 0);
    trolley.add(pour);
    const pourPool = sprite(softTex('#ffd27a'), 0xffb04a, 34, 0);
    pourPool.position.set(0, -15.5, 0);
    trolley.add(pourPool);
    ladleRig.add(trolley);
    ladleRig.position.set(30, -17, -128);
    scene.add(ladleRig);
    let pourT = rand(2, 6), pouring = 0;

    // 鉱石列車: 発光する鉱石を積んだ貨車が軌道を走り抜ける
    const oreTrain = new THREE.Group();
    const carMat = lambert({ color: 0x4a1c2a });
    for (let i = 0; i < 9; i++) {
      const car = new THREE.Mesh(new THREE.BoxGeometry(11, 4.4, 5), carMat);
      car.position.set(i * 12.5, 0, 0); oreTrain.add(car);
      const ore = new THREE.Mesh(new THREE.BoxGeometry(9, 1.6, 4),
        lambert({ color: 0xff7a2a, emissive: 0xff5a10, emissiveIntensity: .8 }));
      ore.position.set(i * 12.5, 2.6, 0); oreTrain.add(ore);
      const oreGlow = sprite(softTex('#ff9a3a'), 0xff8a2a, 13, .4);
      oreGlow.position.set(i * 12.5, 4, 1.6); oreTrain.add(oreGlow);
    }
    const loco = new THREE.Mesh(new THREE.BoxGeometry(13, 7, 5.4), lambert({ color: 0x2e1220 }));
    loco.position.set(-14, 1.4, 0); oreTrain.add(loco);
    const locoLamp = sprite(softTex('#fff2c0'), 0xfff2c0, 7, .95);
    locoLamp.position.set(-21, 1.6, 0); oreTrain.add(locoLamp);
    oreTrain.position.set(260, -14.6, -88);
    scene.add(oreTrain);

    // 地表の蒸気噴出: 一定間隔で白い柱が上がる
    const vents = [];
    for (let i = 0; i < 5; i++) {
      const v = sprite(softTex('#e8d0d8', 128, .12), 0xe8d0d8, 14, 0, THREE.NormalBlending);
      v.position.set(-200 + i * 105, -14, rand(-96, -70));
      v.userData = { t: rand(0, 4), period: 3.4 + Math.random() * 3, min: -260, span: 520 };
      scene.add(v); vents.push(v);
    }

    // 火の粉柱: 炉列の真上に立ち上る熱気の柱(粒は既存の sparks が担当)
    const emberCols = [];
    for (let i = 0; i < 4; i++) {
      const col = new THREE.Mesh(new THREE.PlaneGeometry(16, 60),
        new THREE.MeshBasicMaterial({
          map: softTex('#ff9a3a'), transparent: true, opacity: .14, depthWrite: false,
          blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false
        }));
      col.position.set(-160 + i * 118, 8, -62);
      col.userData.ph = rand(0, 6.28);
      scene.add(col); emberCols.push(col);
    }

    // --- 本物の歯車機構 -----------------------------------------------
    // 歯形は Shape を押し出して作る(円柱＋箱の疑似歯だとシルエットが歯車に
    // 見えない)。Shape は XY 平面なので押し出すだけで歯面がカメラを向き、
    // 回転は Z 軸まわり=画面内の回転になる。
    // 金属感は MeshPhongMaterial の鏡面反射で出す(Lambert だと平坦な板になる)。
    function gearShape(rOuter, teeth, toothH, rHole) {
      const sh = new THREE.Shape();
      const rRoot = rOuter - toothH, step = Math.PI * 2 / teeth;
      // 1歯あたり4点: 歯底→歯先(立ち上がり)→歯先(歯先面)→歯底(立ち下がり)
      const prof = [[0, rRoot], [.14, rOuter], [.36, rOuter], [.50, rRoot]];
      for (let i = 0; i < teeth; i++) {
        for (const [f, r] of prof) {
          const a = (i + f) * step;
          const x = Math.cos(a) * r, y = Math.sin(a) * r;
          if (i === 0 && f === 0) sh.moveTo(x, y); else sh.lineTo(x, y);
        }
      }
      sh.closePath();
      const hole = new THREE.Path();
      hole.absarc(0, 0, rHole, 0, Math.PI * 2, true);
      sh.holes.push(hole);
      return sh;
    }
    // 炉の照り返しを emissive に持たせないと、赤い空を背に真っ黒な影絵になる
    const steelMat = new THREE.MeshPhongMaterial({ color: 0xb0707c, specular: 0xffd8b0, shininess: 46, emissive: 0x3a1418 });
    const steelDark = new THREE.MeshPhongMaterial({ color: 0x76323f, specular: 0xe09080, shininess: 30, emissive: 0x280d12 });
    function buildGear(rOuter, teeth, thick) {
      const g = new THREE.Group();
      const toothH = rOuter * .17, rHub = rOuter * .2, rHole = rOuter * .46;
      const body = new THREE.Mesh(
        new THREE.ExtrudeGeometry(gearShape(rOuter, teeth, toothH, rHole),
          { depth: thick, bevelEnabled: true, bevelSize: thick * .18, bevelThickness: thick * .18, bevelSegments: 1, curveSegments: 2 }),
        steelMat);
      body.position.z = -thick / 2;
      g.add(body);
      // ハブとスポーク(抜けた円盤のままだとリングに見える)
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(rHub, rHub, thick * 1.6, 12), steelDark);
      hub.rotation.x = Math.PI / 2;
      g.add(hub);
      for (let k = 0; k < 5; k++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(rOuter * .62, rOuter * .14, thick * .7), steelDark);
        spoke.position.set(Math.cos(k / 5 * Math.PI * 2) * rOuter * .33, Math.sin(k / 5 * Math.PI * 2) * rOuter * .33, 0);
        spoke.rotation.z = k / 5 * Math.PI * 2;
        g.add(spoke);
      }
      g.userData.r = rOuter - toothH / 2;         // ピッチ円半径(噛み合わせ計算用)
      return g;
    }
    // 歯車列: 先頭のギヤを基準に、ピッチ円が接するよう順に並べて逆回転させる。
    // 角速度比は ω1·r1 = -ω2·r2(実際の歯車と同じ)なので、見た目の連動が破綻しない。
    const gears = [];
    function gearTrain(x0, y0, z, specs, baseSpeed) {
      let px = x0, py = y0, prev = null, sp = baseSpeed;
      for (const [rOuter, teeth, dir] of specs) {
        const g = buildGear(rOuter, teeth, 3.4);
        if (prev) {
          const d = prev.userData.r + g.userData.r;
          px += Math.cos(dir) * d; py += Math.sin(dir) * d;
          sp = -sp * prev.userData.r / g.userData.r;
        }
        g.position.set(px, py, z);
        g.userData.sp = sp;
        scene.add(g); gears.push(g);
        prev = g;
      }
    }
    gearTrain(-150, 10, -112, [[20, 20, 0], [12, 13, .5], [16, 17, -.45]], .45);
    gearTrain(120, 4, -126, [[24, 24, 0], [14, 15, 2.55], [9, 10, 1.9]], -.3);

    // フライホイール＋クランク＋ピストン: 回転が往復運動に変わる様子が見えると
    // 一気に「稼働中の工場」になる。ロッドは毎フレーム長さと角度を作り直す。
    const engine = new THREE.Group();
    const flywheel = buildGear(13, 26, 4);
    flywheel.position.set(0, 0, 0);
    engine.add(flywheel);
    const crankPin = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 5, 8), steelDark);
    crankPin.rotation.x = Math.PI / 2;
    engine.add(crankPin);
    const rod = new THREE.Mesh(new THREE.BoxGeometry(1, 2.2, 2.2), steelMat);
    engine.add(rod);
    const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 22, 14), steelDark);
    cylinder.rotation.z = Math.PI / 2;
    cylinder.position.set(40, 0, 0);
    engine.add(cylinder);
    // フランジと台座。無地の円筒は横から見るとただの角材に見えるので、
    // 輪郭に段差を作って「機械」だと分かるようにする。
    for (const fx of [30, 40, 50]) {
      const flange = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 5.4, 1.4, 14), steelMat);
      flange.rotation.z = Math.PI / 2;
      flange.position.set(fx, 0, 0);
      engine.add(flange);
    }
    const bed = new THREE.Mesh(new THREE.BoxGeometry(64, 2.6, 12), steelDark);
    bed.position.set(20, -8, 0);
    engine.add(bed);
    for (const lx of [-4, 24, 50]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(3.4, 8, 6), steelDark);
      col.position.set(lx, -12, 0);
      engine.add(col);
    }
    const piston = new THREE.Mesh(new THREE.CylinderGeometry(3.7, 3.7, 5, 12), steelMat);
    piston.rotation.z = Math.PI / 2;
    engine.add(piston);
    const engineSteam = sprite(softTex('#e8d0d8', 128, .12), 0xe8d0d8, 12, 0, THREE.NormalBlending);
    engineSteam.position.set(50, 6, 0);
    engine.add(engineSteam);
    engine.scale.setScalar(1.3);
    engine.position.set(-20, 10, -92);
    scene.add(engine);
    let engAng = 0;

    // 3Dコンベア: 赤熱した鋼片が乗って流れる(火の粉と光を撒く)
    const convBelt = new THREE.Group();
    const beltBase = new THREE.Mesh(new THREE.BoxGeometry(420, 1.6, 7), steelDark);
    beltBase.position.set(210, -13, -78);
    convBelt.add(beltBase);
    for (let i = 0; i < 15; i++) {                // ローラー
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 7.4, 8), steelMat);
      roll.rotation.x = Math.PI / 2;
      roll.position.set(i * 28, -14.6, -78);
      convBelt.add(roll);
    }
    for (let i = 0; i < 12; i++) {                // 支柱
      const leg = new THREE.Mesh(new THREE.BoxGeometry(1.6, 5, 1.6), steelDark);
      leg.position.set(i * 36, -16, -78);
      convBelt.add(leg);
    }
    scene.add(convBelt);
    const ingots = [];
    for (let i = 0; i < 9; i++) {
      const ing = new THREE.Group();
      const slab = new THREE.Mesh(new THREE.BoxGeometry(9, 3, 5),
        lambert({ color: 0xff8a2a, emissive: 0xff5a10, emissiveIntensity: 1 }));
      ing.add(slab);
      const hot = sprite(softTex('#ffb04a'), 0xff9a2a, 22, .5);
      hot.position.z = 2; ing.add(hot);
      ing.position.set(rand(-260, 260), -10.6, -78);
      scene.add(ing); ingots.push(ing);
    }

    // 中景: 煙突(煙つき)とガントリークレーン
    const smokes = [];
    const smokeTex = softTex('#d9a8b8', 128, .1);
    const midBelt = makeScroller(() => {
      const grp = new THREE.Group();
      const steel = lambert({ color: 0x6a2438 });
      const stripe = makeTex(32, 64, g => {
        g.fillStyle = '#7a2a3e'; g.fillRect(0, 0, 32, 64);
        g.fillStyle = '#c8503c'; g.fillRect(0, 0, 32, 10);
        g.fillStyle = '#f8f0e0'; g.fillRect(0, 10, 32, 8);
      }, { repY: 4 });
      for (let i = 0; i < 6; i++) {
        const x = i * 90 + rand(-12, 12);
        const h = rand(38, 64);
        const chim = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.6, h, 8), lambert({ map: stripe }));
        chim.position.set(x, -17 + h / 2, rand(-140, -110));
        grp.add(chim);
        chim.userData.smokeAnchor = { x, top: -17 + h, z: chim.position.z };
      }
      for (let i = 0; i < 3; i++) {              // クレーン門型フレーム
        const x = i * 180 + 50;
        const frame = new THREE.Group();
        const fm = lambert({ color: 0x582038 });
        const beam = new THREE.Mesh(new THREE.BoxGeometry(46, 2.4, 3), fm);
        beam.position.y = 26; frame.add(beam);
        for (const lx of [-21, 21]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(2.4, 43, 3), fm);
          leg.position.set(lx, 4.5, 0); frame.add(leg);
        }
        const hook = new THREE.Mesh(new THREE.BoxGeometry(5, 7, 4), fm);
        hook.position.set(rand(-14, 14), 18, 0);
        hook.userData.trolley = rand(0, 6.28);   // 桁上をゆっくり往復する
        frame.add(hook);
        frame.position.set(x, -17, -95);
        grp.add(frame);
      }
      return grp;
    }, 540);
    // 煙スプライトのプール: 各煙突から立ち上る
    midBelt.group.traverse(o => {
      if (o.userData && o.userData.smokeAnchor) {
        for (let i = 0; i < 4; i++) {
          const s = sprite(smokeTex, 0xd9a8b8, rand(7, 12), .3, THREE.NormalBlending);
          s.userData.anchor = o;
          s.userData.ph = i / 4;
          o.parent.add(s);
          smokes.push(s);
        }
      }
    });
    const trolleys = [];
    midBelt.group.traverse(o => { if (o.userData && o.userData.trolley !== undefined) trolleys.push(o); });
    scene.add(midBelt.group);

    // 近景: パイプラック + 球タンク + 炉口の火明かり
    const glowMats = [];
    const nearBelt = makeScroller(() => {
      const grp = new THREE.Group();
      const steel = lambert({ color: 0x7a3044 });
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 480, 8), lambert({ color: 0x8a3a4a }));
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(240, -5, -58); grp.add(pipe);
      const pipe2 = pipe.clone(); pipe2.position.y = -8; grp.add(pipe2);
      for (let i = 0; i < 9; i++) {
        const x = i * 54;
        const post = new THREE.Mesh(new THREE.BoxGeometry(1.4, 14, 1.4), steel);
        post.position.set(x, -11, -58); grp.add(post);
      }
      for (let i = 0; i < 3; i++) {              // 球形タンク
        const tank = new THREE.Mesh(new THREE.SphereGeometry(6, 10, 8), lambert({ color: 0x9a4a52 }));
        tank.position.set(i * 160 + 90, -11, -74);
        grp.add(tank);
      }
      for (let i = 0; i < 4; i++) {              // 炉口: 発光する口 + 火の粉感
        const x = i * 120 + 30;
        const mouthMat = basic({ color: 0xffa040, fog: false });
        const mouth = new THREE.Mesh(new THREE.PlaneGeometry(7, 4.6), mouthMat);
        mouth.position.set(x, -13.5, -49.9);
        grp.add(mouth);
        glowMats.push(mouthMat);
        const glow = sprite(softTex('#ff9f43'), 0xff7a36, 22, .5);
        glow.position.set(x, -12, -49);
        grp.add(glow);
        const housing = new THREE.Mesh(new THREE.BoxGeometry(11, 10, 6), steel);
        housing.position.set(x, -11, -53);
        grp.add(housing);
      }
      return grp;
    }, 480);
    scene.add(nearBelt.group);

    // 火の粉: 炉の高さから舞い上がる
    const N_SP = 120;
    const spPos = new Float32Array(N_SP * 3);
    const spVel = new Float32Array(N_SP * 2);
    for (let i = 0; i < N_SP; i++) {
      spPos[i * 3] = rand(-240, 240); spPos[i * 3 + 1] = rand(-16, 10); spPos[i * 3 + 2] = rand(-70, -40);
      spVel[i * 2] = rand(-8, -2); spVel[i * 2 + 1] = rand(2, 7);
    }
    const spGeo = new THREE.BufferGeometry();
    spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
    const sparks = new THREE.Points(spGeo, new THREE.PointsMaterial({ color: 0xffc866, size: 2, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: false }));
    scene.add(sparks);

    const blinkers = [];
    farBelt.group.traverse(o => { if (o.userData && o.userData.blink !== undefined) blinkers.push(o); });

    let t = 0;
    return {
      scene,
      update(dt, s) {
        t += dt;
        const dx = SCROLL * (s.speed || 1) * dt;
        farBelt.update(dx * .85); midBelt.update(dx); nearBelt.update(dx);
        coolBelt.update(dx * .8); flareBelt.update(dx * .92); pylonBelt.update(dx * .88);
        floorTex.offset.x += dx * (26 / 1500);    // 煙突・タンクと同じ世界速度
        moltenTex.offset.x += dt * .09 + dx * (12 / 1500);   // 湯は自分でも流れる
        for (const gl of moltenGlow) {
          gl.position.x -= dx;
          if (gl.position.x < -300) gl.position.x += 620;
          gl.material.opacity = .38 + .16 * Math.sin(t * 3.1 + gl.position.x * .05);
        }
        // 歯車は面がカメラを向いているので Z 軸(画面内)まわりに回す
        for (const g2 of gears) {
          g2.rotation.z += g2.userData.sp * dt;
          g2.position.x -= dx * .9;
          if (g2.position.x < -320) g2.position.x += 700;
        }
        // フライホイール→クランク→ピストンの往復
        engAng += dt * 1.5;
        const crankR = 9;
        const cxk = Math.cos(engAng) * crankR, cyk = Math.sin(engAng) * crankR;
        crankPin.position.set(cxk, cyk, 0);
        const rodLen = 34;
        // ピストンピンは x 軸上。クランクピンとの距離からロッドの姿勢を出す
        const px2 = cxk + Math.sqrt(Math.max(1, rodLen * rodLen - cyk * cyk));
        piston.position.set(px2, 0, 0);
        rod.position.set((cxk + px2) / 2, cyk / 2, 0);
        rod.rotation.z = Math.atan2(-cyk, px2 - cxk);
        rod.scale.x = Math.hypot(px2 - cxk, cyk);
        flywheel.rotation.z = engAng;
        engine.position.x -= dx * .9;
        if (engine.position.x < -300) engine.position.x += 680;
        // 排気: 上死点付近で蒸気を噴く
        const stroke = (Math.cos(engAng) + 1) / 2;
        engineSteam.material.opacity = stroke > .82 ? (stroke - .82) / .18 * .5 : 0;
        engineSteam.scale.setScalar(10 + stroke * 12);
        // コンベアの赤熱鋼片
        for (const ing of ingots) {
          ing.position.x += 26 * dt - dx;
          if (ing.position.x > 300) ing.position.x -= 600;
          if (ing.position.x < -300) ing.position.x += 600;
        }
        convBelt.position.x -= dx;
        if (convBelt.position.x < -420) convBelt.position.x += 420;
        // 取鍋クレーン: 桁の上を往復し、周期的に湯を注ぐ
        trolley.position.x = Math.sin(t * .22) * 62;
        ladleRig.position.x -= dx * .9;
        if (ladleRig.position.x < -320) ladleRig.position.x += 700;
        pourT -= dt;
        if (pourT <= 0) { pouring = 1.6; pourT = 6 + Math.random() * 6; }
        if (pouring > 0) {
          pouring -= dt;
          const k = Math.min(1, pouring / 1.6);
          pour.material.opacity = .75 * k;
          pourPool.material.opacity = .6 * k;
          const ps = 30 + 12 * Math.sin(t * 14);
          pourPool.scale.set(ps, ps, 1);
          ladleHeat.material.opacity = .55 + .3 * k;
        } else {
          pour.material.opacity = 0; pourPool.material.opacity = 0;
          ladleHeat.material.opacity = .45 + .12 * Math.sin(t * 2.6);
        }
        // 鉱石列車: 自走+スクロールで右から左へ駆け抜け、たまに戻ってくる
        oreTrain.position.x -= dx + 46 * dt;
        if (oreTrain.position.x < -420) oreTrain.position.x = 320 + rand(80, 700);
        // 蒸気噴出: 立ち上って薄れるループ
        for (const v of vents) {
          v.position.x -= dx;
          if (v.position.x < v.userData.min) v.position.x += v.userData.span;
          v.userData.t += dt;
          const q = (v.userData.t % v.userData.period) / v.userData.period;
          const sc = 10 + q * 34;
          v.scale.set(sc, sc * 1.25, 1);
          v.position.y = -15 + q * 22;
          v.material.opacity = .42 * (1 - q) * (q < .1 ? q / .1 : 1);
        }
        for (const col of emberCols) {
          col.position.x -= dx;
          if (col.position.x < -260) col.position.x += 520;
          col.material.opacity = .1 + .07 * Math.sin(t * 1.7 + col.userData.ph);
          col.scale.set(1 + .12 * Math.sin(t * 2.3 + col.userData.ph), 1, 1);
        }
        for (const b of blinkers) b.material.opacity = .3 + .6 * Math.max(0, Math.sin(t * 2 + b.userData.blink));
        const flick = .85 + .3 * Math.sin(t * 9.2) * Math.sin(t * 5.1) + (s.energy || 0) * .2;
        for (const m of glowMats) m.color.setHSL(.07, 1, .45 + .12 * flick);
        // フレアの炎: 荒く明滅しつつ大きさも揺らす
        for (const f of flames) {
          const fl = .7 + .3 * Math.sin(t * 11 + f.userData.flame) * Math.sin(t * 6.3 + f.userData.flame * 2);
          f.material.opacity = .55 + .4 * fl;
          const base = f.material.color.getHex() === 0xffe9b8 ? 3.4 : 7;
          f.scale.set(base * (0.8 + .3 * fl), base * (0.9 + .45 * fl), 1);
        }
        for (const tr of trolleys) tr.position.x = Math.sin(t * .3 + tr.userData.trolley) * 14;
        // 冷却塔の蒸気(煙突の煙と同じ流儀で上昇ループ)
        for (const st of coolSteams) {
          const a = st.userData.anchor.userData.steamAnchor;
          const ph = (t * .1 + st.userData.ph) % 1;
          st.position.set(a.x - ph * 20, a.top + ph * 22, a.z);
          const sc = 8 + ph * 20;
          st.scale.set(sc, sc, 1);
          st.material.opacity = .3 * (1 - ph) * (ph > .05 ? 1 : ph / .05);
        }
        for (const smk of smokes) {
          const a = smk.userData.anchor.userData.smokeAnchor;
          const ph = (t * .12 + smk.userData.ph) % 1;
          smk.position.set(a.x - ph * 26, a.top + ph * 26, a.z);
          const sc = 6 + ph * 18;
          smk.scale.set(sc, sc, 1);
          smk.material.opacity = .34 * (1 - ph) * (ph > .04 ? 1 : ph / .04);
        }
        const p = spGeo.attributes.position.array;
        for (let i = 0; i < N_SP; i++) {
          p[i * 3] += (spVel[i * 2] - dx / dt * .9) * dt;
          p[i * 3 + 1] += spVel[i * 2 + 1] * dt;
          if (p[i * 3 + 1] > 14 || p[i * 3] < -260) {
            p[i * 3] = rand(-240, 260); p[i * 3 + 1] = rand(-16, -8);
          }
        }
        spGeo.attributes.position.needsUpdate = true;
        sunGlow.material.opacity = .34 + .08 * Math.sin(t * .7);
      }
    };
  }

  // ============================================================ STAGE 4
  // CYBER STORM — 電脳嵐。雲海、回路モノリス、雨、稲妻、データ流。
  function buildStorm() {
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0e3c36, 22, 310);
    const hemi = new THREE.HemisphereLight(0x3fae7e, 0x03140f, 1.0);
    scene.add(hemi);
    const flashLight = new THREE.DirectionalLight(0xd8ffe8, 0);
    flashLight.position.set(0, 200, -100);
    scene.add(flashLight);

    // 雲海: 大きなソフトスプライトを3層
    const cloudTex = softTex('#1e5c4e', 128, .18);
    const cloudLayers = [];
    for (const [z, y, n, sc, k] of [[-240, 60, 10, 130, .5], [-170, 34, 9, 95, .7], [-120, -14, 8, 70, .9]]) {
      const grp = new THREE.Group();
      const items = [];
      for (let i = 0; i < n; i++) {
        const c = sprite(cloudTex, 0x2a7a62, sc * rand(.7, 1.3), rand(.5, .8), THREE.NormalBlending);
        c.position.set(rand(-320, 320), y + rand(-14, 14), z + rand(-20, 20));
        grp.add(c);
        items.push({ obj: c, min: -340, span: 680, k, v: rand(-2, 2) });
      }
      scene.add(grp);
      cloudLayers.push(makeMovers(items));
    }

    // 回路トレースのモノリス群
    const circuitTex = makeTex(128, 256, (g, w, h) => {
      g.fillStyle = '#07231c'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#48e87a'; g.lineWidth = 2;
      for (let i = 0; i < 30; i++) {
        g.globalAlpha = rand(.25, .9);
        g.beginPath();
        let x = rand(0, w), y = h;
        g.moveTo(x, y);
        for (let s = 0; s < 4; s++) {
          if (Math.random() < .5) x += pick([-1, 1]) * rand(6, 20); else y -= rand(12, 40);
          g.lineTo(x, y);
        }
        g.stroke();
        g.fillStyle = pick(['#72ff68', '#31e8ff']);
        g.fillRect(x - 2, y - 2, 4, 4);
      }
      g.globalAlpha = 1;
    });
    const monoliths = [];
    const monoBelt = makeScroller(() => {
      const grp = new THREE.Group();
      for (let i = 0; i < 7; i++) {
        const h = rand(22, 52), w = rand(6, 12);
        // 回路トレースだけを emissiveMap で光らせる(均一発光だと只の板になる)
        const mat = lambert({ map: circuitTex, color: 0x4a8a72, emissive: 0xffffff, emissiveIntensity: .9, emissiveMap: circuitTex });
        const sideMat = lambert({ color: 0x0c3a2e });
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * .7), [sideMat, sideMat, sideMat, sideMat, mat, mat]);
        m.position.set(i * 78 + rand(-14, 14), rand(-10, 26), rand(-150, -85));
        m.userData.bob = rand(0, 6.28);
        m.userData.baseY = m.position.y;
        grp.add(m);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(w * .95, .35, 6, 20),
          basic({ color: 0x31e8ff, transparent: true, opacity: .55 }));
        ring.position.copy(m.position);
        ring.rotation.x = Math.PI / 2;
        // clone() は userData を JSON 複製するので Object3D 参照は持てない。
        // モノリスと同じ bob 位相を数値で共有して同期させる。
        ring.userData.spin = rand(.3, .9);
        ring.userData.bobSync = m.userData.bob;
        ring.userData.baseY = m.position.y;
        grp.add(ring);
      }
      return grp;
    }, 546);
    monoBelt.group.traverse(o => { if (o.userData && (o.userData.bob !== undefined || o.userData.spin)) monoliths.push(o); });
    scene.add(monoBelt.group);

    // サーバー背骨塔: スラブ積層 + LEDドット。モノリスの奥にもう一段の層を作る
    const ledTex = makeTex(64, 32, g => {
      g.fillStyle = '#04160f'; g.fillRect(0, 0, 64, 32);
      for (let y = 0; y < 4; y++) for (let x = 0; x < 12; x++) {
        if (Math.random() < .5) continue;
        g.fillStyle = pick(['#48e87a', '#31e8ff', '#0d6a3a']);
        g.fillRect(3 + x * 5, 4 + y * 7, 2.6, 2.6);
      }
    });
    const spineBelt = makeScroller(() => {
      const grp = new THREE.Group();
      const slabMat = lambert({ map: ledTex, color: 0x1a4a3a, emissive: 0xffffff, emissiveIntensity: .8, emissiveMap: ledTex });
      const darkMat = lambert({ color: 0x082a20 });
      for (let i = 0; i < 5; i++) {
        const x = i * 120 + rand(-18, 18), z = rand(-205, -175);
        const n = 5 + ((i * 3) % 3);
        for (let sY = 0; sY < n; sY++) {
          const slab = new THREE.Mesh(new THREE.BoxGeometry(11, 2.6, 9), [darkMat, darkMat, darkMat, darkMat, slabMat, slabMat]);
          slab.position.set(x, -6 + sY * 4.2, z);
          grp.add(slab);
        }
        const spTop = sprite(softTex('#72ff68'), 0x72ff68, 3, .8);
        spTop.position.set(x, -6 + n * 4.2 + 1, z);
        spTop.userData.blink = rand(0, 6.28);
        grp.add(spTop);
      }
      return grp;
    }, 600);
    scene.add(spineBelt.group);
    const spineBlinks = [];
    spineBelt.group.traverse(o => { if (o.userData && o.userData.blink !== undefined) spineBlinks.push(o); });

    // グリフの雨: 緑のカタカナ列が流れ落ちる薄いカーテン
    const glyphRainTex = makeTex(48, 512, g => {
      g.fillStyle = 'rgba(0,0,0,0)'; g.clearRect(0, 0, 48, 512);
      g.font = 'bold 26px "Hiragino Sans", monospace';
      g.textAlign = 'center';
      const glyphs = 'アイウエオカキクケコサシスセソタチツテト01';
      for (let i = 0; i < 17; i++) {
        const bright = i % 6 === 0;
        g.fillStyle = bright ? '#d8ffd4' : '#48e87a';
        g.globalAlpha = bright ? .95 : rand(.3, .7);
        g.fillText(glyphs[(Math.random() * glyphs.length) | 0], 24, 24 + i * 30);
      }
      g.globalAlpha = 1;
    });
    const glyphCols = [];
    for (let i = 0; i < 8; i++) {
      const tex = glyphRainTex.clone();
      tex.needsUpdate = true;
      tex.repeat.set(1, 1);
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(4, 46),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: .4, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
      pl.position.set(rand(-220, 220), rand(4, 40), rand(-140, -70));
      pl.userData = { v: rand(.14, .34), min: -240, span: 480 };
      scene.add(pl); glyphCols.push(pl);
    }

    // エネルギー導管: 光るパイプをパルスが駆け抜ける
    const conduit = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, 520, 6),
      basic({ color: 0x2fae7e, transparent: true, opacity: .5 }));
    conduit.rotation.z = Math.PI / 2;
    conduit.position.set(0, 14, -98);
    scene.add(conduit);
    const conduit2 = conduit.clone();
    conduit2.position.set(0, -8, -120);
    scene.add(conduit2);
    const pulses = [];
    for (let i = 0; i < 8; i++) {
      const pu = sprite(softTex('#d8ffd4'), 0xa8ffb8, 3.2, .95);
      const onTop = i % 2 === 0;
      pu.position.set(rand(-260, 260), onTop ? 14 : -8, onTop ? -98 : -120);
      pu.userData = { v: rand(35, 70) * (onTop ? 1 : -1), min: -260, span: 520 };
      scene.add(pu); pulses.push(pu);
    }

    // テスラアーク: モノリス帯の高さで短いアークが弾ける
    function makeArc() {
      const pts = [];
      let x = 0, y = 0;
      const len = rand(16, 30), steps = 7;
      for (let i = 0; i <= steps; i++) {
        pts.push(new THREE.Vector3(x + (len / steps) * i, y + (i === 0 || i === steps ? 0 : rand(-2.6, 2.6)), 0));
      }
      const arc = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0xd8faff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, fog: false }));
      arc.visible = false;
      arc.userData = { timer: rand(1, 4), life: 0 };
      scene.add(arc);
      return arc;
    }
    const arcs = [makeArc(), makeArc(), makeArc(), makeArc()];

    // 嵐の渦核: 遠景中枢で回り続ける同心リング
    const vortex = new THREE.Group();
    const vorMats = [];
    for (const [r, sp] of [[30, .5], [21, -.7], [13, 1.0]]) {
      const m = new THREE.MeshBasicMaterial({ color: 0x48e87a, transparent: true, opacity: .3, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 1, 6, 40), m);
      ring.userData.sp = sp;
      vortex.add(ring); vorMats.push(m);
    }
    const vorCore = sprite(softTex('#d8ffd4', 128, .2), 0x9affb0, 22, .5);
    vortex.add(vorCore);
    vortex.position.set(90, 52, -290);
    scene.add(vortex);

    // 雲内発光: フラッシュ時に雲の中がぼわっと光る
    const cloudFlashes = [];
    for (let i = 0; i < 3; i++) {
      const cf = sprite(softTex('#d8ffe8'), 0xbfffe0, 90, 0);
      cf.position.set(0, 50, -200);
      scene.add(cf); cloudFlashes.push(cf);
    }

    // 雨: 斜めの短いラインを大量に
    const N_RAIN = 340;
    const rainPos = new Float32Array(N_RAIN * 6);
    for (let i = 0; i < N_RAIN; i++) {
      const x = rand(-200, 200), y = rand(-40, 90), z = rand(-160, -25);
      rainPos[i * 6] = x; rainPos[i * 6 + 1] = y; rainPos[i * 6 + 2] = z;
      rainPos[i * 6 + 3] = x + 1.2; rainPos[i * 6 + 4] = y - 3.4; rainPos[i * 6 + 5] = z;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0x9adfd0, transparent: true, opacity: .32, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    scene.add(rain);

    // データ流: 水平に飛ぶ発光粒
    const N_DATA = 90;
    const dataPos = new Float32Array(N_DATA * 3);
    const dataVel = new Float32Array(N_DATA);
    for (let i = 0; i < N_DATA; i++) {
      dataPos[i * 3] = rand(-220, 220); dataPos[i * 3 + 1] = rand(-12, 50); dataPos[i * 3 + 2] = rand(-140, -60);
      dataVel[i] = rand(12, 36) * pick([-1, 1]);
    }
    const dataGeo = new THREE.BufferGeometry();
    dataGeo.setAttribute('position', new THREE.BufferAttribute(dataPos, 3));
    const dataPts = new THREE.Points(dataGeo, new THREE.PointsMaterial({ color: 0x72ff68, size: 2.6, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: false }));
    scene.add(dataPts);

    // 稲妻: ジグザグの折れ線。フラッシュと同時に0.12秒だけ見せる
    function makeBolt() {
      const pts = [];
      let x = 0, y = 95;
      pts.push(new THREE.Vector3(x, y, 0));
      while (y > -20) {
        x += rand(-9, 9); y -= rand(8, 20);
        pts.push(new THREE.Vector3(x, y, 0));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const bolt = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xeaffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, fog: false }));
      bolt.visible = false;
      return bolt;
    }
    const bolts = [makeBolt(), makeBolt()];
    for (const b of bolts) scene.add(b);
    let flashT = 0, nextFlash = rand(2, 5);

    let t = 0;
    return {
      scene,
      update(dt, s) {
        t += dt;
        const dx = SCROLL * (s.speed || 1) * dt;
        monoBelt.update(dx);
        spineBelt.update(dx * .8);
        for (const l of cloudLayers) l.update(dx, dt);
        for (const b of spineBlinks) b.material.opacity = .3 + .6 * Math.max(0, Math.sin(t * 2.2 + b.userData.blink));
        for (const gc of glyphCols) {
          gc.material.map.offset.y += gc.userData.v * dt;
          gc.position.x -= dx * .8;
          if (gc.position.x < gc.userData.min) gc.position.x += gc.userData.span;
        }
        for (const pu of pulses) {
          pu.position.x += pu.userData.v * dt - dx * .7;
          if (pu.position.x < pu.userData.min) pu.position.x += pu.userData.span;
          else if (pu.position.x > pu.userData.min + pu.userData.span) pu.position.x -= pu.userData.span;
        }
        for (const arc of arcs) {
          arc.userData.timer -= dt * (1 + (s.energy || 0));
          if (arc.userData.timer <= 0 && !arc.visible) {
            arc.visible = true; arc.userData.life = .16;
            arc.position.set(rand(-180, 180), rand(-6, 30), rand(-140, -90));
          }
          if (arc.visible) {
            arc.userData.life -= dt;
            arc.material.opacity = Math.max(0, arc.userData.life / .16);
            if (arc.userData.life <= 0) { arc.visible = false; arc.userData.timer = rand(1.5, 4.5); }
          }
        }
        for (const ring of vortex.children) if (ring.userData && ring.userData.sp) ring.rotation.z = t * ring.userData.sp;
        vorCore.material.opacity = .4 + .18 * Math.sin(t * 1.7);
        for (const o of monoliths) {
          if (o.userData.spin) {
            o.rotation.z += o.userData.spin * dt;
            o.position.y = o.userData.baseY + Math.sin(t * .7 + o.userData.bobSync) * 2.2;
          } else if (o.userData.bob !== undefined) {
            o.position.y = o.userData.baseY + Math.sin(t * .7 + o.userData.bob) * 2.2;
          }
        }
        const rp = rainGeo.attributes.position.array;
        for (let i = 0; i < N_RAIN; i++) {
          let x = rp[i * 6] - (60 * dt + dx * .8), y = rp[i * 6 + 1] - 90 * dt;
          if (y < -45) { y = rand(60, 95); x = rand(-200, 240); }
          if (x < -220) x += 440;
          rp[i * 6] = x; rp[i * 6 + 1] = y;
          rp[i * 6 + 3] = x + 1.2; rp[i * 6 + 4] = y - 3.4;
        }
        rainGeo.attributes.position.needsUpdate = true;
        const dp = dataGeo.attributes.position.array;
        for (let i = 0; i < N_DATA; i++) {
          dp[i * 3] += dataVel[i] * dt - dx * .6;
          if (dp[i * 3] < -240) dp[i * 3] += 480;
          if (dp[i * 3] > 240) dp[i * 3] -= 480;
        }
        dataGeo.attributes.position.needsUpdate = true;
        // 稲妻: energy が高いほど頻発。warning 中はほぼ連続
        flashT -= dt;
        nextFlash -= dt * (1 + (s.energy || 0) * 2 + (s.warning ? 4 : 0));
        if (nextFlash <= 0) {
          nextFlash = rand(2.2, 6);
          flashT = .14;
          const b = pick(bolts);
          b.position.set(rand(-170, 170), 0, rand(-190, -110));
          b.visible = true;
          b.material.opacity = 1;
          // 落雷点の上の雲をぼわっと光らせる
          for (const cf of cloudFlashes) cf.position.set(b.position.x + rand(-40, 40), rand(38, 62), b.position.z - rand(0, 40));
        }
        const f = Math.max(0, flashT / .14);
        flashLight.intensity = f * 2.6;
        hemi.intensity = 1.0 + f * .8;
        for (const cf of cloudFlashes) cf.material.opacity = f * .55;
        for (const b of bolts) {
          if (!b.visible) continue;
          b.material.opacity = f;
          if (f <= 0) b.visible = false;
        }
      }
    };
  }

  // ============================================================ STAGE 5
  // HEART PALACE — ハートの女王の宮殿。市松床、列柱、ハート窓、シャンデリア。
  function buildPalace() {
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x5c1242, 28, 330);
    scene.add(new THREE.HemisphereLight(0xff9ecf, 0x2a0620, 1.15));
    const warm = new THREE.DirectionalLight(0xffd9a0, .8);
    warm.position.set(-60, 140, -80);
    scene.add(warm);

    // 市松の大理石床(マゼンタ×深紫)
    const checkerTex = makeTex(128, 128, (g, w, h) => {
      for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
        g.fillStyle = (x + y) % 2 ? '#3a0a2e' : '#8e2360';
        g.fillRect(x * w / 2, y * h / 2, w / 2, h / 2);
      }
      g.strokeStyle = 'rgba(255,220,240,.25)'; g.lineWidth = 2;
      g.strokeRect(0, 0, w, h);
    }, { repX: 46, repY: 18 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(1500, 560), lambert({ map: checkerTex, color: 0xffc0dc }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -17, -280);
    scene.add(floor);

    // ハート窓の壁(奥): 発光ハートをテクスチャで
    const heartWallTex = makeTex(256, 256, (g, w, h) => {
      g.fillStyle = '#42102f'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#2e0a22';
      for (let i = 0; i < 6; i++) g.fillRect(i * 44, 0, 3, h);
      const heart = (cx, cy, r, col, glow) => {
        g.save();
        g.translate(cx, cy);
        if (glow) { g.shadowColor = col; g.shadowBlur = 18; }
        g.fillStyle = col;
        g.beginPath();
        g.moveTo(0, r * .35);
        g.bezierCurveTo(-r, -r * .55, -r * .5, -r * 1.2, 0, -r * .45);
        g.bezierCurveTo(r * .5, -r * 1.2, r, -r * .55, 0, r * .35);
        g.fill();
        g.restore();
      };
      heart(64, 100, 34, '#ff3e9d', true);
      heart(192, 100, 34, '#ffd06a', true);
      heart(128, 200, 22, '#ff7ab8', true);
    }, { repX: 12, repY: 1 });
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(1300, 130),
      lambert({ map: heartWallTex, color: 0xffb8d8, emissive: 0xffffff, emissiveIntensity: .75, emissiveMap: heartWallTex }));
    wall.position.set(0, 38, -200);
    scene.add(wall);

    // 格天井: 金の格子が走る深紅の天井が頭上を覆う(大広間の屋内感)
    const cofferTex = makeTex(64, 64, g => {
      g.fillStyle = '#4a0e30'; g.fillRect(0, 0, 64, 64);
      g.strokeStyle = '#c89a4a'; g.lineWidth = 3;
      g.strokeRect(2, 2, 60, 60);
      g.fillStyle = '#5c1240'; g.fillRect(10, 10, 44, 44);
      g.fillStyle = '#e0b060'; g.beginPath(); g.arc(32, 32, 3.4, 0, 6.3); g.fill();
    }, { repX: 44, repY: 8 });
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(1500, 260), lambert({ map: cofferTex, color: 0xffc0dc }));
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, 46, -150);
    scene.add(ceiling);

    // レッドカーペット: 金縁の緋毯が列柱に沿って走る
    const carpetTex = makeTex(64, 32, g => {
      g.fillStyle = '#a01838'; g.fillRect(0, 0, 64, 32);
      g.fillStyle = '#e0b060'; g.fillRect(0, 0, 64, 4); g.fillRect(0, 28, 64, 4);
      g.fillStyle = '#c02048';
      for (let i = 0; i < 4; i++) g.fillRect(i * 16 + 6, 12, 6, 8);
    }, { repX: 40, repY: 1 });
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(1500, 16), lambert({ map: carpetTex, color: 0xffd0dc }));
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.set(0, -16.85, -56);
    scene.add(carpet);

    // 垂れ幕: 天井からハート紋章の旗がゆっくり揺れる
    const bannerTex = makeTex(64, 128, g => {
      g.fillStyle = '#8e1240'; g.fillRect(0, 0, 64, 128);
      g.fillStyle = '#c89a4a'; g.fillRect(0, 0, 64, 8); g.fillRect(0, 108, 64, 4);
      for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(i * 8, 112); g.lineTo(i * 8 + 4, 126); g.lineTo(i * 8 + 8, 112); g.fill(); }
      g.translate(32, 56); g.fillStyle = '#ffd06a';
      g.beginPath();
      g.moveTo(0, 14); g.bezierCurveTo(-24, -10, -12, -28, 0, -12); g.bezierCurveTo(12, -28, 24, -10, 0, 14);
      g.fill();
    });
    const banBelt = makeScroller(() => {
      const grp = new THREE.Group();
      for (let i = 0; i < 5; i++) {
        const ban = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 17),
          lambert({ map: bannerTex, side: THREE.DoubleSide, emissive: 0x441028, emissiveIntensity: .4 }));
        ban.geometry = ban.geometry.clone();
        ban.geometry.translate(0, -8.5, 0);      // 天井側を支点に揺らす
        ban.position.set(i * 78 + rand(-8, 8), 44, -105);
        ban.userData.sway = rand(0, 6.28);
        grp.add(ban);
      }
      return grp;
    }, 390);
    const banners = [];
    banBelt.group.traverse(o => { if (o.userData && o.userData.sway !== undefined) banners.push(o); });
    scene.add(banBelt.group);

    // 薔薇の生垣: 発光する薔薇の茂みが床沿いに続く
    const roseBelt = makeScroller(() => {
      const grp = new THREE.Group();
      const leafMat = lambert({ color: 0x1e4a2e });
      const roseCols = [0xff3e6a, 0xff7ab8, 0xffd06a];
      for (let i = 0; i < 9; i++) {
        const x = i * 52 + rand(-6, 6);
        const bush = new THREE.Mesh(new THREE.SphereGeometry(3, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), leafMat);
        bush.scale.set(1.4, .8, 1);
        bush.position.set(x, -17, -46);
        grp.add(bush);
        for (let r = 0; r < 7; r++) {
          const c = pick(roseCols);
          const rose = new THREE.Mesh(new THREE.SphereGeometry(.55, 6, 5),
            lambert({ color: c, emissive: c, emissiveIntensity: .5 }));
          rose.position.set(x + rand(-3.6, 3.6), -17 + rand(.8, 2.6), -46 + rand(-1, 1.6));
          grp.add(rose);
        }
      }
      return grp;
    }, 470);
    scene.add(roseBelt.group);

    // ハート水晶像: 大理石台座の上で金の八面体がゆっくり回る
    const crysBelt = makeScroller(() => {
      const grp = new THREE.Group();
      const marble = lambert({ color: 0xffdae8 });
      const goldc = lambert({ color: 0xffd06a, emissive: 0xaa7720, emissiveIntensity: .6 });
      for (let i = 0; i < 4; i++) {
        const x = i * 115 + rand(-10, 10);
        const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.4, 6, 8), marble);
        ped.position.set(x, -14, -64);
        grp.add(ped);
        const crys = new THREE.Mesh(new THREE.OctahedronGeometry(2.2), goldc);
        crys.position.set(x, -8.2, -64);
        crys.userData.spinY = rand(.4, .8);
        grp.add(crys);
        const cg = sprite(softTex('#ffe9b8'), 0xffd06a, 8, .35);
        cg.position.copy(crys.position);
        grp.add(cg);
      }
      return grp;
    }, 460);
    const crystals = [];
    crysBelt.group.traverse(o => { if (o.userData && o.userData.spinY) crystals.push(o); });
    scene.add(crysBelt.group);

    // ステンドグラス窓: 色ガラスのアーチ窓が奥の回廊に光る
    const glassTex = makeTex(96, 192, g => {
      g.fillStyle = '#2a0820'; g.fillRect(0, 0, 96, 192);
      const cols = ['#ff5a8c', '#ffd06a', '#7ab8ff', '#ff9ecf', '#b08aff'];
      g.save();
      g.beginPath();
      g.moveTo(10, 190); g.lineTo(10, 60); g.quadraticCurveTo(48, 4, 86, 60); g.lineTo(86, 190); g.closePath();
      g.clip();
      for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) {
        g.fillStyle = cols[(x + y * 3) % cols.length];
        g.globalAlpha = rand(.6, 1);
        g.fillRect(10 + x * 19, 12 + y * 23, 19, 23);
      }
      g.globalAlpha = 1;
      g.restore();
      g.strokeStyle = '#1a0512'; g.lineWidth = 4;
      g.beginPath();
      g.moveTo(10, 190); g.lineTo(10, 60); g.quadraticCurveTo(48, 4, 86, 60); g.lineTo(86, 190); g.stroke();
    });
    const glassBelt = makeScroller(() => {
      const grp = new THREE.Group();
      for (let i = 0; i < 6; i++) {
        const pane = new THREE.Mesh(new THREE.PlaneGeometry(11, 22),
          lambert({ map: glassTex, color: 0xffc0dc, emissive: 0xffffff, emissiveIntensity: .8, emissiveMap: glassTex }));
        pane.position.set(i * 88 + rand(-6, 6), 12, -135);
        grp.add(pane);
        const shaft = sprite(softTex('#ffb8d8'), 0xff9ecf, 20, .16);
        shaft.position.set(pane.position.x, 2, -128);
        grp.add(shaft);
      }
      return grp;
    }, 530);
    scene.add(glassBelt.group);

    // 漂う蝋燭の火(ハリポタの大広間ふうに宙に浮く)
    const candles = [];
    for (let i = 0; i < 10; i++) {
      const cd = new THREE.Group();
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(.22, .26, 1.6, 5), lambert({ color: 0xfff4e0 }));
      cd.add(stick);
      const fl = sprite(softTex('#ffe9b8', 64, .3), 0xffd98a, 1.8, .95);
      fl.position.y = 1.3; cd.add(fl);
      cd.position.set(rand(-220, 220), rand(6, 34), rand(-95, -50));
      cd.userData = { ph: rand(0, 6.28), min: -240, span: 480, fl };
      scene.add(cd); candles.push(cd);
    }

    // 列柱: 白薔薇色の円柱 + 金の柱頭
    const colBelt = makeScroller(() => {
      const grp = new THREE.Group();
      const marble = lambert({ color: 0xffdae8 });
      const gold = lambert({ color: 0xffd06a, emissive: 0x664410, emissiveIntensity: .5 });
      for (let i = 0; i < 8; i++) {
        const x = i * 46;
        const col = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 52, 10), marble);
        col.position.set(x, 9, -78);
        grp.add(col);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(6.4, 2, 6.4), gold);
        cap.position.set(x, 35.6, -78); grp.add(cap);
        const base = new THREE.Mesh(new THREE.BoxGeometry(6.8, 2.4, 6.8), gold);
        base.position.set(x, -16.5, -78); grp.add(base);
        const lamp = sprite(softTex('#ffd9ec'), 0xff9ecf, 8, .4);
        lamp.position.set(x, 20, -75);
        grp.add(lamp);
      }
      return grp;
    }, 368);
    scene.add(colBelt.group);

    // シャンデリア: 金のリング + 蝋燭の光点。ゆっくり揺れる
    const chandeliers = [];
    const chBelt = makeScroller(() => {
      const grp = new THREE.Group();
      const gold = lambert({ color: 0xffce6a, emissive: 0x7a5510, emissiveIntensity: .6 });
      for (let i = 0; i < 3; i++) {
        const ch = new THREE.Group();
        const ring = new THREE.Mesh(new THREE.TorusGeometry(5, .5, 6, 18), gold);
        ring.rotation.x = Math.PI / 2;
        ch.add(ring);
        const ring2 = new THREE.Mesh(new THREE.TorusGeometry(3, .4, 6, 14), gold);
        ring2.rotation.x = Math.PI / 2;
        ring2.position.y = 3;
        ch.add(ring2);
        for (let j = 0; j < 8; j++) {
          const a = j / 8 * Math.PI * 2;
          const candle = sprite(softTex('#ffe9b8'), 0xffe9b8, 3.2, .9);
          candle.position.set(Math.cos(a) * 5, 1.1, Math.sin(a) * 5);
          ch.add(candle);
        }
        const chain = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, 20, 4), gold);
        chain.position.y = 13;
        ch.add(chain);
        ch.position.set(i * 110 + 40, 26, -60);
        ch.userData.sway = rand(0, 6.28);
        grp.add(ch);
      }
      return grp;
    }, 330);
    chBelt.group.traverse(o => { if (o.userData && o.userData.sway !== undefined) chandeliers.push(o); });
    scene.add(chBelt.group);

    // 遠景の宮殿塔: 円錐屋根 + ハートの頂飾
    const heartTex = makeTex(64, 64, g => {
      g.translate(32, 34);
      g.fillStyle = '#ff3e9d';
      g.shadowColor = '#ff3e9d'; g.shadowBlur = 10;
      g.beginPath();
      g.moveTo(0, 12);
      g.bezierCurveTo(-26, -12, -13, -30, 0, -12);
      g.bezierCurveTo(13, -30, 26, -12, 0, 12);
      g.fill();
    });
    const towersBelt = makeScroller(() => {
      const grp = new THREE.Group();
      const wallM = lambert({ color: 0x8e2360 });
      const roofM = lambert({ color: 0xd4326e });
      for (let i = 0; i < 5; i++) {
        const x = i * 130 + rand(-16, 16), z = rand(-215, -185);
        const h = rand(50, 95), r = rand(9, 15);
        const body = new THREE.Mesh(new THREE.CylinderGeometry(r * .82, r, h, 8), wallM);
        body.position.set(x, -17 + h / 2, z);
        grp.add(body);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(r * 1.05, r * 1.9, 8), roofM);
        roof.position.set(x, -17 + h + r * .93, z);
        grp.add(roof);
        const fin = sprite(heartTex, 0xffffff, 9, .95);
        fin.position.set(x, -17 + h + r * 1.9 + 4, z);
        fin.userData.pulse = rand(0, 6.28);
        grp.add(fin);
      }
      return grp;
    }, 650);
    scene.add(towersBelt.group);

    // 漂う光珠
    const orbs = [];
    for (let i = 0; i < 10; i++) {
      const orb = sprite(softTex('#ffd9ec'), pick([0xff9ecf, 0xffd06a, 0xff5aa8]), rand(2.4, 4.6), .7);
      orb.position.set(rand(-200, 200), rand(-8, 40), rand(-120, -50));
      orb.userData = { ph: rand(0, 6.28), min: -220, span: 440 };
      scene.add(orb); orbs.push(orb);
    }

    const pulses = [];
    towersBelt.group.traverse(o => { if (o.userData && o.userData.pulse !== undefined) pulses.push(o); });

    let t = 0;
    return {
      scene,
      update(dt, s) {
        t += dt;
        const dx = SCROLL * (s.speed || 1) * dt;
        colBelt.update(dx); chBelt.update(dx); towersBelt.update(dx * .85);
        banBelt.update(dx * .9); roseBelt.update(dx); crysBelt.update(dx); glassBelt.update(dx * .9);
        heartWallTex.offset.x += dx * (12 / 1300);
        checkerTex.offset.x += dx * (46 / 1500);  // 列柱と同じ世界速度
        cofferTex.offset.x += dx * (44 / 1500);   // 天井も同じ世界速度
        carpetTex.offset.x += dx * (40 / 1500);
        for (const ch of chandeliers) ch.rotation.z = Math.sin(t * .8 + ch.userData.sway) * .07;
        for (const ban of banners) ban.rotation.z = Math.sin(t * .7 + ban.userData.sway) * .06;
        for (const cr of crystals) cr.rotation.y = t * cr.userData.spinY;
        for (const cd of candles) {
          cd.position.x -= dx * .8;
          if (cd.position.x < cd.userData.min) cd.position.x += cd.userData.span;
          cd.position.y += Math.sin(t * .8 + cd.userData.ph) * dt * 1.4;
          cd.userData.fl.material.opacity = .75 + .25 * Math.sin(t * 7 + cd.userData.ph);
        }
        for (const f of pulses) {
          const sc = 9 * (1 + .12 * Math.sin(t * 2.2 + f.userData.pulse));
          f.scale.set(sc, sc, 1);
        }
        for (const orb of orbs) {
          orb.position.x -= dx * .7;
          orb.position.y += Math.sin(t * .9 + orb.userData.ph) * dt * 2.2;
          if (orb.position.x < orb.userData.min) orb.position.x += orb.userData.span;
          orb.material.opacity = .5 + .25 * Math.sin(t * 1.4 + orb.userData.ph);
        }
        // ボス戦(玉座前)は照明を落として赤みを強く
        const bossT = s.boss ? 1 : 0;
        scene.fog.color.setHex(bossT ? 0x4a0a30 : 0x5c1242);
      }
    };
  }

  // ---------------------------------------------------------------- render
  let last = performance.now() / 1000;
  api.render = function (s) {
    if (!api.ready) return false;
    const entry = getEntry(Math.max(0, Math.min(4, s.stage | 0)));
    if (!entry || !entry.scene) return false;
    const now = performance.now() / 1000;
    const dt = Math.min(.1, Math.max(.001, now - last));
    last = now;
    if (s.quality !== undefined) api.setQuality(s.quality === 0 ? 1 : 2);
    // 2D側のパララックス(bgCamX ±16px / bgCam)をカメラの微小オフセットへ
    camera.position.x = -(s.camX || 0) * .05;
    camera.position.y = -(s.camY || 0) * .03;
    camera.rotation.x = CAM_PITCH - (s.camY || 0) * .00035;
    camera.rotation.y = (s.camX || 0) * .0006;
    try {
      entry.update(dt, s);
      renderer.render(entry.scene, camera);
    } catch (e) {
      console.warn('bg3d render failed', e);
      api.ready = false;
      return false;
    }
    return true;
  };

  api.ready = true;
})();

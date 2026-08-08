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
  // version は「今ブラウザが実際に読んでいる bg3d.js」を確認するための目印。
  // ローカルは Cache-Control が無く古い版が残りやすいので、修正のたびに更新する。
  // indoor: S3のボス戦で座敷の内部に入った度合い(0..1)。game.js はこれを見て
  // 2Dの工場ストリート(炉列・コンベア・溶鉄)の描画を止める。
  const api = { version: 'forge-storm-3', ready: false, canvas: null, indoor: 0, render: () => false, setQuality: () => {} };
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

  // 0 = 平穏, 1 = ボス本戦。warning / energy でも途中まで上がる。
  // 各ステージの update で fog・ライト・名物の露出を揃える入口。
  function moodT(s) {
    let m = 0;
    if (s.warning) m = Math.max(m, .55);
    if (s.boss) m = Math.max(m, 1);
    m = Math.max(m, Math.min(1, (s.energy || 0) * .35));
    return m;
  }
  // fog 色を hex 同士で混ぜる(毎フレーム new Color を避けるためキャッシュを fog にぶら下げる)
  // THREE.Fog には userData が無いので素のプロパティで持つ。
  function mixFog(fog, calmHex, tenseHex, t, farCalm, farTense) {
    const k = Math.max(0, Math.min(1, t));
    if (!fog._moodC0) {
      fog._moodC0 = new THREE.Color(calmHex);
      fog._moodC1 = new THREE.Color(tenseHex);
      fog._moodTmp = new THREE.Color();
    } else {
      fog._moodC0.setHex(calmHex);
      fog._moodC1.setHex(tenseHex);
    }
    fog._moodTmp.copy(fog._moodC0).lerp(fog._moodC1, k);
    fog.color.copy(fog._moodTmp);
    if (farCalm !== undefined) fog.far = farCalm + (farTense - farCalm) * k;
  }
  // スプライト opacity の呼吸(点滅灯・ビーコン共用)
  function breath(t, ph, lo = .35, hi = 1, rate = 2.2) {
    return lo + (hi - lo) * Math.max(0, Math.sin(t * rate + ph));
  }

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
    // --- S5(HEART PALACE)専用の装飾テクスチャ。加算レイヤーの契約どおり
    // 「透明地に明るい形」で描き、色は put() のインスタンスカラーで着ける。
    const heartGlowTex = makeTex(64, 64, g => {
      g.translate(32, 36);
      g.shadowColor = 'rgba(255,255,255,.9)'; g.shadowBlur = 12;
      g.fillStyle = 'rgba(255,255,255,.95)';
      g.beginPath();
      g.moveTo(0, 14);
      g.bezierCurveTo(-24, -10, -12, -28, 0, -10);
      g.bezierCurveTo(12, -28, 24, -10, 0, 14);
      g.fill();
    });
    const star4Tex = makeTex(64, 64, g => {
      g.translate(32, 32);
      const arm = (len, wid) => {
        g.beginPath();
        g.moveTo(0, -len); g.lineTo(wid, 0); g.lineTo(0, len); g.lineTo(-wid, 0);
        g.closePath(); g.fill();
      };
      g.shadowColor = 'rgba(255,255,255,.8)'; g.shadowBlur = 8;
      g.fillStyle = 'rgba(255,255,255,.95)';
      arm(28, 4.5);
      g.rotate(Math.PI / 2); arm(28, 4.5);
      g.rotate(Math.PI / 4); g.fillStyle = 'rgba(255,255,255,.5)'; arm(16, 3);
      g.rotate(Math.PI / 2); arm(16, 3);
      g.rotate(-Math.PI * 5 / 4);
      g.beginPath(); g.arc(0, 0, 5, 0, 6.3); g.fill();
    });
    const cardTex = makeTex(48, 64, g => {
      g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 4;
      g.beginPath(); g.roundRect(4, 4, 40, 56, 6); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.25)';
      g.beginPath(); g.roundRect(4, 4, 40, 56, 6); g.fill();
      g.translate(24, 34);
      g.fillStyle = 'rgba(255,255,255,.95)';
      g.beginPath();
      g.moveTo(0, 9);
      g.bezierCurveTo(-15, -6, -8, -18, 0, -6);
      g.bezierCurveTo(8, -18, 15, -6, 0, 9);
      g.fill();
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
      heartP: inst(plane, { map: heartGlowTex, ...add }, 90, 3),  // S5: 舞うハート
      sparkle: inst(plane, { map: star4Tex, ...add }, 90, 4),     // S5: 四芒のきらめき
      cardP: inst(plane, { map: cardTex, ...add }, 48, 3),        // S5: 回るトランプ
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
      nBall = 0, nFxRing = 0, nFxShard = 0, nSpark = 0,
      nHeart = 0, nSparkle = 0, nCard = 0;
    const hull = A.HULL_COL[st];
    const palace = st === 4;                   // 最終ステージは王宮の装飾を足す

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
        // ボス: 巨体を包むエネルギーの三重環 + 軌道を回る光球(ステージ色)
        // 属性アクセント: aqua=泡 / factory=炎 / storm=雷 / palace=ハート金
        const accent = [0xff3e9d, 0x65fff2, 0xffe15a, 0x72ff68, 0xffd06a][st] || A.GLOW_COL[st];
        const R = Math.max(w, h) * 1.4;
        const mid = e.type === 'midboss';
        A.put(P.aura, nAura++, cx, cy, R, R * .62, 1, 0, 0, t * .5, A.GLOW_COL[st], .8);
        A.put(P.aura, nAura++, cx, cy, R * .78, R * .52, 1, 0, 0, -t * .7, accent, .55);
        if (!mid && nAura < 38) {
          A.put(P.aura, nAura++, cx, cy, R * 1.18, R * .72, 1, 0, 0, t * .25, accent, .35);
        }
        const nOrb = mid ? 5 : 7;
        for (let o = 0; o < nOrb; o++) {
          const a = t * 1.1 + o * (Math.PI * 2 / nOrb);
          const rOrb = R * (.42 + (o % 2) * .12);
          A.put(P.halo, nHalo++, cx + Math.cos(a) * rOrb, cy + Math.sin(a) * rOrb * .45,
            mid ? 28 : 34, mid ? 28 : 34, 1, 0, 0, 0, o % 2 ? accent : A.GLOW_COL[st]);
        }
        if (palace) {
          // 女王: 逆回転で巡るハートの環(鼓動で膨らむ) + 頭上の王冠のきらめき
          const nH = mid ? 4 : 6;
          for (let o = 0; o < nH && nHeart < 88; o++) {
            const a = -t * 1.5 + o * (Math.PI * 2 / nH);
            const beat = 1 + .25 * Math.max(0, Math.sin(t * 4.6 + o));
            A.put(P.heartP, nHeart++, cx + Math.cos(a) * R * .58, cy + Math.sin(a) * R * .3,
              (mid ? 20 : 30) * beat, (mid ? 20 : 30) * beat, 1,
              0, 0, Math.sin(a) * .35, o % 2 ? 0xffd06a : 0xff5aa8, .9);
          }
          for (let o = 0; o < 3 && nSparkle < 88; o++) {
            const tw = Math.max(0, Math.sin(t * 3.4 + o * 2.4));
            A.put(P.sparkle, nSparkle++, cx + (o - 1) * w * .26, e.y - 8 - (o % 2) * 14,
              14 + 22 * tw, 14 + 22 * tw, 1, 0, 0, t * (o % 2 ? 1.4 : -1.1), 0xffe9b8, tw);
          }
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
        if (palace) {
          // 王宮の雑魚は1体ずつ「持ち物」が光る。位相は baseY 由来で個体ごとに固定
          const ph = (e.baseY || cy) * .11 + w;
          if (e.type === 'cupid') {
            // 頭上の金の光輪 + 周回するハート3つ + 羽ばたきのきらめき
            A.put(P.ring, nRing++, cx, cy - h * .62, w * .17, w * .17, w * .17,
              1.4, 0, t * 1.2 + ph, 0xffd06a);
            for (let k = 0; k < 3 && nHeart < 88; k++) {
              const a = t * 2.3 + ph + k * 2.094;
              A.put(P.heartP, nHeart++, cx + Math.cos(a) * w * .66, cy + Math.sin(a) * h * .4,
                15, 15, 1, 0, 0, Math.sin(a + t) * .4, 0xff9ecf, .45 + .45 * Math.sin(a * 2));
            }
            const tw = Math.max(0, Math.sin(t * 5.2 + ph));
            A.put(P.sparkle, nSparkle++, cx + dir * w * .34, cy - h * .3,
              10 + 14 * tw, 10 + 14 * tw, 1, 0, 0, t * 2, 0xffe9b8, tw * .9);
          } else if (e.type === 'knight') {
            // ランス先端の閃光(進行方向へ) + 金の光条 + 盾側の守護環
            const lanceX = cx - dir * w * .72, lanceY = cy + h * .08;
            const tw = .5 + .5 * Math.sin(t * 6.5 + ph);
            A.put(P.sparkle, nSparkle++, lanceX, lanceY, 16 + 20 * tw, 16 + 20 * tw, 1,
              0, 0, t * 3 + ph, 0xfff2c8, .6 + .4 * tw);
            A.put(P.trail, nTrail++, cx - dir * w * .3, lanceY, w * .95, 7, 1,
              0, 0, dir < 0 ? 0 : Math.PI, 0xffd06a, .55 + .3 * tw);
            A.put(P.aura, nAura++, cx + dir * w * .18, cy, w * .78, w * .78, 1,
              0, 0, t * 1.3 + ph, 0xffd06a, .4);
          } else if (e.type === 'rosebud') {
            // 螺旋で舞う花びら4枚 + 蕾の根元の生命光
            for (let k = 0; k < 4 && nHeart < 88; k++) {
              const a = t * 1.7 + ph + k * 1.571;
              const r = w * (.5 + .22 * Math.sin(t * .9 + k * 1.3 + ph));
              A.put(P.heartP, nHeart++, cx + Math.cos(a) * r, cy + Math.sin(a) * r * .72,
                11, 11, 1, 0, 0, a + t, k % 2 ? 0xff7ab8 : 0xffd06a, .75);
            }
            A.put(P.halo, nHalo++, cx, cy + h * .42, w * .55, w * .35, 1, 0, 0, 0, 0x66d878, .5);
          } else if (e.type === 'cardguard') {
            // 肩まわりを回るトランプ3枚(表裏が返りながら)
            for (let k = 0; k < 3 && nCard < 46; k++) {
              const a = t * 1.9 + ph + k * 2.094;
              A.put(P.cardP, nCard++, cx + Math.cos(a) * w * .72, cy - h * .18 + Math.sin(a) * h * .2,
                17, 24, 1, .12 * Math.sin(a), a * 2, .18 * Math.sin(t + k), 0xffe9b8,
                .55 + .4 * Math.sin(a));
            }
          } else if (e.type === 'teacup') {
            // 立ちのぼる湯気(揺れながら薄れる) + 縁の照りのきらめき
            for (let k = 0; k < 3; k++) {
              const p = (t * .42 + k * .33 + ph * .05) % 1;
              A.put(P.halo, nHalo++, cx + Math.sin((p * 5 + k * 2) * 1.9 + ph) * 9,
                cy - h * .55 - p * 40, 9 + p * 26, 9 + p * 26, 1, 0, 0, 0,
                0xfff0f6, (1 - p) * .38);
            }
            const tw = Math.max(0, Math.sin(t * 4.4 + ph));
            A.put(P.sparkle, nSparkle++, cx - dir * w * .3, cy - h * .18,
              9 + 13 * tw, 9 + 13 * tw, 1, 0, 0, t * 1.8, 0xffe9b8, tw * .85);
          }
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
        // 火球: 一気に膨らんでから萎む(ステージ accent を破片色に混ぜる)
        const g = Math.sin(Math.min(1, p * 1.6) * Math.PI * .5);
        const fb = 210 * sz * g * (1 - p * .35);
        A.put(P.fxBall, nBall++, e.x, e.y, fb, fb, 1, 0, 0, e.t, p < .3 ? 0xffffff : e.color, ease);
        // 二重の衝撃波(外に走る爆風と、内側で潰れる白いコア)
        const d1 = 40 + p * 420 * sz, d2 = 24 + p * 260 * sz;
        A.put(P.fxRing, nFxRing++, e.x, e.y, d1, d1 * .78, 1, 0, 0, e.t * 1.4, e.color, ease);
        A.put(P.fxRing, nFxRing++, e.x, e.y, d2, d2 * .92, 1, 0, 0, -e.t * 2, 0xffffff, ease * ease);
        // 第三リング: アクセント色(爆発がステージ色を帯びる)
        if (nFxRing < 88) {
          const d3 = 18 + p * 180 * sz;
          A.put(P.fxRing, nFxRing++, e.x, e.y, d3, d3 * .85, 1, 0, 0, e.t * 2.2, hull, ease * .7);
        }
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
    A.flush(P.heartP, nHeart); A.flush(P.sparkle, nSparkle); A.flush(P.cardP, nCard);
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

    // 車: 白(こちら向き)と赤(去り)のヘッドライト連 + 車体差(タクシー黄/トラック水色)
    const carMovers = [];
    const carGroup = new THREE.Group();
    for (let i = 0; i < 26; i++) {
      const toward = i % 2 === 0;
      const kind = i % 5;                          // 0-2 普通 / 3 タクシー / 4 トラック
      const speed = toward
        ? (kind === 4 ? rand(5, 8) : rand(7, 12))
        : (kind === 4 ? rand(-8, -5) : rand(-11, -6));
      const head = sprite(softTex(toward ? '#fff6d8' : '#ff6a6a'), toward ? 0xfff6d8 : 0xff6a6a,
        kind === 4 ? 2.4 : 1.7, .95);
      const zLane = hwZ + (toward ? 2.2 : -2.2);
      const x0 = rand(-180, 260);
      head.position.set(x0, hwY + 1.1, zLane);
      carGroup.add(head);
      carMovers.push({ obj: head, min: -200, span: 480, v: speed, k: 1 });
      if (kind === 3 || kind === 4) {
        const body = sprite(softTex(kind === 3 ? '#ffe15a' : '#8defff'), kind === 3 ? 0xffe15a : 0x8defff,
          kind === 4 ? 2.8 : 1.6, .55);
        body.position.set(x0 + (toward ? -1.4 : 1.4), hwY + 1.1, zLane);
        carGroup.add(body);
        carMovers.push({ obj: body, min: -200, span: 480, v: speed, k: 1 });
      }
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
        // 道中→警告→ボスで夜が赤紫に寄せ、ネオン点滅を速く
        const m = moodT(s);
        mixFog(scene.fog, 0x31166e, 0x4a0a48, m, 430, 360);
        moonLight.intensity = .9 - m * .25;
        for (const f of flickables) {
          if (!f.userData.flick) continue;
          const thr = -.85 + m * .35;
          f.material.opacity = Math.sin(t * f.userData.flick * (3 + m * 4)) > thr ? .85 : .2;
        }
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

    // 帆船は撤去した。この距離だと三角帆が水面から突き出す暗い三角形になり、
    // 「クジラの尻尾が出たまま潜らない」と見えてしまう(実際に誤認された)。
    // 海上の人の気配は、灯りが多く形の分かる貨物船が担当する。

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
    // 2.6倍 = 全長135ユニット ≒ 720px(画面幅の半分強)。
    // WHALE_HALF は体の上下方向の張り出し(尾びれ込み)。潜航時の深さと
    // 水しぶきの発生タイミングを全部これから決めるので、scale を変えたら必ず更新する。
    const WHALE_SCALE = 2.6, WHALE_HALF = 8.5 * WHALE_SCALE;
    const WHALE_DEEP = -17 - WHALE_HALF - 14;    // 完全に水中へ隠れる深さ
    whale.scale.setScalar(WHALE_SCALE);
    whale.position.set(0, WHALE_DEEP, -130);
    whale.userData.wait = rand(3, 8);
    whale.userData.p = -1;                       // -1 = 潜航中
    scene.add(whale);

    // 水しぶき: 離水・着水の瞬間に海面へ広がる泡のプール
    // 泡のかたまり: 滑らかな放射グラデだと「白い靄」にしか見えないので、
    // 粒を寄せ集めたテクスチャにして水泡の粒立ちを出す。
    const foamTex = makeTex(128, 128, (g, w, h) => {
      for (let i = 0; i < 90; i++) {
        const a = Math.random() * 6.3, r = Math.pow(Math.random(), .6) * w * .46;
        const x = w / 2 + Math.cos(a) * r, y = h / 2 + Math.sin(a) * r * .7;
        const rr = (1 - r / (w * .5)) * 15 + 3;
        g.globalAlpha = (1 - r / (w * .52)) * rand(.35, .95);
        g.fillStyle = '#ffffff';
        g.beginPath(); g.ellipse(x, y, rr, rr * rand(.6, 1), 0, 0, 6.3); g.fill();
      }
      g.globalAlpha = 1;
    });
    const splashes = [];
    for (let i = 0; i < 14; i++) {
      const sp = sprite(foamTex, 0xf4ffff, 10, 0, THREE.NormalBlending);
      sp.visible = false;
      // depthTest を切らないと、同じ深度にいるクジラの巨体に飛沫が飲み込まれて
      // 一切見えなくなる(「水しぶきが出ない」の原因はこれ)。描画順で手前に出す。
      sp.material.depthTest = false;
      sp.renderOrder = 6;
      scene.add(sp);
      splashes.push(sp);
    }
    const drops = [];
    for (let i = 0; i < 90; i++) {
      const dp = sprite(softTex('#ffffff'), 0xeaffff, 3, 0, THREE.NormalBlending);
      dp.visible = false;
      dp.material.depthTest = false;
      dp.renderOrder = 7;
      scene.add(dp);
      drops.push(dp);
    }

    // 1回の出入水につき複数枚を散らす。1枚だけだと「白い丸」に見えて
    // 水しぶきとして読めない。
    function splash(x, z, size, n) {
      let spawned = 0;
      for (const sp of splashes) {
        if (spawned >= n) break;
        if (sp.visible) continue;
        sp.visible = true;
        sp.position.set(x + rand(-size * .5, size * .5), -15.5 + rand(0, size * .12), z + 12 + rand(-4, 4));
        sp.userData = {
          t: 0, life: 1.1 + Math.random() * .7,
          size: size * rand(.55, 1.15), rise: rand(6, 20)
        };
        spawned++;
      }
      // 水滴: 泡のかたまりだけだと靄に見える。放物線を描いて落ちる粒があって
      // はじめて「水しぶき」として読める。
      let d = 0;
      for (const dp of drops) {
        if (d >= n * 5) break;
        if (dp.visible) continue;
        dp.visible = true;
        dp.position.set(x + rand(-size * .35, size * .35), -16, z + 12);
        const a = -Math.PI / 2 + rand(-1.05, 1.05);
        const v = rand(18, 46) * (size / 90 + .55);
        dp.userData = { t: 0, life: 1 + Math.random() * .8, vx: Math.cos(a) * v, vy: -Math.sin(a) * v, s: rand(1.6, 4.2) };
        d++;
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
      const f = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 5),
        lambert({ color: 0xdff2ff, emissive: 0x3a5a70, emissiveIntensity: .6 }));
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
          // 潜っている間は完全に隠す。海面プレーンの遮蔽に頼ると、体長135ユニットの
          // 巨体はわずかな姿勢の残りでも尾が水面から突き出してしまう。
          whale.visible = false;
          W.wait -= dt;
          whale.position.x -= dx * .8 + 6 * dt;
          if (whale.position.x < -300) whale.position.x += 620;
          if (W.wait <= 0) {
            W.p = 0;
            W.dur = 3.4 + Math.random() * 1.2;
            // 跳躍高度: 体の張り出し(WHALE_HALF)ぶんを海面から抜かないと
            // 「浮き上がっただけ」に見える。中心が海面の 1.6倍上まで届く高さにする。
            W.arc = (-17 - WHALE_DEEP) + WHALE_HALF * 1.6 + Math.random() * 14;
            whale.position.set(rand(-45, 45), WHALE_DEEP, -130 + rand(-25, 25));
            whale.rotation.y = Math.random() < .5 ? 0 : Math.PI;   // 向きも振る
            whale.rotation.z = 0;
            whale.visible = true;
            W.wet = false;                        // 水面をまだ割っていない
          }
        } else {
          const prevY = whale.position.y;
          W.p += dt / W.dur;
          if (W.p >= 1) {                         // 着水しきったら潜航へ
            W.p = -1; W.wait = 5 + Math.random() * 8;
            whale.position.y = WHALE_DEEP;
            // **姿勢を水平に戻す**。傾いたまま潜らせると、体の長さぶん尾が
            // 跳ね上がって水面から突き出したままになる(潜航中に尻尾が出る不具合)。
            whale.rotation.z = 0;
          } else {
            // 上りは放物線、下りは指数を効かせて一気に沈める(尾を長く見せない)
            const s = W.p <= .5 ? Math.sin(W.p * Math.PI)
              : Math.pow(Math.sin(W.p * Math.PI), 1.9);
            whale.position.y = WHALE_DEEP + W.arc * s;
            whale.position.x += (whale.rotation.y ? -1 : 1) * 11 * dt - dx * .8;
            // 上昇中は機首上げ、下降中は機首下げ。ただし**傾けすぎない**:
            // 全長135ユニットの体を45°傾けると尾が中心から約48ユニット上へ跳ね、
            // 着水間際でも尾だけ水面上に残る。終盤(p>.7)は水平へ戻していく。
            // 体が水面下に入ったら即座に水平へ戻す。傾いたまま沈めると、体長の
            // 半分(約68ユニット)が梃子になって尾だけ水面上に残り続ける。
            const submerged = whale.position.y < -17 - WHALE_HALF * .2;
            const level = submerged ? 0 : (W.p > .62 ? 1 - (W.p - .62) / .38 : 1);
            whale.rotation.z = Math.cos(W.p * Math.PI) * .42 * Math.max(0, level);
            // 完全に水面下へ入ったら、そこで隠して沈黙させる(浮き上がって見えない)
            if (whale.position.y < -17 - WHALE_HALF && W.p > .5) whale.visible = false;
            whale.userData.blow.material.opacity =
              W.p > .42 && W.p < .6 ? .8 * Math.sin((W.p - .42) / .18 * Math.PI) : 0;
            // 水しぶきは「中心が海面を越えた時」ではなく「体が水面に触れた時」に出す。
            // 中心基準だと、体半分が既に空中に出てから飛沫が湧いて繋がって見えない。
            const surf = -17 - WHALE_HALF * .7;
            if (!W.wet && whale.position.y >= surf) {      // 離水
              W.wet = true;
              splash(whale.position.x, whale.position.z, 78, 4);
            }
            if (W.wet && whale.position.y < surf && W.p > .5) {   // 着水
              W.wet = false;
              splash(whale.position.x, whale.position.z, 120, 6);
            }
          }
        }
        for (const sp of splashes) {
          if (!sp.visible) continue;
          const u = sp.userData;
          u.t += dt;
          const q = u.t / u.life;
          if (q >= 1) { sp.visible = false; continue; }
          // 立ち上がって広がりながら落ちる: 上へ伸びてから重力で潰れる
          const sc = u.size * (.35 + q * 1.15);
          sp.scale.set(sc, sc * (.75 - q * .35), 1);
          sp.position.y = -15.5 + u.rise * Math.sin(Math.min(1, q * 1.7) * Math.PI * .5) - q * q * u.rise * .8;
          sp.material.opacity = .9 * (1 - q * q) * (q < .1 ? q / .1 : 1);
        }
        for (const dp of drops) {                 // 水滴: 放物線を描いて落ちる
          if (!dp.visible) continue;
          const u = dp.userData;
          u.t += dt;
          const q = u.t / u.life;
          if (q >= 1) { dp.visible = false; continue; }
          dp.position.x += u.vx * dt;
          dp.position.y += (u.vy - 34 * u.t) * dt;
          const s2 = u.s * (1 - q * .35);
          dp.scale.set(s2, s2, 1);
          dp.material.opacity = .95 * (1 - q * q);
        }

        cargo.position.x -= dx * .55 + 3.5 * dt;
        if (cargo.position.x < cargo.userData.min) cargo.position.x += cargo.userData.span;
        for (const f of jumpers) {                // 水面を出入りする魚群
          f.position.x -= dx * .9;
          if (f.position.x < -280) f.position.x += 560;
          const a = Math.sin(t * f.userData.sp + f.userData.ph);
          f.position.y = -18.5 + Math.max(0, a) * 3.4;
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
        // 外洋→深海チャプターはフォグを濃く、月光を落とす。ボス時はさらに沈む。
        const deep = Math.min(2, s.chapter + (s.chapterT || 0)) / 2;
        const m = moodT(s);
        mixFog(scene.fog, 0x0a4a7d, 0x041830, Math.max(deep * .5, m), 340 - deep * 90, 250);
        moonLight.intensity = 1.0 - deep * .35 - m * .25;
      }
    };
  }

  // ============================================================ STAGE 3
  // SUNSET FACTORY — 夕焼けの製鉄所。煙突、タンク、パイプ、炉の火明かり。
  function buildFactory() {
    const scene = new THREE.Scene();
    // 夕景の逆光は「明るい空 × 暗い影絵」。fog を明るいピンクにすると遠景が
    // 空と同じ明度に溶けて画面全部が一枚のマゼンタの膜になる(実際そうなっていた)。
    // 暗い焦げ茶へ落として、光るもの(炉・溶鋼・火)だけが抜けて見えるようにする。
    scene.fog = new THREE.Fog(0x2a0c1c, 30, 300);
    scene.add(new THREE.HemisphereLight(0xff8a4a, 0x1a0610, .62));
    const sunLight = new THREE.DirectionalLight(0xffb066, 1.5);
    sunLight.position.set(-140, 60, -220);
    scene.add(sunLight);
    // 炉側からの照り返し(下からの赤い光)。逆光の影絵に縁を付ける
    const forgeLight = new THREE.PointLight(0xff5a1e, 1.5, 260, 1.5);
    forgeLight.position.set(30, -6, -70);
    scene.add(forgeLight);
    const phong = o => new THREE.MeshPhongMaterial(o);

    // 沈む夕日: 円盤 + 締まった残光。以前は scale 320 の残光が画面全部を覆って
    // 単色ベールになっていたので、太陽は「小さく強く」・空の色は2D側に任せる。
    const sun = sprite(softTex('#fff6d8', 128, .62), 0xffe8a8, 78, 1);
    sun.position.set(-140, 88, -430);
    scene.add(sun);
    const sunGlow = sprite(softTex('#ff9f43'), 0xff8a2e, 190, .22);
    sunGlow.position.copy(sun.position);
    scene.add(sunGlow);
    // 夕焼け雲のデッキ: 上端が暗く下端(太陽側)が燃える帯。空が一枚のグラデ
    // だけだと平坦なので、明度差のある雲を数段重ねて空に奥行きを作る。
    const cloudBandTex = makeTex(256, 64, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      // 塊を重ねて雲の輪郭を作り、下半分だけ暖色で照り返す
      for (let i = 0; i < 26; i++) {
        const cx = rand(0, w), cy = rand(h * .3, h * .72), r = rand(9, 26);
        const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
        gr.addColorStop(0, 'rgba(46,10,26,.95)');
        gr.addColorStop(1, 'rgba(46,10,26,0)');
        g.fillStyle = gr;
        g.beginPath(); g.arc(cx, cy, r, 0, 6.3); g.fill();
      }
      g.globalCompositeOperation = 'source-atop';
      const lit = g.createLinearGradient(0, h * .3, 0, h);
      lit.addColorStop(0, 'rgba(0,0,0,0)');
      lit.addColorStop(.55, 'rgba(255,110,40,.5)');
      lit.addColorStop(1, 'rgba(255,190,90,.85)');
      g.fillStyle = lit; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'source-over';
    }, { repX: 2, repY: 1 });
    const sunBars = [];
    // 高さの決め方: カメラは +0.283rad 見上げているので、画面上部(y≈150px)に
    // 出すには z=-430 で world y≈280 が要る。y=100 前後だと画面中央に埋もれる。
    for (const [y, z, w, h, a, v] of [
      [300, -430, 760, 64, .85, 1.0], [232, -420, 680, 52, .9, 1.6],
      [176, -410, 620, 40, .85, 2.3], [128, -400, 560, 30, .75, 3.0]
    ]) {
      // map は帯ごとに複製する。共有したまま offset を動かすと4枚が同じ速度で
      // 動いて視差が消える(かつ加算されて4倍速になる)。
      const tex = cloudBandTex.clone();
      tex.needsUpdate = true;
      tex.offset.x = Math.random();
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
        basic({ map: tex, transparent: true, opacity: a, depthWrite: false, fog: false }));
      bar.position.set(rand(-120, 120), y, z);
      bar.userData = { v };
      scene.add(bar); sunBars.push(bar);
    }
    // 遠景の山稜: 夕日の手前に黒いシルエットを一枚入れると空と地表が分離する
    const ridgeTex = makeTex(512, 128, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.fillStyle = '#1c0612';
      g.beginPath();
      g.moveTo(0, h);
      let y = h * .55;
      for (let x = 0; x <= w; x += 16) {
        y += rand(-13, 13);
        y = Math.max(h * .18, Math.min(h * .8, y));
        g.lineTo(x, y);
      }
      g.lineTo(w, h); g.closePath(); g.fill();
    }, { repX: 2, repY: 1 });
    const ridge = new THREE.Mesh(new THREE.PlaneGeometry(1200, 120),
      basic({ map: ridgeTex, transparent: true, depthWrite: false, fog: false }));
    ridge.position.set(0, 22, -400);
    scene.add(ridge);

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
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1500, 520),
      phong({ map: floorTex, color: 0xd07850, specular: 0xff8a3a, shininess: 18 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -17, -260);
    scene.add(ground);

    // 遠景: 製油所シルエット(塔・球タンク・骨組み)
    const farBelt = makeScroller(() => {
      const grp = new THREE.Group();
      const m = lambert({ color: 0x25081a });
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
      const mat = lambert({ color: 0x2c0a1c });
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
      const mat = lambert({ color: 0x350e20 });
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

    // --- 名物: 高炉プラント(中景の主役) --------------------------------
    // 夕景の影絵に対して「熱を持った巨大構造」を1つ置くと画面の芯ができる。
    // 炉体(段付きの円錐台)+ 熱風管(ベンドの束)+ 出銑口の白熱 + 鉄骨の櫓。
    const bfHot = [];                  // 出銑口まわり(mood と炉の脈動で明滅)
    const bfSmoke = [];                // 炉頂の黒煙(ゆっくり昇って揺れる)
    const bfSteel = phong({ color: 0x3a1420, specular: 0xff7a3a, shininess: 24, emissive: 0x1a0208, emissiveIntensity: .6 });
    const bfPlate = phong({ color: 0x4a1a24, specular: 0xff8a4a, shininess: 16, emissive: 0x230409, emissiveIntensity: .7 });
    const bfBelt = makeScroller(() => {
      const grp = new THREE.Group();
      for (let i = 0; i < 2; i++) {
        const x = i * 290 + 60 + rand(-20, 20), z = -128;
        const bf = new THREE.Group();
        // 炉体: 上部シャフト / 胴 / 朝顔 / 炉床の4段。段ごとに径を変えて輪郭を作る
        for (const [r0, r1, h, y] of [[7.5, 9.5, 20, 8], [9.5, 9.5, 12, -8], [9.5, 6.4, 10, -19], [6.6, 7, 6, -27]]) {
          const seg = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, 12), bfPlate);
          seg.position.y = y + 17;
          bf.add(seg);
        }
        // 補強リング(段の継ぎ目)
        for (const y of [18, 9, -3, -14, -24]) {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(9.2, .55, 6, 16), bfSteel);
          ring.rotation.x = Math.PI / 2;
          ring.position.y = y + 17;
          bf.add(ring);
        }
        // 熱風環管(炉を巻く大径のダクト)と羽口へ降りる曲管
        const bustle = new THREE.Mesh(new THREE.TorusGeometry(11.5, 1.5, 8, 20), bfSteel);
        bustle.rotation.x = Math.PI / 2;
        bustle.position.y = 3;
        bf.add(bustle);
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          const down = new THREE.Mesh(new THREE.CylinderGeometry(.7, .7, 9, 6), bfSteel);
          down.position.set(Math.cos(a) * 10.6, -2.5, Math.sin(a) * 10.6);
          bf.add(down);
        }
        // 炉頂: 装入ベルとガス上昇管4本
        const bell = new THREE.Mesh(new THREE.ConeGeometry(6, 6, 12), bfSteel);
        bell.position.y = 30;
        bf.add(bell);
        for (const [ox, oz] of [[-5, -3], [5, -3], [-5, 3], [5, 3]]) {
          const up = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 26, 6), bfSteel);
          up.position.set(ox, 40, oz);
          bf.add(up);
        }
        // 出銑口: 白熱した口 + 樋を流れる湯 + 立ち上る熱気
        const tap = sprite(softTex('#fff2c8', 128, .45), 0xffb03a, 13, .9);
        tap.position.set(6, -8, 7);
        tap.userData.ph = rand(0, 6.28);
        bf.add(tap); bfHot.push(tap);
        const runner = new THREE.Mesh(new THREE.PlaneGeometry(20, 1.8),
          basic({ color: 0xffb03a, transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
        runner.rotation.x = -Math.PI / 2.1;
        runner.position.set(15, -13.5, 9);
        bf.add(runner);
        const heat = sprite(softTex('#ff7a2a'), 0xff5a1e, 40, .3);
        heat.position.set(6, 4, 8);
        heat.userData.ph = rand(0, 6.28);
        bf.add(heat); bfHot.push(heat);
        // 鉄骨の櫓(炉を囲む4本柱+梁)。影絵の骨組みが工業感を決める
        for (const [ox, oz] of [[-13, -9], [13, -9], [-13, 9], [13, 9]]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(1.1, 62, 1.1), bfSteel);
          leg.position.set(ox, 14, oz);
          bf.add(leg);
        }
        for (const y of [-2, 16, 34]) {
          const beam = new THREE.Mesh(new THREE.BoxGeometry(27, .9, .9), bfSteel);
          beam.position.set(0, y, -9);
          bf.add(beam);
        }
        // 炉頂から立ち上る黒煙: 明るい空を背にした暗い煙は最も安く効く「稼働感」。
        // 上へ行くほど大きく薄くなり、夕日の色をわずかに拾う。
        for (let k = 0; k < 5; k++) {
          const f = k / 5;
          const sm = sprite(softTex('#2e0c1a', 128, .15), 0x3a1220, 20 + f * 34, .5 - f * .3, THREE.NormalBlending);
          sm.position.set(rand(-4, 4), 52 + f * 34, 2);
          sm.userData.smoke = { base: 52 + f * 34, ph: rand(0, 6.28), amp: 3 + f * 4 };
          bf.add(sm); bfSmoke.push(sm);
        }
        bf.position.set(x, 0, z);
        grp.add(bf);
      }
      return grp;
    }, 580);
    scene.add(bfBelt.group);

    // --- 名物: 鋳造工場の大架構(近景を横切る鉄骨の桁) --------------------
    // 手前に骨組みを一枚渡すと、奥の炉が「屋内の遠く」に見えて奥行きが増す。
    const trussBelt = makeScroller(() => {
      const grp = new THREE.Group();
      const mat = phong({ color: 0x1e0712, specular: 0xff6a2a, shininess: 20 });
      for (let i = 0; i < 3; i++) {
        const x = i * 200 + rand(-16, 16), z = -58;
        const tr = new THREE.Group();
        // 上下弦材 + 斜材(トラス)
        for (const y of [0, 7]) {
          const chord = new THREE.Mesh(new THREE.BoxGeometry(80, .9, .9), mat);
          chord.position.set(0, y + 26, 0);
          tr.add(chord);
        }
        for (let k = 0; k < 16; k++) {
          const dg = new THREE.Mesh(new THREE.BoxGeometry(.6, 9.4, .6), mat);
          dg.position.set(-40 + k * 5.3, 29.5, 0);
          dg.rotation.z = (k % 2 ? 1 : -1) * .52;
          tr.add(dg);
        }
        // 支柱2本と、桁から吊るした投光器
        for (const ox of [-34, 34]) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(1.6, 44, 1.6), mat);
          post.position.set(ox, 4, 0);
          tr.add(post);
        }
        for (const ox of [-20, 8]) {
          const lampBody = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.4, 2.2, 8), mat);
          lampBody.position.set(ox, 24, 1);
          tr.add(lampBody);
          const beamLight = sprite(softTex('#ffd9a0', 128, .2), 0xffb45a, 15, .3);
          beamLight.position.set(ox, 19, 1.5);
          beamLight.userData.ph = rand(0, 6.28);
          tr.add(beamLight); bfHot.push(beamLight);
        }
        tr.position.set(x, 0, z);
        grp.add(tr);
      }
      return grp;
    }, 600);
    scene.add(trussBelt.group);

    // --- 章進行で現れる「親分の町」(日本家屋) ----------------------------
    // ボスが FLAME OYABUN(ヤクザの親分)なので、道中が進むほど製鉄所の風景に
    // 瓦屋根の町家・蔵・火の見櫓・提灯が混ざり、終盤は屋敷町へ入っていく。
    // 出現は s.chapter/chapterT から作った prog(0→1)でマテリアルを一括フェード。
    // フェード対象を数枚の共有マテリアルに絞ると、毎フレームの更新が数行で済む。
    const jpFade = [];                                  // prog で透過を動かすマテリアル
    const jpLit = [];                                   // 障子・提灯(明滅もする)
    const mkJp = (mat, lit) => { mat.transparent = true; mat.opacity = 0; jpFade.push(mat); if (lit) jpLit.push(mat); return mat; };
    // 瓦: 横方向の桟が並ぶ濃紺の屋根。夕日で棟の峰だけ光る
    const kawaraTex = makeTex(64, 32, g => {
      g.fillStyle = '#1b2030'; g.fillRect(0, 0, 64, 32);
      for (let i = 0; i < 8; i++) {
        g.fillStyle = '#2b3348'; g.fillRect(i * 8, 0, 5, 32);
        g.fillStyle = '#0e1220'; g.fillRect(i * 8 + 5, 0, 3, 32);
      }
      g.fillStyle = 'rgba(255,150,80,.28)'; g.fillRect(0, 0, 64, 4);
    }, { repX: 6, repY: 1 });
    // 板壁と漆喰(なまこ壁)
    const itaTex = makeTex(32, 64, g => {
      g.fillStyle = '#2a170f'; g.fillRect(0, 0, 32, 64);
      for (let i = 0; i < 6; i++) {
        g.fillStyle = i % 2 ? '#33200f' : '#241208';
        g.fillRect(0, i * 11, 32, 9);
      }
    }, { repX: 3, repY: 1 });
    const namakoTex = makeTex(32, 32, g => {
      g.fillStyle = '#d8cbb8'; g.fillRect(0, 0, 32, 32);
      g.strokeStyle = '#3a3020'; g.lineWidth = 2.4;
      for (let i = -32; i < 32; i += 11) {
        g.beginPath(); g.moveTo(i, 32); g.lineTo(i + 32, 0); g.stroke();
        g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 32, 32); g.stroke();
      }
    }, { repX: 3, repY: 2 });
    const shojiTex = makeTex(32, 32, g => {
      g.fillStyle = '#ffd9a0'; g.fillRect(0, 0, 32, 32);
      g.fillStyle = '#8a5a30';
      for (let i = 0; i <= 32; i += 8) { g.fillRect(i - 1, 0, 2, 32); g.fillRect(0, i - 1, 32, 2); }
    });
    const jpRoof = mkJp(lambert({ map: kawaraTex, color: 0xd8b0c0, emissive: 0x2a0a14, emissiveIntensity: .5 }));
    const jpWall = mkJp(lambert({ map: itaTex, color: 0xd89878, emissive: 0x1c0508, emissiveIntensity: .5 }));
    const jpPlaster = mkJp(lambert({ map: namakoTex, color: 0xffb090, emissive: 0x2a0c10, emissiveIntensity: .35 }));
    const jpWood = mkJp(phong({ color: 0x4a2412, specular: 0xff8a4a, shininess: 12, emissive: 0x1a0604, emissiveIntensity: .5 }));
    const jpShoji = mkJp(lambert({ map: shojiTex, color: 0xffe0b0, emissive: 0xffb45a, emissiveIntensity: 1.1, emissiveMap: shojiTex }), true);
    const jpNoren = mkJp(lambert({ color: 0x8a1020, emissive: 0x3a0308, emissiveIntensity: .6, side: THREE.DoubleSide }));
    const jpLantern = mkJp(lambert({ color: 0xff5a3a, emissive: 0xff6a2a, emissiveIntensity: 1.2 }), true);

    // 屋根はカメラ正面を向いた「板」で作る。最初は傾けた2枚の面で切妻を組んだが、
    // カメラがほぼ軒高と同じ高さにあるため面が水平に近く、真横から見ると
    // ただの細い線になって日本家屋に見えなかった。XY平面に反り屋根の輪郭を
    // 描いて押し出すと、正面から見て三角のシルエットがはっきり立つ。
    const gableRoof = (w, d, rise, y) => {
      const grp = new THREE.Group();
      const half = w / 2, eave = 1.8;          // eave = 軒先の垂れ
      const sh = new THREE.Shape();
      sh.moveTo(-half, 0);
      // 反り: 軒先から棟へ向けてわずかに凹ませる(直線だと洋風の切妻に見える)
      sh.quadraticCurveTo(-half * .45, rise * .48, 0, rise);
      sh.quadraticCurveTo(half * .45, rise * .48, half, 0);
      sh.lineTo(half + eave * .5, -eave);       // 軒の出
      sh.quadraticCurveTo(half * .45, rise * .48 - eave * 1.5, 0, rise - eave * 1.35);
      sh.quadraticCurveTo(-half * .45, rise * .48 - eave * 1.5, -half - eave * .5, -eave);
      sh.closePath();
      const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false }), jpRoof);
      roof.position.set(0, y, -d / 2 + d * .62);   // 手前へ大きく出して軒下の影を作る
      grp.add(roof);
      // 棟(むね): 頂部を走る太い瓦の峰。夕日で峰だけ明るく光る
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(w * .18, 1.6, d * 1.02), jpRoof);
      ridge.position.set(0, y + rise - .4, d * .12);
      grp.add(ridge);
      // 鬼瓦(棟の両端の飾り)
      for (const sgn of [-1, 1]) {
        const oni = new THREE.Mesh(new THREE.BoxGeometry(1, 2.2, 1.4), jpWood);
        oni.position.set(sgn * (half - .6), y + rise * .34, d * .6);
        grp.add(oni);
      }
      return grp;
    };
    // 寸法の要点: カメラは y=0 にあり水平線は画面 y≈561。地面 y=-17 に建つ物は
    // 「高さ17を超えて初めて水平線より上に出る」。最初 h=11〜14 で作ったら町が
    // まるごと2Dの手前帯の裏に沈んで一切見えなかった。屋根が y=+10〜25 に来る
    // 高さ(28〜42)にして、画面 y≈400〜560 の帯を町並みが占めるようにする。
    const jpBelt = makeScroller(() => {
      const grp = new THREE.Group();
      let x = 0;
      for (let i = 0; i < 7; i++) {
        const kind = i % 3;
        if (kind === 2) {
          // 蔵: なまこ壁の白い箱に濃い瓦屋根。町並みの明度を上げる要
          const w = rand(15, 19), h = rand(30, 38);
          const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, 11), jpPlaster);
          body.position.set(x + w / 2, -17 + h / 2, -92);
          grp.add(body);
          const rf = gableRoof(w + 3, 13, 6.4, -17 + h);
          rf.position.set(x + w / 2, 0, -92);
          grp.add(rf);
          // 妻側の観音扉と庇
          const door = new THREE.Mesh(new THREE.BoxGeometry(4.4, 7, .4), jpWood);
          door.position.set(x + w / 2, -17 + h * .55, -86.4);
          grp.add(door);
          x += w + rand(5, 9);
        } else {
          // 町家: 板壁 + 障子の灯り + 深い軒。2層に窓を入れて高さを読ませる
          const w = rand(17, 24), h = rand(28, 40);
          const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, 12), jpWall);
          body.position.set(x + w / 2, -17 + h / 2, -90);
          grp.add(body);
          const rf = gableRoof(w + 4, 15, 7.2, -17 + h);
          rf.position.set(x + w / 2, 0, -90);
          grp.add(rf);
          // 障子は上2段。下段は手前の2D帯に隠れるので置かない
          const n = 3 + (i % 2);
          for (const [ly, sh] of [[h - 6.5, 4.6], [h - 14, 4.2]]) {
            for (let k = 0; k < n; k++) {
              const win = new THREE.Mesh(new THREE.PlaneGeometry(3.6, sh), jpShoji);
              win.position.set(x + w * (k + .5) / n, -17 + ly, -83.9);
              grp.add(win);
            }
          }
          // 軒桁と、その下に下がる暖簾(視線高さの少し上に置いて見えるように)
          const beam = new THREE.Mesh(new THREE.BoxGeometry(w + 4, .7, .7), jpWood);
          beam.position.set(x + w / 2, -17 + h - 1.6, -83.6);
          grp.add(beam);
          const noren = new THREE.Mesh(new THREE.PlaneGeometry(w * .55, 3.4), jpNoren);
          noren.position.set(x + w / 2, -17 + h - 18, -83.8);
          grp.add(noren);
          x += w + rand(4, 8);
        }
      }
      // 火の見櫓: 町の背後に立つ木組みの望楼(半鐘つき)。町並みの最高点になる
      const yg = new THREE.Group();
      for (const [ox, oz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(.9, 56, .9), jpWood);
        leg.position.set(ox * .8, 11, oz * .8);
        yg.add(leg);
      }
      for (const yy of [-6, 8, 22]) {
        const br = new THREE.Mesh(new THREE.BoxGeometry(6.4, .5, .5), jpWood);
        br.position.set(0, yy, -2.4); yg.add(br);
      }
      const deck = new THREE.Mesh(new THREE.BoxGeometry(9.5, .7, 9.5), jpWood);
      deck.position.y = 39; yg.add(deck);
      const ygRoof = gableRoof(10, 10, 3.4, 40);
      yg.add(ygRoof);
      const bell = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 2.6, 8), jpLantern);
      bell.position.y = 42; yg.add(bell);
      yg.position.set(x * .42, 0, -104);
      grp.add(yg);
      // 提灯の列: 軒先を渡る赤提灯。視線高さの上(y≈+6)に張って必ず見えるようにする
      const lanternN = 14;
      const lant = new THREE.InstancedMesh(new THREE.CylinderGeometry(.9, .9, 2.2, 7), jpLantern, lanternN);
      const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _v = new THREE.Vector3();
      for (let k = 0; k < lanternN; k++) {
        _v.set(k * (x / lanternN), 6 + Math.sin(k * .9) * .8, -82);
        _m.compose(_v, _q, _s);
        lant.setMatrixAt(k, _m);
      }
      lant.instanceMatrix.needsUpdate = true;
      grp.add(lant);
      const cord = new THREE.Mesh(new THREE.BoxGeometry(x, .22, .22), jpWood);
      cord.position.set(x / 2, 7.6, -82);
      grp.add(cord);
      return grp;
    }, 300);
    scene.add(jpBelt.group);

    // --- 名物: 親分の屋敷門(唐破風) — 終盤だけ出てくる大物 ----------------
    // 章が最終盤(prog>.55)に入ると、町並みの中央にヤクザの本拠が構える。
    const oyabunGate = new THREE.Group();
    {
      // 石垣の基壇(ここは水平線下=2D帯の裏に隠れるので低く簡素で良い)
      const base = new THREE.Mesh(new THREE.BoxGeometry(56, 6, 16), jpPlaster);
      base.position.y = -14;
      oyabunGate.add(base);
      // 板塀を左右へ伸ばす。塀の天端が視線高さを超えるようにする
      for (const sgn of [-1, 1]) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(20, 26, 2.4), jpWall);
        wall.position.set(sgn * 17, -1, 0);
        oyabunGate.add(wall);
        const cap = gableRoof(22.5, 6, 2.2, 12.4);
        cap.position.set(sgn * 17, 0, 0);
        oyabunGate.add(cap);
      }
      // 門柱と冠木、両開きの扉
      for (const sgn of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(3, 40, 3), jpWood);
        post.position.set(sgn * 6.4, 2, 0);
        oyabunGate.add(post);
        const leaf = new THREE.Mesh(new THREE.BoxGeometry(5.8, 26, .6), jpWood);
        leaf.position.set(sgn * 3.1, -2, .3);
        oyabunGate.add(leaf);
      }
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(17, 2.4, 3.2), jpWood);
      lintel.position.y = 19;
      oyabunGate.add(lintel);
      // 唐破風: 中央が持ち上がる曲線の屋根。Shape で輪郭を描いて押し出す
      const karaShape = new THREE.Shape();
      karaShape.moveTo(-23, 0);
      karaShape.quadraticCurveTo(-12, 3, -7.6, 8.4);
      karaShape.quadraticCurveTo(0, 15, 7.6, 8.4);
      karaShape.quadraticCurveTo(12, 3, 23, 0);
      karaShape.lineTo(23, -4);
      karaShape.quadraticCurveTo(0, 7.4, -23, -4);
      karaShape.closePath();
      const kara = new THREE.Mesh(new THREE.ExtrudeGeometry(karaShape, { depth: 10, bevelEnabled: false }), jpRoof);
      kara.position.set(0, 20.5, -5);
      oyabunGate.add(kara);
      // 大提灯2張り(門の顔)。灯りは jpLit で一括明滅
      for (const sgn of [-1, 1]) {
        const big = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 6.6, 10), jpLantern);
        big.position.set(sgn * 10, 10, 2.6);
        oyabunGate.add(big);
        const capTop = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.8, 1, 10), jpWood);
        capTop.position.set(sgn * 10, 13.8, 2.6);
        oyabunGate.add(capTop);
      }
      // 門内に覗く母屋の灯り(閂の奥)
      const inner = new THREE.Mesh(new THREE.PlaneGeometry(11, 9), jpShoji);
      inner.position.set(0, 2, -7);
      oyabunGate.add(inner);
      // 塀の内側に建つ母屋の大屋根(奥に一段見える)
      const honya = new THREE.Mesh(new THREE.BoxGeometry(40, 20, 14), jpWall);
      honya.position.set(0, -2, -20);
      oyabunGate.add(honya);
      const honyaRoof = gableRoof(46, 18, 9, 8);
      honyaRoof.position.set(0, 0, -20);
      oyabunGate.add(honyaRoof);
    }
    // 手前(z=-72)に大きく構えさせ、周期も短くして必ず視界に入るようにする
    oyabunGate.scale.setScalar(1.35);
    oyabunGate.position.set(120, 0, -72);
    oyabunGate.userData = { min: -200, span: 400 };
    scene.add(oyabunGate);

    // --- ボス戦: 親分の座敷(屋敷の内部) ----------------------------------
    // 道中で屋敷門をくぐり、ボス戦は「座敷の中」で始まる。室内は床・襖の壁・
    // 格天井の3枚で画面を完全に覆えるので、外の工場は自然に見えなくなる。
    // 寸法の根拠(カメラ y=0 / 焦点距離 f≈691px / 見上げ 0.283rad):
    //   z=-120 の壁は y=-17..64 で画面 y=561..215、天井 y=64 がその上を塞ぎ、
    //   床 y=-17 が水平線から下を埋める。これで隙間なく室内になる。
    const interior = new THREE.Group();
    interior.userData.interior = true;
    const intFade = [];
    const mkInt = mat => { mat.transparent = true; mat.opacity = 0; intFade.push(mat); return mat; };
    // 畳: い草の目 + 黒い縁。半畳ずつ互い違いに敷く
    const tatamiTex = makeTex(128, 128, (g, w, h) => {
      for (let i = 0; i < 4; i++) {
        const vert = i % 2 === 0;
        const px = (i % 2) * 64, py = (i >> 1) * 64;
        g.fillStyle = '#6f7a45'; g.fillRect(px, py, 64, 64);
        g.strokeStyle = 'rgba(40,48,22,.32)'; g.lineWidth = 1;
        for (let k = 2; k < 64; k += 4) {
          g.beginPath();
          if (vert) { g.moveTo(px + k, py); g.lineTo(px + k, py + 64); }
          else { g.moveTo(px, py + k); g.lineTo(px + 64, py + k); }
          g.stroke();
        }
        g.fillStyle = '#1e1a12';                       // 畳縁(へり)
        g.fillRect(px, py, 64, 4); g.fillRect(px, py + 60, 64, 4);
        g.fillRect(px, py, 4, 64); g.fillRect(px + 60, py, 4, 64);
      }
    }, { repX: 26, repY: 5 });
    const tatami = new THREE.Mesh(new THREE.PlaneGeometry(1600, 300),
      mkInt(lambert({ map: tatamiTex, color: 0xfff0c8, emissive: 0x5a5228, emissiveIntensity: 1.0 })));
    tatami.rotation.x = -Math.PI / 2;
    tatami.position.set(0, -17, -60);
    interior.add(tatami);
    // 襖: 4枚一組で一続きの絵になる金地の障屏画。松・鶴・流水・竹・牡丹に
    // 金雲と砂子を重ね、黒漆の縁と引手で1枚ずつ区切る。
    // テクスチャは 512x340 で4枚分。壁(高さ81)に repX=13 で貼ると1枚あたり
    // およそ 31x81 world = 実際の襖に近い縦長比になる。
    const fusumaTex = makeTex(512, 340, (g, w, h) => {
      const PW = w / 4;                                  // 襖1枚の幅
      // --- 金地: 上下でわずかに焼けた金 ---
      const gold = g.createLinearGradient(0, 0, 0, h);
      gold.addColorStop(0, '#b8860f');
      gold.addColorStop(.42, '#e8c05a');
      gold.addColorStop(.78, '#d8a838');
      gold.addColorStop(1, '#9c6d0c');
      g.fillStyle = gold; g.fillRect(0, 0, w, h);
      // 砂子(細かい金粉)
      for (let i = 0; i < 900; i++) {
        g.fillStyle = Math.random() < .5 ? 'rgba(255,240,190,.5)' : 'rgba(140,95,10,.35)';
        g.fillRect(Math.random() * w, Math.random() * h, 1.6, 1.6);
      }
      // --- 金雲(すやり霞): 横に伸びる段々の霞。障屏画の骨格になる ---
      const cloud = (cy, cw, ch, alpha) => {
        g.save();
        g.globalAlpha = alpha;
        const grd = g.createLinearGradient(0, cy - ch, 0, cy + ch);
        grd.addColorStop(0, '#fff0be');
        grd.addColorStop(1, '#c99a28');
        g.fillStyle = grd;
        g.beginPath();
        let x = -20;
        g.moveTo(x, cy);
        while (x < cw + 20) {
          const r = 14 + Math.random() * 20;
          g.arc(x + r, cy - ch * .5, r, Math.PI, 0);
          x += r * 1.7;
        }
        g.lineTo(cw + 20, cy + ch * .5);
        x = cw + 20;
        while (x > -20) {
          const r = 12 + Math.random() * 18;
          g.arc(x - r, cy + ch * .5, r, 0, Math.PI);
          x -= r * 1.7;
        }
        g.closePath(); g.fill();
        g.strokeStyle = 'rgba(120,80,8,.35)'; g.lineWidth = 1.6; g.stroke();
        g.restore();
      };
      cloud(58, w, 26, .85);
      cloud(196, w, 22, .7);
      cloud(310, w, 24, .8);
      // --- 岩と流水(下辺) ---
      g.fillStyle = '#3c4a3a';
      g.beginPath();
      g.moveTo(0, h);
      g.lineTo(0, h - 42); g.lineTo(46, h - 62); g.lineTo(96, h - 34);
      g.lineTo(150, h - 56); g.lineTo(214, h - 30); g.lineTo(280, h - 50);
      g.lineTo(350, h - 28); g.lineTo(420, h - 48); g.lineTo(w, h - 32);
      g.lineTo(w, h); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(200,225,235,.5)'; g.lineWidth = 2;
      for (let i = 0; i < 7; i++) {                       // 流水文
        const yy = h - 20 + i * 3;
        g.beginPath();
        for (let x = 0; x <= w; x += 16) {
          const yv = yy - Math.sin((x / w) * 12 + i) * 5;
          x === 0 ? g.moveTo(x, yv) : g.lineTo(x, yv);
        }
        g.stroke();
      }
      // --- 松: 幹・枝・団子状の松葉。左2枚にまたがる主役 ---
      const needles = (cx, cy, r) => {
        g.fillStyle = '#1d4529';
        g.beginPath(); g.arc(cx, cy, r, 0, 6.3); g.fill();
        g.fillStyle = '#2f6b3c';
        g.beginPath(); g.arc(cx - r * .28, cy - r * .3, r * .62, 0, 6.3); g.fill();
        g.strokeStyle = '#123018'; g.lineWidth = 1.4;
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * 6.28;
          g.beginPath();
          g.moveTo(cx + Math.cos(a) * r * .6, cy + Math.sin(a) * r * .6);
          g.lineTo(cx + Math.cos(a) * r * 1.16, cy + Math.sin(a) * r * 1.16);
          g.stroke();
        }
      };
      g.strokeStyle = '#3a2510'; g.lineCap = 'round';
      g.lineWidth = 15;
      g.beginPath(); g.moveTo(40, h - 40); g.quadraticCurveTo(58, 250, 46, 176); g.stroke();
      g.lineWidth = 9;
      g.beginPath(); g.moveTo(48, 214); g.quadraticCurveTo(112, 208, 146, 168); g.stroke();
      g.beginPath(); g.moveTo(46, 186); g.quadraticCurveTo(6, 172, -8, 140); g.stroke();
      g.lineWidth = 6;
      g.beginPath(); g.moveTo(46, 176); g.quadraticCurveTo(74, 150, 70, 120); g.stroke();
      needles(70, 108, 30); needles(150, 158, 26); needles(6, 132, 24);
      needles(112, 186, 20); needles(40, 156, 17);
      // --- 竹: 右端の1枚に3本 ---
      for (const [bx, bh, bw] of [[452, 300, 7], [478, 330, 5], [498, 280, 6]]) {
        g.fillStyle = '#4a6b28';
        g.fillRect(bx, h - bh, bw, bh);
        g.strokeStyle = '#2e4718'; g.lineWidth = 2;
        for (let yy = h - bh + 16; yy < h; yy += 34) {
          g.beginPath(); g.moveTo(bx, yy); g.lineTo(bx + bw, yy); g.stroke();
        }
        g.fillStyle = '#3f6a24';
        for (let k = 0; k < 4; k++) {
          const ly = h - bh + 20 + k * 46;
          g.beginPath();
          g.ellipse(bx + bw + 14, ly, 16, 4.4, -.5, 0, 6.3); g.fill();
          g.beginPath();
          g.ellipse(bx - 14, ly + 18, 15, 4, .55, 0, 6.3); g.fill();
        }
      }
      // --- 牡丹: 中央下に2輪 ---
      const peony = (cx, cy, r, col, dark) => {
        for (let ring = 3; ring >= 1; ring--) {
          g.fillStyle = ring === 3 ? dark : col;
          const n = 5 + ring * 2, rr = r * (ring / 3);
          for (let i = 0; i < n; i++) {
            const a = (i / n) * 6.28 + ring;
            g.beginPath();
            g.ellipse(cx + Math.cos(a) * rr * .5, cy + Math.sin(a) * rr * .5, rr * .58, rr * .42, a, 0, 6.3);
            g.fill();
          }
        }
        g.fillStyle = '#fff0b0';
        g.beginPath(); g.arc(cx, cy, r * .16, 0, 6.3); g.fill();
      };
      peony(238, h - 74, 26, '#e84a72', '#a81f46');
      peony(292, h - 52, 18, '#f2789c', '#c23a62');
      g.fillStyle = '#2f6b3c';
      for (const [lx, ly] of [[210, h - 48], [262, h - 30], [316, h - 76]]) {
        g.beginPath(); g.ellipse(lx, ly, 20, 7, .4, 0, 6.3); g.fill();
      }
      // --- 鶴: 飛翔1羽 + 立ち姿1羽 ---
      const craneFly = (cx, cy, sc) => {
        g.save(); g.translate(cx, cy); g.scale(sc, sc);
        g.fillStyle = '#f8f4e8';
        g.beginPath(); g.ellipse(0, 0, 30, 11, -.12, 0, 6.3); g.fill();
        g.beginPath();                                    // 翼
        g.moveTo(-4, -4); g.quadraticCurveTo(-30, -40, -62, -34);
        g.quadraticCurveTo(-34, -18, -6, 2); g.closePath(); g.fill();
        g.beginPath();
        g.moveTo(2, -2); g.quadraticCurveTo(24, -34, 54, -26);
        g.quadraticCurveTo(28, -12, 6, 2); g.closePath(); g.fill();
        g.fillStyle = '#151009';                          // 風切羽
        g.beginPath(); g.ellipse(-52, -32, 12, 4, -.35, 0, 6.3); g.fill();
        g.beginPath(); g.ellipse(46, -25, 11, 4, .3, 0, 6.3); g.fill();
        g.strokeStyle = '#f8f4e8'; g.lineWidth = 4.5; g.lineCap = 'round';
        g.beginPath(); g.moveTo(26, -3); g.lineTo(52, -16); g.stroke();   // 首
        g.beginPath(); g.moveTo(-26, 2); g.lineTo(-48, 12); g.stroke();   // 脚
        g.fillStyle = '#f8f4e8';
        g.beginPath(); g.arc(54, -17, 5.4, 0, 6.3); g.fill();
        g.fillStyle = '#c81028';
        g.beginPath(); g.arc(55, -20, 2.6, 0, 6.3); g.fill();
        g.strokeStyle = '#151009'; g.lineWidth = 2.4;
        g.beginPath(); g.moveTo(59, -16); g.lineTo(70, -13); g.stroke();
        g.restore();
      };
      const craneStand = (cx, cy, sc) => {
        g.save(); g.translate(cx, cy); g.scale(sc, sc);
        g.fillStyle = '#f8f4e8';
        g.beginPath(); g.ellipse(0, 0, 26, 13, -.15, 0, 6.3); g.fill();
        g.fillStyle = '#151009';
        g.beginPath(); g.ellipse(-22, 2, 13, 6, .3, 0, 6.3); g.fill();     // 尾羽
        g.strokeStyle = '#f8f4e8'; g.lineWidth = 5; g.lineCap = 'round';
        g.beginPath(); g.moveTo(16, -6); g.quadraticCurveTo(30, -30, 22, -48); g.stroke();
        g.strokeStyle = '#151009'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(-4, 11); g.lineTo(-6, 40); g.moveTo(8, 11); g.lineTo(12, 40); g.stroke();
        g.fillStyle = '#f8f4e8';
        g.beginPath(); g.arc(22, -50, 6, 0, 6.3); g.fill();
        g.fillStyle = '#c81028';
        g.beginPath(); g.arc(22, -54, 3, 0, 6.3); g.fill();
        g.strokeStyle = '#151009'; g.lineWidth = 2.6;
        g.beginPath(); g.moveTo(27, -49); g.lineTo(40, -46); g.stroke();
        g.restore();
      };
      craneFly(330, 128, 1);
      craneStand(392, h - 66, .9);
      // --- 家紋(五三桐ふう)を各襖の上部に小さく散らす ---
      for (let i = 0; i < 4; i++) {
        const cx = PW * i + PW / 2, cy = 34;
        g.save(); g.translate(cx, cy);
        g.fillStyle = 'rgba(60,40,6,.55)';
        g.beginPath(); g.arc(0, 0, 13, 0, 6.3); g.stroke();
        g.strokeStyle = 'rgba(60,40,6,.55)'; g.lineWidth = 1.6;
        g.beginPath(); g.arc(0, 0, 13, 0, 6.3); g.stroke();
        for (const [ox, sc2] of [[-6.5, .8], [0, 1], [6.5, .8]]) {
          g.beginPath();
          g.ellipse(ox, 1, 3 * sc2, 6.5 * sc2, 0, 0, 6.3);
          g.fill();
          g.fillRect(ox - .8, -9 * sc2, 1.6, 4.5 * sc2);
        }
        g.restore();
      }
      // --- 黒漆の縁と引手(1枚ごと) ---
      g.fillStyle = '#140d06';
      g.fillRect(0, 0, w, 9); g.fillRect(0, h - 9, w, 9);
      for (let i = 0; i <= 4; i++) g.fillRect(PW * i - 4, 0, 8, h);
      g.strokeStyle = 'rgba(200,160,70,.5)'; g.lineWidth = 1.2;
      for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(PW * i + 4.6, 0); g.lineTo(PW * i + 4.6, h); g.stroke(); }
      for (let i = 0; i < 4; i++) {                        // 引手(黒漆に金縁)
        const cx = PW * i + PW - 14, cy = h * .52;
        g.fillStyle = '#241708';
        g.beginPath(); g.ellipse(cx, cy, 6.5, 10, 0, 0, 6.3); g.fill();
        g.strokeStyle = '#c8991f'; g.lineWidth = 1.8;
        g.beginPath(); g.ellipse(cx, cy, 6.5, 10, 0, 0, 6.3); g.stroke();
      }
    }, { repX: 13, repY: 1 });
    // 壁・欄間・長押・柱・提灯は1つの塊として奥から手前へ寄ってくる
    const intWallGrp = new THREE.Group();
    interior.add(intWallGrp);
    const fusumaWall = new THREE.Mesh(new THREE.PlaneGeometry(1600, 81),
      mkInt(lambert({ map: fusumaTex, color: 0xffd8a8, emissive: 0xffffff, emissiveIntensity: .5, emissiveMap: fusumaTex })));
    fusumaWall.position.set(0, 23.5, -120);
    intWallGrp.add(fusumaWall);
    // 格天井: 太い格縁が井桁に走る木の天井
    const gotenTex = makeTex(64, 64, g => {
      g.fillStyle = '#2a1a0e'; g.fillRect(0, 0, 64, 64);
      g.fillStyle = '#3d2714'; g.fillRect(6, 6, 52, 52);
      g.strokeStyle = '#5a3a1c'; g.lineWidth = 5; g.strokeRect(3, 3, 58, 58);
      g.fillStyle = '#1c1208'; g.fillRect(28, 28, 8, 8);
    }, { repX: 30, repY: 6 });
    const goten = new THREE.Mesh(new THREE.PlaneGeometry(1600, 200),
      mkInt(lambert({ map: gotenTex, color: 0xffc898, emissive: 0x2e1a08, emissiveIntensity: .9 })));
    goten.rotation.x = Math.PI / 2;
    goten.position.set(0, 64, -40);
    interior.add(goten);
    // 柱・長押・欄間: 室内の骨格。黒っぽい木で襖の金地を締める
    const intWood = mkInt(phong({ color: 0x2e1a0c, specular: 0xff9a5a, shininess: 16, emissive: 0x140803, emissiveIntensity: .6 }));
    // 欄間は**透かしにしない**。格子の穴から後ろが素通しになり、屋外を消した
    // 状態では2Dの夕景の空がそのまま抜けて「襖に背景が透けている」状態になる。
    // 板に格子を彫った不透明パネルとして描く(組子の影も焼き込む)。
    const ranmaTex = makeTex(64, 32, g => {
      g.fillStyle = '#120a04'; g.fillRect(0, 0, 64, 32);       // 奥の陰(不透明)
      g.fillStyle = '#2a1a0c';
      for (let x = 0; x < 64; x += 8) g.fillRect(x + 3, 0, 5, 32);
      for (let y = 0; y < 32; y += 8) g.fillRect(0, y + 3, 64, 5);
      g.fillStyle = '#4a3018';                                  // 組子の当たり(光側)
      for (let x = 0; x < 64; x += 8) g.fillRect(x + 3, 0, 2, 32);
      for (let y = 0; y < 32; y += 8) g.fillRect(0, y + 3, 64, 2);
    }, { repX: 40, repY: 1 });
    const ranma = new THREE.Mesh(new THREE.PlaneGeometry(1600, 9),
      mkInt(lambert({ map: ranmaTex, color: 0xffc090, emissive: 0x2a1608, emissiveIntensity: .7 })));
    ranma.position.set(0, 58, -118);
    intWallGrp.add(ranma);
    const nageshi = new THREE.Mesh(new THREE.BoxGeometry(1600, 2.6, 1.6), intWood);
    nageshi.position.set(0, 52, -116);
    intWallGrp.add(nageshi);
    const intPillars = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 81, 2.4), intWood, 14);
    {
      const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _v = new THREE.Vector3();
      for (let i = 0; i < 14; i++) {
        _v.set(-390 + i * 60, 23.5, -116);
        _m.compose(_v, _q, _s);
        intPillars.setMatrixAt(i, _m);
      }
      intPillars.instanceMatrix.needsUpdate = true;
    }
    intWallGrp.add(intPillars);
    // 吊り提灯: 座敷の灯り。ボスの登場に合わせて息づく
    const intLampMat = mkInt(lambert({ color: 0xff6a3a, emissive: 0xff7a2a, emissiveIntensity: 1.3 }));
    const intLamps = new THREE.InstancedMesh(new THREE.CylinderGeometry(2, 2, 5, 10), intLampMat, 9);
    {
      const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _v = new THREE.Vector3();
      for (let i = 0; i < 9; i++) {
        _v.set(-320 + i * 80, 42, -96);
        _m.compose(_v, _q, _s);
        intLamps.setMatrixAt(i, _m);
      }
      intLamps.instanceMatrix.needsUpdate = true;
    }
    intWallGrp.add(intLamps);
    // 座敷の実光源(提灯の暖色)。畳と襖の金に落ちる
    const intLight = new THREE.PointLight(0xffa050, 0, 200, 1.4);
    intLight.position.set(0, 30, -70);
    interior.add(intLight);
    // 敷居の暗がり: 門をくぐる一瞬を黒で覆う幕。座敷(z=-120)は町並み(z=-90)
    // より奥にあるため、透過で重ねても永久に町に隠れて出てこられない。
    // 「暗くなる→切り替わる→部屋が閉じてくる」の順にして物理的な前後関係を回避する。
    const intVeil = new THREE.Mesh(new THREE.PlaneGeometry(2400, 1600),
      new THREE.MeshBasicMaterial({ color: 0x0a0603, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false }));
    intVeil.position.set(0, 0, -12);
    intVeil.renderOrder = 999;
    interior.add(intVeil);
    interior.visible = false;
    scene.add(interior);

    // 送電鉄塔と電線
    const pylonBelt = makeScroller(() => {
      const grp = new THREE.Group();
      const mat = lambert({ color: 0x220716 });
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
      const steel = lambert({ color: 0x350e20 });
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
    let insideT = 0;      // 0=屋外 / 1=座敷の中(ボス戦)
    return {
      scene,
      update(dt, s) {
        t += dt;
        const dx = SCROLL * (s.speed || 1) * dt;
        farBelt.update(dx * .85); midBelt.update(dx); nearBelt.update(dx);
        coolBelt.update(dx * .8); flareBelt.update(dx * .92); pylonBelt.update(dx * .88);
        bfBelt.update(dx * .9); trussBelt.update(dx * 1.05);
        // --- 屋敷の中へ: ボス戦は座敷の内部で戦う --------------------------
        // warning(ボス接近)で扉をくぐる想定で室内へクロスフェードし、外の
        // 工場・町並みは室内の床/襖/天井に完全に隠れるので visible を落とす。
        // s.warning は**中ボスの警告でも true** になる(director の warning は
        // 'warning' と 'midboss-warning' の両方を拾う)。座敷は親分の本戦専用なので
        // s.boss だけを見る。s.boss は 'warning'|'active'|'transition'|'final' を
        // 含むので、ボス接近の時点から入場が始まる挙動は変わらない。
        const wantInside = s.boss ? 1 : 0;
        insideT += (wantInside - insideT) * Math.min(1, dt * 1.15);
        if (insideT < .002) insideT = 0;
        api.indoor = insideT;
        interior.visible = insideT > .01;
        if (interior.visible) {
          // 「入っていく」演出は透過のクロスフェードでは作れない。半分だけ
          // 透けた座敷と屋外が重なって二重露光になり、どちらも読めなくなる
          // (実際そうなっていた)。代わりに**部屋そのものを閉じてくる**:
          //   天井が上から降り、畳が下からせり上がり、襖の壁が奥から寄る。
          // 3面は不透明なので、寄るほど屋外を物理的に隠していく = くぐった感。
          // 透過は立ち上がりの3割だけ使い、そこから先は完全な不透明にする。
          // 3幕構成にする:
          //  (1) 0〜.5  敷居の暗がりが濃くなる(門をくぐる)
          //  (2) .5     ここで屋外→座敷を差し替える(真っ黒なので継ぎ目が見えない)
          //  (3) .45〜1 天井が降り、畳がせり上がり、襖の壁が奥から寄って部屋が閉じる
          const veil = insideT < .5
            ? Math.min(1, insideT / .5)
            : Math.max(0, 1 - (insideT - .5) / .3);
          intVeil.material.opacity = veil;
          const u = Math.max(0, Math.min(1, (insideT - .45) / .55));
          const back = 1 - (1 - Math.pow(1 - u, 3));
          intWallGrp.position.z = -300 * back;            // 襖の壁が奥から迫る
          goten.position.y = 64 + 150 * back;             // 天井が上から降りてくる
          tatami.position.y = -17 - 150 * back;           // 畳が下からせり上がる
          for (const mat of intFade) mat.opacity = 1;     // 部屋は常に不透明
          // 提灯と実光源は室内が固まってから灯す(入った瞬間に眩しくしない)
          const lampBreath = .9 + .18 * Math.sin(t * 2.6);
          intLampMat.emissiveIntensity = 1.3 * lampBreath * insideT;
          intLight.intensity = 2.1 * insideT * lampBreath;
          // 座敷は動かさない。壁だけ止めて床天井が流れると室内が破綻するので
          // 3面まとめて固定し、「屋敷に着いて対峙している」画にする。
        }
        // 屋外の停止は暗転のピーク(insideT=.5)で行う。座敷は町並みより奥に
        // あるので、これより早く出しても町に隠れて見えない。
        const outsideOn = insideT < .5;
        for (const child of scene.children) {
          if (child.userData && child.userData.interior) continue;
          child.visible = outsideOn;
        }
        // 親分の町: 章が進むほど濃く現れる(0=製鉄所だけ / 1=屋敷町)。
        // ボス戦は backgroundDirector 側で最終章に固定されるので出たままになる。
        const prog = Math.min(1, (Math.min(2, (s.chapter || 0) + (s.chapterT || 0)) / 2) * 1.15);
        jpBelt.update(dx);
        const lit = .55 + .12 * Math.sin(t * 2.3);
        for (const mat of jpFade) mat.opacity = prog;
        for (const mat of jpLit) mat.emissiveIntensity = (mat === jpShoji ? 1.1 : 1.2) * (lit + .45) * prog;
        jpBelt.group.visible = outsideOn && prog > .02;
        // 屋敷門は終盤だけ。手前に置くので prog が低いうちは完全に消しておく
        const gateOn = Math.max(0, Math.min(1, (prog - .55) / .3));
        oyabunGate.visible = outsideOn && gateOn > .02;
        if (oyabunGate.visible) {
          oyabunGate.position.x -= dx * .95;
          if (oyabunGate.position.x < oyabunGate.userData.min) oyabunGate.position.x += oyabunGate.userData.span;
        }
        // 高炉の熱気・出銑口・投光器: 炉の呼吸で明滅し、ボス戦で熱を増す
        const mF = moodT(s);
        for (let i = 0; i < bfHot.length; i++) {
          const o = bfHot[i];
          const ph = o.userData.ph || 0;
          o.material.opacity = .34 + .2 * Math.sin(t * (2.4 + (i % 3) * .7) + ph) + mF * .22;
        }
        forgeLight.intensity = 1.4 + .35 * Math.sin(t * 2.1) + mF * .8;
        for (const sm of bfSmoke) {
          const u = sm.userData.smoke;
          sm.position.y = u.base + Math.sin(t * .45 + u.ph) * u.amp;
          sm.position.x += Math.sin(t * .3 + u.ph) * dt * 1.6;
        }
        // 雲デッキ: テクスチャ側を流して継ぎ目を出さずに永久スクロールさせる
        for (const bar of sunBars) bar.material.map.offset.x += bar.userData.v * dt * .004;
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
        // ボス／警告で炉の赤を深め、火花を速く
        const m = moodT(s);
        mixFog(scene.fog, 0x5e1c30, 0x3a0c18, m, 330, 270);
        sunLight.intensity = 1.3 - m * .35;
        for (const f of flames) {
          // 既存の揺らぎに mood で一段階強く
          f.material.opacity = Math.min(1, (f.material.opacity || .7) + m * .12);
        }
      }
    };
  }

  // ============================================================ STAGE 4
  // CYBER STORM — 電脳嵐。雲海、回路モノリス、雨、稲妻、データ流。
  function buildStorm() {
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x07171e, 22, 290);   // 青灰の雨霧(緑に寄せない)
    // 1.0 だと全部が同じ中間緑に持ち上がり、雲・塔・地表の区別が消える。
    // 嵐は「暗い基調 + 稲光の瞬間だけ明るい」ので環境光は低く抑える。
    const hemi = new THREE.HemisphereLight(0x4a8ea0, 0x02090e, .52);   // 寒色の環境光
    scene.add(hemi);
    const flashLight = new THREE.DirectionalLight(0xd8ffe8, 0);
    flashLight.position.set(0, 200, -100);
    scene.add(flashLight);
    const phong = o => new THREE.MeshPhongMaterial(o);

    // 雷雲層: 以前は中間緑のソフト球27個が画面中央(y=-14..60)に居座り、
    // 塔の手前を覆う一枚の緑の膜になっていた。雲は「空の高い位置」に置き、
    // 暗い塊 + 稲光で内側が光る、という積乱雲の見え方に作り替える。
    const thunderTex = makeTex(256, 128, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      for (let i = 0; i < 34; i++) {
        const cx = rand(0, w), cy = rand(h * .25, h * .8), r = rand(14, 42);
        const gr = g.createRadialGradient(cx, cy - r * .3, 0, cx, cy, r);
        gr.addColorStop(0, 'rgba(20,58,52,.95)');
        gr.addColorStop(.6, 'rgba(9,32,30,.7)');
        gr.addColorStop(1, 'rgba(6,22,22,0)');
        g.fillStyle = gr;
        g.beginPath(); g.arc(cx, cy, r, 0, 6.3); g.fill();
      }
      // 上面のハイライト(雲頂に当たる薄明かり)で塊の丸みを出す
      g.globalCompositeOperation = 'source-atop';
      const lit = g.createLinearGradient(0, 0, 0, h * .7);
      lit.addColorStop(0, 'rgba(120,230,190,.4)');
      lit.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = lit; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'source-over';
    }, { repX: 2, repY: 1 });
    // カメラは +0.283rad 見上げているので、画面上部に出すには z=-380 で y≈250 要る
    // 下段(y≈10〜60)は画面の中〜下段=水平線までの帯を埋める層。ここが空くと
    // 2Dの明るい緑地がそのまま見えて「のっぺりした緑」になる。
    const cloudDeck = [];
    for (const [y, z, w, h, a, v] of [
      [286, -400, 780, 96, .92, .9], [214, -370, 700, 74, .88, 1.5],
      [158, -340, 620, 56, .8, 2.2], [112, -300, 540, 40, .62, 3.1],
      [62, -320, 660, 44, .78, 2.0], [30, -290, 600, 34, .7, 2.8],
      [8, -260, 540, 26, .55, 3.6]
    ]) {
      const tex = thunderTex.clone();
      tex.needsUpdate = true;
      tex.offset.x = Math.random();
      const deck = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
        basic({ map: tex, transparent: true, opacity: a, depthWrite: false, fog: false }));
      deck.position.set(0, y, z);
      deck.userData = { v, base: a };
      scene.add(deck); cloudDeck.push(deck);
    }

    // --- 眼下の雲海 + データ地平 -----------------------------------------
    // このステージには地表が無く、画面下半分が2Dの明るい緑地のまま空いていた。
    // 「雷雲の上を飛んでいる」画にするため、眼下に雲の海と走査グリッドを敷く。
    const seaTex = makeTex(256, 256, (g, w, h) => {
      const bg = g.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#04161a');
      bg.addColorStop(1, '#0a2c2a');
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 90; i++) {
        const cx = rand(0, w), cy = rand(0, h), r = rand(10, 34);
        const gr = g.createRadialGradient(cx, cy - r * .25, 0, cx, cy, r);
        gr.addColorStop(0, `rgba(46,120,104,${rand(.2, .5).toFixed(2)})`);
        gr.addColorStop(1, 'rgba(10,40,38,0)');
        g.fillStyle = gr;
        g.beginPath(); g.arc(cx, cy, r, 0, 6.3); g.fill();
      }
    }, { repX: 10, repY: 5 });
    const cloudSea = new THREE.Mesh(new THREE.PlaneGeometry(1600, 620),
      lambert({ map: seaTex, color: 0x9fd8c4, emissive: 0x061e1c, emissiveIntensity: .8 }));
    cloudSea.rotation.x = -Math.PI / 2;
    cloudSea.position.set(0, -40, -300);
    scene.add(cloudSea);
    // 走査グリッド: 雲海の上を走る発光ワイヤ。奥行きの手掛かりになる
    const gridTex = makeTex(128, 128, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.strokeStyle = 'rgba(80,240,150,.55)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, 1); g.lineTo(w, 1); g.stroke();
      g.beginPath(); g.moveTo(1, 0); g.lineTo(1, h); g.stroke();
    }, { repX: 40, repY: 16 });
    const dataGrid = new THREE.Mesh(new THREE.PlaneGeometry(1600, 600),
      basic({ map: gridTex, transparent: true, opacity: .3, blending: THREE.AdditiveBlending, depthWrite: false, fog: true }));
    dataGrid.rotation.x = -Math.PI / 2;
    dataGrid.position.set(0, -38, -300);
    scene.add(dataGrid);
    // 雲海の割れ目から漏れる光(下で雷が光っている感じ)
    const seaGlows = [];
    for (let i = 0; i < 6; i++) {
      const gl = sprite(softTex('#7affc8'), 0x48e87a, rand(26, 54), .12);
      gl.position.set(rand(-260, 260), -34, rand(-260, -90));
      gl.userData.ph = rand(0, 6.28);
      scene.add(gl); seaGlows.push(gl);
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

    // --- 名物: 巨大データコア塔 ------------------------------------------
    // 遠景右寄りに常駐する回転リング塔。ボス時にスケールと光量が増す。
    const dataCore = new THREE.Group();
    const coreBodyMat = lambert({ color: 0x0a3028, emissive: 0x1a6048, emissiveIntensity: .75 });
    const coreShaft = new THREE.Mesh(new THREE.CylinderGeometry(9, 14, 90, 10), coreBodyMat);
    coreShaft.position.y = 22;
    dataCore.add(coreShaft);
    const coreCap = new THREE.Mesh(new THREE.CylinderGeometry(12, 9, 8, 10),
      lambert({ color: 0x123a30, emissive: 0x31e8ff, emissiveIntensity: 1.0 }));
    coreCap.position.y = 70;
    dataCore.add(coreCap);
    const coreRings = [];
    for (const [ry, rr, sp] of [[-10, 20, .6], [12, 17, -.85], [36, 14, 1.1], [58, 12, -.7]]) {
      const rm = basic({ color: 0x31e8ff, transparent: true, opacity: .7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, .7, 6, 36), rm);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = ry + 22;
      ring.userData.sp = sp;
      dataCore.add(ring);
      coreRings.push(ring);
    }
    // 縦のエネルギー噴流(塔を貫く光柱)
    const jetTex = makeTex(32, 128, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, 'rgba(49,232,255,0)');
      gr.addColorStop(.35, 'rgba(114,255,104,.85)');
      gr.addColorStop(.7, 'rgba(49,232,255,.55)');
      gr.addColorStop(1, 'rgba(216,255,212,0)');
      g.fillStyle = gr; g.fillRect(w * .3, 0, w * .4, h);
    });
    const coreJet = new THREE.Mesh(new THREE.PlaneGeometry(10, 100),
      new THREE.MeshBasicMaterial({
        map: jetTex, transparent: true, opacity: .45, blending: THREE.AdditiveBlending,
        depthWrite: false, fog: false, side: THREE.DoubleSide
      }));
    coreJet.position.y = 34;
    coreJet.scale.set(1.3, 1.15, 1);
    dataCore.add(coreJet);
    const coreJet2 = coreJet.clone();
    coreJet2.rotation.y = Math.PI / 2;
    dataCore.add(coreJet2);
    const coreGlow = sprite(softTex('#9affb0'), 0x72ff68, 64, .45);
    coreGlow.position.y = 72;
    dataCore.add(coreGlow);
    // z=-200 ならフォグ手前で塔が読め、飛行ライン(z=0)にも食い込まない
    dataCore.position.set(110, -8, -200);
    dataCore.userData = { baseX: 110, span: 780, min: -380 };
    scene.add(dataCore);

    // --- 名物: 電脳都市の高密度ブロック(攻殻機動隊ふうの雑然としたスタック) ---
    // 「サイバー感」は塔の数ではなく**情報量の密度**で出る。不揃いな箱を
    // 積み上げ、細かい窓・屋上の設備(水槽/室外機/アンテナ)・縦書きの看板・
    // 建物間に渡した配線を足して、雨の降る猥雑な高層街をつくる。
    // 配色は寒色の鉄と青緑を基調に、看板だけ暖色(ナトリウム灯)で刺す。
    const cityWinTex = windowTex('#050d11', ['#ffb45a', '#ffd9a0', '#31e8ff', '#7affc8', '#2b4a5c'], 16, 44, .66);
    cityWinTex.repeat.set(2, 2);
    const cityBody = phong({
      map: cityWinTex, color: 0x2e4a56, specular: 0x8ad8e8, shininess: 26,
      emissive: 0x12303c, emissiveIntensity: 1.75, emissiveMap: cityWinTex
    });
    const citySteel = phong({ color: 0x1b2c34, specular: 0x6fb8c8, shininess: 34 });
    const cityCable = basic({ color: 0x0e1a1e, fog: true });
    // 縦書き看板: 漢字を縦に並べた発光板。攻殻の街の記号として一番効く
    const SIGN_WORDS = ['公安九課', '義体調整', '電子戦', '記憶屋', '情報屋',
      '人形遣', '監視局', '義眼堂', '電脳外科', '特殊課', '擬体整備', '光学迷彩',
      '脳梁接続', '思考戦車', '電子薬局', '闇市場', '義肢工房', '第七課',
      '通信傍受', '生体認証', '電脳麻薬', '記憶屋堂'];
    const SIGN_COLS = [['#ff9a3a', '#2a1000'], ['#31e8ff', '#001a22'], ['#ff3a6a', '#22000c'],
      ['#7affc8', '#00220f'], ['#ffe15a', '#221a00']];
    const signTexes = [];
    for (let i = 0; i < 14; i++) {
      const word = SIGN_WORDS[i % SIGN_WORDS.length];
      const [fg, bg] = SIGN_COLS[i % SIGN_COLS.length];
      signTexes.push(makeTex(64, 192, g => {
        g.fillStyle = bg; g.fillRect(0, 0, 64, 192);
        g.strokeStyle = fg; g.lineWidth = 3; g.strokeRect(3, 3, 58, 186);
        g.font = 'bold 40px "Hiragino Sans", "Noto Sans JP", sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = fg;
        for (let k = 0; k < word.length; k++) {
          g.fillText(word[k], 32, 32 + k * 44);
        }
        // 走査線でネオン管のちらつきを表現
        g.globalAlpha = .25; g.fillStyle = '#000';
        for (let y = 0; y < 192; y += 4) g.fillRect(0, y, 64, 1.6);
        g.globalAlpha = 1;
      }));
    }
    const cityBeacons = [];
    const cityBelt = makeScroller(() => {
      const grp = new THREE.Group();
      for (let i = 0; i < 16; i++) {
        const bx = i * 30 + rand(-8, 8), bz = -100 + rand(-34, 34);
        const blk = new THREE.Group();
        // 不揃いな箱を2〜4段積む(段ごとに幅と奥行きをずらして輪郭を崩す)
        let y = -30, wPrev = rand(15, 24);
        const segs = 2 + ((i * 7) % 3);
        for (let sgi = 0; sgi < segs; sgi++) {
          const wSeg = wPrev * rand(.68, .95);
          const hSeg = rand(20, 40);
          const box = new THREE.Mesh(new THREE.BoxGeometry(wSeg, hSeg, wSeg * .78), cityBody);
          box.position.set(rand(-2.5, 2.5), y + hSeg / 2, rand(-2, 2));
          blk.add(box);
          // 各段の庇(ベランダの重なり=密度)
          const ledge = new THREE.Mesh(new THREE.BoxGeometry(wSeg * 1.14, .9, wSeg * .92), citySteel);
          ledge.position.set(box.position.x, y + hSeg, box.position.z);
          blk.add(ledge);
          y += hSeg; wPrev = wSeg;
        }
        const topY = y;
        // 屋上の雑多な設備: 貯水槽・室外機・アンテナ林
        for (let k = 0; k < 3; k++) {
          const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 3.4, 8), citySteel);
          tank.position.set(rand(-5, 5), topY + 1.7, rand(-4, 4));
          blk.add(tank);
        }
        for (let k = 0; k < 4; k++) {
          const ac = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.4, 1.4), citySteel);
          ac.position.set(rand(-7, 7), topY + .7, rand(-4, 5));
          blk.add(ac);
        }
        const mastH = rand(10, 22);
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(.22, .34, mastH, 5), citySteel);
        mast.position.set(rand(-4, 4), topY + mastH / 2, rand(-3, 3));
        blk.add(mast);
        const beacon = sprite(softTex('#ff5a6a'), 0xff3a5a, 5, .7);
        beacon.position.set(mast.position.x, topY + mastH, mast.position.z);
        beacon.userData.ph = rand(0, 6.28);
        blk.add(beacon); cityBeacons.push(beacon);
        // 縦書き看板を側面に張り出す(高さ違いで2枚)
        for (let k = 0; k < 2; k++) {
          const tex = signTexes[(i * 2 + k) % signTexes.length];
          const sgn = k ? 1 : -1;
          const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 14),
            lambert({ map: tex, color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.5, emissiveMap: tex, side: THREE.DoubleSide }));
          sign.position.set(sgn * (wPrev * .55 + 2.6), -30 + rand(16, topY + 26), rand(4, 9));
          sign.rotation.y = sgn * .35;
          blk.add(sign);
          const arm = new THREE.Mesh(new THREE.BoxGeometry(3.4, .3, .3), citySteel);
          arm.position.set(sgn * (wPrev * .4 + 1.4), sign.position.y + 6.6, sign.position.z);
          blk.add(arm);
        }
        blk.position.set(bx, 0, bz);
        grp.add(blk);
      }
      // 建物の間に渡る配線の束: 弛んだ線を数本。雑然さの決め手
      for (let k = 0; k < 15; k++) {
        const x0 = k * 32 + rand(-10, 10), yy = rand(-6, 32);
        const cable = new THREE.Mesh(new THREE.TorusGeometry(30, .22, 4, 12, Math.PI), cityCable);
        cable.rotation.z = Math.PI;
        cable.scale.set(1, .16, 1);
        cable.position.set(x0, yy, -86 + rand(-8, 8));
        grp.add(cable);
      }
      return grp;
    }, 468);
    scene.add(cityBelt.group);

    // --- 中景の塔列: 近景ブロックと大聖堂の間を埋める第2層 ------------------
    // 街は「1列だけ」だと書き割りに見える。奥行きの違う層を重ねると、
    // 隙間から更に奥の灯りが覗いて一気に都市の厚みが出る。
    const midWinTex = windowTex('#040a0e', ['#ffa83a', '#31e8ff', '#6fd8e8', '#1d3644'], 12, 40, .56);
    midWinTex.repeat.set(2, 2);
    const midCityMat = phong({
      map: midWinTex, color: 0x223a46, specular: 0x6fb8d0, shininess: 22,
      emissive: 0x0e2632, emissiveIntensity: 1.45, emissiveMap: midWinTex
    });
    const midCityBelt = makeScroller(() => {
      const grp = new THREE.Group();
      for (let i = 0; i < 19; i++) {
        const w = rand(9, 19), h = rand(44, 104);
        const t2 = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * .7), midCityMat);
        t2.position.set(i * 25 + rand(-8, 8), -30 + h / 2, -138 + rand(-26, 26));
        grp.add(t2);
        // 頂部の細い塔屋とアンテナ(輪郭に凹凸を作る)
        if (i % 2 === 0) {
          const pent = new THREE.Mesh(new THREE.BoxGeometry(w * .45, rand(6, 14), w * .4), citySteel);
          pent.position.set(t2.position.x, -30 + h + 5, t2.position.z);
          grp.add(pent);
        } else {
          const ant = new THREE.Mesh(new THREE.CylinderGeometry(.2, .3, rand(10, 20), 4), citySteel);
          ant.position.set(t2.position.x, -30 + h + 8, t2.position.z);
          grp.add(ant);
        }
      }
      return grp;
    }, 480);
    scene.add(midCityBelt.group);

    // --- 遠景スカイライン: 霧に沈む灯りだけの街(輪郭は塗りつぶし) ----------
    // 個々の建物を作らず、窓明かりを焼いた1枚の帯で「まだ奥がある」を示す。
    const skylineTex = makeTex(512, 256, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      let x = 0;
      while (x < w) {
        const bw = 14 + Math.random() * 34;
        const bh = 60 + Math.random() * 170;
        g.fillStyle = '#0a1c26';
        g.fillRect(x, h - bh, bw, bh);
        g.fillStyle = '#12303e';
        g.fillRect(x, h - bh, bw, 3);
        for (let wy = h - bh + 8; wy < h - 6; wy += 9) {
          for (let wx = x + 3; wx < x + bw - 4; wx += 7) {
            if (Math.random() > .42) continue;
            g.fillStyle = Math.random() < .3 ? 'rgba(255,170,90,.85)' : 'rgba(60,210,240,.8)';
            g.fillRect(wx, wy, 3, 4);
          }
        }
        if (Math.random() < .3) {                       // 屋上の赤灯
          g.fillStyle = 'rgba(255,70,90,.9)';
          g.fillRect(x + bw / 2 - 1, h - bh - 5, 2.5, 2.5);
        }
        x += bw + 2 + Math.random() * 6;
      }
    }, { repX: 3, repY: 1 });
    const skyline = new THREE.Mesh(new THREE.PlaneGeometry(1500, 190),
      basic({ map: skylineTex, transparent: true, depthWrite: false, fog: true }));
    skyline.position.set(0, 34, -250);
    scene.add(skyline);
    // もう一段奥、さらに暗く小さく(空気遠近)
    const skylineFar = new THREE.Mesh(new THREE.PlaneGeometry(1800, 150),
      basic({ map: skylineTex, transparent: true, opacity: .5, color: 0x7fa8bc, depthWrite: false, fog: true }));
    skylineFar.position.set(0, 52, -330);
    scene.add(skylineFar);

    // --- 名物: 巨大ホログラム広告塔(縦長の投影面がビルの間に立つ) ----------
    // 攻殻の街を決定づける「建物より大きい広告」。半透明の加算で、
    // 走査線と横方向のグリッチ帯が走る。
    const BIG_HOLO_WORDS = ['義体調整', '電脳外科', '記憶保証', '光学迷彩', '電子戦',
      '公安九課', '人形遣い', '情報統制', '脳量子波', '擬体整備'];
    const makeBigHoloTex = word => makeTex(160, 512, g => {
      g.clearRect(0, 0, 160, 512);
      g.fillStyle = 'rgba(10,50,60,.22)'; g.fillRect(0, 0, 160, 512);
      g.strokeStyle = '#31e8ff'; g.lineWidth = 3; g.strokeRect(4, 4, 152, 504);
      // 縦書きの大文字
      g.font = 'bold 74px "Hiragino Sans", "Noto Sans JP", sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let k = 0; k < word.length; k++) {
        g.fillStyle = k % 2 ? '#7affc8' : '#31e8ff';
        g.fillText(word[k], 80, 92 + k * 88);
      }
      // 下部に流れる英数字ログ
      g.font = '15px monospace'; g.textAlign = 'left';
      g.fillStyle = 'rgba(122,255,200,.75)';
      for (let k = 0; k < 8; k++) {
        let ln = '';
        for (let c = 0; c < 12; c++) ln += pick('0123456789ABCDEF');
        g.fillText(ln, 12, 452 + k * 7);
      }
      // 走査線
      g.globalAlpha = .3; g.fillStyle = '#000';
      for (let y = 0; y < 512; y += 5) g.fillRect(0, y, 160, 2);
      g.globalAlpha = 1;
    });
    const bigHoloTexes = BIG_HOLO_WORDS.map(makeBigHoloTex);
    const bigHolos = [];
    const bigHoloBelt = makeScroller(() => {
      const grp = new THREE.Group();
      // 広告塔は毎回ちがう文言にする(同じ語が並ぶと看板ではなく壁紙に見える)
      for (let i = 0; i < 3; i++) {
        const tex = pick(bigHoloTexes).clone();
        tex.needsUpdate = true;
        const holo = new THREE.Mesh(new THREE.PlaneGeometry(20, 64),
          new THREE.MeshBasicMaterial({
            map: tex, transparent: true, opacity: .5, blending: THREE.AdditiveBlending,
            depthWrite: false, fog: false, side: THREE.DoubleSide
          }));
        holo.position.set(i * 140 + rand(-18, 18), 12, -78 + rand(-16, 16));
        holo.userData.ph = rand(0, 6.28);
        grp.add(holo); bigHolos.push(holo);
        // 投影の土台(細い柱)と足元の光
        const post = new THREE.Mesh(new THREE.CylinderGeometry(.6, .9, 34, 6), citySteel);
        post.position.set(holo.position.x, -25, holo.position.z);
        grp.add(post);
        const foot = sprite(softTex('#7affc8'), 0x31e8ff, 26, .18);
        foot.position.set(holo.position.x, -18, holo.position.z);
        grp.add(foot);
      }
      return grp;
    }, 420);
    scene.add(bigHoloBelt.group);

    // --- 名物: サーバー大聖堂の尖塔群(中景の主役) ------------------------
    // 「電脳空域」なのに中景が薄く、雲と近景ラックの間が空いていた。雲海から
    // 突き出す巨大なデータセンターの塔を立て、垂直の要素で画面に芯を作る。
    // 高さの根拠: カメラは y=0、水平線は画面 y≈561。塔は y=-30 の雲海から
    // +55 くらいまで伸ばすと画面 y≈330〜560 を占めて「見上げる」画になる。
    const citWinTex = windowTex('#04120f', ['#48e87a', '#31e8ff', '#9affc8'], 10, 34, .66);
    citWinTex.repeat.set(2, 3);
    const citBody = phong({ map: citWinTex, color: 0x2f6c78, specular: 0x9ae8ff, shininess: 40, emissive: 0x0e3340, emissiveIntensity: 1.25, emissiveMap: citWinTex });
    const citDark = phong({ color: 0x0a1c24, specular: 0x48c8e8, shininess: 30 });
    const citNeon = basic({ color: 0x72ff68, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const citBeacons = [];
    const citadelBelt = makeScroller(() => {
      const grp = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const x = i * 120 + rand(-18, 18), z = -168 + rand(-24, 24);
        const w = rand(16, 26), h = rand(66, 104);
        const tower = new THREE.Group();
        const shaft = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * .8), citBody);
        shaft.position.y = -30 + h / 2;
        tower.add(shaft);
        // 控え壁(バットレス): 大聖堂らしい段付きの側面
        for (const sgn of [-1, 1]) {
          const bt = new THREE.Mesh(new THREE.BoxGeometry(w * .3, h * .74, w * .34), citDark);
          bt.position.set(sgn * (w / 2 + w * .12), -30 + h * .37, w * .3);
          tower.add(bt);
        }
        // 冠部の段と尖塔
        const crown = new THREE.Mesh(new THREE.BoxGeometry(w * 1.18, 4, w * .95), citDark);
        crown.position.y = -30 + h + 2;
        tower.add(crown);
        const spire = new THREE.Mesh(new THREE.ConeGeometry(w * .3, 22, 6), citDark);
        spire.position.y = -30 + h + 15;
        tower.add(spire);
        // 頂部の航空障害灯(明滅)
        const beacon = sprite(softTex('#9affc8'), 0x72ff68, 9, .7);
        beacon.position.y = -30 + h + 27;
        beacon.userData.ph = rand(0, 6.28);
        tower.add(beacon); citBeacons.push(beacon);
        // 塔を巻く発光リング(データ帯)
        for (let k = 0; k < 3; k++) {
          const band = new THREE.Mesh(new THREE.BoxGeometry(w * 1.1, .9, w * .9), citNeon);
          band.position.y = -30 + h * (.3 + k * .22);
          tower.add(band);
        }
        // パラボラアンテナ(側面に張り出す)
        const dish = new THREE.Mesh(new THREE.SphereGeometry(4.4, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.4), citDark);
        dish.rotation.set(Math.PI * .62, 0, .3);
        dish.position.set(w / 2 + 3, -30 + h * .82, w * .2);
        tower.add(dish);
        tower.position.set(x, 0, z);
        grp.add(tower);
      }
      return grp;
    }, 480);
    scene.add(citadelBelt.group);

    // --- 浮遊サーバ群(近〜中景) ----------------------------------------
    // 傾いたラックが編隊で流れ、LED が走査する。近景の厚みを作る主役。
    const rackTex = makeTex(64, 128, g => {
      g.fillStyle = '#061a14'; g.fillRect(0, 0, 64, 128);
      for (let y = 0; y < 16; y++) {
        g.fillStyle = y % 3 === 0 ? '#0c3a2e' : '#082820';
        g.fillRect(4, 4 + y * 7.5, 56, 6);
        if (Math.random() < .55) {
          g.fillStyle = pick(['#48e87a', '#31e8ff', '#0d6a3a']);
          g.globalAlpha = rand(.4, 1);
          g.fillRect(8 + rand(0, 40), 5 + y * 7.5, rand(6, 18), 3.5);
        }
      }
      g.globalAlpha = 1;
    });
    const floatRacks = [];
    const rackBelt = makeScroller(() => {
      const grp = new THREE.Group();
      const face = lambert({ map: rackTex, color: 0x3a7a62, emissive: 0xffffff, emissiveIntensity: .75, emissiveMap: rackTex });
      const side = lambert({ color: 0x0a2820 });
      for (let i = 0; i < 6; i++) {
        const w = rand(5, 8), h = rand(10, 18), d = rand(3, 5);
        const rack = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, side, side, face, face]);
        rack.position.set(i * 70 + rand(-10, 10), rand(-4, 22), rand(-72, -42));
        rack.rotation.z = rand(-.18, .18);
        rack.rotation.y = rand(-.25, .25);
        rack.userData.bob = rand(0, 6.28);
        rack.userData.baseY = rack.position.y;
        rack.userData.spin = rand(-.08, .08);
        grp.add(rack);
        // ラック上端の走査ビーム(横に走る細い光)
        const scan = new THREE.Mesh(new THREE.PlaneGeometry(w * .9, .35),
          basic({ color: 0x72ff68, transparent: true, opacity: .7, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
        scan.position.set(rack.position.x, rack.position.y + h * .35, rack.position.z + d * .55);
        scan.userData.scanPh = rand(0, 6.28);
        scan.userData.baseY = scan.position.y;
        scan.userData.bob = rack.userData.bob;
        scan.userData.hHalf = h * .4;
        grp.add(scan);
      }
      return grp;
    }, 420);
    rackBelt.group.traverse(o => {
      if (o.userData && (o.userData.bob !== undefined || o.userData.scanPh !== undefined)) floatRacks.push(o);
    });
    scene.add(rackBelt.group);

    // --- ホログラム広告板 ----------------------------------------------
    const holoTex = makeTex(128, 64, g => {
      g.fillStyle = 'rgba(6,40,30,.15)'; g.fillRect(0, 0, 128, 64);
      g.strokeStyle = '#31e8ff'; g.lineWidth = 2; g.strokeRect(2, 2, 124, 60);
      g.font = 'bold 22px "Hiragino Sans", monospace';
      g.textAlign = 'center';
      g.fillStyle = '#72ff68';
      const words = ['データ', 'SYNC', 'WARN', 'CORE', '電脳', '01', 'LOAD'];
      g.fillText(pick(words), 64, 40);
      for (let i = 0; i < 20; i++) {
        g.fillStyle = pick(['#48e87a', '#31e8ff']);
        g.globalAlpha = rand(.2, .7);
        g.fillRect(rand(6, 120), rand(6, 58), rand(2, 8), 1.5);
      }
      g.globalAlpha = 1;
    });
    const holos = [];
    const holoBelt = makeScroller(() => {
      const grp = new THREE.Group();
      for (let i = 0; i < 5; i++) {
        const tex = holoTex.clone();
        tex.needsUpdate = true;
        const panel = new THREE.Mesh(new THREE.PlaneGeometry(rand(14, 22), rand(7, 11)),
          new THREE.MeshBasicMaterial({
            map: tex, transparent: true, opacity: .55, blending: THREE.AdditiveBlending,
            depthWrite: false, fog: false, side: THREE.DoubleSide
          }));
        panel.position.set(i * 95 + rand(-12, 12), rand(8, 28), rand(-110, -80));
        panel.rotation.y = rand(-.3, .3);
        panel.userData.flick = rand(1.2, 3.5);
        panel.userData.swapT = rand(1, 3);
        grp.add(panel);
        const frame = new THREE.Mesh(new THREE.BoxGeometry(panel.geometry.parameters.width + .6, .25, .25),
          basic({ color: 0x31e8ff, transparent: true, opacity: .4 }));
        frame.position.copy(panel.position);
        frame.position.y += panel.geometry.parameters.height * .52;
        grp.add(frame);
      }
      return grp;
    }, 480);
    holoBelt.group.traverse(o => { if (o.userData && o.userData.flick) holos.push(o); });
    scene.add(holoBelt.group);

    // 落雷の着弾リング(ボルト発生時に地表付近へ展開)
    const strikeRings = [];
    for (let i = 0; i < 4; i++) {
      const ring = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          color: 0xd8ffe8, transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide
        }));
      // soft リング: 衝撃波テクスチャ相当を円で
      ring.material.map = softTex('#ffffff', 64, .55);
      ring.material.needsUpdate = true;
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = -16.5;
      ring.visible = false;
      ring.userData = { life: 0, max: .45 };
      scene.add(ring);
      strikeRings.push(ring);
    }

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
    let strikeIdx = 0;
    return {
      scene,
      update(dt, s) {
        t += dt;
        const dx = SCROLL * (s.speed || 1) * dt;
        const m = moodT(s);
        monoBelt.update(dx);
        spineBelt.update(dx * .8);
        rackBelt.update(dx * 1.05);
        holoBelt.update(dx * .9);
        // 雲デッキ: テクスチャ側を流す(視差付き)。稲光の瞬間だけ濃く光らせる
        for (const deck of cloudDeck) deck.material.map.offset.x += deck.userData.v * dt * .003;
        // 電脳都市: 手前ほど速く流して層を分離させる(近1.02 / 中.72 / 遠はテクスチャ送り)
        cityBelt.update(dx * 1.02);
        midCityBelt.update(dx * .72);
        skylineTex.offset.x += dx * (3 / 1500) * .38;
        bigHoloBelt.update(dx * .95);
        for (let i = 0; i < cityBeacons.length; i++) {
          const bc = cityBeacons[i];
          bc.material.opacity = .2 + .6 * Math.max(0, Math.sin(t * 2.2 + bc.userData.ph));
        }
        // ホログラムは呼吸しつつ、時折グリッチで横に伸び縮みする
        for (const h of bigHolos) {
          const ph = h.userData.ph;
          const glitch = Math.max(0, Math.sin(t * 1.7 + ph) - .93) * 14;
          h.material.opacity = .42 + .12 * Math.sin(t * 2.4 + ph) + glitch * .3;
          h.scale.x = 1 + glitch * .5;
          h.material.map.offset.y = -(t * .06 + ph) % 1;
        }
        cityBody.emissiveIntensity = 1.75 + Math.max(0, flashT / .14) * .9;
        // サーバー大聖堂: 塔が流れ、頂部の障害灯が明滅。稲光で窓が一斉に光る
        citadelBelt.update(dx * .78);
        for (let i = 0; i < citBeacons.length; i++) {
          const bc = citBeacons[i];
          bc.material.opacity = .25 + .55 * Math.max(0, Math.sin(t * 1.8 + bc.userData.ph));
        }
        citBody.emissiveIntensity = 1.25 + Math.max(0, flashT / .14) * 1.1 + m * .25;
        // 眼下の雲海とグリッドはスクロールに追従(グリッドの方が速く=近い)
        seaTex.offset.x += dx * (10 / 1600);
        gridTex.offset.x += dx * (40 / 1600);
        for (const gl of seaGlows) {
          gl.position.x -= dx * .9;
          if (gl.position.x < -280) gl.position.x += 560;
          gl.material.opacity = .08 + .1 * Math.max(0, Math.sin(t * 1.4 + gl.userData.ph));
        }
        for (const b of spineBlinks) b.material.opacity = breath(t, b.userData.blink, .3, .9, 2.2 + m);
        for (const gc of glyphCols) {
          gc.material.map.offset.y += gc.userData.v * dt * (1 + m * .8);
          gc.position.x -= dx * .8;
          if (gc.position.x < gc.userData.min) gc.position.x += gc.userData.span;
          gc.material.opacity = .35 + m * .2;
        }
        for (const pu of pulses) {
          pu.position.x += pu.userData.v * dt * (1 + m * .5) - dx * .7;
          if (pu.position.x < pu.userData.min) pu.position.x += pu.userData.span;
          else if (pu.position.x > pu.userData.min + pu.userData.span) pu.position.x -= pu.userData.span;
        }
        for (const arc of arcs) {
          arc.userData.timer -= dt * (1 + (s.energy || 0) + m);
          if (arc.userData.timer <= 0 && !arc.visible) {
            arc.visible = true; arc.userData.life = .16;
            arc.position.set(rand(-180, 180), rand(-6, 30), rand(-140, -90));
          }
          if (arc.visible) {
            arc.userData.life -= dt;
            arc.material.opacity = Math.max(0, arc.userData.life / .16);
            if (arc.userData.life <= 0) { arc.visible = false; arc.userData.timer = rand(1.5, 4.5) * (1 - m * .4); }
          }
        }
        for (const ring of vortex.children) if (ring.userData && ring.userData.sp) ring.rotation.z = t * ring.userData.sp * (1 + m * .4);
        vorCore.material.opacity = .4 + .18 * Math.sin(t * 1.7) + m * .2;
        const vorScale = 1 + m * .35;
        vortex.scale.setScalar(vorScale);
        for (const o of monoliths) {
          if (o.userData.spin) {
            o.rotation.z += o.userData.spin * dt * (1 + m * .5);
            o.position.y = o.userData.baseY + Math.sin(t * .7 + o.userData.bobSync) * 2.2;
          } else if (o.userData.bob !== undefined) {
            o.position.y = o.userData.baseY + Math.sin(t * .7 + o.userData.bob) * 2.2;
          }
        }
        // データコア: ゆっくり横に流れ、ボス時はリング加速＋噴流が太く
        dataCore.position.x -= dx * .55;
        if (dataCore.position.x < dataCore.userData.min) dataCore.position.x += dataCore.userData.span;
        for (const r of coreRings) r.rotation.z += r.userData.sp * dt * (1 + m * 1.2);
        coreGlow.material.opacity = .3 + .15 * Math.sin(t * 1.5) + m * .25;
        coreJet.material.opacity = .4 + m * .25 + .08 * Math.sin(t * 3);
        coreJet2.material.opacity = coreJet.material.opacity;
        dataCore.scale.setScalar(1 + m * .18);
        // 浮遊ラック: 上下に浮遊＋走査ビームがラック面を往復
        for (const o of floatRacks) {
          if (o.userData.scanPh !== undefined) {
            const ph = (t * 1.4 + o.userData.scanPh) % 1;
            o.position.y = o.userData.baseY + (ph - .5) * o.userData.hHalf * 2;
            o.material.opacity = .45 + .4 * Math.sin(t * 6 + o.userData.scanPh);
          } else if (o.userData.bob !== undefined) {
            o.position.y = o.userData.baseY + Math.sin(t * .9 + o.userData.bob) * 1.8;
            if (o.userData.spin) o.rotation.y += o.userData.spin * dt;
          }
        }
        // ホロ広告: 明滅＋たまにテクスチャ offset で「切替」感
        for (const h of holos) {
          h.material.opacity = .4 + .25 * Math.max(0, Math.sin(t * h.userData.flick));
          h.userData.swapT -= dt;
          if (h.userData.swapT <= 0) {
            h.userData.swapT = rand(1.2, 3.2);
            if (h.material.map) h.material.map.offset.x = Math.random() > .5 ? 0 : .02;
          }
        }
        const rp = rainGeo.attributes.position.array;
        for (let i = 0; i < N_RAIN; i++) {
          let x = rp[i * 6] - (60 * dt + dx * .8), y = rp[i * 6 + 1] - 90 * dt * (1 + m * .3);
          if (y < -45) { y = rand(60, 95); x = rand(-200, 240); }
          if (x < -220) x += 440;
          rp[i * 6] = x; rp[i * 6 + 1] = y;
          rp[i * 6 + 3] = x + 1.2; rp[i * 6 + 4] = y - 3.4;
        }
        rainGeo.attributes.position.needsUpdate = true;
        const dp = dataGeo.attributes.position.array;
        for (let i = 0; i < N_DATA; i++) {
          dp[i * 3] += dataVel[i] * dt * (1 + m) - dx * .6;
          if (dp[i * 3] < -240) dp[i * 3] += 480;
          if (dp[i * 3] > 240) dp[i * 3] -= 480;
        }
        dataGeo.attributes.position.needsUpdate = true;
        // 稲妻: energy が高いほど頻発。warning / boss 中はほぼ連続
        flashT -= dt;
        nextFlash -= dt * (1 + (s.energy || 0) * 2 + (s.warning ? 4 : 0) + (s.boss ? 5 : 0));
        if (nextFlash <= 0) {
          nextFlash = rand(2.2, 6) * (1 - m * .55);
          flashT = .14;
          const b = pick(bolts);
          b.position.set(rand(-170, 170), 0, rand(-190, -110));
          b.visible = true;
          b.material.opacity = 1;
          for (const cf of cloudFlashes) cf.position.set(b.position.x + rand(-40, 40), rand(38, 62), b.position.z - rand(0, 40));
          // 着弾リングを地表へ
          const sr = strikeRings[strikeIdx++ % strikeRings.length];
          sr.position.set(b.position.x, -16.5, Math.min(-40, b.position.z + 40));
          sr.userData.life = sr.userData.max;
          sr.visible = true;
          sr.scale.set(4, 4, 1);
          sr.material.opacity = .7;
        }
        for (const sr of strikeRings) {
          if (!sr.visible) continue;
          sr.userData.life -= dt;
          const k = Math.max(0, sr.userData.life / sr.userData.max);
          const sc = 4 + (1 - k) * 28;
          sr.scale.set(sc, sc, 1);
          sr.material.opacity = .7 * k;
          if (k <= 0) sr.visible = false;
        }
        const f = Math.max(0, flashT / .14);
        flashLight.intensity = f * (2.6 + m * 1.4);
        hemi.intensity = .58 + f * .85 + m * .15;
        for (const cf of cloudFlashes) cf.material.opacity = f * (.55 + m * .2);
        // 稲光は雲を内側から光らせる。雲デッキの濃度を一瞬持ち上げるだけで
        // 「雲の中で光った」ように読める(専用の発光体を増やさずに済む)。
        for (const deck of cloudDeck) deck.material.opacity = deck.userData.base * (1 + f * .5);
        for (const b of bolts) {
          if (!b.visible) continue;
          b.material.opacity = f;
          if (f <= 0) b.visible = false;
        }
        // ボス時: fog を毒緑→黒緑、渦を前へ少し
        mixFog(scene.fog, 0x07171e, 0x030d14, m, 290, 240);
        vortex.position.z = -290 + m * 30;
        vortex.position.y = 52 - m * 8;
      }
    };
  }

  // ============================================================ STAGE 5
  // HEART PALACE — ハートの女王の宮殿。市松床、列柱、ハート窓、シャンデリア。
  function buildPalace() {
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x54103c, 28, 330);
    scene.add(new THREE.HemisphereLight(0xff9ecf, 0x2a0620, 1.0));
    const warm = new THREE.DirectionalLight(0xffd9a0, 1.0);
    warm.position.set(-60, 140, -80);
    scene.add(warm);
    // 手前からのフィル光: 円柱の丸みを起こし、Phong 金の鏡面ハイライトを立てる
    const fill = new THREE.DirectionalLight(0xff8cc0, .4);
    fill.position.set(40, 30, 120);
    scene.add(fill);
    const phong = o => new THREE.MeshPhongMaterial(o);
    // 共有の磨き金。Lambert の平板な金をこれに替えると光源にきらめく
    const goldPolish = phong({ color: 0xffd06a, emissive: 0x8a5c14, emissiveIntensity: .5, specular: 0xfff0c0, shininess: 80 });

    // 磨き大理石の市松床(マゼンタ×深紫): 石目の脈・金の目地を焼き込み、
    // Phong の鏡面でシャンデリアの実光源が「磨いた床」に照り返す
    const checkerTex = makeTex(256, 256, (g, w, h) => {
      for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
        const dark = (x + y) % 2;
        const px = x * w / 2, py = y * h / 2;
        const gr = g.createLinearGradient(px, py, px + w / 2, py + h / 2);
        if (dark) { gr.addColorStop(0, '#4a0e3a'); gr.addColorStop(.5, '#2c0822'); gr.addColorStop(1, '#3c0c30'); }
        else { gr.addColorStop(0, '#a83572'); gr.addColorStop(.5, '#8e2360'); gr.addColorStop(1, '#b23e7c'); }
        g.fillStyle = gr; g.fillRect(px, py, w / 2, h / 2);
        for (let v = 0; v < 4; v++) {
          g.strokeStyle = dark ? 'rgba(255,180,220,.08)' : 'rgba(255,235,246,.16)';
          g.lineWidth = 1 + Math.random() * 1.6;
          const sx = px + Math.random() * w / 2;
          g.beginPath();
          g.moveTo(sx, py);
          g.bezierCurveTo(sx + rand(-22, 22), py + 30, sx + rand(-30, 30), py + 70, sx + rand(-20, 20), py + 128);
          g.stroke();
        }
      }
      g.strokeStyle = 'rgba(232,184,96,.85)'; g.lineWidth = 4;
      g.strokeRect(0, 0, w, h);
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
    }, { repX: 23, repY: 9 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(1500, 560),
      phong({ map: checkerTex, color: 0xffc0dc, specular: 0x907080, shininess: 42 }));
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
      // 金の付柱と腰壁: 遠景でも壁が「建築」として読めるように
      g.fillStyle = 'rgba(232,184,96,.5)';
      g.fillRect(2, 0, 4, h); g.fillRect(130, 0, 4, h);
      g.fillStyle = 'rgba(200,150,70,.6)'; g.fillRect(0, 196, w, 4);
      g.fillStyle = 'rgba(16,3,12,.55)'; g.fillRect(0, 200, w, 40);
      g.fillStyle = 'rgba(232,184,96,.4)';
      for (let i = 0; i < 6; i++) g.fillRect(i * 44 + 14, 206, 16, 26);
    }, { repX: 12, repY: 1 });
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(1300, 130),
      lambert({ map: heartWallTex, color: 0xffb8d8, emissive: 0xffffff, emissiveIntensity: .75, emissiveMap: heartWallTex }));
    wall.position.set(0, 38, -200);
    scene.add(wall);

    // 格天井のフレスコ化: 深紅の格間 + 二重の金縁 + 金ロゼット(花芯)で
    // 「金箔張りの宮殿天井」に。隅の鋲飾りが格子の交点に読める
    const cofferTex = makeTex(128, 128, g => {
      g.fillStyle = '#380a26'; g.fillRect(0, 0, 128, 128);
      g.strokeStyle = '#e0b060'; g.lineWidth = 5; g.strokeRect(4, 4, 120, 120);
      g.strokeStyle = '#8a5c1c'; g.lineWidth = 2; g.strokeRect(13, 13, 102, 102);
      const gr = g.createRadialGradient(64, 64, 8, 64, 64, 72);
      gr.addColorStop(0, '#6a1848'); gr.addColorStop(1, '#4a0e30');
      g.fillStyle = gr; g.fillRect(16, 16, 96, 96);
      g.save();
      g.translate(64, 64);
      g.fillStyle = '#d8a850';
      for (let i = 0; i < 8; i++) {
        g.rotate(Math.PI / 4);
        g.beginPath(); g.ellipse(0, -11, 3.6, 9.5, 0, 0, 6.3); g.fill();
      }
      g.fillStyle = '#ffe9b8'; g.beginPath(); g.arc(0, 0, 4.8, 0, 6.3); g.fill();
      g.restore();
      g.fillStyle = '#c89a4a';
      for (const [cx, cy] of [[8, 8], [120, 8], [8, 120], [120, 120]]) {
        g.beginPath(); g.arc(cx, cy, 4, 0, 6.3); g.fill();
      }
    }, { repX: 44, repY: 8 });
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(1500, 260),
      lambert({ map: cofferTex, color: 0xffc0dc, emissive: 0x1c0712, emissiveIntensity: .8 }));
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, 46, -150);
    scene.add(ceiling);

    // レッドカーペット: 二重の金縁 + 菱形メダリオン + ハート芯の織り込み緋毯
    const carpetTex = makeTex(128, 32, g => {
      const gr = g.createLinearGradient(0, 0, 0, 32);
      gr.addColorStop(0, '#8e1030'); gr.addColorStop(.5, '#b01e40'); gr.addColorStop(1, '#7c0c28');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 32);
      g.fillStyle = '#e0b060'; g.fillRect(0, 0, 128, 3); g.fillRect(0, 29, 128, 3);
      g.strokeStyle = 'rgba(255,220,140,.55)'; g.lineWidth = 1;
      g.strokeRect(0, 5.5, 128, 21);
      for (let i = 0; i < 4; i++) {
        const cx = i * 32 + 16;
        g.strokeStyle = '#e0b060'; g.lineWidth = 1.6;
        g.beginPath();
        g.moveTo(cx - 9, 16); g.lineTo(cx, 7); g.lineTo(cx + 9, 16); g.lineTo(cx, 25);
        g.closePath(); g.stroke();
        g.fillStyle = '#ff7ab8';
        g.beginPath(); g.arc(cx, 16, 2.4, 0, 6.3); g.fill();
      }
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

    // --- 鏡の回廊: 金縁アーチ鏡(ヴェルサイユ風)。窓と交互に並び、
    // 映り込みの光条と蝋燭のぼかしを焼き込んで「磨かれた鏡面」に読ませる ---
    const mirrorTex = makeTex(96, 192, g => {
      g.fillStyle = '#6a4514'; g.fillRect(0, 0, 96, 192);
      g.strokeStyle = '#e0b060'; g.lineWidth = 5;
      g.strokeRect(2.5, 2.5, 91, 187);
      const arch = () => {
        g.beginPath();
        g.moveTo(12, 184); g.lineTo(12, 58); g.quadraticCurveTo(48, 8, 84, 58); g.lineTo(84, 184); g.closePath();
      };
      arch();
      const gr = g.createLinearGradient(12, 184, 84, 20);
      gr.addColorStop(0, '#2c0820');
      gr.addColorStop(.45, '#6a2050');
      gr.addColorStop(.75, '#a04a80');
      gr.addColorStop(1, '#d886b4');
      g.fillStyle = gr; g.fill();
      g.save(); arch(); g.clip();
      g.globalAlpha = .35;
      g.fillStyle = '#ffe4f2';
      g.rotate(-.5);
      g.fillRect(-40, 90, 220, 10);
      g.fillRect(-40, 112, 220, 4);
      g.globalAlpha = .16; g.fillRect(-40, 128, 220, 18);
      g.restore();
      g.globalAlpha = .55;
      for (const [cx, cy, r] of [[30, 120, 5], [62, 100, 4], [46, 142, 3]]) {
        const rg = g.createRadialGradient(cx, cy, 0, cx, cy, r * 3);
        rg.addColorStop(0, '#ffe9b8'); rg.addColorStop(1, 'rgba(255,210,140,0)');
        g.fillStyle = rg; g.beginPath(); g.arc(cx, cy, r * 3, 0, 6.3); g.fill();
      }
      g.globalAlpha = 1;
      g.strokeStyle = '#c89a4a'; g.lineWidth = 3; arch(); g.stroke();
      g.fillStyle = '#ffd06a';
      g.translate(48, 26);
      g.beginPath();
      g.moveTo(0, 8); g.bezierCurveTo(-10, -4, -5, -12, 0, -4); g.bezierCurveTo(5, -12, 10, -4, 0, 8);
      g.fill();
    });
    // 鏡面のきらめきは emissiveIntensity を揺らして表現(マテリアル共有で一括)
    const mirrorMat = lambert({ map: mirrorTex, color: 0xffc8dc, emissive: 0xffffff, emissiveIntensity: .4, emissiveMap: mirrorTex });
    // 王妃の肖像画: 金の額縁 + 緋ビロード地にハート顔の女王(ギャラリー回廊)
    const portraitTex = makeTex(96, 128, g => {
      g.fillStyle = '#8a5c1c'; g.fillRect(0, 0, 96, 128);
      g.strokeStyle = '#e8c070'; g.lineWidth = 6; g.strokeRect(3, 3, 90, 122);
      g.strokeStyle = '#6a4514'; g.lineWidth = 2; g.strokeRect(9, 9, 78, 110);
      g.fillStyle = '#ffd98a';
      for (const [cx, cy] of [[6, 6], [90, 6], [6, 122], [90, 122]]) {
        g.beginPath(); g.arc(cx, cy, 4, 0, 6.3); g.fill();
      }
      const gr = g.createRadialGradient(48, 56, 6, 48, 64, 70);
      gr.addColorStop(0, '#7a1440'); gr.addColorStop(1, '#38081e');
      g.fillStyle = gr; g.fillRect(11, 11, 74, 106);
      g.fillStyle = '#2a0616';
      g.beginPath(); g.arc(48, 52, 24, 0, 6.3); g.fill();
      g.fillStyle = '#ffb8d4';
      g.translate(48, 52);
      g.beginPath();
      g.moveTo(0, 16); g.bezierCurveTo(-20, -6, -10, -22, 0, -8); g.bezierCurveTo(10, -22, 20, -6, 0, 16);
      g.fill();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = '#1c0410';
      g.beginPath(); g.arc(42, 50, 1.8, 0, 6.3); g.fill();
      g.beginPath(); g.arc(54, 50, 1.8, 0, 6.3); g.fill();
      g.fillStyle = '#ffd06a';
      g.beginPath();
      g.moveTo(34, 34); g.lineTo(38, 24); g.lineTo(44, 32); g.lineTo(48, 22); g.lineTo(52, 32); g.lineTo(58, 24); g.lineTo(62, 34);
      g.closePath(); g.fill();
      g.fillStyle = '#a01838';
      g.beginPath(); g.moveTo(48, 66); g.lineTo(24, 112); g.lineTo(72, 112); g.closePath(); g.fill();
      g.fillStyle = '#ffd06a'; g.fillRect(44, 74, 8, 3);
    });
    const portraitMat = lambert({ map: portraitTex, color: 0xffc8dc, emissive: 0xffffff, emissiveIntensity: .28, emissiveMap: portraitTex });
    const sconceFlames = [];
    const mirrorBelt = makeScroller(() => {
      const grp = new THREE.Group();
      for (let i = 0; i < 6; i++) {
        // 鏡と肖像画を交互に掛けてギャラリー回廊にする
        const mr = i % 2
          ? new THREE.Mesh(new THREE.PlaneGeometry(9.5, 12.7), portraitMat)
          : new THREE.Mesh(new THREE.PlaneGeometry(10.5, 21), mirrorMat);
        mr.position.set(i * 88 + 44, i % 2 ? 14 : 11, -134);
        grp.add(mr);
        // 鏡の脇の金燭台(腕金+火)
        for (const sgn of [-1, 1]) {
          const arm = new THREE.Mesh(new THREE.BoxGeometry(.5, 2.6, .5), goldPolish);
          arm.position.set(mr.position.x + sgn * 7.4, 6.5, -133.5);
          grp.add(arm);
          const fl = sprite(softTex('#ffe9b8', 64, .3), 0xffd98a, 2.4, .9);
          fl.position.set(arm.position.x, 8.6, -133.2);
          fl.userData.flick = rand(0, 6.28);
          grp.add(fl);
        }
      }
      return grp;
    }, 530);
    mirrorBelt.group.traverse(o => { if (o.userData && o.userData.flick !== undefined) sconceFlames.push(o); });
    scene.add(mirrorBelt.group);

    // (床レベル y<0 の小物は2Dの手すりレイヤーに完全に隠れるため置かない —
    //  スタンション柵・宴卓を試したが全て不可視だった。豪華さは可視帯 y=0..46 に投資する)

    // ベルベットの緞帳: 深紅の襞+金の締め帯。天井レールを支点に揺れる
    const drapeTex = makeTex(96, 160, g => {
      for (let i = 0; i < 8; i++) {
        const x = i * 12;
        const gr = g.createLinearGradient(x, 0, x + 12, 0);
        gr.addColorStop(0, '#560d22');
        gr.addColorStop(.45, '#a01838');
        gr.addColorStop(1, '#42081a');
        g.fillStyle = gr; g.fillRect(x, 0, 12, 160);
      }
      g.fillStyle = '#e0b060'; g.fillRect(0, 0, 96, 6);        // 上部の金レール
      g.fillStyle = '#c89a4a'; g.fillRect(0, 88, 96, 9);       // 金の締め帯
      g.fillStyle = '#2e0512';                                  // すそのスカラップ
      for (let i = 0; i < 8; i++) {
        g.beginPath(); g.arc(i * 12 + 6, 160, 7, Math.PI, 0); g.fill();
      }
      g.fillStyle = '#e0b060';                                  // 房飾り
      for (let i = 0; i < 8; i++) g.fillRect(i * 12 + 4.5, 150, 3, 8);
    });
    const drapeBelt = makeScroller(() => {
      const grp = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const dr = new THREE.Mesh(new THREE.PlaneGeometry(13, 27),
          lambert({ map: drapeTex, side: THREE.DoubleSide, emissive: 0x30040e, emissiveIntensity: .5 }));
        dr.geometry = dr.geometry.clone();
        dr.geometry.translate(0, -13.5, 0);      // 天井レール側を支点に揺らす
        dr.position.set(i * 132 + 48 + rand(-6, 6), 41, -131);
        dr.userData.sway = rand(0, 6.28);
        grp.add(dr);
      }
      return grp;
    }, 530);
    const drapes = [];
    drapeBelt.group.traverse(o => { if (o.userData && o.userData.sway !== undefined) drapes.push(o); });
    scene.add(drapeBelt.group);

    // 2階回廊の金の欄干(透過テクスチャの帯1枚 = 1ドローコール/タイル)
    const balusTex = makeTex(256, 64, g => {
      g.clearRect(0, 0, 256, 64);
      g.fillStyle = '#e0b060'; g.fillRect(0, 2, 256, 7);
      g.fillStyle = '#b8863a'; g.fillRect(0, 54, 256, 6);
      for (let x = 8; x < 256; x += 16) {
        g.fillStyle = '#c89a4a';
        g.fillRect(x - 2, 9, 4, 45);                            // 芯
        g.beginPath(); g.ellipse(x, 22, 5, 8, 0, 0, 6.3); g.fill();   // 壺形の膨らみ
        g.fillRect(x - 4, 48, 8, 5);                            // 台座
      }
    }, { repX: 9, repY: 1 });
    // 明るくしすぎると「画面中央の柵」に見えて主張しすぎる — 暗金でフォグに沈める
    const balusBelt = makeScroller(() => {
      const grp = new THREE.Group();
      const rail = new THREE.Mesh(new THREE.PlaneGeometry(470, 7),
        lambert({ map: balusTex, transparent: true, alphaTest: .15, opacity: .8, side: THREE.DoubleSide, color: 0x9a7a40, emissive: 0x2a1c06, emissiveIntensity: .3 }));
      rail.position.set(235, 19, -138);
      grp.add(rail);
      return grp;
    }, 470);
    scene.add(balusBelt.group);

    // 漂う金のハート灯籠(紙灯籠がゆっくり流れて上下する)
    const lanternTex = makeTex(48, 64, g => {
      g.clearRect(0, 0, 48, 64);
      const gr = g.createLinearGradient(0, 8, 0, 54);
      gr.addColorStop(0, '#ffe9a8');
      gr.addColorStop(.5, '#ffc86a');
      gr.addColorStop(1, '#ff9a4a');
      g.fillStyle = gr;
      g.beginPath(); g.roundRect(9, 8, 30, 46, 9); g.fill();
      g.fillStyle = 'rgba(200,110,40,.85)';                     // ハートの透かし
      g.translate(24, 32);
      g.beginPath();
      g.moveTo(0, 9); g.bezierCurveTo(-13, -5, -7, -15, 0, -5);
      g.bezierCurveTo(7, -15, 13, -5, 0, 9);
      g.fill();
      g.translate(-24, -32);
      g.fillStyle = '#c89a4a';                                  // 金の口金
      g.fillRect(15, 4, 18, 5); g.fillRect(15, 53, 18, 5);
    });
    const lanterns = [];
    for (let i = 0; i < 9; i++) {
      const ln = new THREE.Group();
      const body = sprite(lanternTex, 0xffffff, rand(4.2, 6), .95, THREE.NormalBlending);
      ln.add(body);
      const gl = sprite(softTex('#ffd98a'), 0xffc86a, 9, .3);
      ln.add(gl);
      ln.position.set(rand(-210, 210), rand(-4, 30), rand(-115, -58));
      ln.userData = { ph: rand(0, 6.28), min: -230, span: 460, gl };
      scene.add(ln); lanterns.push(ln);
    }

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

    // 列柱: 縦溝彫り(フルーティング)の大理石円柱 + 金の柱環 + アーチ連結(回廊感)
    // 溝の明暗をテクスチャに焼くと平板な円柱が「彫りの深い石柱」に読める
    const flutedTex = makeTex(128, 64, g => {
      for (let i = 0; i < 8; i++) {
        const x = i * 16;
        const gr = g.createLinearGradient(x, 0, x + 16, 0);
        gr.addColorStop(0, '#9c5f80');
        gr.addColorStop(.28, '#ffeaf2');
        gr.addColorStop(.55, '#f2c4d8');
        gr.addColorStop(1, '#8a4e70');
        g.fillStyle = gr; g.fillRect(x, 0, 16, 64);
      }
    }, { repX: 2, repY: 5 });
    const flutedMat = lambert({ map: flutedTex, color: 0xffffff });
    let garlandMat = null;      // 柱頭間の光の鎖(クローンとマテリアル共有、一括明滅)
    const colBelt = makeScroller(() => {
      const grp = new THREE.Group();
      const marble = flutedMat;
      const gold = goldPolish;
      const archMat = lambert({ color: 0xffc8dc, emissive: 0x662040, emissiveIntensity: .25 });
      const N = 8, GAP = 46;
      // 宴の光の鎖: 柱頭の間を弛んで渡る光点列(Points 1個 = 1ドローコール)。
      // 最後の区間は次タイル先頭へ繋がる(span = N*GAP なので継ぎ目が合う)
      const gPts = [];
      for (let i = 0; i < N; i++) {
        for (let k = 1; k < 6; k++) {
          const f = k / 6;
          gPts.push(i * GAP + GAP * f, 33 - 3.4 * Math.sin(Math.PI * f), -76.5);
        }
      }
      const gGeo = new THREE.BufferGeometry();
      gGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(gPts), 3));
      garlandMat = new THREE.PointsMaterial({
        color: 0xffe9b8, size: 3, transparent: true, opacity: .75,
        blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: false, fog: false
      });
      grp.add(new THREE.Points(gGeo, garlandMat));
      // 柱環(柱頭下・柱脚上の金の絞り)は InstancedMesh にまとめて1ドローコール
      const ringInst = new THREE.InstancedMesh(new THREE.TorusGeometry(2.45, .5, 8, 18), gold, N * 2);
      {
        const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
        _e.set(Math.PI / 2, 0, 0); _q.setFromEuler(_e);
        for (let i = 0; i < N; i++) {
          _m.compose(new THREE.Vector3(i * GAP, 33.6, -78), _q, new THREE.Vector3(1, 1, 1));
          ringInst.setMatrixAt(i * 2, _m);
          _m.compose(new THREE.Vector3(i * GAP, -14.8, -78), _q, new THREE.Vector3(1.15, 1.15, 1));
          ringInst.setMatrixAt(i * 2 + 1, _m);
        }
        ringInst.instanceMatrix.needsUpdate = true;
      }
      grp.add(ringInst);
      // 薔薇の花綱(スワッグ): 柱頭の間を弛んで渡る葉綱 + 薔薇の花を散らす。
      // 葉綱は半トーラス1本/区間、薔薇は全区間まとめて1つの InstancedMesh
      {
        const leafMat = lambert({ color: 0x2a5c3a, emissive: 0x0e2a16, emissiveIntensity: .5 });
        const swagInst = new THREE.InstancedMesh(new THREE.TorusGeometry(GAP / 2 - 2.4, .55, 5, 16, Math.PI), leafMat, N);
        const roseInst = new THREE.InstancedMesh(new THREE.SphereGeometry(.62, 6, 5),
          lambert({ color: 0xffffff, emissive: 0x552030, emissiveIntensity: .6 }), N * 5);
        const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _v = new THREE.Vector3();
        const _c = new THREE.Color();
        const roseCols = [0xff5a8c, 0xff9ecf, 0xffd06a, 0xff3e6a];
        for (let i = 0; i < N; i++) {
          _e.set(0, 0, Math.PI); _q.setFromEuler(_e); _s.set(1, .3, 1);
          _v.set(i * GAP + GAP / 2, 30.8, -77.2);
          _m.compose(_v, _q, _s); swagInst.setMatrixAt(i, _m);
          for (let k = 0; k < 5; k++) {
            const f = (k + .5) / 5;
            const sag = Math.sin(Math.PI * f) * (GAP / 2 - 2.4) * .3;
            _q.identity(); _s.setScalar(rand(.8, 1.25));
            _v.set(i * GAP + 2.4 + (GAP - 4.8) * f, 30.8 - sag, -77);
            _m.compose(_v, _q, _s);
            roseInst.setMatrixAt(i * 5 + k, _m);
            _c.set(roseCols[(i + k) % roseCols.length]);
            roseInst.setColorAt(i * 5 + k, _c);
          }
        }
        swagInst.instanceMatrix.needsUpdate = true;
        roseInst.instanceMatrix.needsUpdate = true;
        if (roseInst.instanceColor) roseInst.instanceColor.needsUpdate = true;
        grp.add(swagInst, roseInst);
      }
      for (let i = 0; i < N; i++) {
        const x = i * GAP;
        const col = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 52, 12), marble);
        col.position.set(x, 9, -78);
        grp.add(col);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(6.4, 2, 6.4), gold);
        cap.position.set(x, 35.6, -78); grp.add(cap);
        const base = new THREE.Mesh(new THREE.BoxGeometry(6.8, 2.4, 6.8), gold);
        base.position.set(x, -16.5, -78); grp.add(base);
        const lamp = sprite(softTex('#ffd9ec'), 0xff9ecf, 8, .4);
        lamp.position.set(x, 20, -75);
        grp.add(lamp);
        // 隣柱とアーチで繋ぐ(最後の柱は次タイルへ)
        if (i < N - 1) {
          const arch = new THREE.Mesh(
            new THREE.TorusGeometry(GAP / 2 - .4, .7, 6, 14, Math.PI),
            archMat
          );
          arch.rotation.y = Math.PI / 2;
          arch.rotation.z = Math.PI;           // 上向きアーチ
          arch.position.set(x + GAP / 2, 34, -78);
          grp.add(arch);
        }
      }
      return grp;
    }, 368);
    scene.add(colBelt.group);

    // 二重列柱(奥列): 遠近の回廊を強調
    const colFarBelt = makeScroller(() => {
      const grp = new THREE.Group();
      const marble = lambert({ map: flutedTex, color: 0xd8a0c0 });
      const gold = lambert({ color: 0xc89a4a, emissive: 0x553308, emissiveIntensity: .4 });
      for (let i = 0; i < 6; i++) {
        const x = i * 58;
        const col = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.9, 44, 8), marble);
        col.position.set(x, 6, -118);
        grp.add(col);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.6, 4.6), gold);
        cap.position.set(x, 28.5, -118); grp.add(cap);
      }
      return grp;
    }, 350);
    scene.add(colFarBelt.group);

    // シャンデリア: 金のリング + 蝋燭の光点。ゆっくり揺れる
    const chandeliers = [];
    const chBelt = makeScroller(() => {
      const grp = new THREE.Group();
      const gold = phong({ color: 0xffce6a, emissive: 0x7a5510, emissiveIntensity: .6, specular: 0xfff0c0, shininess: 70 });
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

    // --- 名物: 巨大中央シャンデリア(三層リング+実体蝋燭+クリスタル満載) ---
    const bigCh = new THREE.Group();
    const goldBig = phong({ color: 0xffce6a, emissive: 0xaa7720, emissiveIntensity: .7, specular: 0xfff4d0, shininess: 90 });
    const goldDark = phong({ color: 0xd8a850, emissive: 0x6a4a10, emissiveIntensity: .5, specular: 0xffe8b0, shininess: 60 });
    // クリスタル: 鏡面ハイライトの効く Phong。半透明で「ガラスの粒」に読ませる
    const crysMat = new THREE.MeshPhongMaterial({
      color: 0xffffff, emissive: 0xe8d8b8, emissiveIntensity: .55,
      specular: 0xffffff, shininess: 90, transparent: true, opacity: .95
    });
    // 芯棒と金の宝珠
    const chStem = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, 20, 6), goldBig);
    chStem.position.y = 2; bigCh.add(chStem);
    for (const [oy, or] of [[11, 1.5], [7.5, 1.1], [-4.5, 1.3]]) {
      const orb = new THREE.Mesh(new THREE.SphereGeometry(or, 10, 8), goldBig);
      orb.position.y = oy; bigCh.add(orb);
    }
    // 三層の金リング(下ほど大きく)
    for (const [r, y, tube] of [[13, 0, .8], [9, 4.2, .6], [5.5, 8, .5]]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 36), goldBig);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      bigCh.add(ring);
    }
    // 蝋燭: 外周16 + 中周8。金の受け皿と白蝋は InstancedMesh(各1ドローコール)
    const chFlames = [];
    {
      const cupInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(.6, .38, .55, 8), goldDark, 24);
      const waxMat = lambert({ color: 0xfff4e0, emissive: 0x776650, emissiveIntensity: .35 });
      const candleInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(.22, .27, 1.6, 6), waxMat, 24);
      const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _m = new THREE.Matrix4();
      let ci = 0;
      const addCandle = (x, y, z) => {
        _v.set(x, y + .3, z); _m.compose(_v, _q, _s); cupInst.setMatrixAt(ci, _m);
        _v.set(x, y + 1.3, z); _m.compose(_v, _q, _s); candleInst.setMatrixAt(ci, _m);
        ci++;
        const fl = sprite(softTex('#ffe9b8', 64, .3), 0xffe9b8, 2.7, .95);
        fl.position.set(x, y + 2.5, z);
        fl.userData.ph = Math.random() * 6.28;
        bigCh.add(fl); chFlames.push(fl);
      };
      for (let j = 0; j < 16; j++) {
        const a = j / 16 * Math.PI * 2;
        addCandle(Math.cos(a) * 13, .4, Math.sin(a) * 13);
      }
      for (let j = 0; j < 8; j++) {
        const a = (j + .5) / 8 * Math.PI * 2;
        addCandle(Math.cos(a) * 9, 4.6, Math.sin(a) * 9);
      }
      cupInst.instanceMatrix.needsUpdate = true;
      candleInst.instanceMatrix.needsUpdate = true;
      bigCh.add(cupInst, candleInst);
    }
    // クリスタルの垂れ飾り: 上段→下段へ弛むドレープ12条 + 下段から垂れる16条 +
    // 中心の縦鎖。全粒を1つの InstancedMesh に焼く(静的なので行列は一度だけ)
    {
      const nCr = 12 * 6 + 16 * 3 + 4;
      const crysInst = new THREE.InstancedMesh(new THREE.OctahedronGeometry(.42, 0), crysMat, nCr);
      const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _m = new THREE.Matrix4();
      let ci = 0;
      // 乱回転させると紙吹雪に見える — 吊り飾りは垂直姿勢(y回転のみ)で揃える
      const put = (x, y, z, sc) => {
        _e.set(0, Math.random() * 3.14, 0);
        _q.setFromEuler(_e);
        _v.set(x, y, z); _s.set(sc * .8, sc * 1.5, sc * .8);
        _m.compose(_v, _q, _s);
        crysInst.setMatrixAt(ci++, _m);
      };
      for (let j = 0; j < 12; j++) {
        const a = j / 12 * Math.PI * 2;
        for (let k = 0; k < 6; k++) {
          const f = (k + .5) / 6;
          const r = 5.5 + (13 - 5.5) * f;
          const y = 8 - 7.5 * f - 2.1 * Math.sin(Math.PI * f);
          put(Math.cos(a) * r, y, Math.sin(a) * r, .9 - f * .25);
        }
      }
      for (let j = 0; j < 16; j++) {
        const a = (j + .5) / 16 * Math.PI * 2;
        for (let k = 0; k < 3; k++) {
          put(Math.cos(a) * (13 - k * .3), -1 - k * 1.5, Math.sin(a) * (13 - k * .3), .85 - k * .18);
        }
      }
      for (let k = 0; k < 4; k++) put(0, -6 - k * 1.1, 0, .8);
      crysInst.instanceMatrix.needsUpdate = true;
      bigCh.add(crysInst);
    }
    // 最下端の大粒ティアドロップ(ゆっくり回って光を撒く)
    const bigCrys = new THREE.Mesh(new THREE.OctahedronGeometry(1.5, 0), crysMat);
    bigCrys.scale.set(1, 1.7, 1);
    bigCrys.position.y = -11.6;
    bigCh.add(bigCrys);
    const bigCrysGlow = sprite(softTex('#fff2d8'), 0xffe9b8, 7, .5);
    bigCrysGlow.position.y = -11.6;
    bigCh.add(bigCrysGlow);
    // クリスタルの瞬き(グリント)。個別マテリアルなので1個ずつ明滅できる
    const glintTex = makeTex(48, 48, g => {
      g.translate(24, 24);
      g.fillStyle = 'rgba(255,255,255,.95)';
      g.shadowColor = 'rgba(255,255,255,.9)'; g.shadowBlur = 6;
      for (const [len, wid] of [[20, 2.6], [11, 1.8]]) {
        g.beginPath();
        g.moveTo(0, -len); g.lineTo(wid, 0); g.lineTo(0, len); g.lineTo(-wid, 0);
        g.closePath(); g.fill();
        g.rotate(Math.PI / 2);
      }
    });
    const chTwinkles = [];
    for (let j = 0; j < 12; j++) {
      const a = Math.random() * Math.PI * 2, f = Math.random();
      const r = 5.5 + 8 * f;
      const tw = sprite(glintTex, 0xfff6e0, 2.4, 0);
      tw.position.set(Math.cos(a) * r, 8 - 8.5 * f - Math.random() * 3, Math.sin(a) * r);
      tw.userData.ph = Math.random() * 6.28;
      bigCh.add(tw); chTwinkles.push(tw);
    }
    // 実光源: シャンデリアが本当に周囲(柱・像・床)を照らす。音楽と mood で脈動
    const chLight = new THREE.PointLight(0xffd9a0, 1.2, 150, 1.3);
    chLight.position.y = 1;
    bigCh.add(chLight);
    // 吊り鎖
    const bigChain = new THREE.Mesh(new THREE.CylinderGeometry(.28, .28, 28, 5), goldBig);
    bigChain.position.y = 26;
    bigCh.add(bigChain);
    const bigGlow = sprite(softTex('#ffe9b8'), 0xffd06a, 40, .28);
    bigGlow.position.y = 2;
    bigCh.add(bigGlow);
    // 画面右上〜中央寄りに据えて「大広間の主役照明」として読ませる
    bigCh.position.set(20, 30, -48);
    bigCh.scale.setScalar(1.15);
    bigCh.userData.sway = 0.4;
    scene.add(bigCh);
    chandeliers.push(bigCh);
    // 床の照り返し(シャンデリア直下の金のスミア)
    const chSmear = new THREE.Mesh(new THREE.PlaneGeometry(54, 18),
      basic({ color: 0xffd06a, transparent: true, opacity: .1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    chSmear.rotation.x = -Math.PI / 2;
    chSmear.position.set(20, -16.8, -48);
    chSmear.renderOrder = 2;
    scene.add(chSmear);

    // --- 名物: 玉座(遠景・ボス時に近づき・明るく) ----------------------
    const crestTex = makeTex(64, 64, g => {
      g.translate(32, 34);
      g.fillStyle = '#ff3e9d';
      g.shadowColor = '#ff3e9d'; g.shadowBlur = 10;
      g.beginPath();
      g.moveTo(0, 12);
      g.bezierCurveTo(-26, -12, -13, -30, 0, -12);
      g.bezierCurveTo(13, -30, 26, -12, 0, 12);
      g.fill();
    });
    const throne = new THREE.Group();
    const throneMarble = lambert({ color: 0xffdae8, emissive: 0x662040, emissiveIntensity: .2 });
    const throneGold = phong({ color: 0xffd06a, emissive: 0xaa7720, emissiveIntensity: .65, specular: 0xfff0c0, shininess: 70 });
    const throneRed = lambert({ color: 0xa01838, emissive: 0x600820, emissiveIntensity: .4 });
    // 段丘
    for (let i = 0; i < 4; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(36 - i * 4, 1.6, 10), throneMarble);
      step.position.set(0, -16 + i * 1.6, -4 - i * 3);
      throne.add(step);
    }
    // 背もたれ
    const back = new THREE.Mesh(new THREE.BoxGeometry(14, 22, 2.4), throneRed);
    back.position.set(0, 2, -18);
    throne.add(back);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(12, 2, 8), throneRed);
    seat.position.set(0, -6, -14);
    throne.add(seat);
    // 天蓋
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(20, 1.2, 12), throneGold);
    canopy.position.set(0, 14, -16);
    throne.add(canopy);
    const canopyPoleL = new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, 28, 6), throneGold);
    canopyPoleL.position.set(-9, 0, -12); throne.add(canopyPoleL);
    const canopyPoleR = canopyPoleL.clone();
    canopyPoleR.position.x = 9; throne.add(canopyPoleR);
    // ハート紋章
    const crest = sprite(crestTex, 0xffffff, 14, .95);
    crest.position.set(0, 8, -16.5);
    crest.userData.pulse = 0;
    throne.add(crest);
    const throneGlow = sprite(softTex('#ff9ecf'), 0xff5aa8, 40, .2);
    throneGlow.position.set(0, 4, -12);
    throne.add(throneGlow);
    throne.position.set(0, 0, -165);
    throne.userData = { baseZ: -165, crest, glow: throneGlow };
    scene.add(throne);

    // ステンドの床ライトプール(色つき光が床に落ちる)
    const lightPools = [];
    const poolBelt = makeScroller(() => {
      const grp = new THREE.Group();
      const cols = [0xff5a8c, 0xffd06a, 0x7ab8ff, 0xff9ecf];
      for (let i = 0; i < 6; i++) {
        const c = cols[i % cols.length];
        const pool = new THREE.Mesh(new THREE.PlaneGeometry(rand(10, 16), rand(18, 28)),
          basic({ color: c, transparent: true, opacity: .14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
        pool.rotation.x = -Math.PI / 2;
        pool.position.set(i * 88 + rand(-10, 10), -16.7, rand(-130, -90));
        pool.userData.ph = rand(0, 6.28);
        grp.add(pool);
      }
      return grp;
    }, 530);
    poolBelt.group.traverse(o => { if (o.userData && o.userData.ph !== undefined) lightPools.push(o); });
    scene.add(poolBelt.group);

    // --- クラブ PA スタック(左右・近景) BGM で振動 ----------------------
    // 2D スピーカーは画面端手前、3D は少し奥の巨大塔で奥行きを出す。
    function buildSpeakerStack() {
      const g = new THREE.Group();
      const bodyMat = lambert({ color: 0x1a0e38, emissive: 0x2a1550, emissiveIntensity: .35 });
      const faceMat = lambert({ color: 0x120a28, emissive: 0x3a2060, emissiveIntensity: .25 });
      const goldMat = lambert({ color: 0xffe15a, emissive: 0xaa7720, emissiveIntensity: .55 });
      const cones = [];
      const cabs = [
        { w: 14, h: 16, d: 12, y: 0 },
        { w: 12, h: 12, d: 10, y: 14.5 },
        { w: 10, h: 9, d: 9, y: 26 }
      ];
      for (const c of cabs) {
        const body = new THREE.Mesh(new THREE.BoxGeometry(c.w, c.h, c.d), bodyMat);
        body.position.y = c.y + c.h / 2 - 17;
        g.add(body);
        const face = new THREE.Mesh(new THREE.BoxGeometry(c.w * .92, c.h * .88, .4), faceMat);
        face.position.set(0, body.position.y, c.d / 2 + .3);
        g.add(face);
        const coneR = c.w * .32;
        const cone = new THREE.Mesh(
          new THREE.CircleGeometry(coneR, 16),
          basic({ color: 0xff9ecf, transparent: true, opacity: .7, side: THREE.DoubleSide })
        );
        cone.position.set(0, body.position.y - c.h * .08, c.d / 2 + .55);
        cone.userData.baseR = coneR;
        g.add(cone);
        cones.push(cone);
        for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const bit = new THREE.Mesh(new THREE.BoxGeometry(.6, .6, .6), goldMat);
          bit.position.set(sx * c.w * .42, body.position.y + sy * c.h * .38, c.d / 2 + .2);
          g.add(bit);
        }
      }
      const led = new THREE.Mesh(new THREE.BoxGeometry(8, .6, .4),
        basic({ color: 0xff3e9d, transparent: true, opacity: .8 }));
      led.position.set(0, 18, 5.5);
      g.add(led);
      g.userData.cones = cones;
      g.userData.led = led;
      g.userData.baseY = 0;
      return g;
    }
    const spkL = buildSpeakerStack();
    spkL.position.set(-42, 0, -38);
    spkL.rotation.y = .25;
    scene.add(spkL);
    const spkR = buildSpeakerStack();
    spkR.position.set(42, 0, -38);
    spkR.rotation.y = -.25;
    scene.add(spkR);
    const speakerStacks = [spkL, spkR];

    // 舞い散る薔薇花びら(金・薄ピンク — 弾と被らない色)
    const N_PETAL = 48;
    const petalPos = new Float32Array(N_PETAL * 3);
    const petalVel = new Float32Array(N_PETAL * 3);
    const petalCol = new Float32Array(N_PETAL * 3);
    const pCol = new THREE.Color();
    for (let i = 0; i < N_PETAL; i++) {
      petalPos[i * 3] = rand(-220, 220);
      petalPos[i * 3 + 1] = rand(-10, 42);
      petalPos[i * 3 + 2] = rand(-120, -40);
      petalVel[i * 3] = rand(-6, -1);
      petalVel[i * 3 + 1] = rand(-8, -2);
      petalVel[i * 3 + 2] = rand(-1, 1);
      pCol.set(pick([0xff9ecf, 0xffd06a, 0xffc0dc, 0xffe9b8]));
      petalCol[i * 3] = pCol.r; petalCol[i * 3 + 1] = pCol.g; petalCol[i * 3 + 2] = pCol.b;
    }
    const petalGeo = new THREE.BufferGeometry();
    petalGeo.setAttribute('position', new THREE.BufferAttribute(petalPos, 3));
    petalGeo.setAttribute('color', new THREE.BufferAttribute(petalCol, 3));
    const petals = new THREE.Points(petalGeo, new THREE.PointsMaterial({
      size: 3.2, vertexColors: true, transparent: true, opacity: .75,
      blending: THREE.NormalBlending, depthWrite: false, sizeAttenuation: false, fog: false
    }));
    scene.add(petals);

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

    // --- 遠景の観客シルエット（当たりなし） + 二重宮殿 -----------------
    const crowdBelt = makeScroller(() => {
      const grp = new THREE.Group();
      const mat = lambert({ color: 0x1a0614, emissive: 0x3a1028, emissiveIntensity: .2 });
      for (let i = 0; i < 18; i++) {
        const h = rand(3.5, 7);
        const body = new THREE.Mesh(new THREE.CylinderGeometry(.65, .8, h, 6), mat);
        body.position.set(i * 18 + rand(-4, 4), -17 + h * .55, rand(-155, -130));
        grp.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(.55, 6, 6), mat);
        head.position.set(body.position.x, -17 + h + .4, body.position.z);
        grp.add(head);
      }
      return grp;
    }, 320);
    scene.add(crowdBelt.group);

    const farCastle = makeScroller(() => {
      const grp = new THREE.Group();
      const m = lambert({ color: 0x4a0a30, emissive: 0x6a1848, emissiveIntensity: .25 });
      for (let i = 0; i < 4; i++) {
        const x = i * 160 + 40;
        const keep = new THREE.Mesh(new THREE.BoxGeometry(28, 40, 18), m);
        keep.position.set(x, 4, -260);
        grp.add(keep);
        const spire = new THREE.Mesh(new THREE.ConeGeometry(10, 22, 6),
          lambert({ color: 0x8a1450, emissive: 0xaa2060, emissiveIntensity: .3 }));
        spire.position.set(x, 35, -260);
        grp.add(spire);
        const fin = sprite(heartTex, 0xffffff, 8, .7);
        fin.position.set(x, 48, -258);
        fin.userData.pulse = rand(0, 6.28);
        grp.add(fin);
      }
      return grp;
    }, 640);
    scene.add(farCastle.group);
    const farFins = [];
    farCastle.group.traverse(o => { if (o.userData && o.userData.pulse !== undefined) farFins.push(o); });

    // --- 名物: 大薔薇窓(玉座の真上・大聖堂の主役窓。ボス戦で心拍) ----------
    // 遠景ランドマークとしてスクロールさせず画面に留める(S3の夕日と同じ扱い)。
    const roseWinTex = makeTex(256, 256, g => {
      const cx = 128, cy = 128;
      const cols = ['#ff5a8c', '#ffd06a', '#7ab8ff', '#ff9ecf', '#b08aff', '#ff3e6a'];
      // 色ガラスの花弁(外周12枚 + 内周8枚)
      for (const [n, r0, r1] of [[12, 62, 112], [8, 24, 56]]) {
        for (let i = 0; i < n; i++) {
          const a0 = i / n * Math.PI * 2, a1 = (i + .86) / n * Math.PI * 2;
          g.fillStyle = cols[i % cols.length];
          g.globalAlpha = .55 + (i % 3) * .15;
          g.beginPath();
          g.arc(cx, cy, r1, a0, a1);
          g.arc(cx, cy, r0, a1, a0, true);
          g.closePath(); g.fill();
        }
      }
      g.globalAlpha = 1;
      // 金のトレサリー(放射スポーク + 二重リング)
      g.strokeStyle = '#e8b860'; g.lineWidth = 5;
      g.beginPath(); g.arc(cx, cy, 118, 0, 6.3); g.stroke();
      g.lineWidth = 3;
      g.beginPath(); g.arc(cx, cy, 60, 0, 6.3); g.stroke();
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2;
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * 22, cy + Math.sin(a) * 22);
        g.lineTo(cx + Math.cos(a) * 118, cy + Math.sin(a) * 118);
        g.stroke();
      }
      // 中心のハート
      g.translate(cx, cy + 4);
      g.shadowColor = '#ff3e9d'; g.shadowBlur = 16;
      g.fillStyle = '#ff3e9d';
      g.beginPath();
      g.moveTo(0, 15);
      g.bezierCurveTo(-26, -11, -13, -30, 0, -11);
      g.bezierCurveTo(13, -30, 26, -11, 0, 15);
      g.fill();
    });
    // 注意: 格天井(y=46, z=-20..-280)が視線を遮るため、これ以上高くは置けない
    // (y>45 だと天井板に隠れて消える)。玉座の真後ろに嵌まる構図が正解。
    const roseWin = new THREE.Mesh(new THREE.CircleGeometry(34, 36),
      lambert({ map: roseWinTex, color: 0xffc0dc, emissive: 0xffffff, emissiveIntensity: .85, emissiveMap: roseWinTex, fog: false }));
    roseWin.position.set(0, 42, -192);
    scene.add(roseWin);
    const roseWinGlow = sprite(softTex('#ff9ecf'), 0xff5aa8, 120, .26);
    roseWinGlow.position.set(0, 42, -191);
    scene.add(roseWinGlow);

    // --- 名物: 黄金の守護天使像(台座+翼+光輪。ボス戦で目が赤く灯る) -------
    const statueGold = phong({ color: 0xffd06a, emissive: 0x8a5c14, emissiveIntensity: .55, specular: 0xfff0c0, shininess: 70 });
    const statueDark = phong({ color: 0xc89a4a, emissive: 0x553308, emissiveIntensity: .4, specular: 0xffe0a0, shininess: 45 });
    const eyeMat = new THREE.SpriteMaterial({
      map: softTex('#ff4a5a'), color: 0xff2038, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    });
    const statueBelt = makeScroller(() => {
      const grp = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const x = i * 150 + rand(-8, 8), z = -98;
        const st = new THREE.Group();
        // 台座(二段の大理石)
        const ped1 = new THREE.Mesh(new THREE.BoxGeometry(9, 3, 9), lambert({ color: 0xffdae8 }));
        ped1.position.y = -15.5; st.add(ped1);
        const ped2 = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.8, 4, 8), statueDark);
        ped2.position.y = -12; st.add(ped2);
        // 躯体(ローブ姿の円錐) + 頭
        const body = new THREE.Mesh(new THREE.ConeGeometry(3.4, 15, 8), statueGold);
        body.position.y = -2.5; st.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(1.8, 8, 7), statueGold);
        head.position.y = 6.4; st.add(head);
        // 光輪
        const halo = new THREE.Mesh(new THREE.TorusGeometry(2.6, .28, 6, 18), statueGold);
        halo.position.y = 8.6; st.add(halo);
        // 翼(左右へ広がる薄板2枚)
        for (const sgn of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 10), statueDark);
          wing.position.set(sgn * 4.6, 1.5, -1.2);
          wing.rotation.set(.1, sgn * .5, sgn * .5);
          st.add(wing);
        }
        // 剣を床に突き立てる(交互にハートの盾)
        if (i % 2 === 0) {
          const blade = new THREE.Mesh(new THREE.BoxGeometry(.7, 13, .3), statueDark);
          blade.position.set(3.6, -8, 2); st.add(blade);
          const guard = new THREE.Mesh(new THREE.BoxGeometry(3, .7, .5), statueGold);
          guard.position.set(3.6, -2.2, 2); st.add(guard);
        } else {
          const shield = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, .6, 10), statueGold);
          shield.rotation.x = Math.PI / 2;
          shield.position.set(-3.8, -6, 2); st.add(shield);
        }
        // 目の赤光(ボス戦で灯る。material 共有なので一括制御)
        const eye = new THREE.Sprite(eyeMat);
        eye.scale.set(3.4, 1.6, 1);
        eye.position.set(0, 6.5, 1.6);
        st.add(eye);
        st.position.set(x, 0, z);
        grp.add(st);
      }
      return grp;
    }, 450);
    scene.add(statueBelt.group);

    // --- 名物: 黄金のハート凱旋門(時折くぐり抜ける近景のゲート) -----------
    const archGold = phong({ color: 0xffd06a, emissive: 0xaa7720, emissiveIntensity: .6, specular: 0xfff0c0, shininess: 70 });
    // z=-70/半径24: 画面幅の約4割のゲートが約40秒おきに流れてくる。
    // これより手前(z>-60)に置くと弧が画面上部を横切り続けて邪魔になる。
    const archBelt = makeScroller(() => {
      const grp = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const x = i * 160 + rand(-10, 10), z = -70;
        const gate = new THREE.Group();
        for (const sgn of [-1, 1]) {
          const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 30, 8), archGold);
          pillar.position.set(sgn * 24, -2, 0);
          gate.add(pillar);
          const cap = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.6, 4.4), archGold);
          cap.position.set(sgn * 24, 13.8, 0);
          gate.add(cap);
          const lamp = sprite(softTex('#ffe9b8'), 0xffd06a, 6, .5);
          lamp.position.set(sgn * 24, 16, 0);
          gate.add(lamp);
        }
        const arch = new THREE.Mesh(new THREE.TorusGeometry(24, 1.1, 6, 24, Math.PI), archGold);
        arch.position.set(0, 13, 0);
        gate.add(arch);
        const fin = sprite(heartTex, 0xffffff, 9, .95);
        fin.position.set(0, 43, 0);
        fin.userData.pulse = rand(0, 6.28);
        gate.add(fin);
        gate.position.set(x, 0, z);
        grp.add(gate);
      }
      return grp;
    }, 480);
    scene.add(archBelt.group);
    const pulsesArch = [];
    archBelt.group.traverse(o => { if (o.userData && o.userData.pulse !== undefined) pulsesArch.push(o); });

    // --- 窓からの光条(god rays)。ボス戦は深紅に染まる ----------------------
    const rays = [];
    const rayCalm = new THREE.Color(0xffd9a0), rayTense = new THREE.Color(0xff4a5a);
    for (const [x, tilt, wd] of [[-95, .42, 13], [-30, .34, 10], [45, .38, 15], [115, .3, 11]]) {
      const ray = new THREE.Mesh(new THREE.PlaneGeometry(wd, 95),
        basic({ color: 0xffd9a0, transparent: true, opacity: .08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      ray.position.set(x, 4, -122);
      ray.rotation.z = tilt;
      ray.userData.ph = rand(0, 6.28);
      scene.add(ray); rays.push(ray);
    }

    // --- 金の煌めき塵(大広間の空気中に漂う微光) --------------------------
    const N_GLI = 64;
    const gliPos = new Float32Array(N_GLI * 3);
    const gliCol = new Float32Array(N_GLI * 3);
    const gCol = new THREE.Color();
    for (let i = 0; i < N_GLI; i++) {
      gliPos[i * 3] = rand(-220, 220);
      gliPos[i * 3 + 1] = rand(-14, 40);
      gliPos[i * 3 + 2] = rand(-130, -45);
      gCol.set(pick([0xffe9b8, 0xffd06a, 0xff9ecf])).multiplyScalar(rand(.4, 1));
      gliCol[i * 3] = gCol.r; gliCol[i * 3 + 1] = gCol.g; gliCol[i * 3 + 2] = gCol.b;
    }
    const gliGeo = new THREE.BufferGeometry();
    gliGeo.setAttribute('position', new THREE.BufferAttribute(gliPos, 3));
    gliGeo.setAttribute('color', new THREE.BufferAttribute(gliCol, 3));
    const glitter = new THREE.Points(gliGeo, new THREE.PointsMaterial({
      size: 2.2, vertexColors: true, transparent: true, opacity: .7,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: false, fog: false
    }));
    scene.add(glitter);

    // 撃破時に柱から落ちる金屑
    const N_DEB = 40;
    const debPos = new Float32Array(N_DEB * 3);
    const debVel = new Float32Array(N_DEB * 3);
    for (let i = 0; i < N_DEB; i++) {
      debPos[i * 3] = 0; debPos[i * 3 + 1] = -50; debPos[i * 3 + 2] = -80;
      debVel[i * 3] = 0; debVel[i * 3 + 1] = 0; debVel[i * 3 + 2] = 0;
    }
    const debGeo = new THREE.BufferGeometry();
    debGeo.setAttribute('position', new THREE.BufferAttribute(debPos, 3));
    const debPts = new THREE.Points(debGeo, new THREE.PointsMaterial({
      color: 0xffe15a, size: 3.5, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: false, fog: false
    }));
    scene.add(debPts);
    let collapseT = 0;

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
        const m = moodT(s);
        colBelt.update(dx); colFarBelt.update(dx * .92);
        chBelt.update(dx); towersBelt.update(dx * .85);
        banBelt.update(dx * .9); roseBelt.update(dx); crysBelt.update(dx);
        glassBelt.update(dx * .9); poolBelt.update(dx * .9);
        drapeBelt.update(dx * .9); balusBelt.update(dx * .88);
        mirrorBelt.update(dx * .9);
        // 鏡面のきらめき / 燭台の火のちらつき
        mirrorMat.emissiveIntensity = .38 + .14 * Math.sin(t * 1.7) + m * .15;
        for (const fl of sconceFlames) fl.material.opacity = .7 + .3 * Math.sin(t * 7.2 + fl.userData.flick);
        // 緞帳の揺れ / 光の鎖の明滅
        for (const dr of drapes) dr.rotation.z = Math.sin(t * .6 + dr.userData.sway) * .05;
        if (garlandMat) garlandMat.opacity = .55 + .28 * Math.sin(t * 2.6);
        // シャンデリアのクリスタル: ティアドロップ回転 + グリントの瞬き + 炎の揺らぎ
        bigCrys.rotation.y = t * .7;
        bigCrysGlow.material.opacity = .35 + .2 * Math.sin(t * 2.2);
        for (let i = 0; i < chTwinkles.length; i++) {
          const tw = chTwinkles[i];
          const o = Math.max(0, Math.sin(t * (2.4 + (i % 4) * .5) + tw.userData.ph));
          tw.material.opacity = o * o * .95;
          const sc = 1.6 + o * 2.6;
          tw.scale.set(sc, sc, 1);
          tw.material.rotation = t * .8 + tw.userData.ph;
        }
        for (const fl of chFlames) {
          fl.material.opacity = .72 + .26 * Math.sin(t * 8.5 + fl.userData.ph);
        }
        // 灯籠: 流れ+上下の漂い+火のちらつき
        for (const ln of lanterns) {
          ln.position.x -= dx * .75;
          ln.position.y += Math.sin(t * .55 + ln.userData.ph) * dt * 1.8;
          if (ln.position.x < ln.userData.min) ln.position.x += ln.userData.span;
          ln.userData.gl.material.opacity = .22 + .14 * Math.sin(t * 6 + ln.userData.ph);
        }
        heartWallTex.offset.x += dx * (12 / 1300);
        checkerTex.offset.x += dx * (23 / 1500);
        cofferTex.offset.x += dx * (44 / 1500);
        carpetTex.offset.x += dx * (40 / 1500);
        for (const ch of chandeliers) {
          const amp = ch === bigCh ? .05 : .07;
          ch.rotation.z = Math.sin(t * .8 + (ch.userData.sway || 0)) * amp;
        }
        bigGlow.material.opacity = .22 + .1 * Math.sin(t * 1.3) + m * .18;
        for (const ban of banners) ban.rotation.z = Math.sin(t * .7 + ban.userData.sway) * .06;
        for (const cr of crystals) cr.rotation.y = t * cr.userData.spinY;
        for (const cd of candles) {
          cd.position.x -= dx * .8;
          if (cd.position.x < cd.userData.min) cd.position.x += cd.userData.span;
          cd.position.y += Math.sin(t * .8 + cd.userData.ph) * dt * 1.4;
          cd.userData.fl.material.opacity = .75 + .25 * Math.sin(t * 7 + cd.userData.ph);
        }
        for (const f of pulses) {
          const sc = 9 * (1 + .12 * Math.sin(t * 2.2 + f.userData.pulse) + m * .15);
          f.scale.set(sc, sc, 1);
        }
        for (const orb of orbs) {
          orb.position.x -= dx * .7;
          orb.position.y += Math.sin(t * .9 + orb.userData.ph) * dt * 2.2;
          if (orb.position.x < orb.userData.min) orb.position.x += orb.userData.span;
          orb.material.opacity = .5 + .25 * Math.sin(t * 1.4 + orb.userData.ph) + m * .15;
        }
        for (const pool of lightPools) {
          pool.material.opacity = .1 + .08 * Math.sin(t * 1.1 + pool.userData.ph) + m * .06;
        }
        // 花びら: 上から舞い落ち、横スクロールと連動
        const pp = petalGeo.attributes.position.array;
        const fallBoost = 1 + m * .6;
        for (let i = 0; i < N_PETAL; i++) {
          pp[i * 3] += petalVel[i * 3] * dt - dx * .5;
          pp[i * 3 + 1] += petalVel[i * 3 + 1] * dt * fallBoost;
          pp[i * 3 + 2] += petalVel[i * 3 + 2] * dt;
          if (pp[i * 3 + 1] < -18 || pp[i * 3] < -240) {
            pp[i * 3] = rand(-200, 240);
            pp[i * 3 + 1] = rand(28, 48);
            pp[i * 3 + 2] = rand(-120, -40);
          }
        }
        petalGeo.attributes.position.needsUpdate = true;
        petals.material.opacity = .55 + m * .25;
        // 玉座: ボスへ近づくほど手前・明るく
        throne.position.z = throne.userData.baseZ + m * 55;
        throne.position.x = Math.sin(t * .15) * 2;
        const crestSc = 14 * (1 + .12 * Math.sin(t * 2) + m * .25);
        crest.scale.set(crestSc, crestSc, 1);
        throneGlow.material.opacity = .15 + m * .35 + .08 * Math.sin(t * 1.6);
        wall.material.emissiveIntensity = .75 + m * .35 + .08 * Math.sin(t * (2 + m * 4));
        warm.intensity = 1.0 - m * .25;
        // 幕（tier/crit/dying）で照明シナリオを重ねる
        const tier = s.queenTier || 0;
        const crit = Math.max(0, Math.min(1, s.queenCrit || 0));
        const dying = s.queenDying ? 1 : 0;
        const cinema = Math.max(0, Math.min(1, (s.cinema || 0) / 5.4));
        const act = Math.max(m, tier * .28, crit * .7, cinema * .5);
        mixFog(scene.fog,
          cinema > .05 ? 0x1a0610 : 0x54103c,
          dying ? 0x2a0618 : (crit > .3 ? 0x1a040c : 0x2a0618),
          act, 330 - tier * 20, 220 - crit * 40);
        warm.intensity = (1.0 - m * .25) * (1 - crit * .35) * (1 - cinema * .4);
        // --- 新セットピース ------------------------------------------------
        statueBelt.update(dx * .95);
        archBelt.update(dx);
        // 大薔薇窓: 平時はゆらぎ、ボス戦は心拍(2連打のドクン)で膨らむ
        const beat = m > .3 ? Math.pow(Math.max(0, Math.sin(t * 4.4)), 6) : 0;
        const rwScale = 1 + .03 * Math.sin(t * 1.2) + beat * .07;
        roseWin.scale.set(rwScale, rwScale, 1);
        roseWin.material.emissiveIntensity = .85 + m * .3 + beat * .55;
        roseWinGlow.material.opacity = .18 + m * .22 + beat * .3 + .05 * Math.sin(t * 1.4);
        // 守護像: ボス戦で目が赤く灯り、瀕死で明滅。金も熱を帯びる
        eyeMat.opacity = Math.min(1, m * .85 + crit * .4) * (dying ? breath(t, 0, .25, 1, 9) : 1);
        statueGold.emissiveIntensity = .55 + crit * .35;
        // 凱旋門のハート頂飾
        for (const f of pulsesArch) {
          const sc = 9 * (1 + .12 * Math.sin(t * 2.4 + f.userData.pulse) + m * .2);
          f.scale.set(sc, sc, 1);
        }
        // 光条: 呼吸しつつ、crit で深紅へ
        for (const ray of rays) {
          ray.material.opacity = (.06 + .05 * Math.sin(t * .9 + ray.userData.ph)) * (1 + m * .9);
          ray.material.color.copy(rayCalm).lerp(rayTense, Math.max(crit, m * .35));
        }
        // 煌めき塵: 漂いながら流れ、mood で少し濃く
        const gp = gliGeo.attributes.position.array;
        for (let i = 0; i < N_GLI; i++) {
          gp[i * 3] -= (dx * .6 + dt * 1.1);
          gp[i * 3 + 1] += Math.sin(t * .8 + i * 1.7) * dt * .9;
          if (gp[i * 3] < -230) gp[i * 3] += 460;
        }
        gliGeo.attributes.position.needsUpdate = true;
        glitter.material.opacity = .45 + .2 * Math.sin(t * 2.1) + m * .2;
        // 床の呼吸（低音）
        const music = Math.max(0, Math.min(1, s.music ?? (.5 + .5 * Math.sin(t * 7.4))));
        const kick = music * music;
        const breathe = 1 + Math.sin(t * (2.2 + music * 4)) * kick * .012;
        floor.scale.y = breathe; // plane rotated, y scale = visual depth pulse via... actually rotation -X, scale.z better
        floor.scale.z = breathe;
        // シャンデリアの実光源: 低音で脈動、ボス戦で強まる。床の照り返しも連動
        const bossBoost = 1 + (s.boss ? .5 : 0);
        chLight.intensity = 1.15 + music * 1.4 * bossBoost + m * .35 + .08 * Math.sin(t * 9.2);
        chSmear.material.opacity = .09 + music * .12 + m * .05;
        // PA スタック
        for (let si = 0; si < speakerStacks.length; si++) {
          const sp = speakerStacks[si];
          const side = si === 0 ? -1 : 1;
          sp.position.x = side * 42 + Math.sin(t * 48 + si) * kick * .35 * bossBoost;
          sp.position.y = Math.cos(t * 37 + si * 2) * kick * .25 * bossBoost;
          sp.rotation.z = Math.sin(t * 30 + si) * kick * .04 * bossBoost;
          for (const cone of sp.userData.cones) {
            const sc = 1 + music * .28 * bossBoost + kick * .12;
            cone.scale.set(sc, sc, 1);
            cone.material.opacity = .55 + music * .4;
          }
          if (sp.userData.led) {
            sp.userData.led.material.opacity = .35 + music * .65;
            const ledSc = 1 + music * .4;
            sp.userData.led.scale.set(ledSc, 1, 1);
          }
        }
        // 観客・遠景城
        crowdBelt.update(dx * .7);
        farCastle.update(dx * .5);
        for (const f of farFins) {
          const sc = 8 * (1 + .1 * Math.sin(t * 2 + f.userData.pulse) + crit * .2);
          f.scale.set(sc, sc, 1);
        }
        // 玉座は tier でさらに近づき、crit で赤く
        throne.position.z = throne.userData.baseZ + m * 55 + tier * 12 + crit * 20;
        throneGlow.material.opacity = .15 + m * .35 + crit * .3 + .08 * Math.sin(t * 1.6);
        // 崩壊: 撃破中に金屑が柱から落ちる
        if (dying) {
          if (collapseT <= 0) {
            for (let i = 0; i < N_DEB; i++) {
              debPos[i*3] = rand(-80, 80);
              debPos[i*3+1] = rand(10, 40);
              debPos[i*3+2] = rand(-100, -50);
              debVel[i*3] = rand(-8, 8);
              debVel[i*3+1] = rand(-2, 6);
              debVel[i*3+2] = rand(-4, 4);
            }
            debPts.material.opacity = .9;
          }
          collapseT += dt;
          for (let i = 0; i < N_DEB; i++) {
            debVel[i*3+1] -= 28 * dt;
            debPos[i*3] += debVel[i*3] * dt - dx * .3;
            debPos[i*3+1] += debVel[i*3+1] * dt;
            debPos[i*3+2] += debVel[i*3+2] * dt;
            if (debPos[i*3+1] < -17) {
              debPos[i*3+1] = rand(20, 42);
              debVel[i*3+1] = rand(-2, 4);
            }
          }
          debGeo.attributes.position.needsUpdate = true;
          debPts.material.opacity = Math.max(0, .9 - collapseT * .12);
        } else {
          collapseT = 0;
          debPts.material.opacity = 0;
        }
        // シネマ中は全体を少し暗く、中心を残す
        if (cinema > .05) scene.fog.near = 18 + cinema * 40;
        else scene.fog.near = 28;
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

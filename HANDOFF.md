# 引き継ぎ — ぐろちゃんシューティング ビジュアル大幅強化

## プロジェクト概要
- 単一ファイル HTML5 canvas 横スクロールシューティング。**`game.js`（~2950行・単一IIFE・ビルドなし）** が本体。`index.html` を直接ブラウザで開くだけで動く。
- アート方針: **ネオン×カワイイを維持したまま、陰影・多層シェーディング・アニメ・エフェクトを大幅強化して立体的・映画的に**。写実路線にはしない。カワイイ目は廃止しない。
- 制約: **新規ライブラリ・外部画像の追加禁止。全て手続き描画。**
- 実装プラン全文: `/Users/daisuke/.claude/plans/optimized-chasing-micali.md`（Phase 1〜6）。
- ブランチ: `agent/remove-unused-warden-sprite`（mainではない）。

## 検証手段（重要）
- **スクショハーネスを `.devtools/` に永続化済み**（puppeteer-core + システムChrome使用、node_modulesは既存）:
  - `node .devtools/shot.js <play|boss|mid> <stageSkips>` → `.devtools/shot-<mode>-s<skips>.png`
    - stageSkips: 0=SHIBUYA 1=AQUA 2=FACTORY 3=STORM 4=PALACE
    - 例: `node .devtools/shot.js play 3`（storm＋敵＋自弾）, `node .devtools/shot.js boss 0`, `node .devtools/shot.js mid 2`
  - `node .devtools/crop.js <png> <cx> <cy> <cw> <ch>` → `.devtools/crop-out.png`（3倍ズーム。敵は小さいので必須）
  - ハマりどころ（対策済み）: headlessはページが隠れ扱いで**ゲームが自動ポーズする**→ `document.hidden` をspoof。敵が出るまで `GRO_DEBUG` をポーリング。自弾を出すにはSpaceを押しっぱなしにする。
- **注意: headless(swiftshader)のFPSは当てにならない。** ≥58fps判定は必ず実機ブラウザで F1 を使ってユーザーが確認する。
- デバッグキー: **F1**=FPS表示トグル / **Shift+N**=ステージスキップ / **Shift+M**=中ボス / **Shift+B**=ボス。`window.GRO_DEBUG` で状態取得。

## 完了済み（本セッション8コミット、`4b5ece5` の上に積んである）
1. `1629d14` Phase1: `rctx`/`bakeSprite`/`blit` 基盤導入＋葉ヘルパー(drawBox3D/Cylinder/KawaiiEyes/EnemyShadow)を`rctx`化。**bakeSpriteは未使用（基盤のみ）、`rctx===ctx`常時成立で見た目不変。**
2. `aa4a64e` Phase1: F1 FPSカウンタ（`fpsShow`トグル/`fpsAvg` EMA、draw()末尾で表示）。
3. `5540fcf` Phase1: 全画面グラデを`cachedGrad`でメモ化、`nearProps`で毎フレームfilter撤去。
4. `27ca901` Phase2: **Stage1ボス(HEART BREAKER)＋中ボス**を角丸グロス3Dに刷新。箱型「枠」撤去、光沢バイザー、ハート目、3Dポッド/脚。共有ドロップシャドウも角丸化。
5. `ec759ec` Phase4: **storm背景**を全面改修。緑drawCity使い回しを撤去し `drawDataSpires`（黒曜石モノリス＋雷同期回路シーム）/`drawHoloGrid`/`drawWireRings` を新設。
6. `aabd67c` Phase2: `drawBox3D`/`drawCylinder3D` に光沢＋リム＋接地影 → 箱系メカ敵を一括立体化。
7. `9b028d5` Phase2: **drone/tank/turret/walker** に固有パーツ（回転ローター/連装砲＋転動キャタピラ/追尾砲身＋レーダーフィン/2関節脚＋肩キャノン）。
8. `ef4c4fb` Phase3: **自弾**に速度方向コメットトレイル＋星ヘッド、**volt弾**を電撃スパイク、**default敵弾**にコメット尾。`b.seed ??=` 遅延付与。

## 残タスク（ユーザー承認済み・優先順は「背景→敵→弾は着手済、残りを継続」）
- [ ] **factory背景の深化**（`drawFactoryBackdrop` ~1592行）: 精錬所プロップ/溶融河川/打ち付けハンマー等。現状は及第点（夕日シルエット＋歯車）だが平板寄り。
- [ ] **ボス2〜5の磨き**（`drawBoss` の `stageIndex===1..4`, ~2543行〜）: シルエットは立っている(生物/高炉/菱形/ハート)が、**顔部に平板な黒fillRect**が残る→角丸グロスバイザー＋発光目にすると質感が揃う。
- [ ] **着弾FX/破片/ヒットストップ**（Phase3後半）: `collisions()`の自弾ヒット・`hurt()`・`destroyEnemy()`・`frame()`(dt×0.15のヒットストップ)にフック追加が必要。
- [ ] **二次アニメ**（Phase2の残り）: wind-up（`e.windup`）/被弾ダメージ状態/瞬き。※`e.recoil`は既にtank砲身が参照、turret砲身は既にプレイヤー追尾。
- [ ] **Phase5 ステージ個性**: タイトルカード強化、**中ボス5種差別化**（現状は全stageで同一シェルの色替え。固定名`'CRIMSON WARDEN'`をステージ別名に）、敵へのステージ色デカール。
- [ ] **Phase6 性能調整**（必要なら `bakeSprite` を実際に活性化して敵/背景を焼き込み。**スクショで見比べながら**やれば同一性リスクを回避できる）。

## 技術メモ
- 描画はワールド座標(VW=1280×VH=720)。`draw()`でビュー変換を1回適用。ボス/敵は`ctx`にライブ描画（`translate(e.x,e.y)`）。`rctx===ctx`（焼き込み未活性）。
- ヘルパー: `hexA(hex,a)`, `shade(hex,f)`, `heartPath(cx,cy,s)`(ctx使用), `starPath`, `drawBox3D/drawCylinder3D/drawKawaiiEyes`(rctx使用), `clamp`。`ctx.roundRect`は利用可。
- 光源は左上（`drawMoon`と一致）で統一するとリムライトが揃う。
- 敵ペインタ: `drawEnemy` 内の if/else 連鎖（~2140行〜）。ボス: `drawBoss`(~2470行)、中ボス: `drawMidBoss`(~2380行)。
- ステージ定義配列 `stages`（~118行）に sky/far/city/accent/accent2/spawnTable/theme。
- 未追跡: `.DS_Store`（各所）と `node_modules/`。`.devtools/*.png`（スクショ）も生成物。`.gitignore` 未整備（ユーザーに確認保留中）。

## 次アクションの推奨
factory背景 → 着弾FX/ヒットストップ → ボス2〜5磨き → 中ボス5差別化、の順。各項目ごとに `.devtools/shot.js` で検証しコミット。方向性・カワイイ度は前セッションでユーザーOK。

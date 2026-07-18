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
- デバッグキー: **F1**=FPS表示トグル / **Shift+N**=ステージスキップ / **Shift+M**=中ボス召喚(戦闘中に2度押しで即撃破) / **Shift+B**=ボス / **Shift+T**=タイムライン+30秒早送り(中ボス/ボス発動の直前で停止)。`window.GRO_DEBUG` で状態取得(`phaseId`/`stageTime`/`continuesLeft`含む)。

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
- [x] **factory背景の深化**（`drawFactoryBackdrop` ~1592行）: `drawRefineryTanks`（リベット＋発光窓の精錬タンク3基、屋根越しに突出配置）、`drawHammerPress`（周期スラム＋着弾フラッシュのハイドロプレス、gearと同じ「浮遊」扱いで固定スクリーン座標）、`drawMoltenRiver`（コンベア下の流動溶岩グロー）を追加。`REFINERY_TANKS`定数追加。
- [x] **ボス2〜5の磨き**（`drawBoss` の `stageIndex===1..4`）: 共有ヘルパー`drawVisorPanel`(角丸グラデ+ハイライト)/`drawGlowDot`(加算グローの発光瞳)を新設し、DEEP BLUE DIVA/BLAZE EMPRESS/VOLT PHANTOM/QUEEN OF HEARTBREAKの平板な黒fillRect目を角丸グロスバイザー＋発光瞳に刷新（最終ボスはハート型瞳でstage1と統一感）。
- [x] **着弾FX/破片/ヒットストップ**（Phase3後半）: `hitStop`変数を追加し`frame()`で`dt*=.15`のスロー処理（`collisions()`の被弾/`destroyEnemy()`/`hurt()`から`Math.max`でセット、大きさは雑魚<タンク<中ボス<ボスの順）。`burstDebris()`を新設し、角ばった`shape:'shard'`パーティクル（回転しながら落下する破片）を`burst()`の丸グロー粒子と併用。自弾ヒット時は小チップ2枚、撃破時は雑魚7〜ボス26枚。
- [x] **二次アニメ**（Phase2の残り）: `spawnEnemy`/リロード時に`e.fireMax`を記録し、`drawEnemyVariant`で発射直前25%区間にパルスする加算グロー(windup)を追加。同関数に被弾ダメージ状態（HP40%未満でクラック線+明滅エンバー）も追加。`drawKawaiiEyes`に座標シードの非同期瞬き（3.4秒周期・0.1秒だけ閉眼線）を追加し、call site変更なしで全カワイイ目の敵に適用。※`e.recoil`は既にtank砲身が参照、turret砲身は既にプレイヤー追尾。
- [x] **中ボス5種差別化**: 各`stages[]`に`midBoss`名を追加（NEON/TIDAL/CINDER/GLITCH/VELVET WARDEN）、HUDの固定文字列`'CRIMSON WARDEN'`を`stage.midBoss`参照に置換。`drawMidBoss`のクレスト部をステージ別シルエット（ハート型アンテナ/ドーサルフィン/火炎スパイク/サーキット触角+点滅ノード/ハートクレスト）に分岐して差別化。
- [x] **Phase5 残り**: `stageBanner`のタイトルカードを角丸グロー枠+四隅アクセントティック+スライドインに刷新。`drawEnemyVariant`に全雑魚共通のステージ色デカール（右下の小バッジ、accent2地+accentドット）を追加。
- [ ] **Phase6 性能調整**（`bakeSprite`活性化）: **意図的に見送り**。敵の見た目は`e.t`ベースのロータースピン/明滅LED/recoil/windup/damage-crack/瞬き/ステージデカールなど大半が動的で、キャッシュキーに全部含めると焼き込みの意味がなくなる。現状ヘッドレスFPSは指標にならず実機での劣化報告も無いため、リスクに見合わないと判断。実機でF1計測してカクつきがあれば再検討。

## 2026-07-18 セッション: 5分ステージ/コンティニュー/背景立体化
- **ステージ約5分化**: `PHASE_TEMPLATE`(`stages`直後)で waiting 時間226秒(normal)をフェーズ駆動でスクリプト化(trickle→assault→formation→calm→中ボス→calm→assault→setpiece→calm→eliteRush→finalPush)。`difficulties`の`bossTime`は`timeScale`(easy1.06/normal1/hard.92)に置換。`currentPhase(stageTime)`はステートレス導出でデバッグジャンプと両立。敵速度は`stageTime`直結を廃し`rank`(120秒で飽和×フェーズintensity)に、`gameSpeed`もintensity駆動+イージング。セットピースは`runSetpiece`(ダブルVee/地上列+航空/上下ピンサー)、タイムボーナス基準は`timelineTotal()+120`。
- **コンティニュー**: `continuesLeft`(3回)・HP0で`doContinue()`=その場復活(HP全快/無敵4s/敵弾消去/shockwave/スコア維持)。HUD右パネル下にハート3、復活時中央に「CONTINUE! のこりN回」。`resetGame()`でリセット。
- **背景立体化フレームワーク**: `bgCam`(プレイヤー高度追従)+`bgLayer(depth,fn)`で縦パララックス(遠景.5/中景.32/近景.15/前景-.4、地面レイヤーとfactoryのgear/hammerはスクリーン固定のため対象外)。`drawDepthHaze`(遠中間の大気ウォッシュ)、`drawGroundPlane`(消失点VW/2に収束する床グリッド、neon/palaceで使用)、`drawForeground`(drawGame後に描くy>660のテーマ別シルエット帯: ガードレール/波頭/パイプ手すり/ケーブルトレイ/バラ垣)。ステージ別: neon超遠景スカイライン3段/aqua第2島列/factory奥タンク列(`drawRefineryTanks(stage,scale,alpha,shiftX)`)/storm第3スパイア列/palace中間柱廊(`drawColonnade(scale,alpha,speed)`)。
- 検証済み: 全5ステージスクショ、コンティニュー3回→GAME OVER遷移、全フェーズ進行(Shift+T/M/B walk)。実機FPS(F1)は未計測 — ユーザー確認待ち。
- **難易度調整(ユーザーFB反映)**: ボス/中ボスHP約1.6倍+ボスHP25%未満で攻撃サイクル35%高速化(`rageMul`)。高intensityフェーズ(assault/formation)で`spawnFlanker()`=雑魚が左(背後)から回り込み右へ抜ける(`e.flank`、描画は左右反転、除去条件は`x < VW+170`)。SPEEDアイテム強化(+32%加速/+28%最高速 per Lv)。

## 2026-07-18 セッション2: パワーダウン/タイトル画面
- **被弾パワーダウン**: `hurt()`で`player.power`が1段階ダウン(下限1、spread/speedは維持)。`powerDownBanner`(1.4s)でプレイヤー頭上に上昇する「POWER DOWN」表示+HUDのPOWERラベル赤点滅。スタート画面の操作説明に「HIT 被弾でPOWERが1段階ダウン」を追記。`GRO_DEBUG`に`power`を追加。
- **タイトル画面**: canvas描画に移行。`update()`冒頭のmenuブランチで`elapsed`を進め(resetGameで0リセットされるので安全)、渋谷背景をアニメさせつつぐろちゃんがロゴ下を8の字飛行(`drawPlayer`をmenuでも描画)。`drawTitleScreen()`(draw()内、menu時のみ): 上部暗ウォッシュ+「GRO-CHAN」ピンクグラデ+グロー、「SKY BLASTER」シアン、両脇パルスハート、瞬き星8個、PRESS ENTER点滅。HTML `#startScreen`はh1/eyebrow撤去、下部アンカーの透過パネル(難易度/操作/START/ハイスコア)に縮小。
- 検証: `.devtools/shot-title.js`(新規、menu状態スクショ)+`shot.js play 0`で回帰なし確認。
- **メニューフロー3段階化**: タイトル(`#titleScreen`=canvasロゴ+クリック/ENTERヒント+ハイスコアのみ)→説明(`#startScreen`=HOW TO PLAY: 操作2列グリッド/難易度/GAME START、背景ほぼ不透過)→オープニング。`menuStep`('title'/'howto')で分岐、ENTER/クリック/パッドAで進む、ESCでタイトルに戻る。howto中はcanvasのロゴ/ぐろちゃん描画を停止。`shot.js`は`#titleEnter`→`#startButton`→`#launchButton`の順にクリックするよう更新、`shot-title.js`は`title|howto`引数対応。

## 技術メモ
- 描画はワールド座標(VW=1280×VH=720)。`draw()`でビュー変換を1回適用。ボス/敵は`ctx`にライブ描画（`translate(e.x,e.y)`）。`rctx===ctx`（焼き込み未活性）。
- ヘルパー: `hexA(hex,a)`, `shade(hex,f)`, `heartPath(cx,cy,s)`(ctx使用), `starPath`, `drawBox3D/drawCylinder3D/drawKawaiiEyes`(rctx使用), `clamp`。`ctx.roundRect`は利用可。
- 光源は左上（`drawMoon`と一致）で統一するとリムライトが揃う。
- 敵ペインタ: `drawEnemy` 内の if/else 連鎖（~2140行〜）。ボス: `drawBoss`(~2470行)、中ボス: `drawMidBoss`(~2380行)。
- ステージ定義配列 `stages`（~118行）に sky/far/city/accent/accent2/spawnTable/theme。
- 未追跡: `.DS_Store`（各所）と `node_modules/`。`.devtools/*.png`（スクショ）も生成物。`.gitignore` 未整備（ユーザーに確認保留中）。

## 次アクションの推奨
factory背景 → 着弾FX/ヒットストップ → ボス2〜5磨き → 中ボス5差別化、の順。各項目ごとに `.devtools/shot.js` で検証しコミット。方向性・カワイイ度は前セッションでユーザーOK。

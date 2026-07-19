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

## 2026-07-18 セッション2 続き: BGM二重再生修正/円システム/ステージ間ショップ
- **BGM二重再生修正**: opening/stage0が同曲(Neon Arcade Rush)を別Audioで持ち、オープニング→ゲーム開始で頭から流れ直していた。1つのAudio要素を共有し、`playBgm`に`previous === next`のシームレス継続分岐を追加(restartは同キー時のみ)。説明画面表示(最初のジェスチャ)で`playBgm('opening')`開始→説明→オープニング→ステージ1まで1曲が連続再生。`showHowto`はバブリング二重発火ガード追加。
- **スコア→円**: 表示を`yen()`(`¥`+3桁区切り)に統一(HUD「MONEY」/リザルト「かせいだ金額」/タイトル「さいこう金額」)。内部変数は`score`のまま(獲得ロジック不変)、ショップで消費可能に。
- **ステージ間ショップ**: クリア遷移(`bossState==='transition'`)完了時に`openShop()`→`state='shop'`(update()停止=休憩)。`#shopScreen`で購入: おにぎり¥3,000(HP全快)/パワー¥8,000/ワイド¥8,000/スピード¥5,000(各Lv3上限)/ハート¥12,000(コンティニュー+1)。`shopItems[]`が`can/apply/status`を持ち`updateShop()`で所持金・上限に応じてdisabled/MAX表示。「つぎのステージへ」ボタン/ENTER/パッドAで`leaveShop()`=旧ステージ前進処理(stageIndex++等)を実行。最終ステージ後は従来どおり即`finishGame(true)`。
- ハーネス: `shot.js`のShift+Nスキップループがショップを`#nextStageButton`クリックで通過、`shop`モード追加(`node .devtools/shot.js shop 0`)。検証: ショップUI表示(金欠disabled/MAX表示)、ショップ経由のstage0→1進行、HUD「MONEY ¥976」表示。購入ボタンの実クリックは実機確認推奨。
- **経済リバランス(ユーザーFB「単位が多い/釣り合っていない/クリアで回復しない・基本はアイテム」)**: 賞金を1/10に圧縮(撃破=`points*mult*diff/10`≈¥12〜76、グレイズ¥4、アイテム取得¥50、ノーダメ¥500、タイムボーナス×5、全クリア¥2,500)。localStorageキーを`grochan-money-best`に変更(旧レコードはインフレ値のため破棄)。ショップ価格: おにぎり¥400(**全回復→HP+40**、ドロップ食品+32と同格)/パワー・ワイド¥1,500/スピード¥1,000/ハート¥2,500。**自動回復を全廃**: ボス撃破+40・中ボス撃破+22・ステージ移行+28を削除、回復は道中ドロップとおにぎり購入のみ(コンティニュー全快は維持)。

## 技術メモ
- 描画はワールド座標(VW=1280×VH=720)。`draw()`でビュー変換を1回適用。ボス/敵は`ctx`にライブ描画（`translate(e.x,e.y)`）。`rctx===ctx`（焼き込み未活性）。
- ヘルパー: `hexA(hex,a)`, `shade(hex,f)`, `heartPath(cx,cy,s)`(ctx使用), `starPath`, `drawBox3D/drawCylinder3D/drawKawaiiEyes`(rctx使用), `clamp`。`ctx.roundRect`は利用可。
- 光源は左上（`drawMoon`と一致）で統一するとリムライトが揃う。
- 敵ペインタ: `drawEnemy` 内の if/else 連鎖（~2140行〜）。ボス: `drawBoss`(~2470行)、中ボス: `drawMidBoss`(~2380行)。
- ステージ定義配列 `stages`（~118行）に sky/far/city/accent/accent2/spawnTable/theme。
- 未追跡: `.DS_Store`（各所）と `node_modules/`。`.devtools/*.png`（スクショ）も生成物。`.gitignore` 未整備（ユーザーに確認保留中）。

## 次アクションの推奨
factory背景 → 着弾FX/ヒットストップ → ボス2〜5磨き → 中ボス5差別化、の順。各項目ごとに `.devtools/shot.js` で検証しコミット。方向性・カワイイ度は前セッションでユーザーOK。

## 2026-07-19 セッション: ストーリーシステム＋AI生成アート一式(codex経由)
- **アセット生成パイプライン**: 3人の三面図(Grok_3view.png等、プロジェクト直下)を元に、codex CLI(`codex exec -m gpt-5.6-sol -c model_reasoning_effort=medium`、プロンプトはstdin渡し必須)で画像生成。絵柄統一のため`assets/images/chibi/grochan_chibi.png`を毎回参照画像に添付。生成スクリプト群はセッションscratchpadに(使い捨て)。
- **ちびドット三面図**: `assets/images/chibi/`に3人分(grochan/chappy/kuroko)。全生成の絵柄アンカー。
- **ストーリー挿絵13枚**: `assets/images/story/`(op1-4/int1-4/ed1-4/go1)。op4/int1/int2は「機首必ず右向き+白いSpaceX風ユニット搭乗」で作り直し済(右スクロールと向きを一致させる)。ed4はイーロン後ろ姿シルエット(顔NG)。
- **ボス三面図6体**: `assets/images/bosses/`(stage1-5+warden)。ふざけデザイン(テープ補修/頭にタコ/たい焼き/グリッチ吹き出し/輪ゴム仮面+ハートいれ段ボール)。stage3(真紅ショート)とstage5(銀白縦ロール)は「主人公と顔が似すぎ」FBで髪色変更再生成済。
- **ストーリーUI**(`#storyScreen`): 額縁スタイル=黒背景+二重枠の挿絵ウィンドウ+下にテキストボックス(DotGothic16)。背景はCSSアニメのサイバー演出(ネオングリッド床スクロール+光ストリーク+走査線)。タイプライター表示(55ms/字、枠は全文サイズで固定=不可視の残り文字を敷く方式、打鍵中▌点滅、1クリック目で全文表示/2クリック目でページ送り)。`STORY`定数(game.js、stages直後)にスライド定義。フロー: オープニング4枚→ミッションカード / 各ステージクリア後に幕間1枚(`state='story'`でupdate停止)→ショップ / 全クリアでed1-3→カメオ画面(顔グラはed4画像) / ゲームオーバーでgo1→リザルト。ENTER/Space/クリックで進行、`cancelStory()`をresetGameで呼ぶ。
- **ボススプライト組み込み**: 三面図の中央1/3(側面ビュー、左向き)をpuppeteer+canvasで切り出し→エッジflood-fillで白背景透過→トリム→`assets/images/bosses/sprites/stageN_side.png`+`warden_side.png`。`drawBoss`/`drawMidBoss`冒頭でスプライト描画(230×190/158×132の作画ボックスにcontainフィット、ステージaccentグロー+浮遊ボブ)、未ロード時は旧プロシージャル描画にフォールバック。抽出スクリプトはscratchpad/extract.js(再利用可)。
- 検証: puppeteer-core+システムChromeでtitle→story→launch→Shift+N×4→Shift+Bの通し確認、全ステージボス表示OK・JSエラーなし。
- 未着手: ボス戦闘挙動は旧来のまま(見た目のみ差し替え)。WARDENの色替え5兄弟化、ボス2形態(女王)、幕間の会話劇化(顔グラ会話)など。

## 2026-07-19 セッション終了時の状態(セッション切替のため記録)
### 完了(コミット済み: e5ae41d まで)
- ストーリーUI/挿絵13枚/タイプライター/サイバー背景/ステージ別地面/ボス3ポーズ/テストモード(?boss=N / ?mid=N)

### 完了(未コミット! 次セッションで動作確認後コミット推奨)
- **ボス総入れ替え**: ユーザー自作の5シート(プロジェクト直下のChatGPT Image 7月18日*.png→`assets/images/bosses/sheets/`にリネームコピー済)を分割し、
  ステージボス1-4を MASQUERADE(仮面道化)/SERVER GOLEM/INFERNO DJINN(炎上魔人)/BOT GENERAL に置換。ステージ5ボスはQUEENのまま。
  旧生成ボス(HEART BREAKER/DIVA/EMPRESS/PHANTOM)は各ステージ中ボスに降格、ステージ5中ボスは LORD CENSOR(検閲卿)。
  WARDEN・女の子中ボス(STELLA等mid1-5)は不使用(mid1素材はposesに残存、削除可)
- ポーズシステム拡張: `loadSet`/`bossSets`/`midSets`(game.js)。シート素材は構え2/攻撃3/被弾2フレームで、
  構え2fアニメ・攻撃は攻撃毎にローテ(attackIdx)・被弾2f交互。ボス高さ560px/中ボス340px。
  ポーズ間でサイズが変わらないようidle基準のpx/スケール統一済
- シート分割: scratchpad/slice_sheets.js(市松背景の焼き込み除去+行列投影分割、行構成[2,3,2]前提)

### 未着手・中断中のタスク
1. **ボスボイス+重厚SFX(中断)**: 効果音ラボの割当案=盗賊の少年(→今は中ボスHEART BREAKER)/幼い王女(DIVA)/ネクロマンサー老婆(EMPRESS)/冷静な魔術師(PHANTOM)/高飛車な魔女(QUEEN)。
   ※ボス入替後なので割当は要再考(新ボス4体は男性的)。mp3直リンクは403→Referer付きcurlを試す(`-H "Referer: https://soundeffect-lab.info/"`)。
   重厚SFX候補: battle/mp3/dragon-cry1, earth-tremor1, super-arts-hit1, building-collapse1
2. 幕間ストーリー文言: 「ハート泥棒の女王・四天王」設定のまま。新ボス(SNS風刺ヴィラン)を物語にどう組むか未定
3. 追加ステージ検討(ユーザー要望あり、1ステージ実プレイ約3.5分/全クリア約20分と伝達済み)
4. ローカルサーバー: python3 http.server 8123 が起動しっぱなし(害なし、`lsof -ti:8123 | xargs kill`で停止)

## 2026-07-19 セッション: SNS風刺ヴィランに合わせた幕間改稿

### 完了
- **幕間ストーリー4枚を新ボス設定へ改稿**: MASQUERADE=ハートを「いいね」に変えて集める仮面の道化、SERVER GOLEM=盗んだハートをため込むサーバー、INFERNO DJINN=怒りや悲しみで巨大化する炎上魔人、BOT GENERAL=女王の命令で動く自動投稿軍団として、各撃破後の文言を一本のSNS風刺ストーリーに接続。既存挿絵と最終決戦への流れは維持。
- **`.devtools/shot.js` のストーリー対応を修復**: 存在しなくなった `#titleEnter` を `#titleScreen` に変更し、オープニング4枚・ステージ間幕間1枚のタイプライター送りを自動化。ストーリー導入後も `boss/shop` モードとステージスキップが実際の対象画面へ到達するようにした。

### 検証
- `node --check game.js` / `node --check .devtools/shot.js` / `git diff --check` 成功。
- ローカルサーバーの `?boss=1..5` を各約10秒待って確認。全5件で `bossState=active`、ボス敵1体、ページJSエラーなし（初回のみ無害な `favicon.ico` 404）。
- `node .devtools/shot.js boss 0..4` を実行し、5ボス・背景・HUDの表示崩れなしを目視確認。
- 通常のステージクリア遷移で幕間4枚を表示し、全文一致・全画面表示を確認。全4枚でテキスト/キャプションとも `scrollHeight === clientHeight`（オーバーフローなし）。

### 現在の残タスク
1. 追加ステージ検討（1ステージ実プレイ約3.5分／全クリア約20分）。

## 2026-07-19 セッション: ぐろちゃんの地上歩行感を改善

### 完了（未コミット）
- 地上の4コマ歩行を固定テンポから移動距離同期に変更。低速時の足滑りを抑え、移動速度に合った足運びにした。
- 歩行中に3pxの小さな上下動、足元パフ、高速時の短いモーションラインを追加。
- 「射撃中なら停止中でも歩行」の条件を廃止。停止射撃はアイドル姿勢を維持する。

### 検証
- `node --check game.js` / `git diff --check` 成功。
- Chromeハーネスで着地後に右移動を入れ、4枚の連続フレームで異なる歩行ポーズ・上下動・足元エフェクトを目視確認。停止射撃でアイドル姿勢へ戻ること、ページJSエラー0件も確認。

## 2026-07-19 セッション: ステージ2〜5背景の作り込み

### 完了（未コミット）
- **AQUA HIGHWAY**: 湾岸高層ビル群、発光窓、観覧車、コンテナクレーンを追加。吊り橋を二脚主塔に作り直し、画面全体に主ケーブルと垂直ハンガーを展開。
- **SUNSET FACTORY**: 両端に巨大高炉、環状キャットウォーク、煙突と動的なガスフレアを追加。
- **CYBER STORM**: 画面中央に破断した発光リング、旋回データ粒子、コア光で構成した巨大データ竜巻を追加。落雷時のサージに連動。
- **HEART PALACE**: 大型ステンドグラス風の薔薇窓、中央ハート、両側の王冠風吊り照明を追加。
- 新規画像・外部アセット・依存は追加せず、Canvas 2Dの手続き描画のみで実装。

### 検証
- `node --check game.js` / `git diff --check` 成功。
- `.devtools/shot.js boss 1..4` でステージ2〜5をChrome撮影。追加景観、背景奥行き、ボス・弾・HUDの視認性を目視確認。

## 2026-07-19 セッション: ステージ直行テストモード

### 完了（未コミット）
- URLクエリ `?stage=N` （N=1..5）を追加。タイトル・オープニングを飛ばし、指定ステージの通常開始地点からHP/強化/タイムラインを初期状態で開始する。
- 既存の `?boss=N` / `?mid=N` と同じ初期化ブロックに統合。複数指定時は `boss > mid > stage` の優先順。
- `AGENTS.md` のテストモード一覧に `?stage=N` を追記。

### 検証
- Chromeで `?stage=1..5` をそれぞれ直接開き、全5件で `state=playing` / `bossState=waiting` / 対応する `stageIndex` / `phaseId=opening` / 通常雑魚スポーン / JSエラー0件を確認。
- `node --check game.js` / `git diff --check` 成功。

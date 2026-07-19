# AGENTS.md — ぐろちゃんシューティング 共通作業指示書

このリポジトリで作業する全AI（Claude Code / codex / その他）が従う共通ルール。
**これは「契約」。詳細な作業ログ・過去の意思決定は [HANDOFF.md](HANDOFF.md) を参照**（時系列で追記されている）。
矛盾する指示があれば「ユーザーの直接指示 > このファイル > HANDOFF.md > コード内コメント」の順で優先。

---

## 1. プロジェクト概要
- **単一ファイル HTML5 canvas 横スクロールシューティング**。本体は **`game.js`（約5000行・単一IIFE・ビルドなし）**。`index.html` をブラウザで開くだけで動く。
- アート方針: **ネオン×カワイイを維持したまま立体的・映画的に**。写実路線にはしない。カワイイ目は廃止しない。
- 公開先（GitHub Pages）: **https://chapinosuke.github.io/grochan-shooting/** （`main`push → 数分で反映）
- リポジトリ: https://github.com/chapinosuke/grochan-shooting

## 2. 絶対的な制約（破らない）
- **新規ライブラリ・npm依存を追加しない。** 描画は全て手続き的（canvas 2D）。
- **外部CDN・実行時ネットワーク依存を持ち込まない。** アセットはリポジトリ内に同梱する。
- 音・画像アセットを追加したら **必ず [THIRD_PARTY_ASSETS.md](THIRD_PARTY_ASSETS.md) に出典・ライセンスを追記**する。
- 描画は**ワールド座標 VW=1280 × VH=720**。`draw()` でビュー変換を1回だけ適用。

## 3. 実行と動作確認
ローカルサーバ（`file://` だと一部アセットが読めないので必須）:
```
python3 -m http.server 8123      # プロジェクト直下で起動
# 停止: lsof -ti:8123 | xargs kill
```

### テストモード（URLクエリ）
- `?stage=N` … ステージNの通常開始地点から開始（N=1..5）
- `?boss=N` … ステージNのボス戦から開始（N=1..5）
- `?mid=N` … ステージNの中ボス戦から開始
  - ボスは画面右外から**入場アニメで登場**する。スクショ検証は**登場完了まで ~10秒待つ**こと（早すぎると画面に居ない）。

### デバッグキー / API
- **F1**=FPS表示 / **Shift+N**=ステージスキップ / **Shift+M**=中ボス召喚 / **Shift+B**=ボス召喚 / **Shift+T**=タイムライン+30秒早送り
- `window.GRO_DEBUG` で状態取得（`phaseId`/`stageTime`/`continuesLeft`/`power` 等）

### スクショハーネス（`.devtools/`、puppeteer-core + システムChrome）
- `node .devtools/shot.js <play|boss|mid|shop> <stageSkips>` → `.devtools/shot-<mode>-s<skips>.png`
  - stageSkips: 0=SHIBUYA 1=AQUA 2=FACTORY 3=STORM 4=PALACE
- `node .devtools/crop.js <png> <cx> <cy> <cw> <ch>` → 3倍ズーム
- **注意**: headless はページ非表示扱いで自動ポーズするため `document.hidden` をspoof済み。**headless(swiftshader)のFPSは当てにならない** → ≥58fps判定は実機ブラウザ+F1でユーザーが確認する。

## 4. コード地図（game.js）
- ステージ定義配列 `stages`（~180行）: name/boss/midBoss/theme/sky/accent/spawnTable 等
- タイムライン: `PHASE_TEMPLATE` / `currentPhase(stageTime)`（ステートレス導出）
- 音声: `sampledSfx`+`sfx()` / `bgmTracks`+`playBgm()` / `voice()`（Gro-chan）/ `bossVoice(stageIdx,event)`（ボス）/ WebAudio合成は `sfx()` 末尾
- ボス: `spawnBoss`/`updateBoss`/`executeBossSpecial`/`drawBoss`。中ボス: `spawnMidBoss`/`updateMidBoss`/`drawMidBoss`
- ポーズ制御: `loadSet`/`bossSets`/`midSets`/`pickPoseFrame`/`stepPoseTimers`
- ヘルパー: `hexA`/`shade`/`heartPath`/`starPath`/`drawBox3D`/`drawCylinder3D`/`drawKawaiiEyes`/`clamp`。`ctx.roundRect` 使用可。光源は左上で統一。

## 5. アセットパイプライン
- **ボススプライト**: ユーザー自作/生成シート（`assets/images/bosses/sheets/*.png`、構え2/攻撃3/被弾2）→ 分割 → `assets/images/bosses/poses/<name>_<idle|attack|hurt>N.png`。`loadSet` が読み、`drawBoss`/`drawMidBoss` が `pickPoseFrame` で切替。未ロード時はプロシージャル描画にフォールバック。
- **三面図アンカー**: `assets/images/chibi/` の3人ちびドットが全生成の絵柄アンカー。生成は codex CLI 経由（`codex exec -m gpt-5.6-sol`、参照画像を毎回添付）。
- **音声（効果音ラボ）**: フリー・商用可・クレジット不要。mp3直リンクは **403 になるので Referer 付き curl** で取得:
  ```
  curl -A "Mozilla/5.0" -H "Referer: https://soundeffect-lab.info/sound/voice/game.html" \
    -o out.mp3 "https://soundeffect-lab.info/sound/voice/mp3/game/<char>-<line>.mp3"
  ```
  - ボイスキャラ: `game.html`（thief-boy/swordman/necromancer-oldwoman/wizard/witch/princess/healer/swordwoman）
  - 戦闘SFX: `.../sound/battle/mp3/<name>.mp3`
  - **少数音源を `playbackRate` で音色調整して差別化**する方針（ボスは `bossVoiceCfg` に char+rate を定義）
  - 一時ファイルは scratchpad か `tmp/`（`.gitignore` 済み）へ。使い捨てスクリプトはコミットしない。

## 6. Git 運用
- **コミットメッセージは日本語**。1行目に要約、本文に変更点を箇条書き。末尾に:
  ```
  Co-Authored-By: <あなたのモデル名> <noreply@anthropic.com>
  ```
- **コミット/プッシュはユーザーが指示したときだけ**行う。
- **コミット対象を精査する**: 中間生成物・生の元素材の重複コピー・`tmp/` は含めない（`ChatGPT Image *.png` のような散在ファイルは sheets/ に正規版があるので除外）。
- 大きめの作業は都度 `.devtools/shot.js` で検証してからコミット。

## 7. 現在の状態（2026-07-19 時点）
- 完了: ストーリーUI/挿絵13枚/ボス総入れ替え（MASQUERADE/SERVER GOLEM/INFERNO DJINN/BOT GENERAL＋QUEEN、旧ボスは中ボスに降格）/ボス別ボイス＋重厚SFX/SNS風刺幕間ストーリー。
- **残タスク**（詳細は HANDOFF.md 末尾）:
  1. 追加ステージ検討（1ステージ実プレイ約3.5分／全クリア約20分）
- セッションを終えるときは **HANDOFF.md に「状態」節を追記**してから終わる（次の担当が読む）。

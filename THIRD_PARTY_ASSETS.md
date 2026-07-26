# Third-party assets

## ステージ2ボス（ABYSS SIREN）

2026-07-26 にユーザーから提供された透過PNGのポーズシートを分割し、指定のnear-lossless WebPへ変換。

| ゲーム内ファイル | 出典 | ライセンス・利用許諾 |
| --- | --- | --- |
| `assets/images/bosses/sheets/abyss-siren-{1,2}.webp` | ユーザー提供（ChatGPT生成の人魚ポーズシート） | 本プロジェクト内で使用する素材としてユーザーから提供 |
| `assets/images/bosses/poses/abyss-siren_{idle1,idle2,attack1,attack2,attack3,hurt1,hurt2}.webp` | 上記シートから切り出し・位置揃え | 同上 |

## ステージ3ボス（FLAME OYABUN）

2026-07-26 にユーザーから提供された透過PNGのポーズシート2枚（各1448x1086 / 4x2の計16ポーズ）を
分割・整列し、指定のnear-lossless WebPへ変換。旧ボス INFERNO DJINN を置き換えたもの。

| ゲーム内ファイル | 出典 | ライセンス・利用許諾 |
| --- | --- | --- |
| `assets/images/bosses/sheets/flame-oyabun-{1,2}.webp` | ユーザー提供（ChatGPT生成の和彫り格闘家ポーズシート） | 本プロジェクト内で使用する素材としてユーザーから提供 |
| `assets/images/bosses/poses/flame-oyabun_{idle1,idle2,attack1..4,hurt1,hurt2,fall1,fall2,taunt,guard1,guard2,walk1,walk2,windup}.webp` | 上記シート全16ポーズを切り出し・右向き2枚（attack2 / guard2）のみ左右反転・共通487x459キャンバスへ整列 | 同上 |

旧ボス `inferno-djinn_*` は削除せず、再利用候補として保留中。

## ラスボス（QUEEN OF HEARTBREAK）

2026-07-26 にユーザーから提供された透過PNGのポーズシートを左右反転・分割し、指定のnear-lossless WebPへ変換。

| ゲーム内ファイル | 出典 | ライセンス・利用許諾 |
| --- | --- | --- |
| `assets/images/bosses/sheets/heartbreak-queen-{1,2}.webp` | ユーザー提供（ChatGPT生成の仮面の女王ポーズシート） | 本プロジェクト内で使用する素材としてユーザーから提供 |
| `assets/images/bosses/poses/heartbreak-queen_{idle1..4,attack1..4,hurt1..8}.webp` | 上記シート全16ポーズを切り出し・必要な攻撃のみ左右反転・位置揃え | 同上 |

旧ラスボス `stage5_{idle,attack,hurt}.webp` は削除せず、再利用候補として保留中。

## 花火効果音

| ゲーム内ファイル | 出典 | ライセンス |
| --- | --- | --- |
| `assets/sfx/fireworks-finale.mp3` | 効果音ラボ「連続打ち上げ花火」（`fireworks-barrage1.mp3`） | フリー・商用利用可・クレジット不要。公式配布音源を96kbps / 44.1kHz MP3へ変換 |

## プレイヤー衣装（ビキニ）

2026-07-25 にユーザーから提供。元PNGを `cwebp -q 88 -alpha_q 100` でwebp化したもの。

| ゲーム内ファイル | 出典 | ライセンス・利用許諾 |
| --- | --- | --- |
| `assets/images/player-bikini-sheet.webp` | ユーザー提供（1672x941 / 待機・ジャンプ・飛行射撃） | 本プロジェクト内で使用する素材としてユーザーから提供 |
| `assets/images/player-bikini-ground.webp` | ユーザー提供（2170x725 / 待機+歩行x4） | 同上 |
| `assets/images/player-bikini-hurt.webp` | ユーザー提供（2508x627 / 被弾x4） | 同上 |

## エンディングBGM

| ゲーム内ファイル | 出典 | ライセンス・利用許諾 |
| --- | --- | --- |
| `assets/bgm/静かに睨め.mp3` | ユーザー提供（Suno生成） | 本プロジェクト内で使用する素材としてユーザーから提供 |

## ゲームオーバーBGM

| ゲーム内ファイル | 出典 | ライセンス・利用許諾 |
| --- | --- | --- |
| `assets/bgm/Game Over, Again.mp3` | ユーザー提供 | 本プロジェクト内で使用する素材としてユーザーから提供 |

効果音は「効果音ラボ」から2026-07-18に取得し、ゲーム内に組み込んでいます。
配布元の利用規約に従い、素材そのものの再配布ではなくゲームの構成要素として使用しています。

- 配布元: https://soundeffect-lab.info/
- 利用規約: https://soundeffect-lab.info/agreement/
- 使用ページ: https://soundeffect-lab.info/sound/battle/battle2.html

| ゲーム内ファイル | 元素材 |
| --- | --- |
| `assets/sfx/player-shot.mp3` | 銃で撃つ1 |
| `assets/sfx/hit.mp3` | 銃弾が命中1 |
| `assets/sfx/special-beam.mp3` | ビーム砲1 |
| `assets/sfx/charge.mp3` | ビーム砲チャージ1 |
| `assets/sfx/explosion.mp3` | 爆発3 |
| `assets/sfx/big-explosion.mp3` | 大爆発1 |
| `assets/sfx/missile.mp3` | ミサイル発射1 |
| `assets/sfx/boss-warning.mp3` | 基地のサイレン1 |
| `assets/sfx/power-up.mp3` | パワーアップ1 |
| `assets/sfx/shield.mp3` | シールド1 |
| `assets/sfx/heavy-hit.mp3` | 硬いものに衝突3 |

## ボイス（ぐろちゃん）

効果音ラボ「ゲームの戦闘」女性ボイス（真面目な女剣士）を2026-07-19に取得。フリー・商用利用無料・クレジット表記不要。

- 使用ページ: https://soundeffect-lab.info/sound/voice/game.html

| ゲーム内ファイル | セリフ | 再生場面 |
| --- | --- | --- |
| `assets/voice/swordwoman-start1.mp3` | 覚悟しなさい！ | ゲーム開始 |
| `assets/voice/swordwoman-start2.mp3` | 負けられないわ！ | ボス出現 |
| `assets/voice/swordwoman-special1.mp3` | はあーっ！ | スペシャル |
| `assets/voice/swordwoman-special2.mp3` | 紫電一閃！ | スペシャル |
| `assets/voice/swordwoman-damage1.mp3` | きゃっ！ | 被弾 |
| `assets/voice/swordwoman-damage2.mp3` | いやっ！ | 被弾 |
| `assets/voice/swordwoman-win1.mp3` | 先を急ぎましょう | ステージクリア／全クリア |
| `assets/voice/swordwoman-death1.mp3` | きゃああーー！ | ゲームオーバー |

※ 上記以外の女剣士ボイス（attack/guard/faint/lose/greeting/special3）も `assets/voice/` に取得済み（未使用・差し替え用）。

## ボス別ボイス

効果音ラボ「ゲームキャラクターボイス」を2026-07-19に取得。フリー・商用利用無料・クレジット表記不要。
`assets/voice/boss/<char>-<line>.mp3` に格納し、`game.js` の `bossVoiceCfg` で各ボスにキャラ＋playbackRateを割当（少数音源を音色調整して5体に差別化）。

- 使用ページ: https://soundeffect-lab.info/sound/voice/game.html

| ボス | 元キャラ（音源） | playbackRate |
| --- | --- | --- |
| MASQUERADE（仮面の道化） | 盗賊の少年（thief-boy） | 1.05 |
| ABYSS SIREN（深海の人魚） | 高飛車な魔女（witch） | 0.82 |
| FLAME OYABUN（炎上親分） | 剣士（swordman） | 0.86 |
| BOT GENERAL（ロボ将軍） | 冷静な魔術師（wizard） | 0.85 |
| QUEEN OF HEARTBREAK（女王） | 高飛車な魔女（witch） | 1.0 |

各キャラの greeting/start/attack/damage/special/death/lose/win 系を取得（登場/フェーズ2/攻撃/被弾/撃破で使用）。
旧ステージ2ボス SERVER GOLEM の画像・音声素材は削除せず、再利用候補として保留中。
`swordman` は2026-07-19に一括取得したが未使用のまま置かれていたもので、配布ページ上の
正式なキャラクター名は未確認（ファイル名のみ判明）。スタッフロールでは「剣士」と表記している。
`necromancer-oldwoman` は旧 INFERNO DJINN 用。現在未使用だが素材は保留。

## 打撃SFX（FLAME OYABUN）

効果音ラボ「戦闘」を2026-07-26に取得。フリー・商用利用無料・クレジット表記不要。
公式配布音源を既存SFXと同じ 96kbps / 44.1kHz ステレオMP3へ変換。

- 使用ページ: https://soundeffect-lab.info/sound/battle/

| ゲーム内ファイル | 元素材 | 再生場面 |
| --- | --- | --- |
| `assets/sfx/punch-heavy.mp3` | 重いパンチ2 | ジャブ（火の玉） |
| `assets/sfx/punch-big.mp3` | 大パンチ | ストレート（火炎スイープ／熱線） |
| `assets/sfx/kick-heavy.mp3` | 重いキック1 | 膝蹴り（ヒートウォール） |
| `assets/sfx/punch-swing.mp3` | パンチの素振り2 | 全パンチの風切り（打撃音に重ねる） |
| `assets/sfx/step-in.mp3` | 全力で踏み込む | 突進の踏み込み |
| `assets/sfx/wall-break.mp3` | パンチで壁を破壊 | 突進が左端に激突 |
| `assets/sfx/arm-crack.mp3` | 腕を鳴らす | 第2幕の再入場フレックス |
| `assets/sfx/ko.mp3` | K.O. | 撃破（片膝をついた瞬間） |

## 重厚SFX（ボス戦）

効果音ラボ「戦闘」を2026-07-19に取得。フリー・商用利用無料・クレジット表記不要。

- 使用ページ: https://soundeffect-lab.info/sound/battle/

| ゲーム内ファイル | 元素材 | 再生場面 |
| --- | --- | --- |
| `assets/sfx/boss-roar.mp3` | ドラゴンの鳴き声1 | ボス登場 |
| `assets/sfx/boss-quake.mp3` | 地響き1 | ボス登場 |
| `assets/sfx/boss-superhit.mp3` | 超必殺技がヒット1 | フェーズ2突入（HP50%） |
| `assets/sfx/boss-collapse.mp3` | 建物の崩壊1 | ボス撃破 |

# Third-party audio assets

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
| SERVER GOLEM（鋼鉄巨人） | 男剣士（swordman） | 0.72 |
| INFERNO DJINN（炎上魔人） | ネクロマンサー老婆（necromancer-oldwoman） | 0.88 |
| BOT GENERAL（ロボ将軍） | 冷静な魔術師（wizard） | 0.85 |
| QUEEN OF HEARTBREAK（女王） | 高飛車な魔女（witch） | 1.0 |

各キャラの greeting/start/attack/damage/special/death/lose/win 系を取得（登場/フェーズ2/攻撃/被弾/撃破で使用）。

## 重厚SFX（ボス戦）

効果音ラボ「戦闘」を2026-07-19に取得。フリー・商用利用無料・クレジット表記不要。

- 使用ページ: https://soundeffect-lab.info/sound/battle/

| ゲーム内ファイル | 元素材 | 再生場面 |
| --- | --- | --- |
| `assets/sfx/boss-roar.mp3` | ドラゴンの鳴き声1 | ボス登場 |
| `assets/sfx/boss-quake.mp3` | 地響き1 | ボス登場 |
| `assets/sfx/boss-superhit.mp3` | 超必殺技がヒット1 | フェーズ2突入（HP50%） |
| `assets/sfx/boss-collapse.mp3` | 建物の崩壊1 | ボス撃破 |

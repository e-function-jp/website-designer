# 参照再現レビュー（参照の意匠を学ぶランのみ）

## なぜ必要か

AOGAMI（`docs/quality/runs/corporate-20260918-0500`、参照 NSSG）の問題は、ページが壊れたことだけではない。Look で見つけた意匠が Direction の段階で変更され、実装では Direction を優先したため、静的品質を上げても参照への忠実度は上がらなかった。

| 工程 | 確認できたこと |
| --- | --- |
| Look | `look-analysis.md` の §2・3・4：写真主体の TOP、控えめな縦ナビと通常扱いの Contact、About の左ラベル・右本文、Projects のカテゴリと作品探索。未操作の状態は未検証とする。 |
| Direction | `direction-a.html` の hero・philosophy・works・intro-filter・all-works：MV直後の説明、実績3数値、TOP 20枠のうち15枠を図版、Projects 55枠のうち45枠を図版に変更。フィルタ後は即時表示で再リビールしない指示。一般的な会社サイトの文量・装飾と、参照の省略や動作を比較して採否を承認する手順がなかった。 |
| 実装 | `scripts/web-implement-minimax.sh` のプロンプトは Direction の指定コピーと演出をそのまま実装する方針。よって余計なコピーや素材数は、実装者の独断と決めつけない。逆に指定どおりの挙動だったかは実画面で別途検証する。 |
| 既存QA | 9/18 独立採点は旧版45点。News の幅・弱い図版・背景画像反復を指摘した一方、既定の撮影範囲は TOP / About / Service（Projects なし）。静止画採点は hover・ナビスクロール・フィルタ等を証明しない。11/17 のセルフレビューは Projects の配置などを改善したが、最新共有版について利用者が再指摘した意匠を網羅していない。 |
| 9/19 The Classic 対応 | `6a512a8` の `arch-animation-missing` は、Direction に演出指定があるページで演出部品や自前 CSS が全くないケースなどを静的に検知。共通部品内にも到達するが、パララックス、ナビのフェード、メニュー開閉、hover、フィルタ結果のアニメーションなどの種類・出現条件・実動作は比べない。削除せず併用する。 |

## 次のランからの手順

1. TOP と役割が異なる下層2ページ以上を選び、**そのページにない要素も観察**する。PC とモバイルで初期表示・途中・末尾を比較し、重要操作の前後を確認する。見た事実と利用者の意図は別欄に書く。外部素材・社名・ロゴ・固有の文章はコピーしない。
2. 参照寄せが目的のランでは、`job.json` に `"reference_fidelity": true` を入れ、`reference-fidelity.json` を作る。ファイルだけを置いても有効だが、job 側でも宣言するとファイル欠落で停止する。観察・狙い・再現/応用/省略の判断と、比較可能な受入条件を固定。例: MVのパララックス＋フェード、PCナビのスクロール時の消え方とハンバーガー、短い英語ラベルと日英順、不要な文を置かない、News帯の実効幅、意味のある画像の数量と hover、About の写真リンク、Projects の絞り込みと結果アニメーション。英語は意匠に合う場合の選択肢で、全サイトの一般ルールではない。
3. `direction-a.html` の該当ページに、各項目の設計と `data-fidelity-id="top-motion" data-fidelity-decision="preserve"` のような目印を一度だけ入れる。曖昧な適用や意匠の意図的変更は `adapt` / `omit` の理由を残す。意匠と読み上げ・キーボード・reduced motion 等が衝突する場合は利用可能性を優先し、両立方法または差を記録する。意味のない説明・カード・画像を定型で足さない。
4. 実装者とは別のレビュアーが、参照と**同じページ・幅・操作状態**でピクセルと動作を比較。動作は前後の画像だけで分からなければ録画、連続画像、ブラウザー測定を添える。レビュー用ビルドの識別子と各URLを入力する。取得失敗・未検証・未解決の項目は合格にしない。静的検査、実描画検査、独立した意匠レビューは別に報告。
5. 以下を順に実行。機械ゲートの成功は、証拠がそろっているという意味で、意匠・動作の内容の良し悪しや公開の承認は証明しない。

```bash
python3 scripts/web-reference-fidelity.py <run_dir> contract
python3 scripts/web-reference-fidelity.py <run_dir> direction
python3 scripts/web-reference-fidelity.py <run_dir> review
```

`scripts/web-run.sh` では契約確認、画像/実装前の Direction 確認、提出計測後のレビュー確認を行う。未入力ならオプトインしたランを完了と表示しない。レビューは手作業で記録したあと個別コマンドでも確認できる。既存ランは宣言または契約ファイルを追加しない限り挙動が変わらない。配信スクリプト、既公開のサイトは変更しない。撮影記録・参照の画像類は承認済み非公開の保存場所に置く（公開や素材の再配布を前提にしない）。

### 契約の形

```json
{
  "schema": 1,
  "pages": {"/": "https://reference.example/", "/about/": "https://reference.example/about/", "/projects/": "https://reference.example/projects/"},
  "criteria": [
    {"id":"top-motion","page":"/","kind":"interaction","observation":"スクロールに応じ写真と本文の速度が違い、フェードする","intent":"写真主体の導入を維持する","decision":"preserve","acceptance":"初期表示と同じスクロール量で写真の移動と不透明度を参照と比較する。省モーション時は内容が読める。","states":["initial","scroll","reduced-motion"]},
    {"id":"about-links","page":"/about/","kind":"imagery","observation":"下部に画像付き関連リンク","intent":"写真を次のページへの手がかりにする","decision":"adapt","rationale":"写真は自社の内容に合わせ独自に用意する","acceptance":"PCとスマホで各リンク画像が内容を示し、キーボードからも遷移できる","states":["scroll","focus"]},
    {"id":"work-filter","page":"/projects/","kind":"interaction","observation":"カテゴリ変更の際に作品一覧が再表示される","intent":"分類を理解して目的の作品を見つける","decision":"preserve","acceptance":"カテゴリ変更前後で表示項目と動作を比較する","states":["initial","filter","reduced-motion"]}
  ]
}
```

### レビューの形

`reference-fidelity-review.json` のトップレベル: `contract_sha256`、`direction_sha256`、`implementer`、`reviewer`、`sample_build`、`sample_pages`（契約と同じページキー→サンプルURL）、`results`。
各結果は `id`、`status`（`pass` のみ通過）、レビュアーの具体的な `finding`、`pairs`。各ペアは `viewport`（`desktop` / `mobile`）、`state`、`reference_url`、`sample_url`、`reference` と `sample`（それぞれラン内の相対 `path` と `sha256`）。指定した各状態は両ビューポートのペアが必要。ただし hover は PC のみ。画像の有無・ハッシュとページ対応を機械確認し、画面幅の実測値・操作手順・内容、および sample_build と配信版の照合はレビュアーが記録する。秘密情報を含めない。

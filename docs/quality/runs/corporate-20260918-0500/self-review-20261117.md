# 蒼紙舎 3ページ・セルフレビュー（2026-11-17）

## 位置づけと版

- 本人の現行サンプル評価は **30/100**。これは本人評価であり、本書の採点ではない。
- Pamela WSL の基準 HEAD: `a53460d8c4534d9aab2b530f6690bfedfc548c08`。作業前は clean。修正は未コミット。Mac 再作成の「つづり」8ページは未移植。
- 公開中の専用レビュー `https://e-function.site/design-reviews/website-designer-main-a53460d8/site/` は基準 HEAD の版。今回の未コミット修正は未配信。
- 今回の上限は2修正サイクル。独立レビューは未実施。本書はセルフレビュー用記録。

## 対応根拠

`docs/quality/runs/corporate-20260918-0500/job.json` の reference URL は `https://nssg.jp/`。同 run の `motion/summary.json`、`look-analysis.md`、`direction-a.html` と、`src/pages/sites/corporate/b-20260918-0500/` のページ構成を照合。対象は TOP ↔ `/`、理念・信頼の About ↔ `/about/`、仕事発見の Projects ↔ `/projects/`。参考の名前・写真・ロゴ・コピーは成果物へ転載していない。

他の確認可能な対応: 北嶺ニュートリション ↔ `corp.ezobolic.jp`、あおば矯正歯科 ↔ `yaizu-ortho.com`、軌道セールス設計 ↔ `sales-dex.jp`、株木堂建築 ↔ `3jigen.jp`、ノクスレイ ↔ `contenna.net`。白澄メディウェルとミナモト精機は元参考との対応未確認。

## 観察 → 解釈 → Direction → 受入条件

1. Projects: 参照は冒頭の短いタイトル直下に5列／スマホ2列の画像群。基準サンプルは数値説明が先で、最初の作品が初期画面に出ない。作品の発見が主役という Direction に合わせ、一覧を数値説明より先に置く。1280/390とも初期画面に作品を表示する。
2. About: 参照は短いタイトルの後、左ラベル・右本文の静かな編集構成。基準サンプルは導入前の空白が長い。既存 `LabeledSection` を活かして導入を詰める。1280 の初期画面で理念本文を読めること。
3. TOP/共通ヘッダー: 参照は写真を主役にした控えめなロゴと縦ナビ。基準サンプルは箱付きロゴ・大きい CTA・下線が写真に強く重なる。`aogami-corporate` テーマの既存 CSS に限定して調整する。画像の可視領域を保ち、他テーマへ波及させない。
4. 残る構造差: サンプル Projects は5案件×11表現の55タイルを繰り返し、スマホ全長約15,000px。参照は約4,000pxで作品の多様性が高い。これは今回の局所修正では解消していない。実案件数に誤認させない説明も必要なため、後続の制作内容見直しとして残す。

## 証拠と実施

画像・JSON はリポジトリ外の `aogami-review-evidence/{baseline,cycle1,cycle2}/`。各 `capture.json` に URL、UTC 時刻、viewport（1280×900 / 390×900）、top/middle/footer のスクロール状態、HTTP、ページ高、ナビ表示、エラーを保存。全6 URL×2 viewport×3段階を各時点で撮影し、実ピクセルを開いて確認した。最初の `before/` は WSL の日本語フォント欠損で文字が豆腐となったため比較根拠から除外。Windows の日本語フォントを `FONTCONFIG_FILE` で参照して `baseline/` から有効な撮影を取り直した。参照3ページは今回の各撮影時に HTTP 200。

- cycle 1: Projects 一覧を冒頭へ移動、About 導入余白を縮小。初期画面に作品が出ることを画像で確認。ただし既存 `global.css` の強いテーマ規則がヘッダー余白を残していた。
- cycle 2: 既存 `global.css` の蒼紙舎テーマ規則だけを調整。ヘッダー高さ・パンくず上余白を縮小し、ブランド背景と CTA を静かにした。再撮影画像で Projects がデスクトップ5列／スマホ2列で初期画面に入り、About 理念本文が初期画面へ上がったことを確認。TOP 写真は独自素材のまま維持。参照と完全一致とは判定しない。
- 残る差: TOP の被写体・空気感、Projects のタイル反復と長さ、About の全体分量、モバイルメニューの造形。視覚採点は行っていない。

## 段階台帳

| 段階 | 状態 |
|---|---|
| 既存経路 | run の job / motion / Look / Direction と source を確認 |
| 観察 | 参照・サンプル3ページ×2 viewport の初期・中間・末尾を実見 |
| Direction | 上記4項目へ絞り、ページ役割と接続 |
| 実装 | 2サイクル、3ファイルの未コミット差分 |
| レビュー | セルフレビュー実施、独立レビュー未実施 |
| 改善 | Projects / About / ヘッダーの局所修正、上限到達 |
| 部品還元 | 既存 `LabeledSection`、`WorkTileGrid` 再利用。共通部品自体の変更なし |
| テスト | build / static / catalog / 操作 / 描画の結果を下記に追記 |
| ソース保全 | HEAD と作業前 clean を記録、作業後 diff を外部 patch へ保存 |
| 共有 | 本書と画像を独立レビュー用に整理。未公開 |

## 検証・公開

- `npm run build`: 88 routes / postbuild 成功。これは視覚品質の採点ではない。
- `node scripts/web-quality-check.mjs`: 総合 100/100、8サイト・89ページ。対象3ページは指摘0。既存の別ページの指摘はレポートに残る。
- `npm run check:catalog`: 151/151 掲載、40部品は簡易表示。
- Playwright: 1280/390 で TOP → Projects → identity 詳細、スマホのメニュー開閉・リンクを確認。いずれも55タイル表示、遷移成功。
- `node scripts/web-render-check.mjs --json`: 全87ページ、exit 1、high 9。対象 TOP は既存の `render-hero-h1-hidden` high と medium 2、About は見出しサイズ medium 1、Projects は今回の小見出しサイズ medium 1。基準レポートは全87ページ high 14 だったが、原因別の再判定前なので減少を改善成果とは断定しない。`aogami-render-check-baseline.json` と `aogami-render-check-cycle2.json` を別名保全。TOP high は解消しておらず公開ゲートを通過していない。
- 公開: 実施せず。専用配信スクリプトは clean な main HEAD 固定であり、未コミット修正を配信しない。基準版 URL を改善版と取り違えない。

## 次の独立レビューへ

`baseline` と `cycle2` の同名 ID 画像を並べ、TOP/文脈/作品導線とスマホ長さを確認してほしい。参照の素材を模倣せず、固有の本文・画像・作品の幅を増やす方向を検討する。今回の修正は git に未コミットで、公開版は基準 SHA のまま。独立レビューが終わるまで「完成」や「30点から何点に上がった」とは表現しない。

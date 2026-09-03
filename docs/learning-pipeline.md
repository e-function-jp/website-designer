# 学習パイプライン（参照学習 + 2案検証）

最終更新: 2026-09-03

## 目的

静的 `check:web` だけでは拾えない **「参照サイトらしさ」「AIテンプレ感」** を、
実サイトの vision 解析 → 2案生成 → ルーブリック採点で回し、品質を単調改善する。

## ディレクトリ規約（必須）

```
src/pages/sites/
  {site_type}/
    {model}-{YYYYMMDD-HHMM}/
      _site.ts             # サイト定義（必須。全ページがこれを import する）
      index.astro          # ルート: /sites/{site_type}/{model}-{stamp}/
      about/index.astro
      service/index.astro
      news/index.astro
      contact/index.astro

public/sites/
  {site_type}/_shared/{YYYYMMDD-HHMM}/   # 同一ランで共有する画像資産

docs/quality/
  history.json
  latest.md
  run-state.json
  runs/
    {site_type}-{YYYYMMDD-HHMM}/          # 作業切り出し単位
      job.json
      direction-{a,b}.html
      look-analysis.md
      motion/                             # モーション実測 + 参照キャプチャ
        summary.json                      #   ディレクターが読む正本
        {page}.json / {page}-full.jpg
      image-manifest-{a,b}.json
      shots/{model}-{page}.jpg            # 採点対象の実描画
      design-score-data.json
      design-score-history.jsonl
      meta/{model}.json
```

**フラットな `sites/*.astro` は禁止。** ページを1枚置いただけのものは website ではない
（`ia-too-few-pages` が high で検出する）。

### 命名

| 要素 | 規則 | 例 |
|---|---|---|
| site_type | `scripts/site_categories.py` の id | `corporate`, `service`, `recruit`, `media` |
| model | 実装案の識別子 | `base`（ベースライン）, `a`（堅実案）, `b`（冒険案） |
| stamp | `YYYYMMDD-HHMM`（JST） | `20260903-1400` |
| run_id | `{site_type}-{stamp}` | `corporate-20260903-1400` |

## 実行体制（2026-09-03 時点）

| 段 | 実行体 | 呼び出し |
|---|---|---|
| モーション実測 | Playwright (chromium) | `scripts/web-analyze-reference-motion.mjs` |
| Look（画像を見る） | **codex** | `codex exec -i {capture}` |
| Direction ×2 | **grok-4.5** | `hermes -z ... -m grok-4.5 --provider xai-oauth` |
| 画像生成 | **grok-imagine** | hermes の xai image_gen プラグイン経由 |
| 実装 ×2 | **minimax-m3** | `hermes -z ... -m minimax-m3 --provider opencode-go` |
| 採点（独立judge） | **codex** | `codex exec -i {shots}` |

Look を codex にしているのは分担上の制約による。`hermes -z` は画像添付に対応していないため、
「画像を見て言語化する」役は画像を渡せる codex が担い、grok はそのテキストと
モーション実測 JSON を読んでディレクションする。

通しで回すには `bash scripts/web-run.sh {run_dir}`。途中から再開するときは `--from direction` 等。

## 環境依存パラメータ（ハードコード禁止）

ホスト名・repo 絶対パスはソースに書かない。`.env`（雛形: `.env.example`）で渡す。
実装: `scripts/env_config.py` / `scripts/web-preview-urls.py`

| 変数 | 用途 |
|---|---|
| `WEB_DESIGNER_ROOT` | リポジトリ絶対パス（省略時は自動検出） |
| `WEB_DESIGNER_PREVIEW_HOST` | Tailscale MagicDNS 名 または IP |
| `WEB_DESIGNER_PREVIEW_PORT` | `astro preview`（既定 4321） |
| `WEB_DESIGNER_REPORT_PORT` | 静的レポートサーバ（既定 8766） |
| `WEB_DESIGNER_MODELS` | 実装案の識別子 CSV（既定 `a,b`） |
| `WEB_DESIGNER_JUDGE_CMD` | design-score の独立judge CLI（既定 `codex`） |
| `WEB_DESIGNER_SCORE_PAGES` | 採点対象ページ（既定 `/ /about/ /service/`） |
| `WEB_DESIGNER_DIRECTOR` / `_MODEL` / `_PROVIDER` | ディレクター（既定 `grok` / `grok-4.5` / `xai-oauth`） |
| `WEB_DESIGNER_IMPL_MODEL` / `_PROVIDER` | 実装（既定 `minimax-m3` / `opencode-go`） |

## 全体像

```
[A. 収集] muuuuu.org → site_archive/fetch_site_archive.py
       → site_archive_{date}.csv（site_type / industry 列付き）
       → site_archive/categories.json（占有率スナップショット）
    ↓
[B. 作業切り出し] scripts/web-learning-next.py
       → 不足度 = 目標構成比 - 自前の構成比 でサイト種別を選択
       → docs/quality/runs/{site_type}-{stamp}/ + job.json
    ↓
[C0. モーション実測] scripts/web-analyze-reference-motion.mjs
       → Playwright で参照サイトを開き、**スクロールしてトリガーを踏んでから**計測
       → リビール種別/duration/easing、ヘッダー挙動、ページ遷移、reduced-motion 対応、
         ページ間のリビール数の開き を {run_dir}/motion/ に記録
       → キャプチャ({slug}-full.jpg)もここで保存され、Look と採点で使い回す
       → 詳細: docs/motion-design.md
    ↓
[C. Look] codex（画像を見られる）で言語化
       → ★1ページのLPと違い、**サイトマップと回遊構造の言語化が主目的**
       → モーション実測 JSON も渡し、数値を含めて言語化させる
       → docs/playbooks/{site_type}.md に観測ログとして蓄積
    ↓
[D. Direction] direction.html に確定させる（実装段は これを読むだけで作業する）
       1. サイトマップ（何ページ作るか、階層、URL）
       2. グローバルナビの項目とラベル（事業内容が読めるラベルにする）
       3. 各ページのセクション構成と、そのページが担う役割
       4. トーン（配色2色・和文/欧文フォント・写真の方向性）
       5. 使う src/components/ の選定と、足りない部品の洗い出し
       6. **モーション指示**（全セクションに data-role="animation"。無い場合も none と明記）
       7. 画像プロンプト（<figure data-placement data-tags data-aspect><figcaption data-prompt>）
       ★ a案（堅実: 参照の構造を素直に踏襲）と b案（冒険: 世界観を保ちつつ構図で踏み込む）を
         **設計段階で分ける**。同一ディレクションを2案で実装しても差分が出ないことは
         lp-designer で実測済み（716行中36行=5%しか違わなかった）
    ↓
[E. Fix×2] direction.html を実装。_site.ts を先に書き、全ページ SiteLayout を使う
       → src/pages/sites/{site_type}/{a,b}-{stamp}/
       ※ ベタ書き禁止。既存 src/components/ を各ページ最低2件、サイト全体で6種類使う
    ↓
[F. Measure]
    1) npm run check:web
    2) bash scripts/web-design-score.sh {run_dir} {site_type} {stamp} a b
       → トップ+下層2ページを撮り、参照キャプチャと並べて独立judgeに採点させる
    3) meta/{model}.json に tokens / images を記録
    ↓
[G. Extract] ★必須ゲート
       両案それぞれから他業種でも使えるブロックを src/components/ に切り出す
       → check:web の arch-component-reuse が消えるまで完了扱いにしない
    ↓
[H. 出荷] check:web:strict → check:catalog → main 直コミット → push
```

## [C. Look] — website の Look は LP と違う

LP の Look は「1枚のキャプチャから配色・タイポ・セクション順を読む」作業だった。
website では **トップだけ見ても何も分からない**。必ず次を取る。

1. トップページ（フルキャプチャ）
2. 第2階層のページ2枚（例: 会社概要・事業内容）
3. グローバルナビの項目一覧（ラベルの言葉づかいをそのまま書き出す）
4. フッターのサイトマップ（どこまで露出させているか）
5. パンくずの有無と表記
6. 下層ページの共通レイアウト（ページタイトル帯の有無、サイド要素の有無）

観測結果は `docs/playbooks/{site_type}.md` に追記して蓄積する。

## [G. Extract] — 学習成果の還元（必須）

このパイプラインの目的は **サンプルサイトを増やすことではなく、コンポーネントライブラリを
育てること**。生成して終わりにすると、数千行のベタ書き HTML が溜まるだけで本線が成長しない。

### 手順

1. 両案を開き、design-score のレイヤー別の優劣を確認する
   （総合で負けた案が `information_architecture` では勝っていることがある。総合点だけで切り捨てない）
2. **それぞれから**他業種でも使えるブロックを洗い出す
3. Props を TypeScript interface で切り、`src/components/{sections,site,ui}/` に切り出す
4. サンプル側を切り出したコンポーネントの利用に書き換える
5. `npm run check:web` で `arch-component-reuse` の指摘が消えることを確認
6. `npm run check:catalog` で `/components` に載ったことを確認（収集は自動・手動登録不要）

### 抽出の判断基準

| 抽出する | 抽出しない |
|---|---|
| 3業種以上で再登場しうる構造 | その企業固有のコピー・写真配置 |
| Props で色/文言/件数を差し替えられる | 1回限りの実験的レイアウト |
| 既存コンポーネントの**バリアント追加**で済む | 既存とほぼ同一（重複を増やすだけ） |
| **下層ページの共通枠**（ページヘッダ帯・記事一覧・お問い合わせフォーム） | トップ専用の一点物ヒーロー |

最後の行が website 固有の観点。LP には「下層ページ」が無かったため、
**下層の共通枠こそ最も再利用が効く**にもかかわらず lp-designer では抽出対象になり得なかった。

## 出荷フロー

| 順 | コマンド | 成果 |
|---|---|---|
| 1 | `npm run check:web:strict` | 後退していないことを確認。exit 1 なら出荷しない |
| 2 | `npm run check:catalog` | Extract した部品が `/components` に載っているか検査 |
| 3 | `git add -A && git commit` | main へ直接コミット（PR方式は採らない） |
| 4 | `git push origin main` | リモート反映 |

> lp-designer は当初 PR 方式だったが、レビュアー実質1人の体制で滞留したため廃止された。
> `check:*:strict`（後退ガード）と design-score（独立judgeの指摘）が品質ゲートとして
> 機能しているので、本プロジェクトも最初から main 直コミットにする。

## アンチパターン

- `src/pages/sites/*.astro` のフラット配置 / 1ページだけのサンプル
- `_site.ts` を作らず各ページにナビを手書きする
- トップだけ作り込んで下層をナビとフッターだけの空ページにする
- ホスト名（`*.ts.net`）をソースに直書き
- DaisyUI 既定テーマ（light / dark / cupcake）のまま出荷
- 英語小見出しの連発（ABOUT / SERVICE / CONTACT を飾りで量産）
- 事業内容と無関係なストック写真 / emoji を主ビジュアルにする
- アニメーション指示を出したのに実装しない / import だけして使わない（`arch-animation-missing`）
- トップだけ演出を盛り、下層を無演出にする（`motion-consistency-drift`）
- `prefers-reduced-motion` を無視する（参照サイトが非対応でも真似しない）
- **Extract をせずに出荷**（サンプルだけ増えてライブラリが育たない）
- グローバルナビに「サービス」「事業」など何の事業か読めない空ラベルを並べる

## 関連

- 静的ループ: [self-improvement-loop.md](./self-improvement-loop.md)
- 移行整理: [migration-from-lp-designer.md](./migration-from-lp-designer.md)
- IA定義: [information-architecture.md](./information-architecture.md)
- モーション設計: [motion-design.md](./motion-design.md)

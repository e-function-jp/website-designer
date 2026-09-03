# lp-designer からの移行整理

最終更新: 2026-09-03

`../lp-designer` は **LP（1ページ・コンバージョン特化）** のデザインを学び自己進化する
プロジェクト。本プロジェクトは同じ仕組みを **website（多ページ・情報設計特化）** に
持ち込むが、そのまま複製できる部分と、作り直しが必要な部分がはっきり分かれる。
その線引きをここに記録する。

## 1. なぜ全部はコピーできないのか

| | lp-designer | website-designer |
|---|---|---|
| 評価の主語 | 1ページのコンバージョン | サイト全体の情報設計 |
| 成果物 | `index.astro` 1枚 | `_site.ts` + 複数ページのディレクトリ束 |
| 主軸のカテゴリ | 業種（food / medical / btob …） | サイト種別（corporate / service / recruit / media） |
| 参照の収集元 | rdlp.jp（LP専用アーカイブ） | muuuuu.org 等のサイトギャラリー |
| 品質の壊れ方 | CTAが弱い・FVが伝わらない | ナビがページ間でズレる・title重複・リンク切れ・孤立ページ |
| 1枚のスクショで判定できるか | できる | **できない**（一貫性・回遊は複数ページを並べないと見えない） |

最後の行が本質的な差で、これが品質チェッカーと採点スクリプトの設計を分けている。

## 2. そのまま移行したもの

| 対象 | 移行先 | 備考 |
|---|---|---|
| 技術スタック | Astro 6 / Tailwind 4 / DaisyUI 5 / TS strict | バージョンは lp-designer の既知良好構成に固定（下記 4 参照） |
| `src/styles/global.css` | 同左 | DaisyUI テーマ列挙もそのまま |
| 汎用コンポーネント 74 件 | `src/components/{actions,data-display,layout,navigation,animations,ui}/` | DaisyUI ラッパ層。LP でも website でも意味が変わらない |
| `src/lib/component-preview.ts` | 同左 | カタログの Props 自動サンプル生成 |
| `src/pages/components/index.astro` | 同左 | カタログページ。LPLayout → BaseLayout に差し替え |
| `scripts/env_config.py` | 同左 | 環境変数名を `LP_DESIGNER_*` → `WEB_DESIGNER_*` |
| `scripts/lp-preview-urls.py` | `scripts/web-preview-urls.py` | ルート探索を `samples/` → `sites/` |
| `scripts/lp-shoot-sample.mjs` | `scripts/web-shoot-sample.mjs` | dist をその場でサーブして撮る仕組みは同じ |
| `scripts/lp-check-component-catalog.mjs` | `scripts/web-check-component-catalog.mjs` | 変更なし |
| 品質チェッカーの**エンジン部**（`findBaseToken` / `hasBaseToken` / 採点 / 履歴 / strict ガード） | `scripts/web-quality-check.mjs` | ルール本体は総入れ替え |
| 学習ループの**骨格**（Look → Direction → 実装2案 → 独立judge採点 → Extract ゲート） | `docs/learning-pipeline.md` | 段の並びは同じ。各段の中身は website 向けに定義し直し |
| 「静的解析・codex レビュー鉄則」8箇条 | `.claude/skills/frontend-design-web.md` | ルール実装時の落とし穴。技術非依存なのでそのまま有効 |
| design-score の**反復履歴・後退警告**の仕組み | `scripts/web-design-score.sh` | 「修正するほど点が下がる」事故への対策。website でも同じ risk がある |

## 3. 持ち込まなかったもの

| 対象 | 理由 |
|---|---|
| `src/components/sections/` 120 件 | LP セクション（Hero/FloatingCTABar/TrialSachetOffer 等）。website の情報設計には対応せず、持ち込むと `arch-component-reuse` が最初から満たされてしまい**website 固有の部品が育たなくなる** |
| `lp_archive/fetch_lp_archive.py` | rdlp.jp は LP 専用ギャラリー。website の参照サイトが取れない |
| `scripts/lp_categories.py` の業種ローテ | 業種1軸では website を分けられない（同じ業種でもコーポレート/採用でIAが別物）。サイト種別を主軸に置き直した |
| `cv-*` ルール群（`cv-no-cta` / `cv-no-form` / `cv-broken-anchor`） | 「CTAが3個以上あるか」は下層ページには当てはまらない。`base-broken-internal-link` に発展的に置き換え |
| `visual-fixed-cta-clearance` 等の LP固有 Visual ルール | 固定CTAバーは LP の装置。website では常設しない |
| `docs/playbooks/{業種}.md` | LP の業種別プレイブック。website 版は空から書き起こす |
| Hermes cron / 多モデル（codex/grok/minimax）実装体制 | 初期は手動運用で仕様を固める。安定後に導入する |
| PR 方式の出荷フロー | lp-designer で滞留し廃止済み。最初から main 直コミット前提にする |

## 4. 依存バージョンの固定について

`package.json` の `dependencies` は caret を外し、`overrides` で `vite: ^7.3.1` を固定している。

理由: 素直に `^` で入れると vite 8（rolldown）が hoist され、
`@tailwindcss/vite` が `Missing field 'tsconfigPaths'` でビルド不能になる。
lp-designer が動いている構成（astro 6.0.8 / vite 7 / tailwind 4.2.2 / daisyui 5.5.19）に揃えた。
上げるときは `npm run build` を通してから上げること。

## 5. 新たに定義したもの

### 5.1 サイト定義 `_site.ts`（website の中核）

LP は 1 ページなので Props だけで足りた。website はグローバルナビ・フッターサイトマップ・
組織情報がサイト全体で一貫している必要がある。写経に頼ると必ずズレるので、
サンプルサイトごとに `_site.ts` を 1 つ置き、全ページがそれを import する。

- 型: [`src/lib/site.ts`](../src/lib/site.ts)（`SiteConfig` / `NavItem` / `Breadcrumb`）
- 共通シェル: `SiteLayout.astro` + `components/site/{SiteHeader,SiteFooter,SiteBreadcrumbs}.astro`
- 品質チェックの `arch-site-config-missing` がこの規約を機械的に強制する

### 5.2 サイト種別と必須ページ `scripts/site_categories.py`

LP の「業種」に代わる主軸。サイト種別ごとに `required_pages` / `recommended_pages` を持ち、
`ia-required-page-missing` が直接参照する（Node へは `web-export-site-types.py` で JSON 化）。
業種は従軸として残し、参照サイトを揃えるのに使う。

### 5.3 品質ルールの総入れ替え（`scripts/web-quality-check.mjs`）

**PAGE_RULES（19件）** … 1ページで判定できるもの
`base-viewport` / `base-title` / **`base-broken-internal-link`** / `nav-global-missing` /
`nav-no-current` / `seo-meta-description` / `seo-title-shape` / `seo-ogp` / `seo-canonical` /
`seo-sitemap-robots` / `a11y-h1` / `a11y-img-alt` / `a11y-skip-link` / `a11y-nav-label` /
`a11y-heading-order` / `a11y-lang` / `perf-img-lazy` / `perf-img-dimensions` / `content-thin-page`

**SITE_RULES（13件・website 固有）** … サイト全ページを横断して判定
`ia-too-few-pages` / `ia-required-page-missing` / `ia-recommended-page-missing` /
`ia-breadcrumb-missing` / `ia-orphan-page` / `consist-nav-drift` / `consist-duplicate-title` /
`consist-duplicate-description` / `consist-theme-drift` / `consist-footer-missing` /
`consist-default-theme` / `arch-site-config-missing` / `arch-component-reuse`

SITE_RULES の指摘はそのサイトのトップページに計上する。

### 5.4 参照サイトの収集（`site_archive/fetch_site_archive.py`）

muuuuu.org をスクレイプする。詳細ページ URL の `/industry/{slug}/` が業種タクソノミに
なっており、rdlp.jp の業種列に相当する情報がそのまま取れる。
サイト種別はタイトル＋URL のシグナル（`co.jp` / `recruit.` / `.ac.jp` 等）で推定する。

> 現状の分類精度: 190件中 `other` 98件。タイトルがブランド名だけの掲載が多いため。
> `scripts/site_categories.py` の `keywords` / `url_keywords` を運用しながら詰めていく。

### 5.5 採点ルーブリックの第1層差し替え（`scripts/web-design-score.sh`）

lp-designer の第1層は `conversion`（FV即伝達 / CTA配置 / 情報順序）だった。
website ではここを **`information_architecture`**（サイトマップの妥当性 / ナビの分節 /
現在地 / 下層への導線と戻り導線 / ページ粒度）に差し替えている。
残る4層（visual / nielsen / reference_fit / quality）は観点を website 向けに書き換えたうえで踏襲。

また、採点対象は 1 枚ではなく **トップ + 下層2ページ** を並べて撮る。
ページ間の作り込みムラとナビの一貫性は 1 枚では見えないため。

## 6. まだ無いもの（今後の宿題）

| 項目 | lp-designer の対応物 | 備考 |
|---|---|---|
| サイト種別別プレイブック | `docs/playbooks/{業種}.md` | ラン1回目の Look 成果から書き起こす |
| ディレクション生成の定型 | `scripts/lp-direction.sh` + テンプレート | IA（サイトマップ）を確定する段が website では重い。専用テンプレートが要る |
| 画像生成パイプライン | `lp-generate-images-from-direction.mjs` | website は必要枚数が LP より多い。再利用ロジックを含めて設計し直す |
| 全サンプルレポート | `lp-append-samples-index.py` / `all-samples-report.html` | 現状はトップページ（`src/pages/index.astro`）が `_site.ts` を自動収集して代用 |
| サムネイル生成 | `lp-build-thumbnails.mjs` | 索引にサムネを出す段で必要になる |
| デプロイ | `release-deploy.sh` + webhook | 本番ドメイン確定後 |
| cron 自動実行 | `lp-designer-learning-loop-daily` | 手動運用で仕様が固まってから |

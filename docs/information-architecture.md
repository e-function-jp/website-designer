# 情報設計（IA）定義

website-designer が「良いサイト」と判断する情報設計の基準。
lp-designer にはこの文書に相当するものが無い（LP は1ページなのでIAが存在しないため）。
**本プロジェクト固有の中核ドキュメント**である。

## 1. サイト種別と必須ページ

正本は [`scripts/site_categories.py`](../scripts/site_categories.py)。
Node 側（品質チェック）へは `python3 scripts/web-export-site-types.py` で
`docs/site-types.json` として書き出す。**定義を2箇所に書かないこと。**

| サイト種別 | 必須ページ | 推奨ページ | ローテ対象 |
|---|---|---|---|
| `corporate` コーポレート | `/` `/about/` `/service/` `/news/` `/contact/` | `/company/` `/recruit/` `/privacy/` | ✅ |
| `service` サービス・製品 | `/` `/feature/` `/price/` `/case/` `/contact/` | `/faq/` `/document/` `/about/` | — |
| `recruit` 採用 | `/` `/about/` `/people/` `/jobs/` `/entry/` | `/culture/` `/flow/` `/faq/` | — |
| `media` メディア | `/` `/articles/` `/category/` `/about/` | `/tag/` `/search/` `/contact/` | — |

`brand` / `ec` / `public` は収集時の分類にのみ使う観察カテゴリ。
ローテ対象にするときは `required_pages` と `tone` を埋め、`rotation: True` にする。

## 2. グローバルナビの設計基準

| 基準 | 理由 |
|---|---|
| 項目数は 4〜7 | 8以上はドロップダウンで階層化する。横並びで収まらないラベル数は選べない |
| ラベルで事業内容が読める | 「サービス」「事業」だけでは何をしている会社か分からない。「事業・技術」「加工の流れ」のように具体語を混ぜる |
| 英語ラベル単独は避ける | ABOUT / SERVICE / CONTACT の羅列は AI テンプレの典型。日本語を主、英語は副次表記に |
| 主要CTAはナビの外に置く | 「お問い合わせ」をナビ項目に混ぜると、他の項目と同じ重みになりCTAとして機能しない |
| 全ページで同一 | ページごとに項目が変わるのは事故。`_site.ts` の1箇所で定義する（`consist-nav-drift`） |

## 3. 現在地の提示

- グローバルナビの現在ページに `aria-current="page"` を付ける（`nav-no-current`）
- 下層ページには必ずパンくずを置く（`ia-breadcrumb-missing`）
- パンくずには `BreadcrumbList` の JSON-LD を併記する（`SiteLayout` が自動生成）
- 現在地の判定は前方一致にする（`/service/detail/` にいるとき `/service/` を現在地とする）

## 4. 回遊の設計

| 原則 | 検出ルール |
|---|---|
| どのページからも他の全ページへ2クリック以内で到達できる | `ia-orphan-page` |
| フッターにサイトマップを置き、ナビに出さない下層も露出させる | `consist-footer-missing` |
| 各ページの末尾に「次に見るべきページ」への導線を置く（袋小路を作らない） | — （目視レビュー） |
| リンク先は必ず実在させる。`href="#"` を残さない | `base-broken-internal-link` |

## 5. ページ粒度

- 1ページの本文は最低 400 文字（`content-thin-page`）。
  ナビとフッターだけのページは「作った」ことにならない
- 逆に、1ページに詰め込みすぎない。LP の癖でトップに全部載せると下層が空になる
- **トップの役割は「振り分け」であって「全部説明する」ことではない**。
  トップで完結させたくなったらそれは LP であり、website ではない

## 6. SEO の前提（多ページ固有）

| 項目 | 基準 | 検出ルール |
|---|---|---|
| `<title>` | 全ページ一意。`{ページ名}｜{サイト名}` 形式。60文字以内 | `consist-duplicate-title` / `seo-title-shape` |
| `meta description` | 全ページ一意。40文字以上 | `consist-duplicate-description` / `seo-meta-description` |
| `canonical` | 全ページに付与 | `seo-canonical` |
| `sitemap.xml` / `robots.txt` | 生成する（`@astrojs/sitemap`） | `seo-sitemap-robots` |
| 構造化データ | `Organization` は全ページ、`WebSite` はトップ、`BreadcrumbList` は下層 | `SiteLayout` が自動 |

## 7. アクセシビリティの前提（多ページ固有）

- スキップリンクを全ページに置く（`a11y-skip-link`）。
  多ページサイトではページ遷移のたびにグローバルナビを読み上げることになるため、
  LP よりも重要度が高い
- `<nav>` が複数ある場合は `aria-label` で区別する（`a11y-nav-label`）
- `h1` は各ページ1つ。トップは サイト名/キャッチ、下層はページ名（`a11y-h1`）
- ヘッダーのモバイルメニューは JS 不要の `details`/`summary` で組む
  （JS が落ちてもナビが死なない）

## 8. デザイントークンの一貫性

- `data-theme` はサイト内で1つ（`consist-theme-drift`）
- DaisyUI 既定テーマのまま出荷しない（`consist-default-theme`）。
  サイトごとにコーポレートカラーからテーマを起こす
- 色はメイン1色 + アクセント1色に絞る。ページごとに色を変えない

---
name: frontend-design-web
description: website（多ページサイト）特化のフロントエンドデザインスキル。Astro.js + DaisyUI/TailwindCSS で、情報設計から下層ページまで一貫したサイトを構築する。コーポレート/サービス/採用/メディアサイトの実装、IA設計、品質ルール実装時に使う。
---

## 概要

website 制作に特化したフロントエンドデザインスキル。LP（1ページ・コンバージョン特化）とは
**設計の主語が違う**。LP は「このページで申し込ませる」、website は
「訪問者が知りたいことに辿り着ける」。姉妹プロジェクト `lp-designer` の知見のうち、
1ページ前提のものは持ち込まない。

## 技術スタック（固定）

| レイヤー | 技術 | 備考 |
|---|---|---|
| フレームワーク | Astro.js v6 | 静的サイト生成 |
| CSS | TailwindCSS v4 | |
| UI | DaisyUI v5 | |
| 言語 | TypeScript (strict) | |

バージョンは `package.json` で固定（caret なし + `overrides` で vite を7系に固定）。
vite 8（rolldown）は `@tailwindcss/vite` がビルド不能になるため上げないこと。

## 実装の出発点は必ず `_site.ts`

ページを書き始める前にサイト定義を書く。ここを飛ばすとナビが必ずズレる。

```ts
// src/pages/sites/{type}/{model}-{stamp}/_site.ts
import type { SiteConfig } from '../../../../lib/site';

export const site: SiteConfig = {
  name: 'サイト名',
  tagline: 'キャッチ',
  base: '/sites/corporate/a-20260903-1400/',
  theme: 'business',              // DaisyUI 既定(light/dark/cupcake)は不可
  nav: [ /* 4〜7項目 */ ],
  footerNav: [ /* サイトマップ */ ],
  organization: { /* Organization schema に使う */ },
  primaryCta: { label: 'お問い合わせ', href: '/contact/' },
  legalNav: [{ label: 'プライバシーポリシー', href: '/privacy/' }],
};
export default site;
```

全ページは `SiteLayout` を使う。`SiteLayout` が以下を自動でやるので、手書きしない。

- ヘッダー / フッター / パンくずの描画
- 現在地の `aria-current="page"`
- `<title>` の `{ページ名}｜{サイト名}` 組み立て
- `Organization` / `WebSite` / `BreadcrumbList` の JSON-LD
- スキップリンク

```astro
---
import SiteLayout from '../../../../../layouts/SiteLayout.astro';
import { site } from '../_site';
---
<SiteLayout
  site={site}
  title="会社について"
  description="40文字以上・ページ固有の説明文"
  path="/about/"
  breadcrumbs={[{ label: 'ホーム', href: '/' }, { label: '会社について' }]}
>
  ...
</SiteLayout>
```

## 設計思考（コーディング前に決める）

1. **サイトの役割**: 訪問者は何を確かめに来るか（信頼できる会社か / 何ができるか / どう頼むか）
2. **サイトマップ**: 何ページ作るか。サイト種別の `required_pages` を満たしているか
3. **ナビのラベル**: 事業内容が読める言葉になっているか（「サービス」だけにしない）
4. **トーン**: 1つ選んでコミットする
   （信頼・堅実 / 先進・テック / 職人・実直 / エディトリアル / ナチュラル / 和風・伝統）
5. **各ページの役割分担**: トップは振り分け。全部説明しようとしたらそれは LP

詳細な基準は `docs/information-architecture.md` を読むこと。

## website のセクション設計パターン

LP のようなセクション定型は無い。**ページごとに役割が違う**。

| ページ | 役割 | 典型セクション |
|---|---|---|
| トップ | 振り分けと第一印象 | キーメッセージ / 数字 / 事業の入口カード / 新着 / CTA |
| 会社について | 信頼の裏付け | 代表挨拶 / 沿革 / 会社概要テーブル / 拠点 |
| 事業・サービス | 何ができるか | 領域カード / 設備・実績テーブル / 流れ(Steps) |
| 実績・事例 | 証拠 | 一覧 + 絞り込み / 詳細 |
| ニュース | 更新の証明 | 日付付き一覧 / カテゴリ |
| お問い合わせ | 受け皿 | 電話・メール併記 / フォーム / 送信後の流れ |
| 採用 | 人を集める | 社員紹介 / 募集要項 / 選考フロー / エントリー |

## デザインガイドライン

### タイポグラフィ（日本語）
- 見出し: Zen Kaku Gothic New / Shippori Mincho / Noto Sans JP など、
  サイトのトーンに合わせて選ぶ。全サイトで同じフォントを使い回さない
- 本文: 可読性重視。行間 1.7〜1.9、1行あたり 35〜45 文字
- サイズは `clamp()` でモバイルファースト

### カラー
- `data-theme` をサイトごとに1つ定義。メイン1色 + アクセント1色
- ページごとに配色を変えない（`consist-theme-drift`）

### レイアウト
- モバイルファースト必須
- 下層ページは共通の「ページヘッダ帯」を持たせ、トップとの落差を作らない
- コンテンツ幅はページの性質で変える（読み物は狭く、一覧は広く）

### モーション
- CSS-only と Intersection Observer を優先（`ScrollReveal` を使う）
- ページ遷移が前提なので、重い初期アニメーションは遷移のたびに邪魔になる。LP より控えめに

## アンチパターン

- トップだけ作り込み、下層がナビとフッターだけの空ページ
- `_site.ts` を作らず各ページにナビを手書き（必ずズレる）
- グローバルナビが「サービス / 事業 / 会社情報」など何の会社か読めない空ラベル
- 英語小見出しの連発（ABOUT / SERVICE / CONTACT を飾りで量産）
- DaisyUI 既定テーマ（light / dark / cupcake）のまま完成扱い
- 事業と無関係なストック写真、emoji を主ビジュアルにする
- 汎用AIテンプレ感（紫グラデ on 白背景、Inter 常用）
- 下層ページのパンくず省略、`href="#"` の放置
- LP の癖でトップに全部載せる

## 完成定義

`npm run check:web` で high ゼロ + `arch-component-reuse` ゼロ +
`ia-required-page-missing` ゼロ + 参照サイトの咀嚼が目視OK + AIテンプレ非該当。

Extract（`src/components/` への還元）を済ませていないものは完成ではない。
切り出した部品は `/components` のカタログに自動で載る（`npm run check:catalog` で検査）。

---

## 品質ルールを実装/拡張するときの鉄則

`scripts/web-quality-check.mjs` を触るときに守る。lp-designer で
codex review 30ラウンド・32件の修正を出した教訓をそのまま引き継いでいる。

### 鉄則 1: クラス検査はトークン単位・属性順非依存

Tailwind では class 順序・属性順序は意味を持たない。`substring` 検索ではなく
必ず `class.split(/\s+/)` でトークン配列に分解して検査する。

```js
// ❌ 順序依存 (false negative)
const re = /\bbadge\b[^"]*\berror\b/;
// ✅ トークン分割して独立検査
const tokens = cls.split(/\s+/);
const hasBadge = tokens.some(t => t === 'badge' || /^badge-[\w-]+$/.test(t));
```

### 鉄則 2: base vs responsive トークンを区別

`sm:flex` は base で flex がない限り適用されない。`/\bflex\b/` だと誤検知する。
`findBaseToken(classStr, re)`（数値トークン）/ `hasBaseToken(classStr, re)`（非数値）を使う。

### 鉄則 3: 数値トークンが複数ある場合は最大値

Tailwind は後勝ち。`class="py-2 py-4"` の effective は `py-4`。最初のトークンだけ拾わない。

### 鉄則 4: nested な構造は regex ではなく depth-tracking で

`[\s\S]*?` の non-greedy は最初の閉じタグで止まる。入れ子を見るなら自前パーサを書く。

### 鉄則 5: Astro scoped CSS の specificity

`<style>` は自動 scoped で `data-astro-cid-*` が付き、consumer 側の素のクラスより強い。
サンプル側の上書きを許したいなら `<style is:global>` を使う。

### 鉄則 6: P1 ブロッキングを先に潰す

構文エラー / ビルド破壊 / ロジック反転が最優先。ルールを足したら必ず
`node --check scripts/web-quality-check.mjs` と `npm run check:web` を通す。

### 鉄則 7: ルール追加時は「修正後のコードでも RED にならないか」を確認

自分の修正が新ルールに引っかかると、改善ではなく後退になる。

### 鉄則 8: severity の継承に注意

`return ['...']` は rule 自体の severity でスコアされる。
low なガイダンスを high ルールから返さない。別ルールに分ける。

### 鉄則 9（website 固有）: ルールの主語が page か site かを最初に決める

「1ページを見て判定できるか」で `PAGE_RULES` / `SITE_RULES` を選ぶ。
一貫性・重複・孤立・必須ページは **原理的に PAGE_RULES では書けない**。
逆にサイト横断ルールをページごとに走らせると、同じ指摘が全ページ分に増殖する
（本チェッカーはサイトのトップページにのみ計上している）。

### 鉄則 10（website 固有）: 検出より予防を先に考える

ルールで叩くより、共通シェル（`SiteLayout` / `_site.ts`）で構造的に起こせなくするほうが強い。
新しい壊れ方を見つけたら、まず「これは SiteLayout で防げないか」を考え、
防げないものだけをルールにする。

### ヘルパー一覧（scripts/web-quality-check.mjs）

| ヘルパー | 用途 |
|---|---|
| `findBaseToken(classStr, re)` | base の数値トークン検出 |
| `hasBaseToken(classStr, re)` | base の非数値トークン検出 |
| `extractInteractive(html)` | `<a>` / `<button>` をタグ・属性・テキスト・href に分解 |
| `extractNavs(html)` | `<nav>` を aria-label とリンク集合に分解 |
| `bodyText(html)` | script/style を除いた本文テキスト |
| `normPath(p)` | 末尾スラッシュを揃えたパス正規化 |

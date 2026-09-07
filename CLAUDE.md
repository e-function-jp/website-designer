# Website Designer Project

## 概要
Astro.js + DaisyUI/TailwindCSS による **website（多ページサイト）特化** コンポーネントライブラリ。
姉妹プロジェクト `../lp-designer`（LP特化）の仕組みを website 向けに再定義したもの。

## 技術スタック
Astro.js v6 / TailwindCSS v4 / DaisyUI v5 / TypeScript (strict) / Node >= 22.12.0

依存は `package.json` で**バージョン固定**（caret なし + `overrides` で vite を7系に固定）。
vite 8（rolldown）にすると `@tailwindcss/vite` がビルド不能になる。上げるときは build を通してから。

## Skills
- `.claude/skills/frontend-design-web/SKILL.md` — website 特化デザインスキル + 品質ルール実装の鉄則10箇条

## 主要ディレクトリ
- `src/pages/sites/{type}/{model}-{stamp}/` — サンプルサイト（複数ページ束）
- `src/layouts/SiteLayout.astro` — サンプルサイト共通シェル
- `src/layouts/BaseLayout.astro` — リポジトリ自身のページ用（索引・カタログ）
- `src/lib/site.ts` — `SiteConfig` 型（サイト定義の型）
- `src/components/site/` — ヘッダー/フッター/パンくず
- `src/components/{sections,ui,data-display,navigation,layout,actions,animations}/` — 部品
- `site_archive/` — 参照サイトの収集データ
- `docs/` — 自己改善ループ / 学習パイプライン / IA定義 / モーション設計 / 品質レポート

## コマンド
| 用途 | コマンド |
|---|---|
| 開発 | `npm run dev` |
| ビルド | `npm run build` |
| 品質チェック（build + 37ルール採点） | `npm run check:web` |
| 厳格チェック（スコア後退で exit 1） | `npm run check:web:strict` |
| カタログ検査 | `npm run check:catalog` |
| 参照サイト収集 | `npm run archive:fetch -- --pages 3` |
| 次のランを開く | `npm run next:run` |
| プレビューURL | `npm run urls` |
| 本番デプロイ | `bash scripts/release-deploy.sh`（`docs/deploy.md`） |

## 自己改善ループ
`docs/self-improvement-loop.md` に従う。二系統:

1. **静的** — `npm run check:web` / `check:web:strict`（`scripts/web-quality-check.mjs`）
   - `PAGE_RULES` … 1ページで判定できるもの
   - `SITE_RULES` … サイト全ページを横断して判定するもの（**website の中核**）
2. **参照学習+2案** — `docs/learning-pipeline.md`
   参照サイト → Look（トップ+下層2ページ）→ Direction（IA確定）→ a案/b案実装 →
   独立judge採点 → Extract

サンプル新規作成時はループ2を必須。

**Extract ゲート（必須）** — サンプルを作って終わりにしない。両案から再利用ブロックを
`src/components/` に切り出し、`check:web` の `arch-component-reuse` が消えるまで完了扱いにしない。

**モーションゲート** — 参照サイトの演出は `scripts/web-analyze-reference-motion.mjs` で
実測してから指示する。「フワッと」ではなく種別・ms・easing を数値で書く。
ディレクションの `data-role="animation"` と実装は `arch-animation-missing` が突き合わせる。
詳細: `docs/motion-design.md`

**`_site.ts` ゲート（必須）** — ページを書く前にサイト定義を書く。全ページが `SiteLayout` を使う。
これを飛ばすとナビが必ずページ間でズレる（`arch-site-config-missing` / `consist-nav-drift`）。

## LP との違い（最重要）
`lp-designer` の知見のうち **1ページ前提のものは持ち込まない**。
評価の主語は「1ページのコンバージョン」ではなく「サイト全体の情報設計」。
詳細: `docs/migration-from-lp-designer.md` / `docs/information-architecture.md`

## コンポーネント規約
- `.astro` で実装、Props を TypeScript interface で定義
- DaisyUI クラス + Tailwind ユーティリティ
- モバイルファースト必須
- `<slot />` で内容差し込み可能に
- 切り出した部品は `/components` に自動掲載（手動登録不要、`npm run check:catalog` で検査）

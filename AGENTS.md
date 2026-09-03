# AGENTS.md

AI coding agent 向け共通指示（GitHub Copilot / Claude Code / Cursor 等）。
`CLAUDE.md` は Claude Code 固有の追加指示として併存する。

## プロジェクト概要

Astro.js + DaisyUI/TailwindCSS による **website（多ページサイト）特化コンポーネントライブラリ**。
サイトギャラリーからの参照学習と静的品質チェックの二系統で、日本市場向けサイトの
情報設計と意匠を単調改善する。詳細は [README.md](./README.md)。

姉妹プロジェクト `../lp-designer` は LP（1ページ）特化。**知見の流用可否は
[docs/migration-from-lp-designer.md](./docs/migration-from-lp-designer.md) に整理済み。**

## 技術スタック（固定）

| レイヤー | 技術 | バージョン |
|---|---|---|
| フレームワーク | Astro.js | 6.0.8（固定） |
| CSS | TailwindCSS | 4.2.2（固定） |
| UI | DaisyUI | 5.5.19（固定） |
| ビルド | vite | ^7.3.1（`overrides` で固定） |
| 言語 | TypeScript | strict |
| ランタイム | Node | >= 22.12.0 |

caret を外しているのは意図的。vite 8（rolldown）で `@tailwindcss/vite` が
`Missing field 'tsconfigPaths'` を出しビルドできないため。

## ディレクトリ構造（要点）

```
src/
├── lib/site.ts                # SiteConfig 型（サイト定義の正本）
├── layouts/
│   ├── SiteLayout.astro       # サンプルサイト共通シェル
│   └── BaseLayout.astro       # 索引・カタログ用
├── components/
│   ├── site/                  # SiteHeader / SiteFooter / SiteBreadcrumbs
│   ├── sections/              # website セクション（Extract で育てる）
│   ├── ui/                    # 小さなUI部品
│   ├── data-display/ navigation/ layout/ actions/ animations/   # DaisyUI ラッパ層
└── pages/
    ├── index.astro            # サンプルサイト索引（_site.ts を自動収集）
    ├── components/            # コンポーネントカタログ（自動収集）
    └── sites/{type}/{model}-{stamp}/   # サンプルサイト（複数ページ）
scripts/
├── web-quality-check.mjs      # 静的品質チェック（PAGE_RULES 22 + SITE_RULES 14）
├── web-analyze-reference-motion.mjs  # 参照サイトのモーション実測（Playwright）
├── web-run.sh                 # ラン1回を通しで実行
├── web-look-analyze.sh        # Look（codex）
├── web-direction.sh           # ディレクション（grok-4.5 / hermes）
├── web-implement-minimax.sh   # 実装（minimax-m3 / hermes opencode-go）
├── web-generate-image{,s-from-direction}.mjs  # 画像生成（grok-imagine）
├── site_categories.py         # サイト種別・業種の正本
├── web-export-site-types.py   # → docs/site-types.json（Node 側が読む）
├── web-learning-next.py       # 次のランの選定とディレクトリ作成
├── web-design-score.sh        # 独立judgeによる視覚採点（複数ページ）
├── web-shoot-sample.mjs / web-check-component-catalog.mjs / web-preview-urls.py
site_archive/fetch_site_archive.py   # muuuuu.org からの参照サイト収集
docs/                          # ループ設計 / パイプライン / IA定義 / 品質レポート
```

## 主要コマンド

| 用途 | コマンド |
|---|---|
| 開発 | `npm run dev` |
| ビルド | `npm run build` |
| 品質チェック | `npm run check:web` |
| ラン1回を通しで実行 | `bash scripts/web-run.sh <run_dir>` |
| 本番デプロイ | `bash scripts/release-deploy.sh` |
| 厳格チェック | `npm run check:web:strict` |
| カタログ検査 | `npm run check:catalog` |
| 参照サイト収集 | `npm run archive:fetch -- --pages 3` |
| 次のラン | `npm run next:run` |

## 規約（website-designer 固有）

- **ページを書く前に `_site.ts` を書く**。全ページが `SiteLayout` を使う
- 1サイト = 1ディレクトリ束（`src/pages/sites/{type}/{model}-{stamp}/`）。
  ページ1枚だけのサンプルは website ではない
- サイト種別の `required_pages`（`scripts/site_categories.py`）を満たす
- モバイルファースト必須
- DaisyUI 既定テーマ（light / dark / cupcake）のまま完成扱いにしない
- 各ページで `src/components/` を最低2件、サイト全体で6種類使う（ベタ書き禁止）
- 下層ページには必ずパンくず。`href="#"` を残さない
- モーションは `_site.ts` の `motion` で一元管理。トップだけ盛らない
- `prefers-reduced-motion` を必ず尊重する
- `check:web` high ゼロ + `arch-component-reuse` ゼロ + `ia-required-page-missing` ゼロ
  + 参照の咀嚼が目視OK + AIテンプレ非該当 = 完成定義

## やってはいけないこと

- トップだけ作り込み、下層をナビとフッターだけの空ページにする
- 各ページにナビを手書きする（必ずズレる）
- グローバルナビに事業内容が読めない空ラベルを並べる
- 英語小見出しの連発（ABOUT / SERVICE / CONTACT）
- 紫グラデーション on 白背景 / Inter 常用などの**汎用AIテンプレ感**
- 事業と無関係なストック写真 / emoji を主ビジュアルにする
- ホスト名や repo 絶対パスをソースに直書きする（`.env` と `scripts/env_config.py` を使う）
- Extract をせずに出荷する

## 関連ドキュメント

- [README.md](./README.md) — プロジェクト概要
- [CLAUDE.md](./CLAUDE.md) — Claude Code 固有の追加指示
- [docs/migration-from-lp-designer.md](./docs/migration-from-lp-designer.md) — 移行整理の正本
- [docs/information-architecture.md](./docs/information-architecture.md) — IA定義（website固有の中核）
- [docs/motion-design.md](./docs/motion-design.md) — モーションの実測・指示・実装・検査
- [docs/self-improvement-loop.md](./docs/self-improvement-loop.md) — 二系統の改善ループ
- [docs/learning-pipeline.md](./docs/learning-pipeline.md) — 参照学習の作業ロジック
- [docs/quality/latest.md](./docs/quality/latest.md) — 直近の品質レポート

## 関連スキル

- **website デザイン** — `.claude/skills/frontend-design-web/SKILL.md`
  （`.github/skills/frontend-design-web` は同ファイルへのシンボリックリンク。**正本は1つ**）

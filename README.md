# website-designer

website（多ページサイト）のデザインを日々学び、自己進化しながらサンプルサイトを生成する
プロジェクト。姉妹プロジェクト [`lp-designer`](../lp-designer)（LP特化）の仕組みを
website 向けに再定義したもの。

## LP と何が違うか

| | lp-designer | website-designer |
|---|---|---|
| 評価の主語 | 1ページのコンバージョン | **サイト全体の情報設計** |
| 成果物 | `index.astro` 1枚 | `_site.ts` + 複数ページのディレクトリ束 |
| 主軸 | 業種 | **サイト種別**（corporate / service / recruit / media） |
| 参照元 | rdlp.jp | muuuuu.org 等のサイトギャラリー |
| 品質の壊れ方 | CTAが弱い・FVが伝わらない | ナビがページ間でズレる・title重複・リンク切れ・孤立ページ |

website の品質は 1 ページを見ても決まらない。だから品質チェッカーは
**ページ単位ルール（19件）とサイト単位ルール（13件）の2層**を持つ。

移行の線引きは [docs/migration-from-lp-designer.md](./docs/migration-from-lp-designer.md) に整理。

## クイックスタート

```bash
npm install
npm run dev            # http://localhost:4321
npm run check:web      # ビルド + 品質チェック
```

- `/` — サンプルサイト索引（`_site.ts` を自動収集）
- `/components/` — コンポーネントカタログ（`src/components/` を自動収集）

## 2つの改善ループ

### ループA — 静的品質

```bash
npm run check:web         # 採点 → docs/quality/latest.md
npm run check:web:strict  # 前回より下がったら exit 1
```

### ループB — 参照学習 + 2案検証

```bash
npm run archive:fetch -- --pages 3    # 参照サイト収集（muuuuu.org）
npm run next:run                       # 次のサイト種別を選びランを開く
# → Look → Direction → a案/b案 実装 → 採点 → Extract
bash scripts/web-design-score.sh docs/quality/runs/{run_id} {type} {stamp} a b
```

詳細: [docs/learning-pipeline.md](./docs/learning-pipeline.md)

## サイトの作り方（要点）

**ページを書く前に `_site.ts` を書く。** ナビ・フッター・組織情報の単一の情報源であり、
`SiteLayout` がそこからヘッダー・フッター・パンくず・JSON-LD・title を組み立てる。
各ページに手書きするとページ間で必ずズレる。

```
src/pages/sites/corporate/a-20260903-1400/
├── _site.ts          # サイト定義（必須）
├── index.astro
├── about/index.astro
├── service/index.astro
├── news/index.astro
└── contact/index.astro
```

参考実装: [`src/pages/sites/corporate/base-20260903-1400/`](./src/pages/sites/corporate/base-20260903-1400/)

## ドキュメント

| ファイル | 内容 |
|---|---|
| [docs/migration-from-lp-designer.md](./docs/migration-from-lp-designer.md) | 移行整理（何を移植し、何を作り直したか） |
| [docs/information-architecture.md](./docs/information-architecture.md) | IA定義。website 固有の中核 |
| [docs/self-improvement-loop.md](./docs/self-improvement-loop.md) | 二系統の改善ループ |
| [docs/learning-pipeline.md](./docs/learning-pipeline.md) | 参照学習の作業ロジック |
| [AGENTS.md](./AGENTS.md) / [CLAUDE.md](./CLAUDE.md) | AI agent 向け指示 |
| `.claude/skills/frontend-design-web/SKILL.md` | デザインスキル + 品質ルール実装の鉄則 |

## 環境変数

`.env.example` をコピーして `.env` を作る。ホスト名・パスをソースに直書きしないこと。
実装は `scripts/env_config.py`。

## ライセンス

社内利用。

# 自己改善ループ設計

## 目的

website（多ページサイト）の情報設計と意匠の品質を、**機械計測**と**参照学習（vision）**の
二系統で単調改善する。lp-designer の二系統構成を踏襲するが、測る対象が違う
（[migration-from-lp-designer.md](./migration-from-lp-designer.md) 参照）。

## ループ A — 静的品質

```
npm run check:web
  └─ astro build → scripts/web-quality-check.mjs
       ├─ PAGE_RULES … dist/**/*.html を1ページずつ採点
       ├─ SITE_RULES … /sites/{type}/{model}-{stamp}/ をサイト単位で横断採点
       │   ※ Arch のみ dist ではなく src/pages/**/*.astro を参照（import が dist で消えるため）
       ├─ docs/quality/latest.md
       └─ docs/quality/history.json
```

- 減点: high=10 / medium=5 / low=2（ページ100点満点）
- SITE_RULES の指摘はそのサイトのトップページに計上する
- 後退ガード: `npm run check:web:strict`（総合が前回を下回ったら exit 1）

### 1イテレーション

1. 計測 `npm run check:web`
2. high → medium の順に修正。**修正はまず共通シェル（SiteLayout / SiteHeader / SiteFooter）側で試す**
   — 1箇所直せば全ページに効くのが website の利点
3. 新しい壊れ方を見つけたら `PAGE_RULES` / `SITE_RULES` に追加する
4. `npm run check:web:strict`
5. history をコミット

### SITE_RULES が中核である理由

website の品質は 1 ページを見ても決まらない。実際に起きる壊れ方は次の形をとる。

| 壊れ方 | 検出ルール |
|---|---|
| 下層ページを追加したときナビの項目を足し忘れる | `consist-nav-drift` |
| ページを増やしたが title を使い回して重複する | `consist-duplicate-title` |
| フッターに載せ忘れてどこからも辿れないページができる | `ia-orphan-page` |
| トップだけ作り込み、下層がナビとフッターだけの空ページになる | `content-thin-page` |
| リンク先のパスを打ち間違える | `base-broken-internal-link` |
| サイト種別として当然あるべきページが無い | `ia-required-page-missing` |

いずれも「1ページを丁寧に見る」では見つからず、**サイト全体を突き合わせて初めて出る**。
逆に言えば、これらを機械が見てくれるからこそ人間はデザインに集中できる。

### 共通シェルによる予防

ルールで検出するより、そもそも壊れない構造にするほうが強い。
`_site.ts` を単一の情報源にし、`SiteLayout` が以下を自動化している。

- グローバルナビ・フッターサイトマップの描画（→ `consist-nav-drift` が原理的に起きない）
- 現在地の `aria-current="page"` 付与（→ `nav-no-current`）
- 下層ページのパンくず自動補完（→ `ia-breadcrumb-missing`）
- `Organization` / `WebSite` / `BreadcrumbList` の JSON-LD 自動生成
- `<title>` の `{ページ名}｜{サイト名}` 組み立て（→ `consist-duplicate-title`）
- スキップリンク（→ `a11y-skip-link`）

`arch-site-config-missing` は「この構造から外れて手書きしていないか」を見る番人である。

## ループ B — 参照学習 + 2案検証

詳細正本: [learning-pipeline.md](./learning-pipeline.md)

```
参照サイト選定（site_archive）
  → Look: トップ+下層2ページをキャプチャし、IAとトーンを言語化
  → Direction: サイトマップ・各ページ構成・トーン・コンポーネント選定を direction.html に確定
  → Fix×2: 堅実案(a) / 冒険案(b) を実装
  → Measure: web-design-score（独立judge・複数ページ）+ check:web
  → Extract: 両案から再利用ブロックを src/components/ へ
```

### いつ回すか

- 新しいサイト種別のサンプルを作るとき（必須）
- 既存サンプルが「AIっぽい」と指摘されたとき
- 週次で参照サイトを1件追加学習するとき（推奨）

### 停止条件（完成定義）

- `check:web` で high ゼロ
- `arch-component-reuse` がゼロ（＝新規/改良コンポーネント ≥1件を本線へ還元済み）
- `ia-required-page-missing` がゼロ
- design-score で学習版がベースラインを上回り、かつ 80点超
- 人間レビューで参照サイトの咀嚼が目視OK

## 実行体

| 段 | 実行 |
|---|---|
| 収集 | `python3 site_archive/fetch_site_archive.py --pages 3` |
| ラン作成 | `python3 scripts/web-learning-next.py` |
| Look / Direction / Fix | 現状は手動（Claude Code）。安定後に多モデル化を検討 |
| Measure | `npm run check:web` + `bash scripts/web-design-score.sh ...` |
| Preview | `npm run preview`（`astro.config.mjs` で `allowedHosts: true`） |

## 実績

| 日付 | ループ | 結果 |
|---|---|---|
| 2026-09-03 | 初期セットアップ | 基盤移植 + website ルール32件を定義（PAGE 19 + SITE 13）。ベースライン `corporate/base-20260903-1400`（6ページ）で 総合100点 |

## 関連ドキュメント

- [migration-from-lp-designer.md](./migration-from-lp-designer.md) — 移行整理の正本
- [learning-pipeline.md](./learning-pipeline.md) — 参照学習の作業ロジック
- [information-architecture.md](./information-architecture.md) — サイト種別ごとのIA定義
- `.claude/skills/frontend-design-web.md` — アンチパターン・実装規約

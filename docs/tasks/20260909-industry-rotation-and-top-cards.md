# 作業指示: corporate 業種ローテ / トップのカテゴリカード / サムネイル撮影

宛先: OpenCode ペイン
作成: Claude Code ペイン（2026-09-09）
対象リポジトリ: `/Users/estaff-agent/Workspace/website-designer`（branch: main）

---

## 前提（壊してはいけないもの）

本番は **稼働中**。`https://website.e-function.site/`

- デプロイは `bash scripts/release-deploy.sh`。**品質ゲートを内蔵**しており、
  静的チェックに high があると中止、描画検証に high があっても中止する。
- α版まで **noindex**。`src/lib/seo.ts` の `NOINDEX = true` と
  `public/robots.txt` の `Disallow: /` を**外さないこと**。
- 完了条件は次の3つが通ること。
  ```
  npm run check:web       # 静的37ルール。high ゼロ必須
  npm run check:render    # 描画検証。high ゼロ必須
  npm run check:catalog   # コンポーネントカタログの掲載漏れ検査
  ```
- 実装規約は `CLAUDE.md` と `.claude/skills/frontend-design-web/SKILL.md`。
  特に「品質ルールを実装/拡張するときの鉄則10箇条」は必読。
  **鉄則1（クラス/属性検査は順序・追加に依存しない）は直近で実際に踏んだ**ので注意。

---

## タスク1: corporate 内の業種ローテーション

### 現状

`scripts/web-learning-next.py` は**サイト種別だけ**で次のランを選ぶ。
`rotation: True` は `corporate` のみなので毎回 corporate 一択で、
参照サイトは種別プールから `random.choice` している。
その結果、**同じ業種が連続で当たりうる**。

### やること

サイト種別を選んだあと、**その種別の中で業種を選ぶ**従軸を足す。
選び方はサイト種別と同じ式でよい（不足度 = 目標構成比 − 自前の構成比）。

対象は corporate で参照が十分ある次の6業種。ID は
`scripts/site_categories.py` の `INDUSTRIES` に定義済み。

| industry id | ラベル | corporate 内の参照数 |
|---|---|---|
| `ad` | 制作・開発・企画・マーケティング・コンサル | 39 |
| `building` | 建築・建設・不動産・住宅 | 19 |
| `company` | 暮らし・インフラ・工業・メーカー | 16 |
| `art` | デザイン・アート | 16 |
| `technology` | Web・IT・AI・SaaS・テクノロジー | 9 |
| `hospital` | 医療・病院 | 6 |

要件:

1. **閾値で足切りする。** 参照が一定数（3件を提案）未満の業種は対象外。
   corporate は22業種に散っているが、7業種は1件しかない。
   閾値はハードコードせず定数にする。
2. **直近と同じ業種を避ける。** サイト種別の `RECENT_EXCLUDE` と同じ考え方。
   ただし対象業種が少ないので、除外幅は種別より小さくすること（1〜2）。
3. **自前の保有数は実ディレクトリから数える。**
   サイト種別は `src/pages/sites/{type}/` のディレクトリ数を見ている。
   業種は現状どこにも記録されていないので、**タスク1-b で記録する**。
4. `job.json` に `industry` / `industry_label` / `selection.industry_weights` を出す。
5. 参照サイトの選定は「サイト種別 AND 業種」で絞る。
   既存の適格性検査（`scripts/web_qualify_reference.py`、内部3ページ未満を却下）は
   そのまま通すこと。絞った結果 候補が枯れたら業種条件を落として種別だけで選び、
   その旨を `job.json` に残す。

### タスク1-b: 業種をサンプルに記録する

`src/lib/site.ts` の `SiteConfig` に業種を持たせる。

```ts
/** 参照サイトの業種（scripts/site_categories.py の INDUSTRIES の id）。
 *  ローテの従軸と、トップのカード表示で使う。 */
industry?: string;
```

- 既存3サイトにも後から付ける。妥当な値は次のとおり（参照サイトの業種に合わせる）。
  - `base-20260903-1400`（ミナモト精機・精密切削加工）→ `company`
  - `a-20260903-1448` / `b-20260903-1448`（北嶺ニュートリション・スポーツ栄養製造）→ `company`
- 実装エージェント向けのプロンプト（`scripts/web-implement-minimax.sh`）にも
  「`_site.ts` に `industry` を書く」を追記する。
- **`arch-site-config-missing` に industry 必須を足すかは任意。** 足すなら
  severity は medium 以下にすること（既存サンプルを high で落とさない）。

---

## タスク2: トップページをカテゴリ別カード表示にする

### 現状

`src/pages/index.astro` は `_site.ts` を `import.meta.glob` で集め、
サイト種別ごとに**テキストだけのリスト**を出している。

### 参考にするもの

`../lp-designer` の2ファイル。**そのまま移植せず、website 向けに読み替えること。**

| 参考 | 内容 |
|---|---|
| `../lp-designer/src/pages/index.astro` | トップのカテゴリカード。件数を `samples-index.json` から出している |
| `../lp-designer/src/pages/samples/[category]/index.astro` | カテゴリ内のカード一覧。`/thumbs/{cat}/{model}-{stamp}.jpg` をサムネに使う |

lp-designer との違い（重要）:

- website-designer に `samples-index.json` は**無い**。
  `import.meta.glob('./sites/*/*/_site.ts')` で集めるのが現行方式なので、
  そちらを使うこと。JSON レジストリを新設する必要はない。
- 1サンプルが**複数ページ**なので、カードには**ページ数**も出すと情報量が上がる。
- サイト種別のラベル/説明は `docs/site-types.json`（`scripts/web-export-site-types.py`
  が生成、正本は `scripts/site_categories.py`）から取れる。**ハードコードしない。**

### やること

1. **トップ** `/`
   - サイト種別ごとのカード。1枚に「ラベル / 説明 / 保有サンプル数 / 代表サムネイル」。
   - サンプルが 0 件の種別は出さないか、明確に「準備中」と分かる表現にする
     （`content-placeholder-text` ルールに引っかかる文言は使わないこと。
     「準備中」「coming soon」等は **high で検出される**）。
   - カードから `/sites/{type}/` へ。
2. **サイト種別ページ** `/sites/{type}/` を新設
   - `src/pages/sites/[type]/index.astro`。`getStaticPaths` で種別を列挙。
   - 各サンプルをカード表示（サムネイル / サイト名 / model-stamp / ページ数 /
     テーマ名 / 業種ラベル）。新しい順（stamp 降順）。
   - パンくずを置く（`ia-breadcrumb-missing` は `/sites/**` のサンプル配下にのみ
     効くが、リポジトリ自身のページでも回遊のために置く）。
   - 業種でグルーピングまたは絞り込みができると、タスク1の従軸が可視化されて良い。
3. 既存の索引としての機能（コンポーネントカタログへの導線）は残すこと。

### 注意

- リポジトリ自身のページは `BaseLayout` を使う（`SiteLayout` はサンプル用で
  `SiteConfig` を要求する）。
- `/sites/[type]/index.astro` を足すと `/sites/corporate/` が生える。
  既存の `/sites/corporate/{model}-{stamp}/` と衝突しないことを確認すること。
- 画像には `width` / `height` と `loading="lazy"` を付ける
  （`perf-img-dimensions` / `perf-img-lazy`）。`alt` 必須（`a11y-img-alt` は high）。

---

## タスク3: サムネイル撮影

### 参考

`../lp-designer/scripts/lp-build-thumbnails.mjs` を website 向けに移植する。

要点（lp-designer のコメントに書かれている実績ベースの知見）:

- dist を静的サーブしてヘッドレス Chromium で撮る。**FVのみ**（`fullPage: false`）。
  カードではページ全体の縦長画像より FV のほうが判別しやすい。
- 出力は `public/thumbs/{type}/{model}-{stamp}.jpg`。
- `--sync-dist` で `dist/thumbs/` にも配る。これが無いと、生成しても本番に載るのが
  次のビルド以降になる。
- **`npm run build` の postbuild で毎回走らせる。** 手順書のステップにしただけだと
  飛ばされ、lp-designer では壊れた画像のカードが2度出荷された（42件と2件）。
  未生成が無ければ Chromium を起動せず即終了するので常時実行しても安い。
- `--check` で不足検査（不足なら exit 1）。`--force` で撮り直し。

### website 向けに変えるところ

- 走査対象は `src/pages/sites/{type}/{model}-{stamp}/` のディレクトリ。
  撮るルートは各サンプルの**トップ** `/sites/{type}/{model}-{stamp}/`。
- 既に `scripts/web-shoot-sample.mjs`（1ルート撮影）と
  `scripts/web-render-check.mjs`（dist 静的サーブ）がある。
  **サーバ起動部分は重複するので、どちらかに寄せられないか検討すること。**
  無理に共通化しなくてよいが、3本目のサーバ実装を増やすのは避けたい。
- `package.json` に `check:thumbs` を足し、`release-deploy.sh` の品質ゲートに
  組み込むかは任意（組み込むなら `--check`）。

### 撮影対象の注意

サンプルサイトには **View Transitions / ScrollReveal** が入っている。
`ScrollReveal` は初期状態で内側要素の `opacity: 0` なので、
**撮影前にスクロールしないと空白のサムネイルになる**。
`web-render-check.mjs` が実ホイールでスクロールしているので、その方法を踏襲すること
（`window.scrollTo` は Lenis 等の仮想スクロールで効かない、という別件の知見もある）。
FV だけ撮るなら、いったん最下部までスクロールしてから先頭へ戻すのが安全。

---

## 進め方の提案

1. タスク3（サムネイル）→ タスク2（カード表示）の順が依存的に楽。
   カードにサムネイルが必要なので。
2. タスク1は独立しているので先でも後でもよい。
3. 各タスクごとにコミットを分けること。コミットメッセージは日本語で、
   **なぜそうしたか**を書く（このリポジトリの既存コミットの粒度に合わせる）。
4. 完了したら3つのチェックを通し、`bash scripts/release-deploy.sh` で本番反映まで。
   デプロイは webhook 経由で自動、`version.json` の `deploy_id` 一致まで待つ。

## 分からないことがあれば

Claude Code ペイン（`term_6c54b7eb-ea81-40c9-9c30-77116b10c6ee`）に
`orca terminal send` で聞いてください。設計判断の経緯はそちらが持っています。

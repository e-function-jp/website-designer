# モーション設計

muuuuu.org 等に掲載される国内の website は、**スクロール連動の演出が品質の一部**になっている。
静止画のスクリーンショットだけを見て採点すると、この層がまるごと評価から抜け落ちる。
本ドキュメントは、参照サイトのモーションを実測し、ディレクションで指示し、実装で受け、
機械で検査する——という一連の経路を定義する。

## 1. 測る — `scripts/web-analyze-reference-motion.mjs`

Playwright で参照サイトを実際に開き、**スクロールしてトリガーを踏んでから**計測する。
静止した `document.getAnimations()` だけではリビール演出は取れない（発火前は存在しないため）。

```bash
node scripts/web-analyze-reference-motion.mjs \
  --url=https://example.co.jp/ \
  --out=docs/quality/runs/corporate-20260903-1400 \
  --follow-nav=2
```

出力: `{run_dir}/motion/{page}.json` と `{run_dir}/motion/summary.json`

計測項目:

| 項目 | 何を見るか |
|---|---|
| `reveals` | スクロール前後の DOM 差分（opacity / transform / clip-path / filter / class 追加） |
| `revealSummary.kinds` | fade / fade-up / fade-side / zoom / clip-wipe / blur に分類した件数 |
| `revealSummary.durationMs` | transition-duration の min / median / max |
| `revealSummary.easings` | 使われている easing（cubic-bezier をそのまま取る） |
| `header` | スクロール時にヘッダーが縮む / 隠れる / 背景が付く / class が変わるか |
| `libs` | GSAP / Lenis / AOS / Swiper / barba / swup / View Transitions 等 |
| `cross_page` | **ページ間のリビール数の開き**。トップだけ演出過多を数値で検出 |
| `reduced_motion` | `prefers-reduced-motion: reduce` で描画し直し、演出が減るかを実測 |

### 実測例（aito.co.jp、2026-09-03）

```
top      reveal 83件 (blur) / 14.6画面分 / keyframes 18
about    reveal 13件 (blur) /  7.2画面分
service  reveal 26件 (blur) /  7.5画面分
ページ間のリビール数の開き: 70  → トップだけ演出過多
reduced-motion 尊重: なし (83 → 83)
ヘッダー: position:fixed / 93px 固定 / スクロールで `:not-top` class が付く
easing: cubic-bezier(0.165, 0.84, 0.44, 1)（easeOutQuart）/ duration 800–1000ms
```

この1回の実測から、**「opacity + blur のリビュール、900ms、easeOutQuart、class トグルで発火、
ヘッダーは高さ固定で状態クラスのみ変える」** という具体的な指示が取り出せる。
「なんとなくフワッと出す」ではディレクションにならない。

## 2. 指示する — direction の `data-role="animation"`

ディレクション（`{run_dir}/direction-{a,b}.html`）は、セクションごとに
アニメーション指示を `data-role="animation"` を付けた要素で書く。
指示が無いセクションは `none` と明記する（空欄と区別するため）。

```html
<section data-section="hero">
  <h3>ファーストビュー</h3>
  <p data-role="animation">見出しを clip-up 700ms、本文とCTAを stagger 90ms で追従</p>
</section>
<section data-section="company-profile">
  <h3>会社概要テーブル</h3>
  <p data-role="animation">none</p>
</section>
```

`arch-animation-missing` ルールが、この指示件数と実装を突き合わせる。
指示があるのにアニメーションコンポーネントも自前 CSS も無い場合、および
**import しただけで一度も使っていない**場合を検出する（後者は lp-designer で実際に起きた）。

## 3. 受ける — 実装側の語彙

サイト全体の方針は `_site.ts` の `motion` に 1 箇所で持つ。
ページごとに決めさせると必ずズレる（`motion-consistency-drift`）。

```ts
motion: {
  reveal: 'blur',        // 既定のリビール種別（実測の dominant_reveal を写す）
  durationMs: 900,       // 実測の median を写す
  staggerMs: 90,         // 並んだ要素をずらす間隔
  header: 'solid',       // 'none' | 'solid' | 'shrink' | 'hide'
  pageTransition: true,  // View Transitions を使うか
}
```

### コンポーネント

| コンポーネント | 役割 | 対応する実測項目 |
|---|---|---|
| `ui/ScrollReveal.astro` | スクロールリビール。`fade` / `fade-up` / `fade-down` / `fade-left` / `fade-right` / `zoom` / `blur` / `clip-up`、`stagger` 対応 | `revealSummary.kinds` |
| `animations/RevealOnScroll.astro` | 同上の別実装（GSAP 併用時） | — |
| `components/site/SiteHeader.astro` | `motion.header` でスクロール挙動を切替 | `header` |
| `animations/PageTransition.astro` | View Transitions によるページ遷移演出 | `page_transition` |
| `animations/Marquee.astro` | 横流れ | `libs.swiper` 等 |
| `ui/AnimatedCounter.astro` | 数値カウントアップ | — |

いずれも `prefers-reduced-motion: reduce` を尊重する。

### ページ遷移は website 固有の層

LP には存在しなかった。参照サイトでは barba.js / swup / View Transitions のいずれか、
あるいはローディング画面で実装されている。本プロジェクトは外部ライブラリを足さず
**Astro 標準の View Transitions** に寄せる（`site.motion.pageTransition: true`）。

## 4. 検査する — 品質ルール

| ルール | 層 | severity | 検出内容 |
|---|---|---|---|
| `arch-animation-missing` | page | medium | direction の animation 指示が実装されていない / import だけして使っていない |
| `motion-consistency-drift` | site | medium | 演出のあるページと演出ゼロのページが混在（トップだけ盛る崩れ方） |
| `a11y-reduced-motion` | page | medium | ページ内 `<style>` でアニメーションを定義しているのに reduced-motion の打ち消しが無い |
| `arch-global-style-collision` | page | medium | `is:global` で DaisyUI 共通クラスを上書き（複数サイトを1ビルドに載せるため衝突する） |

## 5. 原則

- **参照サイトの数値を写す。** 「フワッと」「上品に」はディレクションではない。
  種別・ms・easing を実測から取って書く
- **トップだけ盛らない。** 参照サイト自身がこの崩れ方をしていることが多いので、
  参照を真似るときに一緒に持ち込まないよう注意する（`motion-consistency-drift`）
- **遷移のたびに邪魔にならない量に抑える。** LP は 1 回きりだが website は
  ページを移動するたびに再生される。LP と同じ量は過剰になる
- **`prefers-reduced-motion` を必ず尊重する。** 参照サイトが対応していなくても真似しない
- **重い演出で LCP / CLS を悪化させない。** `will-change` は発火後に外す

## 関連

- [learning-pipeline.md](./learning-pipeline.md) — Look / Direction 段での位置づけ
- [information-architecture.md](./information-architecture.md) — 情報設計側の基準

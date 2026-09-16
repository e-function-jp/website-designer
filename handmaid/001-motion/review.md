# 001-motion レビュー記録

## Round 1 — 対象コミット `8eacf37`

確認環境: `node scripts/handmaid-preview.mjs` + playwright（1440×900 / 390×844、各セクションへスクロールして撮影）。
コンソールエラー 0・横スクロールなし・アンカー切れなし は OK。以下を修正すること（優先度順）。

### P0 — 世界観が壊れている

1. **ヒーローの流体が真っ黒で見えない（Phase 1 から劣化）。**
   原因: `.hero { background: var(--hero-base); }`（86行目付近）。キャンバスを `position:fixed` にして body 直下へ移したため、
   後から描画される `position:relative` のヒーローの不透明背景がキャンバスを覆っている。
   → `.hero` の background を削除（`transparent`）。**ヒーローのファーストビューが Phase 1（`d6a33da`）と同じ鮮やかさに戻ること**を
   同条件のスクショで比較して確認する。

2. **深いセクションで、流体が「白く飛んだ1個の塊」になり本文に重なって読めない**（S1 マニフェスト、S8 #join、SP の S2 カード上）。
   原因: `orbitSpeed` を落とすと自動カーソルがほぼ同じ位置に毎フレーム splat し続け、染料が1点に溜まって白飛びする。
   → `driveVirtualPointer()` の色倍率を **移動速度で正規化** する:
   `const k = 3.2 * mood.intensity * Math.min(1, mood.orbitSpeed / 0.026);`
   さらに `deep` / `dive` では **3フレームに1回だけ splat** する（`frameCount % (mood.orbitSpeed < 0.012 ? 3 : 1)`）。
   目標: 深いセクションでは「暗い水中に、淡い青の筋がゆっくり漂う」見え方。白い塊が出ないこと。

3. **テキストの背後に局所スクリムがない。** S1 のステージと S8 #join の中央カラムに、ヒーローと同じ考え方の放射状スクリムを敷く:
   `background: radial-gradient(70% 60% at 50% 50%, rgba(4,5,12,0.62) 0%, rgba(4,5,12,0.35) 55%, transparent 100%);`
   （`::before` で `inset:-10% -15%`、`pointer-events:none`、`z-index:-1`）。#join ではバースト直後でも見出し・サブ・フォームが読めること。

### P1 — 明確なバグ

4. **料金の月額・年額が両方同時に表示されている**（`¥0¥0` / `¥980/月 ¥9,800/`）。
   `.plan__price-inner` を `display:inline-grid; overflow:hidden; height:1lh` にし、`[data-monthly]` `[data-yearly]` を同じセルに重ねて
   選択されていない方を `translateY(±100%)` + `opacity:0` に（切替 300ms `--ease-entrance`）。単位 `/月` `/年` も期間に合わせて切り替える。
   Free の単位は `永久無料` ではなく `/月` 表示でよい（`¥0` 1個だけ）。

5. **料金トグルの「年額」ラベルが白ピルの下に隠れている。** ピルは選択中ボタンの背面（`z-index:0`）、ボタン文字は `z-index:1`。
   ピルの幅・位置は選択中ボタンの `offsetLeft/offsetWidth` から算出。選択中の文字色は `--action-inverse-fg`、非選択は `--body-muted`。

6. **S2 #how（デスクトップ）: sticky の巨大数字とカードが固定ヘッダーの下に潜って切れる。**
   `.how__sticky { top: 0 }` → `top: calc(50svh - 8rem)` 程度にして数字を画面の縦中央に置く。
   見出し「3つのステップで、フローへ。」が sticky 区間の前にきちんと見えるようにする。カードの `scroll-margin` もヘッダー高さ分確保。

7. **S2 #how（<1024px）: sticky を外したのに `min-height:300vh` が残り、1画面以上の空白がある。**
   → `@media (max-width:1023.98px) { .how { min-height:auto } }`。同様に S1 の `220vh` は SP でもスクロール点灯に必要なので残してよいが、
   点灯は **進捗 0.75 で全文字点灯完了** するように係数を調整（今は 0.85 でも末尾が暗い）。

8. **S4 #product（390px）: 浮遊チップ2つがタイマー文字に重なる。** <640px ではチップをモックの下に通常フローで横並び表示（浮遊アニメは維持）。

### P2 — 仕上げ

9. **S1 の禁則: 行末に「「」が残る／「で|はない」のように不自然に分断される。**
   文章は3文をそれぞれ `<span class="line">` ブロックにし、1文の中でも読点で `<wbr>` を入れる。`line-break: strict;` を指定。
   1文字ずつの span 化で禁則が効かなくなっている場合は、文字 span を **文節単位の `inline-block` ラッパー** で包む（ラッパーの中では改行させない）。
10. カウンター `10000+` → `10,000+`（`toLocaleString('ja-JP')`）。
11. セクションラベルの番号をそろえる: `— IMPACT` → `05 — VOICES`、`— FAQ` → `07 — FAQ`、PRICING を `06`、#join を `08 — SURFACE`（深度ラベルは現状のまま）。
12. S3「通知の潮止め」のUI断片が3本の棒にしか見えない。**ラベル付きトグル3行**（`Slack` `メール` `カレンダー`、右に ON/OFF スイッチ。
    in-view で上から 200ms stagger で OFF に切り替わる）にする。

### 確認方法
修正後、上記すべてを 1440×900 と 390×844 のスクショで自己確認してから
`fix(handmaid): 001-motion レビュー Round 1 の指摘を修正` でコミット（`handmaid/001-motion/index.html` のみ）。

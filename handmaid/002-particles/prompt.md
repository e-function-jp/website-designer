# 単一 HTML で作る没入型ブランドLP: KIRI（霧）— 架空のフレグランスブランド

あなたは熟練のクリエイティブ系フロントエンド開発者である。以下の仕様を **そのまま** 満たす
**自己完結型の単一 `index.html`** を生成しなさい。ビルドなし・フレームワークなし・バンドラーなし。
外部依存は **Google Fonts（`<link>`）/ three.js（importmap の CDN ES モジュール）/ Lenis（importmap）** のみ。
仕様中の数値はすべて定数としてハードコードする。画像・動画・3Dモデルファイルは使わない（形状はすべて JS で手続き生成）。

> シリーズ位置づけ: `001-motion` は 2D の GPU 流体。`002` は **3D の GPU パーティクルが
> スクロールで形を変える（モーフィング）** 表現を扱う。技法を 001 と被らせないこと。

## 概要

京都の架空のフレグランスアトリエ **KIRI（霧）** のブランドLP（日本語）。
画面全体に **約24,000粒の光の粒子**（three.js `THREE.Points` + 自前 ShaderMaterial）が浮かび、
スクロールに合わせて **霧 → 香水瓶 → 月 → 波** と形を変えていく。粒子は漂い続け、ポインターの近くでは
そっと押しのけられる。背景は墨のような暖かい黒、文字は和紙のような生成り色。
明朝体の大きな縦書きの見出しと、細い欧文イタリックの組み合わせで、静かで高級な雰囲気にする。

コンセプト: **「香りは、記憶にかかる霧。」** — 粒子が集まって形になり、また霧へほどける、を繰り返すことで
「香りが立ち上り、消えていく」体験をスクロールで味わわせる。

## ページシェルとライブラリ

- **フォント:**
  `<link href="https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;600&family=Cormorant+Garamond:ital,wght@0,400;1,300;1,400&family=Zen+Kaku+Gothic+New:wght@400;500&display=swap" rel="stylesheet">`
  - 見出し（和文）: `"Shippori Mincho", serif` 400/600
  - 欧文アクセント（英字ラベル・価格・番号）: `"Cormorant Garamond", serif` の italic 300/400
  - 本文: `"Zen Kaku Gothic New", sans-serif` 400、`line-height:2; letter-spacing:0.06em; font-feature-settings:"palt" 1;`
- **importmap:**
  ```html
  <script type="importmap">{ "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
    "lenis": "https://unpkg.com/lenis@1.3.19/dist/lenis.mjs"
  } }</script>
  ```
- **Lenis:** `new Lenis({ lerp: 0.075, smoothWheel: true })`。rAF は three.js の描画ループと**1本に統合**する（2本回さない）。
- **ルート font-size:** 001 と同じ適応 rem グリッド（1920/1440/1024/640 のブレークポイントで vw 化、640 以下は 360 基準）。
- **CSS リセット:** `*{margin:0;box-sizing:border-box}`、`body{background:var(--ink);color:var(--paper);overflow-x:hidden}`。

### CSS カスタムプロパティ（この値のみ使用）

```css
:root {
  --ink:          #0b0a09;   /* 背景（WebGL clearColor も同値） */
  --ink-2:        #15130f;   /* ガラス面の下地 */
  --paper:        #f3eee6;   /* 主テキスト・粒子の基本色 */
  --paper-muted:  #a8a196;   /* 本文・補足 */
  --line:         rgba(243,238,230,0.14);
  --glass:        rgba(21,19,15,0.42);
  --shu:          #c8553d;   /* 朱。ページ全体で3箇所まで（ロゴ印・CTA下線・カートのバッジ） */
  --ease-silk:    cubic-bezier(0.22, 1, 0.36, 1);
  --ease-entrance:cubic-bezier(0.2, 0, 0, 1);
}
```

## レイアウト（上から順に）

共通: WebGL キャンバスは `position:fixed; inset:0; z-index:0; pointer-events:none`。その上に
`<main style="position:relative;z-index:10">`。キャンバス上に常時 **ビネット**
`radial-gradient(120% 90% at 50% 50%, transparent 40%, rgba(11,10,9,0.75) 100%)` を fixed で重ねる（z-1）。

### 0. ローダー（初回のみ, z-50）
- 全画面 `--ink`。中央に `霧` 一文字（Shippori Mincho 600, 4rem）と、その下に Cormorant italic で `0` → `100` のカウンター。
- カウンターは実際のフォント読み込み（`document.fonts.ready`）と粒子ジオメトリ生成の完了を待ちつつ、
  最低 1400ms かけて easeOutCubic で 100 へ。
- 同時に粒子は **半径 30 の球殻上のランダム位置** から霧の形へ収束（`uIntro 0→1`, 2400ms, easeOutQuart）。
- 100 到達後、ローダーは `clip-path: inset(0 0 0 0) → inset(0 0 100% 0)` で 900ms `--ease-silk` に上へ捲れて消える。

### 1. ヘッダー（fixed, z-40）
- 左: ロゴ — `KIRI` （Cormorant 400, letter-spacing 0.3em）+ 右肩に 0.5rem 角の朱の四角い「印」。
- 右: `物語` `香り` `工房` `コレクション` `訪れる`（Zen Kaku 0.8rem, `--paper-muted`, hover で `--paper`, 下線が左から 400ms で伸びる）
  + `カート (0)` 。<1024px はハンバーガー（2本線 → × に 400ms モーフ）で全画面メニュー（リンクが 60ms stagger で下から出る）。

### 2. ヒーロー `#top`（`100svh`）— 粒子シェイプ: **霧 (mist)**
- 画面右寄りに **縦書き** の大見出し `香りは、<br>記憶にかかる霧。`
  （`writing-mode:vertical-rl; font-family:Shippori Mincho; font-size:clamp(2.2rem,4.6vw,4.6rem); line-height:1.7; letter-spacing:0.18em`）。
  <640px は横書きに切り替え、中央下寄せ。
- 左下に欧文 `Kyoto — Atelier of Scent, est. 2019`（Cormorant italic 1rem, `--paper-muted`）。
- 下中央: `Scroll` の小さい文字と、1px × 4rem の縦線の中を光点が 2000ms で下降するキュー。
- **リビール:** ローダー消失後、見出しを **1文字ずつ** `opacity 0→1` + `filter: blur(8px)→0` + `translateY(0.4em)→0`、
  stagger 70ms、各 1100ms `--ease-silk`。欧文とキューはその 600ms 後に 900ms フェード。

### 3. 物語 `#story`（通常フロー）— 粒子: 霧のまま、ただし全体が左へ寄る
- 2カラム（≥1024px 5/7）。左に小見出し `01 — Story`（Cormorant italic）。右に本文3段落（各 80〜120字、架空の工房の物語:
  鴨川の朝霧、祖母の桐箪笥、香りを「残す」ことへのこだわり）。
- 本文は **行単位のマスクリビール**: 各段落を行ごとに `overflow:hidden` の span で包み、内側を `translateY(105%)→0`、
  行 stagger 90ms、1000ms `--ease-silk`。行の分割は JS で行う（リサイズ時に再計算、`Intl.Segmenter('ja',{granularity:'grapheme'})` で文字単位に測る）。

### 4. 香り — スクロール固定チャプター `#scents`（高さ `400vh`, 内側 `position:sticky; top:0; height:100svh`）
このセクションが体験の中心。スクロール進捗 `p ∈ [0,1]` を `uProgress = 1 + p*3`（1→4）に写像して粒子をモーフする。
3つの香りそれぞれに1形状:

| 区間 | 形状 | 香り名 | 英名 | ノート | 粒子の色味（uTint） |
|---|---|---|---|---|---|
| p 0.00–0.33 | **香水瓶** (bottle) | 白檀の夕べ | Santal Dusk | 白檀・ほうじ茶・アンバー | `#f1d9b5` |
| p 0.33–0.66 | **月** (moon) | 月白 | Geppaku | 白木蓮・米粉・ムスク | `#e8ecf3` |
| p 0.66–1.00 | **波** (wave) | 潮騒 | Shiosai | 海塩・紫蘇・ベチバー | `#cfe3de` |

- 左側にテキストパネル（≥1024px 左 5/12、<1024px 画面下部のガラスシート）:
  番号 `02 / 03 / 04`（Cormorant italic 5rem, `--line` のアウトライン文字）、香り名（Shippori 2.6rem）、英名（Cormorant italic）、
  ノート3つ（細い横線で区切ったリスト）、`50ml ¥24,200`。
- 区間が切り替わるとテキストは **旧:上へ 0.6rem + blur 6px でフェードアウト 400ms → 新: 下から同様にフェードイン 700ms**。
- 右端に縦のプログレス（3つのドット、アクティブは朱ではなく `--paper` で塗り、ドット間の線が進捗で伸びる）。
- 形状は画面右寄り（world x = +1.4、<1024px は x = 0, y = +0.8）に置く。粒子全体をゆっくり Y 回転（0.06 rad/s）。

### 5. 工房 `#craft`（通常フロー）— 粒子: **霧** に戻る（uProgress 4→5 で波がほどけて霧へ）
- 見出し `一滴に、九十日。`（Shippori, 横書き）。
- 横スクロールする工程カード4枚（縦スクロールで横に流れる。セクション高さ `250vh`、sticky トラックを `translateX` で動かす。
  <1024px は通常の横スワイプ `overflow-x:auto; scroll-snap-type:x mandatory`）:
  `採る`（原料の選定）/ `寝かす`（桐樽で熟成）/ `合わせる`（調香）/ `詰める`（手作業の瓶詰め）。
  カードはガラス（`--glass` + `backdrop-filter:blur(18px)` + `1px solid var(--line)`、`border-radius:0.25rem` の直線的な形）。
  各カードに大きな番号（Cormorant italic）と 60〜80字の説明、線画SVGアイコン。

### 6. コレクション `#collection` — 粒子: 霧（密度を下げ、`uOpacity` 0.55 へ）
- 3製品カード（上の3つの香り）。カード上部はイラストの代わりに **CSS だけで描いた香水瓶**
  （角丸長方形の本体 + 細い首 + 四角いキャップ。内側に香りごとの色のグラデーション液面。hover で液面が 600ms かけて 6% 上がる）。
- 各カード: 名前 / 英名 / `50ml ¥24,200` `100ml ¥38,500` の容量セグメント切替 / `カートに入れる` ボタン。
- `カートに入れる` → ボタン内の文字が `✓ 追加しました` に縦スライドで入れ替わり、ヘッダーの `カート (n)` の数字が
  縦にめくれて +1、横に朱の小さなバッジが 600ms パルス。バックエンドなし。

### 7. 訪れる `#visit` — 粒子: 霧
- 左に架空住所（`京都市左京区 下鴨宮崎町 00-0`）、営業時間、`完全予約制・1枠2名まで`。
- 右に **SVG で描いた簡略地図**（鴨川を1本の曲線、糺の森を点描、アトリエ位置に朱の印）。線は in-view で `stroke-dashoffset` により 2000ms で描かれる。
- `調香体験を予約する` ボタン（テキストリンク型、下線が朱。hover で矢印が 0.3rem 右へ）。

### 8. 便り（ニュースレター）+ フッター
- `季節の便りを受け取る` + 下線だけのメール入力（focus で下線が `--paper` に左から伸びる）+ `登録` 。送信で文言を `ありがとうございます` に。
- フッター: ロゴ、リンク、`© 2026 KIRI Atelier` 、`※本ページは架空のブランドのデザインサンプルです。`

## 粒子システム（これが本体。数値は固定）

### 形状の生成（JS, 起動時に1回）
粒子数 `N = isMobile ? 12000 : 24000`（`isMobile = matchMedia('(max-width: 1023px)').matches || navigator.maxTouchPoints > 0`）。
各形状を `Float32Array(N*3)` で作り、`BufferGeometry` の attribute `aMist` `aBottle` `aMoon` `aWave` に入れる。
加えて `aRandom`（0–1 一様乱数, itemSize 1）と `aSeed`（vec3, 各成分 -1〜1）。

- **mist（霧）:** 楕円体内の一様分布。`x∈±3.2, y∈±1.6, z∈±1.8` の範囲で、中心密度を上げるため
  `r = pow(random, 0.6)` を方向ベクトルに掛ける。
- **bottle（香水瓶）:** 回転体（lathe）の**表面**からサンプル。高さ `y ∈ [-1.4, 1.4]`、半径プロファイル `R(y)`:
  - `y < -1.25`: 底面（半径 0〜0.95 の円盤上に面積一様）
  - `-1.25 ≤ y < 0.55`: 胴 `0.95`（角を丸めるため、両端 0.12 区間を `0.95 - 0.12 + sqrt(0.0144 - d²)` で丸める）
  - `0.55 ≤ y < 0.75`: 肩 `mix(0.95, 0.28, smoothstep(0.55,0.75,y))`
  - `0.75 ≤ y < 1.0`: 首 `0.28`
  - `1.0 ≤ y ≤ 1.4`: キャップ — 断面が四角形（一辺 0.9）の角柱表面
  サンプリングは `y` を弧長に比例させる（首に粒子が偏らないよう、各区間の表面積比で粒子数を配分）。粒子の 8% は瓶の内部に液面（y=0.2 の円盤）として置く。
- **moon（月）:** 半径 1.35 の **フィボナッチ球** 表面。`phi = acos(1 - 2*(i+0.5)/N)`, `theta = PI*(1+sqrt(5))*i`。
  クレーター感: 3D value noise で半径を `1.35 * (1 - 0.04*noise(p*2.2))`。粒子の 15% は外側 1.5〜2.2 の薄いハロー（ランダム方向）。
- **wave（波）:** `x ∈ [-3.4, 3.4]`, `z ∈ [-2.0, 2.0]` のグリッド状（`sqrt(N*1.7):sqrt(N/1.7)` の格子 + ±0.02 のジッター）、
  `y = 0.35*sin(x*1.6) + 0.22*sin(z*2.3 + x*0.7)`。形状全体を X 軸周りに -0.35 rad 傾ける。
  （頂点シェーダー側で時間によりうねらせる — 下記）

### ShaderMaterial

`transparent:true, depthWrite:false, blending:THREE.AdditiveBlending`。

uniforms: `uTime`, `uFrom`(int) / `uTo`(int) / `uT`(0–1, from→to の局所進捗 — 下記の写像で JS が算出),
`uIntro`(0→1), `uPixelRatio`(min(devicePixelRatio,1.75)), `uSize`(desktop 26.0 / mobile 20.0), `uMouse`(vec3 world), `uMouseStrength`(0→1 lerp),
`uTint`(vec3), `uOpacity`(1.0), `uOffset`(vec3: 形状の配置オフセット, JS で lerp)。

**形状インデックスの写像（JS）** — スクロールから `stage`（連続値）を作り、頂点シェーダーには
「from 形状 / to 形状 / 局所進捗 t」を渡す方式にする（4 attribute 同時 mix は禁止、分岐をシェーダーに持ち込まない）:
```js
// stage: 0 = mist (hero/story), 1 = bottle, 2 = moon, 3 = wave, 4 = mist (craft 以降)
// #scents の p を stage に： p<0.12 → 0→1 の遷移, 0.12–0.30 bottle 保持, 0.30–0.42 → 1→2, 0.42–0.63 moon 保持,
//   0.63–0.75 → 2→3, 0.75–1.0 wave 保持。#craft に入ると 3→4 を 1400ms の時間補間で行う。
// from/to の座標は CPU 側で attribute を差し替えない。4つの attribute を全部渡し、uniform uFrom/uTo (int) で選ぶ。
```
頂点シェーダー（骨子。GLSL ES 3.0 / `glslVersion: THREE.GLSL3` を使わず three 標準の GLSL1 互換で書いてよい）:
```glsl
attribute vec3 aMist; attribute vec3 aBottle; attribute vec3 aMoon; attribute vec3 aWave;
attribute float aRandom; attribute vec3 aSeed;
uniform float uTime, uT, uIntro, uPixelRatio, uSize, uMouseStrength, uOpacity;
uniform int uFrom, uTo; uniform vec3 uMouse, uOffset;
varying float vAlpha; varying float vTwinkle;

vec3 pick(int k){ return k==0 ? aMist : k==1 ? aBottle : k==2 ? aMoon : k==3 ? aWave : aMist; }

// 安価な擬似カール（3本の sin を位相ずらし）
vec3 drift(vec3 p, float t){
  return vec3(sin(p.y*1.7 + t*0.6 + aSeed.x*6.0),
              sin(p.z*1.3 + t*0.5 + aSeed.y*6.0),
              sin(p.x*1.5 + t*0.4 + aSeed.z*6.0));
}

void main(){
  // 粒子ごとに遅延をずらしたモーフ
  float t = clamp((uT - aRandom*0.35) / 0.65, 0.0, 1.0);
  t = t < 0.5 ? 4.0*t*t*t : 1.0 - pow(-2.0*t + 2.0, 3.0)/2.0;   // easeInOutCubic
  vec3 a = pick(uFrom), b = pick(uTo);
  vec3 pos = mix(a, b, t);
  // 遷移の途中ほど大きく散る（霧にほどけて再結晶する感じ）
  pos += aSeed * sin(t*3.14159) * 0.9;
  // 常時の漂い（霧は大きく、形状は小さく）
  float driftAmp = (uFrom==0 || uFrom==4) && (uTo==0 || uTo==4) ? 0.22 : 0.035;
  pos += drift(pos, uTime) * driftAmp;
  // 波は時間でうねる
  if (uTo==3) pos.y += 0.12*sin(pos.x*2.0 + uTime*0.9) * t;
  // イントロ: 球殻から収束
  pos = mix(normalize(aSeed + 1e-4)*30.0, pos, uIntro);
  pos += uOffset;
  // ポインター反発
  vec3 toM = pos - uMouse; float d = length(toM);
  pos += normalize(toM + 1e-4) * smoothstep(0.9, 0.0, d) * 0.35 * uMouseStrength;

  vec4 mv = modelViewMatrix * vec4(pos,1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * uPixelRatio * (0.55 + aRandom*0.9) / -mv.z;
  vTwinkle = 0.65 + 0.35*sin(uTime*(0.8+aRandom*2.2) + aRandom*50.0);
  vAlpha = uOpacity * smoothstep(12.0, 3.0, -mv.z);
}
```
フラグメントシェーダー:
```glsl
uniform vec3 uTint; varying float vAlpha; varying float vTwinkle;
void main(){
  vec2 c = gl_PointCoord - 0.5; float r = length(c);
  float core = smoothstep(0.5, 0.0, r); core *= core;           // 柔らかい円
  vec3 col = mix(vec3(0.953,0.933,0.902), uTint, 0.6);          // --paper と tint の混色
  gl_FragColor = vec4(col * vTwinkle, core * vAlpha * 0.55);
  if (gl_FragColor.a < 0.004) discard;
}
```
- `uTint` は区間切替時に 900ms で lerp（mist 時は `#f3eee6`）。
- **カメラ:** `PerspectiveCamera(35, aspect, 0.1, 100)`, position `(0, 0, 7.5)`。ポインター正規化座標で
  `camera.position.x += (mx*0.35 - camera.position.x)*0.04`, `y` も同様に `my*0.2`、毎フレーム `lookAt(0,0,0)`。
- **uMouse:** ポインターのレイと `z=0` 平面の交点。ポインターが 1.2 秒動かなければ `uMouseStrength` を 0 へ lerp（0.03/frame）、動いたら 1 へ（0.08/frame）。
- **uOffset:** hero `(1.1,0,0)` / story `(-1.2,0.1,0)` / scents `(1.4,0,0)`（<1024px `(0,0.8,0)`）/ craft 以降 `(0,0,0)`。lerp 0.05/frame。
- **Points 全体の回転:** `points.rotation.y += 0.001`（≒0.06 rad/s）、moon の間だけ `rotation.x` を 0.18 へ lerp。
- **レンダラー:** `antialias:false, alpha:false, powerPreference:'high-performance'`、`setPixelRatio(min(dpr, 1.75))`、clearColor `#0b0a09`。
- **パフォーマンス:** タブ非表示で描画停止。直近 60 フレームの平均が 22ms を超えたら `setPixelRatio(1)` に一度だけ落とす。
- **reduced-motion:** イントロ収束なし（uIntro=1 即時）、drift 振幅 0、ポインター反発なし、形状遷移は 400ms のクロスフェード（`uT` を即時に近く）。
- **WebGL 非対応時:** キャンバスを隠し、`body` に `radial-gradient(60% 50% at 70% 45%, rgba(243,238,230,0.08), transparent)` を敷くだけでページは成立させる。

## 固定パラメータ（まとめ）

- 粒子数 24,000 / 12,000、uSize 26 / 20、pixelRatio 上限 1.75、カメラ FOV 35 / z 7.5
- ローダー最短 1400ms、イントロ収束 2400ms easeOutQuart、ローダー退場 900ms
- 香りチャプター 400vh、テキスト入替 400ms out / 700ms in
- ヒーロー見出し 1文字 stagger 70ms / 1100ms / blur 8px
- 行マスクリビール stagger 90ms / 1000ms
- イージング: `--ease-silk` を基本、UI の小さな状態変化は `--ease-entrance`
- 朱 `#c8553d` はロゴ印・CTA 下線・カートバッジの3用途のみ

## 受け入れ条件

1. 1440×900 と 390×844 でロード〜末尾までエラー0、横スクロールなし。
2. `#scents` をゆっくりスクロールすると、瓶 → 月 → 波 が **粒子がほどけて再結晶する** 形で順に現れ、形がはっきり認識できる。
3. 粒子は常にわずかに動いている（完全停止した静止画に見えない）。ポインター付近が押しのけられる（デスクトップ）。
4. 390px で縦書き見出しが横書きに切り替わり、香りパネルが画面下のガラスシートとして形状と重ならない。
5. 60fps を目標に、MacBook 内蔵GPU相当で著しいカクつきがないこと（デグレード処理が働くこと）。
6. 単一 `index.html`、画像ファイルなし。

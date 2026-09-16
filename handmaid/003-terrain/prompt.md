# 単一 HTML で作る没入型LP: 天空舎（TENKUSHA）— 標高2,400mの架空の星見の宿

あなたは熟練のクリエイティブ系フロントエンド開発者である。以下の仕様を **そのまま** 満たす
**自己完結型の単一 `index.html`** を生成しなさい。ビルドなし・フレームワークなし・バンドラーなし。
外部依存は **Google Fonts（`<link>`）と Lenis（importmap の CDN ES モジュール）のみ**。three.js も使わず、
**生の WebGL2 + フルスクリーン・フラグメントシェーダー1枚** で背景を描く。画像・動画ファイルは使わない。

> シリーズ位置づけ: `001-motion` = 2D GPU 流体、`002-particles` = 3D パーティクルのモーフ。
> `003` は **レイマーチングで描いた夜の山岳地形を、スクロールでカメラが飛んでいく** 表現。
> ページ全体が「夕暮れに到着し、星空の夜を過ごし、夜明けに発つ」**一晩の時間経過** になっている。

## 概要

北アルプスの稜線にある架空の山岳ロッジ **天空舎** の宿泊予約LP（日本語）。
背景全面に、シェーダーで生成した **連なる山並み・谷・雲海・満天の星・天の川** が描かれ、
スクロールするとカメラが谷筋に沿って前へ進み、同時に **空の時刻が 夕暮れ → 深夜 → 夜明け** へと移ろう。
コンテンツは空に浮かぶ細いガラスのパネルと、大きな余白の中の静かなタイポグラフィ。
山小屋の窓明かりのような **暖色の小さな光** だけがアクセントカラー。

コンセプト: **「星に、いちばん近い宿。」**

## ページシェルとライブラリ

- **フォント:**
  `<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@300;500&family=Inter+Tight:wght@300;400;500&family=IBM+Plex+Mono:wght@400&display=swap" rel="stylesheet">`
  - 見出し: `"Noto Serif JP", serif` 300/500、`letter-spacing:0.12em; line-height:1.5`
  - UI・本文: `"Inter Tight", "Noto Serif JP", sans-serif` 300/400、本文 `line-height:1.95; letter-spacing:0.05em`
  - 計器風の数値（標高・時刻・気温・座標）: `"IBM Plex Mono", monospace` 400、`font-variant-numeric: tabular-nums`
- **importmap:** `{ "imports": { "lenis": "https://unpkg.com/lenis@1.3.19/dist/lenis.mjs" } }`
- **Lenis:** `new Lenis({ lerp: 0.08, smoothWheel: true })`。シェーダーの描画 rAF と **1本に統合**。
- **ルート font-size:** 001 と同じ適応 rem グリッド。
- **CSS リセット:** `*{margin:0;box-sizing:border-box}`、`body{background:var(--night);color:var(--frost);overflow-x:hidden}`。

### CSS カスタムプロパティ

```css
:root {
  --night:        #060912;   /* フォールバック背景 */
  --frost:        #e9eef5;   /* 主テキスト */
  --frost-muted:  #9aa6b8;   /* 本文・補足 */
  --line:         rgba(233,238,245,0.14);
  --glass:        rgba(8,12,24,0.38);
  --lamp:         #ffb36b;   /* 窓明かり。CTA・現在地マーカー・予約可バッジのみ */
  --lamp-glow:    rgba(255,179,107,0.35);
  --ease-entrance:cubic-bezier(0.2, 0, 0, 1);
  --ease-drift:   cubic-bezier(0.45, 0, 0.2, 1);
}
```

## 常設 UI（z-40）

- **ヘッダー:** 左にロゴ `天空舎`（Noto Serif JP 500, letter-spacing 0.3em）+ 下に小さく `TENKUSHA — 2,400m`（Plex Mono 0.65rem）。
  右に `夜を過ごす` `部屋` `食` `アクセス` と、`--lamp` 枠線のピル `空室を見る`（hover で `--lamp` 塗り、文字 `--night`、300ms）。
  <1024px はメニューボタン → 全画面の暗いガラス（`backdrop-filter:blur(24px)`）メニュー。
- **高度計 HUD（左下, ≥1024px）:** Plex Mono 0.7rem, `--frost-muted`。3行:
  `ALT 2,4xx m` / `TIME 17:42` / `TEMP 6.2°C`。値はスクロール進捗 `P (0–1, ページ全体)` から算出:
  - ALT: `2380 + round(sin(P*PI) * 64)`（中盤で稜線を越える）
  - TIME: 17:30 → 翌 05:10 を `P` で線形補間（分単位、24h を跨ぐ）。表示は1分刻みで、変化した桁だけ 200ms で縦にめくれる。
  - TEMP: `6.2 - sin(P*PI)*8.4`（小数1桁）
- **時刻ダイヤル（右端中央, ≥1024px）:** 高さ 42vh の弧（SVG, 半円の 1/3）。上端 `黄昏`、中央 `深夜`、下端 `夜明け` の小さなラベル。
  現在位置に `--lamp` の点（`box-shadow:0 0 10px var(--lamp-glow)`）。各セクションへのアンカーを兼ねる（ラベルクリックで `lenis.scrollTo`）。

## レイアウト（上から順に）

共通: `<canvas id="sky">` は `position:fixed; inset:0; z-index:0; width:100%; height:100%`。
その上に固定の **グレイン**（SVG `feTurbulence` を data URI にした 180px タイルを `opacity:0.06; mix-blend-mode:overlay`、
`steps(6)` で 0.6s ごとに位置をずらす）を z-1 で重ねる。`<main>` は z-10。
全セクション `min-height:100svh`、内側 `max-width:76rem; margin-inline:auto; padding-inline:1.25rem`（≥640px 2.5rem）。

### S0. 到着（ヒーロー） `#arrive` — 時刻: 黄昏
- 左下寄せ（≥1024px）/ 下寄せ中央（<640px）。
- Plex Mono のアイブロウ `36°20'N 137°38'E — ELEV. 2,400m`
- 見出し `星に、<br>いちばん近い宿。`（Noto Serif JP 300, `clamp(2.4rem, 6vw, 6rem)`）
- リード `車道の終点から、歩いて三時間。灯りの少ない稜線に、十二の部屋だけを用意しました。`
- ボタン 2つ: `空室を見る`（lamp ピル）/ `夜の過ごし方`（テキスト + 下向き矢印）。
- **リビール（ロード時）:** キャンバスは `opacity 0→1` 1800ms（シェーダー側で `uFade` 0→1 と同期）。
  1200ms 後、アイブロウが1文字ずつ（Plex Mono, 18ms stagger, typewriter 風に不透明度だけ）→
  見出しを **行単位で下からマスク**（`translateY(110%)→0`, 1200ms `--ease-entrance`, 行 stagger 140ms）→
  リード・ボタンが 800ms フェードアップ（120ms stagger）。

### S1. 雲海 `#clouds`（マニフェスト）— 時刻: 日没直後
- 画面中央に1文。スクロールに応じて **文字の letter-spacing が 0.6em → 0.12em に縮み、ブラーが 10px → 0 に** なる
  （セクション内進捗で補間。`position:sticky` のステージ, セクション高さ 200vh）:
  `雲より上では、<br>夜はこんなにも明るい。`
- 同時にシェーダーの `uCloud`（雲海の高さ・量）を 1.0 → 0.35 へ下げ、雲の下へ沈んでいた稜線が姿を現す演出にする。

### S2. 夜を過ごす `#night` — 時刻: 20:00〜23:00
- 見出し `夜のプログラム` + 3つのプログラムを **タイムライン** で縦に並べる（左に Plex Mono の時刻、細い縦線、右に内容）:
  - `19:30` **星の解説会** — 屋上デッキで、専属ガイドが季節の星座を案内します。
  - `21:00` **天の川の撮影会** — 三脚を貸し出し、長時間露光の撮り方を一緒に。
  - `23:30` **無灯の時間** — 館内の灯りをすべて落とし、ただ空を見上げる30分。
- タイムラインの縦線は in-view で上から描かれ（`scaleY 0→1`, 1400ms）、各項目はその線が到達した時点で
  左から 1.5rem スライド + フェード（900ms）。現在時刻（HUD の TIME）を過ぎた項目の点は `--lamp` で点灯する。
- `23:30 無灯の時間` の項目が画面中央に来た瞬間、ページ全体の UI（ヘッダー・HUD 含む）が 1200ms かけて
  `opacity:0.25` まで落ち、シェーダーの `uStarBoost` が 1.0 → 1.8 に上がり星と天の川が一段と明るくなる。離れると戻る。

### S3. 部屋 `#rooms` — 時刻: 深夜
- 見出し `十二の部屋、三つのかたち。`
- 3カードの **横並び → ホバーで幅が広がるアコーディオン**（≥1024px: flex で通常 `flex:1`、hover/focus したカードが `flex:2.4`、700ms `--ease-drift`。
  <1024px は縦積みで常に展開）:
  - **星窓の間** 2名 / 天井に天窓 / `¥48,000〜 / 1名（1泊2食）`
  - **稜線の間** 2〜3名 / 東向きの大窓 / `¥56,000〜`
  - **灯の離れ** 4名 / 薪ストーブ付き / `¥72,000〜`
- カードはガラス（`--glass` + `blur(20px)` + `1px solid var(--line)`, `border-radius:1rem`）。写真の代わりに
  **CSS/SVG による窓の図像**（天窓の四角、横長の窓、ストーブの炎の SVG パス）を上部に置き、
  窓の中に「その窓から見える空」を小さな CSS グラデーション + 数個の星（box-shadow の点）で表現。
  展開時だけ説明文（60〜90字）と設備リストが 200ms 遅れてフェードイン。

### S4. 食 `#food` — 時刻: 夜明け前
- 2カラム。左に見出し `山の夜食と、夜明けの粥。` と本文。右に **メニュー表**（点線リーダーで品名と産地を結ぶ罫線風リスト、6品）。
- リスト各行は in-view で 60ms stagger のフェード。行 hover で点線が `--lamp` に変わる。

### S5. アクセス `#access` — 時刻: 夜明け
- 見出し `たどり着くまでも、旅の一部。`
- **SVG の標高断面図**（横: 距離 0〜7.8km、縦: 1,500〜2,500m）。登山口 → 中間小屋 → 天空舎 の3ポイント。
  in-view で稜線のパスが `stroke-dashoffset` で 2400ms 描かれ、その後ポイントが順に点灯。
  パスの上をポインター位置に追従して縦線とツールチップ（距離・標高・所要時間を Plex Mono で）。タッチではタップで表示。
- 下に3ステップ（`新宿から特急で松本へ` / `バスで登山口へ` / `徒歩 約3時間`）。

### S6. 予約 `#reserve` — 時刻: 日の出
- シェーダーが夜明けに至り、地平線が淡い橙と藤色になる。ここだけ UI の文字色を少し暖かく（`--frost` のまま、見出しに `text-shadow:0 0 40px var(--lamp-glow)`）。
- 見出し `今夜、空はあいていますか。`
- **空室カレンダー（架空データ）:** 当月1ヶ月分の7列グリッド。各日に `○`（空き, `--lamp`）/ `△`（残りわずか）/ `×`（満室）。
  データは `2026-10` 固定で JS に定義（ランダム禁止、見た目が毎回同じになるように）。日付をクリックすると選択状態になり、
  下の **予約サマリー**（チェックイン日 / 人数 +- / 部屋セレクト / 合計金額）が更新され、合計は数字が 400ms でカウント遷移する。
- `この内容で仮予約する` ボタン → 押すとボタンがランプ色に満たされるプログレス（1200ms）→ `仮予約を受け付けました` 表示。バックエンドなし。

### Footer
- `天空舎 — 標高2,400mの星見の宿` / 架空の所在地 `長野県 北アルプス某所` / 冬期休業の注記 / `© 2026 TENKUSHA`
- `※本ページは架空の宿泊施設のデザインサンプルです。`

## シェーダー（背景の本体）

WebGL2 コンテキストを `canvas.getContext('webgl2', { antialias:false, alpha:false, powerPreference:'high-performance' })` で取得。
フルスクリーン三角形1枚（`gl_VertexID` で頂点を生成）に以下のフラグメントシェーダーを描く。

- **解像度スケール:** 描画バッファは CSS サイズ × `scale`。`scale` = デスクトップ 0.5 / モバイル 0.4（DPR は掛けない）。
  直近 60 フレーム平均が 24ms 超なら `scale` を 0.08 ずつ下げる（下限 0.3）。CSS で `image-rendering:auto` のまま拡大表示。
- **JS 側の uniform 更新:**
  - `uTime`: 秒
  - `uTravel`: カメラの前進量。`targetTravel = P * 140.0`、`travel += (targetTravel - travel) * 0.045`（慣性）に加え、毎秒 0.25 ずつ自走。
  - `uHour`: 0（黄昏）→ 0.5（深夜）→ 1（夜明け）。`P` から `smoothstep` 付きで写像（S0–S1: 0→0.2、S2–S3: 0.2→0.6、S4: 0.6→0.8、S5–S6: 0.8→1.0）。
  - `uLook`: ポインター正規化座標（-1〜1）を lerp 0.05 で追従。カメラのヨー ±0.12rad / ピッチ ±0.05rad に使う。
  - `uCloud`（S1 参照, 初期 1.0）、`uStarBoost`（S2 参照, 初期 1.0）、`uFade`（ロード時 0→1, 1800ms）。
  - `uRes`: 描画バッファのサイズ。
- **reduced-motion:** 自走 0、`uTravel` は慣性なしでスクロールに直結しつつ最大変化量を 1/4 に。星の瞬きなし。
- **WebGL2 非対応:** キャンバスを隠し、`body` に `linear-gradient(#0b1224, #060912 60%)` を敷く。

```glsl
#version 300 es
precision highp float;
uniform vec2  uRes;
uniform float uTime, uTravel, uHour, uCloud, uStarBoost, uFade;
uniform vec2  uLook;
out vec4 outColor;

// ---------- noise ----------
float hash21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash21(i), hash21(i+vec2(1,0)), u.x),
             mix(hash21(i+vec2(0,1)), hash21(i+vec2(1,1)), u.x), u.y);
}
const mat2 ROT = mat2(0.8, -0.6, 0.6, 0.8);
float fbm(vec2 p, int oct){
  float a = 0.5, s = 0.0;
  for (int i = 0; i < oct; i++){ s += a*vnoise(p); p = ROT*p*2.03; a *= 0.5; }
  return s;
}

// ---------- terrain ----------
float pathX(float z){ return sin(z*0.045)*7.0 + sin(z*0.017)*11.0; }   // 谷筋（カメラの通り道）
float terrain(vec2 xz, int oct){
  float h = fbm(xz*0.075, oct);
  h = h*h*16.0;                                                        // 尖った稜線
  float valley = smoothstep(1.5, 16.0, abs(xz.x - pathX(xz.y)));        // 谷を掘る
  return h*mix(0.18, 1.0, valley) - 2.0;
}
vec3 terrainNormal(vec3 p, float t){
  vec2 e = vec2(0.01 + t*0.002, 0.0);
  return normalize(vec3(terrain(p.xz-e.xy,8) - terrain(p.xz+e.xy,8),
                        2.0*e.x,
                        terrain(p.xz-e.yx,8) - terrain(p.xz+e.yx,8)));
}
float march(vec3 ro, vec3 rd){
  float t = 0.5;
  for (int i = 0; i < 120; i++){
    vec3 p = ro + rd*t;
    float d = p.y - terrain(p.xz, 5);
    if (d < 0.002*t || t > 160.0) break;
    t += d*0.42;
  }
  return t;
}

// ---------- sky ----------
vec3 skyColor(vec3 rd){
  // 時刻ごとの地平線色と天頂色
  vec3 horDusk = vec3(0.95,0.48,0.30), zenDusk = vec3(0.10,0.10,0.26);
  vec3 horNight= vec3(0.05,0.08,0.16), zenNight= vec3(0.005,0.01,0.03);
  vec3 horDawn = vec3(0.86,0.64,0.70), zenDawn = vec3(0.26,0.34,0.58);   // 夜明けは藤色〜青（夕暮れの橙と区別）
  float n = 1.0 - abs(uHour*2.0 - 1.0);                // 0=端 1=深夜
  vec3 hor = uHour < 0.5 ? mix(horDusk, horNight, n) : mix(horDawn, horNight, n);
  vec3 zen = uHour < 0.5 ? mix(zenDusk, zenNight, n) : mix(zenDawn, zenNight, n);
  float y = clamp(rd.y, 0.0, 1.0);
  vec3 col = mix(hor, zen, pow(y, 0.45));
  // 太陽側（西=夕 / 東=朝）のにじみ
  vec3 sunDir = normalize(vec3(uHour < 0.5 ? -1.0 : 1.0, 0.02, -0.6));
  col += (uHour < 0.5 ? horDusk : horDawn) * pow(max(dot(rd, sunDir), 0.0), 6.0) * 0.6 * (1.0 - n);
  return col;
}
float stars(vec3 rd){
  vec2 uv = vec2(atan(rd.x, rd.z), asin(clamp(rd.y, -1.0, 1.0))) * 160.0;
  vec2 id = floor(uv), gv = fract(uv) - 0.5;
  float h = hash21(id);
  vec2 off = vec2(hash21(id+11.3), hash21(id+27.1)) - 0.5;
  float s = smoothstep(0.14, 0.0, length(gv - off*0.7)) * step(0.955, h);
  float tw = 0.55 + 0.45*sin(uTime*(1.2 + h*3.0) + h*60.0);
  return s * tw * (0.6 + 2.4*fract(h*97.0)) * smoothstep(0.02, 0.2, rd.y);
}
vec3 milkyWay(vec3 rd){
  vec3 N = normalize(vec3(0.85, -0.2, 0.1));     // 前方の空を斜めに横切る向き
  float d = dot(rd, N);
  float band = exp(-d*d*40.0);
  vec2 q = vec2(atan(rd.x, rd.z), rd.y) * 3.0;
  float dust = fbm(q*2.0, 5);
  float lanes = smoothstep(0.35, 0.65, fbm(q*4.5 + 3.1, 4));          // 暗黒帯
  return vec3(0.75, 0.82, 1.0) * 1.6 * band * dust * (0.4 + 0.6*lanes) * smoothstep(0.0, 0.25, rd.y);
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes) / uRes.y;
  float night = 1.0 - abs(uHour*2.0 - 1.0);

  // カメラ
  float z = uTravel;
  vec3 ro = vec3(pathX(z), 0.0, z);
  ro.y = max(terrain(ro.xz, 4), -1.6) + 3.2;
  vec3 ahead = vec3(pathX(z + 6.0), ro.y - 0.35, z + 6.0);
  vec3 fw = normalize(ahead - ro);
  float yaw = uLook.x*0.12, pitch = uLook.y*0.05 + 0.08;
  fw = normalize(fw + vec3(yaw, pitch, 0.0));
  vec3 rt = normalize(cross(vec3(0,1,0), fw));
  vec3 up = cross(fw, rt);
  vec3 rd = normalize(fw*1.6 + rt*uv.x + up*uv.y);

  vec3 sky = skyColor(rd);
  sky += vec3(stars(rd)) * night * uStarBoost;
  sky += milkyWay(rd) * night * night * uStarBoost;

  vec3 col = sky;
  float t = march(ro, rd);
  if (t < 160.0){
    vec3 p = ro + rd*t;
    vec3 n = terrainNormal(p, t);
    vec3 moon = normalize(vec3(-0.35, 0.45, 0.8));
    float dif = clamp(dot(n, moon), 0.0, 1.0);
    float snow = smoothstep(0.55, 0.85, n.y) * smoothstep(2.5, 6.0, p.y);
    vec3 rock = mix(vec3(0.030,0.034,0.045), vec3(0.20,0.22,0.27), snow);
    vec3 lit  = rock * (0.25 + dif*mix(0.9, 0.55, night));
    lit += (uHour < 0.5 ? vec3(0.9,0.45,0.25) : vec3(0.9,0.6,0.5)) * dif * 0.12 * (1.0 - night);
    // 稜線上の山小屋の灯（谷筋から 5 離れた位置に 18 単位ごと）
    float cell = floor(p.z/18.0);
    vec2 lamp = vec2(pathX(cell*18.0 + 9.0) + 5.0*(hash21(vec2(cell,1.0))>0.5?1.0:-1.0), cell*18.0 + 9.0);
    float ld = length(p.xz - lamp);
    lit += vec3(1.0,0.70,0.42) * exp(-ld*ld*6.0) * 2.2 * step(0.6, hash21(vec2(cell, 7.0))) * night;
    float fog = 1.0 - exp(-t*mix(0.011, 0.016, night));
    col = mix(lit, sky*0.9, fog);
  }

  // 雲海（高さ -1.2 付近の層。上から見下ろす）
  if (rd.y < 0.0){
    float tc = (-0.8 - ro.y) / rd.y;
    if (tc > 0.0 && tc < t){
      vec3 pc = ro + rd*tc;
      float c = fbm(pc.xz*0.06 + vec2(uTime*0.02, 0.0), 6);
      c = smoothstep(0.55 - 0.25*uCloud, 0.9, c) * uCloud;
      vec3 cloudCol = mix(vec3(0.55,0.58,0.70), vec3(0.16,0.19,0.28), night) + skyColor(vec3(rd.x,0.05,rd.z))*0.35;
      col = mix(col, cloudCol, c * (1.0 - exp(-tc*0.05)) * 0.9);
    }
  }

  col = 1.0 - exp(-col*1.25);                  // トーンマップ（色はディスプレイ空間で指定済み。ガンマは掛けない）
  col *= 0.55 + 0.45*smoothstep(1.3, 0.2, length(uv));  // ビネット
  outColor = vec4(col * uFade, 1.0);
}
```
> シェーダーは**出発点**。見た目の調整（色・霧・雲海の量）は許可するが、`uTravel` / `uHour` / `uCloud` / `uStarBoost` の
> 意味と、「夕暮れ→深夜→夜明け」「雲海が引いて稜線が現れる」「無灯の時間で星が増す」の3つの演出は必ず残すこと。
> 地形にカメラがめり込む・空が真っ黒になる・天の川が縞模様になる、は不合格。

## 汎用リビール

見出し・カード・段落は `IntersectionObserver`（threshold 0.18）で1回だけ:
`opacity 0→1, translateY(1.25rem)→0, filter: blur(6px)→0, 1000ms var(--ease-entrance)`、グループ内 100ms stagger。

## 固定パラメータ（まとめ）

- 解像度スケール 0.5 / 0.4（下限 0.3, 60F 平均 24ms 超で -0.08）、レイマーチ 120 steps / 最大距離 160
- `uTravel` = P×140 + 自走 0.25/s、慣性 0.045。ポインター lerp 0.05、ヨー ±0.12 / ピッチ ±0.05
- 時刻写像: S0–S1 0→0.2 / S2–S3 0.2→0.6 / S4 0.6→0.8 / S5–S6 0.8→1.0
- HUD: ALT 2380±64 / TIME 17:30→05:10 / TEMP 6.2−8.4·sin
- ロード: キャンバス 1800ms → 1200ms 後にテキスト（行マスク 1200ms, 行 stagger 140ms）
- 雲海 uCloud 1.0→0.35（S1）、無灯の時間 uStarBoost 1.0→1.8 と UI opacity 0.25（1200ms）
- 暖色 `--lamp` は CTA・現在地/進行マーカー・空室○ のみ

## 受け入れ条件

1. 1440×900 / 390×844 でロード〜末尾までコンソールエラー0、シェーダーのコンパイルエラー0、横スクロールなし。
2. ページ先頭・中盤・末尾のスクリーンショットを並べると、**夕暮れ／星空の深夜／夜明け** が一目で区別できる。
3. スクロールを止めても背景は完全には止まらない（自走と星の瞬き）。ポインターで視線がわずかに動く（デスクトップ）。
4. カメラが地形に埋まるフレームがない（`ro.y` の下限と谷筋により保証。全ページを通しスクロールして目視）。
5. テキストパネルは常に背景に対して読める（本文部はガラス面上、コントラスト 4.5:1 相当を目視で満たす）。
6. 単一 `index.html`、画像ファイルなし。

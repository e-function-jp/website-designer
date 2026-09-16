# Recreate this site as a single HTML file: Flowstate

You are an expert creative front-end developer. Produce a **single self-contained `index.html`**
that reproduces the project below **exactly** — same layout, visuals, motion, and interaction. Pure
HTML/CSS/JS in one file: no build step, no framework, no bundler. Use plain DOM and vanilla JS; the
only external dependency is the Google font (via a `<link>`) and the Lenis smooth-scroll library
(via a CDN ES-module import). Hardcode every value given here as a fixed constant. Rebuild each
component described below as a block of the one file.

## What it is

A full-viewport, immersive **dark hero** — a waitlist landing for a deep-work / focus app called
**Flowstate**. A full-bleed **WebGL fluid simulation** (oily "ink-in-water") fills the background:
it bursts into vivid color on load, then an invisible auto-cursor orbits the centre **forever**,
continuously painting bright cyan→blue→violet→magenta ink that swirls and dissipates; the real
mouse/touch also stirs the fluid. A soft radial scrim darkens the centre for text legibility. Over
it sits a centred column — a glass badge pill, a large heading revealed **word-by-word**, a
word-by-word sub-line, and a glass email "join waitlist" bar — plus a top nav (brand + glass link
pill + solid-white CTA pill) and a footer line. Everything **staggers in** on load with soft spring
reveals. The base is near-black `#04050c`; text is bright fog-white. Type is **Onest**.

There is only **one section** (the hero) and it fills `100lvh`. Smooth scrolling is wired via Lenis,
but the page is a single screen — scroll is effectively inert; keep Lenis for parity.

## Page shell & libraries

- **Font:** Onest from Google Fonts — `<link href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500&display=swap" rel="stylesheet">`. Apply `font-family: "Onest", sans-serif` to the body. Weights used: 400 (body) and 500 (medium — brand, heading, buttons, badge).
- **Smooth scroll:** Lenis 1.3.x via importmap, e.g.
  ```html
  <script type="importmap">{ "imports": { "lenis": "https://unpkg.com/lenis@1.3.19/dist/lenis.mjs" } }</script>
  ```
  In a module script: `import Lenis from "lenis"; const lenis = new Lenis({ smoothWheel: true }); function raf(t){ lenis.raf(t); requestAnimationFrame(raf); } requestAnimationFrame(raf);`
- **CSS reset:** `* { margin:0; box-sizing:border-box; }`, remove default anchor/button styling, `body { background: var(--hero-base); color: var(--heading); overflow-x: hidden; }`.
- **Adaptive rem grid (important — the whole layout is rem-based and scales with the viewport).**
  Set the root font-size responsively so a rem-based layout stays proportional:
  ```css
  html { font-size: 16px; }
  @media (max-width: 1920px) { html { font-size: 0.833333vw; } } /* 16*100/1920 */
  @media (max-width: 1440px) { html { font-size: 1.111111vw; } } /* 16*100/1440 */
  @media (max-width: 1024px) { html { font-size: 1.5625vw;   } } /* 16*100/1024 */
  @media (max-width: 640px)  { html { font-size: 4.444444vw; } } /* 16*100/360  */
  ```
  All sizes below are given in rem so they follow this scale. Breakpoints in the markup use
  `sm` = **640px** (min-width) style rules; treat "sm:" values as the ≥640px branch, base values as <640px.

### CSS custom properties (colors — bake these in exactly)

```css
:root {
  --hero-base:            #04050c;   /* base behind the shader */
  --heading:             #eef0f6;   /* bright heading / input text */
  --body-muted:          #b9becf;   /* body copy, nav links, badge, footer */
  --on-media:            #ffffff;   /* brand text/icons sitting on the shader */
  --action-inverse:      #ffffff;   /* white pill button bg */
  --action-inverse-fg:   #2f2f33;   /* dark text on the white pill */
  --glass-fill:          rgba(255,255,255,0.08);
  --glass-border:        rgba(255,255,255,0.16);
  --scrim:               rgba(4,5,12,0.46);
  --scrim-strong:        rgba(4,5,12,0.68);
  --scrim-soft:          rgba(4,5,12,0.12);
  --duration-fast:       150ms;
  --ease-entrance:       cubic-bezier(0.2, 0, 0, 1);
}
```

## Layout & sections (in order)

Root: `<section>` — `position:relative; display:flex; flex-direction:column; align-items:center;
justify-content:center; min-height:100lvh; width:100vw; overflow:hidden; background:var(--hero-base);
text-align:center; padding: 0 1.25rem;` (≥640px: padding `0 2.5rem`).

**1. Fluid canvas (z-0).** `<canvas aria-hidden="true">` absolutely positioned `inset:0; width:100%;
height:100%; z-index:0; pointer-events:none;`. Runs the WebGL fluid engine (see "The WebGL scene").

**2. Scrim (z-1).** An `aria-hidden` div, `position:absolute; inset:0; z-index:1; pointer-events:none;`
with this exact background:
```css
background: radial-gradient(115% 95% at 50% 46%,
  var(--scrim-strong) 0%, var(--scrim-strong) 24%, var(--scrim) 52%, var(--scrim-soft) 100%);
```

**3. Top nav (`<header>`, z-20).** `position:absolute; inset-inline:0; top:0; display:flex;
align-items:center; justify-content:space-between; padding:1.25rem;` (≥640px `padding:1.75rem 2.5rem`).
Reveals as the first stagger step (see reveals).
- **Left — brand link** to `/`: `display:flex; align-items:center; gap:0.6rem; font-weight:500;
  font-size:1.15rem` (≥640px `1.375rem`); color `var(--on-media)`; `letter-spacing:-0.01em`. Contains:
  - **Brand glyph** (inline SVG, `1.35rem` square, ≥640px `1.5rem`, `stroke:currentColor`) — two
    interleaving flow lines echoing the fluid:
    ```html
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2.5 9c2.5 0 2.5 4.2 5 4.2S10 9 12 9s2.5 4.2 5 4.2S19.5 9 21.5 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M2.5 15c2.5 0 2.5 4.2 5 4.2S10 15 12 15s2.5 4.2 5 4.2S19.5 15 21.5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity="0.5"/>
    </svg>
    ```
  - the word **Flowstate**.
- **Center — glass link pill** (hidden below 640px; shown ≥640px as `display:flex`):
  `position:absolute; left:50%; transform:translateX(-50%); height:3rem; align-items:center;
  gap:2.25rem; border-radius:9999px; border:1px solid var(--glass-border); background:var(--glass-fill);
  padding:0 1.75rem; backdrop-filter:blur(12px);`. Links (font-size `0.95rem`, color `var(--body-muted)`,
  hover → `var(--heading)`, `transition:color var(--duration-fast) var(--ease-entrance)`,
  `white-space:nowrap`): **How it works?** (`#how-it-works`), **Pricing** (`#pricing`),
  **Products** (`#products`), **Blog** (`#blog`).
- **Right — CTA pill button** (the shared white pill, see below) labeled **Get Started**, href `#get-started`.

**4. Center column (z-10).** `position:relative; z-index:10; display:flex; flex-direction:column;
align-items:center; width:100%; max-width:22rem;` (≥640px `40rem`, ≥1024px `52rem`). Contains, in order:
  - **Badge pill** (`<p>`): `display:inline-flex; align-items:center; border-radius:9999px;
    border:1px solid var(--glass-border); background:var(--glass-fill); padding:0.4rem 0.875rem;
    font-size:0.72rem` (≥640px `0.8rem`); color `var(--body-muted)`; `backdrop-filter:blur(12px);`.
    Text: **10K+ already in flow**.
  - **Heading** (`<h1>`) — text **"Deep Work in a Distracted World"**, revealed **word-by-word**
    (see reveals). `margin-top:1.25rem` (≥640px `1.75rem`); `max-width:20rem` (≥640px `34rem`,
    ≥1024px `46rem`); `font-size:2rem` (≥640px `3.5rem`, ≥1024px `5rem`); `font-weight:500;
    line-height:1.1; letter-spacing:-0.02em; color:var(--heading); text-align:center;`.
  - **Sub-line** (`<p>`) — text **"Cut through the noise, reclaim your attention, and do work that
    truly matters."**, revealed word-by-word. `margin-top:1rem` (≥640px `1.25rem`); `max-width:20rem`
    (≥640px `34rem`, ≥1024px `none`); `font-size:1rem` (≥640px `1.1rem`, ≥1024px `1.2rem`);
    `line-height:1.5; color:var(--body-muted);`.
  - **Waitlist form** (`margin-top:1.75rem`, ≥640px `2.5rem`; `display:flex; justify-content:center;
    width:100%`). A `<form>` `width:37rem; max-width:100%`. Inside, a glass bar:
    `display:flex; align-items:center; height:3.5rem` (≥640px `4rem`); `border-radius:9999px;
    border:1px solid var(--glass-border); background:var(--glass-fill); backdrop-filter:blur(12px);
    box-shadow:0 1px 2px rgba(0,0,0,.05); padding-left:1.25rem; padding-right:0.35rem` (≥640px
    `pl:1.5rem; pr:0.4rem`). Contains an `<input type="email" required placeholder="Enter your email">`
    (`flex:1; min-width:0; height:100%; background:transparent; color:var(--heading); font-size:0.95rem`
    (≥640px `1.15rem`); placeholder color `var(--body-muted)`; no outline) and a white **Join Waitlist**
    submit pill. On submit: `preventDefault()`, no backend (no-op).

**5. Footer (`<footer>`, z-20).** `position:absolute; inset-inline:0; bottom:0; display:flex;
justify-content:center; padding:1.25rem` (≥640px `1.5rem 2.5rem`); `font-size:0.72rem` (≥640px `0.8rem`);
color `var(--body-muted)`. Text: **© 2026 Flowstate — engineered for deep work.**

**Shared white "pill" button** (used by "Get Started" and "Join Waitlist"):
`display:inline-flex; align-items:center; justify-content:center; height:2.5rem` (≥640px `2.75rem`);
`border-radius:9999px; background:var(--action-inverse); padding:0 1.125rem` (≥640px `0 1.375rem`);
`font-size:0.85rem` (≥640px `0.95rem`); `font-weight:500; color:var(--action-inverse-fg);
box-shadow:0 1px 2px rgba(0,0,0,.05); transition:background var(--duration-fast) var(--ease-entrance);`
hover → background `rgba(255,255,255,0.85)`; focus-visible → `outline:none; box-shadow:0 0 0 2px rgba(255,255,255,.7)`.

## The loader / reveal (the hero moment the preview captures)

There is **no separate loader overlay**. The "reveal" is the combination of (a) the fluid's **load
burst** and (b) the **staggered entrance** of the content — both fire on page load.

- **Fluid load burst:** the moment the engine starts it fires `multipleSplats(34)` (a dense burst of
  34 bright ink splats at random points) and queues **8** rapid follow-up waves
  (`splatStack.push(10 + random*10)`, drained one per frame). ~700ms later the invisible auto-cursor
  begins its perpetual orbit. This is baked into the engine below — do not change it.
- **Content stagger:** each block animates from `opacity:0` + a small translate to `opacity:1` +
  `translate:0`, with a soft spring (approximate a spring of tension 120 / friction 24 → ~700ms
  `cubic-bezier(0.2,0,0,1)` ease is a fine stand-in) and the following **delays after load** (ms):

  | Block | delay | from-transform | reveal style |
  |---|---|---|---|
  | Nav (header) | 150 | `translateY(-0.75rem)` | whole bar fades/slides in together |
  | Badge pill | 320 | `translateY(1.25rem)` | fades/slides up together |
  | Heading | 480 | per-word | **word-by-word**: each word `translateY(26px)→0`, `opacity 0→1`, **stagger 85ms**, per-word duration **720ms**, easing easeOutCubic (`1-(1-t)^3`) |
  | Sub-line | 1150 | per-word | **word-by-word**: each word `translateY(14px)→0`, `opacity 0→1`, **stagger 22ms**, per-word duration **600ms**, easeOutCubic |
  | Waitlist form | 1450 | `translateY(1.25rem)` | fades/slides up together |
  | Footer | 1650 | `translateY(1.25rem)` | fades/slides up together |

  For the word-by-word reveals, split the heading/sub-line text on spaces, wrap each word in an
  `inline-block` span (add a trailing space between words so wrapping is natural), and animate each
  span with its own `transition-delay = baseDelay + wordIndex * stagger`. Keep the line-height floor
  at 1.1 for the heading so descenders aren't clipped.

## The WebGL scene — the fluid ink simulation (this is the effect; reproduce verbatim)

Full-bleed GPU fluid solver (Pavel Dobryakov's WebGL fluid sim, MIT), tuned for an oily, marbled,
vivid-on-near-black look. Mount it on the background `<canvas>`, call `fluidSimulation(canvas)` once
after the DOM is ready. The engine owns its own `requestAnimationFrame` loop and reads pointer input
from **window** events (the canvas sits behind content with `pointer-events:none`, so it maps
`clientX/Y` into canvas space via `getBoundingClientRect()`). Paste the engine **verbatim** (it is
plain JS — the only edits from the original are: the tuned `config`, the strong load burst, the
`generateColor` cyan→magenta band, and the invisible auto-cursor that orbits the centre forever):

```js
function fluidSimulation(canvas) {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    let config = {
        SIM_RESOLUTION: 200,
        DYE_RESOLUTION: 512,
        DENSITY_DISSIPATION: 0.958, // trails fade so idle swirls stay dynamic, not saturated
        VELOCITY_DISSIPATION: 0.96,
        PRESSURE_DISSIPATION: 0.8,
        PRESSURE_ITERATIONS: 20,
        CURL: 42,                   // extra swirl for the marbled look
        SPLAT_RADIUS: 0.22,         // fatter ink blobs
        SHADING: true,
        COLORFUL: true,
        PAUSED: false,
        BACK_COLOR: { r: 4, g: 5, b: 12 }, // deep near-black base (immersive)
        TRANSPARENT: false,
        BLOOM: false,
        BLOOM_ITERATIONS: 8,
        BLOOM_RESOLUTION: 256,
        BLOOM_INTENSITY: 0.8,
        BLOOM_THRESHOLD: 0.8,
        BLOOM_SOFT_KNEE: 0.7
    }

    function pointerPrototype() {
        this.id = -1;
        this.x = 0;
        this.y = 0;
        this.dx = 0;
        this.dy = 0;
        this.down = false;
        this.moved = false;
        this.color = [30, 0, 300];
    }

    let pointers = [];
    let splatStack = [];
    pointers.push(new pointerPrototype());

    const { gl, ext } = getWebGLContext(canvas);

    if (isMobile())
        config.SHADING = false;
    if (!ext.supportLinearFiltering) {
        config.SHADING = false;
        config.BLOOM = false;
    }

    function getWebGLContext(canvas) {
        const params = { alpha: true, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false };

        let gl = canvas.getContext('webgl2', params);
        const isWebGL2 = !!gl;
        if (!isWebGL2)
            gl = canvas.getContext('webgl', params) || canvas.getContext('experimental-webgl', params);

        let halfFloat;
        let supportLinearFiltering;
        if (isWebGL2) {
            gl.getExtension('EXT_color_buffer_float');
            supportLinearFiltering = gl.getExtension('OES_texture_float_linear');
        } else {
            halfFloat = gl.getExtension('OES_texture_half_float');
            supportLinearFiltering = gl.getExtension('OES_texture_half_float_linear');
        }

        gl.clearColor(0.0, 0.0, 0.0, 1.0);

        const halfFloatTexType = isWebGL2 ? gl.HALF_FLOAT : halfFloat.HALF_FLOAT_OES;
        let formatRGBA;
        let formatRG;
        let formatR;

        if (isWebGL2) {
            formatRGBA = getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, halfFloatTexType);
            formatRG = getSupportedFormat(gl, gl.RG16F, gl.RG, halfFloatTexType);
            formatR = getSupportedFormat(gl, gl.R16F, gl.RED, halfFloatTexType);
        }
        else {
            formatRGBA = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
            formatRG = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
            formatR = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
        }

        return {
            gl,
            ext: {
                formatRGBA,
                formatRG,
                formatR,
                halfFloatTexType,
                supportLinearFiltering
            }
        };
    }

    function getSupportedFormat(gl, internalFormat, format, type) {
        if (!supportRenderTextureFormat(gl, internalFormat, format, type)) {
            switch (internalFormat) {
                case gl.R16F:
                    return getSupportedFormat(gl, gl.RG16F, gl.RG, type);
                case gl.RG16F:
                    return getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, type);
                default:
                    return null;
            }
        }

        return {
            internalFormat,
            format
        }
    }

    function supportRenderTextureFormat(gl, internalFormat, format, type) {
        let texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);

        let fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status != gl.FRAMEBUFFER_COMPLETE)
            return false;
        return true;
    }

    function clamp01(input) {
        return Math.min(Math.max(input, 0), 1);
    }

    function isMobile() {
        return /Mobi|Android/i.test(navigator.userAgent);
    }

    class GLProgram {
        constructor(vertexShader, fragmentShader) {
            this.uniforms = {};
            this.program = gl.createProgram();

            gl.attachShader(this.program, vertexShader);
            gl.attachShader(this.program, fragmentShader);
            gl.linkProgram(this.program);

            if (!gl.getProgramParameter(this.program, gl.LINK_STATUS))
                throw gl.getProgramInfoLog(this.program);

            const uniformCount = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS);
            for (let i = 0; i < uniformCount; i++) {
                const uniformName = gl.getActiveUniform(this.program, i).name;
                this.uniforms[uniformName] = gl.getUniformLocation(this.program, uniformName);
            }
        }

        bind() {
            gl.useProgram(this.program);
        }
    }

    function compileShader(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
            throw gl.getShaderInfoLog(shader);

        return shader;
    };

    const baseVertexShader = compileShader(gl.VERTEX_SHADER, `
        precision highp float;
        attribute vec2 aPosition;
        varying vec2 vUv;
        varying vec2 vL;
        varying vec2 vR;
        varying vec2 vT;
        varying vec2 vB;
        uniform vec2 texelSize;
        void main () {
            vUv = aPosition * 0.5 + 0.5;
            vL = vUv - vec2(texelSize.x, 0.0);
            vR = vUv + vec2(texelSize.x, 0.0);
            vT = vUv + vec2(0.0, texelSize.y);
            vB = vUv - vec2(0.0, texelSize.y);
            gl_Position = vec4(aPosition, 0.0, 1.0);
        }
    `);

    const clearShader = compileShader(gl.FRAGMENT_SHADER, `
        precision mediump float;
        precision mediump sampler2D;
        varying highp vec2 vUv;
        uniform sampler2D uTexture;
        uniform float value;
        void main () {
            gl_FragColor = value * texture2D(uTexture, vUv);
        }
    `);

    const colorShader = compileShader(gl.FRAGMENT_SHADER, `
        precision mediump float;
        uniform vec4 color;
        void main () {
            gl_FragColor = color;
        }
    `);

    const backgroundShader = compileShader(gl.FRAGMENT_SHADER, `
        precision highp float;
        precision highp sampler2D;
        varying vec2 vUv;
        uniform sampler2D uTexture;
        uniform float aspectRatio;
        #define SCALE 25.0
        void main () {
            vec2 uv = floor(vUv * SCALE * vec2(aspectRatio, 1.0));
            float v = mod(uv.x + uv.y, 2.0);
            v = v * 0.1 + 0.8;
            gl_FragColor = vec4(vec3(v), 1.0);
        }
    `);

    const displayShader = compileShader(gl.FRAGMENT_SHADER, `
        precision highp float;
        precision highp sampler2D;
        varying vec2 vUv;
        uniform sampler2D uTexture;
        void main () {
            vec3 C = texture2D(uTexture, vUv).rgb;
            float a = max(C.r, max(C.g, C.b));
            gl_FragColor = vec4(C, a);
        }
    `);

    const displayBloomShader = compileShader(gl.FRAGMENT_SHADER, `
        precision highp float;
        precision highp sampler2D;
        varying vec2 vUv;
        uniform sampler2D uTexture;
        uniform sampler2D uBloom;
        uniform sampler2D uDithering;
        uniform vec2 ditherScale;
        void main () {
            vec3 C = texture2D(uTexture, vUv).rgb;
            vec3 bloom = texture2D(uBloom, vUv).rgb;
            vec3 noise = texture2D(uDithering, vUv * ditherScale).rgb;
            noise = noise * 2.0 - 1.0;
            bloom += noise / 800.0;
            bloom = pow(bloom.rgb, vec3(1.0 / 2.2));
            C += bloom;
            float a = max(C.r, max(C.g, C.b));
            gl_FragColor = vec4(C, a);
        }
    `);

    const displayShadingShader = compileShader(gl.FRAGMENT_SHADER, `
        precision highp float;
        precision highp sampler2D;
        varying vec2 vUv;
        varying vec2 vL;
        varying vec2 vR;
        varying vec2 vT;
        varying vec2 vB;
        uniform sampler2D uTexture;
        uniform vec2 texelSize;
        void main () {
            vec3 L = texture2D(uTexture, vL).rgb;
            vec3 R = texture2D(uTexture, vR).rgb;
            vec3 T = texture2D(uTexture, vT).rgb;
            vec3 B = texture2D(uTexture, vB).rgb;
            vec3 C = texture2D(uTexture, vUv).rgb;
            float dx = length(R) - length(L);
            float dy = length(T) - length(B);
            vec3 n = normalize(vec3(dx, dy, length(texelSize)));
            vec3 l = vec3(0.0, 0.0, 1.0);
            float diffuse = clamp(dot(n, l) + 0.7, 0.7, 1.0);
            C.rgb *= diffuse;
            float a = max(C.r, max(C.g, C.b));
            gl_FragColor = vec4(C, a);
        }
    `);

    const displayBloomShadingShader = compileShader(gl.FRAGMENT_SHADER, `
        precision highp float;
        precision highp sampler2D;
        varying vec2 vUv;
        varying vec2 vL;
        varying vec2 vR;
        varying vec2 vT;
        varying vec2 vB;
        uniform sampler2D uTexture;
        uniform sampler2D uBloom;
        uniform sampler2D uDithering;
        uniform vec2 ditherScale;
        uniform vec2 texelSize;
        void main () {
            vec3 L = texture2D(uTexture, vL).rgb;
            vec3 R = texture2D(uTexture, vR).rgb;
            vec3 T = texture2D(uTexture, vT).rgb;
            vec3 B = texture2D(uTexture, vB).rgb;
            vec3 C = texture2D(uTexture, vUv).rgb;
            float dx = length(R) - length(L);
            float dy = length(T) - length(B);
            vec3 n = normalize(vec3(dx, dy, length(texelSize)));
            vec3 l = vec3(0.0, 0.0, 1.0);
            float diffuse = clamp(dot(n, l) + 0.7, 0.7, 1.0);
            C *= diffuse;
            vec3 bloom = texture2D(uBloom, vUv).rgb;
            vec3 noise = texture2D(uDithering, vUv * ditherScale).rgb;
            noise = noise * 2.0 - 1.0;
            bloom += noise / 800.0;
            bloom = pow(bloom.rgb, vec3(1.0 / 2.2));
            C += bloom;
            float a = max(C.r, max(C.g, C.b));
            gl_FragColor = vec4(C, a);
        }
    `);

    const bloomPrefilterShader = compileShader(gl.FRAGMENT_SHADER, `
        precision mediump float;
        precision mediump sampler2D;
        varying vec2 vUv;
        uniform sampler2D uTexture;
        uniform vec3 curve;
        uniform float threshold;
        void main () {
            vec3 c = texture2D(uTexture, vUv).rgb;
            float br = max(c.r, max(c.g, c.b));
            float rq = clamp(br - curve.x, 0.0, curve.y);
            rq = curve.z * rq * rq;
            c *= max(rq, br - threshold) / max(br, 0.0001);
            gl_FragColor = vec4(c, 0.0);
        }
    `);

    const bloomBlurShader = compileShader(gl.FRAGMENT_SHADER, `
        precision mediump float;
        precision mediump sampler2D;
        varying vec2 vL;
        varying vec2 vR;
        varying vec2 vT;
        varying vec2 vB;
        uniform sampler2D uTexture;
        void main () {
            vec4 sum = vec4(0.0);
            sum += texture2D(uTexture, vL);
            sum += texture2D(uTexture, vR);
            sum += texture2D(uTexture, vT);
            sum += texture2D(uTexture, vB);
            sum *= 0.25;
            gl_FragColor = sum;
        }
    `);

    const bloomFinalShader = compileShader(gl.FRAGMENT_SHADER, `
        precision mediump float;
        precision mediump sampler2D;
        varying vec2 vL;
        varying vec2 vR;
        varying vec2 vT;
        varying vec2 vB;
        uniform sampler2D uTexture;
        uniform float intensity;
        void main () {
            vec4 sum = vec4(0.0);
            sum += texture2D(uTexture, vL);
            sum += texture2D(uTexture, vR);
            sum += texture2D(uTexture, vT);
            sum += texture2D(uTexture, vB);
            sum *= 0.25;
            gl_FragColor = sum * intensity;
        }
    `);

    const splatShader = compileShader(gl.FRAGMENT_SHADER, `
        precision highp float;
        precision highp sampler2D;
        varying vec2 vUv;
        uniform sampler2D uTarget;
        uniform float aspectRatio;
        uniform vec3 color;
        uniform vec2 point;
        uniform float radius;
        void main () {
            vec2 p = vUv - point.xy;
            p.x *= aspectRatio;
            vec3 splat = exp(-dot(p, p) / radius) * color;
            vec3 base = texture2D(uTarget, vUv).xyz;
            gl_FragColor = vec4(base + splat, 1.0);
        }
    `);

    const advectionManualFilteringShader = compileShader(gl.FRAGMENT_SHADER, `
        precision highp float;
        precision highp sampler2D;
        varying vec2 vUv;
        uniform sampler2D uVelocity;
        uniform sampler2D uSource;
        uniform vec2 texelSize;
        uniform vec2 dyeTexelSize;
        uniform float dt;
        uniform float dissipation;
        vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
            vec2 st = uv / tsize - 0.5;
            vec2 iuv = floor(st);
            vec2 fuv = fract(st);
            vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);
            vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);
            vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);
            vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);
            return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
        }
        void main () {
            vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;
            gl_FragColor = dissipation * bilerp(uSource, coord, dyeTexelSize);
            gl_FragColor.a = 1.0;
        }
    `);

    const advectionShader = compileShader(gl.FRAGMENT_SHADER, `
        precision highp float;
        precision highp sampler2D;
        varying vec2 vUv;
        uniform sampler2D uVelocity;
        uniform sampler2D uSource;
        uniform vec2 texelSize;
        uniform float dt;
        uniform float dissipation;
        void main () {
            vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
            gl_FragColor = dissipation * texture2D(uSource, coord);
            gl_FragColor.a = 1.0;
        }
    `);

    const divergenceShader = compileShader(gl.FRAGMENT_SHADER, `
        precision mediump float;
        precision mediump sampler2D;
        varying highp vec2 vUv;
        varying highp vec2 vL;
        varying highp vec2 vR;
        varying highp vec2 vT;
        varying highp vec2 vB;
        uniform sampler2D uVelocity;
        void main () {
            float L = texture2D(uVelocity, vL).x;
            float R = texture2D(uVelocity, vR).x;
            float T = texture2D(uVelocity, vT).y;
            float B = texture2D(uVelocity, vB).y;
            vec2 C = texture2D(uVelocity, vUv).xy;
            if (vL.x < 0.0) { L = -C.x; }
            if (vR.x > 1.0) { R = -C.x; }
            if (vT.y > 1.0) { T = -C.y; }
            if (vB.y < 0.0) { B = -C.y; }
            float div = 0.5 * (R - L + T - B);
            gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
        }
    `);

    const curlShader = compileShader(gl.FRAGMENT_SHADER, `
        precision mediump float;
        precision mediump sampler2D;
        varying highp vec2 vUv;
        varying highp vec2 vL;
        varying highp vec2 vR;
        varying highp vec2 vT;
        varying highp vec2 vB;
        uniform sampler2D uVelocity;
        void main () {
            float L = texture2D(uVelocity, vL).y;
            float R = texture2D(uVelocity, vR).y;
            float T = texture2D(uVelocity, vT).x;
            float B = texture2D(uVelocity, vB).x;
            float vorticity = R - L - T + B;
            gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
        }
    `);

    const vorticityShader = compileShader(gl.FRAGMENT_SHADER, `
        precision highp float;
        precision highp sampler2D;
        varying vec2 vUv;
        varying vec2 vL;
        varying vec2 vR;
        varying vec2 vT;
        varying vec2 vB;
        uniform sampler2D uVelocity;
        uniform sampler2D uCurl;
        uniform float curl;
        uniform float dt;
        void main () {
            float L = texture2D(uCurl, vL).x;
            float R = texture2D(uCurl, vR).x;
            float T = texture2D(uCurl, vT).x;
            float B = texture2D(uCurl, vB).x;
            float C = texture2D(uCurl, vUv).x;
            vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
            force /= length(force) + 0.0001;
            force *= curl * C;
            force.y *= -1.0;
            vec2 vel = texture2D(uVelocity, vUv).xy;
            gl_FragColor = vec4(vel + force * dt, 0.0, 1.0);
        }
    `);

    const pressureShader = compileShader(gl.FRAGMENT_SHADER, `
        precision mediump float;
        precision mediump sampler2D;
        varying highp vec2 vUv;
        varying highp vec2 vL;
        varying highp vec2 vR;
        varying highp vec2 vT;
        varying highp vec2 vB;
        uniform sampler2D uPressure;
        uniform sampler2D uDivergence;
        vec2 boundary (vec2 uv) {
            return uv;
        }
        void main () {
            float L = texture2D(uPressure, boundary(vL)).x;
            float R = texture2D(uPressure, boundary(vR)).x;
            float T = texture2D(uPressure, boundary(vT)).x;
            float B = texture2D(uPressure, boundary(vB)).x;
            float C = texture2D(uPressure, vUv).x;
            float divergence = texture2D(uDivergence, vUv).x;
            float pressure = (L + R + B + T - divergence) * 0.25;
            gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
        }
    `);

    const gradientSubtractShader = compileShader(gl.FRAGMENT_SHADER, `
        precision mediump float;
        precision mediump sampler2D;
        varying highp vec2 vUv;
        varying highp vec2 vL;
        varying highp vec2 vR;
        varying highp vec2 vT;
        varying highp vec2 vB;
        uniform sampler2D uPressure;
        uniform sampler2D uVelocity;
        vec2 boundary (vec2 uv) {
            return uv;
        }
        void main () {
            float L = texture2D(uPressure, boundary(vL)).x;
            float R = texture2D(uPressure, boundary(vR)).x;
            float T = texture2D(uPressure, boundary(vT)).x;
            float B = texture2D(uPressure, boundary(vB)).x;
            vec2 velocity = texture2D(uVelocity, vUv).xy;
            velocity.xy -= vec2(R - L, T - B);
            gl_FragColor = vec4(velocity, 0.0, 1.0);
        }
    `);

    const blit = (() => {
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(0);

        return (destination) => {
            gl.bindFramebuffer(gl.FRAMEBUFFER, destination);
            gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
        }
    })();

    let simWidth;
    let simHeight;
    let dyeWidth;
    l[Oet dyeHeight;
    let density;
    let velocity;
    let divergence;
    let curl;
    let pressure;
    let bloom;

    let ditheringTexture = createNoiseTexture(256);

    const clearProgram = new GLProgram(baseVertexShader, clearShader);
    const colorProgram = new GLProgram(baseVertexShader, colorShader);
    const backgroundProgram = new GLProgram(baseVertexShader, backgroundShader);
    const displayProgram = new GLProgram(baseVertexShader, displayShader);
    const displayBloomProgram = new GLProgram(baseVertexShader, displayBloomShader);
    const displayShadingProgram = new GLProgram(baseVertexShader, displayShadingShader);
    const displayBloomShadingProgram = new GLProgram(baseVertexShader, displayBloomShadingShader);
    const bloomPrefilterProgram = new GLProgram(baseVertexShader, bloomPrefilterShader);
    const bloomBlurProgram = new GLProgram(baseVertexShader, bloomBlurShader);
    const bloomFinalProgram = new GLProgram(baseVertexShader, bloomFinalShader);
    const splatProgram = new GLProgram(baseVertexShader, splatShader);
    const advectionProgram = new GLProgram(baseVertexShader, ext.supportLinearFiltering ? advectionShader : advectionManualFilteringShader);
    const divergenceProgram = new GLProgram(baseVertexShader, divergenceShader);
    const curlProgram = new GLProgram(baseVertexShader, curlShader);
    const vorticityProgram = new GLProgram(baseVertexShader, vorticityShader);
    const pressureProgram = new GLProgram(baseVertexShader, pressureShader);
    const gradienSubtractProgram = new GLProgram(baseVertexShader, gradientSubtractShader);

    function initFramebuffers() {
        let simRes = getResolution(config.SIM_RESOLUTION);
        let dyeRes = getResolution(config.DYE_RESOLUTION);

        simWidth = simRes.width;
        simHeight = simRes.height;
        dyeWidth = dyeRes.width;
        dyeHeight = dyeRes.height;

        const texType = ext.halfFloatTexType;
        const rgba = ext.formatRGBA;
        const rg = ext.formatRG;
        const r = ext.formatR;
        const filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;

        if (density == null)
            density = createDoubleFBO(dyeWidth, dyeHeight, rgba.internalFormat, rgba.format, texType, filtering);
        else
            density = resizeDoubleFBO(density, dyeWidth, dyeHeight, rgba.internalFormat, rgba.format, texType, filtering);

        if (velocity == null)
            velocity = createDoubleFBO(simWidth, simHeight, rg.internalFormat, rg.format, texType, filtering);
        else
            velocity = resizeDoubleFBO(velocity, simWidth, simHeight, rg.internalFormat, rg.format, texType, filtering);

        divergence = createFBO(simWidth, simHeight, r.internalFormat, r.format, texType, gl.NEAREST);
        curl = createFBO(simWidth, simHeight, r.internalFormat, r.format, texType, gl.NEAREST);
        pressure = createDoubleFBO(simWidth, simHeight, r.internalFormat, r.format, texType, gl.NEAREST);

        initBloomFramebuffers();
    }

    function initBloomFramebuffers() {
        let res = getResolution(config.BLOOM_RESOLUTION);

        const texType = ext.halfFloatTexType;
        const rgba = ext.formatRGBA;
        const filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;

        bloom = createFBO(res.width, res.height, rgba.internalFormat, rgba.format, texType, filtering);

        bloomFramebuffers.length = 0;
        for (let i = 0; i < config.BLOOM_ITERATIONS; i++) {
            let width = res.width >> (i + 1);
            let height = res.height >> (i + 1);

            if (width < 2 || height < 2) break;

            let fbo = createFBO(width, height, rgba.internalFormat, rgba.format, texType, filtering);
            bloomFramebuffers.push(fbo);
        }
    }

    function createFBO(w, h, internalFormat, format, type, param) {
        gl.activeTexture(gl.TEXTURE0);
        let texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);

        let fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        gl.viewport(0, 0, w, h);
        gl.clear(gl.COLOR_BUFFER_BIT);

        return {
            texture,
            fbo,
            width: w,
            height: h,
            attach(id) {
                gl.activeTexture(gl.TEXTURE0 + id);
                gl.bindTexture(gl.TEXTURE_2D, texture);
                return id;
            }
        };
    }

    function createDoubleFBO(w, h, internalFormat, format, type, param) {
        let fbo1 = createFBO(w, h, internalFormat, format, type, param);
        let fbo2 = createFBO(w, h, internalFormat, format, type, param);

        return {
            get read() { return fbo1; },
            set read(value) { fbo1 = value; },
            get write() { return fbo2; },
            set write(value) { fbo2 = value; },
            swap() {
                let temp = fbo1;
                fbo1 = fbo2;
                fbo2 = temp;
            }
        }
    }

    function resizeFBO(target, w, h, internalFormat, format, type, param) {
        let newFBO = createFBO(w, h, internalFormat, format, type, param);
        clearProgram.bind();
        gl.uniform1i( clearProgram.uniforms.uTexture, target.attach(0));
        gl.uniform1f(clearProgram.uniforms.value, 1);
        blit(newFBO.fbo);
        return newFBO;
    }

    function resizeDoubleFBO(target, w, h, internalFormat, format, type, param) {
        target.read = resizeFBO(target.read, w, h, internalFormat, format, type, param);
        target.write = createFBO(w, h, internalFormat, format, type, param);
        return target;
    }

    // Procedural noise for dithering (replaces the external LDR texture).
    function createNoiseTexture(size) {
        const data = new Uint8Array(size * size * 3);
        for (let i = 0; i < data.length; i++)
            data[i] = Math.floor(Math.random() * 256);
        let texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, size, size, 0, gl.RGB, gl.UNSIGNED_BYTE, data);
        return {
            texture,
            width: size,
            height: size,
            attach(id) {
                gl.activeTexture(gl.TEXTURE0 + id);
                gl.bindTexture(gl.TEXTURE_2D, texture);
                return id;
            }
        };
    }

    initFramebuffers();
    // Strong entrance: a dense burst plus several rapid follow-up waves
    // (drained one-per-frame by input() via splatStack).
    multipleSplats(34);
    for (let i = 0; i < 8; i++)
        splatStack.push(10 + parseInt(Math.random() * 10));

    let lastColorChangeTime = Date.now();
    let virtualSeeded = false;
    let orbitAngle = 0;
    let vPrevX = 0, vPrevY = 0;
    let virtualColor = null;
    let lastVColorTime = 0;
    const engineStart = Date.now();
    const ORBIT_RADIUS = 300;      // px — the auto-cursor circles the centre at this radius
    const ORBIT_SPEED = 0.026;     // rad/frame (~4 s per loop)
    const ORBIT_START_DELAY = 700; // ms after load before the auto-cursor begins (burst plays first)

    let rafHandle = 0;
    let destroyed = false;

    update();

    function update() {
        if (destroyed) return;
        resizeCanvas();
        driveVirtualPointer();
        input();
        if (!config.PAUSED)
            step(0.016);
        render(null);
        rafHandle = requestAnimationFrame(update);
    }

    // An invisible auto-cursor orbits the centre FOREVER, independent of the real
    // pointer, splatting bright ink along a gently breathing orbit. Starts a beat
    // after load so the burst plays first.
    function driveVirtualPointer() {
        if (Date.now() - engineStart < ORBIT_START_DELAY)
            return;
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const base = Math.min(ORBIT_RADIUS, canvas.width * 0.35, canvas.height * 0.35);
        const r = base * (0.72 + 0.28 * Math.sin(orbitAngle * 0.37));
        orbitAngle += ORBIT_SPEED;
        const x = cx + Math.cos(orbitAngle) * r;
        const y = cy + Math.sin(orbitAngle) * r;
        if (!virtualSeeded) {
            virtualSeeded = true;
            vPrevX = x;
            vPrevY = y;
            return;
        }
        if (!virtualColor || Date.now() - lastVColorTime > 120) {
            virtualColor = generateColor();
            virtualColor.r *= 3.2;
            virtualColor.g *= 3.2;
            virtualColor.b *= 3.2;
            lastVColorTime = Date.now();
        }
        const dx = (x - vPrevX) * 9.0;
        const dy = (y - vPrevY) * 9.0;
        vPrevX = x;
        vPrevY = y;
        splat(x, y, dx, dy, virtualColor);
    }

    function input() {
        if (splatStack.length > 0)
            multipleSplats(splatStack.pop());

        for (let i = 0; i < pointers.length; i++) {
            const p = pointers[i];
            if (p.moved) {
                splat(p.x, p.y, p.dx, p.dy, p.color);
                p.moved = false;
            }
        }

        if (!config.COLORFUL)
            return;

        if (lastColorChangeTime + 100 < Date.now()) {
            lastColorChangeTime = Date.now();
            for (let i = 0; i < pointers.length; i++) {
                const p = pointers[i];
                p.color = generateColor();
            }
        }
    }

    function step(dt) {
        gl.disable(gl.BLEND);
        gl.viewport(0, 0, simWidth, simHeight);

        curlProgram.bind();
        gl.uniform2f(curlProgram.uniforms.texelSize, 1.0 / simWidth, 1.0 / simHeight);
        gl.uniform1i(curlProgram.uniforms.uVelocity, velocity.read.attach(0));
        blit(curl.fbo);

        vorticityProgram.bind();
        gl.uniform2f(vorticityProgram.uniforms.texelSize, 1.0 / simWidth, 1.0 / simHeight);
        gl.uniform1i(vorticityProgram.uniforms.uVelocity, velocity.read.attach(0));
        gl.uniform1i(vorticityProgram.uniforms.uCurl, curl.attach(1));
        gl.uniform1f(vorticityProgram.uniforms.curl, config.CURL);
        gl.uniform1f(vorticityProgram.uniforms.dt, dt);
        blit(velocity.write.fbo);
        velocity.swap();

        divergenceProgram.bind();
        gl.uniform2f(divergenceProgram.uniforms.texelSize, 1.0 / simWidth, 1.0 / simHeight);
        gl.uniform1i(divergenceProgram.uniforms.uVelocity, velocity.read.attach(0));
        blit(divergence.fbo);

        clearProgram.bind();
        gl.uniform1i(clearProgram.uniforms.uTexture, pressure.read.attach(0));
        gl.uniform1f(clearProgram.uniforms.value, config.PRESSURE_DISSIPATION);
        blit(pressure.write.fbo);
        pressure.swap();

        pressureProgram.bind();
        gl.uniform2f(pressureProgram.uniforms.texelSize, 1.0 / simWidth, 1.0 / simHeight);
        gl.uniform1i(pressureProgram.uniforms.uDivergence, divergence.attach(0));
        for (let i = 0; i < config.PRESSURE_ITERATIONS; i++) {
            gl.uniform1i(pressureProgram.uniforms.uPressure, pressure.read.attach(1));
            blit(pressure.write.fbo);
            pressure.swap();
        }

        gradienSubtractProgram.bind();
        gl.uniform2f(gradienSubtractProgram.uniforms.texelSize, 1.0 / simWidth, 1.0 / simHeight);
        gl.uniform1i(gradienSubtractProgram.uniforms.uPressure, pressure.read.attach(0));
        gl.uniform1i(gradienSubtractProgram.uniforms.uVelocity, velocity.read.attach(1));
        blit(velocity.write.fbo);
        velocity.swap();

        advectionProgram.bind();
        gl.uniform2f(advectionProgram.uniforms.texelSize, 1.0 / simWidth, 1.0 / simHeight);
        if (!ext.supportLinearFiltering)
            gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, 1.0 / simWidth, 1.0 / simHeight);
        let velocityId = velocity.read.attach(0);
        gl.uniform1i(advectionProgram.uniforms.uVelocity, velocityId);
        gl.uniform1i(advectionProgram.uniforms.uSource, velocityId);
        gl.uniform1f(advectionProgram.uniforms.dt, dt);
        gl.uniform1f(advectionProgram.uniforms.dissipation, config.VELOCITY_DISSIPATION);
        blit(velocity.write.fbo);
        velocity.swap();

        gl.viewport(0, 0, dyeWidth, dyeHeight);

        if (!ext.supportLinearFiltering)
            gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, 1.0 / dyeWidth, 1.0 / dyeHeight);
        gl.uniform1i(advectionProgram.uniforms.uVelocity, velocity.read.attach(0));
        gl.uniform1i(advectionProgram.uniforms.uSource, density.read.attach(1));
        gl.uniform1f(advectionProgram.uniforms.dissipation, config.DENSITY_DISSIPATION);
        blit(density.write.fbo);
        density.swap();
    }

    function render(target) {
        if (config.BLOOM)
            applyBloom(density.read, bloom);

        if (target == null || !config.TRANSPARENT) {
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            gl.enable(gl.BLEND);
        }
        else {
            gl.disable(gl.BLEND);
        }

        let width = target == null ? gl.drawingBufferWidth : dyeWidth;
        let height = target == null ? gl.drawingBufferHeight : dyeHeight;

        gl.viewport(0, 0, width, height);

        if (!config.TRANSPARENT) {
            colorProgram.bind();
            let bc = config.BACK_COLOR;
            gl.uniform4f(colorProgram.uniforms.color, bc.r / 255, bc.g / 255, bc.b / 255, 1);
            blit(target);
        }

        if (target == null && config.TRANSPARENT) {
            backgroundProgram.bind();
            gl.uniform1f(backgroundProgram.uniforms.aspectRatio, canvas.width / canvas.height);
            blit(null);
        }

        if (config.SHADING) {
            let program = config.BLOOM ? displayBloomShadingProgram : displayShadingProgram;
            program.bind();
            gl.uniform2f(program.uniforms.texelSize, 1.0 / width, 1.0 / height);
            gl.uniform1i(program.uniforms.uTexture, density.read.attach(0));
            if (config.BLOOM) {
                gl.uniform1i(program.uniforms.uBloom, bloom.attach(1));
                gl.uniform1i(program.uniforms.uDithering, ditheringTexture.attach(2));
                let scale = getTextureScale(ditheringTexture, width, height);
                gl.uniform2f(program.uniforms.ditherScale, scale.x, scale.y);
            }
        }
        else {
            let program = config.BLOOM ? displayBloomProgram : displayProgram;
            program.bind();
            gl.uniform1i(program.uniforms.uTexture, density.read.attach(0));
            if (config.BLOOM) {
                gl.uniform1i(program.uniforms.uBloom, bloom.attach(1));
                gl.uniform1i(program.uniforms.uDithering, ditheringTexture.attach(2));
                let scale = getTextureScale(ditheringTexture, width, height);
                gl.uniform2f(program.uniforms.ditherScale, scale.x, scale.y);
            }
        }

        blit(target);
    }

    function applyBloom(source, destination) {
        if (bloomFramebuffers.length < 2)
            return;

        let last = destination;

        gl.disable(gl.BLEND);
        bloomPrefilterProgram.bind();
        let knee = config.BLOOM_THRESHOLD * config.BLOOM_SOFT_KNEE + 0.0001;
        let curve0 = config.BLOOM_THRESHOLD - knee;
        let curve1 = knee * 2;
        let curve2 = 0.25 / knee;
        gl.uniform3f(bloomPrefilterProgram.uniforms.curve, curve0, curve1, curve2);
        gl.uniform1f(bloomPrefilterProgram.uniforms.threshold, config.BLOOM_THRESHOLD);
        gl.uniform1i(bloomPrefilterProgram.uniforms.uTexture, source.attach(0));
        gl.viewport(0, 0, last.width, last.height);
        blit(last.fbo);

        bloomBlurProgram.bind();
        for (let i = 0; i < bloomFramebuffers.length; i++) {
            let dest = bloomFramebuffers[i];
            gl.uniform2f(bloomBlurProgram.uniforms.texelSize, 1.0 / last.width, 1.0 / last.height);
            gl.uniform1i(bloomBlurProgram.uniforms.uTexture, last.attach(0));
            gl.viewport(0, 0, dest.width, dest.height);
            blit(dest.fbo);
            last = dest;
        }

        gl.blendFunc(gl.ONE, gl.ONE);
        gl.enable(gl.BLEND);

        for (let i = bloomFramebuffers.length - 2; i >= 0; i--) {
            let baseTex = bloomFramebuffers[i];
            gl.uniform2f(bloomBlurProgram.uniforms.texelSize, 1.0 / last.width, 1.0 / last.height);
            gl.uniform1i(bloomBlurProgram.uniforms.uTexture, last.attach(0));
            gl.viewport(0, 0, baseTex.width, baseTex.height);
            blit(baseTex.fbo);
            last = baseTex;
        }

        gl.disable(gl.BLEND);
        bloomFinalProgram.bind();
        gl.uniform2f(bloomFinalProgram.uniforms.texelSize, 1.0 / last.width, 1.0 / last.height);
        gl.uniform1i(bloomFinalProgram.uniforms.uTexture, last.attach(0));
        gl.uniform1f(bloomFinalProgram.uniforms.intensity, config.BLOOM_INTENSITY);
        gl.viewport(0, 0, destination.width, destination.height);
        blit(destination.fbo);
    }

    function splat(x, y, dx, dy, color) {
        gl.viewport(0, 0, simWidth, simHeight);
        splatProgram.bind();
        gl.uniform1i(splatProgram.uniforms.uTarget, velocity.read.attach(0));
        gl.uniform1f(splatProgram.uniforms.aspectRatio, canvas.width / canvas.height);
        gl.uniform2f(splatProgram.uniforms.point, x / canvas.width, 1.0 - y / canvas.height);
        gl.uniform3f(splatProgram.uniforms.color, dx, -dy, 1.0);
        gl.uniform1f(splatProgram.uniforms.radius, config.SPLAT_RADIUS / 100.0);
        blit(velocity.write.fbo);
        velocity.swap();

        gl.viewport(0, 0, dyeWidth, dyeHeight);
        gl.uniform1i(splatProgram.uniforms.uTarget, density.read.attach(0));
        gl.uniform3f(splatProgram.uniforms.color, color.r, color.g, color.b);
        blit(density.write.fbo);
        density.swap();
    }

    function multipleSplats(amount) {
        for (let i = 0; i < amount; i++) {
            const color = generateColor();
            color.r *= 10.0;
            color.g *= 10.0;
            color.b *= 10.0;
            const x = canvas.width * Math.random();
            const y = canvas.height * Math.random();
            const dx = 1000 * (Math.random() - 0.5);
            const dy = 1000 * (Math.random() - 0.5);
            splat(x, y, dx, dy, color);
        }
    }

    function resizeCanvas() {
        if (canvas.width != canvas.clientWidth || canvas.height != canvas.clientHeight) {
            canvas.width = canvas.clientWidth;
            canvas.height = canvas.clientHeight;
            initFramebuffers();
        }
    }

    // The canvas renders BEHIND page content, so pointer data is read from window
    // events and mapped into canvas space via its bounding rect. Listeners are
    // passive and never preventDefault, so page scroll is untouched.
    function pointerPos(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        return { x: clientX - rect.left, y: clientY - rect.top };
    }

    const teardown = [];
    function on(target, type, handler, opts) {
        target.addEventListener(type, handler, opts);
        teardown.push(() => target.removeEventListener(type, handler, opts));
    }

    on(window, 'mousemove', e => {
        const { x, y } = pointerPos(e.clientX, e.clientY);
        const p = pointers[0];
        if (!p.everMoved) {
            p.everMoved = true;
            p.x = x;
            p.y = y;
            p.down = true;
            return;
        }
        p.down = true;
        p.moved = true;
        p.dx = (x - p.x) * 5.0;
        p.dy = (y - p.y) * 5.0;
        p.x = x;
        p.y = y;
        p.color = generateColor();
    });

    on(window, 'touchmove', e => {
        const touches = e.targetTouches;
        for (let i = 0; i < touches.length; i++) {
            if (i >= pointers.length)
                pointers.push(new pointerPrototype());
            const p = pointers[i];
            const { x, y } = pointerPos(touches[i].clientX, touches[i].clientY);
            p.down = true;
            p.moved = p.everMoved === true;
            p.everMoved = true;
            p.dx = (x - p.x) * 8.0;
            p.dy = (y - p.y) * 8.0;
            p.x = x;
            p.y = y;
        }
    }, { passive: true });

    on(window, 'touchstart', e => {
        const touches = e.targetTouches;
        for (let i = 0; i < touches.length; i++) {
            if (i >= pointers.length)
                pointers.push(new pointerPrototype());
            const p = pointers[i];
            const { x, y } = pointerPos(touches[i].clientX, touches[i].clientY);
            p.id = touches[i].identifier;
            p.down = true;
            p.x = x;
            p.y = y;
            p.color = generateColor();
        }
    }, { passive: true });

    on(window, 'mouseup', () => {
        pointers[0].down = false;
    });

    on(window, 'touchend', e => {
        const touches = e.changedTouches;
        for (let i = 0; i < touches.length; i++)
            for (let j = 0; j < pointers.length; j++)
                if (touches[i].identifier == pointers[j].id)
                    pointers[j].down = false;
    });

    return function destroy() {
        destroyed = true;
        if (rafHandle) cancelAnimationFrame(rafHandle);
        for (const off of teardown) off();
    };

    function generateColor() {
        // Electric cyan→blue→violet→magenta band, full brightness, for a vivid,
        // slick, immersive palette.
        const h = 0.5 + Math.random() * 0.42;
        let c = HSVtoRGB(h, 0.95, 1.0);
        c.r *= 0.92;
        c.g *= 0.92;
        c.b *= 0.92;
        return c;
    }

    function HSVtoRGB(h, s, v) {
        let r, g, b, i, f, p, q, t;
        i = Math.floor(h * 6);
        f = h * 6 - i;
        p = v * (1 - s);
        q = v * (1 - f * s);
        t = v * (1 - (1 - f) * s);

        switch (i % 6) {
            case 0: r = v, g = t, b = p; break;
            case 1: r = q, g = v, b = p; break;
            case 2: r = p, g = v, b = t; break;
            case 3: r = p, g = q, b = v; break;
            case 4: r = t, g = p, b = v; break;
            case 5: r = v, g = p, b = q; break;
        }
        return { r, g, b };
    }

    function getResolution(resolution) {
        let aspectRatio = gl.drawingBufferWidth / gl.drawingBufferHeight;
        if (aspectRatio < 1)
            aspectRatio = 1.0 / aspectRatio;

        let max = Math.round(resolution * aspectRatio);
        let min = Math.round(resolution);

        if (gl.drawingBufferWidth > gl.drawingBufferHeight)
            return { width: max, height: min };
        else
            return { width: min, height: max };
    }

    function getTextureScale(texture, width, height) {
        return { x: width / texture.width, y: height / texture.height };
    }
}
```

Mount it after DOM ready:
```js
const canvas = document.querySelector("canvas");
if (canvas) fluidSimulation(canvas);
```
The canvas must have real pixel size — give it `width:100%;height:100%` via CSS and the engine reads
`clientWidth/clientHeight`. It resizes itself each frame.

## Fixed parameters (bake these in)

- **Copy:** brand `Flowstate`; nav links `How it works? / Pricing / Products / Blog`; nav CTA
  `Get Started`; badge `10K+ already in flow`; heading `Deep Work in a Distracted World`; sub-line
  `Cut through the noise, reclaim your attention, and do work that truly matters.`; email placeholder
  `Enter your email`; submit `Join Waitlist`; footer `© 2026 Flowstate — engineered for deep work.`
- **Fluid config (already in the engine):** SIM_RESOLUTION 200, DYE_RESOLUTION 512,
  DENSITY_DISSIPATION 0.958, VELOCITY_DISSIPATION 0.96, PRESSURE_DISSIPATION 0.8,
  PRESSURE_ITERATIONS 20, CURL 42, SPLAT_RADIUS 0.22, SHADING true, COLORFUL true, BLOOM false,
  BACK_COLOR (4,5,12). Load burst: `multipleSplats(34)` + 8 queued waves. Auto-cursor: ORBIT_RADIUS
  300, ORBIT_SPEED 0.026 rad/frame, ORBIT_START_DELAY 700ms, breathing `0.72 + 0.28*sin(angle*0.37)`.
  Ink hue band `0.5 + random*0.42`, sat 0.95, val 1.0.
- **Colors:** as in the CSS custom-properties block above.
- **Reveal delays (ms):** nav 150, badge 320, heading 480, sub-line 1150, form 1450, footer 1650.
  Heading word stagger 85ms / dur 720ms / from y+26px; sub-line word stagger 22ms / dur 600ms /
  from y+14px; block reveals ~700ms `cubic-bezier(0.2,0,0,1)`.
- **Breakpoints:** sm = 640px, plus the ≥1024px and ≥1440px/1920px root-font-size steps above.
- **Type:** Onest, weights 400 / 500.

## Assets

None. (Fonts load from Google Fonts; the dithering texture is generated procedurally in-engine; no
models, images, or video.)

---

# 日本語訳

> 以下は上のプロンプトの日本語版です。スクリプト部分（WebGL 流体エンジン本体）は英文側にのみ掲載しています（実装時に英文をそのまま参照させるため）。日本語訳は仕様部分のみ。

## このサイトを一つの HTML ファイルとして再現する: Flowstate

あなたは熟練のクリエイティブ系フロントエンド開発者である。下のプロジェクトを **そのまま** レイアウト・ビジュアル・モーション・インタラクション含めて再現した **自己完結型の単一 `index.html`** を生成しなさい。ビルドステップなし、フレームワークなし、バンドラーなし。純粋な HTML/CSS/JS を 1 ファイルに収めること。プレーン DOM とバニラ JS のみを使い、外部依存は Google Fonts ( `<link>` 経由) と Lenis スムーズスクロールライブラリ (CDN ES モジュール import 経由) のみ。仕様中の値はすべて定数としてハードコードする。下記コンポーネントは 1 ファイル内のブロックとして再構築する。

## 概要

フルビューポートの没入型 **ダークヒーロー** — **Flowstate** というディープワーク / 集中アプリ用のウェイトリスト LP。背景全体にフルブリードの **WebGL 流体シミュレーション** (油絵のような "インク水中") が広がり、ロード時に鮮やかな色でバーストし、以後は不可視の自動カーソルがセンターを **永遠に** 周回し、シアン→ブルー→バイオレット→マゼンタの明るいインクを描き続ける (渦を巻いては消える)。実マウス / タッチも流体を攪拌する。中央にはテキスト可読性のための柔らかい放射状スクリム。その上に中央カラム — ガラスバッジピル、**単語単位**で現れる大きな見出し、単語単位のサブテキスト、ガラスの "ウェイトリスト参加" メールバー — と、トップナビ (ブランド + ガラスリンクピル + ソリッド白 CTA ピル) とフッターライン。すべてがロード時にソフトスプリングで **スタagger しながら出現する**。ベースはニアブラック `#04050c`、テキストは明るいフォグホワイト。書体は **Onest**。

セクションは **ヒーローのみ 1 つ** で `100lvh` を埋める。スムーズスクロールは Lenis で配線するが、ページは 1 画面なのでスクロール自体は実質的に動かない — parity のために Lenis は残す。

## ページシェルとライブラリ

- **フォント:** Onest を Google Fonts から — `<link href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500&display=swap" rel="stylesheet">`。`body` に `font-family: "Onest", sans-serif` を適用。使用ウェイトは 400 (本文) と 500 (ミディアム — ブランド、見出し、ボタン、バッジ)。
- **スムーズスクロール:** Lenis 1.3.x を importmap で。
  ```html
  <script type="importmap">{ "imports": { "lenis": "https://unpkg.com/lenis@1.3.19/dist/lenis.mjs" } }</script>
  ```
  module script 内で: `import Lenis from "lenis"; const lenis = new Lenis({ smoothWheel: true }); function raf(t){ lenis.raf(t); requestAnimationFrame(raf); } requestAnimationFrame(raf);`
- **CSS リセット:** `* { margin:0; box-sizing:border-box; }`、anchor/button のデフォルトスタイルを除去、`body { background: var(--hero-base); color: var(--heading); overflow-x: hidden; }`。
- **アダプティブ rem グリッド (重要 — レイアウト全体が rem ベースでビューポートにスケールする)。**
  rem ベースレイアウトが比率を保つよう、ルート font-size をレスポンシブに設定する。
  ブレイクポイントはマークアップで `sm` = **640px** (min-width) 形式; "sm:" の付いた値は ≥640px ブランチ、それ以外は <640px として扱う。

### CSS カスタムプロパティ (色 — 正確に焼き付ける)

```css
:root {
  --hero-base:            #04050c;   /* シェーダーの後ろのベース */
  --heading:             #eef0f6;   /* 明るい見出し / 入力テキスト */
  --body-muted:          #b9becf;   /* 本文、ナビリンク、バッジ、フッター */
  --on-media:            #ffffff;   /* シェーダー上に乗るブランドテキスト/アイコン */
  --action-inverse:      #ffffff;   /* 白ピルボタンの背景 */
  --action-inverse-fg:   #2f2f33;   /* 白ピルに乗る暗いテキスト */
  --glass-fill:          rgba(255,255,255,0.08);
  --glass-border:        rgba(255,255,255,0.16);
  --scrim:               rgba(4,5,12,0.46);
  --scrim-strong:        rgba(4,5,12,0.68);
  --scrim-soft:          rgba(4,5,12,0.12);
  --duration-fast:       150ms;
  --ease-entrance:       cubic-bezier(0.2, 0, 0, 1);
}
```

## レイアウトとセクション (順序)

ルート `<section>` — `position:relative; display:flex; flex-direction:column; align-items:center;
justify-content:center; min-height:100lvh; width:100vw; overflow:hidden; background:var(--hero-base);
text-align:center; padding: 0 1.25rem;` (≥640px: padding `0 2.5rem`)。

**1. 流体キャンバス (z-0).** `<canvas aria-hidden="true">` を `inset:0; width:100%; height:100%;
z-index:0; pointer-events:none;` で絶対配置。WebGL 流体エンジンを走らせる (下記 "WebGL シーン")。

**2. スクリム (z-1).** `aria-hidden` div を `position:absolute; inset:0; z-index:1; pointer-events:none;`、
この背景:
```css
background: radial-gradient(115% 95% at 50% 46%,
  var(--scrim-strong) 0%, var(--scrim-strong) 24%, var(--scrim) 52%, var(--scrim-soft) 100%);
```

**3. トップナビ (`<header>`, z-20).** `position:absolute; inset-inline:0; top:0; display:flex;
align-items:center; justify-content:space-between; padding:1.25rem;` (≥640px `padding:1.75rem 2.5rem`)。
最初のスタガーとして出現。
- **左 — ブランドリンク** `/` へ: `display:flex; align-items:center; gap:0.6rem; font-weight:500;
  font-size:1.15rem` (≥640px `1.375rem`); color `var(--on-media)`; `letter-spacing:-0.01em`。要素:
  - **ブランドグリフ** (インライン SVG、`1.35rem` 角、≥640px `1.5rem`、`stroke:currentColor`) — 流体の
    二重波: 仕様記載のパスそのまま
  - 単語 **Flowstate**
- **中央 — ガラスリンクピル** (640px 未満は非表示、≥640px で `display:flex`): 仕様記載どおり
  4 リンク (**How it works?** `#how-it-works`、**Pricing** `#pricing`、**Products** `#products`、
  **Blog** `#blog`)。
- **右 — CTA ピルボタン** (共通白ピル仕様、後述) ラベル **Get Started**、href `#get-started`。

**4. 中央カラム (z-10).** `position:relative; z-index:10; display:flex; flex-direction:column;
align-items:center; width:100%; max-width:22rem;` (≥640px `40rem`, ≥1024px `52rem`)。順番に:
  - **バッジピル** (`<p>`): 仕様記載どおり、テキスト **10K+ already in flow**
  - **見出し** (`<h1>`) — テキスト **"Deep Work in a Distracted World"**、**単語単位**で出現。
    仕様記載のマージン・最大幅・フォントサイズ・ウェイト・行高・字間・色。
  - **サブ行** (`<p>`) — テキスト **"Cut through the noise, reclaim your attention, and do work that
    truly matters."**、単語単位で出現。仕様記載どおり。
  - **ウェイトリストフォーム** (margin-top `1.75rem`、≥640px `2.5rem`; form は `width:37rem;
    max-width:100%`)。中はガラスバー (`height:3.5rem` ≥640px `4rem`)。仕様どおり、`<input type="email"
    required placeholder="Enter your email">` と白 **Join Waitlist** サブミットピル。送信時:
    `preventDefault()` で no-op (バックエンドなし)。

**5. フッター (`<footer>`, z-20).** `position:absolute; inset-inline:0; bottom:0; display:flex;
justify-content:center; padding:1.25rem` (≥640px `1.5rem 2.5rem`); `font-size:0.72rem` (≥640px `0.8rem`)、
color `var(--body-muted)`。テキスト **© 2026 Flowstate — engineered for deep work.**

**共通白ピルボタン** (Get Started / Join Waitlist で共用):
仕様記載どおり。`height:2.5rem` (≥640px `2.75rem`)、`border-radius:9999px; background:var(--action-inverse)`、
hover で `rgba(255,255,255,0.85)`、focus-visible で `outline:none; box-shadow:0 0 0 2px rgba(255,255,255,.7)`。

## ローダー / リビール (プレビューが捉えるヒーローの瞬間)

専用のローダーオーバーレイは **ない**。「リビール」は (a) 流体の **ロードバースト** と (b) コンテンツの
**スタガー出現** の組み合わせで、どちらもページロード時に発火する。

- **流体ロードバースト:** エンジン開始と同時に `multipleSplats(34)` (ランダムな 34 個の明るい
  インクしぶき) を発射し、**8** 波の高速フォローアップをキューに積む (`splatStack.push(10 + random*10)`、
  1 フレームに 1 個ずつ排出)。約 700ms 後に不可視の自動カーソルが永遠の軌道を開始。これはエンジンに
  焼き込まれているので変更しない。
- **コンテンツスタガー:** 各ブロックを `opacity:0` + 小さな translate から `opacity:1` + `translate:0` へ、
  ソフトスプリング (テンション 120 / フリクション 24 のスプリング ≈ ~700ms `cubic-bezier(0.2,0,0,1)`
  で代用可) で動かし、以下の **ロード後の遅延** (ms) を使用:

  | ブロック | 遅延 | from-transform | リビールスタイル |
  |---|---|---|---|
  | Nav (header) | 150 | `translateY(-0.75rem)` | バー全体がフェード / スライド |
  | Badge pill | 320 | `translateY(1.25rem)` | 一括フェード / スライドアップ |
  | 見出し | 480 | 単語単位 | **単語単位**: 各単語 `translateY(26px)→0`、`opacity 0→1`、**stagger 85ms**、単語あたり **720ms**、easeOutCubic |
  | サブ行 | 1150 | 単語単位 | **単語単位**: 各単語 `translateY(14px)→0`、`opacity 0→1`、**stagger 22ms**、単語あたり **600ms**、easeOutCubic |
  | ウェイトリストフォーム | 1450 | `translateY(1.25rem)` | 一括フェード / スライドアップ |
  | フッター | 1650 | `translateY(1.25rem)` | 一括フェード / スライドアップ |

  単語単位リビールは、見出し / サブ行のテキストをスペースで分割し、各単語を `inline-block` の
  span で囲む (単語間に末尾スペースを入れて自然な改行を許可)。各 span の `transition-delay =
  baseDelay + wordIndex * stagger` を設定する。見出しの `line-height` は 1.1 を下限として保ち、
  ディセンダがクリップされないようにする。

## WebGL シーン — 流体インクシミュレーション (これがエフェクト本体。逐語的に再現)

フルブリードの GPU 流体ソルバー (Pavel Dobryakov の WebGL 流体シミュレーション、MIT) を、油絵的・
大理石風・ニアブラック上に鮮やかなルックに調整済み。背景の `<canvas>` にマウントし、DOM 準備完了
後に `fluidSimulation(canvas)` を 1 回呼ぶ。エンジンは自身の `requestAnimationFrame` ループを
所有し、ポインタ入力を **window** イベントから読む (canvas はコンテンツの後ろで `pointer-events:none`
なので、`clientX/Y` を `getBoundingClientRect()` で canvas 空間へ写像する)。エンジンを **逐語的に**
貼り付けること (plain JS。元のコードからの変更点は: 調整済み `config`、強いロードバースト、
`generateColor` のシアン→マゼンタバンド、センターを永遠に周回する不可視自動カーソル)。
実装コードは本ファイル英文側を参照。

DOM 準備完了後にマウント:
```js
const canvas = document.querySelector("canvas");
if (canvas) fluidSimulation(canvas);
```
canvas は実ピクセルサイズを持つ必要がある。CSS で `width:100%;height:100%` を当て、エンジンは
`clientWidth/clientHeight` を読む。毎フレーム自動でリサイズされる。

## 固定パラメータ (そのまま焼き込む)

- **コピー:** ブランド `Flowstate`; ナビリンク `How it works? / Pricing / Products / Blog`;
  ナビ CTA `Get Started`; バッジ `10K+ already in flow`; 見出し `Deep Work in a Distracted World`;
  サブ行 `Cut through the noise, reclaim your attention, and do work that truly matters.`;
  メールプレースホルダ `Enter your email`; サブミット `Join Waitlist`;
  フッター `© 2026 Flowstate — engineered for deep work.`
- **流体 config (エンジンに記載済):** SIM_RESOLUTION 200、DYE_RESOLUTION 512、
  DENSITY_DISSIPATION 0.958、VELOCITY_DISSIPATION 0.96、PRESSURE_DISSIPATION 0.8、
  PRESSURE_ITERATIONS 20、CURL 42、SPLAT_RADIUS 0.22、SHADING true、COLORFUL true、BLOOM false、
  BACK_COLOR (4,5,12)。ロードバースト: `multipleSplats(34)` + 8 波キュー。自動カーソル:
  ORBIT_RADIUS 300、ORBIT_SPEED 0.026 rad/frame、ORBIT_START_DELAY 700ms、
  ブリージング `0.72 + 0.28*sin(angle*0.37)`。インク色相バンド `0.5 + random*0.42`、sat 0.95、val 1.0。
- **色:** 上記 CSS カスタムプロパティのとおり。
- **リビール遅延 (ms):** nav 150、badge 320、heading 480、sub-line 1150、form 1450、footer 1650。
  見出しの単語 stagger 85ms / dur 720ms / from y+26px; サブ行の単語 stagger 22ms / dur 600ms /
  from y+14px; ブロックリビール ~700ms `cubic-bezier(0.2,0,0,1)`。
- **ブレイクポイント:** sm = 640px、加えて ≥1024px / ≥1440px / ≥1920px のルート font-size 段階。
- **書体:** Onest、ウェイト 400 / 500。

## アセット

なし (フォントは Google Fonts からロード、ディザリングテクスチャはエンジン内で手続き的に生成、
モデル / 画像 / 動画なし)。

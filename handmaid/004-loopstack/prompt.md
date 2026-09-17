# Recreate this site as a single HTML file: Loopstack

You are an expert creative front-end developer. Produce a **single self-contained `index.html`** that reproduces the project below **exactly** — same layout, sections, visuals, motion, and interaction. Pure HTML/CSS/JS in one file: no build step, no framework, no bundler. You may inline all CSS in a `<style>` tag and all JS in a `<script>` tag at the end of `<body>`. Load fonts from their CDNs. Hardcode every value given here as a fixed constant. Rebuild each component described below as a section of the one file.

## What it is

A full-viewport, single-screen "footer hero" landing moment on a pure black background. A looping flower video fills the bottom 90% of the screen, with a soft black radial gradient bleeding in from the top to fade the video into the page. Centered near the top is a serif headline and a pill "Book a demo" button with a pulsing neon-green status dot. A fixed footer block sits centered at the vertical middle of the screen ("Stay in Touch" / "Think. Build. Repeat." over a thin divider, with social icons, nav links, and a copyright). A massive "Loopstack" wordmark is pinned across the very bottom. On load: the headline reveals word-by-word (slide up + un-blur from a mask) and the giant wordmark reveals letter-by-letter (slide in from the left + un-blur). A custom cursor follows the pointer — an outlined ring that tracks instantly plus a lagging glassmorphism pill reading "SAY HELLO!"; hovering the button hides the pill and expands the ring. The page does not scroll (it is one fixed screen). Everything is white text on black with a single neon-green accent `#39FF14`.

## Page shell & libraries

- No JS libraries. Everything is hand-rolled vanilla JS + CSS.
- `<html lang="ru">`, `<head>` with `<meta charset="UTF-8">` and `<meta name="viewport" content="width=device-width, initial-scale=1.0">`, `<title>Loopstack</title>`.
- Fonts, loaded via two `@import` rules at the very top of the CSS:
  ```css
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600&family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap');
  @import url('https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600&display=swap');
  ```
  Three families are used: **Playfair Display** (serif headline), **Outfit** (button, links, copyright), **General Sans** (footer titles, big wordmark, cursor pill).
- Global reset and page model:
  ```css
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
      background-color: #000000;
      min-height: 100vh;
      overflow: hidden;
      position: relative;
  }
  ```
  Note `overflow: hidden` — the page is a single non-scrolling screen.

## Layout & sections (in order)

The DOM body order is exactly: top gradient image, hero `<main>`, footer `<footer>`, big logo wordmark wrapper, video container, cursor ring, glass cursor card.

### 1. Top gradient overlay

A soft, blurred black blob SVG pinned to the top, fixed, full width, overlaying the video to fade it into the black page. Source it from the Assets bucket (see Assets).

```html
<img src="ASSET_BASE_URL/black_gradient.svg" alt="Top Gradient" id="top-gradient">
```
```css
#top-gradient {
    position: fixed;
    top: -30vh;            /* pushed well above the top edge */
    left: 0;
    width: 100vw;
    height: auto;
    display: block;
    z-index: 0;            /* above the video container (z-index: -1) */
    pointer-events: none;  /* clicks pass through */
}
```

### 2. Hero content (headline + button)

```html
<main class="hero-content">
    <h1 class="hero-title">Apply Now to be part <br> of the closed beta</h1>
    <button class="hero-btn">
        <span class="btn-text">Book a demo</span>
        <span class="blinking-dot"></span>
    </button>
</main>
```
Copy is verbatim: headline `Apply Now to be part` / (line break) / `of the closed beta`; button label `Book a demo`.

```css
.hero-content {
    position: relative;
    z-index: 2;            /* above video and top gradient */
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding-top: 6vh;
    width: 95%;
    max-width: 1100px;
    margin: 0 auto;
}

.hero-title {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 2.8rem;
    font-weight: 400;
    color: #ffffff;
    line-height: 1.15;
    margin-bottom: 2.2rem;
    letter-spacing: -0.015em;
    text-shadow: 0 4px 30px rgba(0, 0, 0, 0.5);
}

.hero-btn {
    font-family: 'Outfit', sans-serif;
    font-size: 1.1rem;
    font-weight: 500;
    letter-spacing: 0.02em;
    color: #ffffff;
    background-color: #000000;
    border: 1px solid rgba(255, 255, 255, 0.18);
    padding: 1.3rem 2.5rem;
    border-radius: 9999px;
    display: inline-flex;
    align-items: center;
    gap: 0.9rem;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 0 4px 25px rgba(0, 0, 0, 0.4);
    outline: none;
}
.hero-btn:hover {
    background-color: #ffffff;
    color: #000000;
    border-color: #ffffff;
    transform: translateY(-2px);
    box-shadow: 0 6px 30px rgba(0, 0, 0, 0.3);
}
.hero-btn:active {
    transform: translateY(0);
}
```

The blinking neon dot (inside the button, after the label) with a pulsing glow and an expanding outer wave:

```css
.blinking-dot {
    width: 10px;
    height: 10px;
    background-color: #39FF14;
    border-radius: 50%;
    position: relative;
    display: inline-block;
    animation: pulse-glow 2s infinite ease-in-out;
}
.blinking-dot::after {
    content: '';
    position: absolute;
    top: -5px; left: -5px; right: -5px; bottom: -5px;
    background-color: rgba(57, 255, 20, 0.45);
    border-radius: 50%;
    animation: wave-expand 2s infinite ease-in-out;
}
@keyframes pulse-glow {
    0%, 100% {
        opacity: 0.5;
        transform: scale(0.85);
        box-shadow: 0 0 4px rgba(57, 255, 20, 0.3);
    }
    50% {
        opacity: 1;
        transform: scale(1.1);
        box-shadow: 0 0 12px rgba(57, 255, 20, 0.9);
    }
}
@keyframes wave-expand {
    0%   { transform: scale(0.6); opacity: 0.9; }
    100% { transform: scale(2.3); opacity: 0; }
}
```

### 3. Footer block (fixed, vertically centered)

```html
<footer class="footer-container">
    <div class="footer-top">
        <h2 class="footer-title">Stay in Touch</h2>
        <h2 class="footer-title quote">Think. Build. Repeat.</h2>
    </div>

    <hr class="footer-divider">

    <div class="footer-bottom">
        <div class="footer-socials">
            <a href="#" aria-label="LinkedIn" class="social-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>
            </a>
            <a href="#" aria-label="X" class="social-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4l11.733 16h4.267l-11.733 -16z"></path><path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772"></path></svg>
            </a>
            <a href="#" aria-label="Instagram" class="social-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
            </a>
        </div>

        <nav class="footer-links">
            <a href="#about" class="footer-link">About</a>
            <a href="#features" class="footer-link">Features</a>
            <a href="#pricing" class="footer-link">Pricing</a>
            <a href="#contact" class="footer-link">Contact</a>
        </nav>

        <div class="footer-copyright">
            © 2026 Loopstack
        </div>
    </div>
</footer>
```
Copy verbatim: footer titles `Stay in Touch` and `Think. Build. Repeat.`; nav links `About`, `Features`, `Pricing`, `Contact`; copyright `© 2026 Loopstack`. Three social icons in order LinkedIn, X, Instagram with the exact inline SVG paths above.

```css
.footer-container {
    position: fixed;
    top: 50vh;
    left: 20px;
    right: 20px;
    width: calc(100vw - 40px);
    transform: translateY(-50%);   /* exactly screen-centered vertically */
    z-index: 3;                    /* above every other layer */
    display: flex;
    flex-direction: column;
}
.footer-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    width: 100%;
    padding: 0 5px;
}
.footer-title {
    font-family: 'General Sans', -apple-system, sans-serif;
    font-size: 1.4rem;
    font-weight: 400;
    color: #ffffff;
    letter-spacing: -0.015em;
    margin: 0;
}
.footer-title.quote {
    text-transform: none;
}
.footer-divider {
    border: none;
    height: 1px;
    background-color: rgba(255, 255, 255, 0.2);
    margin: 1.6rem 0;
    width: 100%;
}
.footer-bottom {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 0 5px;
}
.footer-socials {
    display: flex;
    gap: 1.25rem;
    align-items: center;
    flex: 1;
}
.social-icon {
    color: rgba(255, 255, 255, 0.55);
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
}
.social-icon:hover {
    color: #ffffff;
    transform: translateY(-2px);
}
.footer-links {
    display: flex;
    gap: 2.8rem;
    justify-content: center;
    align-items: center;
    flex: 2;
}
.footer-link {
    font-family: 'Outfit', sans-serif;
    font-size: 0.95rem;
    font-weight: 400;
    color: #ffffff;
    text-decoration: none;
    letter-spacing: 0.03em;
    transition: opacity 0.3s ease, transform 0.3s ease;
}
.footer-link:hover {
    opacity: 0.75;
    transform: translateY(-1px);
}
.footer-copyright {
    font-family: 'Outfit', sans-serif;
    font-size: 0.95rem;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.45);
    text-align: right;
    flex: 1;
    letter-spacing: 0.02em;
}
```

### 4. Giant "Loopstack" wordmark (pinned to bottom)

```html
<div class="footer-logo-wrap">
    <h2 class="footer-logo-text">Loopstack</h2>
</div>
```
Text verbatim: `Loopstack` (9 letters).

```css
.footer-logo-wrap {
    position: fixed;
    bottom: 20px;
    left: 0;
    right: 0;
    width: 100%;
    padding: 0 20px;
    box-sizing: border-box;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 3;
    margin: 0;
}
.footer-logo-text {
    font-family: 'General Sans', -apple-system, sans-serif;
    font-size: 21.9vw;             /* enormous, fills the width */
    font-weight: 400;
    color: #ffffff;
    letter-spacing: -0.03em;
    margin-right: -0.03em;
    transform: translateX(-20px);
    line-height: 0.8;
    margin-top: 0;
    margin-bottom: 0;
    margin-left: 0;
    text-align: center;
    width: 100%;
    pointer-events: none;
    opacity: 0.95;
    text-shadow: none;
    white-space: nowrap;
}
```

### 5. Background flower video

```html
<div class="video-container">
    <video autoplay muted playsinline id="bg-video">
        <source src="ASSET_BASE_URL/flower.mp4" type="video/mp4">
        Ваш браузер не поддерживает видео.
    </video>
</div>
```
```css
.video-container {
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100vw;
    height: 90vh;          /* occupies bottom 90% of viewport */
    overflow: hidden;
    z-index: -1;           /* sits behind everything */
}
#bg-video {
    width: 100%;
    height: 110%;
    object-fit: cover;
    display: block;
    transform: translateY(0%);
}
```
Add `loop` so it cycles seamlessly (autoplay/muted/playsinline are present for mobile autoplay).

### 6. Custom cursor elements

```html
<div id="cursor-ring" class="cursor-ring-outline"></div>

<div id="glass-card" class="glass-cursor-card">
    <span class="cursor-card-text"><span class="text-white">Say</span> Hello!</span>
</div>
```
Pill copy verbatim: `Say` (white) + ` Hello!` (neon green) — rendered uppercase by CSS so it reads "SAY HELLO!".

```css
.glass-cursor-card {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 99999;
    pointer-events: none;
    padding: 0.75rem 1.5rem;
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 9999px;
    box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.15);
    transform: translate(-50%, -50%) scale(0);
    opacity: 0;
    will-change: transform, opacity;
    transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1),
                background 0.35s cubic-bezier(0.16, 1, 0.3, 1),
                border-color 0.35s cubic-bezier(0.16, 1, 0.3, 1),
                box-shadow 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.glass-cursor-card.active { opacity: 1; }
.glass-cursor-card.dark-mode {
    background: rgba(0, 0, 0, 0.82);
    border-color: rgba(255, 255, 255, 0.08);
    box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.05);
}
.cursor-card-text {
    font-family: 'General Sans', -apple-system, sans-serif;
    font-size: 0.85rem;
    font-weight: 500;
    letter-spacing: 0.06em;
    color: #39FF14;
    text-transform: uppercase;
    white-space: nowrap;
    text-shadow: 0 0 8px rgba(57, 255, 20, 0.45);
}
.cursor-card-text .text-white {
    color: #ffffff;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
}
.cursor-ring-outline {
    position: fixed;
    top: 0;
    left: 0;
    width: 48px;
    height: 48px;
    border: 1.5px solid rgba(255, 255, 255, 0.45);
    border-radius: 50%;
    z-index: 99998;
    pointer-events: none;
    transform: translate(-50%, -50%) scale(0);
    opacity: 0;
    will-change: transform, opacity;
    transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1),
                border-color 0.4s ease;
}
.cursor-ring-outline.active { opacity: 1; }
.cursor-ring-outline.expanded {
    border-color: rgba(255, 255, 255, 0.15);
}
```

## The loader / reveal (entrance animations)

Two coordinated masked reveals run on load. Both use the same dramatic easing `cubic-bezier(0.05, 0.9, 0.1, 1)` and start blurred at `blur(20px)`.

### Hero headline — word-by-word slide-up reveal

Each word is wrapped in a mask (`overflow: hidden`) and an inner span that starts pushed down and blurred, then slides up into place and un-blurs. `<br>` and spaces are preserved. Stagger: `0.1s` per word.

```css
.hero-title .word-wrapper {
    display: inline-block;
    overflow: hidden;
    vertical-align: bottom;
    padding-bottom: 0.15em;   /* room so descenders (y, p, g) aren't clipped */
    margin-bottom: -0.15em;
}
.hero-title .word-inner {
    display: inline-block;
    opacity: 0;
    transform: translateY(105%);
    filter: blur(20px);
    animation: word-reveal-mask 1.3s cubic-bezier(0.05, 0.9, 0.1, 1) forwards;
}
@keyframes word-reveal-mask {
    0%   { opacity: 0; transform: translateY(105%); filter: blur(20px); }
    30%  { opacity: 1; }
    100% { opacity: 1; transform: translateY(0); filter: blur(0); }
}
```

### Big wordmark — letter-by-letter slide-in-from-left reveal

Each letter is wrapped in a mask and an inner span that starts pushed left (`translateX(-105%)`) and blurred, then slides right into place and un-blurs. Spaces become ` `. Stagger: `0.09s` per letter (with 9 letters, the last letter finishes at `0.72s` delay + `1.2s` animation = `1.92s`).

```css
.footer-logo-text .letter-wrapper {
    display: inline-block;
    overflow: hidden;
    vertical-align: bottom;
    line-height: 0.8;
}
.footer-logo-text .letter-inner {
    display: inline-block;
    opacity: 0;
    transform: translateX(-105%);
    filter: blur(20px);
    animation: letter-reveal-mask 1.2s cubic-bezier(0.05, 0.9, 0.1, 1) forwards;
}
@keyframes letter-reveal-mask {
    0%   { opacity: 0; transform: translateX(-105%); filter: blur(20px); }
    25%  { opacity: 1; }
    100% { opacity: 0.95; transform: translateX(0); filter: blur(0); }
}
```

## Interaction logic (custom cursor + reveal splitting) — copy this JS VERBATIM

```js
document.addEventListener('DOMContentLoaded', () => {
    const logoText = document.querySelector('.footer-logo-text');

    if (logoText) {
        const text = logoText.textContent.trim();
        logoText.innerHTML = ''; // Очищаем контейнер

        // Разделяем слово на отдельные буквы и оборачиваем каждую в двойной span для маски
        [...text].forEach((char, index) => {
            // Внешний span выступает в роли маски (overflow: hidden)
            const wrapper = document.createElement('span');
            wrapper.className = 'letter-wrapper';

            // Внутренний span содержит букву и анимируется слева направо
            const inner = document.createElement('span');
            inner.textContent = char === ' ' ? ' ' : char; // Обрабатываем пробелы
            inner.className = 'letter-inner';

            // Задаем задержку анимации для каждой буквы:
            // 9 букв, задержка шага 0.09с, длительность анимации 1.2с.
            // Последняя буква закончит выдвигаться ровно на отметке: 0.72с (задержка) + 1.2с (анимация) = 1.92 секунды!
            inner.style.animationDelay = `${index * 0.09}s`;

            wrapper.appendChild(inner);
            logoText.appendChild(wrapper);
        });
    }

    // Разделение верхнего заголовка на слова для анимации появления снизу вверх из маски с блюром
    const heroTitle = document.querySelector('.hero-title');
    if (heroTitle) {
        const text = heroTitle.innerHTML;
        // Разделяем по пробелам, сохраняя теги <br>
        const parts = text.split(/(\s+|<br\s*\/?>)/i);
        heroTitle.innerHTML = '';

        let wordIndex = 0;
        parts.forEach(part => {
            if (part.trim() === '') {
                // Обычный пробел между словами
                heroTitle.appendChild(document.createTextNode(' '));
            } else if (part.toLowerCase().startsWith('<br')) {
                // Сохраняем перенос строки
                heroTitle.appendChild(document.createElement('br'));
            } else {
                // Обертка-маска (overflow: hidden)
                const wrapper = document.createElement('span');
                wrapper.className = 'word-wrapper';

                // Внутреннее слово, сдвинутое вниз и заблюренное
                const inner = document.createElement('span');
                inner.className = 'word-inner';
                inner.textContent = part;

                // Задержка анимации: шаг 0.1с для размеренного, солидного появления
                inner.style.animationDelay = `${wordIndex * 0.1}s`;
                wordIndex++;

                wrapper.appendChild(inner);
                heroTitle.appendChild(wrapper);
            }
        });
    }

    // Летающий оутлайновый белый кружок и стеклянная плашка за курсором (LERP-физика)
    const glassCard = document.getElementById('glass-card');
    const cursorRing = document.getElementById('cursor-ring');

    if (glassCard && cursorRing) {
        let mouseX = window.innerWidth / 2;
        let mouseY = window.innerHeight / 2;

        // Координаты для плашки (медленное движение)
        let cardX = mouseX;
        let cardY = mouseY;

        // Координаты для кружка (более быстрое движение)
        let ringX = mouseX;
        let ringY = mouseY;

        let isFirstMove = true;
        let scale = 0;
        let targetScale = 0;
        let isHoveringBtn = false; // Флаг наведения на кнопку Book a Demo

        // Отслеживаем координаты курсора
        document.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;

            if (isFirstMove) {
                // Мгновенно позиционируем при первом движении, чтобы избежать "прыжка"
                cardX = mouseX;
                cardY = mouseY;
                ringX = mouseX;
                ringY = mouseY;
                isFirstMove = false;
                glassCard.classList.add('active');
                cursorRing.classList.add('active');
            }

            // Показываем элементы только если курсор не находится на кнопке Book a demo
            if (!isHoveringBtn) {
                targetScale = 1;
            }
        });

        // Плавное скрытие при выходе курсора за пределы экрана
        document.addEventListener('mouseleave', () => {
            targetScale = 0;
        });

        // Плавное появление при возвращении курсора в окно
        document.addEventListener('mouseenter', () => {
            if (!isHoveringBtn) {
                targetScale = 1;
            }
        });

        // Слушатели наведения на кнопку "Book a demo" для переключения режимов
        const heroBtn = document.querySelector('.hero-btn');
        if (heroBtn) {
            heroBtn.addEventListener('mouseenter', () => {
                isHoveringBtn = true;
                targetScale = 0; // Плавное скрытие плашки (scale 0)
                cursorRing.classList.add('expanded'); // Добавляем класс расширения кружка в CSS
            });
            heroBtn.addEventListener('mouseleave', () => {
                isHoveringBtn = false;
                targetScale = 1; // Плавное возвращение плашки
                cursorRing.classList.remove('expanded'); // Сброс расширения кружка
            });
        }

        // Системный цикл анимации (60-120 кадров/сек) для сглаживания
        const updatePhysics = () => {
            // Мягкое отставание плашки: коэффициент LERP 0.08
            cardX += (mouseX - cardX) * 0.08;
            cardY += (mouseY - cardY) * 0.08;

            // Кружок следует за курсором мгновенно и без задержки
            ringX = mouseX;
            ringY = mouseY;

            // Интерполируем масштаб для плавного появления/исчезновения
            scale += (targetScale - scale) * 0.15;

            // Масштаб кружка (если навели на кнопку, он увеличивается до 1.6 через класс expanded)
            // Но мы всё еще перемножаем его на общий scale, чтобы кружок сжался в 0 при выходе с экрана
            const currentRingScale = cursorRing.classList.contains('expanded') ? 1.6 * scale : scale;

            // Применяем аппаратную 3D-трансформацию
            glassCard.style.transform = `translate3d(${cardX}px, ${cardY}px, 0) translate(-50%, -50%) scale(${scale})`;
            cursorRing.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%) scale(${currentRingScale})`;

            requestAnimationFrame(updatePhysics);
        };

        updatePhysics();
    }
});
```

## Fixed parameters (bake these in)

- Background: `#000000`. Body `overflow: hidden` (single non-scrolling screen).
- Accent neon green: `#39FF14` (and `rgba(57, 255, 20, …)` variants).
- Text white: `#ffffff`; muted whites: `rgba(255,255,255,0.55)` (social), `rgba(255,255,255,0.45)` (copyright), `rgba(255,255,255,0.2)` (divider), `rgba(255,255,255,0.18)` (button & pill border).
- Fonts: Playfair Display (headline `2.8rem`/400), Outfit (button `1.1rem`/500, links & copyright `0.95rem`/400), General Sans (footer titles `1.4rem`/400, wordmark `21.9vw`/400, pill `0.85rem`/500).
- Video container height `90vh`; video height `110%`, `object-fit: cover`.
- Top gradient `top: -30vh`, `z-index: 0`; video container `z-index: -1`; hero `z-index: 2`; footer & logo wrap `z-index: 3`; cursor ring `z-index: 99998`; glass pill `z-index: 99999`.
- Footer container centered: `top: 50vh; transform: translateY(-50%)`, `left/right: 20px`, `width: calc(100vw - 40px)`.
- Wordmark: `21.9vw`, `letter-spacing: -0.03em`, `line-height: 0.8`, `translateX(-20px)`, `opacity: 0.95`, pinned `bottom: 20px`, `white-space: nowrap`.
- Button: `border-radius: 9999px`, `padding: 1.3rem 2.5rem`, `gap: 0.9rem`, hover inverts to white bg/black text and lifts `translateY(-2px)`.
- Blinking dot: `10px`, `pulse-glow` and `wave-expand` both `2s infinite ease-in-out`; outer wave color `rgba(57,255,20,0.45)` scaling `0.6 → 2.3`.
- Cursor ring: `48px`, `1.5px solid rgba(255,255,255,0.45)`, tracks pointer instantly; expands to `1.6×` on button hover (`expanded` fades border to `rgba(255,255,255,0.15)`).
- Glass pill: lags pointer with LERP `0.08`; scale interpolates toward target with LERP `0.15`; hidden (`scale 0`) while hovering the button, shown (`scale 1`) otherwise; `backdrop-filter: blur(12px)`.
- Reveal easing `cubic-bezier(0.05, 0.9, 0.1, 1)`; both reveals start at `blur(20px)`. Headline words: `1.3s`, stagger `0.1s`, slide up `translateY(105%)→0`. Wordmark letters: `1.2s`, stagger `0.09s`, slide right `translateX(-105%)→0`.

## Assets

Route every local asset through:

```
ASSET_BASE_URL = https://api.getlayers.ai/storage/v1/object/public/public/assets/loopstack-f8c64439bf
```

- `flower.mp4` → `https://api.getlayers.ai/storage/v1/object/public/public/assets/loopstack-f8c64439bf/flower.mp4` (the background `<video>` `<source src>`).
- `black_gradient.svg` → `https://api.getlayers.ai/storage/v1/object/public/public/assets/loopstack-f8c64439bf/black_gradient.svg` (the `#top-gradient` `<img src>`).

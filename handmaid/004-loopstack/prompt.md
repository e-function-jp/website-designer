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

---

# 日本語訳（要約）

> 上の英文が正本。ここでは実装判断に必要な要点だけを訳す（CSS 値・JS は英文をそのまま使う）。

- **概要:** 真っ黒な背景の、スクロールしない1画面の「フッターヒーロー」。画面下 90% にループする花の動画、上からぼかした黒いグラデーションが被さって動画をページへ溶かす。上寄せ中央にセリフ体の見出しと、ネオングリーンの点が明滅する「Book a demo」ピルボタン。画面の縦中央に固定フッター（Stay in Touch / Think. Build. Repeat.、区切り線、SNS アイコン、ナビ、コピーライト）。最下部に巨大な「Loopstack」ロゴ。
- **ロード時:** 見出しは単語ごとにマスクから下→上へ、ブラー 20px が解けながら出る（1.3s、0.1s 刻み）。ロゴは1文字ずつ左→右へ同様に出る（1.2s、0.09s 刻み）。イージングはどちらも `cubic-bezier(0.05, 0.9, 0.1, 1)`。
- **カーソル:** 即時追従する輪（48px）と、遅れて付いてくるガラスのピル「SAY HELLO!」（LERP 0.08）。ボタンに乗るとピルが消え、輪が 1.6 倍に広がる。
- **色:** 白文字 on 黒、アクセントはネオングリーン `#39FF14` のみ。
- **書体:** Playfair Display（見出し）、Outfit（ボタン・リンク）、General Sans（フッター見出し・巨大ロゴ・ピル）。

---

# Phase 2 — 日本語プロダクトLP「Loopstack」への拡張

> Phase 1（上記・コミット `707ff94`）の1画面を土台に、スクロールする日本語の架空プロダクトLPへ仕上げる。
> 実装対象は同じ `handmaid/004-loopstack/index.html`（単一ファイルのまま）。上と矛盾する場合はこちらを優先する。

## 2-0. コンセプト — 「ひとつのループが、花をひらく。」

- 花の動画（つぼみ → 開花の 6 秒ループ）を **「ループを回した成果」** の比喩として使う。
- Phase 1 の画面は本来「フッター」。LP では **最初（ヒーロー）と最後（カーテンフッター）に同じ世界を置き**、
  中盤は真っ黒なセクションが動画を覆って流れていく構成にする。最後に黒いセクションが上へ抜けると、
  背面に固定していた Phase 1 そのままのフッター画面が **幕が開くように** 現れる。
- 世界観を壊さないためのルール:
  1. 色は黒・白・白の透過・ネオングリーン `#39FF14` だけ。緑は「動いている／生きている」ものだけに使う（点、進行中の線、成功状態）。
  2. 画像は Phase 1 の 2 アセットのみ。プロダクト画面は HTML/CSS/インライン SVG で描く。
  3. 出現の動きはすべて Phase 1 の **マスク + ブラー 20px + `cubic-bezier(0.05, 0.9, 0.1, 1)`** の語彙で統一する。
  4. カスタムカーソルはページ全体で生かし、セクションごとにピルの文言を変える（2-5）。

## 2-1. プロダクト設定（架空）

- **名称:** Loopstack（ループスタック）
- **カテゴリ:** プロダクトチームのための実験基盤。「仮説 → 実装 → 検証」のループを 1 週間で回す。
- **一言:** 考える。つくる。繰り返す。（英: Think. Build. Repeat.）
- **状態:** クローズドβ。参加チームを募集中。
- 数値・利用者の声・企業名はすべて架空。末尾に「※本ページは架空のプロダクトのデザインサンプルです。」を明記。

## 2-2. シェル変更（Phase 1 からの差分）

- `<html lang="ja">`、`<title>Loopstack — 考える。つくる。繰り返す。</title>`、description を日本語で。
- **スクロールさせる:** `body { overflow: hidden }` を外し、`overflow-x: hidden` のみ。Lenis 1.3.19（importmap）を `lerp: 0.085` で導入。
- **書体:** Phase 1 の 3 書体に和文を足す（Google Fonts の同じ `@import` に追記）:
  - 見出し: `'Playfair Display', 'Shippori Mincho', serif`（Shippori Mincho 400/500）
  - UI・本文: `'Outfit', 'Zen Kaku Gothic New', sans-serif`（Zen Kaku Gothic New 400/500）
  - ロゴ・ラベル: `'General Sans', 'Zen Kaku Gothic New', sans-serif`
  - 和文本文は `line-height: 1.9; letter-spacing: 0.04em; font-feature-settings: "palt" 1`。見出しの改行は `<br>` と `<br class="sp">` で手で決め、1 文字だけの行を作らない。
- **レイヤー構成（z-index）:**
  | 層 | 要素 | z |
  |---|---|---|
  | 動画 | `.video-container`（fixed, 下 90vh） | 0 |
  | 上グラデーション | `#top-gradient`（fixed） | 1 |
  | カーテンフッター | `.curtain`（fixed, 100svh, 2-4 S7） | 2 |
  | 本文 | `<main>`（relative） | 3 |
  | ヘッダー | `.site-header`（fixed） | 40 |
  | カーソル | 輪 99998 / ピル 99999 | — |
  Phase 1 は動画 −1 だったが、`<main>` の黒背景で覆う必要があるので全体を正の z に並べ替える。
- **SP（<640px）:** 上グラデーションは `width: 260vw; left: -80vw; top: -12vh`（細い画面で黒が足りなくなるため）。

## 2-3. ヘッダー（新規, fixed）

- 左: `Loopstack`（General Sans 500, 1.25rem）。中央（≥1024px）: `仕組み`(#loop) `機能`(#features) `β参加`(#beta) `FAQ`(#faq)（Outfit 0.9rem, 白 70%, hover 100%）。
  右: 小さいピル `βに応募` + 明滅ドット（Phase 1 のボタンを `padding: 0.7rem 1.3rem; font-size: 0.9rem` に縮めたもの）→ #apply。
- ヒーローを抜けたら（scrollY > 60vh）背景 `rgba(0,0,0,0.6)` + `backdrop-filter: blur(14px)` + 下線 `rgba(255,255,255,0.08)` を 400ms でフェードイン。カーテンフッターが見え始めたら（2-4 S7）ヘッダーは `opacity 0` で退場。
- <1024px: 中央ナビを隠し、ロゴと応募ピルだけ。

## 2-4. セクション構成（上から順に）

共通: 中盤セクション（S1〜S6）は `background: #000; position: relative;`、内側 `max-width: 72rem; margin-inline: auto; padding-inline: 1.25rem`（≥640px 2.5rem）、
縦余白 `padding-block: 9rem`（<640px 6rem）。セクションラベルは `General Sans 500 / 0.78rem / letter-spacing 0.14em / 白 55%`、左に 6px の緑ドット（静止、グローなし）。
見出しは `'Playfair Display','Shippori Mincho'` 400、`clamp(2rem, 4.2vw, 3.8rem)`、`line-height 1.35`、`letter-spacing 0.02em`。
**出現:** 見出しは文節ごとに Phase 1 の `word-reveal-mask`（1.3s / 0.1s 刻み）を、in-view（threshold 0.35）で 1 回だけ再生。本文・カードは `opacity 0 → 1, translateY(2rem) → 0, blur(12px) → 0, 1.1s cubic-bezier(0.05,0.9,0.1,1)`、グループ内 80ms 刻み。

### S0. ヒーロー `#top`（`height: 100svh`, 背景透明 — 動画が見える）
Phase 1 の見出し・ボタン・巨大ロゴの **位置・サイズ・出現タイミングをそのまま**使い、フッターブロックだけ外す（S7 へ移す）。
- 見出し（2 行固定）: `クローズドβの` / `参加チームを募集しています。`
  和文は空白で split できないので、`data-phrases="クローズドβの|<br>|参加チームを|募集しています。"` の文節単位で `word-wrapper` / `word-inner` を作る（0.1s 刻みは同じ）。
  サイズは Phase 1 の 2.8rem をそのまま、<640px は 1.75rem。
- ボタン: `デモを予約する` + 明滅ドット → #apply。
- 巨大ロゴ `Loopstack` はヒーロー内に `position: absolute; bottom: 20px`（fixed ではない — スクロールで一緒に流れる）。
- **スクロール連動（ヒーロー内進捗 q = scrollY / 100svh, 0〜1）:**
  - 巨大ロゴの各文字を `translateY(q * (40 + i*14)px)`、`opacity 0.95 → 0`、`blur(q*12px)`（左から順にほどけて沈む）。
  - 動画を `scale(1 + q*0.08)`、`filter: brightness(1 - q*0.45)`。
  - 見出し・ボタンを `translateY(-q*60px)`、`opacity 1 - q*1.4`。
- ヒーロー下端に `height: 30vh` の黒へのグラデーション（`linear-gradient(transparent, #000)`）を置き、S1 の黒へ継ぎ目なくつなぐ。

### S1. ループ `#loop`（高さ `320vh`, 内側 `position: sticky; top: 0; height: 100svh`）— 体験の中心
- 中央に **円形にくり抜いた花の動画**（2 本目の `<video>`、同じ src・muted・loop・playsinline）。
  直径 `min(56vmin, 30rem)`、`border-radius: 50%`、`object-fit: cover`。セクション進捗 p に対して `scale(0.72 + p*0.28)`。
- その外周に SVG のリング（半径 = 動画の半径 + 2.2rem）:
  - 下地の円: `stroke: rgba(255,255,255,0.14); stroke-width: 1`
  - 進行の円: `stroke: #39FF14; stroke-width: 1.5`、`stroke-dashoffset` で p に比例して時計回りに描かれる（12 時起点）。
  - 進行の先端に 10px の緑ドット（Phase 1 の `pulse-glow` をそのまま適用）。
  - 12 時・4 時・8 時の 3 ノード（白の 7px 円、到達したら緑に塗り替え 300ms）とラベル
    `01 考える / Think`、`02 つくる / Build`、`03 繰り返す / Repeat`（General Sans + Zen Kaku、0.8rem）。
- 左（≥1024px, 動画の左外）に **現在フェーズの見出しと本文**。フェーズ切替（p = 0.33 / 0.66）で旧テキストは `blur(20px)` + `opacity 0` で 350ms 退場、新テキストは `word-reveal-mask` を再生:
  1. `問いを、ひとつに絞る。` — `解きたい課題を「誰の・何が・どれだけ変わるか」の一文にする。指標と期限を先に決めるので、議論が散らからない。`
  2. `その日のうちに、つくる。` — `フラグ付きの最小実装を、仮説ボードからそのまま出す。レビュー待ちで一週間が溶けることはもうない。`
  3. `結果から学び、また回す。` — `計測は自動で集まり、学びは次の仮説の下書きになる。ループの回数が、そのままチームの速さになる。`
- 右下（≥1024px）に `LOOP 01 — 33%` のような進行表示（General Sans, tabular-nums）。p ≥ 0.98 で `LOOP 01 — COMPLETE` に変わり、緑になる。
- <1024px: 動画とリングを上、テキストを下に縦積み（sticky は維持、動画直径 `68vw`）。

### S2. 機能 `#features`
- ラベル `FEATURES`、見出し `ループを速くする、<br class="sp">四つの道具。`
- **行リスト**（`border-top: 1px solid rgba(255,255,255,0.12)`、最後に border-bottom）。各行: 左に番号 `01`（General Sans, 白 45%）、
  中央に機能名（見出し書体 `clamp(1.6rem, 3vw, 2.6rem)`）、右に 45° 回転する `+`。
  - hover / focus-within で: 行の上端に緑の 1px 線が左→右へ 600ms で走る、機能名が `translateX(1rem)`、詳細が `grid-template-rows: 0fr → 1fr`（600ms）で開く。
  - タッチ端末（`hover: none`）では常に開いた状態。
- 詳細の中身（左に説明文、右に小さな UI 断片）:
  1. **仮説ボード** — `問い・指標・期限を一枚に。チームの「なぜ」がぶれなくなる。` / UI: 3 行の入力風フィールド（問い / 指標 / 期限）。
  2. **ワンクリック実験** — `フラグと振り分けを、ボードのボタンひとつで。リリースと検証を切り離す。` / UI: `A 50% | B 50%` の分割バー（hover で B 側が 50→62% に伸びる）。
  3. **自動計測** — `イベント設計なしで、主要な行動を最初から計測。数字を待つ時間をなくす。` / UI: 12 本の小さな棒グラフ（開くと下から 60ms 刻みで伸びる）。
  4. **学習ログ** — `結果と学びを自動で要約し、次の仮説の下書きに。ループが記録として積み上がる。` / UI: タイムライン 3 点（最新だけ緑）。

### S3. プロダクト画面 `#product`
- ラベル `PRODUCT`、見出し `ボードの上で、<br class="sp">ループが回る。`
- **HTML/CSS 製のボードのモック**（`max-width: 64rem; border: 1px solid rgba(255,255,255,0.12); border-radius: 1.25rem; background: rgba(255,255,255,0.03)`）:
  - 上部バー: 左に `Checkout 改善チーム`、中央に `LOOP 12`、右に `RUNNING` + 明滅ドット。
  - 本体: 3 カラム `考える / つくる / 検証`。各カラムにカード 2〜3 枚（タイトル + 小さな指標チップ）。
  - **自動アニメーション（in-view 中のみ）:** 2400ms ごとに、`考える` 列の先頭カードが `つくる` → `検証` と移動する（FLIP で 700ms `cubic-bezier(0.05,0.9,0.1,1)`）。
    `検証` に着いたカードは 900ms 後に緑の枠で光ってから消え、上部バーの `LOOP 12` が `LOOP 13` に縦めくりで増える。新しいカードが `考える` 列の末尾にブラー解除で入る。**これを無限に繰り返す**（ループそのものを見せる）。
  - <640px: カラムを横スクロール（`scroll-snap`）にせず、3 カラムを縦積みにしてカード移動は縦方向に。

### S4. 数字と声 `#voices`
- 3 つの数字（in-view で 1600ms easeOutCubic カウントアップ、General Sans 400, `clamp(3rem, 6vw, 5.5rem)`, tabular-nums）:
  `7日`（仮説から検証までの中央値）/ `3.2倍`（1 四半期あたりのループ回数）/ `48チーム`（β参加チーム）。注記 `※β参加チームへの聞き取り（架空）`。
- 声のカード 3 枚（黒地、白 12% の枠、角丸 1rem）: 引用 50〜80 字 + イニシャルの丸アバター（白枠、中は黒）+ `役職 / 業種`。実名なし。
  カードは in-view で左から 120ms 刻みにマスク出現。

### S5. βプログラム `#beta` と FAQ `#faq`
- ラベル `CLOSED BETA`、見出し `いま参加すると、<br class="sp">いちばん長く回せる。`
- 参加条件 3 つ（番号付きの横並び、<1024px 縦）: `5〜50名のプロダクトチーム` / `週1回、30分のフィードバック` / `β期間中は無償（2026年12月まで）`。
- 参加までの流れ（横線タイムライン, 3 点）: `応募` → `オンライン面談（30分）` → `2週間以内に招待`。線は in-view で左から緑が 1200ms で伸び、点が順に緑になる。
- FAQ `#faq`（見出し `よくある質問`）: `<details>` 4 件。開閉は `grid-template-rows` で 500ms、`+` が 45° 回転。
  質問: `既存の分析ツールと併用できますか？` / `データはどこに保存されますか？` / `β終了後の料金は？` / `エンジニアがいないチームでも使えますか？`

### S6. 応募 `#apply`
- ラベル `APPLY`、見出し `次のループを、<br class="sp">一緒に回しましょう。`
- フォーム（`max-width: 40rem`）: `会社名` `お名前` `メールアドレス` `役割`（select: プロダクトマネージャー / エンジニア / デザイナー / その他）
  `チーム規模`（セグメント: `1–5` `6–20` `21–50`）。入力は下線のみ（白 20%）、focus で下線が白に左から伸びる。
- 送信ボタンは Phase 1 の `hero-btn`（`応募する` + 明滅ドット）。送信時: 必須未入力なら該当欄の下線を白 → 赤ではなく **白 100% + 小さな注記**（色を増やさない）。
  入力 OK なら: ボタン幅を保ったまま文言が縦めくりで `受け付けました` に、ドットは明滅を止めて緑で点灯。バックエンドなし。

### S7. カーテンフッター `#contact`（Phase 1 の画面そのもの）
- `<main>` の最後に **透明なスペーサー `height: 100svh`** を置く。背面の `.curtain`（fixed, inset 0, z 2）に Phase 1 の
  **見出し + ボタン + フッターブロック + 巨大ロゴ** をそのまま配置（CSS 値も Phase 1 のまま）。
  - 見出し: `次のループを、` / `一緒に。`、ボタン: `デモを予約する`（→ #apply）
  - フッター: `つながり続ける` / `Think. Build. Repeat.`、SNS 3 つ、ナビ `仕組み` `機能` `β参加` `応募`、`© 2026 Loopstack`
  - その下（コピーライトの下、中央、0.72rem, 白 35%）: `※本ページは架空のプロダクトのデザインサンプルです。`
- `.curtain` はスペーサーの上端が画面下端に入るまで `visibility: hidden`（ヒーローで透けて見えないように）。入ったら表示し、
  スペーサーが 50% 見えた瞬間に **見出しの単語リビールと巨大ロゴの文字リビールを Phase 1 と同じ値で再生**（1 回だけ）。
- 黒い `<main>` の最終セクション下端には `height: 40vh` の `linear-gradient(#000, transparent)` を付け、幕が開く境目を柔らかくする。
- <640px: フッターブロックは縦積み（見出し 2 つを縦に、SNS → ナビ（折り返し）→ コピーライトを中央揃え）。巨大ロゴは 21.9vw のまま。

## 2-5. カスタムカーソル（ページ全体）

- Phase 1 の JS をベースに、次を足す:
  - **ピルの文言をセクションで切り替える:** 各セクションに `data-cursor="白の語|緑の語"`。ポインター直下のセクションから取得し、変わったら
    ピルの中身を `opacity 0 → 1`（200ms）で差し替える。
    `#top`/`#contact`: `Say|Hello!`、`#loop`: `Keep|Looping`、`#features`: `Open|Details`、`#product`: `Watch|the Loop`、`#voices`: `Read|Stories`、`#beta`/`#faq`: `Join|the Beta`、`#apply`: `Write|to Us`。
  - **「ボタンに乗ったらピルを隠し輪を広げる」を、すべての操作可能要素に一般化:** `a, button, summary, input, select, [role="button"]`（イベント委譲で `pointerover` / `pointerout`）。
  - 暗い背景の上では Phase 1 の `.dark-mode` は使わない（常に黒背景なので通常のガラスのまま）。
- `(hover: none)` の端末ではカーソル要素を生成しない。

## 2-6. 動きの制約

- `prefers-reduced-motion: reduce`: マスク出現はすべて即表示、ボードの自動移動は停止（最終状態を静止表示）、S1 のリングは進捗に応じて描くが先端ドットの明滅は止める、
  動画は 2 本とも一時停止して 4.5 秒地点（開花後）のフレームを表示。
- 2 本の動画は `IntersectionObserver` で画面外のとき `pause()`、入ったら `play()`（ヒーロー／カーテン用の固定動画は、中盤セクションに完全に覆われている間は pause）。

## 2-7. 受け入れ条件

1. 1440×900 / 390×844 でコンソールエラー 0、横スクロールなし、アンカーがすべて存在する。
2. ページ先頭のファーストビューは、フッターブロックが無いこと以外 Phase 1（`707ff94`）と同じ見た目・同じリビール。
3. ページ末尾までスクロールすると、黒い本文が上へ抜けて Phase 1 のフッター画面が現れ、見出しと巨大ロゴのリビールが再生される。
4. S1 でスクロール量に応じてリングが描かれ、3 フェーズのテキストが切り替わり、最後に `COMPLETE` になる。
5. S3 のボードでカードが列を移動し、`LOOP` の数字が増え続ける。
6. 390px で和文見出しに 1 文字だけの行が出ない。
7. 単一 `index.html` のまま。アセットは Phase 1 の 2 ファイルのみ。

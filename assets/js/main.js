/* ==========================================================================
   DuckStudio — coreografia (GSAP + ScrollTrigger + Lenis)
   Cada seção tem sua própria linguagem de movimento:
   01 fade+scale · 02 lateral · 03 blur→nitidez em viagem horizontal
   04 expansão + carrossel em profundidade · 05 revelação vertical
   06 profundidade/parallax · 07 máscara circular · 08 dispersão
   ========================================================================== */
const { gsap, ScrollTrigger } = window;
gsap.registerPlugin(ScrollTrigger);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = () => innerWidth < 768;
const root = document.documentElement;

/* ---------------- scroll suave (desktop) ---------------- */
let lenis = null;
if (!reduced && window.Lenis && !matchMedia('(pointer: coarse)').matches) {
  lenis = new window.Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.9 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
const scrollToTarget = (target) => {
  const el = typeof target === 'string' ? $(target) : target;
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { duration: 1.8, easing: (x) => 1 - Math.pow(1 - x, 4) });
  else el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
};

/* ---------------- cena 3D (carregada sem bloquear) ---------------- */
let scene = null;
const scenePromise = import('./scene.js').then((m) => { scene = m.initScene(); return scene; }).catch((e) => { console.warn('[3D] desativado:', e); root.classList.add('no-webgl'); return null; });

/* ---------------- utilidades de texto ---------------- */
function splitWords(el) {
  const words = el.textContent.trim().split(/\s+/);
  el.innerHTML = words.map((w) => `<span class="w">${w}</span>`).join(' ');
  return $$('.w', el);
}
function splitChars(el) {
  const out = [];
  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        [...n.textContent].forEach((c) => { const s = document.createElement('span'); s.className = 'ch'; s.textContent = c; frag.appendChild(s); out.push(s); });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) walk(n);
    });
  };
  walk(el);
  el.setAttribute('aria-hidden', 'true');
  return out;
}

/* =================================================================
   LOGO-GUIA — apresenta a empresa, a seção atual e o progresso
   ================================================================= */
const guide = $('#guide');
const guideNum = $('.guide__num', guide);
const guideLabel = $('.guide__label', guide);
const guideExtra = $('.guide__extra', guide);
const topCta = $('.top-cta');
const nav = $('#nav');
const sections = $$('main > .s');
let current = -1;
let guideMode = 'center';

function guideTarget(mode) {
  const pad = parseFloat(getComputedStyle(root).getPropertyValue('--gutter')) || 24;
  const w = guide.offsetWidth;
  const top = isMobile() ? 14 : 20;
  if (mode === 'center' && !isMobile()) return { x: innerWidth / 2 - w / 2, y: top + 6, scale: 1.08 };
  return { x: pad + 6, y: top + 6, scale: 1 };
}
function placeGuide(mode, instant) {
  guideMode = mode;
  const t = guideTarget(mode);
  gsap.to(guide, { ...t, duration: instant || reduced ? 0 : 1.3, ease: 'expo.inOut', overwrite: 'auto' });
}
function setGuideText(num, label) {
  if (reduced) { guideNum.textContent = num; guideLabel.textContent = label; return; }
  gsap.timeline()
    .to([guideNum, guideLabel], { yPercent: -60, opacity: 0, duration: 0.25, ease: 'power2.in', stagger: 0.04 })
    .add(() => { guideNum.textContent = num; guideLabel.textContent = label; })
    .fromTo([guideNum, guideLabel], { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.5, ease: 'power3.out', stagger: 0.05 });
}
function setTheme(dark) {
  guide.classList.toggle('is-dark', dark);
  topCta.classList.toggle('is-dark', dark);
}
function setSection(i) {
  if (i === current) return;
  current = i;
  const s = sections[i];
  setGuideText(String(i + 1).padStart(2, '0'), s.dataset.label);
  if (s.id !== 'trabalhos') guideExtra.textContent = '';
  setTheme(s.dataset.theme === 'dark');
  placeGuide(s.id === 'inicio' || s.id === 'comecar' ? 'center' : 'dock');
  topCta.classList.toggle('is-hidden', s.id === 'contato' || s.id === 'comecar');
  $$('.nav__list a').forEach((a, k) => a.classList.toggle('is-current', k === i));
  ticks.forEach((t, k) => t.classList.toggle('on', k <= i));
  if (reduced) reducedSky(i);
}

/* marcadores de seção no anel */
const ticksG = $('.guide__ticks');
let ticks = [];
function buildTicks(starts, max) {
  ticksG.innerHTML = '';
  ticks = starts.map((st) => {
    const a = (st / max) * Math.PI * 2;
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l.setAttribute('x1', 32 + Math.cos(a) * 26.2); l.setAttribute('y1', 32 + Math.sin(a) * 26.2);
    l.setAttribute('x2', 32 + Math.cos(a) * 28.6); l.setAttribute('y2', 32 + Math.sin(a) * 28.6);
    ticksG.appendChild(l);
    return l;
  });
  ticks.forEach((t, k) => t.classList.toggle('on', k <= current));
}

/* navegação: a logo vira menu */
function toggleNav(open) {
  const willOpen = open ?? nav.hidden;
  guide.setAttribute('aria-expanded', String(willOpen));
  if (willOpen) {
    nav.hidden = false;
    lenis && lenis.stop();
    setTheme(true);
    if (!reduced) gsap.fromTo(nav, { clipPath: 'circle(0% at 60px 50px)' }, { clipPath: 'circle(150% at 60px 50px)', duration: 0.9, ease: 'expo.inOut' });
    if (!reduced) gsap.from('.nav__list li', { y: 40, opacity: 0, stagger: 0.04, duration: 0.8, delay: 0.25, ease: 'power3.out' });
    placeGuide('dock');
    $('.nav__list a')?.focus({ preventScroll: true });
  } else {
    lenis && lenis.start();
    const done = () => { nav.hidden = true; const s = sections[current]; if (s) { setTheme(s.dataset.theme === 'dark'); placeGuide(s.id === 'inicio' || s.id === 'comecar' ? 'center' : 'dock'); } };
    if (reduced) done();
    else gsap.to(nav, { clipPath: 'circle(0% at 60px 50px)', duration: 0.7, ease: 'expo.inOut', onComplete: done });
  }
}
guide.addEventListener('click', () => toggleNav());
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !nav.hidden) { toggleNav(false); guide.focus(); } });
$$('[data-scroll]').forEach((a) => a.addEventListener('click', (e) => {
  const href = a.getAttribute('href');
  if (!href || !href.startsWith('#')) return;
  e.preventDefault();
  if (!nav.hidden) toggleNav(false);
  scrollToTarget(href);
}));

/* =================================================================
   POSES DO PATO 3D — keyframes ligados ao scroll (interpolação própria)
   ================================================================= */
const TAU = Math.PI * 2;
const P = (o) => ({ x: 0, y: 0, z: 0, s: 1, ry: 0, rx: 0, duck: 1, morph: 0, points: 0, float: 1, dust: 0.5, night: 0, ...o });
function poseKeys(mobile) {
  const m = mobile ? 0 : 1;
  return [
    ['#inicio', 'top top', P({ x: 2.5 * m, y: mobile ? 1.75 : -0.15, s: mobile ? 0.62 : 1, ry: -0.55, rx: 0.1 })],
    ['#inicio', 'bottom top', P({ x: 3.2 * m, y: mobile ? 2.6 : 2.2, s: mobile ? 0.5 : 0.7, ry: 0.9, rx: 0.3, float: 0.7, dust: 0.6 })],
    ['.about__statement', 'center center', P({ x: mobile ? 1.4 : 4.1, y: mobile ? 3.4 : 1.7, s: mobile ? 0.2 : 0.42, ry: 2.4, rx: -0.2, duck: mobile ? 0 : 1, float: 0.8, dust: 0.55 })],
    ['#processo', 'top top', P({ x: 0.4 * m, y: mobile ? 3.4 : 2.3, s: mobile ? 0.2 : 0.4, ry: 3.8, rx: 0.1, duck: mobile ? 0 : 1, float: 0.4, dust: 0.75, night: 0.45 })],
    ['#processo', 'bottom bottom', P({ x: 3.9 * m, y: mobile ? 3.4 : 2.7, s: 0.28, ry: 5.2, duck: mobile ? 0 : 0.9, float: 0.2, dust: 0.8, night: 0.7 })],
    ['#trabalhos', 'top 40%', P({ x: 3 * m, y: 4.2, s: 0.12, ry: 6, duck: 0, float: 0, dust: 0.55, night: 1 })],
    ['#tecnologia', 'top 70%', P({ x: 0, y: 0.2, s: mobile ? 0.62 : 1.05, ry: TAU + 0.25, duck: 0, points: 0, morph: 0, float: 0, dust: 0.9, night: 1 })],
    ['#tecnologia', 'top 10%', P({ x: 0, y: 0.1, s: mobile ? 0.62 : 1.05, ry: TAU + 0.4, duck: 0, points: 1, morph: 0, float: 0, dust: 0.9, night: 1 })],
    ['#comecar', 'top bottom', P({ x: 0, y: 0, s: mobile ? 0.8 : 1.3, ry: TAU + 1.2, duck: 0, points: 1, morph: 1, float: 0, dust: 1, night: 1 })],
    ['#comecar', 'top top', P({ x: 0, y: 0.8, s: 0.9, ry: TAU + 1.6, duck: 0, points: 0.9, morph: 0.7, float: 0, dust: 0.7, night: 0.6 })],
    ['#comecar', 'bottom bottom', P({ x: 0, y: mobile ? 2.3 : 2.35, s: mobile ? 0.3 : 0.42, ry: TAU * 2, rx: 0.05, duck: 1, points: 0, morph: 0, float: 0.3, dust: 0.3, night: 0 })],
    ['#contato', 'top 30%', P({ x: mobile ? 1.1 : 4.3, y: mobile ? 3.2 : 1.6, s: mobile ? 0.22 : 0.36, ry: TAU * 2 + 0.6, duck: mobile ? 0 : 1, float: 0.5, dust: 0.3, night: 0 })],
    ['#contato', 'bottom bottom', P({ x: mobile ? 1.1 : 4.5, y: mobile ? 3.2 : -0.6, s: mobile ? 0.22 : 0.44, ry: TAU * 2 + 1.2, duck: mobile ? 0 : 1, float: 0.6, dust: 0.3, night: 0 })],
  ];
}
let poseTriggers = [];
function buildPoseTriggers() {
  poseTriggers.forEach((p) => p.st.kill());
  poseTriggers = poseKeys(isMobile()).map(([trigger, start, pose]) => ({ st: ScrollTrigger.create({ trigger, start }), pose }));
}
const smooth = (t) => t * t * (3 - 2 * t);
function updatePose() {
  if (!scene) return;
  const y = lenis ? lenis.scroll : scrollY;
  const keys = poseTriggers;
  if (!keys.length) return;
  let a = keys[0], b = keys[0];
  for (let i = 0; i < keys.length; i++) {
    if (keys[i].st.start <= y) { a = keys[i]; b = keys[Math.min(i + 1, keys.length - 1)]; }
  }
  const span = b.st.start - a.st.start;
  const t = span > 0 ? smooth(Math.min(Math.max((y - a.st.start) / span, 0), 1)) : 0;
  for (const k in a.pose) scene.pose[k] = a.pose[k] + (b.pose[k] - a.pose[k]) * t;
  scene.redraw();
}

/* =================================================================
   COREOGRAFIA
   ================================================================= */
const mm = gsap.matchMedia();

function intro() {
  if (reduced) return;
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.from('.hero__title .line > span', { yPercent: 115, scale: 0.96, opacity: 0, duration: 1.8, stagger: 0.14 }, 0.1)
    .from('.hero__eyebrow > *', { opacity: 0, y: 12, duration: 1.2, stagger: 0.06 }, 0.35)
    .from('.hero__lede', { opacity: 0, y: 24, duration: 1.6 }, 0.6)
    .from('.cloud', { opacity: 0, yPercent: 20, duration: 2.6, ease: 'power2.out', stagger: 0.12 }, 0)
    .from('.sky__day', { scale: 1.12, duration: 3, ease: 'power2.out' }, 0)
    .from(['.hero__cue', '.hero__meta', '.top-cta'], { opacity: 0, duration: 1.2 }, 1.1)
    .from(guide, { opacity: 0, duration: 1 }, 0.4);
  if (scene) { const s = scene.pose.s; scene.pose.s = 0.001; gsap.to(scene.pose, { s, duration: 2.2, ease: 'expo.out', delay: 0.3, onComplete: updatePose }); }
}

/* ---------- DESKTOP ---------- */
mm.add('(min-width: 768px) and (prefers-reduced-motion: no-preference)', () => {
  gsap.set('.cloud--r', { scaleX: -1 });

  // 01 — HERO: fade + scale, atravessando as nuvens
  gsap.timeline({ scrollTrigger: { trigger: '#inicio', start: 'top top', end: '+=120%', pin: true, scrub: 1 } })
    .to('.hero__title', { scale: 1.22, opacity: 0, transformOrigin: '0% 100%', ease: 'power1.in' }, 0)
    .to('.hero__lede', { opacity: 0, y: -40 }, 0)
    .to(['.hero__cue', '.hero__meta', '.hero__eyebrow'], { opacity: 0, duration: 0.3 }, 0)
    .to('.cloud--l', { xPercent: -40, yPercent: -25, scale: 1.5, ease: 'power1.in' }, 0)
    .to('.cloud--r', { xPercent: 45, yPercent: -30, scale: 1.45, ease: 'power1.in' }, 0)
    .to('.cloud--front', { yPercent: -95, scale: 1.9, opacity: 0.2, ease: 'power1.in' }, 0)
    .to('.sky__day', { scale: 1.18, yPercent: 5, ease: 'none' }, 0);

  // 02 — ESTÚDIO: conteúdo lateral + nuvem atravessando
  gsap.fromTo('.about__row--l', { xPercent: -55, opacity: 0.1 }, { xPercent: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: '.about__statement', start: 'top bottom', end: 'center 55%', scrub: 1 } });
  gsap.fromTo('.about__row--r', { xPercent: 55, opacity: 0.1 }, { xPercent: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: '.about__statement', start: 'top bottom', end: 'center 55%', scrub: 1 } });
  gsap.from('.about__answer', { opacity: 0, x: 120, ease: 'power2.out', scrollTrigger: { trigger: '.about__answer', start: 'top 90%', end: 'top 60%', scrub: 1 } });
  gsap.fromTo('.about__drift', { x: '105vw' }, { x: '-110vw', ease: 'none', scrollTrigger: { trigger: '#estudio', start: 'top bottom', end: 'bottom top', scrub: 0.6 } });
  gsap.from('.about__story', { x: -90, opacity: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '.about__grid', start: 'top 78%' } });
  gsap.from('.about__pair > div', { x: 90, opacity: 0, duration: 1.4, stagger: 0.12, ease: 'expo.out', scrollTrigger: { trigger: '.about__grid', start: 'top 78%' } });
  gsap.from('.about__marks li', { x: -60, opacity: 0, duration: 1.2, stagger: 0.12, ease: 'expo.out', scrollTrigger: { trigger: '.about__marks', start: 'top 85%' } });

  // 03 — PROCESSO: viagem horizontal; cada etapa com entrada própria
  const track = $('.process__track');
  const dist = () => track.offsetWidth - innerWidth;
  const hTween = gsap.to(track, { x: () => -dist(), ease: 'none', scrollTrigger: { trigger: '.process__pin', start: 'top top', end: () => '+=' + dist() * 1.05, pin: true, scrub: 1, invalidateOnRefresh: true } });
  gsap.to('.process__path path', { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: '.process__pin', start: 'top top', end: () => '+=' + dist() * 1.05, scrub: 1, invalidateOnRefresh: true } });
  gsap.to('.process__head', { opacity: 0, x: -80, filter: 'blur(8px)', ease: 'none', scrollTrigger: { trigger: '.process__pin', start: 'top top', end: () => '+=' + innerWidth * 0.5, scrub: 1 } });
  gsap.from('.process__head > *', { opacity: 0, filter: 'blur(14px)', y: 30, stagger: 0.1, duration: 1.6, ease: 'power3.out', scrollTrigger: { trigger: '#processo', start: 'top 60%' } });
  const stepST = (el) => ({ trigger: el, containerAnimation: hTween, start: 'left 88%', end: 'left 48%', scrub: 1 });
  $$('.step').forEach((step) => {
    const body = $('.step__body', step), n = $('.step__n', step);
    gsap.fromTo(n, { x: 120 }, { x: -40, ease: 'none', scrollTrigger: { trigger: step, containerAnimation: hTween, start: 'left right', end: 'right left', scrub: true } });
    switch (step.dataset.fx) {
      case 'blur':
        gsap.fromTo(step, { filter: 'blur(22px)', opacity: 0, scale: 1.08 }, { filter: 'blur(0px)', opacity: 1, scale: 1, ease: 'none', scrollTrigger: stepST(step) });
        break;
      case 'clip':
        gsap.fromTo(body, { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none', scrollTrigger: stepST(step) });
        gsap.fromTo(n, { opacity: 0 }, { opacity: 1, ease: 'none', scrollTrigger: stepST(step) });
        break;
      case 'words': {
        const words = splitWords($('p', step));
        gsap.fromTo([$('h3', step), ...words], { yPercent: 120, opacity: 0, filter: 'blur(6px)' }, { yPercent: 0, opacity: 1, filter: 'blur(0px)', stagger: 0.03, ease: 'none', scrollTrigger: stepST(step) });
        break;
      }
      case 'depth':
        gsap.fromTo(step, { scale: 0.45, opacity: 0, rotateX: 50, transformPerspective: 900, filter: 'blur(10px)' }, { scale: 1, opacity: 1, rotateX: 0, filter: 'blur(0px)', ease: 'none', scrollTrigger: stepST(step) });
        break;
      case 'rise':
        gsap.fromTo(step, { y: 220, opacity: 0, filter: 'blur(12px)' }, { y: 0, opacity: 1, filter: 'blur(0px)', ease: 'none', scrollTrigger: stepST(step) });
        break;
    }
  });

  // 04 — TRABALHOS: janela que se expande até ocupar a tela
  gsap.timeline({ scrollTrigger: { trigger: '.work__intro', start: 'top top', end: '+=110%', pin: true, scrub: 1 } })
    .fromTo('.work__window', { clipPath: 'inset(30% 32% 30% 32% round 28px)' }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'power2.inOut', duration: 1 }, 0)
    .fromTo('.work__window-img', { scale: 1.35 }, { scale: 1, ease: 'power2.inOut', duration: 1 }, 0)
    .fromTo('.work__window-copy > *', { opacity: 0, y: 40, scale: 0.92 }, { opacity: 1, y: 0, scale: 1, stagger: 0.08, duration: 0.5 }, 0.35)
    .to('.work__window-copy', { scale: 0.94, yPercent: -8, duration: 0.35 }, 1.05);

  // carrossel espacial: cada projeto vem do fundo, ocupa a cena e se afasta
  const projects = $$('.project');
  gsap.set(projects, { autoAlpha: 0 });
  gsap.set(projects[0], { autoAlpha: 1 });
  const stage = gsap.timeline({
    defaults: { ease: 'power2.out' },
    scrollTrigger: {
      trigger: '.work__stage', start: 'top top', end: '+=' + projects.length * 110 + '%', pin: true, scrub: 1,
      onUpdate: (self) => { if (current === 3) guideExtra.textContent = `Projeto ${Math.min(projects.length, Math.floor(self.progress * projects.length) + 1)}/${projects.length}`; },
    },
  });
  projects.forEach((p, i) => {
    const vis = $('.project__visual', p), info = $$('.project__info > *', p), atmos = $('.project__atmos', p), back = $('.frame--back', p);
    const t0 = i * 1;
    stage.set(p, { autoAlpha: 1 }, t0)
      .fromTo(atmos, { opacity: 0, scale: 1.25 }, { opacity: 0.5, scale: 1, duration: 0.45 }, t0)
      .fromTo(vis, { scale: 0.34, opacity: i === 0 ? 0.6 : 0, yPercent: 12, rotateY: -18, transformPerspective: 1400, filter: i === 0 ? 'blur(3px)' : 'blur(14px)' }, { scale: 1, opacity: 1, yPercent: 0, rotateY: 0, filter: 'blur(0px)', duration: 0.45 }, t0)
      .fromTo(back, { x: -80, y: 40, opacity: 0 }, { x: 0, y: 0, opacity: 0.55, duration: 0.35 }, t0 + 0.25)
      .fromTo(info, { opacity: 0, x: 60 }, { opacity: 1, x: 0, stagger: 0.03, duration: 0.3 }, t0 + 0.2)
      .to(vis, { scale: 1.04, duration: 0.25, ease: 'none' }, t0 + 0.5);
    if (i < projects.length - 1) {
      stage.to(vis, { scale: 1.45, opacity: 0, yPercent: -6, filter: 'blur(12px)', duration: 0.3, ease: 'power2.in' }, t0 + 0.78)
        .to(info, { opacity: 0, x: -50, stagger: 0.015, duration: 0.2, ease: 'power2.in' }, t0 + 0.75)
        .to(atmos, { opacity: 0, duration: 0.3, ease: 'none' }, t0 + 0.8)
        .set(p, { autoAlpha: 0 }, t0 + 1.08);
    } else {
      stage.to({}, { duration: 0.35 }, t0 + 0.75);
    }
  });

  // 05 — DIFERENCIAIS: revelação vertical progressiva
  const words = $$('.diff__words li');
  const list = $('.diff__words');
  const desc = $('.diff__desc'), idxEl = $('.diff__i');
  let lastD = 0;
  const offset = (i) => words[i].offsetTop - words[0].offsetTop;
  const dtl = gsap.timeline({
    scrollTrigger: {
      trigger: '.diff__pin', start: 'top top', end: '+=' + words.length * 55 + '%', pin: true, scrub: 1, invalidateOnRefresh: true,
      onUpdate: (self) => {
        const i = Math.min(words.length - 1, Math.floor(self.progress * words.length));
        if (i === lastD) return;
        const dir = i > lastD ? 1 : -1; lastD = i;
        gsap.timeline()
          .to(desc, { y: -24 * dir, opacity: 0, duration: 0.22, ease: 'power2.in' })
          .add(() => { desc.textContent = words[i].dataset.d; idxEl.textContent = String(i + 1).padStart(2, '0'); })
          .fromTo(desc, { y: 24 * dir, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' });
      },
    },
  });
  words.forEach((w, i) => {
    dtl.to(list, { y: () => -offset(i), duration: 1, ease: 'power2.inOut' }, i)
      .fromTo(w, { '--p': '0%' }, { '--p': '100%', duration: 0.9, ease: 'power1.inOut' }, i + 0.05);
  });
  gsap.from('.diff__eyebrow', { opacity: 0, y: -20, duration: 1.2, scrollTrigger: { trigger: '#diferenciais', start: 'top 60%' } });

  // 06 — TECNOLOGIA: entrada em profundidade + parallax
  gsap.from('.tech__title', { opacity: 0, scale: 0.82, filter: 'blur(16px)', transformOrigin: '0% 50%', ease: 'none', scrollTrigger: { trigger: '#tecnologia', start: 'top 85%', end: 'top 15%', scrub: 1 } });
  const items = $$('.tech__field li');
  const qx = [];
  const ttl = gsap.timeline({ scrollTrigger: { trigger: '#tecnologia', start: 'top top', end: '+=170%', pin: true, scrub: 1 } });
  items.forEach((li, i) => {
    const d = parseFloat(li.dataset.depth);
    li.style.setProperty('--d', d);
    ttl.fromTo(li, { opacity: 0, scale: 0.18, z: -400, filter: 'blur(18px)', transformPerspective: 1000 },
      { opacity: 0.3 + d * 0.55, scale: 1, z: 0, filter: 'blur(0px)', duration: 1, ease: 'power2.out' }, i * 0.35);
    ttl.fromTo(li, { y: d * 70 }, { y: -d * 70, duration: items.length * 0.35 + 1, ease: 'none', immediateRender: false }, 0);
    qx.push([gsap.quickTo(li.children[0], 'x', { duration: 1.2, ease: 'power3.out' }), d]);
  });
  ttl.fromTo('.tech__foot', { opacity: 0 }, { opacity: 1, duration: 0.6 }, items.length * 0.35);
  const onMove = (e) => { const nx = e.clientX / innerWidth - 0.5; qx.forEach(([fn, d]) => fn(nx * d * -60)); };
  addEventListener('pointermove', onMove, { passive: true });

  // 07 — CTA: revelação por máscara circular
  const chars = $$('.cta__line').flatMap(splitChars);
  gsap.timeline({ scrollTrigger: { trigger: '.cta__reveal', start: 'top top', end: '+=140%', pin: true, scrub: 1, onUpdate: (s) => { if (current === 6) setTheme(s.progress < 0.35); } } })
    .fromTo('.cta__reveal', { clipPath: 'circle(6% at 50% 62%)' }, { clipPath: 'circle(80% at 50% 50%)', ease: 'power2.inOut', duration: 1 }, 0)
    .fromTo('.cta__dawn', { scale: 1.4 }, { scale: 1, ease: 'power2.out', duration: 1.2 }, 0)
    .fromTo(chars, { opacity: 0, yPercent: 60, rotate: 6 }, { opacity: 1, yPercent: 0, rotate: 0, stagger: 0.012, duration: 0.4, ease: 'power3.out' }, 0.45)
    .fromTo('.cta__btn', { opacity: 0, y: 30, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.3 }, 0.9);

  // 08 — CONTATO: a frase se dispersa e o contato surge no espaço deixado
  const rnd = gsap.utils.random;
  gsap.timeline({ scrollTrigger: { trigger: '#contato', start: 'top bottom', end: 'top 40%', scrub: 1 } })
    .to(chars, { x: () => rnd(-260, 260), y: () => rnd(-320, -60), rotate: () => rnd(-50, 50), opacity: 0, filter: 'blur(6px)', stagger: { each: 0.004, from: 'random' }, ease: 'power1.in' }, 0)
    .to('.cta__btn', { opacity: 0, scale: 0.7, filter: 'blur(8px)' }, 0)
    .from('.contact__lead > *', { opacity: 0, scale: 0.9, y: () => rnd(-80, 80), x: () => rnd(-60, 60), filter: 'blur(10px)', stagger: 0.05, ease: 'power2.out' }, 0.3)
    .from('.contact__form', { opacity: 0, scale: 0.94, y: 80, filter: 'blur(10px)', ease: 'power2.out' }, 0.4);
  gsap.from('.foot > *', { opacity: 0, y: 20, stagger: 0.08, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: '.foot', start: 'top 95%' } });

  // Atmosfera: céu → altitude → espaço → amanhecer (criado após os pins)
  gsap.to('.sky__high', { opacity: 1, ease: 'none', scrollTrigger: { trigger: '#processo', start: 'top 45%', end: 'top top', scrub: true } });
  gsap.to('.sky__night', { opacity: 1, ease: 'none', scrollTrigger: { trigger: '#trabalhos', start: 'top bottom', end: 'top 30%', scrub: true } });
  gsap.to('.sky__dawn', { opacity: 1, ease: 'none', scrollTrigger: { trigger: '#contato', start: 'top bottom', end: 'top 50%', scrub: true } });

  return () => removeEventListener('pointermove', onMove);
});

/* ---------- CELULAR / TABLET PEQUENO ---------- */
mm.add('(max-width: 767px) and (prefers-reduced-motion: no-preference)', () => {
  gsap.set('.cloud--r', { scaleX: -1 });
  gsap.to('.sky__high', { opacity: 1, ease: 'none', scrollTrigger: { trigger: '#processo', start: 'top 45%', end: 'top top', scrub: true } });
  gsap.to('.sky__night', { opacity: 1, ease: 'none', scrollTrigger: { trigger: '#trabalhos', start: 'top bottom', end: 'top 30%', scrub: true } });
  gsap.to('.sky__dawn', { opacity: 1, ease: 'none', scrollTrigger: { trigger: '#contato', start: 'top bottom', end: 'top 60%', scrub: true } });

  gsap.timeline({ scrollTrigger: { trigger: '#inicio', start: 'top top', end: 'bottom top', scrub: true } })
    .to('.hero__inner', { opacity: 0, scale: 1.1, transformOrigin: '0% 100%' }, 0)
    .to('.cloud--l', { xPercent: -30, yPercent: -40 }, 0)
    .to('.cloud--r', { xPercent: 30, yPercent: -50 }, 0)
    .to('.cloud--front', { yPercent: -60, opacity: 0.2 }, 0);

  gsap.fromTo('.about__row--l', { xPercent: -40 }, { xPercent: 0, scrollTrigger: { trigger: '.about__statement', start: 'top bottom', end: 'center center', scrub: true } });
  gsap.fromTo('.about__row--r', { xPercent: 40 }, { xPercent: 0, scrollTrigger: { trigger: '.about__statement', start: 'top bottom', end: 'center center', scrub: true } });
  gsap.fromTo('.about__drift', { x: '60vw' }, { x: '-160vw', ease: 'none', scrollTrigger: { trigger: '#estudio', start: 'top bottom', end: 'bottom top', scrub: true } });
  gsap.from(['.about__answer', '.about__story', '.about__pair > div', '.about__marks li'], { opacity: 0, x: (i) => (i % 2 ? 40 : -40), duration: 1, ease: 'expo.out', stagger: 0.06, scrollTrigger: { trigger: '.about__answer', start: 'top 85%' } });

  $$('.step').forEach((step) => gsap.from(step, { opacity: 0, filter: 'blur(14px)', y: 40, duration: 1.2, ease: 'power3.out', scrollTrigger: { trigger: step, start: 'top 85%' } }));

  gsap.fromTo('.work__window', { clipPath: 'inset(22% 10% 22% 10% round 22px)' }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none', scrollTrigger: { trigger: '.work__intro', start: 'top 80%', end: 'bottom bottom', scrub: true } });
  $$('.project').forEach((p) => {
    gsap.fromTo($('.project__visual', p), { scale: 0.7, opacity: 0, filter: 'blur(8px)' }, { scale: 1, opacity: 1, filter: 'blur(0px)', ease: 'none', scrollTrigger: { trigger: p, start: 'top 85%', end: 'top 30%', scrub: true } });
    gsap.from($$('.project__info > *', p), { opacity: 0, y: 24, stagger: 0.05, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: $('.project__info', p), start: 'top 85%' } });
  });

  $$('.diff__words li').forEach((w) => gsap.fromTo(w, { '--p': '0%' }, { '--p': '100%', ease: 'none', scrollTrigger: { trigger: w, start: 'top 85%', end: 'top 45%', scrub: true } }));

  $$('.tech__field li').forEach((li) => {
    li.style.setProperty('--d', li.dataset.depth);
    gsap.from(li, { opacity: 0, scale: 0.6, filter: 'blur(10px)', duration: 1, ease: 'power3.out', scrollTrigger: { trigger: li, start: 'top 92%' } });
  });

  const chars = $$('.cta__line').flatMap(splitChars);
  gsap.fromTo('.cta__reveal', { clipPath: 'circle(8% at 50% 60%)' }, { clipPath: 'circle(90% at 50% 50%)', ease: 'none', scrollTrigger: { trigger: '#comecar', start: 'top 90%', end: 'top top', scrub: true } });
  gsap.from(chars, { opacity: 0, yPercent: 60, stagger: 0.01, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: '.cta__title', start: 'top 75%' } });
  gsap.from(['.contact__lead > *', '.contact__form'], { opacity: 0, y: 40, filter: 'blur(8px)', stagger: 0.06, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: '#contato', start: 'top 80%' } });
});

/* ---------- movimento reduzido: tudo visível e estático ---------- */
function reducedSky(i) {
  // sem transições: cada seção simplesmente mostra seu céu
  gsap.set('.sky__high', { opacity: i >= 2 ? 1 : 0 });
  gsap.set('.sky__night', { opacity: i >= 3 && i <= 5 ? 1 : 0 });
  gsap.set('.sky__dawn', { opacity: i >= 6 ? 1 : 0 });
}

/* ---------- rastreio de seção + progresso (todas as larguras) ---------- */
let sectionTriggers = [];
function buildTracking() {
  sectionTriggers.forEach((s) => s.kill());
  sectionTriggers = sections.map((s, i) => ScrollTrigger.create({
    trigger: s, start: 'top 50%', end: 'bottom 50%',
    onToggle: (self) => { if (self.isActive) setSection(i); },
  }));
}
ScrollTrigger.create({
  start: 0, end: 'max',
  onUpdate: (self) => { gsap.set('.guide__progress', { strokeDashoffset: 1 - self.progress }); updatePose(); },
});
ScrollTrigger.addEventListener('refresh', () => {
  const max = ScrollTrigger.maxScroll(window) || 1;
  buildTicks(sectionTriggers.map((s) => Math.max(0, s.start + innerHeight * 0.5)), max);
  if (current >= 0) placeGuide(guideMode, true);
  updatePose();
});
let lastW = innerWidth;
addEventListener('resize', () => {
  if (Math.abs(innerWidth - lastW) < 2) return;
  const crossed = (lastW < 768) !== (innerWidth < 768);
  lastW = innerWidth;
  if (crossed) buildPoseTriggers();
});

/* =================================================================
   CONTADORES, ANO, FORMULÁRIO (Formspree preservado)
   ================================================================= */
$$('.about__n[data-count]').forEach((el) => {
  const end = +el.dataset.count;
  if (reduced) return;
  const o = { v: 0 };
  ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => gsap.to(o, { v: end, duration: 2, ease: 'power3.out', onUpdate: () => { el.textContent = Math.round(o.v); } }) });
});
const yearEl = $('#year'); if (yearEl) yearEl.textContent = new Date().getFullYear();

const FORMSPREE_ID = 'mdajkldg'; // mesmo ID do site anterior
const form = $('#contactForm');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('#cf-name').value.trim();
  const email = $('#cf-email').value.trim();
  const subject = $('#cf-subject').value.trim();
  const message = $('#cf-message').value.trim();
  const status = $('#cfStatus');
  const btn = $('#cfSubmit');
  const btnHTML = btn.innerHTML;
  if (!name || !email || !message) { status.className = 'cf-status mono error'; status.textContent = 'Preencha pelo menos nome, e-mail e mensagem.'; return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { status.className = 'cf-status mono error'; status.textContent = 'Informe um endereço de e-mail válido.'; return; }
  btn.disabled = true; btn.textContent = 'Enviando…'; status.className = 'cf-status mono'; status.textContent = '';
  try {
    const res = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: name, email, projeto: subject || '(não informado)', mensagem: message, _subject: `Novo contato via DuckStudio — ${name}` }),
    });
    if (!res.ok) throw new Error('falha');
    status.className = 'cf-status mono success';
    status.textContent = 'Mensagem enviada! Retornaremos em até 24h.';
    form.reset();
  } catch (err) {
    status.className = 'cf-status mono error';
    status.textContent = 'Não foi possível enviar agora. Tente novamente ou fale pelo WhatsApp.';
  }
  btn.disabled = false; btn.innerHTML = btnHTML;
});

/* =================================================================
   BOOT — preloader discreto, depois a entrada
   ================================================================= */
const counter = $('.loader__count');
const heroImg = new Image();
heroImg.src = isMobile() ? 'assets/img/sky-hero-m.webp' : 'assets/img/sky-hero.webp';
const ready = Promise.all([
  heroImg.decode ? heroImg.decode().catch(() => {}) : Promise.resolve(),
  document.fonts ? document.fonts.ready.catch(() => {}) : Promise.resolve(),
  scenePromise,
]);
const minTime = new Promise((r) => setTimeout(r, reduced ? 0 : 1500));
const cnt = { v: 0 };
if (!reduced) gsap.to(cnt, { v: 92, duration: 1.4, ease: 'power2.out', onUpdate: () => { counter.textContent = String(Math.round(cnt.v)).padStart(3, '0'); } });
Promise.race([Promise.all([ready, minTime]), new Promise((r) => setTimeout(r, 4500))]).then(() => {
  counter.textContent = '100';
  buildPoseTriggers();
  buildTracking();
  ScrollTrigger.refresh();
  gsap.set(guide, guideTarget('center'));
  document.body.classList.remove('is-loading');
  setSection(0);
  updatePose();
  intro();
  // imagens carregadas sob demanda podem mudar alturas: recalcula os gatilhos
  let rt;
  $$('main img').forEach((img) => { if (!img.complete) img.addEventListener('load', () => { clearTimeout(rt); rt = setTimeout(() => ScrollTrigger.refresh(), 200); }, { once: true }); });
});

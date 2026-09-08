// The browser remembers scroll position across reloads by default, which
// on a scroll-driven page like this makes every scroll-triggered animation
// (video scrub, card stack, blur reveals) look like it "already happened"
// the instant the page loads. Always start at the top instead.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

// ---------- Page loader ---------- //
// Same brief splash as the real recap app - a plain timed fade, not tied to
// actual asset-load state. The hero intro's word-by-word reveal and the
// floating menu's slide-up entrance are timed to land right as it clears,
// so the page doesn't just sit there fully formed underneath a fading curtain.
const pageLoader = document.getElementById('page-loader');
const heroIntroEl = document.getElementById('hero-intro');
const floatMenuEl = document.querySelector('.float-menu');
setTimeout(() => {
  pageLoader?.classList.add('is-hidden');
  heroIntroEl?.classList.add('is-revealed');
  floatMenuEl?.classList.remove('is-entering');
}, 1100);

const heroSection = document.getElementById('hero');
const heroVideo = document.getElementById('hero-video');
const heroPlayBtn = document.getElementById('hero-play-btn');
const heroIntro = document.getElementById('hero-intro');
const heroCard = document.querySelector('.hero__card');

const INTRO_FADE_RANGE = 0.08; // fraction of scroll progress over which the intro text fades out
const HERO_ZOOM_OUT = 0.1; // how much the hero card shrinks over the zoom phase (zero.university-style)
const HERO_ZOOM_PHASE_VH = 0.6; // extra scroll (in viewport-heights), *after* the video finishes, dedicated to the zoom-out

// Scroll-scrubbed video: while the hero section is passing through the
// viewport, the video's currentTime is driven by scroll progress instead of
// playing on its own. Pressing play switches to normal autoplay; scrolling
// again takes control back. The pinned scroll range is split into two
// back-to-back phases: the video scrubs through first, then (only once it
// has fully played) the extra HERO_ZOOM_PHASE_VH of scroll zooms the card
// out - the two don't run at the same time.
let scrubbing = true;
let scrubQueued = false;
let pendingVideoTime = null;
let videoSeekInFlight = false;

function applyScrub() {
  scrubQueued = false;
  if (!scrubbing || !heroVideo.duration) return;

  const totalScrollRange = heroSection.offsetHeight - window.innerHeight;
  const zoomPhasePx = HERO_ZOOM_PHASE_VH * window.innerHeight;
  const videoPhasePx = Math.max(0, totalScrollRange - zoomPhasePx);
  const scrolled = window.scrollY - heroSection.offsetTop;

  const videoProgress = videoPhasePx > 0 ? Math.min(1, Math.max(0, scrolled / videoPhasePx)) : 1;
  const zoomProgress = zoomPhasePx > 0
    ? Math.min(1, Math.max(0, (scrolled - videoPhasePx) / zoomPhasePx))
    : 0;

  // A raw 'scroll' listener fires far more than once per frame (a trackpad
  // can send dozens of events per frame), and each currentTime write is an
  // async seek - writing on every event queues up seeks faster than the
  // video can complete them, which is what actually reads as stutter.
  // Collapsing to one seek per rendered frame, and skipping it entirely
  // while a previous seek is still resolving, keeps it to only the seeks
  // that can actually complete in time.
  pendingVideoTime = videoProgress * heroVideo.duration;
  if (!videoSeekInFlight) {
    videoSeekInFlight = true;
    heroVideo.currentTime = pendingVideoTime;
  }

  if (heroIntro) {
    const introOpacity = Math.max(0, 1 - videoProgress / INTRO_FADE_RANGE);
    heroIntro.style.opacity = introOpacity;
    heroIntro.style.visibility = introOpacity > 0 ? 'visible' : 'hidden';
  }

  if (heroCard) {
    heroCard.style.transform = `scale(${1 - zoomProgress * HERO_ZOOM_OUT})`;
  }
}

function updateScrub() {
  if (scrubQueued) return;
  scrubQueued = true;
  requestAnimationFrame(applyScrub);
}

window.addEventListener('scroll', updateScrub, { passive: true });
heroVideo.addEventListener('loadedmetadata', updateScrub);
heroVideo.addEventListener('seeked', () => {
  videoSeekInFlight = false;
  if (scrubbing && pendingVideoTime != null && Math.abs(heroVideo.currentTime - pendingVideoTime) > 0.02) {
    updateScrub();
  }
});

heroPlayBtn?.addEventListener('click', () => {
  if (heroVideo.paused) {
    scrubbing = false;
    heroVideo.play();
  } else {
    heroVideo.pause();
    scrubbing = true;
    updateScrub();
  }
});

// ---------- Benefits: scroll-driven card stack ----------
//
// The pinned scene plays out in 5 equal stages as the section scrolls by:
// each stage sends the next sticky note (starting with the orange intro
// card) flying straight up and out, revealing the one stacked behind it.
const benefitsSection = document.getElementById('benefits');
const benefitsHeader = document.getElementById('benefits-header');
const benefitsCards = document.querySelectorAll('.benefits__card');

benefitsCards.forEach((card) => {
  const index = Number(card.dataset.cardIndex);
  card.style.setProperty('--fade-delay', `${index * 0.12}s`);
});

function clamp01(n) {
  return Math.min(1, Math.max(0, n));
}

function updateBenefits() {
  if (!benefitsSection) return;

  const scrollRange = benefitsSection.offsetHeight - window.innerHeight;
  const progress = scrollRange > 0
    ? clamp01((window.scrollY - benefitsSection.offsetTop) / scrollRange)
    : 0;

  const stageCount = benefitsCards.length + 1; // header + one per card
  const stage = progress * stageCount;

  const headerP = clamp01(stage);
  if (benefitsHeader) {
    benefitsHeader.style.transform = `translateY(${headerP * -60}%)`;
    benefitsHeader.classList.toggle('is-visible', headerP < 1);
  }

  const CARD_REST = 0.35; // fraction of each card's stage it just sits still before sliding away
  const lastIndex = benefitsCards.length - 1;

  benefitsCards.forEach((card) => {
    const index = Number(card.dataset.cardIndex);
    // The back-most card in the pile stays put instead of flying off too -
    // otherwise the screen empties out right before the next section starts,
    // which reads as an oversized gap.
    if (index === lastIndex) {
      card.style.transform = `rotate(var(--rotate, 0deg))`;
      card.classList.toggle('is-visible', headerP >= 1);
      return;
    }

    const localP = clamp01(stage - (index + 1));
    const cardP = clamp01((localP - CARD_REST) / (1 - CARD_REST));
    card.style.transform = `rotate(var(--rotate, 0deg)) translateY(${cardP * -60}%)`;
    card.classList.toggle('is-visible', headerP >= 1 && cardP < 1);
  });
}

window.addEventListener('scroll', updateBenefits, { passive: true });
window.addEventListener('resize', updateBenefits);
updateBenefits();

// ---------- Generic scroll reveal ----------
//
// Any element with class "reveal" (fade/slide) or "blur-line" (blur reveal,
// one line at a time) animates in the first time it enters the viewport.
// Elements sharing a [data-reveal-group] wrapper are staggered in document
// order, 0.12s apart, instead of all appearing at once.
const REVEAL_SELECTOR = '.reveal, .blur-line, .scribble-arrow';

document.querySelectorAll('[data-reveal-group]').forEach((group) => {
  group.querySelectorAll(REVEAL_SELECTOR).forEach((el, i) => {
    el.style.transitionDelay = `${i * 0.12}s`;
  });
});

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });

document.querySelectorAll(REVEAL_SELECTOR).forEach((el) => revealObserver.observe(el));

// ---------- Product: simplified live board demo ----------
//
// A cut-down copy of the real recap board: cards can be dragged around,
// but there's no panning/zooming the board itself and no click-to-open
// (this is just a landing-page taste of the product, not the app). Plays
// the same splash-loader-then-cards-drop-in entrance as the real app, the
// first time it scrolls into view.
function playOneShotEntrance(el, loadingClass) {
  el.classList.add(loadingClass);
  el.addEventListener('animationend', () => el.classList.remove(loadingClass), { once: true });
}

const boardDemo = document.getElementById('board-demo');
const boardDemoLoader = document.getElementById('board-demo-loader');
const boardDemoWorld = document.getElementById('board-demo-world');

if (boardDemo && boardDemoWorld) {
  const boardObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      boardObserver.unobserve(entry.target);
      boardDemo.classList.add('is-ready');
      setTimeout(() => {
        boardDemoLoader?.classList.add('is-hidden');
        boardDemoWorld.querySelectorAll('.note').forEach((note) => {
          note.classList.remove('note--pending');
          playOneShotEntrance(note, 'note--loading-in');
        });
      }, 1100);
    });
  }, { threshold: 0.3 });
  boardObserver.observe(boardDemo);

  // Drag-only interaction: no board pan/zoom, no click-to-open - just
  // moving a card is enough of a taste of the real board's feel.
  let dragTarget = null;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  function pointerToBoard(e) {
    const rect = boardDemoWorld.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onNotePointerDown(e) {
    const note = e.currentTarget;
    // Read the note's actual current position via offsetLeft/offsetTop
    // (unaffected by its rotate() transform) rather than parsing
    // note.style.left/top - those start out as percentages (for centering),
    // and parseFloat('38%') silently returns 38 as if it were pixels, which
    // used to send the note flying to the wrong spot on the very first
    // drag. getBoundingClientRect was tried too, but a rotated note's
    // bounding box doesn't line up with its own left/top, causing a small
    // snap the instant you grab it.
    const worldRect = boardDemoWorld.getBoundingClientRect();
    dragTarget = note;
    dragOffsetX = e.clientX - (worldRect.left + note.offsetLeft);
    dragOffsetY = e.clientY - (worldRect.top + note.offsetTop);
    note.style.left = `${note.offsetLeft}px`;
    note.style.top = `${note.offsetTop}px`;
    note.classList.add('is-dragging');
    try { note.setPointerCapture(e.pointerId); } catch {}
    e.stopPropagation();
  }

  function onNotePointerMove(e) {
    if (!dragTarget) return;
    const p = pointerToBoard(e);
    dragTarget.style.left = `${p.x - dragOffsetX}px`;
    dragTarget.style.top = `${p.y - dragOffsetY}px`;
  }

  function onNotePointerUp(e) {
    if (!dragTarget) return;
    dragTarget.classList.remove('is-dragging');
    try { dragTarget.releasePointerCapture(e.pointerId); } catch {}
    dragTarget = null;
  }

  boardDemoWorld.querySelectorAll('.note').forEach((note) => {
    note.addEventListener('pointerdown', onNotePointerDown);
    note.addEventListener('pointermove', onNotePointerMove);
    note.addEventListener('pointerup', onNotePointerUp);
  });
}

// ---------- Services: pinned scroll stack ----------
//
// Same idea as the Benefits card pile: all 3 steps sit pinned in the same
// spot, and scrolling sends each one sliding up and out in turn, front
// stage first, revealing the next one underneath. The last stage stays
// put instead of also sliding away, so the section hands off cleanly into
// whatever comes after it.
const servicesSection = document.getElementById('services');
const serviceStages = document.querySelectorAll('.services__stage');

function updateServices() {
  if (!servicesSection || !serviceStages.length) return;

  const scrollRange = servicesSection.offsetHeight - window.innerHeight;
  const progress = scrollRange > 0
    ? clamp01((window.scrollY - servicesSection.offsetTop) / scrollRange)
    : 0;

  const stage = progress * serviceStages.length;
  const lastIndex = serviceStages.length - 1;

  serviceStages.forEach((el) => {
    const index = Number(el.dataset.stageIndex);
    if (index === lastIndex) {
      el.style.transform = 'translateY(0)';
      return;
    }
    const localP = clamp01(stage - index);
    el.style.transform = `translateY(${localP * -110}%)`;
  });
}

window.addEventListener('scroll', updateServices, { passive: true });
window.addEventListener('resize', updateServices);
updateServices();

// ---------- Services (crossfade variant) ----------
//
// Alternative to the slide-stack above (see index-services-slide-backup.html
// for that one): stages stay in place and crossfade into each other, with
// each stage's words fading/sliding in one at a time while it's active -
// closer to the reference the user pointed at (zero.university).
const fadeSection = document.getElementById('services');
const fadeStages = document.querySelectorAll('.services-fade__stage');

fadeStages.forEach((stage) => {
  stage.querySelectorAll('[data-split-words]').forEach((el) => {
    const words = el.textContent.split(' ');
    el.textContent = '';
    words.forEach((word, i) => {
      const span = document.createElement('span');
      span.className = 'word-reveal';
      span.textContent = word;
      span.style.transitionDelay = `${i * 0.03}s`;
      el.appendChild(span);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
  });
});

function updateServicesFade() {
  if (!fadeSection || !fadeStages.length) return;

  const scrollRange = fadeSection.offsetHeight - window.innerHeight;
  const progress = scrollRange > 0
    ? clamp01((window.scrollY - fadeSection.offsetTop) / scrollRange)
    : 0;

  const activeIndex = Math.min(fadeStages.length - 1, Math.floor(progress * fadeStages.length));

  fadeStages.forEach((stage) => {
    const index = Number(stage.dataset.stageIndex);
    stage.classList.toggle('is-active', index === activeIndex);
  });
}

window.addEventListener('scroll', updateServicesFade, { passive: true });
window.addEventListener('resize', updateServicesFade);
updateServicesFade();

// ---------- Float menu: hide once the CTA form is reachable ----------
//
// The floating Join-beta pill is redundant (and visually overlaps) once the
// CTA's own email form has scrolled into view, so it slides itself out of
// the way for that whole final stretch of the page.
const floatMenu = document.querySelector('.float-menu');
const ctaFormWrap = document.querySelector('.cta__form-wrap');

if (floatMenu && ctaFormWrap) {
  const floatMenuObserver = new IntersectionObserver(([entry]) => {
    floatMenu.classList.toggle('is-hidden', entry.isIntersecting);
  }, { threshold: 0.1 });
  floatMenuObserver.observe(ctaFormWrap);
}

// ---------- Float menu: section-jump panel ----------
//
// The hamburger button opens a small card of anchor links above the pill
// (matching the zero.university reference the user pointed at), and swaps
// to a close icon while it's open.
const menuBtn = document.getElementById('hero-menu-btn');
const menuPanel = document.getElementById('float-menu-panel');

function setMenuOpen(open) {
  if (!menuBtn || !menuPanel) return;
  menuPanel.classList.toggle('is-open', open);
  // The hamburger-to-close morph is pure CSS (.float-menu__hamburger-line
  // rules keyed off this same attribute) - the two bars rotate into an X
  // instead of swapping icon images.
  menuBtn.setAttribute('aria-expanded', String(open));
}

menuBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  setMenuOpen(!menuPanel.classList.contains('is-open'));
});

menuPanel?.addEventListener('click', (e) => {
  if (e.target.tagName === 'A') setMenuOpen(false);
});

document.addEventListener('click', (e) => {
  if (menuPanel?.classList.contains('is-open') && !floatMenu.contains(e.target)) {
    setMenuOpen(false);
  }
});

// ---------- "Join beta" links: skip past the CTA reveal, not to its top ----------
//
// #cta's own top edge is the *start* of its reveal (see .light-content's
// negative margin in styles.css) - jumping a plain anchor link there lands
// right where .light-content is still fully covering the form, which reads
// as "the link is broken". Scroll past that overlap instead, landing right
// where the form is actually visible.
const ctaSection = document.getElementById('cta');
const lightContent = document.querySelector('.light-content');

document.querySelectorAll('a[href="#cta"]').forEach((link) => {
  link.addEventListener('click', (e) => {
    if (!ctaSection || !lightContent) return;
    e.preventDefault();
    const overlapPx = Math.abs(parseFloat(getComputedStyle(lightContent).marginBottom)) || 0;
    const target = ctaSection.getBoundingClientRect().top + window.scrollY + overlapPx + 32;
    window.scrollTo({ top: target, behavior: 'smooth' });
  });
});

// ---------- Footer wordmark: fit to the exact content width ----------
//
// A block element's own box always fills its container regardless of how
// long its text is, so no vw-based font-size can make the glyphs themselves
// touch the edge (kerning/letter shapes eat into the box unpredictably).
// Instead, measure the actual rendered text width at the current font-size
// and rescale so it exactly matches the available width.
const footerWordmark = document.querySelector('.site-footer__wordmark');

function fitFooterWordmark() {
  if (!footerWordmark) return;
  const availableWidth = footerWordmark.getBoundingClientRect().width;
  const range = document.createRange();
  range.selectNodeContents(footerWordmark);
  const textWidth = range.getBoundingClientRect().width;
  if (!textWidth || !availableWidth) return;
  const currentFontSize = parseFloat(getComputedStyle(footerWordmark).fontSize);
  footerWordmark.style.fontSize = `${currentFontSize * (availableWidth / textWidth)}px`;
}

window.addEventListener('resize', fitFooterWordmark);
document.fonts.ready.then(fitFooterWordmark);
fitFooterWordmark();

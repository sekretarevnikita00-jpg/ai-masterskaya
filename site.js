'use strict';

const $ = selector => document.querySelector(selector);
const all = selector => Array.from(document.querySelectorAll(selector));
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const desktopMotion = matchMedia('(min-width: 950px) and (min-height: 670px) and (prefers-reduced-motion: no-preference)');
const tallScreen = matchMedia('(min-height: 690px) and (prefers-reduced-motion: no-preference)');
const projects = $('#projects');
const gallery = $('.gallery');
const cards = all('.project-card');
const galleryCount = $('.gallery-count');
const stepButtons = all('[data-gallery-step]');
const hero = $('.hero');
const art = $('.hero-art');
const world = $('.atelier-world');
const field = window.createAtelierField($('.atelier-field'));
const filmFrames = all('.flight-frames i');
const tunnel = window.createPortalTunnel($('.portal-tunnel'));
const program = $('#program');
const prices = $('#prices');
const pageProgress = $('.page-progress');

const palette = [[124, 202, 232], [237, 151, 103], [194, 157, 241]];
const clamp = (value, lower, upper) => Math.max(lower, Math.min(upper, value));
const mix = (a, b, t) => a + (b - a) * t;
const range = (value, from, to) => clamp((value - from) / (to - from), 0, 1);
const smooth = value => value * value * (3 - 2 * value);
const scrollMode = () => reducedMotion.matches ? 'instant' : 'smooth';

let galleryIndex = -1;
let frameRequested = false;
let currentSlide = null;
let pointerX = 0;
let pointerY = 0;
let currentPointerX = 0;
let currentPointerY = 0;
let lastScroll = window.scrollY;
let momentum = 0;
let cardOffsets = [];
let sceneHeight = window.innerHeight;

function property(element, name, value) {
  element.style.setProperty(name, value);
}

function setGalleryIndex(index) {
  if (galleryIndex === index) return;
  galleryIndex = index;
  galleryCount.textContent = String(index + 1).padStart(2, '0') + ' / ' + String(cards.length).padStart(2, '0');
  stepButtons[0].disabled = index === 0;
  stepButtons[1].disabled = index === cards.length - 1;
}

function paintReel(slide) {
  const first = Math.floor(slide);
  const second = Math.min(first + 1, cards.length - 1);
  const blend = smooth(slide - first);
  const color = palette[first].map((value, i) => Math.round(mix(value, palette[second][i], blend)));
  property(projects, '--reel-rgb', color.join(' '));
  property(projects, '--reel-angle', (130 + slide * 110).toFixed(1) + 'deg');
  property(projects, '--reel-fill', (slide / (cards.length - 1)).toFixed(3));
}

function paintWorld(scroll, heroRect, reelRect, slide) {
  const reelStart = scroll + reelRect.top;
  const enter = smooth(range(scroll, reelStart - sceneHeight * .62, reelStart + sceneHeight * .13));
  const afterReel = 1 - smooth(range(reelRect.bottom, sceneHeight * .04, sceneHeight * .68));
  const priceEntry = smooth(range(sceneHeight - prices.getBoundingClientRect().top, 0, sceneHeight * .95));
  const values = [
    clamp(1 - slide, 0, 1),
    clamp(1 - Math.abs(slide - 1), 0, 1),
    clamp(slide - 1, 0, 1)
  ];
  const blue = enter * values[0] * .61 * (1 - afterReel);
  const copper = enter * values[1] * .63 * (1 - afterReel) + priceEntry * .26;
  const violet = enter * values[2] * .63 * (1 - afterReel) + afterReel * .29 * (1 - priceEntry);
  property(world, '--world-hero', (1 - enter).toFixed(3));
  property(world, '--world-blue', blue.toFixed(3));
  property(world, '--world-copper', copper.toFixed(3));
  property(world, '--world-violet', violet.toFixed(3));
  property(world, '--world-drift', (Math.sin(scroll / 740) * 36).toFixed(1) + 'px');
  property(world, '--world-depth', (.18 + enter * .76).toFixed(3));
  property(world, '--world-vignette', (.89 - enter * .22).toFixed(3));
  property(world, '--field-alpha', (.57 + enter * .16 - priceEntry * .16).toFixed(3));
  const nearest = Math.min(Math.floor(slide), 2);
  const target = Math.min(nearest + 1, 2);
  const color = palette[nearest].map((value, index) => Math.round(mix(value, palette[target][index], slide - nearest)));
  const ambient = color.map((value, index) => Math.round(mix(value, [230, 169, 133][index], priceEntry * .75)));
  property(world, '--atelier-rgb', ambient.join(' '));
  const hue = mix(mix(197, 203 + slide * 25, enter), 27, priceEntry * .85);
  field.render({
    progress: clamp(scroll / Math.max(1, document.documentElement.scrollHeight - sceneHeight), 0, 1),
    hue,
    pointerX: currentPointerX,
    pointerY: currentPointerY,
    intensity: heroRect.bottom > 0 ? .56 : .73 - priceEntry * .18
  });
}

function paintHero(progress) {
  const passage = smooth(progress);
  const departing = smooth(range(progress, .05, .52));
  const pulse = Math.sin(Math.PI * range(progress, .38, 1));
  property(hero, '--hero-progress', progress.toFixed(3));
  property(hero, '--hero-text-opacity', (1 - departing).toFixed(3));
  property(hero, '--hero-text-x', (-departing * 68).toFixed(1) + 'px');
  property(hero, '--hero-text-y', (-departing * 29).toFixed(1) + 'px');
  property(world, '--world-zoom', (1.045 + passage * 1.17).toFixed(3));
  property(world, '--world-x', (currentPointerX * 19 - passage * 62).toFixed(1) + 'px');
  property(world, '--world-y', (currentPointerY * 13 + passage * 40).toFixed(1) + 'px');
  property(world, '--world-roll', (currentPointerX * 1.8 - Math.sin(progress * Math.PI) * 8.5).toFixed(2) + 'deg');
  property(art, '--hero-flash', (pulse * .42).toFixed(3));
  const tunnelHandoff = 1 - smooth(range(progress, .74, 1));
  property(art, '--tunnel-opacity', ((.5 + passage * .42) * tunnelHandoff).toFixed(3));
  tunnel.render(progress, currentPointerX, currentPointerY);

  property(hero, '--flight-opacity', (Math.sin(Math.PI * range(progress, .23, 1)) * .91).toFixed(3));
  filmFrames.forEach((frame, index) => {
    const sweep = range(progress, .21 + index * .085, .87 + index * .04);
    const direction = index === 1 ? 1 : -1;
    const x = direction * (sweep * 67 + index * 1.5) - 8;
    const y = Math.sin(sweep * Math.PI * 1.4 + index) * 17 + index * 9 - 12;
    const z = -470 + sweep * 735;
    frame.style.transform = 'translate3d(' + x + 'vw,' + y + 'vh,' + z + 'px) rotateY(' + (-direction * (22 + sweep * 26)) + 'deg) rotateZ(' + (direction * sweep * 42) + 'deg)';
  });
}

function paintCards(slide, entry, exit) {
  const interval = Math.min(window.innerWidth * .56, 900);
  const opening = 1 - entry;
  const closing = 1 - exit;
  cards.forEach((card, index) => {
    const offset = index - slide;
    const distance = Math.abs(offset);
    const orbit = Math.sin(offset * Math.PI / 2);
    const flutter = Math.sin(slide * Math.PI) * 3;
    property(card, '--film-x', (offset * interval + opening * 124 - closing * 137 + currentPointerX * (14 - distance * 9)).toFixed(1) + 'px');
    property(card, '--film-y', (orbit * 69 + opening * 124 - closing * 76 + currentPointerY * 17 + momentum * offset * 6).toFixed(1) + 'px');
    property(card, '--film-z', (-distance * 365 + 62 - opening * 412 - closing * 195).toFixed(1) + 'px');
    property(card, '--film-pitch', (-currentPointerY * 6 + orbit * 12).toFixed(2) + 'deg');
    property(card, '--film-yaw', (-orbit * 46 + currentPointerX * 8).toFixed(2) + 'deg');
    property(card, '--film-roll', (orbit * 17 + flutter - momentum * 3 + opening * 24 - closing * 14).toFixed(2) + 'deg');
    property(card, '--film-alpha', (clamp(1.09 - distance * .29, .23, 1) * (.27 + entry * .73)).toFixed(3));
    property(card, '--picture-x', (currentPointerX * -11 + orbit * 18).toFixed(1) + 'px');
    property(card, '--picture-y', (currentPointerY * -9).toFixed(1) + 'px');
    property(card, '--picture-scale', (1.13 + .045 * Math.min(distance, 1)).toFixed(3));
  });
}

function updateMotion() {
  frameRequested = false;
  const scroll = window.scrollY;
  const docTravel = document.documentElement.scrollHeight - sceneHeight;
  property(pageProgress, '--page-progress', clamp(scroll / Math.max(1, docTravel), 0, 1).toFixed(4));
  let keepMoving = false;
  const heroRect = hero.getBoundingClientRect();
  const reelRect = projects.getBoundingClientRect();
  let visualSlide = 0;

  if (!reducedMotion.matches) {
    currentPointerX = mix(currentPointerX, pointerX, .17);
    currentPointerY = mix(currentPointerY, pointerY, .17);
    keepMoving = Math.abs(pointerX - currentPointerX) + Math.abs(pointerY - currentPointerY) > .007;
    if (heroRect.bottom > 0 && heroRect.top < sceneHeight) {
      const heroTravel = tallScreen.matches ? heroRect.height - sceneHeight : heroRect.height;
      paintHero(clamp(-heroRect.top / Math.max(1, heroTravel), 0, 1));
    }
    property(program, '--program-glow', clamp(program.getBoundingClientRect().top * -.1, -45, 90).toFixed(1) + 'px');
    property(prices, '--price-glow', clamp(prices.getBoundingClientRect().top * .19, -115, 125).toFixed(1) + 'px');
  }

  if (desktopMotion.matches) {
    const rect = reelRect;
    const travel = rect.height - sceneHeight;
    const progress = clamp(-rect.top / Math.max(1, travel), 0, 1);
    const target = progress * (cards.length - 1);
    currentSlide = currentSlide === null ? target : mix(currentSlide, target, .19);
    const settling = Math.abs(target - currentSlide) > .002;
    if (!settling) currentSlide = target;
    momentum = mix(momentum, clamp((scroll - lastScroll) / 17, -3.5, 3.5), .25);
    if (rect.bottom > -30 && rect.top < sceneHeight + 30) {
      const entry = smooth(range(sceneHeight * .72 - rect.top, 0, sceneHeight * .72));
      const exit = smooth(range(rect.bottom, sceneHeight * .12, sceneHeight * .80));
      paintCards(currentSlide, entry, exit);
      paintReel(currentSlide);
      property(projects, '--reel-enter', entry.toFixed(3));
      property(projects, '--reel-exit', exit.toFixed(3));
      property(projects, '--reel-caption-y', ((1 - entry) * 64 - (1 - exit) * 37).toFixed(1) + 'px');
      keepMoving = keepMoving || settling || Math.abs(momentum) > .02;
    }
    visualSlide = currentSlide;
    setGalleryIndex(Math.round(currentSlide));
  } else {
    const max = gallery.scrollWidth - gallery.clientWidth;
    const anchors = cardOffsets.map(offset => Math.min(max, offset));
    let slide = 0;
    for (let i = 1; i < anchors.length; i += 1) {
      if (anchors[i] > anchors[i - 1]) {
        slide += range(gallery.scrollLeft, anchors[i - 1], anchors[i]);
      }
    }
    visualSlide = clamp(slide, 0, cards.length - 1);
    paintReel(visualSlide);
    setGalleryIndex(Math.round(visualSlide));
  }
  if (!reducedMotion.matches) paintWorld(scroll, heroRect, reelRect, visualSlide);
  lastScroll = scroll;
  if (keepMoving) requestMotionFrame();
}

function requestMotionFrame() {
  if (frameRequested) return;
  frameRequested = true;
  requestAnimationFrame(updateMotion);
}

function measureGallery() {
  document.documentElement.classList.toggle('motion', desktopMotion.matches);
  document.documentElement.classList.toggle('cinematic', tallScreen.matches);
  sceneHeight = window.innerHeight;
  currentSlide = null;
  cardOffsets = cards.map(card => card.offsetLeft - cards[0].offsetLeft);
  if (!desktopMotion.matches) {
    for (const name of ['--reel-enter', '--reel-exit', '--reel-caption-y']) projects.style.removeProperty(name);
    cards.forEach(card => {
      card.style.removeProperty('--picture-x');
      card.style.removeProperty('--picture-y');
      card.style.removeProperty('--picture-scale');
    });
  }
  if (reducedMotion.matches) {
    for (const name of ['--hero-text-opacity', '--hero-text-x', '--hero-text-y']) hero.style.removeProperty(name);
  } else {
    tunnel.resize();
    field.resize();
  }
  requestMotionFrame();
}

function goToCard(index) {
  const target = clamp(index, 0, cards.length - 1);
  if (desktopMotion.matches) {
    const rect = projects.getBoundingClientRect();
    const top = window.scrollY + rect.top;
    const travel = rect.height - sceneHeight;
    window.scrollTo({ top: top + travel * target / (cards.length - 1), behavior: scrollMode() });
  } else {
    gallery.scrollTo({ left: cardOffsets[target], behavior: scrollMode() });
  }
}

measureGallery();
window.addEventListener('resize', measureGallery, { passive: true });
desktopMotion.addEventListener('change', measureGallery);
tallScreen.addEventListener('change', measureGallery);
reducedMotion.addEventListener('change', measureGallery);
window.addEventListener('scroll', requestMotionFrame, { passive: true });
gallery.addEventListener('scroll', requestMotionFrame, { passive: true });

for (const scene of [hero, projects]) {
  scene.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || reducedMotion.matches) return;
    pointerX = (event.clientX / window.innerWidth - .5) * 2;
    pointerY = (event.clientY / sceneHeight - .5) * 2;
    requestMotionFrame();
  }, { passive: true });
  scene.addEventListener('pointerleave', () => {
    pointerX = 0;
    pointerY = 0;
    requestMotionFrame();
  });
}
stepButtons.forEach(button => button.addEventListener('click', () => goToCard(galleryIndex + Number(button.dataset.galleryStep))));
gallery.addEventListener('click', event => {
  if (!desktopMotion.matches || !(event.target instanceof Element)) return;
  const card = event.target.closest('.project-card');
  if (!card) return;
  const index = cards.indexOf(card);
  const side = galleryIndex === 0 ? 1 : galleryIndex === cards.length - 1 ? -1 : event.clientX < window.innerWidth / 2 ? -1 : 1;
  goToCard(index === galleryIndex ? index + side : index);
});
gallery.addEventListener('keydown', event => {
  const steps = { ArrowLeft: -1, ArrowRight: 1 };
  if (!steps[event.key]) return;
  event.preventDefault();
  goToCard(galleryIndex + steps[event.key]);
});

const menu = $('.mobile-nav');
const menuButton = $('.menu-toggle');
function closeMenu() {
  menu.hidden = true;
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Открыть меню');
}
menuButton.addEventListener('click', () => {
  if (!menu.hidden) {
    closeMenu();
    return;
  }
  menu.hidden = false;
  menuButton.setAttribute('aria-expanded', 'true');
  menuButton.setAttribute('aria-label', 'Закрыть меню');
});
menu.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !menu.hidden) {
    closeMenu();
    menuButton.focus();
  }
});

const levels = [
  ['Свой визуальный мир', 'Серия из 4–6 изображений, афиша или обложка и тизер на 10–15 секунд.'],
  ['Своя видеоистория', 'Сценарий, движение камеры, монтаж под звук и ролик на 20–40 секунд.'],
  ['Своя творческая команда', 'Проект по брифу, роли в команде, правки и презентация портфолио.']
];
const levelTabs = all('[data-level]');
const levelPanel = $('#level-content');
const weeks = $('#week-list');

function setLevel(index) {
  levelTabs.forEach((tab, i) => {
    tab.setAttribute('aria-selected', String(i === index));
    tab.tabIndex = i === index ? 0 : -1;
  });
  levelPanel.setAttribute('aria-labelledby', levelTabs[index].id);
  $('#level-title').textContent = levels[index][0];
  $('#level-description').textContent = levels[index][1];

  const entries = window.courseWeeks.slice(index * 8, index * 8 + 8).map((week, localIndex) => {
    const details = document.createElement('details');
    const title = document.createElement('summary');
    const number = document.createElement('span');
    number.className = 'week-no';
    number.textContent = String(index * 8 + localIndex + 1).padStart(2, '0');
    title.append(number, week.title);
    details.append(title);
    for (const [label, description] of [['На встрече. ', week.lesson], ['Домашняя практика. ', week.homework]]) {
      const paragraph = document.createElement('p');
      const bold = document.createElement('b');
      bold.textContent = label;
      paragraph.append(bold, description);
      details.append(paragraph);
    }
    return details;
  });
  weeks.replaceChildren(...entries);
}
levelTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => setLevel(index));
  tab.addEventListener('keydown', event => {
    const next = {
      ArrowLeft: (index + levels.length - 1) % levels.length,
      ArrowRight: (index + 1) % levels.length,
      Home: 0,
      End: levels.length - 1
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setLevel(next);
    levelTabs[next].focus();
  });
});
setLevel(0);

const dialog = $('#enroll-dialog');
const message = $('#enroll-message');
const status = $('#copy-status');
const packages = {
  study: { title: 'Обучение · 5 900 ₽ за 4 встречи', name: 'обучение за 5 900 ₽' },
  tools: { title: 'Обучение + нейросети · 6 900 ₽ за 4 встречи', name: 'обучение с нейросетями за 6 900 ₽' }
};
all('[data-package]').forEach(button => button.addEventListener('click', () => {
  const selected = packages[button.dataset.package];
  $('#enroll-package').textContent = selected.title;
  message.value = 'Здравствуйте! Хочу узнать условия записи в AI-мастерскую в Самаре. Интересует пакет «' + selected.name + ' за 4 встречи». Подскажите дату старта, расписание и условия доступа к нейросетям.';
  status.textContent = '';
  dialog.showModal();
}));
$('.dialog-close').addEventListener('click', () => dialog.close());
$('#copy-message').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(message.value);
    status.textContent = 'Сообщение скопировано.';
  } catch {
    message.focus();
    message.select();
    status.textContent = 'Сообщение выделено. Скопируй его вручную.';
  }
});

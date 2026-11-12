'use strict';

(() => {
  const eligible = window.matchMedia('(any-hover: hover) and (any-pointer: fine) and (prefers-reduced-motion: no-preference) and (forced-colors: none)');
  const root = document.documentElement;
  const interactive = 'a[href], button:not(:disabled), summary, [role="button"]';
  const native = 'dialog[open], input, textarea, select, [contenteditable]:not([contenteditable="false"]), [data-native-cursor]';
  const magnetic = '.button, .nav-cta, [data-gallery-step]';

  const pointer = document.createElement('div');
  pointer.className = 'motion-pointer';
  pointer.setAttribute('aria-hidden', 'true');
  const dot = document.createElement('div');
  dot.className = 'motion-pointer__dot';
  const orbit = document.createElement('div');
  orbit.className = 'motion-pointer__orbit';
  const dial = document.createElement('div');
  dial.className = 'motion-pointer__dial';
  const arrow = document.createElement('span');
  arrow.className = 'motion-pointer__arrow';
  dial.append(arrow);
  orbit.append(dial);
  pointer.append(orbit, dot);
  document.body.append(pointer);

  const arrows = new WeakMap();
  let active = false;
  let frame = 0;
  let x = 0;
  let y = 0;
  let orbitX = 0;
  let orbitY = 0;
  let lastTick = 0;
  let magnet = null;

  function moveOrbit(now) {
    frame = 0;
    if (!active) return;
    const elapsed = lastTick ? Math.min(32, now - lastTick) : 16;
    lastTick = now;
    const ease = 1 - Math.exp(-elapsed / 54);
    orbitX += (x - orbitX) * ease;
    orbitY += (y - orbitY) * ease;
    const settled = Math.hypot(x - orbitX, y - orbitY) < 0.4;
    if (settled) {
      orbitX = x;
      orbitY = y;
      lastTick = 0;
    }
    orbit.style.transform = `translate3d(${orbitX}px, ${orbitY}px, 0)`;
    if (!settled) frame = requestAnimationFrame(moveOrbit);
  }

  function arrowFor(control) {
    if (arrows.has(control)) return arrows.get(control);
    let icon = control.querySelector(':scope > [aria-hidden="true"]');
    if (!icon && control.matches('[data-gallery-step]') && control.childElementCount === 0) {
      icon = document.createElement('span');
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = control.textContent.trim();
      control.replaceChildren(icon);
    }
    if (icon) icon.classList.add('cursor-magnet-arrow');
    arrows.set(control, icon);
    return icon;
  }

  function releaseMagnet() {
    if (!magnet) return;
    magnet.style.removeProperty('--cursor-arrow-x');
    magnet.style.removeProperty('--cursor-arrow-y');
    magnet = null;
  }

  function moveMagnet(control) {
    if (control !== magnet) releaseMagnet();
    if (!control || !arrowFor(control)) return;
    magnet = control;
    const bounds = control.getBoundingClientRect();
    const limit = 9;
    const dx = Math.min(limit, Math.max(-limit, (x - bounds.left - bounds.width / 2) * 0.23));
    const dy = Math.min(limit, Math.max(-limit, (y - bounds.top - bounds.height / 2) * 0.23));
    magnet.style.setProperty('--cursor-arrow-x', `${dx}px`);
    magnet.style.setProperty('--cursor-arrow-y', `${dy}px`);
  }

  function hidePointer() {
    active = false;
    root.classList.remove('motion-pointer-on');
    pointer.classList.remove('is-pressed');
    releaseMagnet();
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastTick = 0;
  }

  function classify(target) {
    const control = target.closest(interactive);
    const card = root.classList.contains('motion') ? target.closest('.project-card') : null;
    const gallery = target.closest('.gallery');
    pointer.dataset.mode = control ? 'control' : card && gallery ? 'gallery' : 'point';
    if (pointer.dataset.mode === 'gallery') {
      const bounds = gallery.getBoundingClientRect();
      const atFirst = document.querySelector('[data-gallery-step="-1"]').disabled;
      const atLast = document.querySelector('[data-gallery-step="1"]').disabled;
      pointer.dataset.direction = atFirst ? 'right' : atLast ? 'left' : x < bounds.left + bounds.width / 2 ? 'left' : 'right';
    }
    moveMagnet(control?.closest(magnetic) ?? null);
  }

  document.addEventListener('pointermove', event => {
    const target = event.target;
    if (!eligible.matches || event.pointerType !== 'mouse' || !(target instanceof Element) || target.closest(native)) {
      hidePointer();
      return;
    }
    x = event.clientX;
    y = event.clientY;
    if (!active) {
      orbitX = x;
      orbitY = y;
      active = true;
      root.classList.add('motion-pointer-on');
    }
    dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    classify(target);
    if (!frame) frame = requestAnimationFrame(moveOrbit);
  }, { passive: true });

  document.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse') hidePointer();
    else if (active) pointer.classList.add('is-pressed');
  }, { passive: true });
  window.addEventListener('pointerup', () => pointer.classList.remove('is-pressed'), { passive: true });
  window.addEventListener('pointercancel', hidePointer, { passive: true });
  root.addEventListener('pointerleave', hidePointer, { passive: true });
  window.addEventListener('blur', hidePointer);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hidePointer();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Tab' || event.key === 'Escape') hidePointer();
  });
  document.addEventListener('click', event => {
    if (event.target instanceof Element && event.target.closest('[data-package]')) hidePointer();
  });
  document.addEventListener('scroll', () => {
    if (!active) return;
    const target = document.elementFromPoint(x, y);
    if (!target || target.closest(native)) hidePointer();
    else classify(target);
  }, { capture: true, passive: true });
  eligible.addEventListener('change', hidePointer);
})();

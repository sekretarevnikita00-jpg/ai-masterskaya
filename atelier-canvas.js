'use strict';

(() => {
  const NEAR = 0.86;
  const FAR = 17;
  const STRANDS = 13;
  const ROWS = 13;
  const FLECKS = 114;
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  const fract = value => value - Math.floor(value);
  const color = (hue, saturation, lightness, alpha) =>
    `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;

  function makeFlecks() {
    let seed = 38171;
    function random() {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    }
    return Array.from({ length: FLECKS }, () => ({
      phase: random(),
      spread: (random() - 0.5) * (random() < 0.72 ? 0.34 : 0.88),
      depth: random(),
      fiber: random(),
      curve: random() < 0.52 ? 0 : 1,
      flicker: random() * Math.PI * 2
    }));
  }

  window.createAtelierField = canvas => {
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return { resize() {}, render() {} };

    const flecks = makeFlecks();
    let width = 0;
    let height = 0;
    let scale = 0;
    let previous = null;

    function resize() {
      const nextWidth = Math.round(canvas.clientWidth);
      const nextHeight = Math.round(canvas.clientHeight);
      const nextScale = Math.min(window.devicePixelRatio || 1, 1.55);
      if (nextWidth === width && nextHeight === height && nextScale === scale) return;
      width = nextWidth;
      height = nextHeight;
      scale = nextScale;
      if (!width || !height) return;
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      if (previous) paint(previous);
    }

    function drawGrid(progress, hue, pointerX, pointerY, intensity) {
      const narrow = width < 650;
      const rotation = Math.sin(progress * Math.PI * 2 - 0.6) * 0.15 + pointerX * 0.045;
      const horizonX = width * (0.59 + Math.sin(progress * Math.PI * 2) * 0.105 + pointerX * 0.035);
      const horizonY = height * (0.53 + Math.cos(progress * Math.PI * 2) * 0.075 + pointerY * 0.028);
      const focal = height * (narrow ? 0.76 : 0.91);
      const floor = narrow ? 0.55 : 0.64;
      const spacing = narrow ? 0.37 : 0.49;
      const gridAlpha = intensity * (narrow ? 0.68 : 1);
      const travel = progress * 9.25;
      const offset = fract(travel);
      const bendPhase = progress * 4.5;

      function project(x, depth) {
        const bend = Math.sin(depth * 0.36 + bendPhase) * 0.45;
        const projectedX = (x + bend) * focal / depth;
        return [
          horizonX + projectedX,
          horizonY + floor * focal / depth + projectedX * rotation
        ];
      }

      const half = (STRANDS - 1) / 2;
      for (let strand = -half; strand <= half; strand += 1) {
        const x = strand * spacing;
        const alpha = gridAlpha * (0.12 - Math.abs(strand) * 0.011);
        const [firstX, firstY] = project(x, NEAR);
        ctx.beginPath();
        ctx.moveTo(firstX, firstY);
        for (let step = 1; step <= 6; step += 1) {
          const depth = NEAR + (FAR - NEAR) * (step / 6) ** 1.6;
          const [lineX, lineY] = project(x, depth);
          ctx.lineTo(lineX, lineY);
        }
        ctx.strokeStyle = color(hue + 9, 62, 57, alpha);
        ctx.lineWidth = strand % 3 === 0 ? 0.86 : 0.53;
        ctx.stroke();
      }

      for (let row = 0; row < ROWS; row += 1) {
        const depth = NEAR + (row + 1 - offset) * 1.13;
        const near = 1 - depth / FAR;
        const edgeFade = clamp((depth - NEAR) / 1.5, 0, 1);
        const [firstX, firstY] = project(-half * spacing, depth);
        const [lastX, lastY] = project(half * spacing, depth);
        ctx.beginPath();
        ctx.moveTo(firstX, firstY);
        ctx.lineTo(lastX, lastY);
        ctx.strokeStyle = color(hue - 6, 67, 55, (0.032 + near * 0.083) * edgeFade * gridAlpha);
        ctx.lineWidth = 0.54 + near * 0.32;
        ctx.stroke();

        if (row % 2 === 1) {
          const node = ((row * 7 + Math.floor(travel)) % STRANDS) - half;
          const [nodeX, nodeY] = project(node * spacing, depth);
          const alpha = (0.16 + near * 0.2) * edgeFade * gridAlpha;
          ctx.beginPath();
          ctx.moveTo(nodeX - 1.8, nodeY);
          ctx.lineTo(nodeX + 1.8, nodeY + 3.6 * rotation);
          ctx.moveTo(nodeX, nodeY - 1.9);
          ctx.lineTo(nodeX, nodeY + 1.9);
          ctx.lineWidth = 0.85;
          ctx.strokeStyle = color(hue + 17, 77, 73, alpha);
          ctx.stroke();
        }
      }
    }

    function drawFlecks(progress, hue, pointerX, pointerY, intensity) {
      const shorterSide = Math.min(width, height);
      const drift = progress * 7.7;

      for (let group = 0; group < 4; group += 1) {
        ctx.beginPath();
        for (let index = group; index < flecks.length; index += 4) {
          const mark = flecks[index];
          const phase = fract(mark.phase + progress * (0.49 + mark.depth * 0.33));
          const x = width * (-0.09 + 1.18 * phase + pointerX * mark.depth * 0.022);
          const base = mark.curve === 0 ? 0.29 : 0.69;
          const amplitude = mark.curve === 0 ? 0.122 : 0.102;
          const swing = phase * Math.PI * 3.15 + drift + mark.flicker * 0.22;
          const y = height * (base + mark.spread + Math.sin(swing) * amplitude + pointerY * mark.depth * 0.022);
          const length = (1.1 + mark.fiber * mark.fiber * (2.8 + group * 2.65)) * Math.max(0.7, shorterSide / 760);
          const slope = Math.cos(swing) * 0.42 - 0.14;
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + length * 0.52, y + slope * length * 0.29, x + length, y + slope * length);
        }
        ctx.lineWidth = 0.56 + group * 0.24;
        ctx.strokeStyle = color(hue + [-16, 6, 26, -34][group], 61 + group * 4, 57 + group * 3,
          (0.14 + group * 0.046) * intensity);
        ctx.stroke();
      }
    }

    function paint(frame) {
      ctx.clearRect(0, 0, width, height);
      if (frame.intensity === 0) return;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      drawGrid(frame.progress, frame.hue, frame.pointerX, frame.pointerY, frame.intensity);
      drawFlecks(frame.progress, frame.hue, frame.pointerX, frame.pointerY, frame.intensity);
    }

    function render({ progress = 0, hue = 193, pointerX = 0, pointerY = 0, intensity = 0.8 } = {}) {
      previous = {
        progress: clamp(progress, 0, 1),
        hue: Number.isFinite(hue) ? hue : 193,
        pointerX: clamp(pointerX, -1, 1),
        pointerY: clamp(pointerY, -1, 1),
        intensity: clamp(intensity, 0, 1)
      };
      if (width && height) paint(previous);
    }

    resize();
    return { resize, render };
  };
})();

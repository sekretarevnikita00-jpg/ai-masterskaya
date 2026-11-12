'use strict';

(() => {
  const FAR = 8.6;
  const NEAR = 0.42;
  const RING_COUNT = 9;
  const POINT_COUNT = 105;
  const CHAMFER = 0.42;
  const RING_SHAPE = [
    [-1 + CHAMFER, -1], [1 - CHAMFER, -1], [1, -1 + CHAMFER], [1, 1 - CHAMFER],
    [1 - CHAMFER, 1], [-1 + CHAMFER, 1], [-1, 1 - CHAMFER], [-1, -1 + CHAMFER]
  ];

  function clamp(number, min, max) {
    return Math.max(min, Math.min(max, number));
  }

  function fraction(number) {
    return number - Math.floor(number);
  }

  function depthAt(index, count, travel) {
    return NEAR + fraction(index / count - travel) * (FAR - NEAR);
  }

  function seedPoints() {
    let seed = 14357;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    return Array.from({ length: POINT_COUNT }, () => {
      const angle = random() * Math.PI * 2;
      const distance = 0.29 + random() * 1.45;
      return {
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        depth: random(),
        brightness: random()
      };
    });
  }

  window.createPortalTunnel = canvas => {
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return { render() {}, resize() {} };

    const stars = seedPoints();
    let width = 0;
    let height = 0;
    let ratio = 1;
    let lastFrame = null;

    function resize() {
      const nextWidth = Math.round(canvas.clientWidth);
      const nextHeight = Math.round(canvas.clientHeight);
      const nextRatio = Math.min(window.devicePixelRatio || 1, 1.7);
      if (width === nextWidth && height === nextHeight && ratio === nextRatio) return;
      width = nextWidth;
      height = nextHeight;
      ratio = nextRatio;
      if (!width || !height) return;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (lastFrame) paint(...lastFrame);
    }

    function paint(progress, pointerX, pointerY) {
      ctx.clearRect(0, 0, width, height);

      const t = clamp(progress, 0, 1);
      const lift = clamp((t - 0.09) / 0.54, 0, 1);
      const exit = 1 - 0.18 * clamp((t - 0.86) / 0.14, 0, 1);
      const focal = height * (width < 720 ? 0.54 : 0.65);
      const sweep = Math.sin(t * Math.PI);
      const originX = width * ((width < 720 ? 0.67 : 0.78) - sweep * 0.07) + pointerX * width * 0.035;
      const originY = height * (0.47 + sweep * 0.045) + pointerY * height * 0.035;
      const travel = 0.025 + t * 0.17 + t * t * 0.78;
      const hue = t < 0.64 ? 78 + t / 0.64 * 107 : 185 + (t - 0.64) / 0.36 * 80;
      const roll = -0.13 + t * 0.39 + pointerX * 0.036;
      const sn = Math.sin(roll);
      const cs = Math.cos(roll);
      const ringAspect = width < 720 ? 0.88 : 1.08;
      const ringSize = 0.89;

      function project(x, y, depth) {
        const scale = focal / depth;
        const curve = (depth - NEAR) / FAR;
        return [
          originX + (x * cs - y * sn + curve * curve * 0.32) * scale,
          originY + (x * sn + y * cs - curve * 0.105) * scale
        ];
      }

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const rings = Array.from({ length: RING_COUNT }, (_, index) => ({
        index,
        depth: depthAt(index, RING_COUNT, travel)
      })).sort((a, b) => b.depth - a.depth);

      for (const { index, depth } of rings) {
        const near = 1 - depth / FAR;
        const nearFade = clamp((depth - NEAR) / 0.35, 0, 1);
        const alpha = (0.043 + lift * 0.36) * near * nearFade * exit;
        const accent = index % 3 === 0;
        const points = RING_SHAPE.map(([x, y]) => project(x * ringSize * ringAspect, y * ringSize, depth));
        ctx.beginPath();
        points.forEach(([x, y], point) => {
          if (point === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();

        if (lift > 0.02) {
          ctx.lineWidth = (accent ? 12 : 7) * near;
          ctx.strokeStyle = `hsla(${hue + index * 1.8}, 97%, 57%, ${alpha * 0.24})`;
          ctx.stroke();
        }

        ctx.lineWidth = 0.65 + (accent ? 1.7 : 0.75) * near * lift;
        ctx.strokeStyle = `hsla(${hue + index * 1.8}, 98%, ${accent ? 78 : 65}%, ${alpha * (accent ? 1.38 : 1)})`;
        ctx.stroke();

        if (accent && lift > 0.15) {
          ctx.beginPath();
          for (const point of [0, 2, 4, 6]) {
            const [x, y] = points[point];
            const [nextX, nextY] = points[(point + 1) % points.length];
            ctx.moveTo(x, y);
            ctx.lineTo(x + (nextX - x) * 0.17, y + (nextY - y) * 0.17);
          }
          ctx.lineWidth = 1.35 + near * 2.2;
          ctx.strokeStyle = `hsla(${hue + 20}, 100%, 90%, ${alpha * 0.95})`;
          ctx.stroke();
        }
      }

      for (let group = 0; group < 3; group += 1) {
        ctx.beginPath();
        for (let index = group; index < stars.length; index += 3) {
          const star = stars[index];
          const depth = NEAR + fraction(star.depth - travel * (1.08 + star.brightness * 0.23)) * (FAR - NEAR);
          if (depth < 0.68) continue;
          const [x, y] = project(star.x, star.y, depth);
          const [endX, endY] = project(star.x, star.y, depth + 0.03 + lift * (0.12 + t * t * 0.58));
          ctx.moveTo(x, y);
          ctx.lineTo(endX, endY);
        }
        ctx.lineWidth = 0.65 + group * 0.38;
        ctx.strokeStyle = `hsla(${hue + 24 * group}, 96%, 82%, ${(0.11 + group * 0.055 + lift * 0.44) * exit})`;
        ctx.stroke();
      }
    }

    function render(progress = 0, pointerX = 0, pointerY = 0) {
      lastFrame = [progress, clamp(pointerX, -1, 1), clamp(pointerY, -1, 1)];
      if (width && height) paint(...lastFrame);
    }

    resize();
    return { render, resize };
  };
})();

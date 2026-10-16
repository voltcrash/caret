import { isSafeNumber } from "@oxytype/util/numbers";
import { JSXElement, onCleanup, onMount } from "solid-js";

import { getMutableConfig } from "../../../ts/config/store";
import * as SlowTimer from "../../../ts/states/slow-timer";
import { getCaretElement } from "../../../ts/states/test-dom";
import { getTheme } from "../../../ts/states/theme";
import { requestDebouncedAnimationFrame } from "../../../ts/utils/debounced-animation-frame";

type Particle = {
  x: number;
  y: number;
  color: string;
  alpha: number;
  prev: { x: number; y: number };
  vel: { x: number; y: number };
};

type CTX = {
  particles: Particle[];
  caret?: HTMLElement;
  canvas?: HTMLCanvasElement;
  context2d?: CanvasRenderingContext2D;
  rendering: boolean;
  lastFrame?: number;
  deltaTime?: number;
  resetTimeOut?: number;
  frame?: number;
  restoreTimeout?: ReturnType<typeof setTimeout>;
};

const ctx: CTX = {
  particles: [],
  rendering: false,
};
const gravity = 1000;
const drag = 0.05;
const particleSize = 4;
const particleFade = 0.6;
const particleInitVel = 1500;
const particleBounceMod = 0.3;
const particleCreateCount: [number, number] = [6, 3];
const shakeAmount = 10;

function createParticle(x: number, y: number, color: string): Particle {
  return {
    x,
    y,
    color,
    alpha: 1,
    prev: { x, y },
    vel: {
      x: particleInitVel - Math.random() * particleInitVel * 2,
      y: particleInitVel - Math.random() * particleInitVel * 2,
    },
  };
}

function updateParticle(particle: Particle): void {
  if (!ctx.canvas || !isSafeNumber(ctx.deltaTime)) return;

  particle.prev.x = particle.x;
  particle.prev.y = particle.y;
  // Update pos
  particle.x += particle.vel.x * ctx.deltaTime;
  particle.y += particle.vel.y * ctx.deltaTime;

  if (particle.x > ctx.canvas.width) {
    particle.vel.x *= -particleBounceMod;
    particle.x =
      ctx.canvas.width - (particle.x - ctx.canvas.width) * particleBounceMod;
  } else if (particle.x < 0) {
    particle.vel.x *= -particleBounceMod;
    particle.x *= -particleBounceMod;
  }
  if (particle.y > ctx.canvas.height) {
    particle.vel.y *= -particleBounceMod;
    particle.y =
      ctx.canvas.height - (particle.y - ctx.canvas.height) * particleBounceMod;
  } else if (particle.y < 0) {
    particle.vel.y *= -1;
    particle.y *= -1;
  }

  particle.vel.y += gravity * ctx.deltaTime;
  particle.vel.x *= 1 - drag * ctx.deltaTime;

  particle.alpha *= 1 - particleFade * ctx.deltaTime;
}

function render(): void {
  if (!isSafeNumber(ctx.lastFrame) || !ctx.context2d || !ctx.canvas) return;
  ctx.rendering = true;
  const time = Date.now();
  ctx.deltaTime = (time - ctx.lastFrame) / 1000;
  ctx.lastFrame = time;

  ctx.context2d.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  const keep = [];
  for (const particle of ctx.particles) {
    if (particle.alpha < 0.1) continue;

    updateParticle(particle);

    ctx.context2d.globalAlpha = particle.alpha;
    ctx.context2d.strokeStyle = particle.color;
    ctx.context2d.lineWidth = particleSize;

    ctx.context2d.beginPath();
    ctx.context2d.moveTo(
      Math.round(particle.prev.x),
      Math.round(particle.prev.y),
    );
    ctx.context2d.lineTo(Math.round(particle.x), Math.round(particle.y));
    ctx.context2d.stroke();

    keep.push(particle);
  }
  ctx.particles = keep;

  if (ctx.particles.length) {
    ctx.frame = requestAnimationFrame(render);
  } else {
    ctx.context2d.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.rendering = false;
  }
}

export function reset(immediate = false): void {
  if (!isSafeNumber(ctx.resetTimeOut) && ctx.restoreTimeout === undefined) {
    return;
  }
  clearTimeout(ctx.resetTimeOut);
  delete ctx.resetTimeOut;
  clearTimeout(ctx.restoreTimeout);
  document.body.style.transition = "all .25s, transform 0.8s";
  document.body.style.transform = "translate(0,0)";
  const restore = (): void => {
    ctx.restoreTimeout = undefined;
    document.body.style.transition = "all .25s, transform .05s";
    document.documentElement.style.overflow = "inherit";
    document.documentElement.style.overflowY = "scroll";
  };
  if (immediate) restore();
  else ctx.restoreTimeout = setTimeout(restore, 1000);
}

function startRender(): void {
  if (!ctx.rendering) {
    ctx.lastFrame = Date.now();
    render();
  }
}

function randomColor(): string {
  const r = Math.floor(Math.random() * 256).toString(16);
  const g = Math.floor(Math.random() * 256).toString(16);
  const b = Math.floor(Math.random() * 256).toString(16);
  return `#${r}${g}${b}`;
}

/**
 * @param {boolean} good Good power or not?
 */
export async function addPower(good = true, extra = false): Promise<void> {
  if (getMutableConfig().monkeyPowerLevel === "off" || SlowTimer.get()) return;

  requestDebouncedAnimationFrame("monkey-power.addPower", async () => {
    if (
      ctx.canvas === undefined ||
      getMutableConfig().monkeyPowerLevel === "off"
    ) {
      return;
    }
    if (getMutableConfig().blindMode) good = true;

    // Shake
    if (["3", "4"].includes(getMutableConfig().monkeyPowerLevel)) {
      document.documentElement.style.overflow = "hidden";
      const shake = [
        Math.round(shakeAmount - Math.random() * shakeAmount),
        Math.round(shakeAmount - Math.random() * shakeAmount),
      ];
      document.body.style.transform = `translate(${shake[0]}px, ${shake[1]}px)`;
      if (isSafeNumber(ctx.resetTimeOut)) clearTimeout(ctx.resetTimeOut);
      ctx.resetTimeOut = setTimeout(reset, 2000) as unknown as number;
    }

    // Sparks
    const offset = ctx.caret?.getBoundingClientRect();
    const coords = [
      offset?.left ?? 0,
      (offset?.top ?? 0) + (ctx.caret?.offsetHeight ?? 0) / 2,
    ];

    for (
      let i = Math.round(
        (particleCreateCount[0] + Math.random() * particleCreateCount[1]) *
          (extra ? 2 : 1),
      );
      i > 0;
      i--
    ) {
      const { caret, error } = getTheme();
      const color = ["2", "4"].includes(getMutableConfig().monkeyPowerLevel)
        ? randomColor()
        : good
          ? caret
          : error;
      ctx.particles.push(
        createParticle(...(coords as [x: number, y: number]), color),
      );
    }

    startRender();
  });
}

export function MonkeyPower(): JSXElement {
  let canvas: HTMLCanvasElement | undefined;

  const resize = (): void => {
    if (canvas === undefined) return;
    canvas.height = window.innerHeight;
    canvas.width = window.innerWidth;
  };

  onMount(() => {
    if (canvas === undefined) return;
    ctx.caret = getCaretElement();
    ctx.canvas = canvas;
    ctx.context2d = canvas.getContext("2d") as CanvasRenderingContext2D;
    resize();
    window.addEventListener("resize", resize);
  });

  onCleanup(() => {
    window.removeEventListener("resize", resize);
    reset(true);
    if (ctx.frame !== undefined) cancelAnimationFrame(ctx.frame);
    ctx.frame = undefined;
    ctx.particles = [];
    ctx.rendering = false;
    ctx.caret = undefined;
    ctx.canvas = undefined;
    ctx.context2d = undefined;
    ctx.lastFrame = undefined;
  });

  return (
    <canvas
      ref={(el) => (canvas = el)}
      class="pointer-events-none fixed top-0 left-0 z-999999"
    ></canvas>
  );
}

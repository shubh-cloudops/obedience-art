/**
 * Option C: "living portrait". The painted Art floats in a glowing frame, tilts towards the cursor
 * with a parallax depth effect, cross-fades smoothly between his painted expressions, shows
 * voice bars while he talks, and sways gently as he glides along the page. Plain DOM + CSS,
 * no WebGL, ~150 KB of images loaded after the page is idle.
 */
import type { Character, Expression } from './types';

export interface PortraitSet {
  [expression: string]: string; // expression -> image URL
}

// Painted expressions available (src/assets/ambassador) -> each site expression.
const MAP: Record<Expression, string> = {
  neutral: 'proud',
  explaining: 'explaining',
  proud: 'proud',
  eager: 'eager',
  concerned: 'concerned',
  sceptical: 'sceptical',
  surprised: 'surprised',
  apologetic: 'apologetic',
  thinking: 'thinking',
  alert: 'alert',
  amused: 'amused',
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export class PortraitArt implements Character {
  private card: HTMLElement;
  private layers = new Map<string, HTMLImageElement>();
  private current = '';
  private hand: HTMLElement;
  private bars: HTMLElement;
  private look = { x: 0, y: 0 };
  private lookGoal = { x: 0, y: 0 };
  private walkDir = 0;
  private walk = 0;
  private waving = 0;
  private talking = 0;
  private t = 0;
  private last = performance.now();
  private raf = 0;
  private loopFn: (() => void) | null = null;
  reduced: boolean;

  constructor(stage: HTMLElement, images: PortraitSet, opts: { reducedMotion: boolean }) {
    this.reduced = opts.reducedMotion;
    stage.classList.add('art-portrait');
    stage.innerHTML = `
      <div class="ap-card">
        <div class="ap-ring"></div>
        <div class="ap-frame"></div>
        <div class="ap-shine"></div>
      </div>
      <div class="ap-hand" aria-hidden="true">👋</div>
      <div class="ap-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></div>`;
    this.card = stage.querySelector('.ap-card')!;
    this.hand = stage.querySelector('.ap-hand')!;
    this.bars = stage.querySelector('.ap-bars')!;
    const frame = stage.querySelector('.ap-frame')!;
    for (const [name, url] of Object.entries(images)) {
      const img = new Image();
      img.alt = '';
      img.decoding = 'async';
      img.src = url;
      img.className = 'ap-face';
      frame.appendChild(img);
      this.layers.set(name, img);
    }
    this.express('neutral');
  }

  /** Resolves once the first face is ready, so he never appears blank. */
  ready() {
    const img = this.layers.get(MAP.neutral) ?? [...this.layers.values()][0];
    return img?.decode().catch(() => undefined) ?? Promise.resolve();
  }

  express(e: Expression) {
    const name = this.layers.has(MAP[e]) ? MAP[e] : MAP.neutral;
    if (name === this.current) return;
    this.current = name;
    for (const [n, img] of this.layers) img.classList.toggle('on', n === name);
    // A little "reaction" pop when the face changes
    if (!this.reduced) this.card.animate([{ scale: '1' }, { scale: '1.06' }, { scale: '1' }], { duration: 420, easing: 'ease-out' });
  }

  wave(seconds = 2.2) {
    this.waving = seconds;
  }

  talk(seconds: number) {
    this.talking = seconds;
  }

  setWalking(dir: -1 | 0 | 1) {
    this.walkDir = dir;
  }

  lookAt(x: number, y: number) {
    this.lookGoal = { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
  }

  resize() {
    /* CSS handles size */
  }

  /** Same shape as a Three.js renderer loop so the controller can treat both characters alike. */
  readonly renderer = {
    setAnimationLoop: (fn: (() => void) | null) => {
      cancelAnimationFrame(this.raf);
      this.loopFn = fn;
      const step = () => {
        this.loopFn?.();
        if (this.loopFn) this.raf = requestAnimationFrame(step);
      };
      if (fn) this.raf = requestAnimationFrame(step);
    },
  };

  tick() {
    const now = performance.now();
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    this.t += dt;
    this.waving = Math.max(0, this.waving - dt);
    this.talking = Math.max(0, this.talking - dt);
    const r = this.reduced;
    const k = r ? 1 : 1 - Math.pow(0.02, dt);
    this.look.x = lerp(this.look.x, this.lookGoal.x, k);
    this.look.y = lerp(this.look.y, this.lookGoal.y, k);
    this.walk = lerp(this.walk, this.walkDir ? 1 : 0, r ? 1 : 1 - Math.pow(0.002, dt));

    const float = r ? 0 : Math.sin(this.t * 1.8) * 4;
    const breathe = r ? 1 : 1 + Math.sin(this.t * 1.6) * 0.012;
    const sway = r ? 0 : Math.sin(this.t * 8) * 5 * this.walk;
    const hop = r ? 0 : Math.abs(Math.sin(this.t * 8)) * -6 * this.walk;
    const talkBob = this.talking > 0 && !r ? Math.sin(this.t * 14) * 1.2 : 0;
    const ry = this.look.x * 16 + this.walkDir * 10 * this.walk;
    const rx = -this.look.y * 10;
    this.card.style.transform =
      `translateY(${float + hop + talkBob}px) perspective(700px) rotateY(${ry}deg) rotateX(${rx}deg) rotateZ(${sway}deg) scale(${breathe})`;
    // Parallax: the painting shifts against the frame, which reads as depth
    this.card.style.setProperty('--px', `${-this.look.x * 6}px`);
    this.card.style.setProperty('--py', `${this.look.y * 5}px`);
    this.card.style.setProperty('--shine', `${50 + this.look.x * 40}%`);

    this.hand.classList.toggle('on', this.waving > 0);
    if (this.waving > 0 && !r) this.hand.style.transform = `rotate(${Math.sin(this.t * 12) * 22}deg)`;
    this.bars.classList.toggle('on', this.talking > 0 && !r);
  }
}

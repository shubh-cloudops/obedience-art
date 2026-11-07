/**
 * Option A: "Art" as a 3D model made from his painting (image-to-3D, auto-rigged, with motion clips),
 * shipped as public/models/art.glb.gz by scripts/pack-model.mjs.
 * Clips are matched by name, so any clip set works: idle and walk are loops; wave, talk and the
 * expression clips play once and blend back to idle. Head turns towards the cursor on top of any clip.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Character, Expression } from './types';

// Clip name keywords for each action, best match first.
const KEYS: Record<string, RegExp[]> = {
  idle: [/idle/i, /breath/i, /stand/i],
  walk: [/walk/i, /stroll/i],
  wave: [/wave/i, /greet/i, /hello/i],
  talk: [/talk/i, /speak/i, /convers/i, /explain/i],
  explaining: [/explain/i, /talk/i, /point/i],
  proud: [/proud/i, /confident/i, /chest/i],
  eager: [/clap/i, /cheer/i, /excite/i, /happy/i],
  concerned: [/worr/i, /concern/i, /sad/i, /disappoint/i],
  sceptical: [/shrug/i, /skeptic|sceptic/i, /shake/i, /doubt/i],
  surprised: [/surpris/i, /shock/i, /startl/i],
  apologetic: [/bow/i, /sorry|apolog/i, /shrug/i],
  thinking: [/think/i, /ponder/i, /scratch/i],
  alert: [/alert/i, /look/i, /point/i],
  amused: [/laugh/i, /chuckle/i, /happy/i],
};

export class GlbArt implements Character {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(22, 0.5, 0.1, 50);
  private root = new THREE.Group();
  private model!: THREE.Object3D;
  private mixer!: THREE.AnimationMixer;
  private clips = new Map<string, THREE.AnimationAction>();
  private base: THREE.AnimationAction | null = null; // idle or walk
  private oneShot: THREE.AnimationAction | null = null;
  private head: THREE.Object3D | undefined;
  private look = new THREE.Vector2();
  private lookGoal = new THREE.Vector2();
  private walkDir = 0;
  private facing = 0;
  private talking = 0;
  private last = performance.now();
  private headQ = new THREE.Quaternion();
  private headBase = new THREE.Quaternion(); // head pose before our cursor offset (undone each frame)
  private tmpE = new THREE.Euler();
  reduced: boolean;

  private constructor(canvas: HTMLCanvasElement, reduced: boolean) {
    this.reduced = reduced;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x1a2233, 1.1));
    const key = new THREE.DirectionalLight(0xfff4e8, 1.6);
    key.position.set(1, 2, 3);
    const rim = new THREE.DirectionalLight(0x22d3ee, 1.2);
    rim.position.set(-2, 1.5, -2);
    this.scene.add(key, rim, this.root);
  }

  /** Loads the model and returns a ready character. Throws if WebGL or the file is unavailable. */
  static async load(canvas: HTMLCanvasElement, url: string, opts: { reducedMotion: boolean }) {
    const art = new GlbArt(canvas, opts.reducedMotion);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Model not found (${res.status})`);
    let buf = await res.arrayBuffer();
    const head = new Uint8Array(buf, 0, 2);
    if (head[0] === 0x1f && head[1] === 0x8b) {
      buf = await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    }
    const gltf = await new GLTFLoader().parseAsync(buf, '');
    art.model = gltf.scene;
    art.model.traverse((o) => {
      o.frustumCulled = false;
      if (!art.head && /head/i.test(o.name) && !/top|end|nub/i.test(o.name) && (o as THREE.Bone).isBone) art.head = o;
    });
    if (art.head) art.headBase.copy(art.head.quaternion);
    art.root.add(art.model);
    art.mixer = new THREE.AnimationMixer(art.model);
    for (const clip of gltf.animations) art.clips.set(clip.name, art.mixer.clipAction(clip));
    art.mixer.addEventListener('finished', (e) => {
      if (e.action === art.oneShot) art.endOneShot();
    });
    art.setBase(art.find('idle') ?? art.clips.values().next().value ?? null);
    art.frame();
    return art;
  }

  private find(kind: string) {
    for (const re of KEYS[kind] ?? []) {
      for (const [name, action] of this.clips) if (re.test(name)) return action;
    }
    return undefined;
  }

  private setBase(a: THREE.AnimationAction | null | undefined) {
    if (!a || a === this.base) return;
    a.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.35).play();
    this.base?.fadeOut(0.35);
    this.base = a;
  }

  private play(kind: string) {
    if (this.reduced) return;
    const a = this.find(kind);
    if (!a || a === this.base) return;
    this.oneShot?.fadeOut(0.25);
    a.reset().setLoop(THREE.LoopOnce, 1).fadeIn(0.25).play();
    a.clampWhenFinished = true;
    this.base?.fadeOut(0.25);
    this.oneShot = a;
  }

  private endOneShot() {
    this.oneShot?.fadeOut(0.4);
    this.oneShot = null;
    this.base?.reset().fadeIn(0.4).play();
  }

  /** Frame the full body: camera distance from the model's height. */
  private frame() {
    const box = new THREE.Box3().setFromObject(this.model);
    const h = box.max.y - box.min.y;
    const mid = box.min.y + h * 0.5;
    const dist = (h * 0.62) / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    this.camera.position.set(0, mid + h * 0.04, dist);
    this.camera.lookAt(0, mid, 0);
  }

  express(e: Expression) {
    if (e !== 'neutral') this.play(e);
  }

  wave() {
    this.play('wave');
  }

  talk(seconds: number) {
    this.talking = seconds;
    if (!this.oneShot) this.play('talk');
  }

  setWalking(dir: -1 | 0 | 1) {
    this.walkDir = dir;
    if (this.oneShot && dir) this.endOneShot();
    this.setBase(dir ? (this.find('walk') ?? this.find('idle')) : this.find('idle'));
  }

  lookAt(x: number, y: number) {
    this.lookGoal.set(THREE.MathUtils.clamp(x, -1, 1), THREE.MathUtils.clamp(y, -1, 1));
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.model) this.frame();
  }

  tick() {
    const now = performance.now();
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    this.talking = Math.max(0, this.talking - dt);
    if (this.head) this.head.quaternion.copy(this.headBase); // undo last frame's offset (clips may not key the head)
    this.mixer.update(dt);
    if (this.head) this.headBase.copy(this.head.quaternion);
    // Turn to face the walking direction, then back to the reader.
    const k = this.reduced ? 1 : 1 - Math.pow(0.004, dt);
    this.facing = THREE.MathUtils.lerp(this.facing, this.walkDir * 1.2, k);
    this.root.rotation.y = this.facing;
    // Head follows the cursor, layered on top of whatever clip is playing.
    this.look.lerp(this.lookGoal, this.reduced ? 1 : 1 - Math.pow(0.02, dt));
    if (this.head && !this.walkDir) {
      this.headQ.setFromEuler(this.tmpE.set(-this.look.y * 0.25, this.look.x * 0.5, 0));
      this.head.quaternion.multiply(this.headQ);
    }
    this.renderer.render(this.scene, this.camera);
  }
}

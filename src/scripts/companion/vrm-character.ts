/**
 * "Art", the brand ambassador, as a VRM avatar (designed in VRoid Studio, exported to public/models/art.vrm).
 * three-vrm provides the skeleton, facial expressions, eye look-at and hair/cloth spring physics;
 * this file adds smooth procedural body language: idle breathing and sway, gestures, waving,
 * a walk cycle, blinking, and lip movement while he talks. Everything eases, so motion stays fluid.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, type VRM, type VRMHumanBoneName } from '@pixiv/three-vrm';

import type { Character, Expression } from './types';
export type { Expression };

type Weights = Partial<Record<'happy' | 'angry' | 'sad' | 'relaxed' | 'surprised' | 'blink' | 'blinkLeft' | 'blinkRight', number>>;
type Gesture = 'rest' | 'wave' | 'point' | 'chin' | 'chest' | 'neck' | 'stop' | 'offer' | 'cover' | 'cheeks' | 'hip';

const FACES: Record<Expression, { w: Weights; gesture: Gesture; tilt: number; nod: number }> = {
  neutral:    { w: { relaxed: 0.25 },                         gesture: 'rest',   tilt: 0,     nod: 0 },
  explaining: { w: { happy: 0.45 },                           gesture: 'point',  tilt: 0.06,  nod: 0 },
  proud:      { w: { happy: 0.6, relaxed: 0.4 },              gesture: 'chest',   tilt: 0,     nod: -0.12 },
  eager:      { w: { happy: 1, surprised: 0.15 },             gesture: 'offer',  tilt: 0.1,   nod: 0.03 },
  concerned:  { w: { sad: 0.7 },                              gesture: 'chin',   tilt: -0.08, nod: 0.08 },
  sceptical:  { w: { angry: 0.25, relaxed: 0.3, blinkLeft: 0.35 }, gesture: 'hip', tilt: -0.14, nod: 0 },
  surprised:  { w: { surprised: 1 },                          gesture: 'cheeks', tilt: 0,     nod: -0.06 },
  apologetic: { w: { sad: 0.35, happy: 0.35 },                gesture: 'neck',   tilt: 0.16,  nod: 0.06 },
  thinking:   { w: { relaxed: 0.5 },                          gesture: 'chin',   tilt: 0.12,  nod: -0.12 },
  alert:      { w: { angry: 0.35, surprised: 0.25 },          gesture: 'stop',   tilt: 0,     nod: 0.03 },
  amused:     { w: { happy: 1, blink: 0.75 },                 gesture: 'cover',  tilt: 0.14,  nod: -0.06 },
};

type Euler3 = [number, number, number];
type Pose = Partial<Record<VRMHumanBoneName, Euler3>>;

// Gesture poses as Euler rotations (x, y, z) on normalized humanoid bones (rest = T-pose, facing +Z).
// "right" = his right (screen left). Tuned by eye.
const ARMS_DOWN: Pose = {
  leftUpperArm: [0, 0, -1.35], rightUpperArm: [0, 0, 1.35],
  leftLowerArm: [0, -0.2, 0], rightLowerArm: [0, 0.2, 0],
};
// Tuned on Art's model (VRoid, tuxedo). Values were picked from rendered test grids.
const GESTURES: Record<Gesture, Pose> = {
  rest: ARMS_DOWN,
  wave: { ...ARMS_DOWN, rightUpperArm: [0, 0, -0.95], rightLowerArm: [0, 0, -0.9], rightHand: [0, 0, 0] },
  point: { ...ARMS_DOWN, rightUpperArm: [0, 0, 0.3], rightLowerArm: [0, 0, -2.3] }, // index finger up beside his head
  chin: { ...ARMS_DOWN, rightUpperArm: [1.0, 1.3, 0.9], rightLowerArm: [0, 2.7, 0] },
  chest: { ...ARMS_DOWN, rightUpperArm: [0, 0.5, 1.0], rightLowerArm: [0, 2.0, 0] },
  neck: { ...ARMS_DOWN, rightUpperArm: [0, 0, 0], rightLowerArm: [0, 0, -2.5] }, // scratching his head
  stop: { ...ARMS_DOWN, rightUpperArm: [0, -0.5, 0.2], rightLowerArm: [0, 0, -2.4] }, // palm up, "hold on"
  offer: { ...ARMS_DOWN, rightUpperArm: [0, 0.4, 1.2], rightLowerArm: [0, 1.5, 0] },
  cover: { ...ARMS_DOWN, rightUpperArm: [1.0, 1.3, 0.75], rightLowerArm: [0, 2.8, 0] },
  hip: { ...ARMS_DOWN, rightUpperArm: [1.5, 0, 0.3], rightLowerArm: [0, 2.4, 0] },
  cheeks: {
    leftUpperArm: [0, 0.5, -0.2], leftLowerArm: [0, 0, 2.4],
    rightUpperArm: [0, -0.5, 0.2], rightLowerArm: [0, 0, -2.4],
  },
};
// Relaxed finger curl (index straight when pointing).
const FINGERS = ['Index', 'Middle', 'Ring', 'Little'] as const;
const JOINTS = ['Proximal', 'Intermediate', 'Distal'] as const;

const BONES: VRMHumanBoneName[] = [
  'hips', 'spine', 'chest', 'neck', 'head',
  'leftUpperArm', 'leftLowerArm', 'leftHand', 'rightUpperArm', 'rightLowerArm', 'rightHand',
  'leftUpperLeg', 'leftLowerLeg', 'rightUpperLeg', 'rightLowerLeg',
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (k: number, dt: number) => 1 - Math.pow(k, dt); // frame-rate independent smoothing

export class Art implements Character {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(22, 0.5, 0.1, 30);
  private root = new THREE.Group();
  private vrm!: VRM;
  private lookTarget = new THREE.Object3D();
  private look = new THREE.Vector2();
  private lookGoal = new THREE.Vector2();
  private weights: Record<string, number> = {};
  private target: Expression = 'neutral';
  private tilt = 0;
  private nod = 0;
  private quats = new Map<VRMHumanBoneName, THREE.Quaternion>();
  private tmpQ = new THREE.Quaternion();
  private tmpE = new THREE.Euler();
  private walking = 0;
  private walkDir = 0;
  private waving = 0;
  private talking = 0;
  private blinkAt = 2;
  private blink = 0;
  private t = 0;
  private last = performance.now();
  reduced: boolean;

  private constructor(canvas: HTMLCanvasElement, reduced: boolean) {
    this.reduced = reduced;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xfff4e8, 1.25);
    key.position.set(1, 2, 3);
    const rim = new THREE.DirectionalLight(0x22d3ee, 0.9);
    rim.position.set(-2, 1.5, -2);
    this.scene.add(key, rim, this.root, this.lookTarget);
  }

  /** Loads the VRM and returns a ready character. Throws if WebGL or the file is unavailable. */
  static async load(canvas: HTMLCanvasElement, url: string, opts: { reducedMotion: boolean }) {
    const art = new Art(canvas, opts.reducedMotion);
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    // The model ships gzipped (scripts/pack-model.mjs); unzip it here unless the server already did.
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Model not found (${res.status})`);
    let buf = await res.arrayBuffer();
    const head = new Uint8Array(buf, 0, 2);
    if (head[0] === 0x1f && head[1] === 0x8b) {
      buf = await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    }
    const gltf = await loader.parseAsync(buf, '');
    const vrm = gltf.userData.vrm as VRM | undefined;
    if (!vrm) throw new Error('Not a VRM file');
    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    VRMUtils.combineSkeletons(gltf.scene);
    VRMUtils.rotateVRM0(vrm); // older VRM 0.x files face the other way
    vrm.scene.traverse((o) => (o.frustumCulled = false));
    art.vrm = vrm;
    art.root.add(vrm.scene);
    if (vrm.lookAt) vrm.lookAt.target = art.lookTarget;
    art.frame();
    art.addSignatureDetails();
    return art;
  }

  /** Frame the full body: camera distance from the model's height. */
  private frame() {
    const box = new THREE.Box3().setFromObject(this.vrm.scene);
    const h = box.max.y - box.min.y;
    const mid = box.min.y + h * 0.5;
    const dist = (h * 0.62) / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    this.camera.position.set(0, mid + h * 0.04, dist);
    this.camera.lookAt(0, mid, 0);
  }

  /** Small brand details VRoid can't model: a glowing cyan cuff on his right wrist and a cyan temple line. */
  private addSignatureDetails() {
    const cyan = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
    const hand = this.vrm.humanoid.getRawBoneNode('rightHand');
    if (hand) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.005, 8, 28), cyan);
      ring.rotation.y = Math.PI / 2;
      hand.add(ring);
    }
    const head = this.vrm.humanoid.getRawBoneNode('head');
    if (head) {
      const line = new THREE.Mesh(new THREE.CapsuleGeometry(0.0025, 0.03, 2, 6), cyan);
      line.position.set(-0.068, 0.085, 0.045);
      line.rotation.z = 0.2;
      head.add(line);
    }
  }

  express(e: Expression) {
    this.target = e;
  }

  wave(seconds = 2.2) {
    this.waving = seconds;
  }

  /** Mouth moves while a speech bubble is showing. */
  talk(seconds: number) {
    this.talking = seconds;
  }

  setWalking(dir: -1 | 0 | 1) {
    this.walkDir = dir;
  }

  lookAt(x: number, y: number) {
    this.lookGoal.set(THREE.MathUtils.clamp(x, -1, 1), THREE.MathUtils.clamp(y, -1, 1));
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.vrm) this.frame();
  }

  private pose(name: VRMHumanBoneName, e: Euler3 | undefined, k: number) {
    const node = this.vrm.humanoid.getNormalizedBoneNode(name);
    if (!node) return;
    let q = this.quats.get(name);
    if (!q) this.quats.set(name, (q = node.quaternion.clone()));
    this.tmpQ.setFromEuler(this.tmpE.set(...(e ?? [0, 0, 0])));
    q.slerp(this.tmpQ, k);
    node.quaternion.copy(q);
  }

  /** Small extra rotation on top of the pose (breathing, sway, walk). */
  private add(name: VRMHumanBoneName, x: number, y: number, z: number) {
    const node = this.vrm.humanoid.getNormalizedBoneNode(name);
    if (node) node.quaternion.multiply(this.tmpQ.setFromEuler(this.tmpE.set(x, y, z)));
  }

  tick() {
    const now = performance.now();
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    this.t += dt;
    const t = this.t;
    const r = this.reduced;
    const f = FACES[this.target];
    this.waving = Math.max(0, this.waving - dt);
    this.talking = Math.max(0, this.talking - dt);

    // Body pose: blend every bone towards the gesture
    const gName: Gesture = this.waving > 0 ? 'wave' : f.gesture;
    const g = GESTURES[gName];
    const k = r ? 1 : ease(0.004, dt);
    for (const b of BONES) this.pose(b, g[b], k);
    for (const side of ['left', 'right'] as const) {
      for (const fi of FINGERS) {
        const straight = side === 'right' && fi === 'Index' && gName === 'point';
        const open = gName === 'wave' || gName === 'stop' || (gName === 'cheeks');
        const curl = straight ? 0 : open && side === 'right' ? 0.1 : 0.45;
        for (const j of JOINTS) {
          const name = `${side}${fi}${j}` as VRMHumanBoneName;
          this.pose(name, [0, 0, side === 'right' ? curl : -curl], k);
        }
      }
    }

    // Walk cycle, turning sideways in the walking direction
    this.walking = lerp(this.walking, this.walkDir ? 1 : 0, r ? 1 : ease(0.002, dt));
    const w = r ? 0 : this.walking;
    const s = Math.sin(t * 7.5);
    if (w > 0.01) {
      this.add('leftUpperLeg', s * 0.55 * w, 0, 0);
      this.add('rightUpperLeg', -s * 0.55 * w, 0, 0);
      this.add('leftLowerLeg', Math.max(0, -s) * 0.7 * w, 0, 0);
      this.add('rightLowerLeg', Math.max(0, s) * 0.7 * w, 0, 0);
      if (this.waving <= 0 && f.gesture === 'rest') {
        this.add('leftUpperArm', 0, s * 0.35 * w, 0);
        this.add('rightUpperArm', 0, s * 0.35 * w, 0);
      }
      this.add('spine', 0, -s * 0.08 * w, 0);
    }
    this.root.rotation.y = lerp(this.root.rotation.y, this.walkDir * 1.25 * w, r ? 1 : ease(0.01, dt));
    this.root.position.y = Math.abs(Math.cos(t * 7.5)) * 0.025 * w;

    // Idle life: breathing, a slow weight shift, waving forearm
    if (!r) {
      this.add('spine', Math.sin(t * 1.6) * 0.015, 0, Math.sin(t * 0.7) * 0.02);
      this.add('chest', Math.sin(t * 1.6 + 0.6) * 0.02, 0, 0);
      this.add('hips', 0, Math.sin(t * 0.5) * 0.04, Math.sin(t * 0.7) * 0.015);
      if (this.waving > 0) this.add('rightLowerArm', 0, 0, Math.sin(t * 10) * 0.35);
    }

    // Head: expression tilt/nod plus where he looks
    this.tilt = lerp(this.tilt, f.tilt, r ? 1 : ease(0.01, dt));
    this.nod = lerp(this.nod, f.nod, r ? 1 : ease(0.01, dt));
    this.look.lerp(this.lookGoal, r ? 1 : ease(0.03, dt));
    this.add('neck', this.nod * 0.5 - this.look.y * 0.12, this.look.x * 0.25, this.tilt * 0.5);
    this.add('head', this.nod * 0.5 - this.look.y * 0.1, this.look.x * 0.2, this.tilt * 0.5);
    const head = this.vrm.humanoid.getNormalizedBoneNode('head');
    if (head) {
      head.getWorldPosition(this.lookTarget.position);
      this.lookTarget.position.add(new THREE.Vector3(this.look.x * 0.6, this.look.y * 0.35, 1));
    }

    // Face: ease expression weights, blink, lips while talking
    const em = this.vrm.expressionManager;
    if (em) {
      for (const name of ['happy', 'angry', 'sad', 'relaxed', 'surprised', 'blinkLeft', 'blinkRight'] as const) {
        this.weights[name] = lerp(this.weights[name] ?? 0, f.w[name] ?? 0, r ? 1 : ease(0.01, dt));
        em.setValue(name, this.weights[name]);
      }
      if (!r) {
        this.blinkAt -= dt;
        if (this.blinkAt <= 0) {
          this.blink = 0.16;
          this.blinkAt = 2.2 + Math.random() * 3.5;
        }
        this.blink = Math.max(0, this.blink - dt);
      }
      const blinkPulse = this.blink > 0 ? Math.sin((1 - this.blink / 0.16) * Math.PI) : 0;
      em.setValue('blink', Math.max(f.w.blink ?? 0, blinkPulse));
      const mouth = this.talking > 0 && !r ? Math.max(0, Math.sin(t * 15)) * (0.35 + 0.25 * Math.sin(t * 4.3)) : 0;
      em.setValue('aa', mouth);
      em.setValue('oh', this.talking > 0 && !r ? Math.max(0, Math.sin(t * 9 + 1)) * 0.2 : 0);
    }

    this.vrm.update(dt);
    this.renderer.render(this.scene, this.camera);
  }
}

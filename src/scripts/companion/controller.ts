/**
 * Behaviour for the animated ambassador: greeting, walking along the bottom edge,
 * cursor-following eyes, scroll-triggered expressions and lines, click reactions, hide/restore.
 * Page elements opt in with data-art="<expression>" and data-art-say="<what he says>".
 */
import type { Character, Expression } from './types';

const PREF_KEY = 'art-companion'; // localStorage: 'off' hides him on every page
const GREET_KEY = 'art-greeted'; // sessionStorage: walk-in greeting once per visit
const ARTICLE_WIDTH = 768;
const MODEL_URL = '/models/art.glb.gz';

const store = {
  get(s: Storage | undefined, k: string) {
    try { return s?.getItem(k) ?? null; } catch { return null; }
  },
  set(s: Storage | undefined, k: string, v: string) {
    try { s?.setItem(k, v); } catch { /* private mode: ignore */ }
  },
};
const local = (() => { try { return window.localStorage; } catch { return undefined; } })();
const session = (() => { try { return window.sessionStorage; } catch { return undefined; } })();

function pageGreeting(name: string): string {
  const p = location.pathname;
  if (p === '/') return `Hi, I'm ${name}, your AI host. I do exactly what I'm told. That's the problem.`;
  if (p.startsWith('/posts/') && p.length > 7) return "Let's take this story apart together.";
  if (p.startsWith('/tracker/')) return 'This story is still unfolding. I keep adding to it.';
  if (p.startsWith('/claim-check') || p.startsWith('/pillars/claim-check')) return 'Viral claims, checked. Pick one.';
  if (p.startsWith('/search')) return "Tell me exactly what you're looking for.";
  return `Hi, I'm ${name}, your AI host.`;
}

const CLICK_REACTIONS: [Expression, string][] = [
  ['amused', "Careful, I'm ticklish."],
  ['explaining', 'Tip: tell an AI what you want, and also what you don\'t.'],
  ['proud', 'Every claim on this site has at least two sources. I checked.'],
  ['eager', "Need anything? I'm very obedient."],
  ['thinking', 'Am I conscious? Honestly, that is still an open question.'],
];

export function startCompanion() {
  const root = document.getElementById('art-companion');
  const restore = document.getElementById('art-restore') as HTMLButtonElement | null;
  if (!root || !restore) return;
  const override = new URLSearchParams(location.search).get('art');
  if (override === 'portrait' || override === '3d') root.dataset.mode = override;
  // Phones and data-saver connections load the 3D model only when asked (it is several MB).
  // The living portrait is ~100 KB of images, so it loads everywhere.
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  const lite = root.dataset.mode === '3d' && (window.matchMedia('(max-width: 640px)').matches || conn?.saveData === true);
  if (store.get(local, PREF_KEY) === 'off' || (lite && store.get(local, PREF_KEY) !== 'on')) {
    const label = restore.querySelector('.art-restore-label');
    if (lite && label) label.textContent = `Meet ${root.dataset.name ?? 'Art'}`;
    restore.hidden = false;
    restore.onclick = () => {
      store.set(local, PREF_KEY, 'on');
      restore.hidden = true;
      void boot(root, restore, true);
    };
    return;
  }
  void boot(root, restore, false);
}

async function boot(root: HTMLElement, restore: HTMLButtonElement, returning: boolean) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stage = root.querySelector<HTMLElement>('.art-stage')!;
  const bubble = root.querySelector<HTMLElement>('.art-bubble')!;
  const hideBtn = root.querySelector<HTMLButtonElement>('.art-hide')!;
  const name = root.dataset.name ?? 'Art';

  let art: Character;
  try {
    if (root.dataset.mode === '3d') {
      const canvas = document.createElement('canvas');
      stage.appendChild(canvas);
      const { GlbArt } = await import('./glb-character');
      art = await GlbArt.load(canvas, MODEL_URL, { reducedMotion: reduced });
    } else {
      const { PortraitArt } = await import('./portrait-character');
      const portrait = new PortraitArt(stage, JSON.parse(root.dataset.portraits ?? '{}'), { reducedMotion: reduced });
      await portrait.ready();
      art = portrait;
    }
    root.hidden = false;
  } catch {
    stage.replaceChildren();
    root.hidden = true; // no WebGL, no model or no images: the site works fine without him
    restore.hidden = true;
    return;
  }

  // Size and render loop (paused while the tab is hidden)
  const resize = () => art.resize(root.clientWidth, root.clientHeight);
  resize();
  new ResizeObserver(resize).observe(root);
  let frame = 0;
  const loop = () => {
    frame++;
    if (reduced && frame % 6) return; // reduced motion: ~10 fps is plenty
    art.tick();
  };
  const run = () => art.renderer.setAnimationLoop(document.hidden ? null : loop);
  document.addEventListener('visibilitychange', run);
  run();

  // Speech bubble
  let bubbleTimer = 0;
  const say = (text: string, ms = 4200) => {
    bubble.textContent = text;
    bubble.classList.add('show');
    art.talk(Math.min(ms / 1000, 0.6 + text.length * 0.045));
    clearTimeout(bubbleTimer);
    bubbleTimer = window.setTimeout(() => bubble.classList.remove('show'), ms);
  };

  // Expression that relaxes back to neutral
  let moodTimer = 0;
  const mood = (e: Expression, ms = 6000) => {
    art.express(e);
    clearTimeout(moodTimer);
    moodTimer = window.setTimeout(() => art.express('neutral'), ms);
  };

  // Walking along the bottom edge. x is a CSS offset in px: 0 = home corner, negative = further left.
  let x = 0;
  let walkRaf = 0;
  const lane = () => {
    const gutter = (window.innerWidth - ARTICLE_WIDTH) / 2;
    return Math.max(0, Math.min(300, gutter - root.clientWidth - 24));
  };
  const setX = (v: number) => {
    x = v;
    root.style.setProperty('--x', `${Math.round(v)}px`);
  };
  const walkTo = (target: number) =>
    new Promise<void>((resolve) => {
      cancelAnimationFrame(walkRaf);
      if (reduced || Math.abs(target - x) < 4) {
        setX(target);
        art.setWalking(0);
        return resolve();
      }
      const dir = target > x ? 1 : -1;
      art.setWalking(dir);
      let last = performance.now();
      const step = (now: number) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const next = x + dir * 140 * dt; // px per second
        if ((dir > 0 && next >= target) || (dir < 0 && next <= target)) {
          setX(target);
          art.setWalking(0);
          return resolve();
        }
        setX(next);
        walkRaf = requestAnimationFrame(step);
      };
      walkRaf = requestAnimationFrame(step);
    });
  const wander = () => {
    const l = lane();
    if (l > 40) void walkTo(-Math.random() * l);
  };

  // Eyes follow the cursor; after a while idle he glances back at the page.
  let lastMove = performance.now();
  window.addEventListener(
    'pointermove',
    (e) => {
      const r = stage.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height * 0.3;
      art.lookAt((e.clientX - cx) / (window.innerWidth / 2), (cy - e.clientY) / (window.innerHeight / 2));
      lastMove = performance.now();
    },
    { passive: true },
  );
  window.setInterval(() => {
    if (performance.now() - lastMove > 7000) art.lookAt(-0.4 + Math.random() * 0.5, Math.random() * 0.3);
  }, 3500);

  // Scroll: react to marked sections once each, and to very fast scrolling once per page.
  const seen = new WeakSet<Element>();
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (!en.isIntersecting || seen.has(en.target)) continue;
        seen.add(en.target);
        const el = en.target as HTMLElement;
        mood(el.dataset.art as Expression, 7000);
        if (el.dataset.artSay) say(el.dataset.artSay, 5000);
        if (Math.random() < 0.6) wander();
      }
    },
    { rootMargin: '0px 0px -40% 0px' },
  );

  let lastY = window.scrollY;
  let lastT = performance.now();
  let whoa = false;
  window.addEventListener(
    'scroll',
    () => {
      const now = performance.now();
      const v = Math.abs(window.scrollY - lastY) / Math.max(1, now - lastT); // px per ms
      lastY = window.scrollY;
      lastT = now;
      if (!whoa && v > 6 && window.scrollY > 600) {
        whoa = true;
        mood('surprised', 2500);
        say("Whoa, slow down! I can't read that fast.", 2600);
      }
    },
    { passive: true },
  );

  // Click / tap him for a reaction
  let clicks = 0;
  stage.addEventListener('click', () => {
    const [e, line] = CLICK_REACTIONS[clicks++ % CLICK_REACTIONS.length];
    mood(e, 4000);
    say(line, 3800);
    if (clicks % 3 === 0) art.wave(1.6);
  });

  // Hide (remembered on this device) and restore
  hideBtn.addEventListener('click', async () => {
    store.set(local, PREF_KEY, 'off');
    art.express('apologetic');
    art.wave(1.5);
    say('Bye! Tap my name in the corner to bring me back.', 1800);
    await new Promise((r) => setTimeout(r, 1300));
    await walkTo(root.clientWidth + 40);
    art.renderer.setAnimationLoop(null);
    root.hidden = true;
    restore.hidden = false;
    restore.focus();
    restore.onclick = () => {
      store.set(local, PREF_KEY, 'on');
      restore.hidden = true;
      root.hidden = false;
      run();
      void walkTo(0).then(() => {
        art.wave(1.4);
        say("I'm back. I'll keep quiet unless something's interesting.");
      });
    };
  });

  // Greeting: walk in from off-screen once per visit, otherwise a quick wave.
  const greeted = store.get(session, GREET_KEY) === '1';
  store.set(session, GREET_KEY, '1');
  if (!greeted || returning) {
    setX(root.clientWidth + 40);
    await walkTo(0);
    art.wave(2.2);
    mood('eager', 3500);
    say(pageGreeting(name), 5200);
  } else {
    art.wave(1.2);
    const line = pageGreeting(name);
    if (!line.startsWith('Hi,')) say(line, 3500);
  }

  // Start reacting to the page once the greeting has had its moment.
  window.setTimeout(() => document.querySelectorAll('[data-art]').forEach((el) => io.observe(el)), greeted ? 1500 : 4500);
}

export const SITE = {
  name: 'Obedience ART',
  tagline: 'The Art of Articulation',
  description:
    'AI news and AI myths, demystified. AI is capable, maybe more than we know, and dangerously obedient. The risk lives in how we articulate what we ask for.',
  author: 'Shub',
};

export const PILLARS = {
  autopsy: {
    label: 'The Post-Mortem',
    blurb: 'A viral "AI went rogue" story, taken apart: what was asked, what was measured, what happened.',
  },
  'spec-gap': {
    label: 'The Spec Gap',
    blurb: 'How a badly worded requirement turns into a bad outcome, and how to word it better.',
  },
  mirror: {
    label: 'The Mirror',
    blurb: 'When AI reflects flawed data or flawed human intent back at us.',
  },
  'open-question': {
    label: 'The Open Question',
    blurb: 'Consciousness and moral status. Researchers disagree, so we never hand down a verdict.',
  },
  'claim-check': {
    label: 'Claim Check',
    blurb: 'Short verdicts on viral AI claims, with every source shown.',
  },
  'obedience-test': {
    label: 'The Obedience Test',
    blurb: 'Hands-on tests of new AI models: we give tricky instructions and report where they over-obey, game the goal or skip a rule.',
  },
  'build-log': {
    label: 'Build Log',
    blurb: 'Field notes from building with AI on Azure and AWS: real costs, real mistakes, honest postmortems.',
  },
} as const;

/** The person behind the site, shown on every post (readers and search engines trust named practitioners). */
export const AUTHOR = {
  name: 'Shub',
  initials: 'S',
  bio: 'Cloud technician. I build with AI on Azure and AWS, test what it actually does, and check every claim against its sources.',
  links: [
    { label: 'GitHub', href: 'https://github.com/shubh-cloudops' },
    { label: 'RSS', href: '/rss.xml' },
  ],
};

/** Buttondown username for the email signup (free up to 100 subscribers). Set PUBLIC_BUTTONDOWN_USER; empty hides the form. */
export const NEWSLETTER_USER: string = import.meta.env.PUBLIC_BUTTONDOWN_USER ?? '';

export type PillarKey = keyof typeof PILLARS;

export const VERDICTS = {
  true: { label: 'True', tone: 'good' },
  'partly-true': { label: 'Partly true', tone: 'warn' },
  overstated: { label: 'Overstated', tone: 'warn' },
  false: { label: 'False', tone: 'bad' },
  unverified: { label: 'Unverified', tone: 'muted' },
} as const;

export type VerdictKey = keyof typeof VERDICTS;

// The blog's brand ambassador: an original AI-illustrated character (see scripts/cover-styles.json).
// variant 'female' (current, chosen 2026-11-04) uses src/assets/ambassador-female; 'male' is the original butler.
export const AMBASSADOR = {
  name: 'Art',
  variant: 'female' as 'female' | 'male',
  role: 'our AI host and brand ambassador',
  short: 'our AI host',
  /** How the animated companion is drawn: 'portrait' (living painting) or '3d' (model in public/models). */
  mode: 'portrait' as 'portrait' | '3d',
};

import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * Editorial rules enforced at build time:
 * - every post lists at least 2 sources
 * - every claim cites at least 2 independent sources (the internet cross-check)
 * - a claim whose cross-check is still "pending" fails the build unless the post is a draft
 */
const source = z.object({
  title: z.string().min(3),
  url: z.url(),
  publisher: z.string().min(2),
  kind: z.enum(['primary', 'independent', 'news']),
});

const claim = z.object({
  text: z.string().min(10),
  verdict: z.enum(['true', 'partly-true', 'overstated', 'false', 'unverified']),
  note: z.string().optional(),
  /** "checked" only after the claim was compared against every listed source. */
  check: z.enum(['checked', 'pending']).default('pending'),
  sources: z.array(z.url()).min(2, 'Cross-check rule: every claim needs at least 2 sources'),
});

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: ({ image }) => z
    .object({
      title: z.string().max(110),
      /** Cover art: AI illustration made by scripts/generate-cover.mjs. Never a fake photo of a real event or person. */
      cover: image().optional(),
      coverAlt: z.string().min(10).optional(),
      coverPrompt: z.string().min(10).optional(),
      // Organisation ids (src/data/orgs.json) for a logo cover: scripts/make-logo-cover.mjs
      coverOrgs: z.array(z.string()).min(1).max(4).optional(),
      // Short punchy headline printed on the logo cover (max ~50 characters); falls back to the title.
      coverLine: z.string().max(60).optional(),
      // Meta description: Google shows about 155-160 characters.
      description: z.string().min(50).max(160),
      // Search-result <title> (keywords first, under 60 characters). Falls back to the title.
      seoTitle: z.string().max(60).optional(),
      // Social share title for X, LinkedIn, Hacker News. Falls back to the title.
      ogTitle: z.string().max(90).optional(),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      pillar: z.enum(['autopsy', 'spec-gap', 'mirror', 'open-question', 'claim-check', 'obedience-test', 'build-log']),
      verdict: z.enum(['true', 'partly-true', 'overstated', 'false', 'unverified']).optional(),
      tags: z.array(z.string()).default([]),
      draft: z.boolean().default(false),
      sources: z.array(source).min(2, 'Every post needs at least 2 sources'),
      claims: z.array(claim).default([]),
      factCheckedOn: z.coerce.date(),
    })
    .superRefine((post, ctx) => {
      if (post.cover && !post.coverAlt) {
        ctx.addIssue({ code: 'custom', path: ['coverAlt'], message: 'A cover image needs alt text (coverAlt) for screen readers.' });
      }
      if (!post.draft && post.claims.some((c) => c.check !== 'checked')) {
        ctx.addIssue({
          code: 'custom',
          message: 'Every claim in a published post must be cross-checked (check: checked). Finish the check, remove the claim, or set draft: true.',
          path: ['claims'],
        });
      }
    }),
});

/**
 * Event trackers: a living timeline of what organisations did after a story broke.
 * The content routine re-checks every "ongoing" tracker and appends new actions.
 * Same rule as posts: every entry needs 2+ sources and a finished cross-check.
 */
const events = defineCollection({
  loader: glob({ pattern: '**/*.{yaml,yml}', base: './src/content/events' }),
  schema: z.object({
    title: z.string().max(110),
    summary: z.string().min(50).max(400),
    status: z.enum(['ongoing', 'settled']),
    startedOn: z.coerce.date(),
    lastChecked: z.coerce.date(),
    relatedPosts: z.array(z.string()).default([]),
    entries: z
      .array(
        z.object({
          date: z.coerce.date(),
          actor: z.string().min(2),
          type: z.enum(['incident', 'disclosure', 'fix', 'investigation', 'regulation', 'ripple']),
          title: z.string().min(5).max(140),
          detail: z.string().min(20),
          /** confirmed = on the record from the actor or an official document; reported = anonymous or second-hand sourcing */
          confidence: z.enum(['confirmed', 'reported']),
          note: z.string().optional(),
          check: z.enum(['checked', 'pending']).default('pending'),
          sources: z.array(z.url()).min(2, 'Cross-check rule: every tracker entry needs at least 2 sources'),
        }),
      )
      .min(1)
      .superRefine((entries, ctx) => {
        entries.forEach((e, i) => {
          if (e.check !== 'checked')
            ctx.addIssue({ code: 'custom', path: [i, 'check'], message: 'Tracker entries must be cross-checked (check: checked) before publishing.' });
        });
      }),
  }),
});

/**
 * Open-Source AI Picks: one YAML file per GitHub repo.
 * Rule: a pick needs coverage from at least 2 known tech outlets, each linked on the page.
 * Image = GitHub's auto-generated social card for the repo (no file stored here).
 */
const picks = defineCollection({
  loader: glob({ pattern: '**/*.{yaml,yml}', base: './src/content/picks' }),
  schema: z.object({
    name: z.string().min(2),
    /** owner/name exactly as on GitHub */
    repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
    tagline: z.string().min(20).max(140),
    category: z.enum(['run-models', 'build-apps', 'agents', 'coding', 'speech', 'images']),
    license: z.string().min(2),
    stars: z.number().int().positive(),
    statsCheckedOn: z.coerce.date(),
    /** When the repo was created on GitHub (written by scripts/update-pick-stars.mjs). Drives the Rising row. */
    createdOn: z.coerce.date().optional(),
    /** Daily star counts written by scripts/update-pick-stars.mjs (oldest first). */
    starHistory: z.array(z.object({ date: z.coerce.date(), stars: z.number().int().nonnegative() })).default([]),
    addedOn: z.coerce.date(),
    whatItDoes: z.string().min(80),
    howToUse: z.object({
      shell: z.string().min(2),
      steps: z.array(z.object({ text: z.string().min(5), code: z.string().optional() })).min(2),
    }),
    bestPractices: z.array(z.string().min(20)).min(3),
    coverage: z
      .array(z.object({ publisher: z.string().min(2), title: z.string().min(5), date: z.coerce.date(), url: z.url() }))
      .min(2, 'A pick needs coverage from at least 2 known outlets'),
    draft: z.boolean().default(false),
  }),
});

export const collections = { posts, events, picks };

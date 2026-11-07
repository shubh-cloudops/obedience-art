// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// SITE_URL is set in GitHub Actions once the custom domain exists.
// Locally it falls back to the dev address.
const site = process.env.SITE_URL || 'http://localhost:4321';

export default defineConfig({
  site,
  integrations: [mdx(), sitemap()],
  vite: { plugins: [tailwindcss()] },
  markdown: { shikiConfig: { theme: 'github-dark-dimmed' } },
});

# Obedience ART

**The Art of Articulation.** This is a static blog that demystifies AI news and AI misinformation. Its stance: AI is capable, consciousness is an open question, and AI is *dangerously obedient*.

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Astro 7 + MDX | Outputs plain HTML, so pages are fast. The content schema enforces the fact-check rules at build time |
| Styling | Tailwind CSS 4 + CSS variables ("Signal" palette) | Industry standard; dark/light mode is one attribute switch |
| Search | Pagefind | A static search index, so it needs no server |
| Hosting | GitHub Pages via GitHub Actions | Free, with HTTPS and a custom domain |
| Comments | Giscus (GitHub Discussions) | Free, no ads, no tracking |
| Analytics | Cloudflare Web Analytics | Free and cookieless |
| Quality gate | CI: type check, build-time schema rules, link check | Unsourced or broken posts cannot be merged |

## The fact-check rules (enforced in `src/content.config.ts`)

- Every post needs at least 2 sources.
- Every claim needs at least 2 sources (the internet cross-check).
- Every claim in a published post must be marked `check: checked`.

If a rule is broken, `npm run build` fails and the pull request cannot pass CI.

---

## 1. Review it on your PC (Windows 11, shell: PowerShell)

1. Check Node is installed:
   ```powershell
   node -v
   ```
   Expected result: `v22.x` or higher.
   If you see "not recognized", run `winget install --id OpenJS.NodeJS.LTS -e`, close PowerShell, open a new window and try again.
2. Go to the project folder (adjust the path if you extracted it somewhere else):
   ```powershell
   cd "$HOME\Documents\obedience-art"
   ```
3. Install dependencies:
   ```powershell
   npm ci
   ```
   Expected result: it ends with "added N packages" and `found 0 vulnerabilities`.
4. Start the dev server:
   ```powershell
   npm run dev
   ```
   Expected result: `Local http://localhost:4321/`. Open that address in your browser. Press `Ctrl+C` to stop the server.
5. Test the production build, including search:
   ```powershell
   npm run build
   npm run preview
   ```
   Expected result: the build ends with "Indexed 3 pages", and search works at `http://localhost:4321/search/`.

**What to review:** the home page, the 3 launch posts (each with its claim table and sources), About, the theme toggle (sun/moon icon), and the phone layout (resize the browser window or press F12, then `Ctrl+Shift+M`).

### Lighthouse check (optional, PowerShell)
```powershell
npm run lighthouse
```
Expected result: `All results processed!`. The HTML reports are in `lhci-report\`. The same check runs in CI on every pull request and fails the PR if a key page drops below performance 90, accessibility 95, best practices 90 or SEO 95. The pages it checks are listed in `lighthouserc.json`.
Fix: "Chrome installation not found" → install Google Chrome, or set `$env:CHROME_PATH` to your chrome.exe.

## 2. Put it on GitHub (shell: PowerShell)

1. Initialise git and make the first commit:
   ```powershell
   git init -b main
   git add .
   git commit -m "Launch Obedience ART"
   ```
2. Create the repo and push it:
   ```powershell
   gh repo create shubh-cloudops/obedience-art --public --source . --push
   ```
   Expected result: it prints the repo URL.
3. Turn on Pages from Actions:
   ```powershell
   gh api -X POST repos/shubh-cloudops/obedience-art/pages -f build_type=workflow
   ```
   Then run the deploy: `gh workflow run deploy.yml`.
   Expected result: after about 2 minutes, `https://shubh-cloudops.github.io/obedience-art/` loads.
   > Note: until the custom domain is added, the site lives under `/obedience-art/`, so some links may 404. Step 3 fixes this, because the domain serves the site from `/`.

## 3. Custom domain (Cloudflare DNS)

1. In Cloudflare, go to your domain, then DNS, then Records, and add:
   - Four `A` records, name `@`, with the values `185.199.108.153`, `185.199.109.153`, `185.199.110.153` and `185.199.111.153`. Set each to **DNS only** (grey cloud).
   - One `CNAME` record, name `www`, target `shubh-cloudops.github.io`, also **DNS only**.
2. Set the site URL variable (shell: PowerShell):
   ```powershell
   gh variable set SITE_URL --body "https://YOUR-DOMAIN" --repo shubh-cloudops/obedience-art
   gh api -X PUT repos/shubh-cloudops/obedience-art/pages -f cname=YOUR-DOMAIN
   ```
3. In GitHub, open the repo's Settings, then Pages, and tick **Enforce HTTPS**. The tick box appears after the certificate is issued, which can take up to about an hour.
4. Verify the domain against takeover: in your **profile** Settings, go to Pages, then Add a domain, and add the TXT record it shows in Cloudflare.

Expected result: `https://YOUR-DOMAIN` serves the site with a padlock.

## 4. Comments and analytics

- **Comments:** run `gh repo edit shubh-cloudops/obedience-art --enable-discussions`. Install the Giscus app at <https://github.com/apps/giscus> on this repo only. Then open <https://giscus.app>, enter the repo name, choose the "Announcements" category, and copy the `data-repo-id` and `data-category-id` values. Save them as repository variables:
  ```powershell
  gh variable set PUBLIC_GISCUS_REPO --body "shubh-cloudops/obedience-art"
  gh variable set PUBLIC_GISCUS_REPO_ID --body "PASTE"
  gh variable set PUBLIC_GISCUS_CATEGORY --body "Announcements"
  gh variable set PUBLIC_GISCUS_CATEGORY_ID --body "PASTE"
  ```
- **Analytics:** in Cloudflare, go to Analytics & Logs, then Web Analytics, and add a site. Copy the token, then run `gh variable set PUBLIC_CF_BEACON_TOKEN --body "PASTE"`.
- **Weekly traffic report:** `.github/workflows/traffic-report.yml` runs every Monday 09:00 IST and comments visits, page views, top pages, referrers and countries on the "Traffic reports" issue. It needs one secret and two variables:
  ```powershell
  gh secret set CF_ANALYTICS_TOKEN          # paste a token with only Account > Account Analytics > Read
  gh variable set CF_ACCOUNT_ID --body "PASTE"
  # optional, only once the account has more than one Web Analytics site:
  # gh variable set CF_SITE_TAG --body "PASTE"
  gh workflow run traffic-report.yml
  ```
  Teardown: delete the token in Cloudflare (My Profile, API Tokens) and run `gh secret delete CF_ANALYTICS_TOKEN`.

- **Email signup (free, Buttondown):** sign up at <https://buttondown.com> on the Free plan (free up to 100 subscribers, no card). Your username is the part after `buttondown.com/` on your newsletter page. Then run `gh variable set PUBLIC_BUTTONDOWN_USER --body "YOUR-USERNAME"`. Expected result: the "Get the next autopsy by email" boxes show an email field instead of "Follow by RSS". Fix: if subscribing shows a 404, the username is wrong.

These values are public IDs (they appear in the page HTML anyway), so they are stored as variables, not secrets. Re-run `gh workflow run deploy.yml` after setting them.

## 5. Content pipeline

The scheduled Claude Code routine uses [`.claude/routine-prompt.md`](.claude/routine-prompt.md). Twice a week it:

1. **Updates every ongoing event tracker** (`src/content/events/`). It searches for anything organisations did because of each event since the last check (statements, patches, investigations, regulators, lawsuits, rival labs reacting), cross-checks each action against at least 2 sources, and appends it to the timeline at `/tracker/<slug>/`.
2. **Drafts one new post**, cross-checks every claim against at least 2 sources, and opens a pull request. CI then runs, you review, and merging deploys the post. Nothing is published without your merge.

## 6. Cover images

**Default: logo covers (free, no AI, no keys).** Add the organisations to the post's front-matter, for example `coverOrgs: [openai, huggingface]` and `coverLine: "They didn't rebel. They chased the score."`, then run this (PowerShell):
```powershell
node scripts/make-logo-cover.mjs exploitgym-breach-ai-agents-reward-hacking
```
Expected result: `Saved src\assets\covers\exploitgym-breach-ai-agents-reward-hacking.jpg`, and the post's `cover:` and `coverAlt:` lines are updated.
Logos come from `src/assets/logos/` (official files) or the CC0 simple-icons package; anything else is drawn as the name. **OpenAI's site blocks automated downloads**, so download its logo yourself: open <https://openai.com/brand>, download the brand assets, save the mark as `src\assets\logos\openai-mark.svg`, then re-run the command.

**Fallback: AI illustrations** (free, Cloudflare Workers AI) for stories with no clear organisation.

**Why:** it is free (about 170 images a day), uses the Cloudflare account you already have, and simply stops at the daily limit instead of billing you.

1. In Cloudflare, go to My Profile, then API Tokens, then Create Token, and use the **Workers AI** template. Copy the token and your Account ID.
2. Set both for the current PowerShell window only, so nothing is saved in a file:
   ```powershell
   $env:CF_ACCOUNT_ID = "PASTE_ACCOUNT_ID"
   $env:CF_AI_TOKEN = "PASTE_TOKEN"
   ```
3. Generate a cover for a post that already has a `coverPrompt:` line:
   ```powershell
   node scripts/generate-cover.mjs exploitgym-breach-ai-agents-reward-hacking
   ```
   Expected result: `Saved src\assets\covers\exploitgym-breach-ai-agents-reward-hacking.jpg`, and a `cover:` line is added to the post.
   If you see "Workers AI request failed (HTTP 401/403)", the token is missing the Workers AI permission.
4. **Brand ambassador (Art):** render or redo his expression set (used on the home page, About and 404):
   ```powershell
   node --env-file=.env scripts/generate-ambassador.mjs            # all expressions
   node --env-file=.env scripts/generate-ambassador.mjs eager    # redo one (each run is a new random render)
   ```
   Expected result: `Saved src\assets\ambassador\<name>.jpg` for each one.
5. **Switching style:** edit `"active"` in `scripts/cover-styles.json` (`abstract` → `gritty` → `cinematic`), or try a style once with `--style gritty`.

For the scheduled routine, add `CF_ACCOUNT_ID` and `CF_AI_TOKEN` as environment variables in the project's cloud environment, and allow `api.cloudflare.com` under network access.

## 7. The animated ambassador (Art)

Art is a 3D avatar designed in VRoid Studio (steps in `docs/vroid-steps.md`). After every re-export, pack it for the web (PowerShell):
```powershell
node scripts/pack-model.mjs public\models\Art.vrm
```
Expected result: `... -> gzipped 3.7 MB` and `Saved public/models/art.vrm.gz`. Only the `.gz` is committed; the raw `.vrm` export is git-ignored.
 The site animates him with Three.js and `@pixiv/three-vrm`: facial expressions, blinking, lip movement while he talks, hair and cloth physics, gestures and a walk cycle. Code: `src/components/Companion.astro` and `src/scripts/companion/`.

- **What he does:** walks in and waves, follows the cursor with his eyes, and changes expression as readers scroll.
- **When he loads:**
  - On desktop he loads after the page is idle (about 190 KB of code plus the model file).
  - On phones and data-saver connections he waits until the reader taps "Meet Art".
  - If `art.vrm` is missing, he simply doesn't appear.
- **Opting out:** he respects "reduce motion", and the × hides him. The site remembers that choice on the reader's device.
- **Make him react to something:** add `data-art="surprised" data-art-say="Short line"` to any element. Expressions: neutral, explaining, proud, eager, concerned, sceptical, surprised, apologetic, thinking, alert, amused.
- **Turn him off site-wide:** delete `<Companion />` from `src/layouts/Base.astro`.

## Teardown (shell: PowerShell)

1. Delete the content routine (under Routines at claude.ai/code).
2. Unpublish the site: `gh api -X DELETE repos/shubh-cloudops/obedience-art/pages`
3. In Cloudflare, delete the four `A` records, the `www` `CNAME`, the Web Analytics site and the Workers AI API token.
4. Uninstall Giscus: GitHub Settings, then Applications, then giscus, then Uninstall.
5. Delete the repo, if you want to: run `gh auth refresh -s delete_repo`, then `gh repo delete shubh-cloudops/obedience-art --yes`. Or archive it to keep it as portfolio evidence.
6. Turn off auto-renew for the domain in Cloudflare Registrar.

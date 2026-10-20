# ✏️ Sketch2UI — Live Sketch-to-UI Engine

**Draw a wireframe → get a live, interactive React + Tailwind UI in seconds.**

Built for the **Meta Global AI Developer Hackathon** (Indie track) on the **Meta Model API**. One sketch runs through three Meta model families in a single, visible pipeline:

1. **SAM 3.1 — segmentation pre-pass.** The sketch is segmented first; the resulting element map (shown as a labelled box overlay on your sketch) is fed into the generation prompt so the layout is placed faithfully. If SAM is unavailable, the app falls back to the vision model for the map — and the overlay honestly labels which engine ran.
2. **Muse Spark 1.3 — vision + code generation.** It reads the sketch, your annotations (red notes and arrows act as instructions) and the element map, then writes a working React + Tailwind app that renders live in a sandboxed preview. Iterate in words; the current code is sent along so the model *updates* instead of rebuilding.
3. **Muse Image 1.0 — real assets.** Image placeholders in the generated UI are replaced automatically with AI-generated images (provider-generic; Muse Image on Meta).

When the app looks right, **Publish** puts it on a shareable full-screen link (`#app=…`) with a QR code — visitors see only the app: no editor, no settings, no API keys.

- **Live demo:** https://ai-check-blond.vercel.app/ — bring your own key, or see *Hosted demo mode* below.
- **Canvas:** Excalidraw (MIT)
- **Renderer:** sandboxed iframe (Babel + import maps + Tailwind CDN) — supports `react`, `lucide-react`, `recharts`
- **Providers:** Meta Model API (Muse Spark) first — or any vision LLM via OpenRouter, Google Gemini, Meta Llama API (legacy), or any OpenAI-compatible API
- **Interface:** full English / Arabic (RTL) — and it generates Arabic UIs, not just English ones.
- **Local workspace:** provider settings, sketches and code history stay in your browser. GitHub tokens and backend tester tokens are kept in memory only.

## Demo

> 📹 **Demo video & screenshots — placeholder, coming soon.** A short walkthrough (paper sketch → photo → working app, with the SAM overlay and Muse Image assets) will be linked here.

## Hosted demo mode (optional)

A deployment can offer a no-key demo so visitors (and hackathon judges) can generate immediately:

1. In Vercel → Project → Settings → Environment Variables, set `META_MODEL_API_KEY` to a Meta Model API key.
2. Redeploy. The site detects demo mode via `/api/demo`, adds a **Meta Model API (Demo)** provider automatically on a visitor's first visit, and routes its requests through `/api/proxy`, which injects the key server-side for `api.meta.ai` requests only.
3. Guardrails: demo requests are rate-limited per visitor (40 per 10 minutes, best effort per instance) on top of the in-app usage budgets, and a visitor's own key is never overridden. The key is never exposed to the browser. Remove the variable and redeploy to disable demo mode.

## Features (MVP)

1. Split-screen workspace: canvas ↔ live preview / code tab (copy, download `.jsx` / `.html`)
2. Sketch + prompt iteration: the current code is sent along so the model *updates* instead of rebuilding
3. 1-click demo presets: Dashboard, Landing page, Mobile app
4. Annotation recognition: red notes + arrows act as instructions to the model
5. Live Sync (debounced auto-generate), streaming output, version history, “Fix with AI” for runtime errors
6. Multi-provider settings: add API keys, fetch the model list, search by model name, filter to vision models
7. Meta pipeline: SAM 3.1 segmentation pre-pass with overlay, automatic Muse Image asset generation, one-click Publish (full-screen `#app=` link + QR code), optional hosted demo mode

## Workspace tools

The workspace uses a monochrome day/night design. Use the moon/sun toggle to
switch appearance or the adjacent device icon to follow the system. Narrow
screens have bottom navigation for Sketch, Preview and Instructions, plus a
workspace-tools bottom sheet. Desktop supports a collapsible sidebar, a saved
resizable split and focus views. Keyboard navigation, reduced motion
and theme persistence are supported; see `UI_DESIGN.md` for design references.
Quick suggestions fill the composer for review; use Generate/Update interface to
apply them. ZIP, GitHub, JSX, HTML and copy actions are in the Export menu. Theme
and Code/Preview switching preserve the running generated interface state.

- **Select element:** click preview elements to edit static text, colors, padding
  and corner radius in the actual JSX. Nested/dynamic text uses targeted AI edits.
  Repeated instances share a source template. Lock an element to reject changes
  to its JSX; unlock from the element editor or the locked-elements list.
- **Project ZIP:** runnable React/Vite/Tailwind project, backend runtime and contract.
  Multiple screens are exported into separate source modules with shared navigation.
  JSX/HTML downloads export the current screen, including the backend runtime.
- **Backend:** import OpenAPI 3 JSON (local schema refs supported), configure
  endpoints/response paths/field mapping, and test requests. Demo CRUD stays in
  memory; HTTP mode requires your backend and its CORS/auth setup. YAML and remote
  schema refs are not supported. Regenerate existing UI to adopt a new contract.
- **Test UI:** JSON scenarios with `exists`, `click`, `fill` and `expectText` steps,
  CSS selectors and string `value` for fill/text assertions. Tests use a fresh demo
  iframe, share state in scenario order and block app fetch/XHR. The default test
  checks only that a page renders; add assertions for your actual user flows.
- **Screens:** separate sketches and histories; add labelled links between screens.
  Generate each screen independently; screen detection from a multi-frame drawing
  is not automatic. Rename/delete and switch screens from this panel.
- **Brand:** saved logo/palette/font/radius/direction applied to future model requests.
- **Reference:** independent style image, sent separately from the layout sketch.
- **GitHub:** review exported files and create a new branch/PR using a session token.
  Requires an initialized repository and Contents/Pull requests write permissions.
  Unrelated files are retained; merge/review and deployment remain your GitHub/Vercel
  workflow. This exports changes; it is not continuous two-way repository sync.
- **3 designs:** three sequential calls to the selected model with the same input.
  Choose one to add to history; compare alternatives saved per screen. Stop cancels
  the remaining batch. This uses up to three generation requests.
- **Share / review:** compressed snapshot link for a deployed copy of this editor.
  Reviewers select elements and return comments as a JSON file; import them against
  the matching source snapshot and explicitly apply feedback with AI. No cloud
  comment sync or authentication; anyone with the link can view its source.
  Encoded links are limited to 60 KB, and some messaging services impose smaller
  URL limits. Localhost links work on the same computer only.

## Productivity studio

The sidebar now opens ten additional tools: automatic quality checks and bounded
repair, approved plans, shared source components, reference-image comparison,
request budgets, existing React-project import, before/after change review, Figma
structure/assets, video interaction references and independent saved projects.
Supabase is prepared for connection later; browser captures need a Chrome service.
See [PRODUCTIVITY.md](PRODUCTIVITY.md) for exact capabilities, limits, service
setup, Supabase SQL and verification boundaries.

## Generation requirements

The generation instructions in `src/lib/prompts.ts` require working controls,
validated forms and loading/error/empty states. Generated JSX should include an
in-memory demo adapter and an HTTP adapter behind the same service interface,
with API configuration and a proposed endpoint/data contract documented in code.
Demo mode is the default so the sandboxed preview works before a backend exists.
When connecting a real backend, supply its contract in the generation request,
configure its absolute base URL and authentication/CORS, and verify the generated
integration against that backend. These are generation requirements, not a
guarantee that every model output works or matches an unspecified backend.

## Run locally

Use Node.js 22.18+ within Node 22, or Node 24.11+ (tested with Node 24.21), and npm.

```bash
npm install
npm run dev
```

Open http://localhost:5173 → ⚙️ Settings → add a provider → paste your key → **Fetch models** → pick a vision model.

## Verify changes

```bash
npm test
npm run typecheck
npm run build
npm run dev
```

In another terminal run `npm run test:browser`. Tests use installed Chrome on
Windows, or Playwright's Chromium (`npx playwright install chromium`). Override
`CHROME_PATH` and `S2UI_TEST_URL` if needed. Browser tests use isolated synthetic
projects, mocked providers/GitHub/backends and do not publish real repositories.
See `TODO.md` and `VALIDATION.md` for per-feature results and verification limits.

## Deploy to Vercel

Upload the **contents of this folder** to the GitHub repository root: `src/`,
`api/`, `index.html`, `package.json`, `package-lock.json`, `tsconfig.json`,
`vite.config.ts`, `.gitignore`, and this README. Keep `package-lock.json` so
dependency installation is reproducible. Do not upload `node_modules/` or
`dist/`; Vercel installs dependencies and builds the site automatically.

If you upload the enclosing `sketch2ui` folder instead, set Vercel's **Root
Directory** to `sketch2ui`. When the contents are at the repository root,
leave Root Directory at its default. For an existing Vercel project, check
these settings under **Settings → Build and Deployment**.

1. Push this folder to GitHub.
2. In Vercel: **Add New → Project →** import the repo. The framework is detected as **Vite** (build `npm run build`, output `dist`).
3. Deploy. No environment variables are needed.

`api/proxy.js` deploys automatically as an Edge Function. It's an optional, stateless CORS
pass-through, used only when **“Use proxy”** is turned on for a provider (on by default for the Meta Model API). It also powers hosted demo mode (see above).
It only forwards to the hosts in its `ALLOWED_HOSTS` list. Edit that list if you add a custom endpoint.

## Recommended models

| Provider | Model |
| --- | --- |
| Meta Model API | `muse-spark-1.3` (chat/vision) · `muse-image-1.0` (images) · `sam-3.1` (segmentation) |
| Meta Llama API | `Llama-4-Maverick-17B-128E-Instruct-FP8` |
| OpenRouter | `meta-llama/llama-4-maverick`, `google/gemini-2.5-flash` |
| Gemini | `gemini-2.5-flash` / `gemini-2.5-pro` |


### Design home and canvas studio
The root URL opens the new Stitch-inspired design home. Start from a description, choose Web/App, edit a prompt starter, attach a reference, or open a saved local project. The `#studio` deep link opens the editor directly. The studio keeps the existing sketch/preview split and phone navigation alongside the new floating controls. See `UI_DESIGN.md` for the design rationale and scope.


### English and Arabic
Use the **EN / AR** buttons in the home, studio or review header. English is the default on a first visit; the selected language is saved on the device. Arabic uses a right-to-left layout and the drawing library's Arabic locale. Interface translation does not rewrite project source, imported files, names supplied by users, API identifiers or generated preview content. Code, JSON, URLs and credentials retain left-to-right input where appropriate.

Arabic UI messages are maintained in `src/lib/ar.json`. `src/lib/i18n.ts` handles interpolation, UI diagnostics and locale persistence; `LanguageToggle.tsx` subscribes React without remounting the editor. `npm test` checks translation coverage and placeholder integrity. `npm run test:browser` includes the English/Arabic regression flow.

# ✏️ Sketch2UI — Live Sketch-to-UI Engine

Draw a wireframe → get a live, interactive React + Tailwind UI in seconds.

- **Canvas:** Excalidraw (MIT)
- **Brain:** any vision LLM — Meta Llama API, OpenRouter (incl. Llama 4), Google Gemini, or any OpenAI-compatible API
- **Renderer:** sandboxed iframe (Babel + import maps + Tailwind CDN) — supports `react`, `lucide-react`, `recharts`
- **Local workspace:** provider settings, sketches and code history stay in your browser. GitHub tokens and backend tester tokens are kept in memory only.

## Features (MVP)

1. Split-screen workspace: canvas ↔ live preview / code tab (copy, download `.jsx` / `.html`)
2. Sketch + prompt iteration: the current code is sent along so the model *updates* instead of rebuilding
3. 1-click demo presets: Dashboard, Landing page, Mobile app
4. Annotation recognition: red notes + arrows act as instructions to the model
5. Live Sync (debounced auto-generate), streaming output, version history, “Fix with AI” for runtime errors
6. Multi-provider settings: add API keys, fetch the model list, search by model name, filter to vision models

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
pass-through, used only when **“Use proxy”** is turned on for a provider (on by default for Meta Llama API).
It only forwards to the hosts in its `ALLOWED_HOSTS` list. Edit that list if you add a custom endpoint.

## Recommended models

| Provider | Model |
| --- | --- |
| Meta Llama API | `Llama-4-Maverick-17B-128E-Instruct-FP8` |
| OpenRouter | `meta-llama/llama-4-maverick`, `google/gemini-2.5-flash` |
| Gemini | `gemini-2.5-flash` / `gemini-2.5-pro` |

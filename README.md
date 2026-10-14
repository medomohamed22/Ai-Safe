# ✏️ Sketch2UI — Live Sketch-to-UI Engine

Draw a wireframe → get a live, interactive React + Tailwind UI in seconds.

- **Canvas:** Excalidraw (MIT)
- **Brain:** any vision LLM — Meta Llama API, OpenRouter (incl. Llama 4), Google Gemini, or any OpenAI-compatible API
- **Renderer:** sandboxed iframe (Babel + import maps + Tailwind CDN) — supports `react`, `lucide-react`, `recharts`
- **100% client-side:** API keys, models, sketch and code history are stored in `localStorage` only

## Features (MVP)

1. Split-screen workspace: canvas ↔ live preview / code tab (copy, download `.jsx` / `.html`)
2. Sketch + prompt iteration: the current code is sent along so the model *updates* instead of rebuilding
3. 1-click demo presets: Dashboard, Landing page, Mobile app
4. Annotation recognition: red notes + arrows act as instructions to the model
5. Live Sync (debounced auto-generate), streaming output, version history, “Fix with AI” for runtime errors
6. Multi-provider settings: add API keys, fetch the model list, search by model name, filter to vision models

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173 → ⚙️ Settings → add a provider → paste your key → **Fetch models** → pick a vision model.

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

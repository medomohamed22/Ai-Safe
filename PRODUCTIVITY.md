# Productivity studio

Open **Productivity** in the workspace sidebar (phone: menu → Productivity).
Each numbered feature was implemented and checked before starting the next one.

1. **Quality** — optional checks after generation; JSX/default export checks, a
   fixed-config Vite JavaScript bundle, real demo interaction scenarios and
   rendered checks at 390/820/1440px. Approved plan requirements can generate
   scenarios. Optional AI repair stops after two attempts or unchanged output;
   the workspace changes only when the checked repair is adopted. This does not
   certify CSS output, TypeScript types, complete accessibility or live APIs.
2. **Plan** — generate/edit/approve acceptance requirements per screen. Approved
   plans are included in subsequent normal generation and alternative requests.
   Verification checkboxes are manual; generating code does not mark them passed.
3. **Library** — default-exported React function components with props, imported
   by name from `@sketch2ui/library`. Updating a shared definition updates all
   referencing previews. Exports inline current definitions; selecting internal
   library DOM is intentionally disabled (edit its definition in Library).
   Supported component imports: React and lucide-react. Maximum 30 components.
4. **Visual compare** — actual Chrome screenshots, normalized pixel difference
   and a difference map; optional two-image AI analysis and at most two explicit
   refinements. Pixel difference is not a fidelity or quality guarantee. Captures
   block external hosts except the supported runtime/font CDNs; blocked assets
   are reported and can affect results.
5. **Usage** — generation requests share request/token/estimated-dollar limits,
   pending duplicate protection, cancellation records and a source-free ledger.
   Provider token counts are used when available, otherwise estimates. Each
   pending request reserves 16,384 output tokens. Enter model prices yourself;
   a dollar limit cannot start with unpriced usage. Estimates are not billing.
6. **Import project** — bounded React/Vite ZIP or read-only GitHub source tree,
   raw-file editing, targeted AI changes, fixed-config JSX/TSX bundling and CSS
   injection, original-tree ZIP export and reviewed GitHub PR export. Maximum
   80 files / 2 MB; secret/env, dependency and generated output files are excluded.
   No imported config or npm script runs. Supported packages: React, React DOM,
   lucide-react and recharts. Next.js server features, custom aliases, CSS asset
   URLs and extra dependencies require a full runtime. Edit the imported source
   in this tab; normal canvas generation creates a separate single-file screen.
7. **Review** — opt into staging normal generations before adoption. Independent
   before/candidate previews, source diff, optional AI explanation and screenshot
   difference. Source/screen changes invalidate a pending review. Acceptance is
   explicit; rejection leaves current code/history unchanged.
8. **Figma** — frame REST URL or nodes JSON; imports layer structure, typography,
   auto-layout and vector metadata, the rendered frame and up to six image fills.
   Image fills are stored locally and referenced with `s2ui-asset:KEY`, resolved
   by previews/exports. Live read requires your own `file_content:read` token.
   Token is cleared after reading and is not saved. Private Figma access and
   actual model conversion quality were not tested with a live account.
9. **Video** — local decode of MP4/WebM up to 25 MB / two minutes into six timed
   JPEG frames. Add interaction notes, analyze into an editable flow specification,
   then generate code. Only frames and notes go to the chosen model on request.
   Six samples cannot capture all timing, transitions, sound or hidden logic.
10. **Projects** — independent IndexedDB projects, autosave, explicit open,
    project-only JSON backups and import. Provider settings stay global and are
    excluded from backups, along with cloud/service sessions. LocalStorage still
    holds the active workspace and has browser quota limits; save failures are
    surfaced. Supabase cloud configuration is prepared for later user setup.

## Services and deployment

The existing frontend can remain on GitHub/Vercel. Node API routes perform the
fixed build and imported-project bundle. Browser captures additionally need a
host with installed Chrome/Chromium; an ordinary Vercel deployment does not
provide the browser binary automatically.

Local development: `npm ci`, then `npm run dev`.

To verify a production frontend together with the services on this computer:

```powershell
npm run build
npm run serve
```

`server.mjs` binds to `127.0.0.1:5175` by default and serves `dist/` plus APIs.
Set `CHROME_PATH` if installed Chrome is elsewhere. Linux hosts can install
Playwright's Chromium using `npx playwright install chromium --with-deps`.
Captures use Chromium's sandbox; configure your host to support it.

For a separate remote service, configure `HOST`, `PORT`, `APP_ORIGIN` (the exact
Vercel frontend origin) and `RUNNER_TOKEN` on that host. In Productivity's
**Optional build / browser service**, enter its HTTPS origin and access token.
The connection is kept in sessionStorage for this tab, excluded from project
backups. Cross-origin service requests require the configured origin and token.
Do not use an unauthenticated publicly exposed browser service.

Build APIs never execute generated config/scripts or install user packages.
The source checker rejects filesystem/environment build macros and unsupported
imports. Browser captures use a separate session without personal browser data
and block private-network/custom API requests. These limits do not constitute
a general-purpose sandbox for arbitrary server code.

## Connect Supabase later

1. Create your Supabase project and run `supabase/schema.sql` in its SQL editor.
2. Enable email/password authentication and create/confirm your user account.
3. In **Projects**, enter the HTTPS project origin and publishable/anon key.
   Never put a service_role/secret key in the browser.
4. Sign in, save the current project, or enable signed-in autosave synchronization.

The supplied schema enables owner-only RLS. The save RPC uses expected revision
numbers; a conflicting newer remote revision is reported rather than silently
overwritten. Opening a differing cloud project preserves an independent local
backup first. Authentication sessions are tab-scoped and cleared on sign-out.
Provider API keys and other sessions are not part of the project snapshot.
Source code itself may contain whatever you placed in it; inspect it before
sharing backups or projects.

The Supabase integration was verified with mocked HTTP responses, not a live
database. SQL execution, real account/authentication policies and cross-device
cloud operation await the user's Supabase connection.

## Validation

`npm test` covers source contracts. `npm run test:browser` runs the original
15 browser workflows plus nine productivity workflow groups and two additional
UI/shared-review integration groups (26 total). The browser suite
needs the APIs: use `npm run dev`, or build then `npm run serve` and set
`S2UI_TEST_URL=http://127.0.0.1:5175` in a second terminal.
Model, GitHub, Figma and Supabase responses in tests are mocked. UI interactions,
Chrome captures, local WebM decoding and source bundling use real browser/runtime
operations. There was no live provider billing or production deployment test.

Official references consulted: [Figma file endpoints](https://developers.figma.com/docs/rest-api/file-endpoints/),
[Supabase password auth](https://supabase.com/docs/guides/auth/passwords), and
[Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

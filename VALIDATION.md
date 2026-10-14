# Validation and boundaries

## UI/UX redesign verification

The monochrome redesign was checked with the existing 12 Chrome workflows plus
dedicated UI and responsive workflows (14 groups total) against the production
build. TypeScript, source/contract checks and production build passed.

UI checks cover saved day/night/system appearance, system preference updates,
neutral drawing-tool highlights, reduced-motion behavior, dialog Tab containment,
Escape dismissal and focus return, native canvas dark mode, mobile settings,
keyboard model selection and keeping preview state through theme/code-tab changes.
The final contrast/mobile-action refinements are covered by targeted UI/responsive
checks against the rebuilt production bundle.

Six viewports (320, 390, 820, 900, 1024 and 1440 px) were checked for document
overflow and useful preview space. Day, night, mobile and modal screenshots were
inspected after finite animations completed. No cloud deployment was performed.

Implemented and tested locally on Windows with Node 24.21 and Chrome.
Each numbered feature was implemented and checked before starting the next.
The final pass also added hard JSX locks and corrected mobile toolbar overflow.

## Final result

PASS: source/contract checks, TypeScript, production build, all 14 Chrome workflow groups, and independent exported-project builds.

## Checks

- `npm test`: source edits/locks, OpenAPI and demo CRUD, mocked HTTP response
  mapping/errors/204, OpenAI/Gemini multi-image payloads, ZIP contents,
  multi-screen source export, compressed review links and GitHub conflict guards.
- `npm run typecheck`: TypeScript check.
- `npm run build`: production build.
- `npm run test:browser`: isolated Chrome workflows for the ten features, plus
  source-lock protection, alternative-batch cancellation and mobile layout.
  Set `S2UI_TEST_URL=http://127.0.0.1:5175` to target `vite preview` production.
- Exported ZIP was extracted, dependencies installed, and built independently.
- Desktop/mobile screenshots were inspected; generated images and QA projects
  are ignored and excluded from the upload archive.

## What the browser workflows cover

1. Selection blocks app clicks; text/padding edit the saved JSX, handlers survive,
   and history/refresh work. Locked source rejects changes until unlocked.
2. Project ZIP download and content preservation.
3. OpenAPI import, demo/HTTP tests, field mapping and session-only tokens.
4. Actual React click/fill/assertion execution; deliberate failure is reported.
5. Screen navigation, independent state/history and saved active screen.
6. Brand identity persists and reaches generation requests.
7. Independent reference upload and labelled sketch/reference image payloads.
8. Read-only GitHub review; explicit branch/commit/PR workflow and PR-only retry.
9. Exactly three sequential generation calls; choose one, retain alternatives.
10. Separate review session, element comments, JSON return and targeted feedback.

## Verification limits

- Provider, GitHub and backend responses in integration tests are mocked. No
  real provider request, real repository write, user authentication, payment or
  Vercel deployment was performed. Model compliance and generated app quality
  still need real-provider testing with your selected model.
- This is a first working version of the features. Backend import is OpenAPI 3
  JSON; screens are generated individually and linked explicitly. GitHub is an
  export-to-PR workflow, not continuous two-way sync.
- Test UI verifies only the configured scenarios in demo mode. The initial
  render check alone does not establish that all controls work.
- Review links need the updated editor deployed at their base URL, carry the
  generated source in the URL fragment and have a 60 KB encoded limit. Comments
  are browser-local and returned as files; there is no cloud comment sync.
- Preview still depends on external React/Babel/Tailwind CDNs. Production build
  passes with the existing large-chunk warning; no performance budget was measured.

## GitHub API references

The implementation uses GitHub's documented [tree creation](https://docs.github.com/en/rest/git/trees#create-a-tree),
[Git references](https://docs.github.com/en/rest/git/refs#create-a-reference),
and [Pull Request creation](https://docs.github.com/en/rest/pulls/pulls#create-a-pull-request)
with a session token. Review happens before writes; changed base commits invalidate
the review, and unrelated repository files are retained through `base_tree`.


## Studio redesign verification — 2026-10-14

- `npm run typecheck`: passed.
- `npm test`: all seven source/contract groups passed.
- `npm run build`: passed; existing large-bundle warning remains.
- `S2UI_TEST_URL=http://127.0.0.1:5175 npm run test:browser`: all 15
  browser workflow groups passed against the production build in Chrome.
- New checks include persisted pointer/keyboard split resizing, pane focus,
  sidebar collapse, grouped exports, contextual inspector, mobile draft and
  running-preview preservation, tools sheet focus/Escape/return, and applying
  source edits from a phone-sized viewport.
- Responsive checks cover 320, 390, 820, 900, 1024 and 1440 pixels, with no
  horizontal page overflow and preview height at least 160px. A 390x500 viewport
  also verifies the instructions action remains reachable.
- Visual inspection covered desktop day/night, phone sketch/preview/instructions,
  and the phone tools sheet. Screenshot fixtures are excluded from the upload ZIP.
- External provider, GitHub and backend responses remain mocked in these tests.
  No physical phone, live model quality, live API, GitHub write or Vercel deploy
  was verified as part of this layout change.


## Ten productivity features — 2026-10-14

Implemented in proposal order. Each feature's targeted checks passed before work
started on the next feature; see the completed productivity section in TODO.md.

- `npm run typecheck`: passed.
- `npm test`: all 12 source/contract groups passed, including actual Vite bundle
  compilation, a chart bundle using the matching Recharts version, unresolved
  symbols, unsupported Node imports and obfuscated import.meta macro rejection.
- `npm run build`: passed with the existing large-chunk warning. The resulting
  main JS is approximately 2.15 MB raw / 661 KB gzip; no performance budget was measured.
- Production app/services: `npm run serve` on localhost:5175. Original 15 browser
  workflows and nine productivity workflows passed as a complete run. Two extra
  browser groups then passed for all ten tabs on phone/tablet, authenticated remote
  service routing, and independent shared-component/asset review links (26 total).
- After final ZIP-root/backup validation fixes, imported project, workspace/cloud
  and automatic quality/repair browser groups were rerun and passed on production.
- Desktop day/night and phone screenshots were inspected. UI checks cover all ten
  productivity sections at 320, 390 and 820px; existing layout checks cover six
  sizes from 320 to 1440px. No physical phone was tested.
- Real operations: React interactions, fixed-config production JS bundling,
  imported JSX/TSX/CSS compilation, screenshot capture in sandboxed Chrome,
  pixel-difference calculation, WebM decoding/seeking, local IndexedDB persistence,
  workspace switching and shared component updates across two screens.
- Mocked operations: model generation/quality, GitHub, Figma REST/asset downloads,
  and Supabase auth/RPC/conflicts. No real provider charge, repository write,
  private Figma access, Supabase schema/RLS execution or Vercel deployment occurred.
- Supabase preparation matches the user's choice to connect it later. The schema,
  owner-only policies, optimistic save RPC and setup instructions are supplied;
  real account/cloud verification remains pending that connection.
- Browser capture requires installed Chrome/Chromium. It works in local dev and
  the supplied production service. Vercel users must connect a browser-capable
  service for capture; ordinary frontend hosting does not supply that binary.
- Full WCAG compliance, CSS build output, generated TypeScript types, arbitrary
  frameworks/packages, video/audio timing and live backend behavior are not
  certified by the available checks. See PRODUCTIVITY.md for per-feature bounds.

Final workspace regression also passed: opening the already-active project keeps its latest browser snapshot instead of restoring an older IndexedDB snapshot.

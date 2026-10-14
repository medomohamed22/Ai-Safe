# Sketch2UI feature roadmap

## UI/UX redesign

- [x] Black/white visual system with persistent day/night/system modes.
- [x] Structured workspace, refined composer and grouped tools.
- [x] Responsive Sketch/Preview switching and usable mobile settings.
- [x] Motion for controls, panels, menus, theme and dialog entrance/exit.
- [x] Reduced motion, keyboard navigation and dialog focus behavior.
- [x] Preserve preview state while switching theme or inspecting code.
- [x] Final production regression and refreshed upload archive.

## Functional features

Implement in numbered order. A feature is complete only after its checks pass.
Keep deployment to the existing GitHub/Vercel workflow; no hosting migration.

- [x] 1. Select and edit preview elements; save changes to JSX and history.
- [x] 2. Export a complete runnable project ZIP.
- [x] 3. Backend connection wizard with an explicit API contract and request testing.
- [x] 4. Run interaction checks and report actual results.
- [x] 5. Multiple screens and navigation map.
- [x] 6. Saved brand identity applied to generation.
- [x] 7. Dedicated reference image input alongside the sketch.
- [x] 8. GitHub integration with reviewed commits/PRs.
- [x] 9. Three alternative designs for the same sketch.
- [x] 10. Shareable review and element comments.

## Validation log

Baseline: React/Vite, JSX/HTML exports, three device previews, local code history,
and runtime-error repair already exist. Backend instructions are generation
requirements, not a verified backend connection.

Feature 1 passed: source checks preserve handlers and dynamic style/text;
Chrome verified selection suppresses button actions, applying text/padding saves
JSX, the button still works in interaction mode, undo/redo and reload persist.
TypeScript and production build passed. No live model/provider request was used.

Feature 2 passed: browser ZIP download, ZIP extraction/content checks, independent
npm installation and production build of the extracted React/Vite project.

Feature 3 passed: OpenAPI import, demo CRUD, mapped HTTP responses, failures and
204 responses; Chrome verified the wizard and token handling using a mocked API.
No user's backend or real authentication was tested.

Feature 4 passed: Chrome executed real React click/controlled-input scenarios;
a deliberately wrong expected value failed with step details. Test scope is
explicit scenarios in demo mode, not proof of every behavior or real backend.

Feature 5 passed: Chrome navigation/add-screen/independent-history/reload checks;
multi-screen project export built successfully as an independent Vite project.

Feature 6 passed: Chrome saved/reloaded brand identity and verified brand name
and RTL direction in generation requests. Provider response was mocked; actual
model adherence to the identity has not been measured.

Feature 7 passed: Chrome image upload/preprocessing/persistence and generation
request contained separate sketch/reference images. OpenAI-compatible and Gemini
multi-image payload checks passed with mocked providers.

Feature 8 passed: browser read-only review, branch/commit/PR and PR-only retry
with mocked GitHub API; token not persisted. No real GitHub write or Vercel
deployment was performed. Empty repositories are explicitly unsupported.

Feature 9 passed: Chrome verified exactly three sequential mocked generation
requests with the same input, selecting one adds one history version, and all
three persist for comparison. Actual model output quality was not evaluated.

Feature 10 passed: compressed link roundtrip, independent Chrome review session,
element comment persistence, JSON download/import against matching snapshot,
and explicit targeted feedback request. Local link tested; public use requires
deploying this updated editor. No cloud comment sync; encoded limit is 60 KB.

Final pass passed: source locks, cancellation, separate sketches and mobile layout verified. All 12 Chrome workflows passed against the production build on port 5175; source checks, TypeScript and build passed. Real external integrations remain unverified as documented above.


## Studio layout refresh
- [x] Collapsible workspace sidebar and screen shortcuts.
- [x] Resizable 40/60 split and focus views with state preserved.
- [x] Grouped exports and contextual element properties.
- [x] Phone bottom navigation, instructions view and tools bottom sheet.
- [x] Day/night styling and reduced-motion support retained.
- [x] Source/build checks and focused interaction tests.


## Productivity features — implement sequentially, test before next feature
- [x] 1. Automatic quality checks, acceptance scenarios and bounded repair. Chrome quality repair and fixed-config Vite compilation tests passed.
- [x] 2. Editable generation plans and tracked acceptance requirements. Browser approval, edits, generation payload and persistence passed.
- [x] 3. Reusable source component library. Source materialization and real two-screen shared update/interaction/reload passed.
- [x] 4. Visual reference comparison and measured refinement. Real Chrome capture and decreased pixel difference verified; AI mocked. Production capture requires Chrome service.
- [x] 5. Request usage, budgets and duplicate protection. Concurrent duplicate, actual token telemetry, cost estimates and pre-network limit tests passed.
- [x] 6. Import and develop an existing React/Vite project. Multi-file JSX/TSX/CSS bundling, ZIP/raw-file edit, React interaction, secret/path exclusion passed. Bounded supported packages only.
- [x] 7. Before/after visual and source review before adoption. Pending generation, source diff, stale-review rejection and explicit acceptance/rejection passed.
- [x] 8. Figma import with structure/assets. Mocked REST nodes/auto-layout/fonts/image fills, local asset resolution, generation payload and token handling passed; live Figma not connected.
- [x] 9. Video reference extraction and interaction generation. Real WebM decode, six timed frames, edited notes/spec, correct model images and working generated menu passed.
- [x] 10. Multi-project cloud workspace prepared for Supabase (user connects later). IndexedDB save/switch/restore and mocked authenticated upload/conflict/session tests passed. SQL/RLS live verification pending user connection.


Productivity final verification: all ten implementation checkpoints passed before
advancing. TypeScript, 12 source/contract groups, production build and 26 browser
workflow/integration groups passed. Supabase is prepared for later user connection;
external providers/GitHub/Figma/Supabase were mocked. Browser capture uses the local
Chrome service and needs a browser-capable production runner. See PRODUCTIVITY.md.

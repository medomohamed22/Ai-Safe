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

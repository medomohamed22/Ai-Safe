# Monochrome workspace redesign

## Direction

Quiet black/white/neutral surfaces, compact workspace navigation, and a clear
two-panel hierarchy. Primary generation actions use an inverse solid surface;
secondary actions use subdued buttons and separators. Color is not required to
understand selection, errors, loading or test results.

## Changes

- Structured header, grouped design/backend tools, numbered sketch/preview panels,
  compact preview actions, and a dedicated prompt composer.
- Day/night toggle plus device-theme mode; preference persists in the browser.
  Initial theme is applied before React mounts and updates the browser theme color.
- Native drawing toolbar uses neutral active highlights and follows night mode.
- Narrow screens switch between drawing and preview, preserving both surfaces.
  Tested widths: 320, 390, 820, 900, 1024 and 1440 pixels.
- Preview remains mounted while inspecting code, and theme switching preserves
  the generated application's local interactive state.
- Shared form/dialog styling, bounded mobile settings sidebar, model search with
  arrow-key selection, focus containment, Escape/backdrop dismissal and focus return.
- CSS motion for panel entrances, tabs, theme icons, controls, loading, popovers
  and dialog entrance/exit. Reduced-motion preference disables decorative motion.
- The generated page and uploaded/reference/brand media keep their own visual
  design. The workspace theme does not recolor their content.

## Motion

140 ms interaction feedback; 180–280 ms menus/dialogs; 480 ms initial panel reveal.
Motion is limited to opacity/transform and short color/border transitions. There
are no extra animation dependencies. A running generation has an indeterminate
progress line, not a fabricated completion percentage.

## Sources consulted

- [Linear: A calmer interface for a product in motion](https://linear.app/now/behind-the-latest-design-refresh)
  informed the separation of navigation, context and actions and the reduced use
  of accent color and prominent chrome.
- [MDN: prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
  informed the device preference override for decorative transitions/animations.
- [MDN: color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme)
  informed native form/scrollbar theming; generated preview documents explicitly
  retain their own light canvas rather than inheriting the workspace's dark mode.

## Verification

`tests/ui-browser.cjs` checks theme persistence/system changes, native canvas theme,
reduced motion, focus/Escape behavior and preserved preview state. Screenshots
are captured after finite entrance animations complete. `tests/responsive-browser.cjs`
checks six sizes, page overflow and useful preview height. Existing functional
workflows are rechecked against the production build.


## Studio navigation update (2026-10-14)

- Collapsible design sidebar with screen shortcuts; saved collapse preference.
- Drawing/preview split starts at 40/60 and supports pointer and keyboard resizing
  (30 to 65 percent). Split size persists. Focus either pane without unmounting it.
- Grouped export menu for ZIP, GitHub, JSX, HTML and copy. Sharing remains visible.
- Contextual element inspector beside a wide preview, or above the bottom of a
  narrow preview, leaving the running application mounted.
- Phone layout uses three bottom destinations: Sketch, Preview and Instructions.
  Draft instructions and preview interactions survive navigation. Workspace tools
  open in a bottom sheet with keyboard focus containment and Escape dismissal.
- A single primary composer action generates/updates and turns into Stop during
  a run. Phone generation opens Preview to show progress and the overlay Stop.
- Narrow drawing toolbars scroll horizontally so edge tools remain reachable.
- Screen tiles show schematic icons and names, not captured live thumbnails.

### Product references

- https://v0.app/docs/design-mode — contextual properties beside the preview.
- https://docs.lovable.dev/features/projects/editor — collapsible navigation,
  preview focus and grouped advanced tools.
- https://uizard.io/autodesigner/ — visual organization of screens and identity.

### Additional checks

`tests/studio-browser.cjs` verifies split persistence, pointer/keyboard resizing,
focus views, sidebar persistence, export menu dismissal, contextual source edits,
phone navigation and draft/preview preservation, and mobile tools accessibility.


## Stitch-inspired redesign — 2026-10-15
Reference: the two supplied screenshots and Google's official descriptions:
- https://stitch.withgoogle.com/
- https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-ai-ui-design/
- https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-updates/

The public root now opens a prompt-first home with Web/App intent, four editable prompt starters, local project search and project reopening. `#studio` opens the editor directly. Browser back/forward changes between home and studio; review links retain their separate route.

The studio uses a charcoal/monochrome dot grid, rounded floating tools card, vertical focus/reference/brand/productivity rail, framed live preview and centered rounded instruction composer. Drawing, generated React, history, visual edits, export/review and all Productivity tools remain available. Phone layouts retain the existing bottom navigation and tools sheet. Day/night/system settings and reduced motion still apply. Starter illustrations are CSS, not external assets or static images of generated projects.

Starting from a home prompt first saves the current project, creates an independent IndexedDB workspace, then generates once after the drawing API is ready. Web/App selection is included in the actual generation instruction. Without a configured model the brief stays in the editor and Settings opens. Blank and reference-first projects use the same isolated project flow. Opening the active project preserves the running preview rather than reloading an older snapshot.

Scope: inspired layout and workflow, with Sketch2UI branding. This does not add Stitch's infinite multi-artboard pan/zoom, voice agent, live collaboration or Google service integrations. The drawing canvas retains Excalidraw's own pan/zoom. Projects are local unless the user separately configures the existing Supabase connection. No deployment was performed.


## Arabic localization — 2026-10-15
- English first-visit default; global EN/AR control in home, editor and review headers.
- Saved preference in `s2ui.language.v1`, outside workspace backups. `index.html` applies direction before app paint.
- Arabic UI, titles, accessible names, placeholders, dialogs, local diagnostic messages and standard empty states. Provider/model names, filenames, code, JSON keys and user-authored content retain their original values.
- Mirrored project sidebar and tool rail, logical spacing, readable Arabic type, responsive language controls, Excalidraw `ar-SA` locale. Excalidraw may set the document language tag to `ar-SA`; both `ar` and `ar-SA` are valid Arabic tags.
- Technical inputs remain LTR; ordinary Arabic fields use RTL. Brand direction options preserve canonical `ltr`/`rtl` values independently of their translated labels.
- Localized file picker buttons avoid the browser's English native button caption. File names remain unchanged.
- Switching does not remount the live preview, clear editor drafts, rerun generation or change exported source.

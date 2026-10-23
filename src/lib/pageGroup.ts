import type { BackendConfig } from './backend';
import { DEFAULT_BACKEND } from './backend';
import { buildPreviewHtml } from './preview';
import { screenCode, type ScreenProject } from './screens';

/**
 * One self-contained index.html for a whole page group (design-system
 * phase 4): the root screen plus everything linked to or from it, each
 * rendered with the normal preview builder into its own iframe, with a
 * small switcher (and hash routing) on top — the page and all its
 * use-case states in a single file that needs no server.
 */
export function pageGroupScreens(project: ScreenProject, rootId: string) {
  const ids = new Set<string>([rootId]);
  for (const link of project.links) {
    if (link.from === rootId) ids.add(link.to);
    if (link.to === rootId) ids.add(link.from);
  }
  return project.screens.filter((s) => ids.has(s.id) && screenCode(s));
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

export function pageGroupHtml(project: ScreenProject, rootId: string, backend: BackendConfig = DEFAULT_BACKEND): { filename: string; html: string } | null {
  const screens = pageGroupScreens(project, rootId);
  if (!screens.length) return null;
  const root = project.screens.find((s) => s.id === rootId);
  const name = (root?.name || 'page').replace(/[^\p{L}\p{N} -]+/gu, '').trim() || 'page';
  const buttons = screens.map((s, i) => `<button data-i="${i}" class="${i === 0 ? 'on' : ''}">${s.name.replace(/</g, '&lt;')}</button>`).join('');
  const frames = screens.map((s, i) => {
    const navTargets = screens.filter((x) => x.id !== s.id).map((x) => ({ id: x.id, name: x.name, label: x.name.split('—').pop()?.trim() || x.name }));
    return `<iframe data-i="${i}" title="${escapeAttr(s.name)}" sandbox="allow-scripts allow-forms" ${i === 0 ? '' : 'hidden'} srcdoc="${escapeAttr(buildPreviewHtml(screenCode(s), { token: '', preserveInstrumentation: true, navTargets }, backend))}"></iframe>`;
  }).join('\n');
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${name.replace(/</g, '&lt;')} — page group</title>
<style>
  body { margin: 0; font-family: system-ui, sans-serif; background: #f5f5f4; }
  header { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; padding: 10px 14px; background: #171717; }
  header strong { color: #fff; margin-inline-end: 8px; font-size: 14px; }
  header button { border: 1px solid #404040; background: transparent; color: #d4d4d4; border-radius: 999px; padding: 6px 14px; cursor: pointer; font-size: 13px; min-height: 36px; }
  header button.on { background: #fff; color: #171717; border-color: #fff; }
  iframe { display: block; width: 100%; height: calc(100vh - 57px); border: 0; background: #fff; }
  iframe[hidden] { display: none; }
</style></head><body>
<header><strong>${name.replace(/</g, '&lt;')}</strong>${buttons}</header>
${frames}
<script>
  var btns = Array.prototype.slice.call(document.querySelectorAll('header button'));
  var frames = Array.prototype.slice.call(document.querySelectorAll('iframe'));
  function show(i) {
    btns.forEach(function (b, j) { b.classList.toggle('on', j === i); });
    frames.forEach(function (f, j) { f.hidden = j !== i; });
    try { history.replaceState(null, '', '#s' + i); } catch (e) {}
  }
  btns.forEach(function (b, i) { b.addEventListener('click', function () { show(i); }); });
  var names = ${JSON.stringify(screens.map((s) => s.name))};
  var ids = ${JSON.stringify(screens.map((s) => s.id))};
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || d.source !== 's2ui-preview' || d.type !== 'navigate') return;
    var i = ids.indexOf(d.id);
    if (i < 0) i = names.indexOf(d.target);
    if (i >= 0) show(i);
  });
  var start = parseInt((location.hash || '').replace('#s', ''), 10);
  if (start >= 0 && start < frames.length) show(start);
</script>
</body></html>`;
  return { filename: `${name} — page group.html`, html };
}

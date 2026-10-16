export interface Screen { id: string; name: string; versions: string[]; vIndex: number; scene: any }
export interface ScreenLink { from: string; to: string; label: string }
export interface ScreenProject { activeId: string; screens: Screen[]; links: ScreenLink[]; mapPositions?: Record<string, { x: number; y: number }> }
export function screenCode(screen: Screen) { return screen.versions[screen.vIndex] || ''; }
export function screenNavigation(project: ScreenProject) {
  return project.links.filter(link => link.from === project.activeId).map(link => ({ id: link.to, label: link.label }));
}
export function screenFiles(project: ScreenProject): Record<string, string> {
  const files: Record<string, string> = {};
  const screens = project.screens;
  screens.forEach((screen, i) => { files[`src/screens/Screen${i}.jsx`] = screenCode(screen) || `export default function App(){return <main className="p-8">${JSON.stringify('This screen has not been generated yet.').replace(/^"|"$/g, '')}</main>}`; });
  const imports = screens.map((_, i) => `import Screen${i} from './screens/Screen${i}';`).join('\n');
  files['src/App.jsx'] = `import {useState} from 'react';\n${imports}\nconst screens = [${screens.map((s, i) => `{id:${JSON.stringify(s.id)},name:${JSON.stringify(s.name)},component:Screen${i}}`).join(',')}];\nconst links=${JSON.stringify(project.links)};\nexport default function App(){const [active,setActive]=useState(${JSON.stringify(project.activeId)});const current=screens.find(s=>s.id===active)||screens[0];const Page=current.component;return <><nav aria-label="Screen navigation" className="flex flex-wrap gap-2 border-b bg-slate-900 p-3 text-white">{links.filter(l=>l.from===current.id).map((link,i)=><button key={i} onClick={()=>setActive(link.to)} className="rounded border px-3 py-1">{link.label}</button>)}</nav><Page/></>;}\n`;
  files['SCREENS.json'] = JSON.stringify({ screens: screens.map(s => ({ id: s.id, name: s.name })), links: project.links }, null, 2);
  return files;
}

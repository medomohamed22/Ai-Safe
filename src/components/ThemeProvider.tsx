import { tr } from '../lib/i18n';
import { LanguageToggle } from './LanguageToggle';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';

type Preference = 'light' | 'dark' | 'system';
const ThemeContext = createContext({ theme: 'light', preference: 'system' as Preference, setPreference: (_: Preference) => {} });
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<Preference>(() => {
    try { const saved = JSON.parse(localStorage.getItem('s2ui.theme.v1') || '"system"'); return ['light', 'dark', 'system'].includes(saved) ? saved : 'system'; } catch { return 'system'; }
  });
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  const theme = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const update = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    media.addEventListener('change', update); return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.uiTheme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#111111' : '#f5f5f4');
    try { localStorage.setItem('s2ui.theme.v1', JSON.stringify(preference)); } catch { /* Theme still works if storage is disabled. */ }
  }, [theme, preference]);
  return <ThemeContext.Provider value={{ theme, preference, setPreference }}>{children}</ThemeContext.Provider>;
}
export const useTheme = () => useContext(ThemeContext);
export function ThemeToggle() {
  const { theme, preference, setPreference } = useTheme();
  return <><LanguageToggle/><div className="theme-switch" aria-label={tr("Appearance")}>
    <button className="ui-icon theme-button" aria-label={theme === 'dark' ? tr("Switch to day mode") : tr("Switch to night mode")} title={theme === 'dark' ? tr("Day mode") : tr("Night mode")} onClick={() => setPreference(theme === 'dark' ? 'light' : 'dark')}>
      {theme === 'dark' ? <Sun key="sun" size={17} /> : <Moon key="moon" size={17} />}
    </button>
    <button className="ui-icon system-theme" aria-label={tr("Use system theme")} aria-pressed={preference === 'system'} title={tr("Follow device appearance")} onClick={() => setPreference('system')}><Monitor size={14} /></button>
  </div></>;
}

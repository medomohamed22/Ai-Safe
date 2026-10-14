export interface Brand { enabled: boolean; name: string; primary: string; secondary: string; background: string; text: string; font: string; radius: number; direction: 'ltr' | 'rtl'; logo: string }
export const DEFAULT_BRAND: Brand = { enabled: false, name: '', primary: '#6366f1', secondary: '#d946ef', background: '#ffffff', text: '#0f172a', font: 'system-ui', radius: 12, direction: 'ltr', logo: '' };
export function brandPrompt(brand: Brand) {
  if (!brand.enabled) return '';
  return `\nSAVED BRAND IDENTITY (apply consistently across all screens): ${JSON.stringify(brand)}\nUse these exact palette values via Tailwind arbitrary values, the specified font stack, corner radius and layout direction. Use the supplied logo as an image, if present. Preserve accessible contrast and functionality.\n`;
}

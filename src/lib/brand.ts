export interface Brand { enabled: boolean; name: string; primary: string; secondary: string; background: string; text: string; font: string; radius: number; direction: 'ltr' | 'rtl'; logo: string; surface: string; muted: string; success: string; warning: string; danger: string; displayFont: string; language: 'ar' | 'en' | 'auto'; voice: string }
export const DEFAULT_BRAND: Brand = { enabled: false, name: '', primary: '#171717', secondary: '#737373', background: '#ffffff', text: '#171717', font: 'system-ui', radius: 12, direction: 'ltr', logo: '', surface: '#f5f5f5', muted: '#737373', success: '#16a34a', warning: '#d97706', danger: '#dc2626', displayFont: '', language: 'auto', voice: '' };
export function normalizeBrand(value: Partial<Brand> | null | undefined): Brand { return { ...DEFAULT_BRAND, ...(value || {}) }; }
export function brandPrompt(brand: Brand) {
  if (!brand.enabled) return '';
  const copy = brand.language === 'ar' ? '\nWrite ALL user-interface copy in Arabic.\n' : brand.language === 'en' ? '\nWrite ALL user-interface copy in English.\n' : '';
  const voice = brand.voice ? `\nBrand voice: ${brand.voice}\n` : '';
  // The logo itself is NEVER serialized into the prompt: it is a base64 data
  // URL (up to ~100 KB) that used to be pasted verbatim into every request —
  // burning tens of thousands of tokens and tempting the model to copy the
  // blob into the generated code, which produced broken, bloated builds. The
  // logo travels as an attached reference image instead (see run()).
  const { logo, ...identity } = brand;
  const logoNote = logo ? '\nA logo image is attached with this request as a reference image: match its shapes and treatment. In the code, represent the logo with a simple inline SVG mark or the brand name in the display font — never with a data URL.\n' : '';
  return `\nSAVED BRAND IDENTITY (apply consistently across all screens): ${JSON.stringify(identity)}\nUse these exact palette values via Tailwind arbitrary values, the specified font stack (displayFont for headings when set), corner radius and layout direction. Preserve accessible contrast and functionality. Never embed data URLs or base64 strings in the code.${logoNote}${copy}${voice}`;
}

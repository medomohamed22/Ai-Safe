export interface Brand { enabled: boolean; name: string; primary: string; secondary: string; background: string; text: string; font: string; radius: number; direction: 'ltr' | 'rtl'; logo: string; surface: string; muted: string; success: string; warning: string; danger: string; displayFont: string; language: 'ar' | 'en' | 'auto'; voice: string }
export const DEFAULT_BRAND: Brand = { enabled: false, name: '', primary: '#171717', secondary: '#737373', background: '#ffffff', text: '#171717', font: 'system-ui', radius: 12, direction: 'ltr', logo: '', surface: '#f5f5f5', muted: '#737373', success: '#16a34a', warning: '#d97706', danger: '#dc2626', displayFont: '', language: 'auto', voice: '' };
export function normalizeBrand(value: Partial<Brand> | null | undefined): Brand { return { ...DEFAULT_BRAND, ...(value || {}) }; }
export function brandPrompt(brand: Brand) {
  if (!brand.enabled) return '';
  const copy = brand.language === 'ar' ? '\nWrite ALL user-interface copy in Arabic.\n' : brand.language === 'en' ? '\nWrite ALL user-interface copy in English.\n' : '';
  const voice = brand.voice ? `\nBrand voice: ${brand.voice}\n` : '';
  return `\nSAVED BRAND IDENTITY (apply consistently across all screens): ${JSON.stringify(brand)}\nUse these exact palette values via Tailwind arbitrary values, the specified font stack (displayFont for headings when set), corner radius and layout direction. Use the supplied logo as an image, if present. Preserve accessible contrast and functionality.${copy}${voice}`;
}

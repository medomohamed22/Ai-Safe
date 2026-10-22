import type { Brand } from './brand';

/**
 * DESIGN.md — the portable form of the saved brand identity. The format is
 * deliberately plain labeled lines so any coding agent (or a human) can
 * read it, and Sketch2UI can parse it back into brand tokens on import.
 */
export function designSystemMarkdown(brand: Brand): string {
  const lines: string[] = [];
  lines.push(`# DESIGN.md — ${brand.name || 'Untitled brand'}`);
  lines.push('');
  lines.push('The design system for this project, exported from Sketch2UI. Apply these tokens consistently on every screen.');
  lines.push('');
  lines.push('## Colors');
  lines.push('');
  lines.push(`- Primary: ${brand.primary}`);
  lines.push(`- Secondary: ${brand.secondary}`);
  lines.push(`- Background: ${brand.background}`);
  lines.push(`- Text: ${brand.text}`);
  lines.push('');
  lines.push('## Typography');
  lines.push('');
  lines.push(`- Font: ${brand.font}`);
  lines.push('');
  lines.push('## Shape');
  lines.push('');
  lines.push(`- Radius: ${brand.radius}px`);
  lines.push('');
  lines.push('## Direction');
  lines.push('');
  lines.push(`- Layout: ${brand.direction}`);
  lines.push('');
  lines.push('## Rules');
  lines.push('');
  lines.push('- Use the palette via Tailwind arbitrary values (for example `bg-[#171717]`) so the values stay exact.');
  lines.push('- The Text color must stay readable on Background — preserve accessible contrast in every state.');
  lines.push('- The corner radius applies to cards, buttons and inputs; keep it consistent across screens.');
  lines.push('- The layout direction applies to the whole app shell, including navigation.');
  lines.push('');
  return lines.join('\n');
}

const HEX = '#[0-9a-fA-F]{3,8}';

/** Parse a DESIGN.md (ours or a hand-written one with the same labels) back into brand tokens. */
export function parseDesignSystem(text: string): Partial<Brand> {
  const out: Partial<Brand> = {};
  const grab = (re: RegExp) => text.match(re)?.[1]?.trim();
  const name = grab(/^#\s*DESIGN\.md\s*[—-]\s*(.+)$/m);
  if (name && name !== 'Untitled brand') out.name = name.slice(0, 80);
  const color = (label: string) => grab(new RegExp(`^-\\s*${label}:\\s*(${HEX})\\s*$`, 'mi'));
  const primary = color('Primary'); if (primary) out.primary = primary;
  const secondary = color('Secondary'); if (secondary) out.secondary = secondary;
  const background = color('Background'); if (background) out.background = background;
  const textColor = color('Text'); if (textColor) out.text = textColor;
  const font = grab(/^-?\s*Font:\s*(.+)$/mi); if (font) out.font = font.slice(0, 60);
  const radius = grab(/^-?\s*Radius:\s*(\d+)\s*(?:px)?\s*$/mi); if (radius) out.radius = Math.max(0, Math.min(80, Number(radius)));
  const layout = grab(/^-?\s*Layout:\s*(ltr|rtl)\s*$/mi); if (layout) out.direction = layout as Brand['direction'];
  return out;
}

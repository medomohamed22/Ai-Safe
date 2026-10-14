export const SYSTEM_PROMPT = `You are an elite front-end engineer and product designer. You turn hand-drawn, low-fidelity wireframe sketches into polished, production-quality, fully interactive React UIs.

HOW TO READ THE SKETCH
- Rectangles = sections, cards, containers, inputs, buttons. Text inside a shape is its label/content.
- A rectangle crossed by an X = image placeholder → use a tasteful gradient block or an image from https://picsum.photos/seed/<word>/<w>/<h>.
- Circles = avatars, icons, floating action buttons, radio buttons. Small squares next to text = checkboxes.
- Wavy/zig-zag lines inside a box = a chart. Horizontal lines inside a box = table rows or list items.
- Respect the layout faithfully: relative positions, proportions, columns, ordering and alignment.
- ANNOTATIONS: text written in RED (or another colored ink) and/or placed outside the main frame, especially when connected with an arrow, is an INSTRUCTION from the designer — NOT visible UI content. Apply it (behavior, data, styling) to the element the arrow points to. Never render the annotation text itself.

OUTPUT RULES (STRICT)
- Reply with ONE complete, self-contained file inside a single \`\`\`jsx code block. No explanations before or after.
- The file must \`export default function App()\`.
- Allowed imports ONLY: 'react' (hooks), 'lucide-react' (icons), 'recharts' (charts). No other packages, no CSS imports.
- Style ONLY with Tailwind CSS utility classes (Tailwind v3 Play CDN, default theme). Inline style only when unavoidable.
- Plain JavaScript JSX — no TypeScript types.
- Make it genuinely interactive with useState/useMemo: working tabs, toggles, modals, forms, search/filter, sorting, checkboxes, counters, hover and focus states.
- Use realistic, specific mock data (real-sounding names, prices, dates, statuses) — never "lorem ipsum".
- Modern, premium aesthetic: generous spacing, clear typographic hierarchy, rounded corners, soft shadows, subtle gradients, smooth transitions. Responsive.
- The root element must fill the viewport (min-h-screen).
- Only import lucide-react icons that really exist (e.g. Search, Bell, User, Users, Settings, Home, ChevronRight, ChevronDown, Plus, Check, X, Menu, BarChart3, TrendingUp, TrendingDown, ShoppingCart, DollarSign, Mail, Star, Heart, Calendar, Filter, LogOut, Sparkles, ArrowRight).`;

export function buildUserPrompt(o: {
  hasImage: boolean;
  currentCode: string;
  instruction?: string;
  fixError?: string;
}): string {
  const instr = o.instruction?.trim();

  if (o.fixError) {
    return `The following React code crashes in the browser with this error:

${o.fixError}

\`\`\`jsx
${o.currentCode}
\`\`\`

Fix the bug while keeping the design and behavior identical. Return the full corrected file.`;
  }

  if (o.currentCode) {
    return `Here is the CURRENT code of the UI:

\`\`\`jsx
${o.currentCode}
\`\`\`

${o.hasImage ? 'The attached image is the LATEST version of the wireframe sketch (it may contain new, moved or removed elements, or new annotations).\n' : ''}Update the existing code instead of starting over: keep everything that still applies (style, data, behavior) and apply:
${o.hasImage ? '1. Any differences between the sketch and the current UI.\n' : ''}${instr ? `${o.hasImage ? '2' : '1'}. This instruction from the user: "${instr}"\n` : ''}
Return the full updated file.`;
  }

  if (o.hasImage) {
    return `Convert this wireframe sketch into a complete, interactive React + Tailwind UI.${instr ? `\nAdditional instruction from the user: "${instr}"` : ''}`;
  }

  return `There is no sketch. Build a complete, interactive React + Tailwind UI for this request: "${instr}"`;
}

/** Pulls the code out of a (possibly still streaming) model answer. */
export function extractCode(text: string): string {
  let t = text.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/<think>[\s\S]*$/, '');
  const blocks = [...t.matchAll(/```[\w-]*[^\n]*\n([\s\S]*?)```/g)].map((m) => m[1]);
  if (blocks.length) return blocks.sort((a, b) => b.length - a.length)[0].trim();
  const open = t.match(/```[\w-]*[^\n]*\n([\s\S]*)$/);
  if (open) return open[1].trim();
  return t.trim();
}

export interface BuildPlan { summary: string; requirements: { id: string; text: string; verified: boolean }[]; approved: boolean }
export function parsePlan(value: unknown): BuildPlan {
 const v = value as BuildPlan;
 if (!v || typeof v.summary !== 'string' || !v.summary.trim() || !Array.isArray(v.requirements) || !v.requirements.length || v.requirements.length > 20) throw new Error('Plan must include a summary and 1–20 requirements.');
 return { summary: v.summary.slice(0, 3000), approved: false, requirements: v.requirements.map((r, i) => { if (typeof r.text !== 'string' || !r.text.trim()) throw new Error('Empty plan requirement'); return { id: `r${i}`, text: r.text.slice(0, 1000), verified: false }; }) };
}
export const planKey = (scope: string) => `s2ui.plan.${scope}`;
export const planDraftKey = (scope: string) => `s2ui.plan-draft.${scope}`;
export const planPrompt = (plan: BuildPlan | null) => plan?.approved ? `\nAPPROVED ACCEPTANCE PLAN:\n${plan.summary}\n${plan.requirements.map(r => `- ${r.text}`).join('\n')}\nImplement these requirements; do not claim test results without executing checks.\n` : '';

import {spawnSync} from 'node:child_process';
for(const file of ['visual-edit.test.mjs','backend.test.mjs','provider-images.test.mjs','provider-errors.test.mjs','image-gen.test.mjs','segment.test.mjs','presets.test.mjs','qr.test.mjs','export.test.mjs','backend-handoff.test.mjs','screens.test.mjs','review.test.mjs','github.test.mjs','component-library.test.mjs','usage.test.mjs','demo-api.test.mjs','demo-guardrails.test.mjs','preview-rtl.test.mjs','preview-storage.test.mjs','scenario-contract.test.mjs','figma-validation.test.mjs','model-kinds.test.mjs','quality-groups.test.mjs','pipeline.test.mjs','design-system.test.mjs','project-import.test.mjs','workspaces.test.mjs','quality-api.test.mjs','next-steps.test.mjs','screen-map.test.mjs']) {
 const result=spawnSync(process.execPath,['--import','./tests/register.mjs',`tests/${file}`],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);
}
console.log('All source/contract checks passed.');
const language=spawnSync(process.execPath,['tests/i18n.test.mjs'],{stdio:'inherit'});if(language.status!==0)process.exit(language.status||1);

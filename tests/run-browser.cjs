const {spawnSync}=require('node:child_process');
// Editor regression groups enter the supported studio deep link. The home flow
// is exercised separately by stitch-browser.cjs from the public root URL.
const base=(process.env.S2UI_TEST_URL||'http://127.0.0.1:5173').split('#')[0];
process.env.S2UI_TEST_URL=base+'#studio';
for(const file of ['browser.cjs','locks-browser.cjs','backend-browser.cjs','interaction-browser.cjs','screens-browser.cjs','screen-map-browser.cjs','errors-browser.cjs','demo-beacon-browser.cjs','quickstart-browser.cjs','code-split-browser.cjs','rtl-publish-browser.cjs','preview-storage-browser.cjs','test-runner-browser.cjs','quality-audit-browser.cjs','drafts-browser.cjs','service-health-browser.cjs','menus-browser.cjs','review-empty-browser.cjs','figma-panel-browser.cjs','a11y-names-browser.cjs','export-feedback-browser.cjs','brand-browser.cjs','reference-browser.cjs','github-browser.cjs','alternatives-browser.cjs','cancel-browser.cjs','review-browser.cjs','layout-browser.cjs','ui-browser.cjs','responsive-browser.cjs','studio-browser.cjs','productivity-quality.cjs','productivity-plan.cjs','productivity-library.cjs','productivity-visual.cjs','productivity-import.cjs','productivity-review.cjs','productivity-figma.cjs','productivity-video.cjs','productivity-projects.cjs','productivity-ui.cjs','productivity-shared-review.cjs']) {
 const result=spawnSync(process.execPath,[`tests/${file}`],{stdio:'inherit',env:process.env});if(result.status!==0)process.exit(result.status||1);
}
console.log('All browser workflows passed.');
const home=spawnSync(process.execPath,['tests/stitch-browser.cjs'],{stdio:'inherit',env:{...process.env,S2UI_TEST_URL:base}});
if(home.status!==0)process.exit(home.status||1);
const language=spawnSync(process.execPath,['tests/language-browser.cjs'],{stdio:'inherit',env:{...process.env,S2UI_TEST_URL:base}});
if(language.status!==0)process.exit(language.status||1);

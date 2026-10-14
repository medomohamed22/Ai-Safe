const {spawnSync}=require('node:child_process');
for(const file of ['browser.cjs','locks-browser.cjs','backend-browser.cjs','interaction-browser.cjs','screens-browser.cjs','brand-browser.cjs','reference-browser.cjs','github-browser.cjs','alternatives-browser.cjs','cancel-browser.cjs','review-browser.cjs','layout-browser.cjs','ui-browser.cjs','responsive-browser.cjs','studio-browser.cjs','productivity-quality.cjs','productivity-plan.cjs','productivity-library.cjs','productivity-visual.cjs','productivity-import.cjs','productivity-review.cjs','productivity-figma.cjs','productivity-video.cjs','productivity-projects.cjs','productivity-ui.cjs','productivity-shared-review.cjs']) {
 const result=spawnSync(process.execPath,[`tests/${file}`],{stdio:'inherit',env:process.env});if(result.status!==0)process.exit(result.status||1);
}
console.log('All browser workflows passed.');

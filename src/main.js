import loadMujoco from "@mujoco/mujoco";
import * as ort from "onnxruntime-web/wasm";

import * as THREE from 'three';import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
const $=id=>document.getElementById(id);
const allLogs=[];
const log=(msg,bad=false)=>{const line=(new Date()).toLocaleTimeString('en-GB')+'  '+msg;allLogs.push(line);const d=document.createElement('div');d.className=bad?'error':'ok';d.textContent=line;$('log').prepend(d);while($('log').children.length>100)$('log').lastChild.remove()};
async function copyLogs(){const content=allLogs.join('\n')||'لا توجد سجلات بعد';try{await navigator.clipboard.writeText(content);$('copyLogs').textContent='✓ تم النسخ';setTimeout(()=>$('copyLogs').textContent='⧉ نسخ كل السجل',1700)}catch(e){const a=document.createElement('textarea');a.value=content;a.style.cssText='position:fixed;top:0;opacity:0';document.body.append(a);a.select();const ok=document.execCommand('copy');a.remove();$('copyLogs').textContent=ok?'✓ تم النسخ':'تعذر النسخ';if(!ok)log('فشل النسخ: يتطلب HTTPS وإذن الحافظة',true)}}
$('copyLogs').addEventListener('click',copyLogs);

let neural=null, neuralBusy=false, neuralTick=0, neuralLastAction=[], velocityCommand=[0,0,0], neuralFailures=0;
let driveDirection="stop",drivePhase=0,driveActive=false,driveStart=0,driveMap=new Map(),fallTriggered=false,imuMap=new Map();
let cruise=false, pushTrials=[], pushCount=0;
let renderer,scene,camera,orbit,mj,model,data,robotMeshes=[],running=false,last=performance.now(),acc=0,simTime=0,ready=false,jointInfos=[],targets=[],policy=null,policyIndex=0,policyActive=false,history=[],evalBusy=false;const G1='https://raw.githubusercontent.com/google-deepmind/mujoco_menagerie/main/unitree_g1/';
const view=$('viewport');scene=new THREE.Scene();scene.background=new THREE.Color(0xf5f5f3);camera=new THREE.PerspectiveCamera(48,1,.05,60);camera.up.set(0,0,1);camera.position.set(2.8,-3.7,2.15);renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setClearColor(0xf5f5f3);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;view.append(renderer.domElement);scene.add(new THREE.HemisphereLight(0xffffff,0xaaaaaa,2.4));const sun=new THREE.DirectionalLight(0xffffff,2.6);sun.position.set(2,4,7);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);scene.add(sun);const grid=new THREE.GridHelper(12,24,0xbebebe,0xe4e4e4);grid.rotation.x=Math.PI/2;scene.add(grid);const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0xf5f5f3,roughness:1}));ground.position.z=-.006;ground.receiveShadow=true;scene.add(ground);orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;orbit.target.set(0,0,0.9);orbit.minDistance=1.2;orbit.maxDistance=12;orbit.maxPolarAngle=Math.PI*.92;orbit.enablePan=false;orbit.update();function resize(){let r=view.getBoundingClientRect();renderer.setSize(r.width,r.height);camera.aspect=r.width/r.height;camera.updateProjectionMatrix()}new ResizeObserver(resize).observe(view);resize();
function drawPlaceholder(){const group=new THREE.Group();const mat=new THREE.MeshStandardMaterial({color:0xdddddd,roughness:.7}),black=new THREE.MeshStandardMaterial({color:0x242424});function part(size,pos,m=mat){let x=new THREE.Mesh(new THREE.BoxGeometry(...size),m);x.position.set(...pos);x.castShadow=true;group.add(x)}part([.33,.22,.45],[0,0,1.04]);part([.22,.22,.22],[0,0,1.4],black);for(let s of [-1,1]){part([.12,.13,.39],[s*.27,0,1.08]);part([.11,.12,.36],[s*.27,0,.7],black);part([.15,.22,.42],[s*.115,0,.65]);part([.12,.2,.35],[s*.115,0,.26]);part([.14,.28,.09],[s*.115,.075,.06],black)}group.userData.placeholder=true;scene.add(group);return group}let placeholder=drawPlaceholder();
function status(s,on=false){$('sceneStatus').textContent=s;$('liveDot').classList.toggle('on',on);$('engineBadge').textContent=s;$('statusMetric').textContent=s}
function dir(path){try{mj.FS.mkdir(path)}catch(e){}}
async function fetchAsset(path){let resp=await fetch(G1+path);if(!resp.ok)throw new Error('فشل '+path+': HTTP '+resp.status);let bytes=new Uint8Array(await resp.arrayBuffer());mj.FS.writeFile('/working/'+path,bytes);return new TextDecoder().decode(bytes)}
function quatToThree(q){return new THREE.Quaternion(q[1],q[2],q[3],q[0])}
function meshForGeom(g){const type=model.geom_type[g],size=model.geom_size.subarray(g*3,g*3+3);let geo; // MuJoCo geometry enum: plane 0 sphere 2 capsule 3 ellipsoid 4 cylinder 5 box 6 mesh 7
if(type===2)geo=new THREE.SphereGeometry(size[0],14,10);else if(type===6)geo=new THREE.BoxGeometry(size[0]*2,size[1]*2,size[2]*2);else if(type===5)geo=new THREE.CylinderGeometry(size[0],size[0],size[1]*2,14);else if(type===3)geo=new THREE.CapsuleGeometry(size[0],Math.max(.001,size[1]*2),8,12);else if(type===7){const id=model.geom_dataid[g];if(id<0)return null;const adr=model.mesh_vertadr[id],count=model.mesh_vertnum[id],faceAdr=model.mesh_faceadr[id],faceCount=model.mesh_facenum[id];const verts=model.mesh_vert.subarray(adr*3,(adr+count)*3);const faces=model.mesh_face.subarray(faceAdr*3,(faceAdr+faceCount)*3);geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(Array.from(verts),3));geo.setIndex(Array.from(faces));geo.computeVertexNormals()}else return null;return geo}
function buildRobot(){for(const m of robotMeshes){scene.remove(m);m.geometry.dispose()}robotMeshes=[];for(let g=0;g<model.ngeom;g++){if(model.geom_bodyid[g]===0)continue;let geo=meshForGeom(g);if(!geo)continue;let rgba=model.geom_rgba.subarray(4*g,4*g+4);let material=new THREE.MeshStandardMaterial({color:new THREE.Color(rgba[0],rgba[1],rgba[2]),metalness:.2,roughness:.68,transparent:rgba[3]<.99,opacity:rgba[3],side:THREE.DoubleSide});let mesh=new THREE.Mesh(geo,material);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);robotMeshes.push(mesh);mesh.userData.geomId=g}scene.remove(placeholder);sync();log('عرض '+robotMeshes.length+' هندسة للروبوت');}
function sync(){if(!data||!model)return;for(let mesh of robotMeshes){let g=mesh.userData.geomId;mesh.position.set(data.geom_xpos[g*3],data.geom_xpos[g*3+1],data.geom_xpos[g*3+2]);let q=data.geom_xmat.subarray(g*9,g*9+9);const mat=new THREE.Matrix4().set(q[0],q[1],q[2],0,q[3],q[4],q[5],0,q[6],q[7],q[8],0,0,0,0,1);mesh.quaternion.setFromRotationMatrix(mat);}}
function setTargets(arr){if(!ready)return;targets=arr.slice();for(let i=0;i<Math.min(model.nu,targets.length);i++)data.ctrl[i]=targets[i]}
function pose(name){if(!ready)return;policyActive=false;let t=new Array(model.nu).fill(0);if(name==='gravity'){setDrive('stop');setTargets(t);$('gain').value=0;$('gainVal').textContent='0%';log('اختبار الجاذبية: أهداف صفر؛ محركات الموضع لا تزال نشطة، ليس سقوطا حرا خالصا');return}$('gain').value=100;$('gainVal').textContent='100%';if(name==='arms')for(let j of jointInfos){if(/shoulder_pitch/.test(j.name))t[j.act]=j.name.startsWith('left')?.9:-.9;if(/shoulder_roll/.test(j.name))t[j.act]=j.name.startsWith('left')?.35:-.35}if(name==='squat')for(let j of jointInfos){if(/hip_pitch/.test(j.name))t[j.act]=-.25;if(/knee/.test(j.name))t[j.act]=.52;if(/ankle_pitch/.test(j.name))t[j.act]=-.28}setDrive('stop');setTargets(t);log('هدف حركة: '+name+' — من دون ضمان التوازن')}
function discoverSensors(){imuMap.clear();try{for(let i=0;i<model.nsensor;i++){const n=mj.mj_id2name(model,mj.mjtObj.mjOBJ_SENSOR.value,i);if(n)imuMap.set(n,{address:model.sensor_adr[i],dim:model.sensor_dim[i]});}log('حساسات G1: '+[...imuMap.keys()].join(', '));}catch(e){log('قراءة قائمة الحساسات غير متاحة: '+e.message,true)}}
function sensorText(search){let key=[...imuMap.keys()].find(n=>n.includes(search));let v=imuMap.get(key);if(!v||v.dim!==3)return 'غير متاح';let ar=Array.from(data.sensordata.subarray(v.address,v.address+3));return ar.every(Number.isFinite)?ar.map(n=>n.toFixed(2)).join(' / '):'—'}
function applyDrive(){if(!driveActive||driveDirection==='stop'||!ready||policyActive)return;const t=(model.nkey>0&&model.key_ctrl?.length>=model.nu)?Array.from(model.key_ctrl.subarray(0,model.nu)):new Array(model.nu).fill(0);const f=Number($('driveSpeed').value);drivePhase+=model.opt.timestep*(f*6);const wave=Math.sin(drivePhase),backwave=Math.sin(drivePhase+Math.PI);let direction=(driveDirection==='backward'?-1:1);const turn=driveDirection==='left'?-1:driveDirection==='right'?1:0;const stride=turn?0.13:0.22;for(const [name,index] of driveMap){let left=name.startsWith('left_'),legphase=left?wave:backwave;let hip=direction*stride*legphase*(turn?(left?1+turn*.65:1-turn*.65):1);if(name.includes('hip_pitch'))t[index]=hip;if(name.includes('knee_joint'))t[index]=Math.max(0,legphase)*.34;if(name.includes('ankle_pitch'))t[index]=-hip*.45-Math.max(0,legphase)*.14;if(name.includes('shoulder_pitch'))t[index]=-hip*.35; }setTargets(t)}
function setDrive(dir){
 if(!ready){log('انتظر تحميل الروبوت',true);return}
 if(neural){
   const magnitude=Number($('driveSpeed').value);
   const commands={stop:[0,0,0],forward:[0.35,0,0],backward:[-0.2,0,0],left:[0,0,0.35],right:[0,0,-0.35]};
   velocityCommand=(commands[dir]||commands.stop).map(x=>x*magnitude);
   driveDirection=dir; driveActive=dir!=='stop';
   $('driveStatus').textContent='ONNX: سرعة مطلوبة '+velocityCommand.map(x=>x.toFixed(2)).join(' / ')+' (m/s, rad/s)';
   if(!running){running=true;$('play').textContent='Ⅱ إيقاف'}
 } else if(dir==='stop'){
   driveDirection='stop';driveActive=false;$('driveStatus').textContent='تم إيقاف إيقاع المفاصل التجريبي.';
 }else{
   if(fallTriggered){$('driveStatus').textContent='استعد وضع البداية بعد السقوط';return}
   driveDirection=dir;driveActive=true;driveStart=simTime;
   if(!running){running=true;$('play').textContent='Ⅱ إيقاف'}
   $('driveStatus').textContent='وضع تجريبي: حركة مفاصل دورية غير متزنة. حمّل سياسة ONNX للتحكم بسرعة المشي.';
 }
 document.querySelectorAll('[data-drive]').forEach(b=>b.classList.toggle('held',b.dataset.drive===dir&&dir!=='stop'));
}
function setControls(){let select=$('joint');select.innerHTML='';jointInfos=[];for(let i=0;i<model.nu;i++){const id=model.actuator_trnid[i*2];const jid=id>=0?id:-1;const jointType=mj.mjtObj.mjOBJ_JOINT.value;const raw=(Number.isInteger(jid)&&jid>=0?mj.mj_id2name(model,jointType,jid):null)||('joint_'+i);jointInfos.push({act:i,name:raw});driveMap.set(raw,i);let opt=document.createElement('option');opt.value=i;opt.textContent=raw;select.append(opt)}$('jointCount').textContent=model.njnt;$('actuators').textContent=model.nu;updateJointSlider()}
function updateJointSlider(){if(!ready)return;let i=Number($('joint').value),lo=model.actuator_ctrlrange?.[i*2]??-2,hi=model.actuator_ctrlrange?.[i*2+1]??2;$('jointRange').min=lo;$('jointRange').max=hi;$('jointRange').value=targets[i]??0;$('jointVal').textContent=(+ $('jointRange').value).toFixed(2)+' rad'}
async function boot(){status('تحميل MuJoCo WASM...');try{mj=await loadMujoco({locateFile:(file)=>file.endsWith('.wasm')?'/vendor/'+file.split('/').pop():file});log('MuJoCo WASM جاهز');dir('/working');dir('/working/assets');status('تحميل نموذج G1 الأصلي...');let xml=await fetchAsset('g1.xml');let sceneXml=await fetchAsset('scene.xml');let files=[...xml.matchAll(/<mesh\b[^>]*\bfile="([^"]+)"/g)].map(x=>x[1]);files=[...new Set(files)];log('تحميل '+files.length+' ملفات STL أصلية');let n=0;for(let file of files){await fetchAsset('assets/'+file);n++;if(n%8===0)status('تحميل ملفات G1 '+n+'/'+files.length)}status('بناء المحاكاة الفيزيائية...');model=mj.MjModel.mj_loadXML('/working/scene.xml');if(!model)throw new Error('تعذر إنشاء MjModel من scene.xml');data=new mj.MjData(model);model.opt.gravity[0]=0;model.opt.gravity[1]=0;model.opt.gravity[2]=-9.81;mj.mj_forward(model,data);ready=true;targets=(model.nkey>0&&model.key_ctrl?.length>=model.nu)?Array.from(model.key_ctrl.subarray(0,model.nu)):new Array(model.nu).fill(0);setControls();discoverSensors();buildRobot();status('G1 جاهز',true);log('G1 loaded: nq='+model.nq+', nv='+model.nv+', nu='+model.nu+', geom='+model.ngeom);$('play').textContent='▶ تشغيل';$('verify').click();}catch(e){console.error(e);status('فشل التشغيل: راجع سجل الخطأ');log(String(e.stack||e),true);$('verifyOutput').textContent='تعذر التحميل. افتح Console؛ تأكد من اتصال الإنترنت ودعم حزم WASM ومنع CORS. هذه الصفحة لا تستبدل المحرك بمحاكاة وهمية.'}}
// Strict documented policy adapter. An ONNX file without matching manifest is never executed.
function checkManifest(m){
 if(m.format!=='robomind-g1-onnx-v1')throw Error('صيغة manifest غير مدعومة');
 if(!['g1_96','g1_242'].includes(m.observationLayout))throw Error('observationLayout يجب g1_96 أو g1_242');
 if(!Array.isArray(m.jointNames)||m.jointNames.length!==29||new Set(m.jointNames).size!==29)throw Error('مطلوب 29 اسم مفصل بدون تكرار');
 if(!Array.isArray(m.defaultJointPos)||m.defaultJointPos.length!==29||!m.defaultJointPos.every(Number.isFinite))throw Error('defaultJointPos غير صالح');
 if(!(m.actionScale>0&&m.actionScale<=2))throw Error('actionScale غير صالح');
 if(m.actionMode!=='offset_position')throw Error('يُدعم offset_position فقط');
 if(m.observationLayout==='g1_242'&&(!Array.isArray(m.heightScanMean)||m.heightScanMean.length!==143||!m.heightScanMean.every(Number.isFinite)))throw Error('الـ242 يحتاج heightScanMean حقيقيًا من بيانات التدريب (143 قيمة)');
 if(m.observationLayout==='g1_242' && m.heightScanOrigin!=='training_mean')throw Error('heightScanOrigin يجب training_mean');
 if(!(m.controlHz>=10&&m.controlHz<=100))throw Error('controlHz خارج النطاق');
 if(!m.inputName||!m.outputName)throw Error('اسم المدخل والمخرج مطلوب');
 if(m.observationOrder!=='base_lin_vel,base_ang_vel,gravity,command,joint_pos,joint_vel,last_action,height_scan' && m.observationLayout==='g1_242')throw Error('ترتيب 242 غير مطابق للعقد');
 if(m.observationOrder!=='base_ang_vel,gravity,command,joint_pos,joint_vel,last_action' && m.observationLayout==='g1_96')throw Error('ترتيب 96 غير مطابق للعقد');
 if(!Array.isArray(m.observationScales)||m.observationScales.length!==(m.observationLayout==='g1_242'?242:96)||!m.observationScales.every(Number.isFinite))throw Error('observationScales غير صالحة');
 if(!Array.isArray(m.actuatorKp)||m.actuatorKp.length!==29||!m.actuatorKp.every(Number.isFinite))throw Error('actuatorKp يحتاج 29 قيمة');
 if(!Array.isArray(m.actuatorKd)||m.actuatorKd.length!==29||!m.actuatorKd.every(Number.isFinite))throw Error('actuatorKd يحتاج 29 قيمة');
 if(!m.source||!m.trainingModelId)throw Error('يجب تحديد مصدر السياسة ومعرّف الموديل');
}
function bindNeuralJoints(m){
 let found=[];
 for(let name of m.jointNames){let j=jointInfos.find(j=>j.name===name);if(!j)throw Error('مفصل السياسة غير موجود في G1: '+name);
 let jointId=model.actuator_trnid[j.act*2],qadr=model.jnt_qposadr[jointId],vadr=model.jnt_dofadr[jointId];
 if(qadr<0||vadr<0)throw Error('تعذر تحديد qpos/dof '+name);
 found.push({...j,qadr,vadr});}
 if(found.some(x=>model.actuator_trntype[x.act]!==model.actuator_trntype[found[0].act]))log('تحذير: أنواع المحركات مختلفة');
 return found;
}
function getProjectedGravity(q){let w=q[0],x=q[1],y=q[2],z=q[3];
 return [2*(x*z-w*y),2*(y*z+w*x),1-2*(x*x+y*y)].map(v=>-v);
}
function assembleObservations(){
 const {manifest:m,joints}=neural;
 const q=data.qpos.subarray(3,7); const [vx,vy,vz]=data.qvel;
 // Body frame base linear velocity and angular velocity.
 const v=new THREE.Vector3(vx,vy,vz).applyQuaternion(quatToThree(q).invert());
 const omega=new THREE.Vector3(data.qvel[3],data.qvel[4],data.qvel[5]).applyQuaternion(quatToThree(q).invert());
 const raw=[];
 if(m.observationLayout==='g1_242')raw.push(v.x,v.y,v.z);
 raw.push(omega.x,omega.y,omega.z,...getProjectedGravity(q),...velocityCommand);
 for(let i=0;i<29;i++)raw.push(data.qpos[joints[i].qadr]-m.defaultJointPos[i]);
 for(let i=0;i<29;i++)raw.push(data.qvel[joints[i].vadr]);
 raw.push(...neuralLastAction);
 if(m.observationLayout==='g1_242')raw.push(...m.heightScanMean);
 if(raw.length!==m.observationScales.length)throw Error('طول الملاحظات غير صحيح '+raw.length);
 return Float32Array.from(raw.map((x,i)=>x*m.observationScales[i]));
}
async function updateNeural(){
 if(!neural||neuralBusy||!running||!ready)return;
 neuralBusy=true;
 try{
   let input=assembleObservations();const feeds={[neural.manifest.inputName]:new ort.Tensor('float32',input,[1,input.length])};
   const out=await neural.session.run(feeds);
   let predictions=out[neural.manifest.outputName]?.data;
   if(!predictions||predictions.length!==29||!Array.from(predictions).every(Number.isFinite))throw Error('نتائج ONNX لا تطابق 29 مفصل');
   const m=neural.manifest;
   neuralLastAction=Array.from(predictions);
   for(let i=0;i<29;i++){
      const j=neural.joints[i],range=model.actuator_ctrlrange;
      const target=m.defaultJointPos[i]+m.actionScale*neuralLastAction[i];
      targets[j.act]=Math.max(range[2*j.act],Math.min(range[2*j.act+1],target));
   }
   neuralFailures=0;
 }catch(e){neuralFailures++;log('ONNX: '+e.message,true);if(neuralFailures>=2){neural=null;velocityCommand=[0,0,0];running=false;$('policyStatus').textContent='خطأ في السياسة — أوقفت المحاكاة';}}
 finally{neuralBusy=false}
}
async function installNeural(files){
 if(!ready)throw Error('انتظر تحميل G1');
 const modelFile=[...files].find(f=>f.name.toLowerCase().endsWith('.onnx'));
 const config=[...files].find(f=>f.name.toLowerCase().endsWith('.json'));
 if(!modelFile||!config)throw Error('اختار معًا ملف ONNX وملف manifest.json');
 const m=JSON.parse(await config.text());checkManifest(m);const joints=bindNeuralJoints(m);
 if(!confirm('سياسة خارجية ستنفذ أوامر مفاصل داخل المحاكاة. هل تريد تحميلها؟'))return;
 ort.env.wasm.wasmPaths='/ort/';ort.env.wasm.numThreads=1;
 const bytes=new Uint8Array(await modelFile.arrayBuffer());
 const session=await ort.InferenceSession.create(bytes,{executionProviders:['wasm'],graphOptimizationLevel:'all'});
 const expected=m.observationLayout==='g1_242'?242:96;
 const input=session.inputNames.includes(m.inputName)&&session.inputNames.length===1;
 const output=session.outputNames.includes(m.outputName)&&session.outputNames.length===1;
 if(!input||!output)throw Error('أسماء أو عدد مدخلات ONNX لا تطابق manifest (السياسات recurrent تحتاج adapter خاص)');
 let dims=session.inputMetadata?.[m.inputName]?.dimensions;
 if(dims&&dims.at(-1)!==expected&&typeof dims.at(-1)==='number')throw Error('ONNX يتوقع '+dims.at(-1)+' ملاحظة وليس '+expected);
 neural={manifest:m,joints,session};cruise=false;updateCruiseUI();neuralLastAction=new Array(29).fill(0);velocityCommand=[0,0,0];neuralTick=0;policyActive=false;setDrive('stop');
 $('policyStatus').textContent='ONNX جاهز / '+expected+' obs';$('policyTabHint').textContent='السياسة محملة. ابدأ بالوقوف قبل اختبار المشي والدفع.';$('policySteps').textContent='29 DoF';
 $('driveStatus').textContent='سياسة ONNX محمّلة. اختبر الوقوف أولًا ثم جرّب أوامر السرعة بحذر.';
 log('ONNX '+m.trainingModelId+' loaded, '+expected+' observations, 29 actions');
}
function pushRobot(){
 if(!ready){log('انتظر تحميل G1 أولًا',true);return}
 if(!running){
   if(fallTriggered||data.qpos[2]<.4){
     if(!window.confirm('الروبوت ساقط أو المحاكاة متوقفة. هل تريد إعادة الوضع الابتدائي وتشغيل المحاكاة ثم تطبيق الدفع؟')){log('تم إلغاء اختبار الدفع');return}
     $('reset').click();
   }
   running=true;$('play').textContent='Ⅱ إيقاف';status('محاكاة تعمل',true);
   log('تم تشغيل المحاكاة تلقائيًا من أجل اختبار الدفع');
 }
 // A velocity impulse on the free root, not a fake teleport; world X/Y axes.
 // Applied at center of mass; this is a disturbance test, not a literal hand contact.
 const mag=Number($('pushStrength').value), axis=pushCount++%2===0?0:1;
 const before=[data.qvel[0],data.qvel[1],data.qvel[2]];
 data.qvel[axis]+=mag;
 const trial={at:+simTime.toFixed(3),deltaV:mag,axis:axis===0?'world X':'world Y',before};
 pushTrials.push(trial);
 log('دفع اختباري: Δv='+mag.toFixed(2)+' m/s · '+trial.axis);
 $('pushState').textContent='تم الدفع · '+trial.axis;
}
function updateCruiseUI(){const b=$('cruise');if(!b)return;b.textContent=cruise?'■ إيقاف المشي':'▶ مشي مستمر';b.classList.toggle('active',cruise)}
function toggleCruise(){
 if(!ready){log('انتظر تحميل G1',true);return}
 if(!neural){log('لا توجد سياسة مشي ONNX محمّلة. افتح تبويب السياسات واختر ONNX وملف manifest مطابقًا لـG1.',true);$('walkState').textContent='المشي غير متاح: حمّل ONNX متوافقة + manifest من تبويب السياسات';$('policyTabHint').textContent='الخطوة المطلوبة: تحميل سياسة ONNX متوافقة، وليس تفعيل زر المشي فقط.';return}
 cruise=!cruise;
 if(cruise){if(!running)$('play').click();driveStart=simTime;velocityCommand=[Number($('cruiseSpeed').value),0,0];$('walkState').textContent='السياسة تعمل · سرعة مطلوبة '+velocityCommand[0].toFixed(2)+' m/s'}
 else{velocityCommand=[0,0,0];$('walkState').textContent='توقف طلب الحركة'}
 updateCruiseUI();
}
function stepOnce(){if(!ready)return;if(!neural)applyDrive();let gain=Number($('gain').value)/100;for(let i=0;i<model.nu;i++)data.ctrl[i]=(targets[i]||0)*gain;if(policyActive&&policy?.actions?.length){let a=policy.actions[Math.min(policyIndex,policy.actions.length-1)];if(Array.isArray(a)&&a.length===model.nu){for(let i=0;i<model.nu;i++)data.ctrl[i]=a[i];policyIndex=Math.min(policyIndex+1,policy.actions.length-1)}}mj.mj_step(model,data);simTime+=model.opt.timestep;const q=data.qpos.subarray(3,7),up=new THREE.Vector3(0,0,1).applyQuaternion(quatToThree(q)),tilt=Math.acos(THREE.MathUtils.clamp(up.z,-1,1))*180/Math.PI;if((driveActive||neural)&&simTime-driveStart>.45&&(data.qpos[2]<.40||tilt>62)){setDrive('stop');velocityCommand=[0,0,0];cruise=false;updateCruiseUI();running=false;fallTriggered=true;$('fallAlert').style.display='block';log('مراقب السقوط أوقف أمر الخطوات: h='+data.qpos[2].toFixed(2)+' m، ميل='+tilt.toFixed(1)+'°',true)}sync();let h=data.qpos[2],sp=Math.hypot(data.qvel[0],data.qvel[1],data.qvel[2]);history.push({time:+simTime.toFixed(3),pelvisZ:+h.toFixed(4),contacts:data.ncon,speed:+sp.toFixed(3)});if(history.length>8000)history.shift()}
function telemetry(){if(!ready)return;$('time').textContent=simTime.toFixed(2)+' s';let z=data.qpos[2];$('pelvis').textContent=z.toFixed(3)+' m';$('contacts').textContent=data.ncon;$('speed').textContent=Math.hypot(...Array.from(data.qvel.subarray(0,3))).toFixed(2)+' m/s';let q=data.qpos.subarray(3,7),up=new THREE.Vector3(0,0,1).applyQuaternion(quatToThree(q));$('tilt').textContent=(Math.acos(THREE.MathUtils.clamp(up.z,-1,1))*180/Math.PI).toFixed(1)+'°';$('grav').textContent=model.opt.gravity[2].toFixed(2)+' m/s²';$('torsoGyro').textContent=sensorText('torso-angular-velocity');$('torsoAccel').textContent=sensorText('torso-linear-acceleration');$('pelvisGyro').textContent=sensorText('pelvis-angular-velocity');$('pelvisAccel').textContent=sensorText('pelvis-linear-acceleration');$('fallState').textContent=data.qpos[2]<.40?'ساقط / منخفض':'لم يتجاوز العتبة';$('controlMode').textContent=neural?'ONNX RL Policy':policyActive?'JSON Policy':driveActive?'Joint gait demo':'Position targets'}
function frame(t){requestAnimationFrame(frame);let dt=Math.min(.06,(t-last)/1000);last=t;if(running&&ready){if(cruise&&neural)velocityCommand=[Number($('cruiseSpeed').value),0,0];if(neural&&simTime>=neuralTick){neuralTick=simTime+1/neural.manifest.controlHz;void updateNeural()}acc+=dt;let count=0;while(acc>=model.opt.timestep&&count++<20){stepOnce();acc-=model.opt.timestep}if(count>=20)acc=0;telemetry()}orbit.update();renderer.render(scene,camera)}requestAnimationFrame(frame);
$('play').onclick=()=>{if(!ready){log('الموديل لم يجهز بعد',true);return}running=!running;$('play').textContent=running?'Ⅱ إيقاف':'▶ تشغيل';status(running?'محاكاة تعمل':'محاكاة متوقفة',running)};
$('step').onclick=()=>{running=false;$('play').textContent='▶ تشغيل';stepOnce();telemetry()};$('reset').onclick=()=>{if(!ready)return;cruise=false;updateCruiseUI();setDrive('stop');fallTriggered=false;$('fallAlert').style.display='none';drivePhase=0;running=false;policyActive=false;neuralTick=0;neuralLastAction=neural?new Array(neural.manifest.jointNames.length).fill(0):[];velocityCommand=[0,0,0];acc=0;simTime=0;history=[];mj.mj_resetData(model,data);if(model.nkey>0&&model.key_qpos?.length>=model.nq){for(let i=0;i<model.nq;i++)data.qpos[i]=model.key_qpos[i];if(model.key_ctrl?.length>=model.nu){for(let i=0;i<model.nu;i++)data.ctrl[i]=model.key_ctrl[i]}}mj.mj_forward(model,data);targets=(model.nkey>0&&model.key_ctrl?.length>=model.nu)?Array.from(model.key_ctrl.subarray(0,model.nu)):new Array(model.nu).fill(0);$('gain').value=100;sync();telemetry();updateJointSlider();status('تمت إعادة المشهد',true)};
for(let b of document.querySelectorAll('[data-action]'))b.onclick=()=>pose(b.dataset.action);$('send').onclick=()=>{let s=$('cmd').value;if(/رفع|ذراع|ايد/.test(s))pose('arms');else if(/ركبة|ثني|اجلس/.test(s))pose('squat');else if(/جاذبية|سقوط|اقع/.test(s))pose('gravity');else if(/وقف|استعد|صفر/.test(s))pose('stand');else log('أمر غير معروف، استخدم: ارفع الذراعين / ثني الركبتين / سقوط / استعد')};$('cmd').onkeydown=e=>{if(e.key==='Enter')$('send').click()};
$('joint').onchange=updateJointSlider;$('jointRange').oninput=()=>{let i=+$('joint').value;targets[i]=+$('jointRange').value;$('jointVal').textContent=Number($('jointRange').value).toFixed(2)+' rad'};$('gain').oninput=e=>$('gainVal').textContent=e.target.value+'%';
for(let b of document.querySelectorAll('[data-tab]'))b.onclick=()=>{document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t===b));document.querySelectorAll('.content').forEach(t=>t.classList.toggle('active',t.id==='tab-'+b.dataset.tab))};
function viewCamera(p){orbit.reset();camera.up.set(0,0,1);camera.position.set(...p);orbit.target.set(0,0,.9);orbit.update()}$('camFront').onclick=()=>viewCamera([0,-3.4,1.65]);$('camSide').onclick=()=>viewCamera([3.4,0,1.65]);$('camOrbit').onclick=()=>viewCamera([2.8,-3.7,2.15]);
for(const b of document.querySelectorAll('[data-drive]')){const d=b.dataset.drive;if(d==='stop'){b.addEventListener('click',()=>setDrive('stop'));continue}b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);setDrive(d)});b.addEventListener('pointerup',()=>setDrive('stop'));b.addEventListener('pointercancel',()=>setDrive('stop'));b.addEventListener('lostpointercapture',()=>{if(driveDirection===d)setDrive('stop')});}document.addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement)return;const d={ArrowUp:'forward',ArrowDown:'backward',ArrowLeft:'left',ArrowRight:'right', ' ':'stop'}[e.key];if(d){e.preventDefault();setDrive(d)}});document.addEventListener('keyup',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))setDrive('stop')});$('driveSpeed').oninput=()=>{$('driveSpeedVal').textContent=$('driveSpeed').value+'×'};$('safeStand').onclick=()=>{$('reset').click();pose('stand');$('driveStatus').textContent='تمت إعادة ضبط المحاكاة. اضغط تشغيل، ثم استخدم أزرار الاتجاهات.'};$('startDrive').onclick=()=>$('play').click();
$('pushTest').onclick=pushRobot;$('cruise').onclick=toggleCruise;$('cruiseSpeed').oninput=()=>{$('cruiseSpeedValue').textContent=Number($('cruiseSpeed').value).toFixed(2)+' m/s'};
$('policyFile').onchange=async e=>{
 try{if(e.target.files?.length){await installNeural(e.target.files)}}
 catch(err){log('رفض ONNX: '+err.message,true);$('policyStatus').textContent='مرفوضة: '+err.message}
};
$('stopPolicy').onclick=()=>{cruise=false;updateCruiseUI();neural=null;neuralBusy=false;neuralLastAction=[];velocityCommand=[0,0,0];policyActive=false;pose('stand');$('policyStatus').textContent='متوقفة'};
$('verify').onclick=()=>{if(!ready){$('verifyOutput').textContent='المحرك لم يحمّل بعد';return}let before=data.time,z0=data.qpos[2];running=false;mj.mj_step(model,data);mj.mj_forward(model,data);let okGravity=Math.abs(model.opt.gravity[2]+9.81)<.001&&model.opt.gravity[0]===0&&model.opt.gravity[1]===0;let okStep=data.time>before;let okModel=model.nu>0&&model.njnt>20;$('verifyOutput').innerHTML=`<div class="minirow"><b>الجاذبية: −Z</b><span>${okGravity?'PASS':'FAIL'}</span></div><div class="minirow"><b>تقدم MuJoCo step</b><span>${okStep?'PASS':'FAIL'}</span></div><div class="minirow"><b>G1 model / actuators</b><span>${okModel?'PASS':'FAIL'}</span></div><div class="micro">Pelvis Z: ${z0.toFixed(3)} → ${data.qpos[2].toFixed(3)} m. هذا لا يثبت استقرار المشي.</div>`;log('فحص: '+[okGravity,okStep,okModel].map(x=>x?'PASS':'FAIL').join(' / '));sync();telemetry()};
$('evaluate').onclick=async()=>{if(!neural){$('evalResult').textContent='لا يمكن تقييم الاتزان أو المشي دون سياسة ONNX متوافقة. الاختبارات السابقة 5/5 كانت تكرارًا لنفس الحالة وليست إثبات توازن.';log('تم منع تقييم اتزان مضلل: لا توجد سياسة مشي مدرّبة',true);return}if(neural){$('evalResult').textContent='لتقييم ONNX: اعمل عدة تشغيلات منفصلة وصدّر JSON لكل تجربة. التقييم الآلي المتكرر يتطلب حلقة inference متزامنة مع خطوات المحاكاة؛ غير متاح بعد.';return}if(!ready||evalBusy)return;evalBusy=true;running=false;let results=[];const steps=Math.round(2/model.opt.timestep);for(let trial=0;trial<5;trial++){mj.mj_resetData(model,data);mj.mj_forward(model,data);policyIndex=0;let t=0,fallen=false;for(let k=0;k<steps;k++){stepOnce();t+=model.opt.timestep;if(data.qpos[2]<.38){fallen=true;break}}results.push({trial:trial+1,fallen,time:t,finalHeight:data.qpos[2]});await new Promise(r=>setTimeout(r,0))}policyActive=false;let success=results.filter(r=>!r.fallen).length;$('evalResult').textContent=`النتيجة: ${success}/5 لم تسقط خلال ثانيتين. ${results.map(r=>'#'+r.trial+': '+r.time.toFixed(2)+'s').join(' · ')}. ملاحظة: التجارب الخمس متطابقة مبدئيًا ما لم يُضف تغيير للحالة الابتدائية؛ ليست تقييم تعميم إحصائي.`;log('التقييم: '+success+'/5 بدون سقوط');evalBusy=false;sync();telemetry()};
$('export').onclick=()=>{let blob=new Blob([JSON.stringify({model:'Unitree G1 29 DoF MJCF (Menagerie)',physics:'MuJoCo WASM',gravity:[0,0,-9.81],policyLoaded:!!policy,history,pushTrials,policyManifest:neural?.manifest?.trainingModelId||null},null,2)],{type:'application/json'});let url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='robomind_g1_trial.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
boot();

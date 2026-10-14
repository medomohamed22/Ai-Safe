export interface VideoFrame {time:number;image:string;note:string}
export async function extractVideo(file:File,signal:AbortSignal,onProgress:(done:number)=>void){
 if(!file.type.startsWith('video/')||file.size>25e6)throw new Error('Choose a supported video below 25 MB.');
 const video=document.createElement('video');video.muted=true;video.playsInline=true;video.preload='auto';const url=URL.createObjectURL(file);
 const wait=(event:string)=>new Promise<void>((resolve,reject)=>{const cleanup=()=>{clearTimeout(timer);video.removeEventListener(event,done);video.removeEventListener('error',fail);signal.removeEventListener('abort',abort);};const done=()=>{cleanup();resolve();};const fail=()=>{cleanup();reject(new Error('Browser could not decode this video. Try MP4 or WebM.'));};const abort=()=>{cleanup();reject(new DOMException('Cancelled','AbortError'));};const timer=setTimeout(()=>{cleanup();reject(new Error('Video decoding timed out.'));},10000);video.addEventListener(event,done,{once:true});video.addEventListener('error',fail,{once:true});signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();});
 try{
  const metadata=wait('loadedmetadata');video.src=url;await metadata;
  if(!Number.isFinite(video.duration)){const duration=wait('durationchange');video.currentTime=1e9;await duration;}
  if(!Number.isFinite(video.duration)||video.duration<=0||video.duration>120)throw new Error('Choose a finite recording up to two minutes.');
  if(video.readyState<2)await wait('loadeddata');
  const canvas=document.createElement('canvas');const scale=Math.min(1,800/video.videoWidth);canvas.width=Math.max(1,Math.round(video.videoWidth*scale));canvas.height=Math.max(1,Math.round(video.videoHeight*scale));const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas unavailable.');const frames:VideoFrame[]=[];
  const duration=video.duration;for(let i=0;i<6;i++){if(signal.aborted)throw new DOMException('Cancelled','AbortError');const time=i*(Math.max(0,duration-.08))/5;if(Math.abs(video.currentTime-time)>.001){const seek=wait('seeked');video.currentTime=time;await seek;}ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(video,0,0,canvas.width,canvas.height);frames.push({time:Number(time.toFixed(2)),image:canvas.toDataURL('image/jpeg',.8),note:''});onProgress(i+1);}
  return{duration,frames};
 }finally{video.pause();video.removeAttribute('src');video.load();URL.revokeObjectURL(url);}
}

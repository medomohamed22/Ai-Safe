import {load,save} from './storage';
export interface DesignAsset { name:string; dataUrl:string }
export const ASSETS_KEY='s2ui.assets.v1';
export const designAssets=()=>load<Record<string,DesignAsset>>(ASSETS_KEY,{});
export function saveDesignAssets(next:Record<string,DesignAsset>){if(Object.keys(next).length>30||JSON.stringify(next).length>2500000)throw new Error('Asset library limit: 30 images / 2.5 MB.');save(ASSETS_KEY,next);window.dispatchEvent(new Event('s2ui-library-change'));}
export function materializeAssets(code:string){const assets=designAssets();return code.replace(/(["'])s2ui-asset:([\w:-]+)\1/g,(_,q,key)=>{if(!assets[key])throw new Error(`Missing design asset: ${key}`);return JSON.stringify(assets[key].dataUrl);});}

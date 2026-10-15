import {useSyncExternalStore} from 'react';
import {getLanguage,setLanguage,subscribeLanguage} from '../lib/i18n';
export const useLanguage=()=>useSyncExternalStore(subscribeLanguage,getLanguage,()=> 'en' as const);
export function LanguageToggle(){const language=useLanguage();return <div className="language-switch" role="group" aria-label={language==='ar'?'لغة الموقع':'Site language'}>{(['en','ar'] as const).map(code=><button key={code} type="button" lang={code} aria-label={code==='ar'?'العربية':'English'} aria-pressed={language===code} onClick={()=>setLanguage(code)}>{code.toUpperCase()}</button>)}</div>;}

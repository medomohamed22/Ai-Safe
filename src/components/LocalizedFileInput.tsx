import {useRef,useState,type InputHTMLAttributes} from 'react';
import {tr} from '../lib/i18n';
export function LocalizedFileInput(props:InputHTMLAttributes<HTMLInputElement>){
 const ref=useRef<HTMLInputElement>(null);const [name,setName]=useState('');
 return <span className="localized-file-input"><input {...props} ref={ref} type="file" tabIndex={-1} className="file-input-native" onChange={event=>{setName(event.target.files?.[0]?.name||'');props.onChange?.(event);}}/><button type="button" className="ui-button" disabled={props.disabled} onClick={()=>ref.current?.click()}>{tr('Choose a file')}</button><bdi>{name||tr('No file selected')}</bdi></span>;
}

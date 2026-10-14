import assert from 'node:assert/strict';
import { materializeLibrary, validateComponent } from '../src/lib/componentLibrary.ts';
import { sourceChecks } from '../src/lib/quality.ts';
const library=[{name:'Button',description:'props',code:"import {useState as useLocal} from 'react';export default function Button({children}){const [x]=useLocal(1);return <button>{children}{x}</button>}"}];
const code="import {Button as CTA} from '@sketch2ui/library';export default function App(){return <CTA>Go</CTA>}";
const resolved=materializeLibrary(code,library);assert.ok(!resolved.includes('@sketch2ui/library'));assert.match(resolved,/const CTA/);assert.match(resolved,/const useLocal/);assert.ok(sourceChecks(resolved).every(r=>r.passed));assert.throws(()=>materializeLibrary(code,[]),/Missing library/);assert.throws(()=>validateComponent({...library[0],code:"import fs from 'node:fs';export default function Button(){return null}"}),/imports only/);console.log('PASS: component materialization, import aliases, hook scope, missing definitions and unsupported imports.');

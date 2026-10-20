import { reserveRequest } from './usage';
import type { ModelInfo, ProviderConfig, ProviderType } from '../types';

export const PROVIDER_PRESETS: Record<
  ProviderType,
  { label: string; baseUrl: string; keyUrl: string; defaultProxy: boolean; hint: string }
> = {
  openrouter: {
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyUrl: 'https://openrouter.ai/keys',
    defaultProxy: false,
    hint: 'Hundreds of models incl. Meta Llama 4 vision. Vision-capable models are detected automatically.',
  },
  meta: {
    label: 'Meta Model API',
    baseUrl: 'https://api.meta.ai/v1',
    keyUrl: 'https://dev.meta.ai',
    defaultProxy: true,
    hint: 'Meta Model API on dev.meta.ai — Muse Spark, Muse Image and SAM 3.1 (OpenAI-compatible endpoint). Proxy is on by default in case the API blocks browser CORS.',
  },
  'meta-llama': {
    label: 'Meta Llama API (legacy)',
    baseUrl: 'https://api.llama.com/compat/v1',
    keyUrl: 'https://llama.developer.meta.com',
    defaultProxy: true,
    hint: 'Official Meta Llama API (OpenAI-compatible endpoint). Proxy is on by default in case the API blocks browser CORS.',
  },
  gemini: {
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    keyUrl: 'https://aistudio.google.com/apikey',
    defaultProxy: false,
    hint: 'Native Gemini API. All Gemini models support image input.',
  },
  openai: {
    label: 'OpenAI-compatible',
    baseUrl: 'https://api.openai.com/v1',
    keyUrl: '',
    defaultProxy: false,
    hint: 'Any OpenAI-compatible endpoint (OpenAI, Groq, Together, local LM Studio/Ollama…). Change the Base URL.',
  },
};

export function createProvider(type: ProviderType): ProviderConfig {
  const p = PROVIDER_PRESETS[type];
  return {
    id: crypto.randomUUID(),
    type,
    name: p.label,
    apiKey: '',
    baseUrl: p.baseUrl,
    useProxy: p.defaultProxy,
    models: [],
  };
}

const trimSlash = (s: string) => s.replace(/\/+$/, '');

function request(p: ProviderConfig, url: string, init: RequestInit = {}) {
  const final = p.useProxy ? `/api/proxy?url=${encodeURIComponent(url)}` : url;
  return fetch(final, init).catch((e) => {
    throw new Error(
      `Network/CORS error calling ${new URL(url).host}. ${p.useProxy ? '' : 'Try enabling "Use proxy" for this provider in Settings. '}(${e?.message || e})`,
    );
  });
}

async function ensureOk(res: Response) {
  if (res.ok) return;
  let t = await res.text().catch(() => '');
  try {
    const j = JSON.parse(t);
    t = j?.error?.message || j?.message || j?.detail || (typeof j?.error === 'string' ? j.error : t);
  } catch {
    /* not json */
  }
  throw new Error(`HTTP ${res.status}: ${String(t).slice(0, 500)}`);
}

function openAIHeaders(p: ProviderConfig): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (p.apiKey) h.Authorization = `Bearer ${p.apiKey}`;
  if (p.type === 'openrouter') {
    h['HTTP-Referer'] = location.origin;
    h['X-Title'] = 'Sketch2UI';
  }
  return h;
}

function guessVision(type: ProviderType, id: string): boolean | undefined {
  const s = id.toLowerCase();
  if (type === 'gemini') return !/embedding|aqa|imagen|tts/.test(s);
  if (/muse-spark|llama-4|vision|gpt-4o|gpt-4\.1|gpt-5|claude|gemini|pixtral|qwen.*vl|-vl/.test(s)) return true;
  return undefined;
}

export async function fetchModels(p: ProviderConfig): Promise<ModelInfo[]> {
  const base = trimSlash(p.baseUrl);
  if (!p.apiKey && p.type !== 'openrouter') throw new Error('Add an API key first.');

  if (p.type === 'gemini') {
    const res = await request(p, `${base}/models?pageSize=1000`, { headers: { 'x-goog-api-key': p.apiKey } });
    await ensureOk(res);
    const j = await res.json();
    return (j.models || [])
      .filter((m: any) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m: any) => {
        const id = String(m.name).replace(/^models\//, '');
        return { id, name: m.displayName || id, vision: guessVision('gemini', id), context: m.inputTokenLimit };
      })
      .sort((a: ModelInfo, b: ModelInfo) => a.id.localeCompare(b.id));
  }

  const res = await request(p, `${base}/models`, { headers: openAIHeaders(p) });
  await ensureOk(res);
  const j = await res.json();
  const list: any[] = Array.isArray(j) ? j : j.data || j.models || [];
  if (p.type === 'meta' && list.length === 0) {
    // The Meta Model API model list can be empty for new keys; seed the known Muse chat models.
    return [
      { id: 'muse-spark-1.3', name: 'Muse Spark 1.3', vision: true },
      { id: 'muse-spark-1.2', name: 'Muse Spark 1.2', vision: true },
    ];
  }
  return list
    .map((m: any) => {
      const id = String(m.id ?? m.name);
      const mods: string[] | undefined = m.architecture?.input_modalities;
      const modality: string | undefined = m.architecture?.modality;
      const vision = mods ? mods.includes('image') : modality ? modality.split('->')[0].includes('image') : guessVision(p.type, id);
      return { id, name: m.name || id, vision, context: m.context_length };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

const PREFERRED = [
  'muse-spark-1.3',
  'muse-spark',
  'llama-4-maverick',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'llama-4-scout',
  'gpt-4.1',
  'gpt-4o',
  'claude-sonnet',
];

export function pickDefaultModel(models: ModelInfo[]): string | null {
  for (const pref of PREFERRED) {
    const m = models.find((x) => x.id.toLowerCase().includes(pref) && !/preview|exp|lite|free/.test(x.id.toLowerCase()));
    if (m) return m.id;
  }
  return (models.find((m) => m.vision) || models[0])?.id ?? null;
}

// ---------------------------------------------------------------------------------------------
// Generation (streaming)
// ---------------------------------------------------------------------------------------------

export interface GenerateArgs {
  provider: ProviderConfig;
  model: string;
  system: string;
  userText: string;
  imageDataUrl?: string | null;
  imageDataUrls?: string[];
  temperature: number;
  signal: AbortSignal;
  onToken: (fullTextSoFar: string) => void;
  onUsage?: (usage: {input:number;output:number}) => void;
}

function textFromContent(c: any): string {
  if (!c) return '';
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.map(textFromContent).join('');
  if (typeof c === 'object') return c.text ?? '';
  return '';
}

/** Extracts the text delta from one chunk of any supported provider. */
function deltaFrom(j: any): string {
  if (j?.error) throw new Error(j.error.message || JSON.stringify(j.error));
  // OpenAI-compatible (stream + non-stream)
  const ch = j?.choices?.[0];
  if (ch) return textFromContent(ch.delta?.content ?? ch.message?.content ?? ch.text);
  // Meta native format
  if (j?.completion_message) return textFromContent(j.completion_message.content);
  if (j?.event?.delta) return textFromContent(j.event.delta);
  // Gemini
  const parts = j?.candidates?.[0]?.content?.parts;
  if (parts) return parts.filter((p: any) => !p.thought).map((p: any) => p.text || '').join('');
  return '';
}

async function readResponse(res: Response, onToken: (t: string) => void, onUsage?: GenerateArgs['onUsage']): Promise<string> {
  const report = (j: any) => { const input = j?.usage?.prompt_tokens ?? j?.usageMetadata?.promptTokenCount; const output = j?.usage?.completion_tokens ?? j?.usageMetadata?.candidatesTokenCount; if (Number.isFinite(input) && Number.isFinite(output) && input >= 0 && output >= 0) onUsage?.({ input, output }); };
  const ct = res.headers.get('content-type') || '';
  if (!res.body || !ct.includes('event-stream')) {
    // Provider ignored streaming → plain JSON
    const j = await res.json();
    if (Array.isArray(j)) j.forEach(report); else report(j);
    const full = Array.isArray(j) ? j.map(deltaFrom).join('') : deltaFrom(j);
    onToken(full);
    return full;
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let full = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      const l = line.trim();
      if (!l.startsWith('data:')) continue;
      const payload = l.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      let j: any;
      try {
        j = JSON.parse(payload);
      } catch {
        continue;
      }
      report(j);
      const d = deltaFrom(j);
      if (d) {
        full += d;
        onToken(full);
      }
    }
  }
  return full;
}

async function generateRaw(a: GenerateArgs): Promise<string> {
  const p = a.provider;
  const base = trimSlash(p.baseUrl);
  const images = a.imageDataUrls ?? (a.imageDataUrl ? [a.imageDataUrl] : []);

  if (p.type === 'gemini') {
    const parts: any[] = [{ text: a.userText }];
    for (const image of images) {
      const [meta, data] = image.split(',');
      const mimeType = meta.match(/data:(.*?);/)?.[1] || 'image/png';
      parts.push({ inlineData: { mimeType, data } });
    }
    const res = await request(p, `${base}/models/${a.model}:streamGenerateContent?alt=sse`, {
      method: 'POST',
      signal: a.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': p.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: a.system }] },
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: a.temperature, maxOutputTokens: 16384 },
      }),
    });
    await ensureOk(res);
    return readResponse(res, a.onToken, a.onUsage);
  }

  // OpenAI-compatible: Meta Model API, OpenRouter, Meta Llama API (legacy compat), OpenAI, Groq, ...
  const content: any[] = [{ type: 'text', text: a.userText }];
  for (const image of images) content.push({ type: 'image_url', image_url: { url: image } });
  const body: Record<string, unknown> = {
    model: a.model,
    stream: true,
    temperature: a.temperature,
    messages: [
      { role: 'system', content: a.system },
      { role: 'user', content: images.length ? content : a.userText },
    ],
  };
  if (p.type !== 'meta-llama') body.max_tokens = 12000;

  const res = await request(p, `${base}/chat/completions`, {
    method: 'POST',
    signal: a.signal,
    headers: openAIHeaders(p),
    body: JSON.stringify(body),
  });
  await ensureOk(res);
  return readResponse(res, a.onToken, a.onUsage);
}


export async function generate(a: GenerateArgs): Promise<string> {
 if (a.signal.aborted) throw new DOMException('Aborted', 'AbortError');
 const finish = reserveRequest(a.model, a.provider.id || a.provider.type, a.temperature + '\n' + a.system + '\n' + a.userText, a.imageDataUrls ?? (a.imageDataUrl ? [a.imageDataUrl] : []));
 let output = ''; let actual: {input:number;output:number} | undefined;
 try {
  const result = await generateRaw({ ...a, onToken: text => { output = text; a.onToken(text); }, onUsage: u => { actual = u; a.onUsage?.(u); } });
  if (a.signal.aborted) throw new DOMException('Aborted','AbortError');
  finish('done', result, actual); return result;
 } catch(e) { finish(a.signal.aborted ? 'cancelled' : 'failed', output, actual); throw e; }
}

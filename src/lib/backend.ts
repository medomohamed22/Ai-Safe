export interface Endpoint { id: string; method: string; path: string; dataPath: string; fields: Record<string, string>; requestSchema?: unknown; responseSchema?: unknown; parameters?: unknown[] }
export interface BackendConfig { mode: 'demo' | 'http'; baseUrl: string; endpoints: Endpoint[] }
export const DEFAULT_BACKEND: BackendConfig = { mode: 'demo', baseUrl: '', endpoints: [] };

export function importOpenApi(text: string): BackendConfig {
  const spec = JSON.parse(text);
  if (!spec.openapi?.startsWith('3.') || !spec.paths || typeof spec.paths !== 'object') throw new Error('Use an OpenAPI 3.x JSON file. YAML and remote $refs are not supported.');
  const endpoints: Endpoint[] = [];
  const resolve = (schema: any, depth = 0): any => {
    if (!schema || typeof schema !== 'object' || depth > 8) return schema;
    if (schema.$ref) {
      if (!schema.$ref.startsWith('#/')) throw new Error('Remote schema references are not supported.');
      const value = schema.$ref.slice(2).split('/').reduce((obj: any, key: string) => obj?.[key.replace(/~1/g, '/').replace(/~0/g, '~')], spec);
      if (!value) throw new Error(`Unresolved schema: ${schema.$ref}`);
      return resolve(value, depth + 1);
    }
    return Array.isArray(schema) ? schema.map(value => resolve(value, depth + 1)) : Object.fromEntries(Object.entries(schema).map(([key, value]) => [key, resolve(value, depth + 1)]));
  };
  for (const [path, value] of Object.entries(spec.paths)) {
    if (!path.startsWith('/')) continue;
    for (const [method, operation] of Object.entries(value as object)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
      const op = operation as any;
      const response = op?.responses?.['200'] || op?.responses?.['201'];
      endpoints.push({ id: op?.operationId || `${method}_${path}`, method: method.toUpperCase(), path, dataPath: '', fields: {}, requestSchema: resolve(op?.requestBody?.content?.['application/json']?.schema), responseSchema: resolve(response?.content?.['application/json']?.schema), parameters: resolve(op?.parameters || []) });
    }
  }
  if (!endpoints.length) throw new Error('No supported endpoints found.');
  if (new Set(endpoints.map(e => e.id)).size !== endpoints.length) throw new Error('Operation IDs must be unique.');
  return { mode: 'demo', baseUrl: spec.servers?.[0]?.url || '', endpoints };
}

// Self-contained so the same adapter runs in the opaque preview and exported app.
export function createBackend(config: BackendConfig, fetcher: typeof fetch = fetch) {
  const records = new Map<string, any[]>();
  return {
    config,
    async request(id: string, args: { params?: Record<string, string>; query?: Record<string, string>; body?: unknown; signal?: AbortSignal; headers?: Record<string, string> } = {}) {
      const endpoint = config.endpoints.find(e => e.id === id);
      if (!endpoint) throw new Error(`Unknown API operation: ${id}`);
      if (config.mode === 'demo') {
        const key = endpoint.path.replace(/\/\{[^}]+\}/g, '');
        const list = records.get(key) || [];
        const itemId = Object.values(args.params || {})[0];
        if (endpoint.method === 'GET') return itemId ? list.find(item => String(item.id) === itemId) ?? null : [...list];
        if (endpoint.method === 'POST') { const item = { ...(args.body as object || {}), id: crypto.randomUUID() }; records.set(key, [...list, item]); return item; }
        const item = list.find(item => String(item.id) === itemId);
        if (!item) throw new Error('Demo record not found.');
        if (endpoint.method === 'DELETE') { records.set(key, list.filter(row => row !== item)); return null; }
        const updated = { ...item, ...(args.body as object || {}), id: item.id }; records.set(key, list.map(row => row === item ? updated : row)); return updated;
      }
      let route = endpoint.path.replace(/\{([^}]+)\}/g, (_, key) => {
        if (args.params?.[key] === undefined) throw new Error(`Missing path parameter: ${key}`);
        return encodeURIComponent(args.params[key]);
      });
      if (!/^https?:\/\//.test(config.baseUrl)) throw new Error('Set an absolute API base URL.');
      const url = new URL(config.baseUrl.replace(/\/$/, '') + '/' + route.replace(/^\//, ''));
      if (url.username || url.password) throw new Error('Do not put credentials in the API URL.');
      Object.entries(args.query || {}).forEach(([key, value]) => url.searchParams.set(key, value));
      const response = await fetcher(url, { method: endpoint.method, signal: args.signal,
        headers: { ...(args.body === undefined ? {} : { 'Content-Type': 'application/json' }), ...args.headers },
        body: endpoint.method === 'GET' || args.body === undefined ? undefined : JSON.stringify(args.body) });
      if (!response.ok) throw new Error(`API ${response.status}: ${(await response.text()).slice(0, 300)}`);
      const raw = response.status === 204 ? '' : await response.text();
      if (!raw) return null;
      let data = JSON.parse(raw);
      for (const segment of endpoint.dataPath.split('.').filter(Boolean)) {
        if (data == null || !(segment in Object(data))) throw new Error(`Missing response path: ${endpoint.dataPath}`);
        data = data[segment];
      }
      const map = (item: any) => item && typeof item === 'object' ? { ...item, ...Object.fromEntries(Object.entries(endpoint.fields).map(([uiField, apiField]) => [uiField, item[apiField]])) } : item;
      return Array.isArray(data) ? data.map(map) : map(data);
    },
  };
}

export function backendBootstrap(config: BackendConfig) {
  return `globalThis.__S2UI_API__ = (${createBackend.toString()})(${JSON.stringify(config).replace(/</g, '\\u003c')});`;
}

export function backendPrompt(config: BackendConfig) {
  if (!config.endpoints.length) return '';
  return `\nBACKEND CONTRACT: ${JSON.stringify(config)}\nUse globalThis.__S2UI_API__.request(operationId, {params, query, body, signal}) for these operations. The host provides the adapter in preview and project exports. It returns normalized data (response path and field mapping already applied). Demo starts empty; support adding records and empty states. Keep domain logic separate from UI. Do not invent auth credentials.\n`;
}

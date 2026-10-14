import { serviceRequest } from './services';
import { buildPreviewHtml } from './preview';
import type { BackendConfig } from './backend';
export async function capture(code: string, backend: BackendConfig, width = 820) {
 const res = await serviceRequest('/api/screenshot', { html: buildPreviewHtml(code, undefined, { ...backend, mode: 'demo' }), width, height: 900 });
 const data = await res.json(); if (!res.ok || typeof data.image !== 'string') throw new Error(data.error || 'Screenshot capture failed.');
 return data as { image: string; width: number; height: number; blockedHosts: string[] };
}
const readImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('Could not read comparison image.')); img.src = src; });
export async function compareImages(before: string, after: string) {
 const images = await Promise.all([readImage(before), readImage(after)]);
 const pixels = images.map(img => { const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 240; const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 320, 240); const scale = Math.min(320 / img.width, 240 / img.height); ctx.drawImage(img, 0, 0, img.width * scale, img.height * scale); return ctx.getImageData(0, 0, 320, 240); });
 const heat = document.createElement('canvas'); heat.width = 320; heat.height = 240; const ctx = heat.getContext('2d')!; const data = ctx.createImageData(320, 240); let sum = 0;
 for (let i = 0; i < pixels[0].data.length; i += 4) { const delta = [0, 1, 2].reduce((n, c) => n + Math.abs(pixels[0].data[i + c] - pixels[1].data[i + c]), 0) / 3; sum += delta; data.data[i] = delta > 20 ? 220 : pixels[1].data[i]; data.data[i + 1] = delta > 20 ? 70 : pixels[1].data[i + 1]; data.data[i + 2] = delta > 20 ? 70 : pixels[1].data[i + 2]; data.data[i + 3] = 255; }
 ctx.putImageData(data, 0, 0); return { difference: sum / (320 * 240 * 255), heatmap: heat.toDataURL('image/png') };
}

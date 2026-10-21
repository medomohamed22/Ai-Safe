// Model purpose classification for the picker (P3-02). Provider model lists
// mix chat models with image/audio/music generators and utility endpoints
// (embeddings, rerankers, moderation). Picking one of those for UI
// generation can only fail, so the picker hides them by default.
//
// This is a NAME-BASED HEURISTIC, not a capability guarantee: unknown
// models default to 'code' so a capable model is never hidden by mistake,
// and the filter can be turned off to see everything.
export type ModelPurpose = 'code' | 'media';

const MEDIA_RE = /(^|[\s\-_/.])(dall-e|imagen|flux|sdxl|stable-diffusion|image|images|picture|tts|whisper|audio|music|suno|voice|speech|video|veo|sora|kling|runway|embedding|embed|rerank|moderation|ocr)([\s\-_/.]|$)/i;

export function modelPurpose(model: { id: string; name?: string }): ModelPurpose {
  const haystack = `${model.id} ${model.name || ''}`;
  return MEDIA_RE.test(haystack) ? 'media' : 'code';
}

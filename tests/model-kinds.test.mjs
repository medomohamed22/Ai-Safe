import assert from 'node:assert/strict';
import { modelPurpose } from '../src/lib/modelKinds.ts';

// P3-02: media/utility models are classified so the picker can hide them by
// default; anything unknown stays 'code' (never hide a capable model).
for (const id of ['dall-e-3', 'gpt-image-1', 'whisper-1', 'tts-1', 'text-embedding-3-small', 'imagen-4', 'flux-1.1-pro', 'suno-v4', 'omni-moderation-latest', 'veo-3'])
  assert.equal(modelPurpose({ id }), 'media', id);
for (const id of ['gpt-5', 'claude-sonnet-4.5', 'gemini-3.1-flash-lite', 'muse-spark-1.3', 'llama-4-maverick', 'qwen3-vl-235b', 'some-unknown-chat-model'])
  assert.equal(modelPurpose({ id }), 'code', id);
assert.equal(modelPurpose({ id: 'acme-1', name: 'Acme Image Generator' }), 'media', 'the display name counts too');
console.log('model-kinds tests passed.');

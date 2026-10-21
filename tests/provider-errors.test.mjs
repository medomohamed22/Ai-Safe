import assert from 'node:assert/strict';
import { friendlyHttpError } from '../src/lib/providers.ts';

// Item 17: provider failures must read as a next step, never a raw HTTP dump.
assert.match(friendlyHttpError(401), /API key/);
assert.match(friendlyHttpError(403), /API key/);
assert.match(friendlyHttpError(402), /out of credit/);
assert.match(friendlyHttpError(404), /model was not found/);
assert.match(friendlyHttpError(429), /Rate limit/);
assert.match(friendlyHttpError(400), /could not process/);
assert.match(friendlyHttpError(422), /could not process/);
assert.match(friendlyHttpError(500), /having trouble/);
assert.match(friendlyHttpError(503), /having trouble/);
const other = friendlyHttpError(418);
assert.match(other, /returned an error/);
for (const status of [401, 402, 404, 429, 500, 418]) {
  assert.ok(!friendlyHttpError(status).startsWith('HTTP'), `status ${status} must not leak the raw HTTP prefix`);
}
console.log('provider-errors tests passed.');

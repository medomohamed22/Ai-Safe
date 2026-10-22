import assert from 'node:assert/strict';
import { freshStages, setStage, snapshotStages, STAGE_ORDER } from '../src/lib/pipeline.ts';

const stages = freshStages();
assert.deepEqual(stages.map(s => s.id), STAGE_ORDER, 'stages follow the production-line order');
assert.ok(stages.every(s => s.status === 'todo'));
const active = setStage(stages, 'build', { status: 'active', model: 'test-model' });
assert.equal(stages.find(s => s.id === 'build').status, 'todo', 'setStage never mutates the previous state');
assert.equal(active.find(s => s.id === 'build').status, 'active');
const done = setStage(active, 'build', { status: 'done', detail: 'ok' });
const skipped = setStage(done, 'plan', { status: 'skipped', detail: 'No plan for this screen' });
assert.deepEqual(snapshotStages(skipped).map(s => s.id), ['plan', 'build'], 'the snapshot keeps the stage order and drops untouched stages');
assert.equal(snapshotStages(skipped).find(s => s.id === 'build').model, 'test-model');
console.log('PASS: pipeline stage model');

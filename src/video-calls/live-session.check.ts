/** Run: npx ts-node src/video-calls/live-session.check.ts */
import * as assert from 'node:assert';
import { isLiveSession } from './live-session';

const minsAgo = (m: number) => new Date(Date.now() - m * 60_000);

// Fresh ring holds the line; an unanswered one past 60s does not.
assert.equal(
  isLiveSession({ status: 'ringing', created_at: new Date(), updated_at: new Date() }),
  true,
);
assert.equal(
  isLiveSession({ status: 'ringing', created_at: minsAgo(2), updated_at: minsAgo(2) }),
  false,
);

// The bug: an accepted call nobody hung up must stop blocking the doctor.
assert.equal(
  isLiveSession({
    status: 'accepted',
    created_at: minsAgo(10),
    updated_at: minsAgo(10),
    duration_minutes: 30,
  }),
  true,
);
assert.equal(
  isLiveSession({
    status: 'accepted',
    created_at: minsAgo(400),
    updated_at: minsAgo(400),
    duration_minutes: 30,
  }),
  false,
);

// Finished calls never hold the line.
for (const status of ['ended', 'declined', 'missed']) {
  assert.equal(
    isLiveSession({ status, created_at: new Date(), updated_at: new Date() }),
    false,
  );
}

console.log('live-session checks passed');

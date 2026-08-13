/** Run: npx ts-node src/push-notifications/expo-push.check.ts */
import * as assert from 'node:assert';
import { foreignProjectTokens } from './expo-push.client';
import { EXPO_PUSH_CONFIG } from './expo-push.config';

const ours = 'ExponentPushToken[RPF_jZAK1wiDUTNgzG1lP6]';
const stale = 'ExponentPushToken[g0dC38FPPdRhwNH2GeqURE]';

const body = JSON.stringify({
  errors: [
    {
      code: 'PUSH_TOO_MANY_EXPERIENCE_IDS',
      message: 'All push notification messages in the same request must be...',
      details: {
        '@alaahamedfrontend/3elagi-mobile': [stale],
        [EXPO_PUSH_CONFIG.experienceId]: [ours],
      },
    },
  ],
});

// Only the other project's token is dropped — ours must survive the prune.
assert.deepStrictEqual(foreignProjectTokens(body, [ours, stale]), [stale]);

// A token Expo named but that is not in this batch must not be deleted.
assert.deepStrictEqual(foreignProjectTokens(body, [ours]), []);

// Any other failure (500, HTML error page, a different push error) leaves
// every token alone — pruning on those would delete working devices.
assert.deepStrictEqual(foreignProjectTokens('<html>502</html>', [ours]), []);
assert.deepStrictEqual(
  foreignProjectTokens(
    JSON.stringify({ errors: [{ code: 'PUSH_TOO_MANY_NOTIFICATIONS' }] }),
    [ours, stale],
  ),
  [],
);

console.log('expo-push checks passed');

/** Run: npx ts-node src/presence/presence.gateway.check.ts */
import * as assert from 'node:assert';
import { JwtService } from '@nestjs/jwt';
import { PresenceGateway } from './presence.gateway';
import { PresenceService } from './presence.service';

const SECRET = 'test-secret';
const jwt = new JwtService({ secret: SECRET });

function socket(auth: Record<string, unknown>) {
  const joined: string[] = [];
  return {
    joined,
    client: {
      id: 'sock-1',
      handshake: { auth, query: {} },
      join: (room: string) => joined.push(room),
    } as never,
  };
}

const gateway = new PresenceGateway(new PresenceService(), jwt);

// A valid handshake token joins the delivery room immediately — before the
// client has had a chance to send user:loggedIn.
{
  const token = jwt.sign({ sub: 'user-42', role: 'doctor' });
  const { client, joined } = socket({ token });
  gateway.handleConnection(client);
  assert.deepEqual(joined, ['user:user-42']);
}

// "Bearer " prefixes are tolerated.
{
  const token = `Bearer ${jwt.sign({ sub: 'user-7' })}`;
  const { client, joined } = socket({ token });
  gateway.handleConnection(client);
  assert.deepEqual(joined, ['user:user-7']);
}

// Junk or missing tokens must not throw — the socket just stays roomless.
for (const auth of [{}, { token: 'not-a-jwt' }]) {
  const { client, joined } = socket(auth);
  gateway.handleConnection(client);
  assert.deepEqual(joined, []);
}

console.log('presence.gateway checks passed');

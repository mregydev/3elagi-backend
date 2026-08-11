/** Run: npx ts-node src/auth/roles.guard.check.ts */
import * as assert from 'node:assert';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { IS_PUBLIC_KEY } from './public.decorator';
import { ROLES_KEY } from './roles.decorator';

type Meta = Record<string, unknown>;

/** Minimal ExecutionContext: metadata lookups + the request user. */
function ctx(meta: Meta, user?: { role: string }) {
  const reflector = {
    getAllAndOverride: (key: string) => meta[key],
  } as unknown as Reflector;
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as never;
  return { guard: new RolesGuard(reflector), context };
}

// The bug: a @Public() route on a controller that declares @Roles at class
// level was rejected, because JWT is skipped so there is no user to check.
{
  const { guard, context } = ctx({
    [IS_PUBLIC_KEY]: true,
    [ROLES_KEY]: ['doctor', 'patient'],
  });
  assert.equal(guard.canActivate(context), true);
}

// Non-public routes still enforce roles.
{
  const { guard, context } = ctx({ [ROLES_KEY]: ['doctor'] }, { role: 'doctor' });
  assert.equal(guard.canActivate(context), true);
}
{
  const { guard, context } = ctx({ [ROLES_KEY]: ['doctor'] }, { role: 'patient' });
  assert.throws(() => guard.canActivate(context), /Access restricted/);
}
{
  const { guard, context } = ctx({ [ROLES_KEY]: ['doctor'] });
  assert.throws(() => guard.canActivate(context), /Not authenticated/);
}

// No roles declared at all: open to any authenticated caller, as before.
{
  const { guard, context } = ctx({});
  assert.equal(guard.canActivate(context), true);
}

console.log('roles.guard checks passed');

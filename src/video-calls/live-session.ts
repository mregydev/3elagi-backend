import type { Repository } from 'typeorm';
import type { VideoCallSession } from '../entities/video-call-session.entity';

/**
 * A call only holds the doctor's line while it is fresh. A crashed app or a
 * force-quit never sends `end`, so without a time bound an 'accepted' row would
 * mark the doctor busy forever and every later caller gets `doctor_busy`.
 *
 * ponytail: no heartbeat — a call running past duration + grace stops blocking
 * the line. Add a keepalive ping if calls legitimately overrun.
 */
export const RING_TIMEOUT_SEC = 60;
export const CALL_GRACE_MIN = 5;

/** In-memory twin of {@link liveCallSql}. Keep the two in step. */
export function isLiveSession(s: {
  status: string;
  created_at: Date | string;
  updated_at: Date | string;
  duration_minutes?: number | null;
}): boolean {
  const now = Date.now();
  if (s.status === 'ringing') {
    return new Date(s.created_at).getTime() > now - RING_TIMEOUT_SEC * 1000;
  }
  if (s.status === 'accepted') {
    const windowMin = (s.duration_minutes ?? 30) + CALL_GRACE_MIN;
    return new Date(s.updated_at).getTime() > now - windowMin * 60_000;
  }
  return false;
}

/** SQL predicate: this session is genuinely occupying the doctor's line. */
export function liveCallSql(alias: string): string {
  return `((${alias}.status = 'ringing' AND ${alias}.created_at > now() - interval '${RING_TIMEOUT_SEC} seconds')
    OR (${alias}.status = 'accepted' AND ${alias}.updated_at > now() - (COALESCE(${alias}.duration_minutes, 30) + ${CALL_GRACE_MIN}) * interval '1 minute'))`;
}

/** Doctor user ids whose line is occupied right now — drives the busy flag. */
export async function busyDoctorUserIds(
  repo: Repository<VideoCallSession>,
  doctorUserIds: string[],
): Promise<Set<string>> {
  if (doctorUserIds.length === 0) return new Set();
  const rows = await repo
    .createQueryBuilder('s')
    .select('DISTINCT s.doctor_user_id', 'doctor_user_id')
    .where('s.doctor_user_id IN (:...ids)', { ids: doctorUserIds })
    .andWhere(liveCallSql('s'))
    .getRawMany<{ doctor_user_id: string }>();
  return new Set(rows.map((r) => r.doctor_user_id));
}

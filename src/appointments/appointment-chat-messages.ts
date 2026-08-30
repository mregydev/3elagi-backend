import { In, Repository } from 'typeorm';
import { Appointment } from '../entities/appointment.entity';
import {
  AppointmentActionMeta,
  Message,
} from '../entities/message.entity';

export function appointmentIdFromMessage(row: Message): string | null {
  if (row.type !== 'appointment_action') return null;
  const meta = row.attachment_meta as AppointmentActionMeta | null | undefined;
  const id = meta?.appointment_id?.trim();
  return id || null;
}

export async function existingAppointmentIds(
  appointmentRepo: Repository<Appointment>,
  ids: string[],
): Promise<Set<string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Set();
  const rows = await appointmentRepo.find({
    where: { id: In(unique) },
    select: ['id'],
  });
  return new Set(rows.map((row) => row.id));
}

export async function deleteAppointmentActionMessages(
  messageRepo: Repository<Message>,
  appointmentIds: string[],
): Promise<void> {
  const ids = [...new Set(appointmentIds.filter(Boolean))];
  if (!ids.length) return;

  await messageRepo
    .createQueryBuilder()
    .delete()
    .from(Message)
    .where("type = 'appointment_action'")
    .andWhere("attachment_meta->>'appointment_id' IN (:...ids)", { ids })
    .execute();
}

/**
 * Hide appointment_action messages whose appointment row is gone, and delete
 * those orphaned rows so they do not reappear in chat or video lookups.
 */
export async function stripOrphanedAppointmentMessages(
  rows: Message[],
  appointmentRepo: Repository<Appointment>,
  messageRepo: Repository<Message>,
): Promise<Message[]> {
  const appointmentIds = rows
    .map(appointmentIdFromMessage)
    .filter((id): id is string => !!id);
  const existing = await existingAppointmentIds(
    appointmentRepo,
    appointmentIds,
  );

  const orphanAppointmentIds = [
    ...new Set(appointmentIds.filter((id) => !existing.has(id))),
  ];
  if (orphanAppointmentIds.length) {
    await deleteAppointmentActionMessages(messageRepo, orphanAppointmentIds);
  }

  return rows.filter((row) => {
    const apptId = appointmentIdFromMessage(row);
    if (!apptId) return true;
    return existing.has(apptId);
  });
}

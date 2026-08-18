/**
 * A change one side proposed that the other has to answer: a new slot for a
 * video appointment, or cancelling something already approved. Kept as one
 * JSON column so the two flows do not each need their own columns.
 */
export interface PendingChange {
  kind: 'reschedule' | 'cancel';
  /** User id who asked for it — only the other side may answer. */
  by: string;
  /** Reschedule: the proposed slot. */
  date?: string;
  time?: string;
  /** Cancel: why. */
  reason_type?: string;
  reason?: string;
}

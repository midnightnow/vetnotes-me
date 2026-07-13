import { adminDb } from '$lib/server/firebase-admin';
import { CpdGovernor } from '$lib/server/cpd_governor';

/**
 * Public CPD record verification (no auth). A third party (employer, regulator)
 * enters the Verification ID printed on a completion record and confirms it is
 * genuine. Reads via the admin SDK (bypasses client rules) and returns only the
 * fields needed to confirm the record — no attempt data, no answer keys.
 */
export const load = async ({ params }: any) => {
  const { recordId } = params;

  const snap = await adminDb.collection('cpd_attendance').doc(recordId).get();
  if (!snap.exists) return { valid: false, recordId };

  const a = snap.data() as any;
  if (!a.completed_at) return { valid: false, recordId };

  const sessionSnap = await adminDb.collection('cpd_sessions').doc(a.session_id).get();
  const session = sessionSnap.exists
    ? (sessionSnap.data() as any)
    : { title: 'CPD Activity', duration_minutes: 60 };

  let holder = 'Veterinary Practitioner';
  const userSnap = await adminDb.collection('users').doc(a.user_id).get();
  if (userSnap.exists && userSnap.data()?.displayName) holder = userSnap.data()!.displayName;

  // Tamper-evident audit trail: recompute the hash chain of the holder's ledger
  // events for this session's cases. Index-free (query by user_id equality, verify
  // in memory). Best-effort — never blocks the record.
  let audit: { events: number; chainIntact: boolean } | null = null;
  try {
    const sessionCaseIds: string[] = session.case_ids || [];
    if (sessionCaseIds.length > 0) {
      const ledgerSnap = await adminDb.collection('cpd_ledger').where('user_id', '==', a.user_id).get();
      const events = ledgerSnap.docs.map((d) => d.data()).filter((e) => sessionCaseIds.includes(e.case_id));
      if (events.length > 0) {
        const byAttempt = new Map<string, Array<Record<string, any>>>();
        for (const e of events) {
          const list = byAttempt.get(e.attempt_id) ?? [];
          list.push(e);
          byAttempt.set(e.attempt_id, list);
        }
        let chainIntact = true;
        for (const nodes of byAttempt.values()) {
          if (!CpdGovernor.verifyChainNodes(nodes).intact) chainIntact = false;
        }
        audit = { events: events.length, chainIntact };
      }
    }
  } catch {
    /* audit surface is best-effort */
  }

  return {
    valid: true,
    recordId,
    holder,
    module: session.title || 'CPD Activity',
    hours: (session.duration_minutes || 60) / 60,
    completedAt: a.completed_at,
    audit
  };
};

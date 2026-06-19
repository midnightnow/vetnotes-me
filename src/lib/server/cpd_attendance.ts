import { adminDb } from './firebase-admin';
import type { CPDAttendance, CPDSession } from '../types/cpd';

/**
 * Ensures a CPDAttendance record exists for the user and the session(s) containing this case.
 * Updates last_active_at.
 */
export async function trackAttendancePing(userId: string, caseId: string) {
  const timestamp = new Date().toISOString();
  
  // 1. Find sessions containing this case
  const sessionsSnap = await adminDb.collection('cpd_sessions')
    .where('case_ids', 'array-contains', caseId)
    .get();

  if (sessionsSnap.empty) return;

  for (const sessionDoc of sessionsSnap.docs) {
    const session = sessionDoc.data() as CPDSession;
    const attendanceId = `att_user_${userId}_sess_${session.id}`;
    const attendanceRef = adminDb.collection('cpd_attendance').doc(attendanceId);

    const attendanceSnap = await attendanceRef.get();

    if (!attendanceSnap.exists) {
      // Initialize new attendance record
      const newAttendance: CPDAttendance = {
        id: attendanceId,
        user_id: userId,
        session_id: session.id,
        started_at: timestamp,
        last_active_at: timestamp,
        completed_at: null,
        completed_case_ids: [],
        completion_percentage: 0
      };
      await attendanceRef.set(newAttendance);
    } else {
      // Update last active ping
      await attendanceRef.update({
        last_active_at: timestamp
      });
    }
  }
}

/**
 * Marks a case as completed within its parent session(s).
 * Updates completion percentage and completed_at if all cases are done.
 */
export async function markCaseCompleted(userId: string, caseId: string) {
  const timestamp = new Date().toISOString();
  
  // 1. Find sessions containing this case
  const sessionsSnap = await adminDb.collection('cpd_sessions')
    .where('case_ids', 'array-contains', caseId)
    .get();

  if (sessionsSnap.empty) return;

  for (const sessionDoc of sessionsSnap.docs) {
    const session = sessionDoc.data() as CPDSession;
    const attendanceId = `att_user_${userId}_sess_${session.id}`;
    const attendanceRef = adminDb.collection('cpd_attendance').doc(attendanceId);

    await adminDb.runTransaction(async (transaction) => {
      const attendanceSnap = await transaction.get(attendanceRef);
      if (!attendanceSnap.exists) return; // Should have been initialized by start

      const attendance = attendanceSnap.data() as CPDAttendance;
      
      // Add caseId if not already present
      if (!attendance.completed_case_ids.includes(caseId)) {
        const updatedCases = [...attendance.completed_case_ids, caseId];
        const percentage = Math.round((updatedCases.length / session.case_ids.length) * 100);
        const isFullyCompleted = updatedCases.length >= session.case_ids.length;

        transaction.update(attendanceRef, {
          completed_case_ids: updatedCases,
          completion_percentage: percentage,
          last_active_at: timestamp,
          completed_at: isFullyCompleted ? timestamp : attendance.completed_at
        });
      }
    });
  }
}

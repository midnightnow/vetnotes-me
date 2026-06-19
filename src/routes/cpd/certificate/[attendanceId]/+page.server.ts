import { error } from '@sveltejs/kit';
import { adminDb } from '$lib/server/firebase-admin';

export const load = async ({ params, locals }: any) => {
  const userId = locals.user?.uid;
  if (!userId) throw error(401, 'Unauthorized');

  const { attendanceId } = params;
  const attendanceSnap = await adminDb.collection('cpd_attendance').doc(attendanceId).get();

  if (!attendanceSnap.exists) throw error(404, 'Attendance record not found');
  
  const attendance = attendanceSnap.data();
  if (attendance?.user_id !== userId) throw error(403, 'Forbidden');
  if (!attendance?.completed_at) throw error(400, 'Module not completed');

  // Fetch session details for the certificate
  const sessionSnap = await adminDb.collection('cpd_sessions').doc(attendance.session_id).get();
  const session = sessionSnap.exists ? sessionSnap.data() : { title: 'Clinical Module', duration_minutes: 60 };

  return {
    attendance: {
      ...attendance,
      id: attendanceSnap.id
    },
    session,
    user: locals.user
  };
};

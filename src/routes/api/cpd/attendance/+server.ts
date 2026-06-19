import { error, json } from '@sveltejs/kit';
import { adminDb } from '$lib/server/firebase-admin';

export const GET = async ({ locals }: any) => {
  const userId = locals.user?.uid;
  if (!userId) throw error(401, 'Unauthorized');

  try {
    const attendanceSnap = await adminDb.collection('cpd_attendance')
      .where('user_id', '==', userId)
      .get();

    const attendance = attendanceSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return json({ attendance });
  } catch (err: any) {
    console.error('Error fetching attendance:', err);
    throw error(500, 'Internal Server Error');
  }
};

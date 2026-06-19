import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ensureAuditModuleExists } from '$lib/server/cpd_seed';

export const POST: RequestHandler = async () => {
  try {
    await ensureAuditModuleExists();
    return json({ success: true });
  } catch (error) {
    console.error('Failed to seed CPD module', error);
    return json({ success: false, error: 'Failed to seed CPD module' }, { status: 500 });
  }
};

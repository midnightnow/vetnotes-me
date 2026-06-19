import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminDb } from '$lib/server/firebase-admin';
import { extractMetadataBlock, validateMetadata, computeQuality, generateDiagnosticTriggers } from '$lib/server/derm_pipeline';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    throw error(401, 'Unauthorized');
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.llmOutput !== 'string') {
    throw error(400, 'llmOutput is required');
  }

  const metadataBlock = extractMetadataBlock(body.llmOutput);
  if (!metadataBlock) {
    return json({
      success: false,
      validation: { valid: false, errors: ['Missing <derm_metadata_json> block'] },
      quality: null,
      triggers: null,
      rawBlock: null
    });
  }

  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(metadataBlock);
  } catch (err) {
    return json({
      success: false,
      validation: { valid: false, errors: [err instanceof Error ? err.message : 'Invalid JSON'] },
      quality: null,
      triggers: null,
      rawBlock: metadataBlock
    });
  }

  const validation = validateMetadata(parsed);
  const quality = computeQuality(parsed);
  const triggers = generateDiagnosticTriggers(parsed);

  return json({
    success: true,
    validation,
    quality,
    triggers,
    rawBlock: metadataBlock
  });
};

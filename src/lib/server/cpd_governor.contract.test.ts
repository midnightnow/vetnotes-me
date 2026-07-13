import { describe, it, expect } from 'vitest';
import { CpdGovernor, type CpdEventNamespace } from '$lib/server/cpd_governor';

// Build a valid hash-chained ledger the same way safeLog does.
function buildChain(events: Array<{ event_type: CpdEventNamespace; timestamp: string; mutations?: any }>) {
  const nodes: Array<Record<string, any>> = [];
  let prev = CpdGovernor.GENESIS_HASH;
  for (const e of events) {
    const payload = {
      attempt_id: 'att_1',
      user_id: 'user_1',
      case_id: 'case_1',
      event_type: e.event_type,
      timestamp: e.timestamp,
      mutations: e.mutations ?? {}
    };
    const current = CpdGovernor.calculateNodeHash(prev, payload);
    nodes.push({ ...payload, previous_event_hash: prev, current_event_hash: current, attempt_version: 1 });
    prev = current;
  }
  return nodes;
}

const LIFECYCLE: Array<{ event_type: CpdEventNamespace; timestamp: string }> = [
  { event_type: 'CPD_EVENT:ATTEMPT:STARTED', timestamp: '2026-07-12T10:00:00.000Z' },
  { event_type: 'CPD_EVENT:REASONING:SUBMITTED', timestamp: '2026-07-12T10:03:00.000Z' },
  { event_type: 'CPD_EVENT:AI:REVEALED', timestamp: '2026-07-12T10:05:00.000Z' },
  { event_type: 'CPD_EVENT:COMPARISON:CALIBRATED', timestamp: '2026-07-12T10:07:00.000Z' },
  { event_type: 'CPD_EVENT:ASSESSMENT:COMPLETED', timestamp: '2026-07-12T10:09:00.000Z' },
  { event_type: 'CPD_EVENT:CREDENTIAL:ISSUED', timestamp: '2026-07-12T10:10:00.000Z' }
];

describe('CpdGovernor hash-chain ledger', () => {
  it('verifies an intact full-lifecycle chain', () => {
    const r = CpdGovernor.verifyChainNodes(buildChain(LIFECYCLE));
    expect(r).toEqual({ intact: true, count: 6 });
  });

  it('is order-independent (Firestore returns docs unordered)', () => {
    const nodes = buildChain(LIFECYCLE);
    const shuffled = [...nodes].reverse();
    expect(CpdGovernor.verifyChainNodes(shuffled)).toEqual({ intact: true, count: 6 });
  });

  it('detects tampering with any node payload', () => {
    const nodes = buildChain(LIFECYCLE);
    nodes[2].mutations = { forged: true }; // alter a middle node
    const r = CpdGovernor.verifyChainNodes(nodes);
    expect(r.intact).toBe(false);
  });

  it('detects a re-hashed node whose predecessor no longer matches', () => {
    const nodes = buildChain(LIFECYCLE);
    // Recompute node 3's hash for tampered content — breaks the link to node 4.
    nodes[3].current_event_hash = CpdGovernor.calculateNodeHash(nodes[3].previous_event_hash, {
      ...nodes[3],
      mutations: { forged: true }
    });
    expect(CpdGovernor.verifyChainNodes(nodes).intact).toBe(false);
  });

  it('treats an empty ledger as intact (nothing to verify)', () => {
    expect(CpdGovernor.verifyChainNodes([])).toEqual({ intact: true, count: 0 });
  });
});

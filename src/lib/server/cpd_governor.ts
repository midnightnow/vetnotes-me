/**
 * CPD Governor — The sole authorized interface for CPD state mutation.
 * 
 * This module wraps all CPD state transitions with:
 * 1. State machine validation (via CPDStateMachine)
 * 2. Append-only, hash-chained audit ledger writes
 * 3. IP masking for GDPR/APP compliance
 * 
 * NO CPD state mutation may occur outside this module.
 * Any direct `transaction.update(attemptRef, ...)` without going through
 * CpdGovernor is a compliance violation.
 */

import { error } from '@sveltejs/kit';
import type { CPDAttempt, CPDStep } from '$lib/types/cpd';
import { CPDStateMachine } from './cpd_state_machine';
import * as crypto from 'crypto';

// ==========================================
// EVENT TAXONOMY (Hierarchical Namespace)
// ==========================================
export type CpdEventNamespace =
  | 'CPD_EVENT:ATTEMPT:STARTED'
  | 'CPD_EVENT:REASONING:SUBMITTED'
  | 'CPD_EVENT:AI:REVEALED'
  | 'CPD_EVENT:COMPARISON:CALIBRATED'
  | 'CPD_EVENT:ASSESSMENT:COMPLETED'
  | 'CPD_EVENT:CREDENTIAL:ISSUED';

// Maps target step to the event that should be logged
export const STEP_EVENT_MAP: Record<CPDStep, CpdEventNamespace> = {
  'STEP_1_INTAKE': 'CPD_EVENT:ATTEMPT:STARTED',
  'STEP_2_REASONING': 'CPD_EVENT:REASONING:SUBMITTED',
  'STEP_3_REVEAL': 'CPD_EVENT:AI:REVEALED',
  'STEP_4_COMPARISON': 'CPD_EVENT:COMPARISON:CALIBRATED',
  'STEP_5_QUIZ': 'CPD_EVENT:ASSESSMENT:COMPLETED',
  'COMPLETED': 'CPD_EVENT:ASSESSMENT:COMPLETED'
};

export class CpdGovernor {
  /**
   * Calculates the secure SHA-256 block hash of the current ledger node.
   * This creates a tamper-evident chain: if any record is modified,
   * all subsequent hashes will fail verification.
   */
  static calculateNodeHash(previousHash: string, data: Record<string, any>): string {
    const serializedPayload = JSON.stringify(data);
    return crypto.createHash('sha256').update(previousHash + serializedPayload).digest('hex');
  }

  /**
   * Anonymizes network telemetry to satisfy GDPR/APP privacy compliance.
   * Hashes the IP address instead of storing raw PII.
   */
  static maskIpAddress(ip?: string): string {
    if (!ip) return 'unknown.masked';
    return crypto.createHash('md5').update(ip).digest('hex') + '.masked';
  }

  /**
   * The single, authoritative entry point to mutate CPD State.
   * 
   * This transactionally binds:
   * - State machine validation
   * - Attempt document update
   * - Immutable, hash-chained ledger write
   * 
   * @param transaction - Active Firestore transaction
   * @param db - Firestore instance
   * @param attemptRef - Reference to the CPDAttempt document
   * @param attempt - Current attempt state (read inside transaction)
   * @param targetStep - The step we are transitioning TO
   * @param eventNamespace - The audit event type being logged
   * @param mutationPayload - Fields to write on the attempt document
   * @param clientIp - Optional client IP (will be hashed)
   * @param userAgent - Optional user agent string
   */
  static async executeStateTransition(
    transaction: FirebaseFirestore.Transaction,
    db: FirebaseFirestore.Firestore,
    attemptRef: FirebaseFirestore.DocumentReference,
    attempt: CPDAttempt,
    targetStep: CPDStep,
    eventNamespace: CpdEventNamespace,
    mutationPayload: Record<string, any>,
    clientIp?: string,
    userAgent?: string
  ): Promise<void> {
    // 1. Run State Machine Validation (Invariant Checks)
    CPDStateMachine.transition(attempt, targetStep);

    // 2. Fetch the latest ledger node to obtain the previous hash block
    const ledgerCollection = db.collection('cpd_ledger');
    const latestNodeQuery = ledgerCollection
      .where('attempt_id', '==', attempt.id)
      .orderBy('timestamp', 'desc')
      .limit(1);

    const latestNodeSnap = await transaction.get(latestNodeQuery);

    // Genesis block hash (used when no prior events exist)
    let previousHash = '0000000000000000000000000000000000000000000000000000000000000000';
    if (!latestNodeSnap.empty) {
      previousHash = latestNodeSnap.docs[0].data().current_event_hash;
    }

    // 3. Prepare Ledger Data Node
    const ledgerDocRef = ledgerCollection.doc();
    const timestamp = new Date().toISOString();

    const eventPayload = {
      attempt_id: attempt.id,
      user_id: attempt.user_id,
      case_id: attempt.case_id,
      event_type: eventNamespace,
      timestamp,
      mutations: {
        ...mutationPayload,
        current_step: targetStep
      }
    };

    const currentHash = this.calculateNodeHash(previousHash, eventPayload);

    // Calculate elapsed time since attempt start
    const startTime = new Date(attempt.started_at).getTime();
    const elapsedMs = Date.now() - startTime;

    const ledgerNode = {
      id: ledgerDocRef.id,
      ...eventPayload,
      attempt_version: attempt.attempt_version,
      previous_event_hash: previousHash,
      current_event_hash: currentHash,
      metadata: {
        ip_masked: this.maskIpAddress(clientIp),
        user_agent: userAgent || 'Unknown',
        elapsed_seconds_since_start: Math.round(elapsedMs / 1000),
        system_time_ms: Date.now()
      }
    };

    // 4. Atomic Write Commit (Attempt State Update + Ledger Node Appended)
    transaction.update(attemptRef, {
      ...mutationPayload,
      current_step: targetStep
    });

    transaction.set(ledgerDocRef, ledgerNode);
  }

  /**
   * Writes a standalone ledger event without mutating attempt state.
   * Used for events like CERTIFICATE_ISSUED that happen post-commit.
   */
  static readonly GENESIS_HASH = '0'.repeat(64);

  /**
   * Non-throwing, index-free ledger append. Used to turn the audit trail ON at
   * each lifecycle step WITHOUT restructuring the critical scoring transaction:
   * a ledger failure must never break the learner's flow, so this swallows errors.
   * Index-free: queries by attempt_id equality only (auto-indexed) and orders the
   * few per-attempt events in memory.
   */
  static async safeLog(
    db: FirebaseFirestore.Firestore,
    attemptId: string,
    userId: string,
    caseId: string,
    attemptVersion: number,
    eventNamespace: CpdEventNamespace,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      const ledger = db.collection('cpd_ledger');
      const snap = await ledger.where('attempt_id', '==', attemptId).get();
      let previousHash = this.GENESIS_HASH;
      if (!snap.empty) {
        // Follow the hash linkage to find the current tail (order-independent of timestamp).
        const nodes = snap.docs.map((d) => d.data());
        const prevSet = new Set(nodes.map((n) => n.previous_event_hash));
        const tail = nodes.find((n) => !prevSet.has(n.current_event_hash));
        previousHash = tail?.current_event_hash || nodes[nodes.length - 1].current_event_hash;
      }
      const timestamp = new Date().toISOString();
      const eventPayload = {
        attempt_id: attemptId,
        user_id: userId,
        case_id: caseId,
        event_type: eventNamespace,
        timestamp,
        mutations: metadata
      };
      const currentHash = this.calculateNodeHash(previousHash, eventPayload);
      const ref = ledger.doc();
      await ref.set({
        id: ref.id,
        ...eventPayload,
        attempt_version: attemptVersion,
        previous_event_hash: previousHash,
        current_event_hash: currentHash
      });
    } catch (e) {
      console.warn('[CpdGovernor] ledger append failed (non-fatal):', (e as Error).message);
    }
  }

  /**
   * Pure chain verifier (no I/O) — walks the linked list from genesis, recomputes
   * every node hash, and confirms all nodes are reachable. `intact` is false if any
   * hash was altered or a node is unreachable (tamper detection). Unit-testable.
   */
  static verifyChainNodes(nodes: Array<Record<string, any>>): { intact: boolean; count: number } {
    if (nodes.length === 0) return { intact: true, count: 0 };
    const byPrev = new Map<string, Record<string, any>>();
    for (const n of nodes) byPrev.set(n.previous_event_hash, n);
    let prev = this.GENESIS_HASH;
    let count = 0;
    let node = byPrev.get(prev);
    while (node) {
      const recomputed = this.calculateNodeHash(prev, {
        attempt_id: node.attempt_id,
        user_id: node.user_id,
        case_id: node.case_id,
        event_type: node.event_type,
        timestamp: node.timestamp,
        mutations: node.mutations
      });
      if (recomputed !== node.current_event_hash) return { intact: false, count };
      count++;
      prev = node.current_event_hash;
      node = byPrev.get(prev);
    }
    return { intact: count === nodes.length, count };
  }

  /** Fetch + verify an attempt's ledger chain (index-free). */
  static async verifyChain(
    db: FirebaseFirestore.Firestore,
    attemptId: string
  ): Promise<{ intact: boolean; count: number }> {
    const snap = await db.collection('cpd_ledger').where('attempt_id', '==', attemptId).get();
    return this.verifyChainNodes(snap.docs.map((d) => d.data()));
  }

  static async writeStandaloneEvent(
    db: FirebaseFirestore.Firestore,
    attemptId: string,
    userId: string,
    caseId: string,
    attemptVersion: number,
    eventNamespace: CpdEventNamespace,
    metadata: Record<string, any>
  ): Promise<string> {
    const ledgerCollection = db.collection('cpd_ledger');

    // Fetch latest hash for chain continuity
    const latestNodeQuery = await ledgerCollection
      .where('attempt_id', '==', attemptId)
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();

    let previousHash = '0000000000000000000000000000000000000000000000000000000000000000';
    if (!latestNodeQuery.empty) {
      previousHash = latestNodeQuery.docs[0].data().current_event_hash;
    }

    const ledgerDocRef = ledgerCollection.doc();
    const timestamp = new Date().toISOString();

    const eventPayload = {
      attempt_id: attemptId,
      user_id: userId,
      case_id: caseId,
      event_type: eventNamespace,
      timestamp,
      mutations: metadata
    };

    const currentHash = this.calculateNodeHash(previousHash, eventPayload);

    const ledgerNode = {
      id: ledgerDocRef.id,
      ...eventPayload,
      attempt_version: attemptVersion,
      previous_event_hash: previousHash,
      current_event_hash: currentHash,
      metadata: {
        ...metadata,
        system_time_ms: Date.now()
      }
    };

    await ledgerDocRef.set(ledgerNode);
    return ledgerDocRef.id;
  }
}

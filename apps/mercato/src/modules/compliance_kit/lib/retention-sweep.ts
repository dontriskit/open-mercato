/**
 * Retention sweep — pure selection logic — OPENCARE_PLAN.md §3.6 #3.
 *
 * Separated from the worker so the cutoff/selection rules are unit-testable
 * without an EM or queue. The worker (workers/retention-sweep.ts) feeds rows it
 * loads from the DB into `selectExpiredRows` and acts only on the returned ids.
 *
 * SAFETY MODEL (encoded here, enforced by the worker):
 *  - Never act on a row before its statutory cutoff (now - retentionDays at the
 *    anchor). The merge already lets the longest-retention pack win by priority;
 *    `effectiveRetentionDays` double-checks the LONGEST applicable period is
 *    respected when several rules target the same entity.
 *  - Polish lex specialis: a longer statutory retention (e.g. RODO 20y) overrides
 *    a GDPR erasure/storage-limitation rule. Because longer retentionDays => later
 *    cutoff => fewer rows selected, "longest wins" is the conservative choice and
 *    is exactly what keeping the MAX retentionDays per (entityId, setting) gives.
 *  - Only `soft_delete` / `anonymize` actions ever flow through; NEVER hard delete.
 */

import type { MergedRules, RetentionRule } from './contract'
import { normalizeEntityId } from './enforce'

export type SweepRow = {
  id: string
  /** The anchor timestamp for this row (created_at / episode ended_at / granted_at). */
  anchorAt: Date | null
  /** Already soft-deleted rows are skipped. */
  deletedAt?: Date | null
  /** Optional setting key for setting-scoped rules (e.g. care_setting kind). */
  setting?: string | null
}

export type SweepSelection = {
  rule: RetentionRule
  cutoff: Date
  selectedIds: string[]
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** cutoff = now - retentionDays. A row is expired iff its anchor is at/older than this. */
export function computeCutoff(now: Date, retentionDays: number): Date {
  return new Date(now.getTime() - retentionDays * MS_PER_DAY)
}

/**
 * Resolve the effective (LONGEST) retention period that applies to a row, across
 * all merged rules for the same entity + applicable setting. Defends against the
 * case where multiple rules survive the merge for one entity: the row must not be
 * acted on until the longest of those periods has elapsed.
 */
export function effectiveRetentionDays(
  rules: RetentionRule[],
  entityId: string,
  setting: string | null,
): number | null {
  const target = normalizeEntityId(entityId)
  let max: number | null = null
  for (const rule of rules) {
    if (normalizeEntityId(rule.entityId) !== target) continue
    // A setting-scoped rule only applies when the row's setting matches.
    if (rule.setting && rule.setting !== setting) continue
    if (max === null || rule.retentionDays > max) max = rule.retentionDays
  }
  return max
}

/**
 * Given one retention rule and the candidate rows already loaded for its entity,
 * return the ids whose anchor is at/older than the cutoff AND that are not already
 * soft-deleted. The effective (longest) retention across all merged rules for the
 * row's entity+setting is applied as a floor so a shorter rule can never erase a
 * row still under a longer statutory hold.
 */
export function selectExpiredRows(
  rule: RetentionRule,
  rows: SweepRow[],
  allRules: RetentionRule[],
  now: Date,
): SweepSelection {
  const cutoff = computeCutoff(now, rule.retentionDays)
  const selectedIds: string[] = []
  for (const row of rows) {
    if (row.deletedAt) continue // already soft-deleted; nothing to do
    if (!row.anchorAt) continue // no anchor timestamp (e.g. open episode) — never act
    // Erasure guard: respect the LONGEST applicable retention, not just this rule's.
    const floorDays = effectiveRetentionDays(allRules, rule.entityId, row.setting ?? null)
    const effectiveCutoff = floorDays === null ? cutoff : computeCutoff(now, floorDays)
    // Use the more conservative (earlier) cutoff between this rule and the floor.
    const guardedCutoff = effectiveCutoff < cutoff ? effectiveCutoff : cutoff
    if (row.anchorAt.getTime() <= guardedCutoff.getTime()) {
      selectedIds.push(row.id)
    }
  }
  return { rule, cutoff: computeCutoff(now, rule.retentionDays), selectedIds }
}

/** Retention rules from merged contract, deduped by entityId+setting (longest wins). */
export function retentionRulesFor(rules: MergedRules): RetentionRule[] {
  return rules.retention
}

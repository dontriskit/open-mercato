import { describe, it, expect } from '@jest/globals'
import {
  computeCutoff,
  effectiveRetentionDays,
  selectExpiredRows,
  type SweepRow,
} from '../lib/retention-sweep'
import type { RetentionRule } from '../lib/contract'

const MS_PER_DAY = 24 * 60 * 60 * 1000
const NOW = new Date('2026-06-08T00:00:00.000Z')

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * MS_PER_DAY)
}

// RODO care_note rule: 20 years (7305 days), anchor episode_ended_at, soft_delete.
const rodoNoteRule: RetentionRule = {
  entityId: 'opencare:care_note',
  retentionDays: 7305,
  anchor: 'episode_ended_at',
  action: 'soft_delete',
  legalRef: 'Ustawa o prawach pacjenta art. 29 ust. 1 — 20 lat',
}

// GDPR baseline care_note rule: ~7 years (2555 days), same anchor.
const gdprNoteRule: RetentionRule = {
  entityId: 'opencare:care_note',
  retentionDays: 2555,
  anchor: 'episode_ended_at',
  action: 'soft_delete',
  legalRef: 'GDPR Art. 5(1)(e)',
}

describe('retention-sweep selection logic', () => {
  it('computes cutoff = now - retentionDays', () => {
    const cutoff = computeCutoff(NOW, 7305)
    expect(cutoff.getTime()).toBe(NOW.getTime() - 7305 * MS_PER_DAY)
  })

  it('selects only rows whose anchor is at/older than the cutoff', () => {
    const rows: SweepRow[] = [
      { id: 'old', anchorAt: daysAgo(7400), deletedAt: null }, // older than 7305 → selected
      { id: 'exactly', anchorAt: daysAgo(7305), deletedAt: null }, // == cutoff → selected (<=)
      { id: 'recent', anchorAt: daysAgo(100), deletedAt: null }, // newer → not selected
    ]
    const { selectedIds } = selectExpiredRows(rodoNoteRule, rows, [rodoNoteRule], NOW)
    expect(selectedIds.sort()).toEqual(['exactly', 'old'])
  })

  it('skips already soft-deleted rows', () => {
    const rows: SweepRow[] = [
      { id: 'gone', anchorAt: daysAgo(8000), deletedAt: daysAgo(1) },
      { id: 'live', anchorAt: daysAgo(8000), deletedAt: null },
    ]
    const { selectedIds } = selectExpiredRows(rodoNoteRule, rows, [rodoNoteRule], NOW)
    expect(selectedIds).toEqual(['live'])
  })

  it('never selects a row with a null anchor (e.g. open episode)', () => {
    const rows: SweepRow[] = [{ id: 'open', anchorAt: null, deletedAt: null }]
    const { selectedIds } = selectExpiredRows(rodoNoteRule, rows, [rodoNoteRule], NOW)
    expect(selectedIds).toEqual([])
  })

  it('erasure guard: longest retention (RODO 20y) overrides shorter GDPR rule (lex specialis)', () => {
    // A note whose episode ended 10 years (3653d) ago: past the GDPR 7y cutoff
    // but still within the RODO 20y hold. The shorter GDPR rule must NOT erase it.
    const rows: SweepRow[] = [{ id: 'within-rodo-hold', anchorAt: daysAgo(3653), deletedAt: null }]
    // Both rules merged/active for the entity; evaluate the GDPR (shorter) rule.
    const { selectedIds } = selectExpiredRows(gdprNoteRule, rows, [gdprNoteRule, rodoNoteRule], NOW)
    expect(selectedIds).toEqual([]) // blocked by the longer RODO floor
  })

  it('effectiveRetentionDays returns the MAX applicable period for an entity', () => {
    const max = effectiveRetentionDays([gdprNoteRule, rodoNoteRule], 'opencare:care_note', null)
    expect(max).toBe(7305)
  })

  it('honors setting-scoped rules only when the row setting matches', () => {
    const settingRule: RetentionRule = {
      entityId: 'opencare:care_episode',
      setting: 'clinic',
      retentionDays: 10957,
      anchor: 'episode_ended_at',
      action: 'soft_delete',
    }
    // A clinic-setting floor of 30y must not apply to a home-setting row.
    expect(effectiveRetentionDays([settingRule], 'opencare:care_episode', 'home')).toBeNull()
    expect(effectiveRetentionDays([settingRule], 'opencare:care_episode', 'clinic')).toBe(10957)
  })

  it('dry-run is a pure plan: selection produces ids only, never mutates rows', () => {
    const anchorAt = daysAgo(9000)
    const rows: SweepRow[] = [{ id: 'old', anchorAt, deletedAt: null }]
    const result = selectExpiredRows(rodoNoteRule, rows, [rodoNoteRule], NOW)
    expect(result.selectedIds).toEqual(['old'])
    // selectExpiredRows must not have touched the input rows (no write side effect):
    // field values are unchanged and no deletedAt was stamped.
    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual({ id: 'old', anchorAt, deletedAt: null })
    expect(rows[0].anchorAt).toBe(anchorAt)
  })
})

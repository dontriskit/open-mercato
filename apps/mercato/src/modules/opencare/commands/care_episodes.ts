import type { CommandHandler, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import {
  emitCrudSideEffects,
  emitCrudUndoSideEffects,
  buildChanges,
  requireId,
} from '@open-mercato/shared/lib/commands/helpers'
import type { CrudEmitContext, CrudEventsConfig, CrudIndexerConfig } from '@open-mercato/shared/lib/crud/types'
import { makeCreateRedo } from '@open-mercato/shared/lib/commands/redo'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { CareEpisode } from '../data/entities'
import { careEpisodeCreateSchema, careEpisodeUpdateSchema } from '../data/validators'

const ENTITY_ID = 'opencare:care_episode' as const

type Serialized = {
  id: string
  care_recipient_id: string
  care_setting_id: string
  responsible_staff_id: string | null
  started_at: string | null
  ended_at: string | null
  diagnosis_summary: string | null
  tenantId: string | null
  organizationId: string | null
}

export const careEpisodeCrudEvents: CrudEventsConfig<CareEpisode> = {
  module: 'opencare',
  entity: 'care_episode',
  persistent: true,
  buildPayload: (ctx: CrudEmitContext<CareEpisode>) => ({
    id: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
    careRecipientId: ctx.entity?.careRecipientId ?? null,
    ...(ctx.syncOrigin ? { syncOrigin: ctx.syncOrigin } : {}),
  }),
}

export const careEpisodeCrudIndexer: CrudIndexerConfig<CareEpisode> = {
  entityType: ENTITY_ID,
  buildUpsertPayload: (ctx: CrudEmitContext<CareEpisode>) => ({
    entityType: ENTITY_ID,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
  buildDeletePayload: (ctx: CrudEmitContext<CareEpisode>) => ({
    entityType: ENTITY_ID,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
}

function ensureScope(ctx: CommandRuntimeContext): { tenantId: string; organizationId: string } {
  const tenantId = ctx.auth?.tenantId ?? null
  if (!tenantId) throw new CrudHttpError(400, { error: 'Tenant context is required' })
  const organizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  if (!organizationId) throw new CrudHttpError(400, { error: 'Organization context is required' })
  return { tenantId, organizationId }
}

function resolveUndoScope(
  ctx: CommandRuntimeContext,
  snapshot?: { tenantId: string | null; organizationId: string | null },
): { tenantId: string; organizationId: string } {
  const scope = ensureScope(ctx)
  const tenantId = snapshot?.tenantId ?? scope.tenantId
  if (tenantId !== scope.tenantId) {
    throw new CrudHttpError(403, { error: 'Undo scope does not match tenant' })
  }
  let organizationId = scope.organizationId
  if (snapshot?.organizationId) {
    const allowed = Array.isArray(ctx.organizationIds) ? ctx.organizationIds : null
    if (allowed && allowed.length > 0 && !allowed.includes(snapshot.organizationId)) {
      throw new CrudHttpError(403, { error: 'Undo scope is not permitted for this organization' })
    }
    organizationId = snapshot.organizationId
  }
  return { tenantId, organizationId }
}

function emptyToNull(v: unknown): string | null {
  if (v === undefined || v === null) return null
  const s = String(v)
  return s.length > 0 ? s : null
}

function toDate(v: unknown): Date | null {
  const s = emptyToNull(v)
  return s ? new Date(s) : null
}

function serialize(r: CareEpisode): Serialized {
  return {
    id: String(r.id),
    care_recipient_id: String(r.careRecipientId),
    care_setting_id: String(r.careSettingId),
    responsible_staff_id: r.responsibleStaffId ?? null,
    started_at: r.startedAt ? new Date(r.startedAt).toISOString() : null,
    ended_at: r.endedAt ? new Date(r.endedAt).toISOString() : null,
    diagnosis_summary: r.diagnosisSummary ?? null,
    tenantId: r.tenantId ? String(r.tenantId) : null,
    organizationId: r.organizationId ? String(r.organizationId) : null,
  }
}

function seedFromSnapshot(s: Serialized): Record<string, unknown> {
  return {
    id: s.id,
    careRecipientId: s.care_recipient_id,
    careSettingId: s.care_setting_id,
    responsibleStaffId: s.responsible_staff_id,
    startedAt: s.started_at ? new Date(s.started_at) : new Date(),
    endedAt: s.ended_at ? new Date(s.ended_at) : null,
    diagnosisSummary: s.diagnosis_summary,
    tenantId: s.tenantId,
    organizationId: s.organizationId,
  }
}

const createCommand: CommandHandler<Record<string, unknown>, CareEpisode> = {
  id: 'opencare.care_episodes.create',
  isUndoable: true,
  async execute(rawInput, ctx) {
    const parsed = careEpisodeCreateSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const entity = await de.createOrmEntity({
      entity: CareEpisode,
      data: {
        ...(parsed.id ? { id: parsed.id } : {}),
        careRecipientId: parsed.care_recipient_id,
        careSettingId: parsed.care_setting_id,
        responsibleStaffId: emptyToNull(parsed.responsible_staff_id),
        startedAt: toDate(parsed.started_at) ?? new Date(),
        endedAt: toDate(parsed.ended_at),
        diagnosisSummary: emptyToNull(parsed.diagnosis_summary),
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'created',
      entity,
      identifiers: { id: String(entity.id), tenantId: scope.tenantId, organizationId: scope.organizationId },
      syncOrigin: ctx.syncOrigin,
      events: careEpisodeCrudEvents,
      indexer: careEpisodeCrudIndexer,
    })
    return entity
  },
  captureAfter: (_input, result) => serialize(result),
  buildLog: async ({ result }) => {
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('opencare.audit.care_episodes.create', 'Create care episode'),
      resourceKind: 'opencare.care_episode',
      resourceId: String(result.id),
      tenantId: result.tenantId ? String(result.tenantId) : null,
      organizationId: result.organizationId ? String(result.organizationId) : null,
      snapshotAfter: serialize(result),
    }
  },
  async undo({ logEntry, ctx }) {
    const snapshot = logEntry.snapshotAfter as Serialized | undefined
    const id = snapshot?.id ?? logEntry.resourceId
    if (!id) throw new Error('Missing care episode id for undo')
    const scope = resolveUndoScope(ctx, snapshot)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const removed = await de.deleteOrmEntity({
      entity: CareEpisode,
      where: { id, tenantId: scope.tenantId, organizationId: scope.organizationId } as FilterQuery<CareEpisode>,
      soft: true,
      softDeleteField: 'deletedAt',
    })
    await emitCrudUndoSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: removed,
      identifiers: { id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      syncOrigin: ctx.syncOrigin,
      events: careEpisodeCrudEvents,
      indexer: careEpisodeCrudIndexer,
    })
  },
  redo: makeCreateRedo<CareEpisode, Serialized, Record<string, unknown>, CareEpisode>({
    entityClass: CareEpisode,
    getSnapshotId: (snapshot) => snapshot.id,
    seedFromSnapshot,
    buildResult: (entity) => entity,
    events: careEpisodeCrudEvents,
    indexer: careEpisodeCrudIndexer,
  }),
}

const updateCommand: CommandHandler<Record<string, unknown>, CareEpisode> = {
  id: 'opencare.care_episodes.update',
  isUndoable: true,
  async prepare(rawInput, ctx) {
    const parsed = careEpisodeUpdateSchema.parse(rawInput)
    const em = ctx.container.resolve('em') as EntityManager
    const existing = await em.findOne(CareEpisode, { id: parsed.id, deletedAt: null } as FilterQuery<CareEpisode>)
    if (!existing) throw new CrudHttpError(404, { error: 'Care episode not found' })
    return { before: serialize(existing) }
  },
  async execute(rawInput, ctx) {
    const parsed = careEpisodeUpdateSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const entity = await de.updateOrmEntity({
      entity: CareEpisode,
      where: {
        id: parsed.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<CareEpisode>,
      apply: (e) => {
        if (parsed.care_recipient_id !== undefined) e.careRecipientId = parsed.care_recipient_id
        if (parsed.care_setting_id !== undefined) e.careSettingId = parsed.care_setting_id
        if (parsed.responsible_staff_id !== undefined) e.responsibleStaffId = emptyToNull(parsed.responsible_staff_id)
        if (parsed.started_at !== undefined) e.startedAt = toDate(parsed.started_at) ?? e.startedAt
        if (parsed.ended_at !== undefined) e.endedAt = toDate(parsed.ended_at)
        if (parsed.diagnosis_summary !== undefined) e.diagnosisSummary = emptyToNull(parsed.diagnosis_summary)
      },
    })
    if (!entity) throw new CrudHttpError(404, { error: 'Care episode not found' })
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'updated',
      entity,
      identifiers: { id: String(entity.id), tenantId: scope.tenantId, organizationId: scope.organizationId },
      syncOrigin: ctx.syncOrigin,
      events: careEpisodeCrudEvents,
      indexer: careEpisodeCrudIndexer,
    })
    return entity
  },
  captureAfter: (_input, result) => serialize(result),
  buildLog: async ({ result, snapshots }) => {
    const { translate } = await resolveTranslations()
    const before = snapshots.before as Serialized | undefined
    const after = serialize(result)
    const changes = buildChanges(before ?? null, after as unknown as Record<string, unknown>, [
      'care_recipient_id', 'care_setting_id', 'responsible_staff_id', 'started_at', 'ended_at', 'diagnosis_summary',
    ])
    return {
      actionLabel: translate('opencare.audit.care_episodes.update', 'Update care episode'),
      resourceKind: 'opencare.care_episode',
      resourceId: String(result.id),
      tenantId: result.tenantId ? String(result.tenantId) : null,
      organizationId: result.organizationId ? String(result.organizationId) : null,
      changes,
      snapshotBefore: before ?? null,
      snapshotAfter: after,
    }
  },
  async undo({ logEntry, ctx }) {
    const before = logEntry.snapshotBefore as Serialized | undefined
    if (!before?.id) throw new Error('Missing previous snapshot for undo')
    const scope = resolveUndoScope(ctx, before)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const updated = await de.updateOrmEntity({
      entity: CareEpisode,
      where: {
        id: before.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<CareEpisode>,
      apply: (e) => {
        e.careRecipientId = before.care_recipient_id
        e.careSettingId = before.care_setting_id
        e.responsibleStaffId = before.responsible_staff_id
        e.startedAt = before.started_at ? new Date(before.started_at) : e.startedAt
        e.endedAt = before.ended_at ? new Date(before.ended_at) : null
        e.diagnosisSummary = before.diagnosis_summary
      },
    })
    await emitCrudUndoSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: updated,
      identifiers: { id: before.id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      syncOrigin: ctx.syncOrigin,
      events: careEpisodeCrudEvents,
      indexer: careEpisodeCrudIndexer,
    })
  },
}

const deleteCommand: CommandHandler<{ body?: Record<string, unknown>; query?: Record<string, unknown> }, CareEpisode> = {
  id: 'opencare.care_episodes.delete',
  isUndoable: true,
  async prepare(input, ctx) {
    const id = requireId(input, 'Care episode id required')
    const em = ctx.container.resolve('em') as EntityManager
    const existing = await em.findOne(CareEpisode, { id, deletedAt: null } as FilterQuery<CareEpisode>)
    if (!existing) return {}
    return { before: serialize(existing) }
  },
  async execute(input, ctx) {
    const id = requireId(input, 'Care episode id required')
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const entity = await de.deleteOrmEntity({
      entity: CareEpisode,
      where: {
        id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<CareEpisode>,
      soft: true,
      softDeleteField: 'deletedAt',
    })
    if (!entity) throw new CrudHttpError(404, { error: 'Care episode not found' })
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity,
      identifiers: { id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      syncOrigin: ctx.syncOrigin,
      events: careEpisodeCrudEvents,
      indexer: careEpisodeCrudIndexer,
    })
    return entity
  },
  buildLog: async ({ snapshots, input }) => {
    const { translate } = await resolveTranslations()
    const before = snapshots.before as Serialized | undefined
    const id = requireId(input, 'Care episode id required')
    return {
      actionLabel: translate('opencare.audit.care_episodes.delete', 'Delete care episode'),
      resourceKind: 'opencare.care_episode',
      resourceId: id,
      tenantId: before?.tenantId ?? null,
      organizationId: before?.organizationId ?? null,
      snapshotBefore: before ?? null,
    }
  },
  async undo({ logEntry, ctx }) {
    const before = logEntry.snapshotBefore as Serialized | undefined
    if (!before?.id) throw new Error('Missing snapshot for undo')
    const scope = resolveUndoScope(ctx, before)
    const em = ctx.container.resolve('em') as EntityManager
    const de = ctx.container.resolve('dataEngine') as DataEngine
    let restored = await em.findOne(CareEpisode, {
      id: before.id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    } as FilterQuery<CareEpisode>)
    if (restored) {
      restored.deletedAt = null
      restored.careRecipientId = before.care_recipient_id
      restored.careSettingId = before.care_setting_id
      restored.responsibleStaffId = before.responsible_staff_id
      restored.startedAt = before.started_at ? new Date(before.started_at) : restored.startedAt
      restored.endedAt = before.ended_at ? new Date(before.ended_at) : null
      restored.diagnosisSummary = before.diagnosis_summary
      await em.persist(restored).flush()
    } else {
      restored = await de.createOrmEntity({
        entity: CareEpisode,
        data: seedFromSnapshot(before),
      })
    }
    await emitCrudUndoSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: restored,
      identifiers: { id: before.id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      syncOrigin: ctx.syncOrigin,
      events: careEpisodeCrudEvents,
      indexer: careEpisodeCrudIndexer,
    })
  },
}

registerCommand(createCommand)
registerCommand(updateCommand)
registerCommand(deleteCommand)

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
import { CareNote } from '../data/entities'
import { careNoteCreateSchema, careNoteUpdateSchema } from '../data/validators'

const ENTITY_ID = 'opencare:care_note' as const

type Serialized = {
  id: string
  care_episode_id: string
  care_recipient_id: string
  body: string
  authored_by: string | null
  tenantId: string | null
  organizationId: string | null
}

export const careNoteCrudEvents: CrudEventsConfig<CareNote> = {
  module: 'opencare',
  entity: 'care_note',
  persistent: true,
  buildPayload: (ctx: CrudEmitContext<CareNote>) => ({
    id: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
    careRecipientId: ctx.entity?.careRecipientId ?? null,
    ...(ctx.syncOrigin ? { syncOrigin: ctx.syncOrigin } : {}),
  }),
}

export const careNoteCrudIndexer: CrudIndexerConfig<CareNote> = {
  entityType: ENTITY_ID,
  buildUpsertPayload: (ctx: CrudEmitContext<CareNote>) => ({
    entityType: ENTITY_ID,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
  buildDeletePayload: (ctx: CrudEmitContext<CareNote>) => ({
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

function serialize(r: CareNote): Serialized {
  return {
    id: String(r.id),
    care_episode_id: String(r.careEpisodeId),
    care_recipient_id: String(r.careRecipientId),
    body: String(r.body),
    authored_by: r.authoredBy ?? null,
    tenantId: r.tenantId ? String(r.tenantId) : null,
    organizationId: r.organizationId ? String(r.organizationId) : null,
  }
}

function seedFromSnapshot(s: Serialized): Record<string, unknown> {
  return {
    id: s.id,
    careEpisodeId: s.care_episode_id,
    careRecipientId: s.care_recipient_id,
    body: s.body,
    authoredBy: s.authored_by,
    tenantId: s.tenantId,
    organizationId: s.organizationId,
  }
}

const createCommand: CommandHandler<Record<string, unknown>, CareNote> = {
  id: 'opencare.care_notes.create',
  isUndoable: true,
  async execute(rawInput, ctx) {
    const parsed = careNoteCreateSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const entity = await de.createOrmEntity({
      entity: CareNote,
      data: {
        ...(parsed.id ? { id: parsed.id } : {}),
        careEpisodeId: parsed.care_episode_id,
        careRecipientId: parsed.care_recipient_id,
        body: parsed.body,
        authoredBy: emptyToNull(parsed.authored_by),
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
      events: careNoteCrudEvents,
      indexer: careNoteCrudIndexer,
    })
    return entity
  },
  captureAfter: (_input, result) => serialize(result),
  buildLog: async ({ result }) => {
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('opencare.audit.care_notes.create', 'Create care note'),
      resourceKind: 'opencare.care_note',
      resourceId: String(result.id),
      tenantId: result.tenantId ? String(result.tenantId) : null,
      organizationId: result.organizationId ? String(result.organizationId) : null,
      snapshotAfter: serialize(result),
    }
  },
  async undo({ logEntry, ctx }) {
    const snapshot = logEntry.snapshotAfter as Serialized | undefined
    const id = snapshot?.id ?? logEntry.resourceId
    if (!id) throw new Error('Missing care note id for undo')
    const scope = resolveUndoScope(ctx, snapshot)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const removed = await de.deleteOrmEntity({
      entity: CareNote,
      where: { id, tenantId: scope.tenantId, organizationId: scope.organizationId } as FilterQuery<CareNote>,
      soft: true,
      softDeleteField: 'deletedAt',
    })
    await emitCrudUndoSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: removed,
      identifiers: { id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      syncOrigin: ctx.syncOrigin,
      events: careNoteCrudEvents,
      indexer: careNoteCrudIndexer,
    })
  },
  redo: makeCreateRedo<CareNote, Serialized, Record<string, unknown>, CareNote>({
    entityClass: CareNote,
    getSnapshotId: (snapshot) => snapshot.id,
    seedFromSnapshot,
    buildResult: (entity) => entity,
    events: careNoteCrudEvents,
    indexer: careNoteCrudIndexer,
  }),
}

const updateCommand: CommandHandler<Record<string, unknown>, CareNote> = {
  id: 'opencare.care_notes.update',
  isUndoable: true,
  async prepare(rawInput, ctx) {
    const parsed = careNoteUpdateSchema.parse(rawInput)
    const em = ctx.container.resolve('em') as EntityManager
    const existing = await em.findOne(CareNote, { id: parsed.id, deletedAt: null } as FilterQuery<CareNote>)
    if (!existing) throw new CrudHttpError(404, { error: 'Care note not found' })
    return { before: serialize(existing) }
  },
  async execute(rawInput, ctx) {
    const parsed = careNoteUpdateSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const entity = await de.updateOrmEntity({
      entity: CareNote,
      where: {
        id: parsed.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<CareNote>,
      apply: (e) => {
        if (parsed.care_episode_id !== undefined) e.careEpisodeId = parsed.care_episode_id
        if (parsed.care_recipient_id !== undefined) e.careRecipientId = parsed.care_recipient_id
        if (parsed.body !== undefined) e.body = parsed.body
        if (parsed.authored_by !== undefined) e.authoredBy = emptyToNull(parsed.authored_by)
      },
    })
    if (!entity) throw new CrudHttpError(404, { error: 'Care note not found' })
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'updated',
      entity,
      identifiers: { id: String(entity.id), tenantId: scope.tenantId, organizationId: scope.organizationId },
      syncOrigin: ctx.syncOrigin,
      events: careNoteCrudEvents,
      indexer: careNoteCrudIndexer,
    })
    return entity
  },
  captureAfter: (_input, result) => serialize(result),
  buildLog: async ({ result, snapshots }) => {
    const { translate } = await resolveTranslations()
    const before = snapshots.before as Serialized | undefined
    const after = serialize(result)
    const changes = buildChanges(before ?? null, after as unknown as Record<string, unknown>, [
      'care_episode_id', 'care_recipient_id', 'body', 'authored_by',
    ])
    return {
      actionLabel: translate('opencare.audit.care_notes.update', 'Update care note'),
      resourceKind: 'opencare.care_note',
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
      entity: CareNote,
      where: {
        id: before.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<CareNote>,
      apply: (e) => {
        e.careEpisodeId = before.care_episode_id
        e.careRecipientId = before.care_recipient_id
        e.body = before.body
        e.authoredBy = before.authored_by
      },
    })
    await emitCrudUndoSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: updated,
      identifiers: { id: before.id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      syncOrigin: ctx.syncOrigin,
      events: careNoteCrudEvents,
      indexer: careNoteCrudIndexer,
    })
  },
}

const deleteCommand: CommandHandler<{ body?: Record<string, unknown>; query?: Record<string, unknown> }, CareNote> = {
  id: 'opencare.care_notes.delete',
  isUndoable: true,
  async prepare(input, ctx) {
    const id = requireId(input, 'Care note id required')
    const em = ctx.container.resolve('em') as EntityManager
    const existing = await em.findOne(CareNote, { id, deletedAt: null } as FilterQuery<CareNote>)
    if (!existing) return {}
    return { before: serialize(existing) }
  },
  async execute(input, ctx) {
    const id = requireId(input, 'Care note id required')
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const entity = await de.deleteOrmEntity({
      entity: CareNote,
      where: {
        id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<CareNote>,
      soft: true,
      softDeleteField: 'deletedAt',
    })
    if (!entity) throw new CrudHttpError(404, { error: 'Care note not found' })
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity,
      identifiers: { id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      syncOrigin: ctx.syncOrigin,
      events: careNoteCrudEvents,
      indexer: careNoteCrudIndexer,
    })
    return entity
  },
  buildLog: async ({ snapshots, input }) => {
    const { translate } = await resolveTranslations()
    const before = snapshots.before as Serialized | undefined
    const id = requireId(input, 'Care note id required')
    return {
      actionLabel: translate('opencare.audit.care_notes.delete', 'Delete care note'),
      resourceKind: 'opencare.care_note',
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
    let restored = await em.findOne(CareNote, {
      id: before.id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    } as FilterQuery<CareNote>)
    if (restored) {
      restored.deletedAt = null
      restored.careEpisodeId = before.care_episode_id
      restored.careRecipientId = before.care_recipient_id
      restored.body = before.body
      restored.authoredBy = before.authored_by
      await em.persist(restored).flush()
    } else {
      restored = await de.createOrmEntity({
        entity: CareNote,
        data: seedFromSnapshot(before),
      })
    }
    await emitCrudUndoSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: restored,
      identifiers: { id: before.id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      syncOrigin: ctx.syncOrigin,
      events: careNoteCrudEvents,
      indexer: careNoteCrudIndexer,
    })
  },
}

registerCommand(createCommand)
registerCommand(updateCommand)
registerCommand(deleteCommand)

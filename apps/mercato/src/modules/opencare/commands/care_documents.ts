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
import { CareDocument } from '../data/entities'
import { careDocumentCreateSchema, careDocumentUpdateSchema } from '../data/validators'

const ENTITY_ID = 'opencare:care_document' as const

type Serialized = {
  id: string
  care_recipient_id: string
  attachment_id: string
  title: string
  tenantId: string | null
  organizationId: string | null
}

export const careDocumentCrudEvents: CrudEventsConfig<CareDocument> = {
  module: 'opencare',
  entity: 'care_document',
  persistent: true,
  buildPayload: (ctx: CrudEmitContext<CareDocument>) => ({
    id: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
    careRecipientId: ctx.entity?.careRecipientId ?? null,
    ...(ctx.syncOrigin ? { syncOrigin: ctx.syncOrigin } : {}),
  }),
}

export const careDocumentCrudIndexer: CrudIndexerConfig<CareDocument> = {
  entityType: ENTITY_ID,
  buildUpsertPayload: (ctx: CrudEmitContext<CareDocument>) => ({
    entityType: ENTITY_ID,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
  buildDeletePayload: (ctx: CrudEmitContext<CareDocument>) => ({
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

function serialize(r: CareDocument): Serialized {
  return {
    id: String(r.id),
    care_recipient_id: String(r.careRecipientId),
    attachment_id: String(r.attachmentId),
    title: String(r.title),
    tenantId: r.tenantId ? String(r.tenantId) : null,
    organizationId: r.organizationId ? String(r.organizationId) : null,
  }
}

function seedFromSnapshot(s: Serialized): Record<string, unknown> {
  return {
    id: s.id,
    careRecipientId: s.care_recipient_id,
    attachmentId: s.attachment_id,
    title: s.title,
    tenantId: s.tenantId,
    organizationId: s.organizationId,
  }
}

const createCommand: CommandHandler<Record<string, unknown>, CareDocument> = {
  id: 'opencare.care_documents.create',
  isUndoable: true,
  async execute(rawInput, ctx) {
    const parsed = careDocumentCreateSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const entity = await de.createOrmEntity({
      entity: CareDocument,
      data: {
        ...(parsed.id ? { id: parsed.id } : {}),
        careRecipientId: parsed.care_recipient_id,
        attachmentId: parsed.attachment_id,
        title: parsed.title,
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
      events: careDocumentCrudEvents,
      indexer: careDocumentCrudIndexer,
    })
    return entity
  },
  captureAfter: (_input, result) => serialize(result),
  buildLog: async ({ result }) => {
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('opencare.audit.care_documents.create', 'Create care document'),
      resourceKind: 'opencare.care_document',
      resourceId: String(result.id),
      tenantId: result.tenantId ? String(result.tenantId) : null,
      organizationId: result.organizationId ? String(result.organizationId) : null,
      snapshotAfter: serialize(result),
    }
  },
  async undo({ logEntry, ctx }) {
    const snapshot = logEntry.snapshotAfter as Serialized | undefined
    const id = snapshot?.id ?? logEntry.resourceId
    if (!id) throw new Error('Missing care document id for undo')
    const scope = resolveUndoScope(ctx, snapshot)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const removed = await de.deleteOrmEntity({
      entity: CareDocument,
      where: { id, tenantId: scope.tenantId, organizationId: scope.organizationId } as FilterQuery<CareDocument>,
      soft: true,
      softDeleteField: 'deletedAt',
    })
    await emitCrudUndoSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: removed,
      identifiers: { id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      syncOrigin: ctx.syncOrigin,
      events: careDocumentCrudEvents,
      indexer: careDocumentCrudIndexer,
    })
  },
  redo: makeCreateRedo<CareDocument, Serialized, Record<string, unknown>, CareDocument>({
    entityClass: CareDocument,
    getSnapshotId: (snapshot) => snapshot.id,
    seedFromSnapshot,
    buildResult: (entity) => entity,
    events: careDocumentCrudEvents,
    indexer: careDocumentCrudIndexer,
  }),
}

const updateCommand: CommandHandler<Record<string, unknown>, CareDocument> = {
  id: 'opencare.care_documents.update',
  isUndoable: true,
  async prepare(rawInput, ctx) {
    const parsed = careDocumentUpdateSchema.parse(rawInput)
    const em = ctx.container.resolve('em') as EntityManager
    const existing = await em.findOne(CareDocument, { id: parsed.id, deletedAt: null } as FilterQuery<CareDocument>)
    if (!existing) throw new CrudHttpError(404, { error: 'Care document not found' })
    return { before: serialize(existing) }
  },
  async execute(rawInput, ctx) {
    const parsed = careDocumentUpdateSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const entity = await de.updateOrmEntity({
      entity: CareDocument,
      where: {
        id: parsed.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<CareDocument>,
      apply: (e) => {
        if (parsed.care_recipient_id !== undefined) e.careRecipientId = parsed.care_recipient_id
        if (parsed.attachment_id !== undefined) e.attachmentId = parsed.attachment_id
        if (parsed.title !== undefined) e.title = parsed.title
      },
    })
    if (!entity) throw new CrudHttpError(404, { error: 'Care document not found' })
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'updated',
      entity,
      identifiers: { id: String(entity.id), tenantId: scope.tenantId, organizationId: scope.organizationId },
      syncOrigin: ctx.syncOrigin,
      events: careDocumentCrudEvents,
      indexer: careDocumentCrudIndexer,
    })
    return entity
  },
  captureAfter: (_input, result) => serialize(result),
  buildLog: async ({ result, snapshots }) => {
    const { translate } = await resolveTranslations()
    const before = snapshots.before as Serialized | undefined
    const after = serialize(result)
    const changes = buildChanges(before ?? null, after as unknown as Record<string, unknown>, [
      'care_recipient_id', 'attachment_id', 'title',
    ])
    return {
      actionLabel: translate('opencare.audit.care_documents.update', 'Update care document'),
      resourceKind: 'opencare.care_document',
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
      entity: CareDocument,
      where: {
        id: before.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<CareDocument>,
      apply: (e) => {
        e.careRecipientId = before.care_recipient_id
        e.attachmentId = before.attachment_id
        e.title = before.title
      },
    })
    await emitCrudUndoSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: updated,
      identifiers: { id: before.id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      syncOrigin: ctx.syncOrigin,
      events: careDocumentCrudEvents,
      indexer: careDocumentCrudIndexer,
    })
  },
}

const deleteCommand: CommandHandler<{ body?: Record<string, unknown>; query?: Record<string, unknown> }, CareDocument> = {
  id: 'opencare.care_documents.delete',
  isUndoable: true,
  async prepare(input, ctx) {
    const id = requireId(input, 'Care document id required')
    const em = ctx.container.resolve('em') as EntityManager
    const existing = await em.findOne(CareDocument, { id, deletedAt: null } as FilterQuery<CareDocument>)
    if (!existing) return {}
    return { before: serialize(existing) }
  },
  async execute(input, ctx) {
    const id = requireId(input, 'Care document id required')
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const entity = await de.deleteOrmEntity({
      entity: CareDocument,
      where: {
        id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<CareDocument>,
      soft: true,
      softDeleteField: 'deletedAt',
    })
    if (!entity) throw new CrudHttpError(404, { error: 'Care document not found' })
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity,
      identifiers: { id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      syncOrigin: ctx.syncOrigin,
      events: careDocumentCrudEvents,
      indexer: careDocumentCrudIndexer,
    })
    return entity
  },
  buildLog: async ({ snapshots, input }) => {
    const { translate } = await resolveTranslations()
    const before = snapshots.before as Serialized | undefined
    const id = requireId(input, 'Care document id required')
    return {
      actionLabel: translate('opencare.audit.care_documents.delete', 'Delete care document'),
      resourceKind: 'opencare.care_document',
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
    let restored = await em.findOne(CareDocument, {
      id: before.id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    } as FilterQuery<CareDocument>)
    if (restored) {
      restored.deletedAt = null
      restored.careRecipientId = before.care_recipient_id
      restored.attachmentId = before.attachment_id
      restored.title = before.title
      await em.persist(restored).flush()
    } else {
      restored = await de.createOrmEntity({
        entity: CareDocument,
        data: seedFromSnapshot(before),
      })
    }
    await emitCrudUndoSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: restored,
      identifiers: { id: before.id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      syncOrigin: ctx.syncOrigin,
      events: careDocumentCrudEvents,
      indexer: careDocumentCrudIndexer,
    })
  },
}

registerCommand(createCommand)
registerCommand(updateCommand)
registerCommand(deleteCommand)

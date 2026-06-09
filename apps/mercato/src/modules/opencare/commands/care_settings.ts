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
import { CareSetting } from '../data/entities'
import { careSettingCreateSchema, careSettingUpdateSchema } from '../data/validators'

const ENTITY_ID = 'opencare:care_setting' as const

type Serialized = {
  id: string
  name: string
  kind: string
  tenantId: string | null
  organizationId: string | null
}

export const careSettingCrudEvents: CrudEventsConfig<CareSetting> = {
  module: 'opencare',
  entity: 'care_setting',
  persistent: true,
  buildPayload: (ctx: CrudEmitContext<CareSetting>) => ({
    id: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
    name: ctx.entity?.name ?? null,
    ...(ctx.syncOrigin ? { syncOrigin: ctx.syncOrigin } : {}),
  }),
}

export const careSettingCrudIndexer: CrudIndexerConfig<CareSetting> = {
  entityType: ENTITY_ID,
  buildUpsertPayload: (ctx: CrudEmitContext<CareSetting>) => ({
    entityType: ENTITY_ID,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
  buildDeletePayload: (ctx: CrudEmitContext<CareSetting>) => ({
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

function serialize(r: CareSetting): Serialized {
  return {
    id: String(r.id),
    name: String(r.name),
    kind: String(r.kind),
    tenantId: r.tenantId ? String(r.tenantId) : null,
    organizationId: r.organizationId ? String(r.organizationId) : null,
  }
}

function seedFromSnapshot(s: Serialized): Record<string, unknown> {
  return {
    id: s.id,
    name: s.name,
    kind: s.kind,
    tenantId: s.tenantId,
    organizationId: s.organizationId,
  }
}

const createCommand: CommandHandler<Record<string, unknown>, CareSetting> = {
  id: 'opencare.care_settings.create',
  isUndoable: true,
  async execute(rawInput, ctx) {
    const parsed = careSettingCreateSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const entity = await de.createOrmEntity({
      entity: CareSetting,
      data: {
        ...(parsed.id ? { id: parsed.id } : {}),
        name: parsed.name,
        kind: parsed.kind,
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
      events: careSettingCrudEvents,
      indexer: careSettingCrudIndexer,
    })
    return entity
  },
  captureAfter: (_input, result) => serialize(result),
  buildLog: async ({ result }) => {
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('opencare.audit.care_settings.create', 'Create care setting'),
      resourceKind: 'opencare.care_setting',
      resourceId: String(result.id),
      tenantId: result.tenantId ? String(result.tenantId) : null,
      organizationId: result.organizationId ? String(result.organizationId) : null,
      snapshotAfter: serialize(result),
    }
  },
  async undo({ logEntry, ctx }) {
    const snapshot = logEntry.snapshotAfter as Serialized | undefined
    const id = snapshot?.id ?? logEntry.resourceId
    if (!id) throw new Error('Missing care setting id for undo')
    const scope = resolveUndoScope(ctx, snapshot)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const removed = await de.deleteOrmEntity({
      entity: CareSetting,
      where: { id, tenantId: scope.tenantId, organizationId: scope.organizationId } as FilterQuery<CareSetting>,
      soft: true,
      softDeleteField: 'deletedAt',
    })
    await emitCrudUndoSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: removed,
      identifiers: { id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      syncOrigin: ctx.syncOrigin,
      events: careSettingCrudEvents,
      indexer: careSettingCrudIndexer,
    })
  },
  redo: makeCreateRedo<CareSetting, Serialized, Record<string, unknown>, CareSetting>({
    entityClass: CareSetting,
    getSnapshotId: (snapshot) => snapshot.id,
    seedFromSnapshot,
    buildResult: (entity) => entity,
    events: careSettingCrudEvents,
    indexer: careSettingCrudIndexer,
  }),
}

const updateCommand: CommandHandler<Record<string, unknown>, CareSetting> = {
  id: 'opencare.care_settings.update',
  isUndoable: true,
  async prepare(rawInput, ctx) {
    const parsed = careSettingUpdateSchema.parse(rawInput)
    const em = ctx.container.resolve('em') as EntityManager
    const existing = await em.findOne(CareSetting, { id: parsed.id, deletedAt: null } as FilterQuery<CareSetting>)
    if (!existing) throw new CrudHttpError(404, { error: 'Care setting not found' })
    return { before: serialize(existing) }
  },
  async execute(rawInput, ctx) {
    const parsed = careSettingUpdateSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const entity = await de.updateOrmEntity({
      entity: CareSetting,
      where: {
        id: parsed.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<CareSetting>,
      apply: (e) => {
        if (parsed.name !== undefined) e.name = parsed.name
        if (parsed.kind !== undefined) e.kind = parsed.kind
      },
    })
    if (!entity) throw new CrudHttpError(404, { error: 'Care setting not found' })
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'updated',
      entity,
      identifiers: { id: String(entity.id), tenantId: scope.tenantId, organizationId: scope.organizationId },
      syncOrigin: ctx.syncOrigin,
      events: careSettingCrudEvents,
      indexer: careSettingCrudIndexer,
    })
    return entity
  },
  captureAfter: (_input, result) => serialize(result),
  buildLog: async ({ result, snapshots }) => {
    const { translate } = await resolveTranslations()
    const before = snapshots.before as Serialized | undefined
    const after = serialize(result)
    const changes = buildChanges(before ?? null, after as unknown as Record<string, unknown>, ['name', 'kind'])
    return {
      actionLabel: translate('opencare.audit.care_settings.update', 'Update care setting'),
      resourceKind: 'opencare.care_setting',
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
      entity: CareSetting,
      where: {
        id: before.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<CareSetting>,
      apply: (e) => {
        e.name = before.name
        e.kind = before.kind
      },
    })
    await emitCrudUndoSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: updated,
      identifiers: { id: before.id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      syncOrigin: ctx.syncOrigin,
      events: careSettingCrudEvents,
      indexer: careSettingCrudIndexer,
    })
  },
}

const deleteCommand: CommandHandler<{ body?: Record<string, unknown>; query?: Record<string, unknown> }, CareSetting> = {
  id: 'opencare.care_settings.delete',
  isUndoable: true,
  async prepare(input, ctx) {
    const id = requireId(input, 'Care setting id required')
    const em = ctx.container.resolve('em') as EntityManager
    const existing = await em.findOne(CareSetting, { id, deletedAt: null } as FilterQuery<CareSetting>)
    if (!existing) return {}
    return { before: serialize(existing) }
  },
  async execute(input, ctx) {
    const id = requireId(input, 'Care setting id required')
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const entity = await de.deleteOrmEntity({
      entity: CareSetting,
      where: {
        id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<CareSetting>,
      soft: true,
      softDeleteField: 'deletedAt',
    })
    if (!entity) throw new CrudHttpError(404, { error: 'Care setting not found' })
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity,
      identifiers: { id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      syncOrigin: ctx.syncOrigin,
      events: careSettingCrudEvents,
      indexer: careSettingCrudIndexer,
    })
    return entity
  },
  buildLog: async ({ snapshots, input }) => {
    const { translate } = await resolveTranslations()
    const before = snapshots.before as Serialized | undefined
    const id = requireId(input, 'Care setting id required')
    return {
      actionLabel: translate('opencare.audit.care_settings.delete', 'Delete care setting'),
      resourceKind: 'opencare.care_setting',
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
    let restored = await em.findOne(CareSetting, {
      id: before.id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    } as FilterQuery<CareSetting>)
    if (restored) {
      restored.deletedAt = null
      restored.name = before.name
      restored.kind = before.kind
      await em.persist(restored).flush()
    } else {
      restored = await de.createOrmEntity({
        entity: CareSetting,
        data: seedFromSnapshot(before),
      })
    }
    await emitCrudUndoSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: restored,
      identifiers: { id: before.id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      syncOrigin: ctx.syncOrigin,
      events: careSettingCrudEvents,
      indexer: careSettingCrudIndexer,
    })
  },
}

registerCommand(createCommand)
registerCommand(updateCommand)
registerCommand(deleteCommand)

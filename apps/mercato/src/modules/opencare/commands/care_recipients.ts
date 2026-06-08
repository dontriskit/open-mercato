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
import { CareRecipient } from '../data/entities'
import { careRecipientCreateSchema, careRecipientUpdateSchema } from '../data/validators'

const ENTITY_ID = 'opencare:care_recipient' as const

type SerializedCareRecipient = {
  id: string
  display_name: string
  national_id: string | null
  primary_email: string | null
  phone: string | null
  date_of_birth: string | null
  gdpr_legal_basis: string | null
  tenantId: string | null
  organizationId: string | null
}

export const careRecipientCrudEvents: CrudEventsConfig<CareRecipient> = {
  module: 'opencare',
  entity: 'care_recipient',
  persistent: true,
  buildPayload: (ctx: CrudEmitContext<CareRecipient>) => ({
    id: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
    displayName: ctx.entity?.displayName ?? null,
    ...(ctx.syncOrigin ? { syncOrigin: ctx.syncOrigin } : {}),
  }),
}

export const careRecipientCrudIndexer: CrudIndexerConfig<CareRecipient> = {
  entityType: ENTITY_ID,
  buildUpsertPayload: (ctx: CrudEmitContext<CareRecipient>) => ({
    entityType: ENTITY_ID,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
  buildDeletePayload: (ctx: CrudEmitContext<CareRecipient>) => ({
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

function serialize(r: CareRecipient): SerializedCareRecipient {
  return {
    id: String(r.id),
    display_name: String(r.displayName),
    national_id: r.nationalId ?? null,
    primary_email: r.primaryEmail ?? null,
    phone: r.phone ?? null,
    date_of_birth: r.dateOfBirth ?? null,
    gdpr_legal_basis: r.gdprLegalBasis ?? null,
    tenantId: r.tenantId ? String(r.tenantId) : null,
    organizationId: r.organizationId ? String(r.organizationId) : null,
  }
}

function seedFromSnapshot(s: SerializedCareRecipient): Record<string, unknown> {
  return {
    id: s.id,
    displayName: s.display_name,
    nationalId: s.national_id,
    primaryEmail: s.primary_email,
    phone: s.phone,
    dateOfBirth: s.date_of_birth,
    gdprLegalBasis: s.gdpr_legal_basis,
    tenantId: s.tenantId,
    organizationId: s.organizationId,
  }
}

const createCommand: CommandHandler<Record<string, unknown>, CareRecipient> = {
  id: 'opencare.care_recipients.create',
  isUndoable: true,
  async execute(rawInput, ctx) {
    const parsed = careRecipientCreateSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const entity = await de.createOrmEntity({
      entity: CareRecipient,
      data: {
        ...(parsed.id ? { id: parsed.id } : {}),
        displayName: parsed.display_name,
        nationalId: emptyToNull(parsed.national_id),
        primaryEmail: emptyToNull(parsed.primary_email),
        phone: emptyToNull(parsed.phone),
        dateOfBirth: emptyToNull(parsed.date_of_birth),
        gdprLegalBasis: emptyToNull(parsed.gdpr_legal_basis),
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
      events: careRecipientCrudEvents,
      indexer: careRecipientCrudIndexer,
    })
    return entity
  },
  captureAfter: (_input, result) => serialize(result),
  buildLog: async ({ result }) => {
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('opencare.audit.care_recipients.create', 'Create care recipient'),
      resourceKind: 'opencare.care_recipient',
      resourceId: String(result.id),
      tenantId: result.tenantId ? String(result.tenantId) : null,
      organizationId: result.organizationId ? String(result.organizationId) : null,
      snapshotAfter: serialize(result),
    }
  },
  async undo({ logEntry, ctx }) {
    const snapshot = logEntry.snapshotAfter as SerializedCareRecipient | undefined
    const id = snapshot?.id ?? logEntry.resourceId
    if (!id) throw new Error('Missing care recipient id for undo')
    const scope = resolveUndoScope(ctx, snapshot)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const removed = await de.deleteOrmEntity({
      entity: CareRecipient,
      where: { id, tenantId: scope.tenantId, organizationId: scope.organizationId } as FilterQuery<CareRecipient>,
      soft: true,
      softDeleteField: 'deletedAt',
    })
    await emitCrudUndoSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: removed,
      identifiers: { id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      syncOrigin: ctx.syncOrigin,
      events: careRecipientCrudEvents,
      indexer: careRecipientCrudIndexer,
    })
  },
  redo: makeCreateRedo<CareRecipient, SerializedCareRecipient, Record<string, unknown>, CareRecipient>({
    entityClass: CareRecipient,
    getSnapshotId: (snapshot) => snapshot.id,
    seedFromSnapshot,
    buildResult: (entity) => entity,
    events: careRecipientCrudEvents,
    indexer: careRecipientCrudIndexer,
  }),
}

const updateCommand: CommandHandler<Record<string, unknown>, CareRecipient> = {
  id: 'opencare.care_recipients.update',
  isUndoable: true,
  async prepare(rawInput, ctx) {
    const parsed = careRecipientUpdateSchema.parse(rawInput)
    const em = ctx.container.resolve('em') as EntityManager
    const existing = await em.findOne(CareRecipient, { id: parsed.id, deletedAt: null } as FilterQuery<CareRecipient>)
    if (!existing) throw new CrudHttpError(404, { error: 'Care recipient not found' })
    return { before: serialize(existing) }
  },
  async execute(rawInput, ctx) {
    const parsed = careRecipientUpdateSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const entity = await de.updateOrmEntity({
      entity: CareRecipient,
      where: {
        id: parsed.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<CareRecipient>,
      apply: (e) => {
        if (parsed.display_name !== undefined) e.displayName = parsed.display_name
        if (parsed.national_id !== undefined) e.nationalId = emptyToNull(parsed.national_id)
        if (parsed.primary_email !== undefined) e.primaryEmail = emptyToNull(parsed.primary_email)
        if (parsed.phone !== undefined) e.phone = emptyToNull(parsed.phone)
        if (parsed.date_of_birth !== undefined) e.dateOfBirth = emptyToNull(parsed.date_of_birth)
        if (parsed.gdpr_legal_basis !== undefined) e.gdprLegalBasis = emptyToNull(parsed.gdpr_legal_basis)
      },
    })
    if (!entity) throw new CrudHttpError(404, { error: 'Care recipient not found' })
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'updated',
      entity,
      identifiers: { id: String(entity.id), tenantId: scope.tenantId, organizationId: scope.organizationId },
      syncOrigin: ctx.syncOrigin,
      events: careRecipientCrudEvents,
      indexer: careRecipientCrudIndexer,
    })
    return entity
  },
  captureAfter: (_input, result) => serialize(result),
  buildLog: async ({ result, snapshots }) => {
    const { translate } = await resolveTranslations()
    const before = snapshots.before as SerializedCareRecipient | undefined
    const after = serialize(result)
    const changes = buildChanges(before ?? null, after as unknown as Record<string, unknown>, [
      'display_name', 'national_id', 'primary_email', 'phone', 'date_of_birth', 'gdpr_legal_basis',
    ])
    return {
      actionLabel: translate('opencare.audit.care_recipients.update', 'Update care recipient'),
      resourceKind: 'opencare.care_recipient',
      resourceId: String(result.id),
      tenantId: result.tenantId ? String(result.tenantId) : null,
      organizationId: result.organizationId ? String(result.organizationId) : null,
      changes,
      snapshotBefore: before ?? null,
      snapshotAfter: after,
    }
  },
  async undo({ logEntry, ctx }) {
    const before = logEntry.snapshotBefore as SerializedCareRecipient | undefined
    if (!before?.id) throw new Error('Missing previous snapshot for undo')
    const scope = resolveUndoScope(ctx, before)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const updated = await de.updateOrmEntity({
      entity: CareRecipient,
      where: {
        id: before.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<CareRecipient>,
      apply: (e) => {
        e.displayName = before.display_name
        e.nationalId = before.national_id
        e.primaryEmail = before.primary_email
        e.phone = before.phone
        e.dateOfBirth = before.date_of_birth
        e.gdprLegalBasis = before.gdpr_legal_basis
      },
    })
    await emitCrudUndoSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: updated,
      identifiers: { id: before.id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      syncOrigin: ctx.syncOrigin,
      events: careRecipientCrudEvents,
      indexer: careRecipientCrudIndexer,
    })
  },
}

const deleteCommand: CommandHandler<{ body?: Record<string, unknown>; query?: Record<string, unknown> }, CareRecipient> = {
  id: 'opencare.care_recipients.delete',
  isUndoable: true,
  async prepare(input, ctx) {
    const id = requireId(input, 'Care recipient id required')
    const em = ctx.container.resolve('em') as EntityManager
    const existing = await em.findOne(CareRecipient, { id, deletedAt: null } as FilterQuery<CareRecipient>)
    if (!existing) return {}
    return { before: serialize(existing) }
  },
  async execute(input, ctx) {
    const id = requireId(input, 'Care recipient id required')
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const entity = await de.deleteOrmEntity({
      entity: CareRecipient,
      where: {
        id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<CareRecipient>,
      soft: true,
      softDeleteField: 'deletedAt',
    })
    if (!entity) throw new CrudHttpError(404, { error: 'Care recipient not found' })
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity,
      identifiers: { id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      syncOrigin: ctx.syncOrigin,
      events: careRecipientCrudEvents,
      indexer: careRecipientCrudIndexer,
    })
    return entity
  },
  buildLog: async ({ snapshots, input }) => {
    const { translate } = await resolveTranslations()
    const before = snapshots.before as SerializedCareRecipient | undefined
    const id = requireId(input, 'Care recipient id required')
    return {
      actionLabel: translate('opencare.audit.care_recipients.delete', 'Delete care recipient'),
      resourceKind: 'opencare.care_recipient',
      resourceId: id,
      tenantId: before?.tenantId ?? null,
      organizationId: before?.organizationId ?? null,
      snapshotBefore: before ?? null,
    }
  },
  async undo({ logEntry, ctx }) {
    const before = logEntry.snapshotBefore as SerializedCareRecipient | undefined
    if (!before?.id) throw new Error('Missing snapshot for undo')
    const scope = resolveUndoScope(ctx, before)
    const em = ctx.container.resolve('em') as EntityManager
    const de = ctx.container.resolve('dataEngine') as DataEngine
    let restored = await em.findOne(CareRecipient, {
      id: before.id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    } as FilterQuery<CareRecipient>)
    if (restored) {
      restored.deletedAt = null
      restored.displayName = before.display_name
      restored.nationalId = before.national_id
      restored.primaryEmail = before.primary_email
      restored.phone = before.phone
      restored.dateOfBirth = before.date_of_birth
      restored.gdprLegalBasis = before.gdpr_legal_basis
      await em.persist(restored).flush()
    } else {
      restored = await de.createOrmEntity({
        entity: CareRecipient,
        data: seedFromSnapshot(before),
      })
    }
    await emitCrudUndoSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: restored,
      identifiers: { id: before.id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      syncOrigin: ctx.syncOrigin,
      events: careRecipientCrudEvents,
      indexer: careRecipientCrudIndexer,
    })
  },
}

registerCommand(createCommand)
registerCommand(updateCommand)
registerCommand(deleteCommand)

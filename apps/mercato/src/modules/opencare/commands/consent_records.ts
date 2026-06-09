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
import { ConsentRecord } from '../data/entities'
import { consentRecordCreateSchema, consentRecordUpdateSchema } from '../data/validators'

const ENTITY_ID = 'opencare:consent_record' as const

type Serialized = {
  id: string
  care_recipient_id: string
  consent_type: string
  lawful_basis: string
  jurisdiction: string
  granted: boolean
  granted_by: string | null
  evidence_attachment_id: string | null
  granted_at: string | null
  expires_at: string | null
  revoked_at: string | null
  tenantId: string | null
  organizationId: string | null
}

export const consentRecordCrudEvents: CrudEventsConfig<ConsentRecord> = {
  module: 'opencare',
  entity: 'consent_record',
  persistent: true,
  buildPayload: (ctx: CrudEmitContext<ConsentRecord>) => ({
    id: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
    careRecipientId: ctx.entity?.careRecipientId ?? null,
    ...(ctx.syncOrigin ? { syncOrigin: ctx.syncOrigin } : {}),
  }),
}

export const consentRecordCrudIndexer: CrudIndexerConfig<ConsentRecord> = {
  entityType: ENTITY_ID,
  buildUpsertPayload: (ctx: CrudEmitContext<ConsentRecord>) => ({
    entityType: ENTITY_ID,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
  buildDeletePayload: (ctx: CrudEmitContext<ConsentRecord>) => ({
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

function serialize(r: ConsentRecord): Serialized {
  return {
    id: String(r.id),
    care_recipient_id: String(r.careRecipientId),
    consent_type: String(r.consentType),
    lawful_basis: String(r.lawfulBasis),
    jurisdiction: String(r.jurisdiction),
    granted: Boolean(r.granted),
    granted_by: r.grantedBy ?? null,
    evidence_attachment_id: r.evidenceAttachmentId ?? null,
    granted_at: r.grantedAt ? new Date(r.grantedAt).toISOString() : null,
    expires_at: r.expiresAt ? new Date(r.expiresAt).toISOString() : null,
    revoked_at: r.revokedAt ? new Date(r.revokedAt).toISOString() : null,
    tenantId: r.tenantId ? String(r.tenantId) : null,
    organizationId: r.organizationId ? String(r.organizationId) : null,
  }
}

function seedFromSnapshot(s: Serialized): Record<string, unknown> {
  return {
    id: s.id,
    careRecipientId: s.care_recipient_id,
    consentType: s.consent_type,
    lawfulBasis: s.lawful_basis,
    jurisdiction: s.jurisdiction,
    granted: s.granted,
    grantedBy: s.granted_by,
    evidenceAttachmentId: s.evidence_attachment_id,
    grantedAt: s.granted_at ? new Date(s.granted_at) : null,
    expiresAt: s.expires_at ? new Date(s.expires_at) : null,
    revokedAt: s.revoked_at ? new Date(s.revoked_at) : null,
    tenantId: s.tenantId,
    organizationId: s.organizationId,
  }
}

const createCommand: CommandHandler<Record<string, unknown>, ConsentRecord> = {
  id: 'opencare.consent_records.create',
  isUndoable: true,
  async execute(rawInput, ctx) {
    const parsed = consentRecordCreateSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const entity = await de.createOrmEntity({
      entity: ConsentRecord,
      data: {
        ...(parsed.id ? { id: parsed.id } : {}),
        careRecipientId: parsed.care_recipient_id,
        consentType: parsed.consent_type,
        lawfulBasis: parsed.lawful_basis,
        jurisdiction: parsed.jurisdiction,
        granted: Boolean(parsed.granted),
        grantedBy: emptyToNull(parsed.granted_by),
        evidenceAttachmentId: emptyToNull(parsed.evidence_attachment_id),
        grantedAt: toDate(parsed.granted_at),
        expiresAt: toDate(parsed.expires_at),
        revokedAt: toDate(parsed.revoked_at),
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
      events: consentRecordCrudEvents,
      indexer: consentRecordCrudIndexer,
    })
    return entity
  },
  captureAfter: (_input, result) => serialize(result),
  buildLog: async ({ result }) => {
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('opencare.audit.consent_records.create', 'Create consent record'),
      resourceKind: 'opencare.consent_record',
      resourceId: String(result.id),
      tenantId: result.tenantId ? String(result.tenantId) : null,
      organizationId: result.organizationId ? String(result.organizationId) : null,
      snapshotAfter: serialize(result),
    }
  },
  async undo({ logEntry, ctx }) {
    const snapshot = logEntry.snapshotAfter as Serialized | undefined
    const id = snapshot?.id ?? logEntry.resourceId
    if (!id) throw new Error('Missing consent record id for undo')
    const scope = resolveUndoScope(ctx, snapshot)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const removed = await de.deleteOrmEntity({
      entity: ConsentRecord,
      where: { id, tenantId: scope.tenantId, organizationId: scope.organizationId } as FilterQuery<ConsentRecord>,
      soft: true,
      softDeleteField: 'deletedAt',
    })
    await emitCrudUndoSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: removed,
      identifiers: { id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      syncOrigin: ctx.syncOrigin,
      events: consentRecordCrudEvents,
      indexer: consentRecordCrudIndexer,
    })
  },
  redo: makeCreateRedo<ConsentRecord, Serialized, Record<string, unknown>, ConsentRecord>({
    entityClass: ConsentRecord,
    getSnapshotId: (snapshot) => snapshot.id,
    seedFromSnapshot,
    buildResult: (entity) => entity,
    events: consentRecordCrudEvents,
    indexer: consentRecordCrudIndexer,
  }),
}

const updateCommand: CommandHandler<Record<string, unknown>, ConsentRecord> = {
  id: 'opencare.consent_records.update',
  isUndoable: true,
  async prepare(rawInput, ctx) {
    const parsed = consentRecordUpdateSchema.parse(rawInput)
    const em = ctx.container.resolve('em') as EntityManager
    const existing = await em.findOne(ConsentRecord, { id: parsed.id, deletedAt: null } as FilterQuery<ConsentRecord>)
    if (!existing) throw new CrudHttpError(404, { error: 'Consent record not found' })
    return { before: serialize(existing) }
  },
  async execute(rawInput, ctx) {
    const parsed = consentRecordUpdateSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const entity = await de.updateOrmEntity({
      entity: ConsentRecord,
      where: {
        id: parsed.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<ConsentRecord>,
      apply: (e) => {
        if (parsed.care_recipient_id !== undefined) e.careRecipientId = parsed.care_recipient_id
        if (parsed.consent_type !== undefined) e.consentType = parsed.consent_type
        if (parsed.lawful_basis !== undefined) e.lawfulBasis = parsed.lawful_basis
        if (parsed.jurisdiction !== undefined) e.jurisdiction = parsed.jurisdiction
        if (parsed.granted !== undefined) e.granted = Boolean(parsed.granted)
        if (parsed.granted_by !== undefined) e.grantedBy = emptyToNull(parsed.granted_by)
        if (parsed.evidence_attachment_id !== undefined) e.evidenceAttachmentId = emptyToNull(parsed.evidence_attachment_id)
        if (parsed.granted_at !== undefined) e.grantedAt = toDate(parsed.granted_at)
        if (parsed.expires_at !== undefined) e.expiresAt = toDate(parsed.expires_at)
        if (parsed.revoked_at !== undefined) e.revokedAt = toDate(parsed.revoked_at)
      },
    })
    if (!entity) throw new CrudHttpError(404, { error: 'Consent record not found' })
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'updated',
      entity,
      identifiers: { id: String(entity.id), tenantId: scope.tenantId, organizationId: scope.organizationId },
      syncOrigin: ctx.syncOrigin,
      events: consentRecordCrudEvents,
      indexer: consentRecordCrudIndexer,
    })
    return entity
  },
  captureAfter: (_input, result) => serialize(result),
  buildLog: async ({ result, snapshots }) => {
    const { translate } = await resolveTranslations()
    const before = snapshots.before as Serialized | undefined
    const after = serialize(result)
    const changes = buildChanges(before ?? null, after as unknown as Record<string, unknown>, [
      'care_recipient_id', 'consent_type', 'lawful_basis', 'jurisdiction', 'granted', 'granted_by',
      'evidence_attachment_id', 'granted_at', 'expires_at', 'revoked_at',
    ])
    return {
      actionLabel: translate('opencare.audit.consent_records.update', 'Update consent record'),
      resourceKind: 'opencare.consent_record',
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
      entity: ConsentRecord,
      where: {
        id: before.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<ConsentRecord>,
      apply: (e) => {
        e.careRecipientId = before.care_recipient_id
        e.consentType = before.consent_type
        e.lawfulBasis = before.lawful_basis
        e.jurisdiction = before.jurisdiction
        e.granted = before.granted
        e.grantedBy = before.granted_by
        e.evidenceAttachmentId = before.evidence_attachment_id
        e.grantedAt = before.granted_at ? new Date(before.granted_at) : null
        e.expiresAt = before.expires_at ? new Date(before.expires_at) : null
        e.revokedAt = before.revoked_at ? new Date(before.revoked_at) : null
      },
    })
    await emitCrudUndoSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: updated,
      identifiers: { id: before.id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      syncOrigin: ctx.syncOrigin,
      events: consentRecordCrudEvents,
      indexer: consentRecordCrudIndexer,
    })
  },
}

const deleteCommand: CommandHandler<{ body?: Record<string, unknown>; query?: Record<string, unknown> }, ConsentRecord> = {
  id: 'opencare.consent_records.delete',
  isUndoable: true,
  async prepare(input, ctx) {
    const id = requireId(input, 'Consent record id required')
    const em = ctx.container.resolve('em') as EntityManager
    const existing = await em.findOne(ConsentRecord, { id, deletedAt: null } as FilterQuery<ConsentRecord>)
    if (!existing) return {}
    return { before: serialize(existing) }
  },
  async execute(input, ctx) {
    const id = requireId(input, 'Consent record id required')
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const entity = await de.deleteOrmEntity({
      entity: ConsentRecord,
      where: {
        id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<ConsentRecord>,
      soft: true,
      softDeleteField: 'deletedAt',
    })
    if (!entity) throw new CrudHttpError(404, { error: 'Consent record not found' })
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity,
      identifiers: { id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      syncOrigin: ctx.syncOrigin,
      events: consentRecordCrudEvents,
      indexer: consentRecordCrudIndexer,
    })
    return entity
  },
  buildLog: async ({ snapshots, input }) => {
    const { translate } = await resolveTranslations()
    const before = snapshots.before as Serialized | undefined
    const id = requireId(input, 'Consent record id required')
    return {
      actionLabel: translate('opencare.audit.consent_records.delete', 'Delete consent record'),
      resourceKind: 'opencare.consent_record',
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
    let restored = await em.findOne(ConsentRecord, {
      id: before.id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    } as FilterQuery<ConsentRecord>)
    if (restored) {
      restored.deletedAt = null
      restored.careRecipientId = before.care_recipient_id
      restored.consentType = before.consent_type
      restored.lawfulBasis = before.lawful_basis
      restored.jurisdiction = before.jurisdiction
      restored.granted = before.granted
      restored.grantedBy = before.granted_by
      restored.evidenceAttachmentId = before.evidence_attachment_id
      restored.grantedAt = before.granted_at ? new Date(before.granted_at) : null
      restored.expiresAt = before.expires_at ? new Date(before.expires_at) : null
      restored.revokedAt = before.revoked_at ? new Date(before.revoked_at) : null
      await em.persist(restored).flush()
    } else {
      restored = await de.createOrmEntity({
        entity: ConsentRecord,
        data: seedFromSnapshot(before),
      })
    }
    await emitCrudUndoSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: restored,
      identifiers: { id: before.id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      syncOrigin: ctx.syncOrigin,
      events: consentRecordCrudEvents,
      indexer: consentRecordCrudIndexer,
    })
  },
}

registerCommand(createCommand)
registerCommand(updateCommand)
registerCommand(deleteCommand)

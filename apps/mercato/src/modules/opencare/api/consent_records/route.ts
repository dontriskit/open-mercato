/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { ConsentRecord } from '../../data/entities'
import type { Where, WhereValue } from '@open-mercato/shared/lib/query/types'
import type { ConsentRecordListItem } from '../../types'

const ENTITY_ID = 'opencare:consent_record' as const

const querySchema = z
  .object({
    id: z.string().uuid().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    ids: z.string().optional(),
    sortField: z.string().optional().default('created_at'),
    sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
    careRecipientId: z.string().uuid().optional(),
    consentType: z.string().optional(),
    withDeleted: z.coerce.boolean().optional().default(false),
    organizationId: z.string().uuid().optional(),
    createdFrom: z.string().optional(),
    createdTo: z.string().optional(),
    format: z.enum(['json', 'csv']).optional(),
  })
  .passthrough()

const rawBodySchema = z.object({}).passthrough()

type Query = z.infer<typeof querySchema>

const listFields = [
  'id', 'care_recipient_id', 'consent_type', 'lawful_basis', 'jurisdiction', 'granted',
  'granted_by', 'evidence_attachment_id', 'granted_at', 'expires_at', 'revoked_at',
  'tenant_id', 'organization_id', 'created_at',
]

const sortFieldMap: Record<string, unknown> = {
  id: 'id',
  consent_type: 'consent_type',
  created_at: 'created_at',
  granted_at: 'granted_at',
}

type BaseFields = {
  id: string
  care_recipient_id: string
  consent_type: string
  lawful_basis: string
  jurisdiction: string
  granted: boolean
  granted_by: string | null
  evidence_attachment_id: string | null
  granted_at: Date | null
  expires_at: Date | null
  revoked_at: Date | null
  tenant_id: string | null
  organization_id: string | null
  created_at: Date
}

function toIso(v: unknown): string | null {
  if (!v) return null
  const d = v instanceof Date ? v : new Date(String(v))
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export const { metadata, GET, POST, PUT, DELETE } = makeCrudRoute({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['opencare.consent_records.view'] },
    POST: { requireAuth: true, requireFeatures: ['opencare.consent_records.manage'] },
    PUT: { requireAuth: true, requireFeatures: ['opencare.consent_records.manage'] },
    DELETE: { requireAuth: true, requireFeatures: ['opencare.consent_records.manage'] },
  },
  orm: {
    entity: ConsentRecord,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  events: { module: 'opencare', entity: 'consent_record', persistent: true },
  indexer: { entityType: ENTITY_ID },
  list: {
    schema: querySchema,
    entityId: ENTITY_ID,
    fields: listFields,
    sortFieldMap,
    buildFilters: async (q: Query): Promise<Where<BaseFields>> => {
      const filters: Where<BaseFields> = {}
      const F = filters as Record<string, WhereValue>
      if (q.ids) {
        const ids = q.ids.split(',').map((v) => v.trim()).filter((v) => v.length > 0)
        if (ids.length > 0) F.id = { $in: ids }
      }
      if (q.id) F.id = q.id
      if (q.careRecipientId) F.care_recipient_id = q.careRecipientId
      if (q.consentType) F.consent_type = q.consentType
      if (q.organizationId) F.organization_id = q.organizationId
      if (q.createdFrom || q.createdTo) {
        const range: { $gte?: Date; $lte?: Date } = {}
        if (q.createdFrom) range.$gte = new Date(q.createdFrom)
        if (q.createdTo) range.$lte = new Date(q.createdTo)
        F.created_at = range
      }
      return filters
    },
    transformItem: (item: BaseFields): ConsentRecordListItem => ({
      id: String(item.id),
      care_recipient_id: String(item.care_recipient_id),
      consent_type: String(item.consent_type),
      lawful_basis: String(item.lawful_basis),
      jurisdiction: String(item.jurisdiction),
      granted: Boolean(item.granted),
      granted_by: (item.granted_by as string | null) ?? null,
      evidence_attachment_id: (item.evidence_attachment_id as string | null) ?? null,
      granted_at: toIso(item.granted_at),
      expires_at: toIso(item.expires_at),
      revoked_at: toIso(item.revoked_at),
      tenant_id: (item.tenant_id as string | null) ?? null,
      organization_id: (item.organization_id as string | null) ?? null,
    }),
    allowCsv: true,
    csv: {
      headers: ['id', 'care_recipient_id', 'consent_type', 'lawful_basis', 'jurisdiction', 'granted', 'granted_at', 'expires_at', 'revoked_at', 'organization_id', 'tenant_id'],
      row: (t: ConsentRecordListItem) => [
        t.id, t.care_recipient_id, t.consent_type, t.lawful_basis, t.jurisdiction, String(t.granted),
        t.granted_at ?? '', t.expires_at ?? '', t.revoked_at ?? '', t.organization_id ?? '', t.tenant_id ?? '',
      ],
      filename: 'consent_records.csv',
    },
  },
  actions: {
    create: {
      commandId: 'opencare.consent_records.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.id) }),
      status: 201,
    },
    update: {
      commandId: 'opencare.consent_records.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'opencare.consent_records.delete',
      response: () => ({ ok: true }),
    },
  },
})

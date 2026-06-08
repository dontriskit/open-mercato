/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { CareRecipient } from '../../data/entities'
import type { Where, WhereValue } from '@open-mercato/shared/lib/query/types'
import type { CareRecipientListItem } from '../../types'

const ENTITY_ID = 'opencare:care_recipient' as const

const querySchema = z
  .object({
    id: z.string().uuid().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    ids: z.string().optional(),
    sortField: z.string().optional().default('display_name'),
    sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
    displayName: z.string().optional(),
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
  'id',
  'display_name',
  'national_id',
  'primary_email',
  'phone',
  'date_of_birth',
  'gdpr_legal_basis',
  'tenant_id',
  'organization_id',
  'created_at',
]

const sortFieldMap: Record<string, unknown> = {
  id: 'id',
  display_name: 'display_name',
  national_id: 'national_id',
  primary_email: 'primary_email',
  created_at: 'created_at',
}

type BaseFields = {
  id: string
  display_name: string
  national_id: string | null
  primary_email: string | null
  phone: string | null
  date_of_birth: string | null
  gdpr_legal_basis: string | null
  tenant_id: string | null
  organization_id: string | null
  created_at: Date
}

export const { metadata, GET, POST, PUT, DELETE } = makeCrudRoute({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['opencare.care_recipients.view'] },
    POST: { requireAuth: true, requireFeatures: ['opencare.care_recipients.manage'] },
    PUT: { requireAuth: true, requireFeatures: ['opencare.care_recipients.manage'] },
    DELETE: { requireAuth: true, requireFeatures: ['opencare.care_recipients.manage'] },
  },
  orm: {
    entity: CareRecipient,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  events: { module: 'opencare', entity: 'care_recipient', persistent: true },
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
      if (q.displayName) F.display_name = { $ilike: `%${q.displayName}%` }
      if (q.organizationId) F.organization_id = q.organizationId
      if (q.createdFrom || q.createdTo) {
        const range: { $gte?: Date; $lte?: Date } = {}
        if (q.createdFrom) range.$gte = new Date(q.createdFrom)
        if (q.createdTo) range.$lte = new Date(q.createdTo)
        F.created_at = range
      }
      return filters
    },
    transformItem: (item: BaseFields): CareRecipientListItem => ({
      id: String(item.id),
      display_name: String(item.display_name),
      national_id: (item.national_id as string | null) ?? null,
      primary_email: (item.primary_email as string | null) ?? null,
      phone: (item.phone as string | null) ?? null,
      date_of_birth: (item.date_of_birth as string | null) ?? null,
      gdpr_legal_basis: (item.gdpr_legal_basis as string | null) ?? null,
      tenant_id: (item.tenant_id as string | null) ?? null,
      organization_id: (item.organization_id as string | null) ?? null,
    }),
    allowCsv: true,
    csv: {
      headers: ['id', 'display_name', 'national_id', 'primary_email', 'phone', 'date_of_birth', 'gdpr_legal_basis', 'organization_id', 'tenant_id'],
      row: (t: CareRecipientListItem) => [
        t.id,
        t.display_name,
        t.national_id ?? '',
        t.primary_email ?? '',
        t.phone ?? '',
        t.date_of_birth ?? '',
        t.gdpr_legal_basis ?? '',
        t.organization_id ?? '',
        t.tenant_id ?? '',
      ],
      filename: 'care_recipients.csv',
    },
  },
  actions: {
    create: {
      commandId: 'opencare.care_recipients.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.id) }),
      status: 201,
    },
    update: {
      commandId: 'opencare.care_recipients.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'opencare.care_recipients.delete',
      response: () => ({ ok: true }),
    },
  },
})

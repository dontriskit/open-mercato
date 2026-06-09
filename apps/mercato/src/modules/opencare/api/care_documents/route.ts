/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { CareDocument } from '../../data/entities'
import type { Where, WhereValue } from '@open-mercato/shared/lib/query/types'
import type { CareDocumentListItem } from '../../types'

const ENTITY_ID = 'opencare:care_document' as const

const querySchema = z
  .object({
    id: z.string().uuid().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    ids: z.string().optional(),
    sortField: z.string().optional().default('title'),
    sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
    title: z.string().optional(),
    careRecipientId: z.string().uuid().optional(),
    withDeleted: z.coerce.boolean().optional().default(false),
    organizationId: z.string().uuid().optional(),
    createdFrom: z.string().optional(),
    createdTo: z.string().optional(),
    format: z.enum(['json', 'csv']).optional(),
  })
  .passthrough()

const rawBodySchema = z.object({}).passthrough()

type Query = z.infer<typeof querySchema>

const listFields = ['id', 'care_recipient_id', 'attachment_id', 'title', 'tenant_id', 'organization_id', 'created_at']

const sortFieldMap: Record<string, unknown> = {
  id: 'id',
  title: 'title',
  created_at: 'created_at',
}

type BaseFields = {
  id: string
  care_recipient_id: string
  attachment_id: string
  title: string
  tenant_id: string | null
  organization_id: string | null
  created_at: Date
}

export const { metadata, GET, POST, PUT, DELETE } = makeCrudRoute({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['opencare.care_documents.view'] },
    POST: { requireAuth: true, requireFeatures: ['opencare.care_documents.manage'] },
    PUT: { requireAuth: true, requireFeatures: ['opencare.care_documents.manage'] },
    DELETE: { requireAuth: true, requireFeatures: ['opencare.care_documents.manage'] },
  },
  orm: {
    entity: CareDocument,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  events: { module: 'opencare', entity: 'care_document', persistent: true },
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
      if (q.title) F.title = { $ilike: `%${q.title}%` }
      if (q.careRecipientId) F.care_recipient_id = q.careRecipientId
      if (q.organizationId) F.organization_id = q.organizationId
      if (q.createdFrom || q.createdTo) {
        const range: { $gte?: Date; $lte?: Date } = {}
        if (q.createdFrom) range.$gte = new Date(q.createdFrom)
        if (q.createdTo) range.$lte = new Date(q.createdTo)
        F.created_at = range
      }
      return filters
    },
    transformItem: (item: BaseFields): CareDocumentListItem => ({
      id: String(item.id),
      care_recipient_id: String(item.care_recipient_id),
      attachment_id: String(item.attachment_id),
      title: String(item.title),
      tenant_id: (item.tenant_id as string | null) ?? null,
      organization_id: (item.organization_id as string | null) ?? null,
    }),
    allowCsv: true,
    csv: {
      headers: ['id', 'care_recipient_id', 'attachment_id', 'title', 'organization_id', 'tenant_id'],
      row: (t: CareDocumentListItem) => [
        t.id, t.care_recipient_id, t.attachment_id, t.title, t.organization_id ?? '', t.tenant_id ?? '',
      ],
      filename: 'care_documents.csv',
    },
  },
  actions: {
    create: {
      commandId: 'opencare.care_documents.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.id) }),
      status: 201,
    },
    update: {
      commandId: 'opencare.care_documents.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'opencare.care_documents.delete',
      response: () => ({ ok: true }),
    },
  },
})

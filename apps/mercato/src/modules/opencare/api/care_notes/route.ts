/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { CareNote } from '../../data/entities'
import type { Where, WhereValue } from '@open-mercato/shared/lib/query/types'
import type { CareNoteListItem } from '../../types'

const ENTITY_ID = 'opencare:care_note' as const

const querySchema = z
  .object({
    id: z.string().uuid().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    ids: z.string().optional(),
    sortField: z.string().optional().default('created_at'),
    sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
    careRecipientId: z.string().uuid().optional(),
    careEpisodeId: z.string().uuid().optional(),
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
  'id', 'care_episode_id', 'care_recipient_id', 'body', 'authored_by',
  'tenant_id', 'organization_id', 'created_at',
]

const sortFieldMap: Record<string, unknown> = {
  id: 'id',
  created_at: 'created_at',
}

type BaseFields = {
  id: string
  care_episode_id: string
  care_recipient_id: string
  body: string
  authored_by: string | null
  tenant_id: string | null
  organization_id: string | null
  created_at: Date
}

export const { metadata, GET, POST, PUT, DELETE } = makeCrudRoute({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['opencare.care_notes.view'] },
    POST: { requireAuth: true, requireFeatures: ['opencare.care_notes.manage'] },
    PUT: { requireAuth: true, requireFeatures: ['opencare.care_notes.manage'] },
    DELETE: { requireAuth: true, requireFeatures: ['opencare.care_notes.manage'] },
  },
  orm: {
    entity: CareNote,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  events: { module: 'opencare', entity: 'care_note', persistent: true },
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
      if (q.careEpisodeId) F.care_episode_id = q.careEpisodeId
      if (q.organizationId) F.organization_id = q.organizationId
      if (q.createdFrom || q.createdTo) {
        const range: { $gte?: Date; $lte?: Date } = {}
        if (q.createdFrom) range.$gte = new Date(q.createdFrom)
        if (q.createdTo) range.$lte = new Date(q.createdTo)
        F.created_at = range
      }
      return filters
    },
    transformItem: (item: BaseFields): CareNoteListItem => ({
      id: String(item.id),
      care_episode_id: String(item.care_episode_id),
      care_recipient_id: String(item.care_recipient_id),
      body: String(item.body ?? ''),
      authored_by: (item.authored_by as string | null) ?? null,
      tenant_id: (item.tenant_id as string | null) ?? null,
      organization_id: (item.organization_id as string | null) ?? null,
    }),
    allowCsv: true,
    csv: {
      headers: ['id', 'care_episode_id', 'care_recipient_id', 'body', 'authored_by', 'organization_id', 'tenant_id'],
      row: (t: CareNoteListItem) => [
        t.id, t.care_episode_id, t.care_recipient_id, t.body, t.authored_by ?? '', t.organization_id ?? '', t.tenant_id ?? '',
      ],
      filename: 'care_notes.csv',
    },
  },
  actions: {
    create: {
      commandId: 'opencare.care_notes.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.id) }),
      status: 201,
    },
    update: {
      commandId: 'opencare.care_notes.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'opencare.care_notes.delete',
      response: () => ({ ok: true }),
    },
  },
})

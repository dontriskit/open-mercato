/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { CareEpisode } from '../../data/entities'
import type { Where, WhereValue } from '@open-mercato/shared/lib/query/types'
import type { CareEpisodeListItem } from '../../types'

const ENTITY_ID = 'opencare:care_episode' as const

const querySchema = z
  .object({
    id: z.string().uuid().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    ids: z.string().optional(),
    sortField: z.string().optional().default('started_at'),
    sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
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

const listFields = [
  'id', 'care_recipient_id', 'care_setting_id', 'responsible_staff_id',
  'started_at', 'ended_at', 'diagnosis_summary', 'tenant_id', 'organization_id', 'created_at',
]

const sortFieldMap: Record<string, unknown> = {
  id: 'id',
  started_at: 'started_at',
  ended_at: 'ended_at',
  created_at: 'created_at',
}

type BaseFields = {
  id: string
  care_recipient_id: string
  care_setting_id: string
  responsible_staff_id: string | null
  started_at: Date | null
  ended_at: Date | null
  diagnosis_summary: string | null
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
    GET: { requireAuth: true, requireFeatures: ['opencare.care_episodes.view'] },
    POST: { requireAuth: true, requireFeatures: ['opencare.care_episodes.manage'] },
    PUT: { requireAuth: true, requireFeatures: ['opencare.care_episodes.manage'] },
    DELETE: { requireAuth: true, requireFeatures: ['opencare.care_episodes.manage'] },
  },
  orm: {
    entity: CareEpisode,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  events: { module: 'opencare', entity: 'care_episode', persistent: true },
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
      if (q.organizationId) F.organization_id = q.organizationId
      if (q.createdFrom || q.createdTo) {
        const range: { $gte?: Date; $lte?: Date } = {}
        if (q.createdFrom) range.$gte = new Date(q.createdFrom)
        if (q.createdTo) range.$lte = new Date(q.createdTo)
        F.created_at = range
      }
      return filters
    },
    transformItem: (item: BaseFields): CareEpisodeListItem => ({
      id: String(item.id),
      care_recipient_id: String(item.care_recipient_id),
      care_setting_id: String(item.care_setting_id),
      responsible_staff_id: (item.responsible_staff_id as string | null) ?? null,
      started_at: toIso(item.started_at),
      ended_at: toIso(item.ended_at),
      diagnosis_summary: (item.diagnosis_summary as string | null) ?? null,
      tenant_id: (item.tenant_id as string | null) ?? null,
      organization_id: (item.organization_id as string | null) ?? null,
    }),
    allowCsv: true,
    csv: {
      headers: ['id', 'care_recipient_id', 'care_setting_id', 'responsible_staff_id', 'started_at', 'ended_at', 'organization_id', 'tenant_id'],
      row: (t: CareEpisodeListItem) => [
        t.id, t.care_recipient_id, t.care_setting_id, t.responsible_staff_id ?? '',
        t.started_at ?? '', t.ended_at ?? '', t.organization_id ?? '', t.tenant_id ?? '',
      ],
      filename: 'care_episodes.csv',
    },
  },
  actions: {
    create: {
      commandId: 'opencare.care_episodes.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.id) }),
      status: 201,
    },
    update: {
      commandId: 'opencare.care_episodes.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'opencare.care_episodes.delete',
      response: () => ({ ok: true }),
    },
  },
})

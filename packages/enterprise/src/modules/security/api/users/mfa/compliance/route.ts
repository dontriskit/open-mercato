import { NextResponse } from 'next/server'
import { z } from 'zod'
import { buildSecurityOpenApi, securityErrorSchema } from '../../../openapi'
import { securityApiError } from '../../../i18n'
import { mapSecurityUsersError, resolveSecurityUsersContext } from '../../_shared'
import type { MfaAdminAuthScope } from '../../../../services/MfaAdminService'

const querySchema = z.object({
  tenantId: z.string().uuid().optional(),
})

const complianceItemSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  enrolled: z.boolean(),
  methodCount: z.number().int().nonnegative(),
  compliant: z.boolean(),
  lastLoginAt: z.string().datetime().optional(),
})

const complianceListResponseSchema = z.object({
  items: z.array(complianceItemSchema),
})

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['security.admin.manage'] },
}

export async function GET(req: Request) {
  const context = await resolveSecurityUsersContext(req)
  if (context instanceof NextResponse) return context

  const url = new URL(req.url)
  const parsedQuery = querySchema.safeParse({
    tenantId: url.searchParams.get('tenantId') ?? undefined,
  })
  if (!parsedQuery.success) {
    return securityApiError(400, 'Invalid query parameters', { issues: parsedQuery.error.issues })
  }

  const isSuperAdmin = (context.auth as { isSuperAdmin?: unknown }).isSuperAdmin === true
  const callerTenantId = (context.auth.tenantId as string | null | undefined) ?? null
  const requestedTenantId = parsedQuery.data.tenantId ?? null

  let effectiveTenantId: string | null
  if (isSuperAdmin) {
    effectiveTenantId = requestedTenantId ?? callerTenantId
  } else {
    if (requestedTenantId && requestedTenantId !== callerTenantId) {
      return securityApiError(403, 'Cross-tenant access denied.')
    }
    effectiveTenantId = callerTenantId
  }

  if (!effectiveTenantId) {
    return securityApiError(400, 'Tenant context is required.')
  }

  const scope: MfaAdminAuthScope = {
    tenantId: callerTenantId,
    organizationId: (context.auth.orgId as string | null | undefined) ?? null,
    isSuperAdmin,
  }

  try {
    const items = await context.mfaAdminService.bulkComplianceCheck(effectiveTenantId, scope)
    return NextResponse.json({ items })
  } catch (error) {
    return await mapSecurityUsersError(error)
  }
}

export const openApi = buildSecurityOpenApi({
  summary: 'Admin users MFA compliance routes',
  methods: {
    GET: {
      summary: 'List MFA compliance for tenant users',
      query: querySchema,
      responses: [
        { status: 200, description: 'MFA compliance list', schema: complianceListResponseSchema },
      ],
      errors: [
        { status: 400, description: 'Invalid query or missing tenant context', schema: securityErrorSchema },
        { status: 401, description: 'Unauthorized', schema: securityErrorSchema },
        { status: 403, description: 'Cross-tenant access denied', schema: securityErrorSchema },
      ],
    },
  },
})

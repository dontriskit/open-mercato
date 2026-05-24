import { NextResponse } from 'next/server'
import { GET } from '../mfa/compliance/route'
import { resolveSecurityUsersContext } from '../_shared'

jest.mock('../_shared', () => ({
  resolveSecurityUsersContext: jest.fn(),
  mapSecurityUsersError: jest.fn((error: unknown) => {
    if (error instanceof Error && 'statusCode' in error) {
      const statusCode = (error as Error & { statusCode: number }).statusCode
      const body = 'body' in error ? (error as Error & { body?: unknown }).body : { error: error.message }
      return NextResponse.json(body, { status: statusCode })
    }
    return NextResponse.json({ error: 'Failed to process user security request.' }, { status: 500 })
  }),
}))

// Bypass the i18n bootstrap so the test can exercise the route's 400/403 paths
// without requiring the full module registry. The security fix lives in
// `mfa-compliance.route.test.ts` (this file) and `MfaAdminService.test.ts` —
// translation correctness is the i18n module's concern, not the route's.
jest.mock('../../../api/i18n', () => ({
  securityApiError: jest.fn((status: number, message: string, extra?: Record<string, unknown>) => {
    return NextResponse.json({ error: message, ...(extra ?? {}) }, { status })
  }),
  localizeSecurityApiBody: jest.fn(async <T>(body: T) => body),
  translateSecurityApiMessage: jest.fn(async (message: string) => message),
}))

const mockedResolveSecurityUsersContext = resolveSecurityUsersContext as jest.MockedFunction<typeof resolveSecurityUsersContext>

const tenantA = '11111111-1111-4111-8111-111111111111'
const tenantB = '22222222-2222-4222-8222-222222222222'

function buildContext(opts: {
  auth: { sub: string; tenantId: string | null; orgId: string | null; isSuperAdmin?: boolean }
  bulkComplianceCheck: jest.Mock
}) {
  return {
    auth: opts.auth,
    container: {
      resolve: (name: string) => {
        throw new Error(`Unexpected dependency: ${name}`)
      },
    },
    commandContext: {} as never,
    mfaAdminService: {
      bulkComplianceCheck: opts.bulkComplianceCheck,
    },
  } as never
}

describe('security user mfa compliance route', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('returns 403 when a non-superadmin supplies a different tenantId query param and never invokes the service', async () => {
    const bulkComplianceCheck = jest.fn()
    mockedResolveSecurityUsersContext.mockResolvedValue(
      buildContext({
        auth: { sub: 'admin-1', tenantId: tenantA, orgId: 'org-1', isSuperAdmin: false },
        bulkComplianceCheck,
      }),
    )

    const req = new Request(`https://example.test/api/security/users/mfa/compliance?tenantId=${tenantB}`)

    const response = await GET(req)

    expect(response.status).toBe(403)
    expect(bulkComplianceCheck).not.toHaveBeenCalled()
  })

  test('non-superadmin without a tenantId query falls back to the session tenant and passes scope to the service', async () => {
    const bulkComplianceCheck = jest.fn().mockResolvedValue([])
    mockedResolveSecurityUsersContext.mockResolvedValue(
      buildContext({
        auth: { sub: 'admin-1', tenantId: tenantA, orgId: 'org-1', isSuperAdmin: false },
        bulkComplianceCheck,
      }),
    )

    const req = new Request('https://example.test/api/security/users/mfa/compliance')

    const response = await GET(req)

    expect(response.status).toBe(200)
    expect(bulkComplianceCheck).toHaveBeenCalledTimes(1)
    expect(bulkComplianceCheck).toHaveBeenCalledWith(tenantA, {
      tenantId: tenantA,
      organizationId: 'org-1',
      isSuperAdmin: false,
    })
  })

  test('superadmin can query a different tenant via ?tenantId=', async () => {
    const bulkComplianceCheck = jest.fn().mockResolvedValue([])
    mockedResolveSecurityUsersContext.mockResolvedValue(
      buildContext({
        auth: { sub: 'root-1', tenantId: null, orgId: null, isSuperAdmin: true },
        bulkComplianceCheck,
      }),
    )

    const req = new Request(`https://example.test/api/security/users/mfa/compliance?tenantId=${tenantB}`)

    const response = await GET(req)

    expect(response.status).toBe(200)
    expect(bulkComplianceCheck).toHaveBeenCalledTimes(1)
    expect(bulkComplianceCheck).toHaveBeenCalledWith(tenantB, {
      tenantId: null,
      organizationId: null,
      isSuperAdmin: true,
    })
  })

  test('non-superadmin with a matching ?tenantId= is accepted and forwards the session scope', async () => {
    const bulkComplianceCheck = jest.fn().mockResolvedValue([])
    mockedResolveSecurityUsersContext.mockResolvedValue(
      buildContext({
        auth: { sub: 'admin-1', tenantId: tenantA, orgId: 'org-1', isSuperAdmin: false },
        bulkComplianceCheck,
      }),
    )

    const req = new Request(`https://example.test/api/security/users/mfa/compliance?tenantId=${tenantA}`)

    const response = await GET(req)

    expect(response.status).toBe(200)
    expect(bulkComplianceCheck).toHaveBeenCalledWith(tenantA, {
      tenantId: tenantA,
      organizationId: 'org-1',
      isSuperAdmin: false,
    })
  })

  test('returns 400 when no tenant context is available (non-superadmin without session tenant or query)', async () => {
    const bulkComplianceCheck = jest.fn()
    mockedResolveSecurityUsersContext.mockResolvedValue(
      buildContext({
        auth: { sub: 'orphan-1', tenantId: null, orgId: null, isSuperAdmin: false },
        bulkComplianceCheck,
      }),
    )

    const req = new Request('https://example.test/api/security/users/mfa/compliance')

    const response = await GET(req)

    expect(response.status).toBe(400)
    expect(bulkComplianceCheck).not.toHaveBeenCalled()
  })
})

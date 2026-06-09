import { asClass } from 'awilix'
import type { AppContainer } from '@open-mercato/shared/lib/di/container'
import { ComplianceKitService } from './lib/compliance-kit-service'

export function register(container: AppContainer) {
  container.register({
    complianceKitService: asClass(ComplianceKitService).scoped(),
  })
}

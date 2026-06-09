import type { ModuleEncryptionMap } from '@open-mercato/shared/modules/encryption'

// pl-rodo inherits all encrypted fields from the eu-gdpr baseline via `extends`.
// This module contributes no additional encrypted columns; the file is kept so
// the compliance_kit `compliance.encryptionMaps` generator convention
// (compliance.encryption.ts) is satisfied, matching the eu-gdpr pack's shape.
export const defaultEncryptionMaps: ModuleEncryptionMap[] = []

export default defaultEncryptionMaps

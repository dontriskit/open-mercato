export const metadata = {
  requireAuth: true,
  requireFeatures: ['opencare.consent_records.manage'],
  pageTitle: 'Edit consent record',
  pageTitleKey: 'opencare.consent_records.edit.title',
  pageGroup: 'OpenCare',
  pageGroupKey: 'opencare.nav.group',
  breadcrumb: [
    { label: 'Consent records', labelKey: 'opencare.consent_records.page.title', href: '/backend/consent_records' },
    { label: 'Edit', labelKey: 'opencare.consent_records.edit.title' },
  ],
}

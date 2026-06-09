import React from 'react'

const plusIcon = React.createElement(
  'svg',
  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
  React.createElement('path', { d: 'M12 5v14M5 12h14' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['opencare.consent_records.manage'],
  pageTitle: 'Create consent record',
  pageTitleKey: 'opencare.consent_records.create.title',
  pageGroup: 'OpenCare',
  pageGroupKey: 'opencare.nav.group',
  pageOrder: 161,
  icon: plusIcon,
  breadcrumb: [
    { label: 'Consent records', labelKey: 'opencare.consent_records.page.title', href: '/backend/consent_records' },
    { label: 'Create', labelKey: 'opencare.consent_records.create.title' },
  ],
}

import React from 'react'

const icon = React.createElement(
  'svg',
  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
  React.createElement('path', { d: 'M9 12l2 2 4-4' }),
  React.createElement('path', { d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['opencare.consent_records.view'],
  pageTitle: 'Consent records',
  pageTitleKey: 'opencare.consent_records.page.title',
  pageGroup: 'OpenCare',
  pageGroupKey: 'opencare.nav.group',
  pageOrder: 160,
  icon,
  breadcrumb: [
    { label: 'Consent records', labelKey: 'opencare.consent_records.page.title' },
  ],
}

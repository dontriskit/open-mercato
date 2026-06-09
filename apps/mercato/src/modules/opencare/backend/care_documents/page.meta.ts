import React from 'react'

const icon = React.createElement(
  'svg',
  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
  React.createElement('path', { d: 'M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['opencare.care_documents.view'],
  pageTitle: 'Care documents',
  pageTitleKey: 'opencare.care_documents.page.title',
  pageGroup: 'OpenCare',
  pageGroupKey: 'opencare.nav.group',
  pageOrder: 150,
  icon,
  breadcrumb: [
    { label: 'Care documents', labelKey: 'opencare.care_documents.page.title' },
  ],
}

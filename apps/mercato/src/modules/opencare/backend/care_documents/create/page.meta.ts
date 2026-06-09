import React from 'react'

const plusIcon = React.createElement(
  'svg',
  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
  React.createElement('path', { d: 'M12 5v14M5 12h14' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['opencare.care_documents.manage'],
  pageTitle: 'Create care document',
  pageTitleKey: 'opencare.care_documents.create.title',
  pageGroup: 'OpenCare',
  pageGroupKey: 'opencare.nav.group',
  pageOrder: 151,
  icon: plusIcon,
  breadcrumb: [
    { label: 'Care documents', labelKey: 'opencare.care_documents.page.title', href: '/backend/care_documents' },
    { label: 'Create', labelKey: 'opencare.care_documents.create.title' },
  ],
}

import React from 'react'

const plusIcon = React.createElement(
  'svg',
  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
  React.createElement('path', { d: 'M12 5v14M5 12h14' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['opencare.care_notes.manage'],
  pageTitle: 'Create care note',
  pageTitleKey: 'opencare.care_notes.create.title',
  pageGroup: 'OpenCare',
  pageGroupKey: 'opencare.nav.group',
  pageOrder: 141,
  icon: plusIcon,
  breadcrumb: [
    { label: 'Care notes', labelKey: 'opencare.care_notes.page.title', href: '/backend/care_notes' },
    { label: 'Create', labelKey: 'opencare.care_notes.create.title' },
  ],
}

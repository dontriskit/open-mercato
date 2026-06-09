import React from 'react'

const icon = React.createElement(
  'svg',
  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
  React.createElement('path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }),
  React.createElement('path', { d: 'M14 2v6h6M8 13h8M8 17h8' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['opencare.care_notes.view'],
  pageTitle: 'Care notes',
  pageTitleKey: 'opencare.care_notes.page.title',
  pageGroup: 'OpenCare',
  pageGroupKey: 'opencare.nav.group',
  pageOrder: 140,
  icon,
  breadcrumb: [
    { label: 'Care notes', labelKey: 'opencare.care_notes.page.title' },
  ],
}

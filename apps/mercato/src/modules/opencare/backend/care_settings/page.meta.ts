import React from 'react'

const icon = React.createElement(
  'svg',
  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
  React.createElement('path', { d: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' }),
  React.createElement('polyline', { points: '9 22 9 12 15 12 15 22' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['opencare.care_settings.view'],
  pageTitle: 'Care settings',
  pageTitleKey: 'opencare.care_settings.page.title',
  pageGroup: 'OpenCare',
  pageGroupKey: 'opencare.nav.group',
  pageOrder: 120,
  icon,
  breadcrumb: [
    { label: 'Care settings', labelKey: 'opencare.care_settings.page.title' },
  ],
}

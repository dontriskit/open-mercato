import React from 'react'

const plusIcon = React.createElement(
  'svg',
  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
  React.createElement('path', { d: 'M12 5v14M5 12h14' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['opencare.care_settings.manage'],
  pageTitle: 'Create care setting',
  pageTitleKey: 'opencare.care_settings.create.title',
  pageGroup: 'OpenCare',
  pageGroupKey: 'opencare.nav.group',
  pageOrder: 121,
  icon: plusIcon,
  breadcrumb: [
    { label: 'Care settings', labelKey: 'opencare.care_settings.page.title', href: '/backend/care_settings' },
    { label: 'Create', labelKey: 'opencare.care_settings.create.title' },
  ],
}

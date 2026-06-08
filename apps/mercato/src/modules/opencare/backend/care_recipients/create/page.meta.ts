import React from 'react'

const plusIcon = React.createElement(
  'svg',
  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
  React.createElement('path', { d: 'M12 5v14M5 12h14' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['opencare.care_recipients.manage'],
  pageTitle: 'Create care recipient',
  pageTitleKey: 'opencare.care_recipients.create.title',
  pageGroup: 'OpenCare',
  pageGroupKey: 'opencare.nav.group',
  pageOrder: 111,
  icon: plusIcon,
  breadcrumb: [
    { label: 'Care recipients', labelKey: 'opencare.care_recipients.page.title', href: '/backend/care_recipients' },
    { label: 'Create', labelKey: 'opencare.care_recipients.create.title' },
  ],
}

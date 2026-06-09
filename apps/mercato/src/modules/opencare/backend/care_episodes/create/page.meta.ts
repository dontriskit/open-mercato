import React from 'react'

const plusIcon = React.createElement(
  'svg',
  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
  React.createElement('path', { d: 'M12 5v14M5 12h14' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['opencare.care_episodes.manage'],
  pageTitle: 'Create care episode',
  pageTitleKey: 'opencare.care_episodes.create.title',
  pageGroup: 'OpenCare',
  pageGroupKey: 'opencare.nav.group',
  pageOrder: 131,
  icon: plusIcon,
  breadcrumb: [
    { label: 'Care episodes', labelKey: 'opencare.care_episodes.page.title', href: '/backend/care_episodes' },
    { label: 'Create', labelKey: 'opencare.care_episodes.create.title' },
  ],
}

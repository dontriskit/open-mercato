import React from 'react'

const icon = React.createElement(
  'svg',
  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
  React.createElement('rect', { x: 3, y: 4, width: 18, height: 18, rx: 2 }),
  React.createElement('path', { d: 'M16 2v4M8 2v4M3 10h18' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['opencare.care_episodes.view'],
  pageTitle: 'Care episodes',
  pageTitleKey: 'opencare.care_episodes.page.title',
  pageGroup: 'OpenCare',
  pageGroupKey: 'opencare.nav.group',
  pageOrder: 130,
  icon,
  breadcrumb: [
    { label: 'Care episodes', labelKey: 'opencare.care_episodes.page.title' },
  ],
}

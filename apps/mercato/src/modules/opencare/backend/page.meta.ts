import React from 'react'

const heart = React.createElement(
  'svg',
  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
  React.createElement('path', {
    d: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
  })
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['opencare.backend'],
  pageTitle: 'OpenCare',
  pageGroup: 'OpenCare',
  pageOrder: 100,
  icon: heart,
}

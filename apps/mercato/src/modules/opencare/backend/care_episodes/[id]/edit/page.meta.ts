export const metadata = {
  requireAuth: true,
  requireFeatures: ['opencare.care_episodes.manage'],
  pageTitle: 'Edit care episode',
  pageTitleKey: 'opencare.care_episodes.edit.title',
  pageGroup: 'OpenCare',
  pageGroupKey: 'opencare.nav.group',
  breadcrumb: [
    { label: 'Care episodes', labelKey: 'opencare.care_episodes.page.title', href: '/backend/care_episodes' },
    { label: 'Edit', labelKey: 'opencare.care_episodes.edit.title' },
  ],
}

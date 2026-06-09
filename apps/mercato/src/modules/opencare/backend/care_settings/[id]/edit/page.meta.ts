export const metadata = {
  requireAuth: true,
  requireFeatures: ['opencare.care_settings.manage'],
  pageTitle: 'Edit care setting',
  pageTitleKey: 'opencare.care_settings.edit.title',
  pageGroup: 'OpenCare',
  pageGroupKey: 'opencare.nav.group',
  breadcrumb: [
    { label: 'Care settings', labelKey: 'opencare.care_settings.page.title', href: '/backend/care_settings' },
    { label: 'Edit', labelKey: 'opencare.care_settings.edit.title' },
  ],
}

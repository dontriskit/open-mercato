export const metadata = {
  requireAuth: true,
  requireFeatures: ['opencare.care_recipients.manage'],
  pageTitle: 'Edit care recipient',
  pageTitleKey: 'opencare.care_recipients.edit.title',
  pageGroup: 'OpenCare',
  pageGroupKey: 'opencare.nav.group',
  breadcrumb: [
    { label: 'Care recipients', labelKey: 'opencare.care_recipients.page.title', href: '/backend/care_recipients' },
    { label: 'Edit', labelKey: 'opencare.care_recipients.edit.title' },
  ],
}

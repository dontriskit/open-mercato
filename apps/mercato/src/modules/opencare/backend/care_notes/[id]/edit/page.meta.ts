export const metadata = {
  requireAuth: true,
  requireFeatures: ['opencare.care_notes.manage'],
  pageTitle: 'Edit care note',
  pageTitleKey: 'opencare.care_notes.edit.title',
  pageGroup: 'OpenCare',
  pageGroupKey: 'opencare.nav.group',
  breadcrumb: [
    { label: 'Care notes', labelKey: 'opencare.care_notes.page.title', href: '/backend/care_notes' },
    { label: 'Edit', labelKey: 'opencare.care_notes.edit.title' },
  ],
}

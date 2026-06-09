export const metadata = {
  requireAuth: true,
  requireFeatures: ['opencare.care_documents.manage'],
  pageTitle: 'Edit care document',
  pageTitleKey: 'opencare.care_documents.edit.title',
  pageGroup: 'OpenCare',
  pageGroupKey: 'opencare.nav.group',
  breadcrumb: [
    { label: 'Care documents', labelKey: 'opencare.care_documents.page.title', href: '/backend/care_documents' },
    { label: 'Edit', labelKey: 'opencare.care_documents.edit.title' },
  ],
}

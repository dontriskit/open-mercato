export const features = [
  { id: 'opencare.backend', title: 'Access OpenCare backend', module: 'opencare' },
  { id: 'opencare.care_recipients.view', title: 'View care recipients', module: 'opencare' },
  {
    id: 'opencare.care_recipients.manage',
    title: 'Manage care recipients',
    module: 'opencare',
    dependsOn: ['opencare.care_recipients.view'],
  },
]

export default features

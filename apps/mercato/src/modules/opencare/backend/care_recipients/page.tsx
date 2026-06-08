import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import CareRecipientsTable from '../../components/CareRecipientsTable'

export default function CareRecipientsPage() {
  return (
    <Page>
      <PageBody>
        <CareRecipientsTable />
      </PageBody>
    </Page>
  )
}

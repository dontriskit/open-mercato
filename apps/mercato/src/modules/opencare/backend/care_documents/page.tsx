import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import CareDocumentsTable from '../../components/CareDocumentsTable'

export default function CareDocumentsPage() {
  return (
    <Page>
      <PageBody>
        <CareDocumentsTable />
      </PageBody>
    </Page>
  )
}

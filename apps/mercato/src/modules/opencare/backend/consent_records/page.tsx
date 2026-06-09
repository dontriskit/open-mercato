import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import ConsentRecordsTable from '../../components/ConsentRecordsTable'

export default function ConsentRecordsPage() {
  return (
    <Page>
      <PageBody>
        <ConsentRecordsTable />
      </PageBody>
    </Page>
  )
}

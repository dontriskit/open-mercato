import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import CareNotesTable from '../../components/CareNotesTable'

export default function CareNotesPage() {
  return (
    <Page>
      <PageBody>
        <CareNotesTable />
      </PageBody>
    </Page>
  )
}

"use client"
import * as React from 'react'
import { Page, PageHeader, PageBody } from '@open-mercato/ui/backend/Page'
import Link from 'next/link'

export default function OpenCareHome() {
  return (
    <Page>
      <PageHeader
        title="OpenCare"
        description="Care-provider workspace built on Open Mercato."
      />
      <PageBody>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border p-4">
            <div className="text-2xl font-semibold">—</div>
            <div className="text-sm text-muted-foreground">Active patients</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-2xl font-semibold">—</div>
            <div className="text-sm text-muted-foreground">Open care plans</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-2xl font-semibold">—</div>
            <div className="text-sm text-muted-foreground">Appointments today</div>
          </div>
        </div>

        <div className="mt-6 rounded-lg border p-4">
          <div className="text-sm font-medium mb-2">Quick links</div>
          <ul className="list-disc list-inside text-sm space-y-1">
            <li>
              <Link className="underline" href="/backend/care_recipients">
                Care recipients
              </Link>
            </li>
            <li>
              <Link className="underline" href="/backend/planner">
                Scheduling (Planner)
              </Link>
            </li>
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            This page lives in <code>apps/mercato/src/modules/opencare/</code> — your customization
            surface. Core packages are untouched, so upstream updates stay clean.
          </p>
        </div>
      </PageBody>
    </Page>
  )
}

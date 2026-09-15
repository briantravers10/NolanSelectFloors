"use client";

import Link from "next/link";
import { useState } from "react";
import type { ScheduleJobRow } from "@/lib/schedule";
import type { Employee, WorkTypeRecord } from "@/lib/types";
import { COI_STATUSES, SCHEDULE_COLORS, SCHEDULE_JOB_STATUSES, SCHEDULE_MATERIALS_STATUSES } from "@/lib/types";
import { PhoneLink, Button } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { InlineSelect } from "./InlineSelect";
import { COI_CLASSES, JOB_STATUS_CLASSES, MATERIALS_CLASSES, SCHEDULE_COLOR_CLASSES } from "./badges";
import {
  setCoiStatusAction,
  setJobStatusAction,
  setMaterialsStatusAction,
  setScheduleColorAction,
  setScheduleNotesAction,
  setWorkTypeAction,
} from "@/app/schedule/actions";
import { AddCrewInline } from "./AddCrewInline";

export function ScheduleDayRowCard({
  row,
  workTypes,
  employees,
  defaultOpen = false,
}: {
  row: ScheduleJobRow;
  workTypes: WorkTypeRecord[];
  employees: Employee[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`border rounded-xl bg-white overflow-hidden ${SCHEDULE_COLOR_CLASSES[row.scheduleColor].split(" ").filter((c) => c.startsWith("border")).join(" ")}`}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full text-left px-3 py-2.5 flex flex-wrap items-center gap-2.5 hover:bg-slate-50">
        <InlineSelect
          name="schedule_color"
          defaultValue={row.scheduleColor}
          options={SCHEDULE_COLORS}
          action={setScheduleColorAction.bind(null, row.projectId, row.date)}
          className={SCHEDULE_COLOR_CLASSES[row.scheduleColor]}
        />

        <div className="min-w-0 flex-1">
          <Link href={`/projects/${row.projectId}`} onClick={(e) => e.stopPropagation()} className="font-medium text-sm text-slate-900 hover:text-sky-600 truncate block">
            {row.buildingName}
            {row.unitNumber ? ` — Unit ${row.unitNumber}` : ""}
          </Link>
          <div className="text-xs text-slate-500 truncate">{row.address} {row.clientName ? `· ${row.clientName}` : ""}</div>
        </div>

        <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-600 shrink-0">
          {row.contactName && <span>{row.contactName}</span>}
          <PhoneLink phone={row.contactPhone} className="text-xs" />
        </div>

        <div className="text-xs font-medium text-slate-700 shrink-0">Crew {row.crewCount}</div>

        <InlineSelect
          name="coi_status"
          defaultValue={row.coiStatus}
          options={COI_STATUSES}
          action={setCoiStatusAction.bind(null, row.projectId, row.date)}
          className={COI_CLASSES[row.coiStatus]}
        />
        <InlineSelect
          name="materials_status"
          defaultValue={row.materialsStatus}
          options={SCHEDULE_MATERIALS_STATUSES}
          action={setMaterialsStatusAction.bind(null, row.projectId, row.date)}
          className={MATERIALS_CLASSES[row.materialsStatus]}
        />
        <InlineSelect
          name="job_status"
          defaultValue={row.jobStatus}
          options={SCHEDULE_JOB_STATUSES}
          action={setJobStatusAction.bind(null, row.projectId, row.date)}
          className={JOB_STATUS_CLASSES[row.jobStatus]}
        />

        <Icon name={open ? "close" : "arrowRight"} className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? "" : "rotate-90"}`} />
      </button>

      {open && (
        <div className="border-t border-slate-100 px-3.5 py-3 space-y-3 bg-slate-50/60" onClick={(e) => e.stopPropagation()}>
          <div className="md:hidden flex items-center gap-1.5 text-xs text-slate-600">
            {row.contactName && <span>{row.contactName}</span>}
            <PhoneLink phone={row.contactPhone} className="text-xs" />
          </div>

          <div>
            <div className="text-[11px] font-medium text-slate-500 uppercase mb-1">Crew ({row.crewCount})</div>
            {row.crewCount > 0 ? (
              <div className="text-sm text-slate-800">{row.crewNames.join(", ")}</div>
            ) : (
              <div className="text-sm text-slate-400">No crew assigned yet.</div>
            )}
          </div>

          <AddCrewInline projectId={row.projectId} date={row.date} employees={employees} crew={row.crew} />

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <div className="text-[11px] font-medium text-slate-500 uppercase mb-1">Work Type</div>
              <InlineSelect
                name="work_type_id"
                defaultValue={workTypes.find((w) => w.name === row.workTypeName)?.id ?? ""}
                options={[{ value: "", label: "— Not set —" }, ...workTypes.filter((w) => w.active).map((w) => ({ value: w.id, label: w.name }))]}
                action={setWorkTypeAction.bind(null, row.projectId, row.date)}
                className="bg-white border-slate-300 text-slate-700 w-full"
              />
            </div>
          </div>

          <form action={setScheduleNotesAction.bind(null, row.projectId, row.date)} className="space-y-1">
            <div className="text-[11px] font-medium text-slate-500 uppercase">Notes</div>
            <textarea
              name="notes"
              defaultValue={row.notes ?? ""}
              rows={2}
              placeholder="Brief work description / notes for this day…"
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
            />
            <Button type="submit" variant="secondary" className="text-xs py-1">Save Notes</Button>
          </form>
        </div>
      )}
    </div>
  );
}

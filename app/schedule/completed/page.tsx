import {
  getCompletionNotes,
  listActualLaborEntries,
  listBuildingContacts,
  listBuildings,
  listClientCompanies,
  listContacts,
  listEmployees,
  listProjectNotes,
  listProjectScheduleDays,
  listProjects,
  listScheduleAssignments,
  listWorkTypes,
} from "@/lib/db";
import { Card, PageHeader, EmptyState } from "@/components/ui";
import { compileCompletedJobSummary } from "@/lib/schedule";
import { ScheduleSubNav } from "@/components/schedule/ScheduleSubNav";
import { CompletedJobCard } from "@/components/schedule/CompletedJobCard";

export default async function CompletedJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; employee?: string; workType?: string; date?: string }>;
}) {
  const { q, employee, workType, date } = await searchParams;
  const [projects, buildings, clients, contacts, buildingContacts, assignments, scheduleDays, actualLaborEntries, employees, projectNotes, workTypes] =
    await Promise.all([
      listProjects(),
      listBuildings(),
      listClientCompanies(),
      listContacts(),
      listBuildingContacts(),
      listScheduleAssignments(),
      listProjectScheduleDays(),
      listActualLaborEntries(),
      listEmployees(),
      listProjectNotes(),
      listWorkTypes(),
    ]);

  const buildingById = new Map(buildings.map((b) => [b.id, b]));
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const contactById = new Map(contacts.map((c) => [c.id, c]));
  function pointOfContact(buildingId: string) {
    const building = buildingById.get(buildingId);
    if (building?.primary_contact_id) {
      const c = contactById.get(building.primary_contact_id);
      if (c) return c;
    }
    const link = buildingContacts.find((bc) => bc.building_id === buildingId && bc.is_primary) ?? buildingContacts.find((bc) => bc.building_id === buildingId);
    return link ? contactById.get(link.contact_id) : undefined;
  }

  const completedProjects = projects.filter((p) => p.pipeline_stage === "Project Completed");

  const summaries = await Promise.all(
    completedProjects.map(async (project) => {
      const building = buildingById.get(project.building_id);
      const client = building ? clientById.get(building.client_company_id) : undefined;
      const contact = pointOfContact(project.building_id);
      const notes = projectNotes.filter((n) => n.project_id === project.id && n.author_name !== "Completion Notes").map((n) => n.body);
      const completionNotes = await getCompletionNotes(project.id);
      return compileCompletedJobSummary(project, {
        building,
        client,
        contact,
        assignments,
        scheduleDays,
        actualLaborEntries,
        employees,
        notes,
        completionNotes,
      });
    })
  );

  const filtered = summaries.filter((s) => {
    if (q) {
      const haystack = `${s.building?.name ?? ""} ${s.building?.address ?? ""} ${s.project.unit_number ?? ""} ${s.client?.name ?? ""}`.toLowerCase();
      if (!haystack.includes(q.toLowerCase())) return false;
    }
    if (employee && !s.labor.some((l) => l.employeeName.toLowerCase().includes(employee.toLowerCase()))) return false;
    if (workType) {
      const days = scheduleDays.filter((d) => d.project_id === s.project.id);
      const names = days.map((d) => workTypes.find((w) => w.id === d.work_type_id)?.name ?? "");
      if (!names.some((n) => n.toLowerCase().includes(workType.toLowerCase()))) return false;
    }
    if (date) {
      if (!(s.startDate && s.completionDate && s.startDate <= date && date <= s.completionDate)) return false;
    }
    return true;
  });

  return (
    <div>
      <PageHeader title="Completed Job Summary" subtitle="Auto-compiled from schedule, crew and actual-hours history — nothing here is re-entered by hand." />
      <ScheduleSubNav active="completed" />

      <Card className="p-4 mb-4">
        <form className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-[11px] text-slate-500 uppercase mb-1">Address / Unit / Management Company</label>
            <input name="q" defaultValue={q} placeholder="Search…" className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 uppercase mb-1">Employee</label>
            <input name="employee" defaultValue={employee} className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 uppercase mb-1">Work Type</label>
            <input name="workType" defaultValue={workType} className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 uppercase mb-1">Date (within job range)</label>
            <input type="date" name="date" defaultValue={date} className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
          </div>
          <div className="sm:col-span-4">
            <button type="submit" className="rounded-lg bg-sky-600 text-white px-3.5 py-2 text-sm font-medium hover:bg-sky-700">Filter</button>
          </div>
        </form>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState message="No completed jobs match these filters." />
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => <CompletedJobCard key={s.project.id} summary={s} />)}
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { listCompanySetupAnswers, listWorkTypes } from "@/lib/db";
import { QUESTIONNAIRE } from "@/lib/questionnaire";
import { Card, PageHeader, Button } from "@/components/ui";
import { saveQuestionnaireAction } from "./actions";
import { addWorkTypeAction, renameWorkTypeAction, toggleWorkTypeActiveAction } from "@/app/schedule/actions";
import { isOwnerActingUser, requireSectionAccess } from "@/lib/permissions";
import { AccessDenied } from "@/components/AccessDenied";
import { getActingUser } from "@/lib/current-user";

export default async function CompanySetupPage() {
  const access = await requireSectionAccess("company_setup");
  if (access === "none") return <AccessDenied section="Company Setup" />;

  const [answers, workTypes, actingUser] = await Promise.all([listCompanySetupAnswers(), listWorkTypes(), getActingUser()]);
  const isOwner = await isOwnerActingUser(actingUser);
  const answerMap = new Map(answers.map((a) => [`${a.section}__${a.question_key}`, a.answer]));

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Company Setup"
        subtitle="A one-time discovery questionnaire. Answers are saved and used to tailor the platform to how your office actually runs today."
      />

      <Card className="p-4 mb-6">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-1">Integrations</h2>
        <p className="text-xs text-slate-500 mb-3">Connect QuickBooks Online to bring customer, estimate, invoice and payment data onto each job.</p>
        <Link href="/company-setup/quickbooks">
          <Button variant="secondary">QuickBooks →</Button>
        </Link>
      </Card>

      {isOwner && (
        <Card className="p-4 mb-6">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-1">Staff Access</h2>
          <p className="text-xs text-slate-500 mb-3">
            Owner/Admin only. Give each staff member their own login persona and control what they can see and edit, section by section.
          </p>
          <Link href="/company-setup/staff-access">
            <Button variant="secondary">Staff Access →</Button>
          </Link>
        </Card>
      )}

      <Card className="p-4 mb-6">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-1">Work Types</h2>
        <p className="text-xs text-slate-500 mb-3">
          The work-type options shown on the Schedule. Add, rename, or deactivate as your services change — no code changes needed.
        </p>
        <div className="space-y-1.5 mb-3">
          {workTypes.map((wt) => (
            <div key={wt.id} className="flex items-center gap-2">
              <form action={renameWorkTypeAction.bind(null, wt.id)} className="flex-1 flex items-center gap-2">
                <input name="name" defaultValue={wt.name} className={`flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm ${wt.active ? "" : "text-slate-400"}`} />
                <button type="submit" className="text-xs text-sky-600 hover:underline">Rename</button>
              </form>
              <form action={toggleWorkTypeActiveAction.bind(null, wt.id, !wt.active)}>
                <button type="submit" className={`text-xs rounded-full px-2.5 py-1 font-medium ${wt.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>
                  {wt.active ? "Active" : "Inactive"}
                </button>
              </form>
            </div>
          ))}
        </div>
        <form action={addWorkTypeAction} className="flex items-center gap-2">
          <input name="name" required placeholder="New work type…" className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
          <Button type="submit" variant="secondary">Add</Button>
        </form>
      </Card>

      <form action={saveQuestionnaireAction} className="space-y-6">
        {QUESTIONNAIRE.map((section) => (
          <Card key={section.key} className="p-4">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">{section.title}</h2>
            <div className="space-y-4">
              {section.questions.map((q) => {
                const fieldName = `${section.key}__${q.key}`;
                return (
                  <div key={q.key}>
                    <label className="block text-sm text-slate-700 mb-1">{q.text}</label>
                    <textarea
                      name={fieldName}
                      defaultValue={answerMap.get(fieldName) ?? ""}
                      rows={2}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
        <div className="sticky bottom-20 md:bottom-4 flex justify-end">
          <Button type="submit">Save Answers</Button>
        </div>
      </form>
    </div>
  );
}

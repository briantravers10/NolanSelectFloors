import { listCompanySetupAnswers } from "@/lib/db";
import { QUESTIONNAIRE } from "@/lib/questionnaire";
import { Card, PageHeader, Button } from "@/components/ui";
import { saveQuestionnaireAction } from "./actions";

export default async function CompanySetupPage() {
  const answers = await listCompanySetupAnswers();
  const answerMap = new Map(answers.map((a) => [`${a.section}__${a.question_key}`, a.answer]));

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Company Setup"
        subtitle="A one-time discovery questionnaire. Answers are saved and used to tailor the platform to how your office actually runs today."
      />
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

"use server";

import { revalidatePath } from "next/cache";
import { saveCompanySetupAnswer } from "@/lib/db";
import { QUESTIONNAIRE } from "@/lib/questionnaire";

export async function saveQuestionnaireAction(formData: FormData) {
  for (const section of QUESTIONNAIRE) {
    for (const q of section.questions) {
      const fieldName = `${section.key}__${q.key}`;
      const value = formData.get(fieldName);
      if (value !== null) {
        await saveCompanySetupAnswer(section.key, q.key, String(value));
      }
    }
  }
  revalidatePath("/company-setup");
}

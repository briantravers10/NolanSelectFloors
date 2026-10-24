"use server";

import { revalidatePath } from "next/cache";
import { getActingUser } from "@/lib/current-user";
import { isOwnerActingUser } from "@/lib/permissions";

const REPO = "briantravers10/NolanSelectFloors";

/**
 * "Run QA Tests Now" — dispatches the same qa.yml GitHub Actions workflow
 * the twice-daily schedule uses (see .github/workflows/qa.yml), via
 * GitHub's workflow_dispatch REST API. Needs QA_GITHUB_DISPATCH_TOKEN (a
 * GitHub PAT scoped to Actions:write on this one repo, nothing else) set
 * as a Vercel env var — not configured yet, so this currently returns a
 * clear "not set up" message instead of failing silently. See
 * qa/README.md "Setup required".
 */
export async function runQaTestsNowAction(): Promise<{ ok: boolean; message: string }> {
  const actingUser = await getActingUser();
  if (!(await isOwnerActingUser(actingUser))) return { ok: false, message: "Not authorized." };

  const token = process.env.QA_GITHUB_DISPATCH_TOKEN;
  if (!token) {
    return {
      ok: false,
      message: "QA_GITHUB_DISPATCH_TOKEN isn't configured yet — see qa/README.md for what's needed to enable this button.",
    };
  }

  const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/qa.yml/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref: "main", inputs: { trigger_label: `manual (${actingUser.fullName})` } }),
  });

  if (!res.ok) {
    return { ok: false, message: `GitHub declined the request (${res.status}). Check the token's permissions.` };
  }

  revalidatePath("/qa");
  return { ok: true, message: "QA run triggered — it should appear on this dashboard within a few minutes." };
}

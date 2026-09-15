"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ACTING_USER_COOKIE } from "@/lib/current-user";

/**
 * Sets the dev "acting as" cookie the whole app reads via
 * lib/current-user.ts#getActingUser(). This is a placeholder for real
 * per-user auth — see README "Dev user selector" section.
 */
export async function setActingUserAction(formData: FormData) {
  const id = String(formData.get("acting_user_id") ?? "");
  const jar = await cookies();
  if (id) {
    jar.set(ACTING_USER_COOKIE, id, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  } else {
    jar.delete(ACTING_USER_COOKIE);
  }
  revalidatePath("/", "layout");
}

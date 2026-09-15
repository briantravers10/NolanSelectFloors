"use server";

import { revalidatePath } from "next/cache";
import { createTask, updateTaskStatus } from "@/lib/db";
import type { TaskStatus } from "@/lib/types";

export async function addTaskAction(formData: FormData) {
  const title = String(formData.get("title") ?? "");
  if (!title.trim()) return;
  await createTask({ title, due_date: String(formData.get("due_date") ?? "") || undefined });
  revalidatePath("/tasks");
}

export async function setTaskStatusAction(id: string, status: TaskStatus) {
  await updateTaskStatus(id, status);
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

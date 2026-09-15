import { COMPANY_ID } from "./seed-data";

// Placeholder auth context. There is no login flow yet — the whole app
// operates as this single company/user. When real auth (Supabase Auth +
// the `users` table + role-based access) is added, swap the body of these
// two functions to read the session instead, and every call site that
// already scopes by companyId will keep working unchanged.

export function getCurrentCompanyId(): string {
  return COMPANY_ID;
}

export function getCurrentUser() {
  return {
    id: "user-1",
    fullName: "Brian Travers",
    email: "travers.brian10@gmail.com",
    role: "company_owner" as const,
  };
}

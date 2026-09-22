import "server-only";
import { cache } from "react";
import { listOfficeUsers, listSectionPermissions, getOfficeUserByAuthId, hasAnyRealAuthAccount } from "./db";
import type { OfficeUser, SectionPermission } from "./types";

/**
 * Request-scoped memoization (performance pass — see the audit report).
 * React's `cache()` dedupes calls made with the same arguments during the
 * SAME server render/request; it never persists across requests and never
 * shares data between users (each request gets its own cache instance via
 * Next.js's per-request async context), so this cannot introduce stale or
 * cross-user permission data — it only collapses the same read repeated
 * several times within one page load (the root layout, the TopBar, and
 * several requireSectionAccess()/canEdit() calls all asking the same
 * question about the same office_users/section_permissions rows).
 *
 * lib/db.ts is a `"use server"` file — every export becomes a Server
 * Action reference. `cache()` is deliberately NOT applied in place to
 * those exports (wrapping a Server Action's exported shape is untouched
 * territory this pass avoids); instead this file imports the plain
 * functions and wraps them here, and callers (lib/permissions.ts,
 * lib/auth.ts) import the cached versions from here instead of directly
 * from "./db" for their repeated-read call sites. Call sites that only
 * ever read a value once per request are left importing from "./db"
 * directly — no behavior change for them either way.
 */
export const listOfficeUsersCached = cache(async (): Promise<OfficeUser[]> => listOfficeUsers());

export const listSectionPermissionsCached = cache(async (officeUserId?: string): Promise<SectionPermission[]> => listSectionPermissions(officeUserId));

export const getOfficeUserByAuthIdCached = cache(async (authUserId: string): Promise<OfficeUser | undefined> => getOfficeUserByAuthId(authUserId));

export const hasAnyRealAuthAccountCached = cache(async (): Promise<boolean> => hasAnyRealAuthAccount());

import Link from "next/link";
import { SearchBox } from "./SearchBox";
import { ActingUserSelector } from "./ActingUserSelector";
import { getActingUser, listActingUserOptions } from "@/lib/current-user";
import { getCurrentSession, isRealAuthConfigured } from "@/lib/auth";
import { isOwnerActingUser } from "@/lib/permissions";
import { signOutAction } from "@/app/login/actions";
import { Button } from "./ui";
import { BackButton } from "./BackButton";

/**
 * Dev "acting as" selector visibility (build 12 — Activating Real Login,
 * step 6): once real auth is configured, identity is determined by the
 * real Supabase session, not this dev tool — so it's hidden for everyone
 * EXCEPT an is_owner user, for whom it stays available as the "preview as"
 * debugging override README "Activating Real Login" already called out
 * (rather than being removed outright). When real auth isn't configured,
 * nothing here changes: the selector always renders, unconditionally,
 * exactly as before.
 */
export async function TopBar() {
  const realAuthConfigured = isRealAuthConfigured();
  const [actingUser, options, session] = await Promise.all([
    getActingUser(),
    listActingUserOptions(),
    realAuthConfigured ? getCurrentSession() : Promise.resolve(null),
  ]);
  const showActingUserSelector = !realAuthConfigured || (await isOwnerActingUser(actingUser));
  const showSignOut = realAuthConfigured && session?.isRealAuth;

  return (
    <header
      className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 md:px-6 py-3 flex items-center gap-4"
      style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))" }}
    >
      <Link href="/dashboard" className="md:hidden font-semibold text-slate-900 shrink-0">
        Nolan Select
      </Link>
      <BackButton />
      <div className="flex-1 flex justify-end md:justify-start">
        <SearchBox />
      </div>
      {showActingUserSelector && <ActingUserSelector options={options} current={actingUser} />}
      {showSignOut && (
        <form action={signOutAction}>
          <Button type="submit" variant="secondary" className="!py-1.5 !px-2.5 text-xs">
            Sign out
          </Button>
        </form>
      )}
    </header>
  );
}

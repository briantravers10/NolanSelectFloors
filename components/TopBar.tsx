import Link from "next/link";
import { SearchBox } from "./SearchBox";
import { ActingUserSelector } from "./ActingUserSelector";
import { getActingUser, listActingUserOptions } from "@/lib/current-user";
import { getCurrentSession, isRealAuthConfigured } from "@/lib/auth";
import { signOutAction } from "@/app/login/actions";
import { Button } from "./ui";
import { BackButton } from "./BackButton";

/**
 * Once real login is on, who you are comes from your session — so the
 * top bar just shows the signed-in name and Sign out. The dev "acting as"
 * dropdown only appears when real auth isn't configured (local demo mode),
 * where it is the only way to pick a persona.
 */
export async function TopBar() {
  const realAuthConfigured = isRealAuthConfigured();
  const [actingUser, session] = await Promise.all([getActingUser(), realAuthConfigured ? getCurrentSession() : Promise.resolve(null)]);
  const options = realAuthConfigured ? [] : await listActingUserOptions();
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
      {!realAuthConfigured && <ActingUserSelector options={options} current={actingUser} />}
      {showSignOut && (
        <div className="flex items-center gap-2">
          <Link href="/account" className="hidden sm:inline text-xs text-slate-500 hover:text-sky-700" title="My account — change password">
            Signed in as <span className="font-medium text-slate-800">{actingUser.fullName}</span>
          </Link>
          <form action={signOutAction}>
            <Button type="submit" variant="secondary" className="!py-1.5 !px-2.5 text-xs">
              Sign out
            </Button>
          </form>
        </div>
      )}
    </header>
  );
}

import Link from "next/link";
import { SearchBox } from "./SearchBox";
import { ActingUserSelector } from "./ActingUserSelector";
import { getActingUser, listActingUserOptions } from "@/lib/current-user";

export async function TopBar() {
  const [actingUser, options] = await Promise.all([getActingUser(), listActingUserOptions()]);
  return (
    <header
      className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 md:px-6 py-3 flex items-center gap-4"
      style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))" }}
    >
      <Link href="/dashboard" className="md:hidden font-semibold text-slate-900 shrink-0">
        Nolan Select
      </Link>
      <div className="flex-1 flex justify-end md:justify-start">
        <SearchBox />
      </div>
      <ActingUserSelector options={options} current={actingUser} />
    </header>
  );
}

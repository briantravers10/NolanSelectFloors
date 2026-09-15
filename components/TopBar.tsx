import Link from "next/link";
import { SearchBox } from "./SearchBox";

export function TopBar() {
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
      <div className="hidden md:block text-sm text-slate-500 shrink-0">Brian Travers · Company Owner</div>
    </header>
  );
}

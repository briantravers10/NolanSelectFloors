import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { TopBar } from "@/components/TopBar";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import { getActingUser } from "@/lib/current-user";
import { getAllSectionAccess } from "@/lib/permissions";
import { isRealAuthConfigured } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Nolan Select Floors — Operations",
  description: "Flooring contractor operations console: clients, buildings, projects, schedule, staff and materials.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // /login must never show the app shell (Sidebar/TopBar/MobileNav) — it's
  // the one page reachable while signed out once real auth is on, and
  // showing nav for sections the visitor can't get into is both confusing
  // and a needless leak of the app's structure. The App Router gives
  // layouts no built-in server-side pathname API, so proxy.ts's middleware
  // stamps the current path onto an `x-pathname` response header (see
  // lib/supabase/middleware.ts) and we read it back here.
  const pathname = (await headers()).get("x-pathname");
  if (pathname === "/login") {
    return (
      <html lang="en" className="h-full antialiased">
        <body className="min-h-full bg-[var(--background)] text-[var(--foreground)]">{children}</body>
      </html>
    );
  }

  // Section access (build 11) is computed once per request, here, and
  // passed down to both nav components so they hide sections the current
  // acting user has no access to — see lib/permissions.ts and README
  // "Permissions & Staff Access".
  const access = await getAllSectionAccess(await getActingUser());
  const realAuthOn = isRealAuthConfigured();
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-[var(--background)] text-[var(--foreground)]">
        <div className="flex min-h-dvh">
          <Sidebar access={access} realAuthOn={realAuthOn} />
          <div className="flex-1 flex flex-col min-w-0">
            <TopBar />
            <main className="flex-1 px-4 md:px-6 py-5 pb-24 md:pb-8 max-w-[1400px] w-full mx-auto">{children}</main>
          </div>
        </div>
        <MobileNav access={access} />
        <AssistantPanel />
      </body>
    </html>
  );
}

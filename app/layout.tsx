import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { TopBar } from "@/components/TopBar";

export const metadata: Metadata = {
  title: "Nolan Select Floors — Operations",
  description: "Flooring contractor operations console: clients, buildings, projects, schedule, staff and materials.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-[var(--background)] text-[var(--foreground)]">
        <div className="flex min-h-dvh">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <TopBar />
            <main className="flex-1 px-4 md:px-6 py-5 pb-24 md:pb-8 max-w-[1400px] w-full mx-auto">{children}</main>
          </div>
        </div>
        <MobileNav />
      </body>
    </html>
  );
}

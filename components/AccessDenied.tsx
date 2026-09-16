import { Card } from "./ui";
import { Icon } from "./Icon";

/**
 * Consistent "no access" state for a section's page.tsx — see
 * lib/permissions.ts requireSectionAccess() and README "Enforcement".
 * Deliberately one reusable component rather than a bespoke treatment per
 * page (per the client's ask, correctness of the engine + a consistent
 * pattern matters more here than per-page polish).
 */
export function AccessDenied({ section }: { section: string }) {
  return (
    <Card className="p-8 max-w-lg mx-auto text-center">
      <div className="mx-auto mb-3 w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
        <Icon name="close" className="w-5 h-5" />
      </div>
      <h1 className="text-lg font-semibold text-slate-900 mb-1">You don&apos;t have access to {section}</h1>
      <p className="text-sm text-slate-500">
        Your account doesn&apos;t have permission to view this section. Ask your Owner/Admin to grant you access from Company Setup → Staff Access.
      </p>
    </Card>
  );
}

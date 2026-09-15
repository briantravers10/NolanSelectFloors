import { Card, Button, StatusBadge } from "./ui";
import { formatDateLong } from "@/lib/dates";
import { BID_STATUSES } from "@/lib/types";
import type { ActingUser } from "@/lib/current-user";
import type { OfficeUser, Project } from "@/lib/types";
import {
  claimBidAction,
  releaseBidAction,
  reassignBidFormAction,
  setBidStatusAction,
} from "@/app/projects/actions";

/**
 * Bid ownership + locking UI. Reused everywhere a bid/project is shown to
 * an estimator: the Project detail page, the Bid Dashboard cards, and the
 * Job Request detail page (once a bid/project exists for it). See
 * lib/db.ts `claimBid` for the atomic claim guarantee this UI relies on.
 */
export function BidOwnership({
  project,
  officeUsers,
  actingUser,
  compact = false,
}: {
  project: Project;
  officeUsers: OfficeUser[];
  actingUser: ActingUser;
  compact?: boolean;
}) {
  const estimator = officeUsers.find((u) => u.id === project.assigned_estimator_id);
  const isMine = !!project.assigned_estimator_id && project.assigned_estimator_id === actingUser.id;
  const isManager = actingUser.role === "manager";
  const canEditBidStatus = isMine || isManager;

  const body = (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <StatusBadge status={project.bid_status} />
        <span className="text-xs text-slate-500">Pipeline: {project.pipeline_stage}</span>
      </div>

      {!project.assigned_estimator_id && (
        <form action={claimBidAction.bind(null, project.id)}>
          <Button type="submit">Claim Bid (as {actingUser.fullName})</Button>
        </form>
      )}

      {project.assigned_estimator_id && !isMine && (
        <div className="text-sm text-slate-600">
          Claimed by <strong>{estimator?.full_name ?? "someone"}</strong>
          {project.claimed_at && ` · ${formatDateLong(project.claimed_at.slice(0, 10))}`}
        </div>
      )}

      {isMine && (
        <div className="text-sm text-emerald-700 font-medium">
          This is your bid{project.claimed_at ? ` — claimed ${formatDateLong(project.claimed_at.slice(0, 10))}` : ""}. You can update its status and estimate.
        </div>
      )}

      {!compact && canEditBidStatus && (
        <div className="mt-3">
          <div className="text-xs font-semibold text-slate-500 uppercase mb-1.5">Update Bid Status</div>
          <div className="flex flex-wrap gap-2">
            {BID_STATUSES.filter((s) => s !== project.bid_status).map((s) => (
              <form key={s} action={setBidStatusAction.bind(null, project.id, s)}>
                <button type="submit" className="text-xs rounded-full border border-slate-300 px-3 py-1 text-slate-600 hover:bg-slate-100">
                  {s}
                </button>
              </form>
            ))}
          </div>
        </div>
      )}

      {!compact && isManager && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <div className="text-xs font-semibold text-slate-500 uppercase mb-1.5">
            Manager Override
            <span className="normal-case font-normal text-slate-400"> — reassign or release this bid</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {project.assigned_estimator_id && (
              <form action={releaseBidAction.bind(null, project.id)}>
                <Button type="submit" variant="secondary">Release Bid</Button>
              </form>
            )}
            <form action={reassignBidFormAction.bind(null, project.id)} className="flex items-center gap-2">
              <select name="estimator_id" defaultValue="" className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
                <option value="" disabled>Reassign to…</option>
                {officeUsers
                  .filter((u) => u.id !== project.assigned_estimator_id)
                  .map((u) => (
                    <option key={u.id} value={u.id}>{u.full_name}</option>
                  ))}
              </select>
              <Button type="submit" variant="secondary">Reassign</Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  if (compact) return body;
  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Bid Ownership</h2>
      {body}
    </Card>
  );
}

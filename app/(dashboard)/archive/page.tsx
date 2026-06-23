"use client";

/**
 * Archive /archive
 * Archived runs (via history > Archive action).
 * Auto-expires after ARCHIVE_TTL_DAYS days.
 * Only action available: Restore (sends back to History).
 * Same table as History but no star column, no archive action.
 */

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconArchive } from "@tabler/icons-react";
import { api } from "@/lib/api";
import type { RunSummary } from "@/types";
import { RunTable } from "@/app/(dashboard)/history/page";

const STARRED_KEY  = "tope_deep:starred_runs";
const ARCHIVED_KEY = "tope_deep:archived_runs";
const ARCHIVE_TTL_DAYS = 5;

function getStarred(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try { return new Set(JSON.parse(localStorage.getItem(STARRED_KEY) ?? "[]")); }
  catch { return new Set(); }
}
function getArchived(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(ARCHIVED_KEY) ?? "{}"); }
  catch { return {}; }
}
function restoreRun(id: string): Record<string, string> {
  const a = getArchived(); delete a[id];
  localStorage.setItem(ARCHIVED_KEY, JSON.stringify(a)); return { ...a };
}
function pruneExpired(archived: Record<string, string>): Record<string, string> {
  const cutoff = Date.now() - ARCHIVE_TTL_DAYS * 86400 * 1000;
  const pruned: Record<string, string> = {};
  for (const [id, iso] of Object.entries(archived)) {
    if (new Date(iso).getTime() > cutoff) pruned[id] = iso;
  }
  return pruned;
}
function daysUntilExpiry(isoArchived: string): number {
  const expiry = new Date(isoArchived).getTime() + ARCHIVE_TTL_DAYS * 86400 * 1000;
  return Math.max(0, Math.ceil((expiry - Date.now()) / 86400 / 1000));
}

export default function ArchivePage() {
  const router = useRouter();
  const [allRuns,  setAllRuns]  = useState<RunSummary[]>([]);
  const [starred,  setStarred]  = useState<Set<string>>(new Set());
  const [archived, setArchived] = useState<Record<string, string>>({});
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    setStarred(getStarred());
    const a = pruneExpired(getArchived());
    setArchived(a);
    localStorage.setItem(ARCHIVED_KEY, JSON.stringify(a));
    api.listRuns().then(setAllRuns).catch(() => setAllRuns([])).finally(() => setLoading(false));
  }, []);

  // Only archived runs (not expired, already pruned above)
  const archivedRuns = allRuns.filter(r => !!archived[r.id]);

  const handleRestore  = useCallback((id: string) => setArchived(restoreRun(id)), []);
  const handleRowClick = useCallback((r: RunSummary) => router.push(`/results/${r.id}`), [router]);
  // Archive action is no-op on the archive page (isArchivePage=true shows Restore instead)
  const noop = useCallback((_: string) => {}, []);

  return (
    <div className="flex flex-col h-[calc(100dvh-3rem)] overflow-hidden p-4 gap-3">
      <div className="flex items-start justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2.5">

          <div className="space-y-0.5">
            <h1 className="text-lg font-semibold tracking-tight">Archive</h1>
            <p className="text-[13px] text-muted-foreground">
              Archived runs
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="size-5 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
        </div>
      ) : archivedRuns.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
          <div className="rounded-full bg-muted p-3">
            <IconArchive className="size-5 text-muted-foreground/20" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-[13px] font-medium">Nothing archived</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Archived runs appear here for {ARCHIVE_TTL_DAYS} days before being removed.
            </p>
          </div>
          <button type="button" onClick={() => router.push("/history")}
            className="mt-1 flex items-center gap-1.5 h-8 rounded-md border border-border px-3 text-[13px] font-medium hover:bg-accent transition-colors">
            Go to History
          </button>
        </div>
      ) : (
        <>
          {/* Expiry notice */}
          <div className="flex items-center gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 shrink-0">
            <IconArchive className="size-[14px] text-amber-600 dark:text-amber-400 shrink-0" strokeWidth={1.5} />
            <p className="text-[12px] text-amber-700 dark:text-amber-400">
              Archived runs are permanently removed after {ARCHIVE_TTL_DAYS} days. Restore to keep them.
            </p>
          </div>

          <RunTable
            runs={archivedRuns}
            starred={starred}
            archived={archived}
            onToggleStar={noop}
            onArchive={noop}
            onRestore={handleRestore}
            onRowClick={handleRowClick}
            isArchivePage
            emptyMessage="No archived runs match your search."
          />
        </>
      )}
    </div>
  );
}
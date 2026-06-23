"use client";

/**
 * Starred /starred
 * Same table as History but filtered to starred runs only.
 * All features identical: sort, filter by type/status, archive, export.
 */

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconPlus, IconStarFilled } from "@tabler/icons-react";
import { api } from "@/lib/api";
import type { RunSummary } from "@/types";
import { RunTable } from "@/app/(dashboard)/history/page";

const STARRED_KEY = "tope_deep:starred_runs";
const ARCHIVED_KEY = "tope_deep:archived_runs";
const ARCHIVE_TTL_DAYS = 5;

function getStarred(): Set<string> {
    if (typeof window === "undefined") return new Set();
    try { return new Set(JSON.parse(localStorage.getItem(STARRED_KEY) ?? "[]")); }
    catch { return new Set(); }
}
function toggleStarred(id: string): Set<string> {
    const s = getStarred();
    s.has(id) ? s.delete(id) : s.add(id);
    localStorage.setItem(STARRED_KEY, JSON.stringify([...s]));
    return new Set(s);
}
function getArchived(): Record<string, string> {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem(ARCHIVED_KEY) ?? "{}"); }
    catch { return {}; }
}
function archiveRun(id: string): Record<string, string> {
    const a = getArchived(); a[id] = new Date().toISOString();
    localStorage.setItem(ARCHIVED_KEY, JSON.stringify(a)); return { ...a };
}
function restoreRun(id: string): Record<string, string> {
    const a = getArchived(); delete a[id];
    localStorage.setItem(ARCHIVED_KEY, JSON.stringify(a)); return { ...a };
}

export default function StarredPage() {
    const router = useRouter();
    const [allRuns, setAllRuns] = useState<RunSummary[]>([]);
    const [starred, setStarred] = useState<Set<string>>(new Set());
    const [archived, setArchived] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setStarred(getStarred());
        setArchived(getArchived());
        api.listRuns().then(setAllRuns).catch(() => setAllRuns([])).finally(() => setLoading(false));
    }, []);

    // Only starred, non-archived runs
    const starredRuns = allRuns.filter(r => starred.has(r.id) && !archived[r.id]);

    const handleToggleStar = useCallback((id: string) => setStarred(toggleStarred(id)), []);
    const handleArchive = useCallback((id: string) => setArchived(archiveRun(id)), []);
    const handleRestore = useCallback((id: string) => setArchived(restoreRun(id)), []);
    const handleRowClick = useCallback((r: RunSummary) => router.push(`/results/${r.id}`), [router]);

    return (
        <div className="flex flex-col h-[calc(100dvh-3rem)] overflow-hidden p-4 gap-3">
            <div className="flex items-start justify-between gap-4 shrink-0">
                <div className="flex items-center gap-2.5">
                    <div className="space-y-0.5">
                        <h1 className="text-lg font-semibold tracking-tight">Starred</h1>
                        <p className="text-[13px] text-muted-foreground">Runs you've marked as important.</p>
                    </div>
                </div>
                <button type="button" onClick={() => router.push("/playground")}
                    className="flex items-center gap-1.5 h-8 rounded-md bg-foreground text-background px-3 text-[13px] font-semibold hover:bg-foreground/90 transition-colors shrink-0">
                    <IconPlus className="size-[15px]" strokeWidth={1.75} />
                    New run
                </button>
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="size-5 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
                </div>
            ) : starredRuns.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
                    <div className="rounded-full bg-muted p-3">
                        <IconStarFilled className="size-5 text-muted-foreground/20" />
                    </div>
                    <div>
                        <p className="text-[13px] font-medium">No starred runs</p>
                        <p className="text-[12px] text-muted-foreground mt-0.5">
                            Star a run from History to mark it as important.
                        </p>
                    </div>
                    <button type="button" onClick={() => router.push("/history")}
                        className="mt-1 flex items-center gap-1.5 h-8 rounded-md border border-border px-3 text-[13px] font-medium hover:bg-accent transition-colors">
                        Go to History
                    </button>
                </div>
            ) : (
                <RunTable
                    runs={starredRuns}
                    starred={starred}
                    archived={archived}
                    onToggleStar={handleToggleStar}
                    onArchive={handleArchive}
                    onRestore={handleRestore}
                    onRowClick={handleRowClick}
                    emptyMessage="No starred runs match your search."
                />
            )}
        </div>
    );
}
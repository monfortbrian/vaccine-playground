"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconPlus, IconEye, IconDotsVertical, IconTrash, IconDownload } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { RunSummary } from "@/types";

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

export default function HistoryPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listRuns().then(setRuns).catch(() => setRuns([])).finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Team</h2>
          <p className="text-muted-foreground">Manage lab members and their permissions</p>
        </div>
        <Button onClick={() => router.push("/")}>
          <IconPlus className="mr-2 size-4" />Invite Member
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center py-20">
          <div className="rounded-full bg-muted p-4 mb-4">
            <IconPlus className="size-6 text-muted-foreground" />
          </div>
          <p className="font-medium">No team members yet</p>
          <p className="text-sm text-muted-foreground mt-1">Invite members to join your team.</p>

        </CardContent>
      </Card>

    </>
  );
}

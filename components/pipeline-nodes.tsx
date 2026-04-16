"use client";
import { cn } from "@/lib/utils";
import { PIPELINE_NODES, type PipelineNode } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { IconDna, IconMicroscope, IconShield, IconWorld, IconDatabase, IconFilter, IconCheck, IconLoader2, IconClock, IconAlertTriangle } from "@tabler/icons-react";

const ICONS: Record<string, React.ElementType> = { N1: IconDatabase, N2: IconFilter, N3: IconDna, N4: IconMicroscope, N6: IconShield, N7: IconWorld };
type S = "waiting" | "running" | "done" | "error";
function st(n: PipelineNode, cur: PipelineNode | null, ps: string): S {
  if (ps === "failed" && n === cur) return "error";
  if (ps === "completed") return "done";
  const o: PipelineNode[] = ["N1", "N2", "N3", "N4", "N6", "N7"];
  const ci = cur ? o.indexOf(cur) : -1, mi = o.indexOf(n);
  return mi < ci ? "done" : mi === ci ? "running" : "waiting";
}
export function PipelineNodes({ currentNode, status, progress, message }: { currentNode: PipelineNode | null; status: string; progress: number; message: string; }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {PIPELINE_NODES.map((node) => {
          const s = st(node.id, currentNode, status); const Icon = ICONS[node.id] || IconDna; return (
            <Card key={node.id} className={cn("transition-all duration-300", s === "running" && "ring-2 ring-primary shadow-md", s === "done" && "opacity-70", s === "waiting" && "opacity-40", s === "error" && "ring-2 ring-destructive")}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className={cn("rounded-md p-1.5", s === "running" || s === "done" ? "bg-primary/10" : "bg-muted")}>
                    <Icon className={cn("size-3.5", s === "running" || s === "done" ? "text-primary" : "text-muted-foreground")} />
                  </div>
                  {s === "done" ? <IconCheck className="size-3.5 text-primary" /> : s === "running" ? <IconLoader2 className="size-3.5 text-primary animate-spin" /> : s === "error" ? <IconAlertTriangle className="size-3.5 text-destructive" /> : <IconClock className="size-3.5 text-muted-foreground/40" />}
                </div>
                <p className={cn("text-xs font-semibold leading-tight", s === "waiting" && "text-muted-foreground")}>{node.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{node.shortDesc}</p>
                {s === "running" && <div className="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-primary/20"><div className="h-full bg-primary animate-pulse rounded-full w-2/3" /></div>}
              </CardContent>
            </Card>
          );
        })}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">{message || "Initializing..."}</span><span className="font-mono text-xs tabular-nums">{Math.round(progress * 100)}%</span></div>
        <Progress value={progress * 100} className="h-2" />
      </div>
    </div>
  );
}

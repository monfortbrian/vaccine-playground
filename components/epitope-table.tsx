"use client";

/**
 * EpitopeTable - sortable, searchable epitope list.
 *
 * Search fix: hla_allele is null for B-cell epitopes - was crashing
 * on .toLowerCase() call. Now safely coerced to empty string.
 *
 * Also fixed: safety column shows "Unscored" when allergenicity_safe
 * is null (tools timed out in N6) instead of rendering nothing.
 */

import React, { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Epitope } from "@/types";

type SortKey = "sequence" | "epitope_type" | "hla_allele" | "ic50_nm" | "confidence";

export function EpitopeTable({ epitopes }: { epitopes: Epitope[] }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [sortKey, setSortKey] = useState<SortKey>("ic50_nm");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function handleSort(k: SortKey) {
    if (sortKey === k) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir("asc");
    }
  }

  const filtered = useMemo(() => {
    if (!epitopes || !Array.isArray(epitopes)) return [];

    let items = [...epitopes];

    // Type filter
    if (typeFilter !== "All") {
      items = items.filter((e) => e.epitope_type === typeFilter);
    }

    // Search - hla_allele can be null for B-cell epitopes, coerce safely
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (e) =>
          e.sequence.toLowerCase().includes(q) ||
          (e.hla_allele ?? "").toLowerCase().includes(q)
      );
    }

    // Sort
    items.sort((a, b) => {
      let av: string | number | null = a[sortKey] as string | number | null;
      let bv: string | number | null = b[sortKey] as string | number | null;

      // Nulls to bottom
      if (av == null) av = sortDir === "asc" ? Infinity as any : -Infinity as any;
      if (bv == null) bv = sortDir === "asc" ? Infinity as any : -Infinity as any;

      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc"
          ? av.localeCompare(bv)
          : bv.localeCompare(av);
      }
      return sortDir === "asc"
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });

    return items;
  }, [epitopes, search, typeFilter, sortKey, sortDir]);

  function SortIndicator({ k }: { k: SortKey }) {
    if (sortKey !== k) return <span className="ml-1 opacity-30">↕</span>;
    return (
      <span className="ml-1 opacity-70">
        {sortDir === "asc" ? "↑" : "↓"}
      </span>
    );
  }

  function SafetyCell({ ep }: { ep: Epitope }) {
    // N6 unscored - tools timed out, null means not screened
    if (ep.allergenicity_safe === null && ep.toxicity_safe === null) {
      return (
        <Badge variant="outline" className="text-[10px] text-muted-foreground">
          Unscored
        </Badge>
      );
    }
    return (
      <div className="flex flex-wrap gap-1">
        {ep.allergenicity_safe != null && (
          <Badge
            variant={ep.allergenicity_safe ? "secondary" : "destructive"}
            className="text-[10px]"
          >
            {ep.allergenicity_safe ? "Safe" : "Allergenic"}
          </Badge>
        )}
        {ep.toxicity_safe != null && (
          <Badge
            variant={ep.toxicity_safe ? "secondary" : "destructive"}
            className="text-[10px]"
          >
            {ep.toxicity_safe ? "Safe" : "Toxic"}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">All Epitopes</CardTitle>
        <CardDescription>
          Click column headers to sort. Search by sequence or HLA allele.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <Input
            placeholder="Search sequence or HLA…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs h-9 text-sm"
          />
          <div className="flex gap-1">
            {["All", "CTL", "HTL", "B-cell"].map((t) => (
              <Button
                key={t}
                variant={typeFilter === t ? "default" : "outline"}
                size="sm"
                onClick={() => setTypeFilter(t)}
              >
                {t}
              </Button>
            ))}
          </div>
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {filtered.length} epitope{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                {(
                  [
                    ["sequence", "Sequence"],
                    ["epitope_type", "Type"],
                    ["hla_allele", "HLA"],
                    ["ic50_nm", "IC50 (nM)"],
                    ["confidence", "Confidence"],
                  ] as [SortKey, string][]
                ).map(([k, label]) => (
                  <th
                    key={k}
                    onClick={() => handleSort(k)}
                    className="cursor-pointer select-none px-4 py-3 text-left text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {label}
                    <SortIndicator k={k} />
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  Safety
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    {search || typeFilter !== "All"
                      ? "No epitopes match your filter."
                      : "No epitopes available."}
                  </td>
                </tr>
              ) : (
                filtered.map((ep, i) => (
                  <tr
                    key={`${ep.sequence}-${ep.hla_allele ?? "bcell"}-${i}`}
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs tracking-wider">
                      {ep.sequence}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          ep.epitope_type === "CTL"
                            ? "default"
                            : ep.epitope_type === "HTL"
                              ? "secondary"
                              : "outline"
                        }
                        className="text-[10px]"
                      >
                        {ep.epitope_type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {ep.hla_allele ?? "-"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs tabular-nums">
                      {ep.ic50_nm != null ? ep.ic50_nm.toFixed(1) : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          ep.confidence === "high"
                            ? "default"
                            : ep.confidence === "medium"
                              ? "secondary"
                              : "outline"
                        }
                        className="text-[10px]"
                      >
                        {ep.confidence}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <SafetyCell ep={ep} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* IC50 note */}
        <p className="text-[10px] text-muted-foreground mt-3">
          IC50 values are approximated from percentile rank - not measured binding affinities.
        </p>
      </CardContent>
    </Card>
  );
}
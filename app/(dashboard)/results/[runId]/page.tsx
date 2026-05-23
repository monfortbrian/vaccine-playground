"use client";

/**
 * Results page - targeted changes from previous version:
 *   1. Back button added to header (chevron left, navigates to /history)
 *   2. Download functions updated to new export.ts signature
 *   3. "Not found" state has explicit back button
 *
 * Full file - replace app/(dashboard)/results/[runId]/page.tsx entirely.
 */

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IconPlus, IconDownload } from "@tabler/icons-react";
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { CoverageChart } from '@/components/coverage-chart';
import { EpitopeTable } from '@/components/epitope-table';
import { StructureCard } from '@/components/structure-card';
import { ConstructCard } from '@/components/construct-card';
import { api } from '@/lib/api';
import { downloadCSV, downloadJSON } from '@/lib/export';
import type { PipelineResults, Candidate } from '@/types';

function fmt(s: number) {
  return s < 60
    ? `${s.toFixed(1)}s`
    : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

export default function ResultsPage() {
  const { runId } = useParams<{ runId: string }>();
  const router = useRouter();
  const [res, setRes] = useState<PipelineResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(0);

  useEffect(() => {
    if (runId)
      api
        .getResults(runId)
        .then(setRes)
        .catch(console.error)
        .finally(() => setLoading(false));
  }, [runId]);

  if (loading)
    return (
      <div className='flex items-center justify-center py-20'>
        <div className='h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent' />
      </div>
    );

  if (!res)
    return (
      <div className='flex flex-col items-center justify-center py-20 gap-4'>
        <p className='text-sm text-muted-foreground'>
          Results not found. The run may have expired or belongs to another account.
        </p>
        <Button
          variant='outline'
          onClick={() => router.push('/history')}
          className='gap-2'
        >
          <ChevronLeft className='size-4' />
          Back to History
        </Button>
      </div>
    );

  const c: Candidate = res.candidates[sel];
  if (!c) return null;

  return (
    <div className='space-y-6'>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className='flex flex-wrap items-start justify-between gap-4'>
        <div className='flex items-start gap-3'>
          {/* Back button */}
          <Button
            variant='ghost'
            size='sm'
            onClick={() => router.push('/history')}
            className='mt-0.5 gap-1.5 text-muted-foreground hover:text-foreground -ml-2'
          >
            <ChevronLeft className='size-4' />
            History
          </Button>
        </div>

        {/* Download + New Run - right side */}
        <div className='flex gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => downloadCSV(res.candidates, runId)}
          >
            <IconDownload className='size-3 mr-1.5' />
            CSV
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={() => downloadJSON(res, runId, res.candidates)}
          >
            <IconDownload className='size-3 mr-1.5' />
            JSON
          </Button>
          <Button size='sm' onClick={() => router.push('/')}>
            <IconPlus className='size-4 mr-1.5' />
            New Run
          </Button>
        </div>
      </div>

      {/* ── Protein title ───────────────────────────────────────── */}
      <div>
        <div className='flex items-center gap-3'>
          <h2 className='text-2xl font-semibold tracking-tight'>
            {c.protein_name}
          </h2>
          <Badge variant='outline' className='font-mono'>
            {c.protein_id}
          </Badge>
        </div>
        <p className='text-sm text-muted-foreground mt-1'>
          {c.sequence_length} residues
          {res.timing.total_seconds > 0 && (
            <> · completed in {fmt(res.timing.total_seconds)}</>
          )}
        </p>
      </div>

      {/* ── Protein selector (multi-protein runs) ──────────────── */}
      {res.candidates.length > 1 && (
        <div className='flex flex-wrap gap-2'>
          {res.candidates.map((x, i) => (
            <Button
              key={x.protein_id}
              variant={sel === i ? 'default' : 'outline'}
              size='sm'
              onClick={() => setSel(i)}
            >
              {x.protein_name}
            </Button>
          ))}
        </div>
      )}

      {/* ── Summary metrics ────────────────────────────────────── */}
      <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5'>
        {[
          { l: 'CTL Epitopes', v: c.ctl_count, s: `${c.ctl_strong} strong binders` },
          { l: 'HTL Epitopes', v: c.htl_count },
          { l: 'B-Cell Epitopes', v: c.bcell_count },
          { l: 'Global Coverage', v: `${c.global_coverage_pct.toFixed(1)}%`, s: 'HLA population' },
          { l: 'African Coverage', v: `${c.african_coverage_pct.toFixed(1)}%`, s: 'HLA population' },
        ].map((m) => (
          <Card key={m.l}>
            <CardContent className='p-4'>
              <p className='text-xs text-muted-foreground'>{m.l}</p>
              <p className='text-2xl font-bold mt-1 tabular-nums'>{m.v}</p>
              {m.s && <p className='text-xs text-muted-foreground mt-0.5'>{m.s}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── N5 Structure card ───────────────────────────────────── */}
      <StructureCard candidates={res.candidates} />

      {/* ── Coverage chart ─────────────────────────────────────── */}
      <CoverageChart coverageDetail={c.coverage_detail} />

      {/* ── High-confidence epitopes ───────────────────────────── */}
      <div>
        <h3 className='text-base font-semibold mb-3'>
          High-Confidence Epitopes
          <span className='ml-2 text-sm font-normal text-muted-foreground'>
            top 6, IC50-ranked
          </span>
        </h3>
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
          {c.epitopes
            .filter((e) => e.confidence === 'high')
            .slice(0, 6)
            .map((ep, i) => (
              <Card key={i}>
                <CardContent className='p-4'>
                  <div className='flex items-start justify-between mb-2'>
                    <code className='font-mono text-sm font-medium tracking-widest'>
                      {ep.sequence}
                    </code>
                    <Badge>{ep.epitope_type}</Badge>
                  </div>
                  <div className='text-xs text-muted-foreground space-y-1'>
                    {ep.hla_allele && (
                      <div className='flex justify-between'>
                        <span>HLA</span>
                        <span className='font-mono'>{ep.hla_allele}</span>
                      </div>
                    )}
                    {ep.ic50_nm != null && (
                      <div className='flex justify-between'>
                        <span>IC50</span>
                        <span className='font-mono'>{ep.ic50_nm.toFixed(1)} nM</span>
                      </div>
                    )}
                    <div className='flex justify-between items-center pt-1'>
                      <span>Safety</span>
                      <div className='flex gap-1'>
                        {ep.allergenicity_safe != null && (
                          <Badge
                            variant={ep.allergenicity_safe ? 'secondary' : 'destructive'}
                            className='text-[10px]'
                          >
                            {ep.allergenicity_safe ? 'Safe' : 'Allergenic'}
                          </Badge>
                        )}
                        {ep.toxicity_safe != null && (
                          <Badge
                            variant={ep.toxicity_safe ? 'secondary' : 'destructive'}
                            className='text-[10px]'
                          >
                            {ep.toxicity_safe ? 'Safe' : 'Toxic'}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      </div>

      {/* ── Full epitope table ─────────────────────────────────── */}
      <EpitopeTable epitopes={c.epitopes} />

      {/* ── N8 Construct card ───────────────────────────────────── */}
      <ConstructCard report={res.construct_report ?? null} />

      {/* ── Decision audit trail ───────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Decision Audit Trail</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion defaultValue={[]}>
            {(c.decisions || []).map((d, i) => (
              <AccordionItem key={i} value={`d-${i}`}>
                <AccordionTrigger>
                  <div className='flex items-center gap-2 text-sm'>
                    <Badge variant='outline' className='font-mono text-xs'>
                      {d.stage}
                    </Badge>
                    <span>{d.decision}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <p className='text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed'>
                    {d.reasoning}
                  </p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* ── Timing breakdown ───────────────────────────────────── */}
      {res.timing.total_seconds > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Pipeline Timing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
              {Object.entries(res.timing)
                .filter(([k]) => k !== 'total_seconds')
                .map(([k, v]) => (
                  <div key={k} className='space-y-0.5'>
                    <p className='text-xs text-muted-foreground uppercase tracking-wider'>
                      {k.replace(/_/g, ' ')}
                    </p>
                    <p className='text-sm font-mono font-medium'>{fmt(v as number)}</p>
                  </div>
                ))}
            </div>
            <p className='text-xs text-muted-foreground mt-3 pt-3 border-t'>
              Total:{' '}
              <span className='font-mono font-medium'>
                {fmt(res.timing.total_seconds)}
              </span>
            </p>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
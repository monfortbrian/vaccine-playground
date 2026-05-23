import type {
  PipelineRunRequest,
  PipelineRunResponse,
  PipelineStatusResponse,
  PipelineResults,
  RunSummary,
} from '@/types';
import { supabase } from '@/lib/supabase';

const API = process.env.NEXT_PUBLIC_API_URL || '';

async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) return session.access_token;
  // Session stale - force refresh
  const { data: refreshed } = await supabase.auth.refreshSession();
  return refreshed.session?.access_token ?? null;
}

async function f<T>(url: string, opts?: RequestInit): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  try {
    const r = await fetch(url, {
      ...opts,
      headers,
    });
    if (!r.ok) throw new Error(`API returned ${r.status}: ${await r.text()}`);
    return r.json();
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('API returned')) throw err;
    throw new Error('Backend not reachable. Check API URL or CORS.');
  }
}

export const api = {
  health: () => f<{ status: string }>(`${API}/api/health`),

  startRun: (body: PipelineRunRequest) =>
    f<PipelineRunResponse>(`${API}/api/pipeline/run`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getStatus: (id: string) =>
    f<PipelineStatusResponse>(`${API}/api/pipeline/status/${id}`),

  getResults: (id: string) =>
    f<PipelineResults>(`${API}/api/pipeline/results/${id}`),

  listRuns: async (): Promise<RunSummary[]> => {
    try {
      const runs = await f<any[]>(`${API}/api/runs`);
      return runs.map((r: any) => ({
        id: r.run_id || r.id,
        pathogen_name: r.input_value || null,
        input_type: r.input_type || 'pathogen',
        status: r.status,
        created_at: r.started_at || r.created_at || '',
        completed_at: r.completed_at || null,
        global_coverage: r.global_coverage_pct ?? r.global_coverage ?? null,
      }));
    } catch {
      return [];
    }
  },
};
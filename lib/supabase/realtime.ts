import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export function subscribeToPipelineRuns(taskId: number, onChange: (payload: any) => void) {
  const channel = supabase
    .channel(`pipeline-runs-${taskId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'night_task_runs',
        filter: `task_id=eq.${taskId}`,
      },
      (payload) => {
        console.log("🔥 REALTIME UPDATE:", payload.eventType, payload);
        // Handle INSERT and UPDATE events
        if (payload.new) {
          onChange(payload.new);
        }
        // Handle DELETE events (payload.old contains deleted row)
        // Note: We don't need to handle DELETE here since runs are rarely deleted
      },
    )
    .subscribe();

  return channel;
}


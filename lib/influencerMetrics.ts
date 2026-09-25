import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Average first-reply hours: brand message → next influencer reply, per conversation.
 * Returns null when not enough samples.
 */
export async function computeAvgResponseHours(
  supabase: SupabaseClient,
  influencerId: string
): Promise<number | null> {
  const { data: convs } = await supabase
    .from('conversations')
    .select('id')
    .eq('influencer_id', influencerId)
    .limit(40);

  if (!convs?.length) return null;

  const deltas: number[] = [];
  for (const c of convs) {
    const { data: msgs } = await supabase
      .from('messages')
      .select('sender_type, created_at')
      .eq('conversation_id', c.id)
      .order('created_at', { ascending: true })
      .limit(80);

    if (!msgs?.length) continue;
    let pendingBrandAt: number | null = null;
    for (const m of msgs) {
      const t = new Date(m.created_at).getTime();
      if (!Number.isFinite(t)) continue;
      if (m.sender_type === 'brand') {
        if (pendingBrandAt == null) pendingBrandAt = t;
      } else if (m.sender_type === 'influencer' && pendingBrandAt != null) {
        const hours = (t - pendingBrandAt) / (1000 * 60 * 60);
        if (hours >= 0 && hours < 24 * 14) deltas.push(hours);
        pendingBrandAt = null;
      }
    }
  }

  if (deltas.length < 2) return null;
  const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  return Math.max(1, Math.round(avg));
}

/** Completion % from proposals; null when none. */
export async function computeCompletionRate(
  supabase: SupabaseClient,
  influencerId: string
): Promise<number | null> {
  const { data: proposals } = await supabase
    .from('proposals')
    .select('status')
    .eq('influencer_id', influencerId);

  if (!proposals?.length) return null;
  const done = proposals.filter((p) =>
    ['completed', 'accepted'].includes(String(p.status || ''))
  ).length;
  return Math.round((done / proposals.length) * 100);
}

/** Recompute and persist trust metrics on influencers row. */
export async function refreshInfluencerTrustMetrics(
  supabase: SupabaseClient,
  influencerId: string
): Promise<{ avg_response_time: number | null; completion_rate: number | null }> {
  const [avg_response_time, completion_rate] = await Promise.all([
    computeAvgResponseHours(supabase, influencerId),
    computeCompletionRate(supabase, influencerId),
  ]);

  const patch: Record<string, number | null> = {};
  if (avg_response_time != null) patch.avg_response_time = avg_response_time;
  if (completion_rate != null) patch.completion_rate = completion_rate;

  if (Object.keys(patch).length > 0) {
    await supabase.from('influencers').update(patch).eq('id', influencerId);
  }

  return { avg_response_time, completion_rate };
}

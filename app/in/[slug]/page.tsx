import { notFound, redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

type Params = Promise<{ slug: string }>;

export default async function PublicInfluencerSlugPage({ params }: { params: Params }) {
  const { slug } = await params;
  const clean = (slug || '').trim().toLowerCase();
  if (!clean) notFound();

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data, error } = await supabaseAdmin
    .from('influencers')
    .select('id, approved')
    .eq('profile_slug', clean)
    .maybeSingle();

  if (error || !data?.id || !data.approved) {
    notFound();
  }

  redirect(`/influencer/${data.id}`);
}

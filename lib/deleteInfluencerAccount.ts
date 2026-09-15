import { SupabaseClient } from '@supabase/supabase-js';

export type DeleteInfluencerInitiator = 'admin' | 'self';

export interface DeleteInfluencerAccountOptions {
  initiator?: DeleteInfluencerInitiator;
  actorEmail?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Permanently delete an influencer and related data (profile, auth, messages, proposals, etc.).
 */
export async function deleteInfluencerAccount(
  supabaseAdmin: SupabaseClient,
  userId: string,
  options: DeleteInfluencerAccountOptions = {}
): Promise<{ success: true } | { success: false; error: string }> {
  const trimmedId = userId.trim();
  if (!trimmedId) {
    return { success: false, error: 'User ID is required' };
  }

  const { data: influencerData } = await supabaseAdmin
    .from('influencers')
    .select('id, display_name, contact_email, created_at, verified, approved')
    .eq('id', trimmedId)
    .maybeSingle();

  const { data: authUserResponse } = await supabaseAdmin.auth.admin.getUserById(trimmedId);
  const authUserData = authUserResponse?.user;

  if (!influencerData && !authUserData) {
    return { success: false, error: 'Account not found' };
  }

  const relatedDeletes: Array<{ table: string; filter: Record<string, string> }> = [
    { table: 'proposals', filter: { influencer_id: trimmedId } },
    { table: 'push_subscriptions', filter: { user_type: 'influencer', user_identifier: trimmedId.toLowerCase() } },
    { table: 'support_tickets', filter: { user_type: 'influencer', user_id: trimmedId } },
    { table: 'announcement_reads', filter: { influencer_id: trimmedId } },
  ];

  for (const { table, filter } of relatedDeletes) {
    let query = supabaseAdmin.from(table).delete();
    for (const [key, value] of Object.entries(filter)) {
      query = query.eq(key, value);
    }
    const { error } = await query;
    if (error) {
      console.error(`[deleteInfluencerAccount] ${table}:`, error.message);
    }
  }

  const { error: rolesDeleteError } = await supabaseAdmin
    .from('user_roles')
    .delete()
    .eq('id', trimmedId);
  if (rolesDeleteError) {
    console.error('[deleteInfluencerAccount] user_roles:', rolesDeleteError.message);
  }

  const { error: influencerDeleteError } = await supabaseAdmin
    .from('influencers')
    .delete()
    .eq('id', trimmedId);
  if (influencerDeleteError) {
    console.error('[deleteInfluencerAccount] influencers:', influencerDeleteError.message);
  }

  const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(trimmedId);
  if (authDeleteError) {
    return {
      success: false,
      error: authDeleteError.message || 'Failed to delete auth user',
    };
  }

  try {
    await supabaseAdmin.from('admin_audit_log').insert({
      action_type: 'delete_user',
      admin_email: options.actorEmail || (options.initiator === 'self' ? 'self-service' : 'unknown'),
      target_type: 'influencer',
      target_id: trimmedId,
      target_email: influencerData?.contact_email || authUserData?.email || 'unknown',
      target_name: influencerData?.display_name || 'unknown',
      details: {
        initiator: options.initiator || 'admin',
        influencer_data: influencerData,
        auth_email: authUserData?.email || null,
      },
      ip_address: options.ipAddress || 'unknown',
      user_agent: options.userAgent || 'unknown',
    });
  } catch (auditError) {
    console.error('[deleteInfluencerAccount] audit log:', auditError);
  }

  return { success: true };
}

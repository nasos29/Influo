import { supabaseService } from "@/lib/apiAuth";

export async function closeConversation(
  conversationId: string
): Promise<{ success: boolean; error?: string; alreadyClosed?: boolean }> {
  const admin = supabaseService();
  const { data, error } = await admin
    .from("conversations")
    .select("id, closed_at")
    .eq("id", conversationId)
    .maybeSingle();
  if (error || !data) return { success: false, error: error?.message || "Conversation not found" };
  if (data.closed_at) return { success: true, alreadyClosed: true };
  const { error: updateError } = await admin
    .from("conversations")
    .update({ closed_at: new Date().toISOString() })
    .eq("id", conversationId);
  if (updateError) return { success: false, error: updateError.message };
  return { success: true };
}

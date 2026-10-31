import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { insertFollowerSnapshot } from '@/lib/parseFollowers';
import { requireAdmin } from '@/lib/apiAuth';
import { ensureProfileSlug } from '@/lib/profileSlugAssign';
import { escapeHtml, sendTransactional } from '@/lib/transactionalEmail';
import {
  birthDateErrorText,
  birthDateLangFromRequest,
  validateBirthDate,
} from '@/lib/validateBirthDate';
import { FACEBOOK_VIDEO_LINK_ERROR, prepareVideosForSave } from '@/lib/videoLinks';
import { syncHiddenVideosWithVideos } from '@/lib/hiddenVideos';
import { deriveMinRate } from '@/lib/servicePackages';
import {
  VIDEO_NOT_PLAYABLE_ERROR,
  checkNewVideosPlayable,
} from '@/lib/checkVideoPlayable';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function jsonEq(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/**
 * Admin: update influencer row (bypasses RLS). Optionally syncs auth.users.email when contact_email changes.
 * POST { influencerId: string, updates: Record<string, unknown>, clearBio?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const influencerId = String(body?.influencerId ?? '').trim();
    const updates = body?.updates;
    const clearBio = body?.clearBio === true;

    if (!influencerId || !updates || typeof updates !== 'object' || Array.isArray(updates)) {
      return NextResponse.json({ error: 'influencerId and updates object required' }, { status: 400 });
    }

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('influencers')
      .select('*')
      .eq('id', influencerId)
      .maybeSingle();

    if (fetchErr || !existing) {
      return NextResponse.json(
        { error: fetchErr?.message || 'Influencer not found' },
        { status: 404 }
      );
    }

    const patch = { ...updates } as Record<string, unknown>;
    // Slugs are assigned on approval and changed only via /api/influencer/profile-link.
    delete patch.profile_slug;
    // min_rate is derived from packages / rate card, never typed in.
    delete patch.min_rate;
    if (typeof patch.contact_email === 'string') {
      patch.contact_email = patch.contact_email.trim().toLowerCase();
    }

    // Defensive: empty bio must not wipe an existing bio unless clearBio is explicit.
    if ('bio' in patch) {
      const incoming = patch.bio;
      const incomingEmpty =
        incoming == null || (typeof incoming === 'string' && !incoming.trim());
      const existingBio = existing.bio;
      const hasExistingBio =
        typeof existingBio === 'string' && existingBio.trim().length > 0;
      if (incomingEmpty && hasExistingBio && !clearBio) {
        delete patch.bio;
      }
    }

    // Drop no-op keys so profile_changes stays meaningful.
    for (const key of Object.keys(patch)) {
      if (jsonEq(patch[key], (existing as Record<string, unknown>)[key])) {
        delete patch[key];
      }
    }

    // Validate only when birth_date is newly sent/changed (legacy invalid values keep saving other fields).
    if ('birth_date' in patch) {
      const incoming = patch.birth_date;
      if (incoming != null && String(incoming).trim() !== '') {
        const birthCheck = validateBirthDate(incoming);
        if (!birthCheck.ok) {
          const lang = birthDateLangFromRequest(request);
          return NextResponse.json(
            { error: birthDateErrorText(birthCheck, lang) },
            { status: 400 }
          );
        }
        patch.birth_date = birthCheck.normalized;
      }
    }

    if ('videos' in patch) {
      const prepared = prepareVideosForSave(patch.videos);
      const lang = birthDateLangFromRequest(request);
      if (!prepared.ok) {
        return NextResponse.json(
          { error: FACEBOOK_VIDEO_LINK_ERROR[lang] },
          { status: 400 }
        );
      }
      const existingVideos = Array.isArray(existing.videos)
        ? (existing.videos as string[])
        : [];
      const playable = await checkNewVideosPlayable(prepared.videos, existingVideos);
      if (!playable.ok) {
        return NextResponse.json(
          { error: VIDEO_NOT_PLAYABLE_ERROR[lang === 'en' ? 'en' : 'el'] },
          { status: 400 }
        );
      }
      patch.videos = prepared.videos;
      patch.hidden_videos = syncHiddenVideosWithVideos(
        prepared.videos,
        existing.hidden_videos
      );
    }

    if ('service_packages' in patch || 'rate_card' in patch) {
      const packages = 'service_packages' in patch ? patch.service_packages : existing.service_packages;
      const card = 'rate_card' in patch ? patch.rate_card : existing.rate_card;
      const derived = deriveMinRate(packages, card);
      if (derived != null && String(existing.min_rate ?? '') !== derived) {
        patch.min_rate = derived;
      }
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ success: true, influencer: existing });
    }

    const { data, error } = await supabaseAdmin
      .from('influencers')
      .update(patch)
      .eq('id', influencerId)
      .select()
      .single();

    if (error) {
      console.error('[admin/influencers/update]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Audit trail for admin edits.
    try {
      const changedFields = Object.keys(patch);
      const oldValues: Record<string, unknown> = {};
      const newValues: Record<string, unknown> = {};
      for (const field of changedFields) {
        oldValues[field] = (existing as Record<string, unknown>)[field] ?? null;
        newValues[field] =
          data && field in data
            ? (data as Record<string, unknown>)[field]
            : patch[field] ?? null;
      }
      if (changedFields.length > 0) {
        const { error: historyErr } = await supabaseAdmin.from('profile_changes').insert({
          influencer_id: influencerId,
          old_values: oldValues,
          new_values: newValues,
          changed_fields: changedFields,
          reviewed_by_admin: true,
          reviewed_at: new Date().toISOString(),
        });
        if (historyErr) {
          console.warn('[admin/influencers/update] profile_changes:', historyErr.message);
        }
      }
    } catch (historyCatch) {
      console.warn('[admin/influencers/update] profile_changes insert failed', historyCatch);
    }

    // Insert snapshot if accounts changed
    const accountsChanged =
      patch.accounts && JSON.stringify(patch.accounts) !== JSON.stringify(existing.accounts);
    if (accountsChanged && data.accounts) {
      await insertFollowerSnapshot(supabaseAdmin, influencerId, data.accounts);
    }

    if (patch.approved === true) {
      await ensureProfileSlug(supabaseAdmin, influencerId).catch((e) => {
        console.error('[admin/influencers/update] slug', e);
      });
      if (existing.approved !== true) {
        const email = String(data.contact_email || existing.contact_email || "").trim();
        const name = escapeHtml(data.display_name || existing.display_name || "");
        await sendTransactional(
          email,
          "Συγχαρητήρια! Το προφίλ σου εγκρίθηκε ✅",
          `<div style="font-family:sans-serif;font-size:14px;color:#1f2937;max-width:560px">
            <p>Γεια σου ${name},</p>
            <p>Το προφίλ σου εγκρίθηκε και είναι πλέον ορατό στις επιχειρήσεις. Μπορείς να βλέπεις ανοιχτές καμπάνιες και να κάνεις αίτηση.</p>
            <p><a href="https://www.influo.gr/dashboard">Άνοιγμα dashboard</a></p>
          </div>`
        ).catch((err) => console.error("[influencer approved email]", err));
      }
    }

    const newEmail =
      typeof patch.contact_email === 'string' ? patch.contact_email : null;
    const oldEmail = String(existing.contact_email ?? '')
      .toLowerCase()
      .trim();

    if (newEmail && newEmail !== oldEmail) {
      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(influencerId, {
        email: newEmail,
      });
      if (authErr) {
        console.error('[admin/influencers/update] auth email sync failed', authErr);
        if (patch.approved !== undefined) {
          revalidatePath('/');
          revalidatePath('/directory');
          revalidatePath('/en');
          revalidatePath('/en/directory');
        }
        return NextResponse.json({
          success: true,
          influencer: data,
          warning:
            'Το προφίλ αποθηκεύτηκε, αλλά το email σύνδεσης (Auth) δεν ενημερώθηκε: ' +
            authErr.message +
            ' — ελέγξτε αν το νέο email υπάρχει ήδη σε άλλο λογαριασμό.',
        });
      }
    }

    if (patch.approved !== undefined) {
      revalidatePath('/');
      revalidatePath('/directory');
      revalidatePath('/en');
      revalidatePath('/en/directory');
    }
    return NextResponse.json({ success: true, influencer: data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error';
    console.error('[admin/influencers/update]', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

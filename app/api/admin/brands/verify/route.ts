import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/apiAuth';
import { escapeHtml, sendTransactional } from '@/lib/transactionalEmail';

// Server-side Supabase client με service role key (Admin privileges)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { brandId, verified } = await request.json();

    if (!brandId || typeof verified !== 'boolean') {
      return NextResponse.json(
        { error: 'brandId and verified (boolean) are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('brands')
      .update({ verified })
      .eq('id', brandId)
      .select()
      .single();

    if (error) {
      console.error('Error updating brand verification:', error);
      return NextResponse.json(
        { error: 'Failed to update brand verification', details: error.message },
        { status: 500 }
      );
    }

    if (verified && data?.contact_email) {
      const name = escapeHtml(data.brand_name || "επιχείρηση");
      await sendTransactional(
        data.contact_email,
        "Η επιχείρησή σας επαληθεύτηκε στο Influo",
        `<div style="font-family:sans-serif;font-size:14px;color:#1f2937;max-width:560px">
          <p>Γεια σας,</p>
          <p>Η επιχείρηση <strong>${name}</strong> επαληθεύτηκε. Μπορείτε πλέον να δημοσιεύετε καμπάνιες ως ανοιχτές, ώστε να τις βλέπουν οι εγκεκριμένοι influencers.</p>
          <p><a href="https://www.influo.gr/brand/dashboard">Άνοιγμα dashboard</a></p>
        </div>`
      ).catch((err) => console.error("[brand verify email]", err));
    }

    return NextResponse.json({ success: true, brand: data });
  } catch (error: any) {
    console.error('Error in brand verify API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}



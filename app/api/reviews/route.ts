import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const influencerId = searchParams.get('influencerId');

    if (!influencerId) {
      return NextResponse.json({ error: 'influencerId required' }, { status: 400 });
    }

    const { data: reviews, error } = await supabaseAdmin
      .from('influencer_reviews')
      .select('*')
      .eq('influencer_id', influencerId)
      .eq('verified', true) // Only show verified reviews
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ reviews: reviews || [] });
  } catch (error: any) {
    console.error('Reviews GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { influencerId, brandEmail, brandName, rating, reviewText, projectType, lang } = body;

    if (!influencerId || !brandEmail || !rating) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify that brand has a completed proposal WITH ACCEPTED AGREEMENT with this influencer
    const { data: completedProposals } = await supabaseAdmin
      .from('proposals')
      .select('id, influencer_agreement_accepted, brand_agreement_accepted, brand_added_to_past_brands')
      .eq('influencer_id', influencerId)
      .eq('brand_email', brandEmail)
      .in('status', ['completed', 'accepted']);

    if (!completedProposals || completedProposals.length === 0) {
      const errorMsg = lang === 'el' 
        ? 'Μπορείτε να αξιολογήσετε μόνο influencers με τους οποίους έχετε συνεργαστεί. Παρακαλώ ολοκληρώστε πρώτα μια συνεργασία.'
        : 'You can only review influencers you have worked with. Please complete a collaboration first.';
      return NextResponse.json({ 
        error: errorMsg 
      }, { status: 403 });
    }

    // Check if at least one proposal has both agreements accepted (collaboration confirmed)
    const hasAcceptedAgreement = completedProposals.some(
      (p: any) => p.influencer_agreement_accepted === true && p.brand_agreement_accepted === true
    );

    if (!hasAcceptedAgreement) {
      const errorMsg = lang === 'el'
        ? 'Μπορείτε να αξιολογήσετε μόνο μετά την αποδοχή της συμφωνίας συνεργασίας. Παρακαλώ περιμένετε να αποδεχτούν και οι δύο πλευρές την συμφωνία.'
        : 'You can only review after the collaboration agreement has been accepted. Please wait for both parties to accept the agreement.';
      return NextResponse.json({ 
        error: errorMsg 
      }, { status: 403 });
    }

    // Check if review already exists
    const { data: existingReview } = await supabaseAdmin
      .from('influencer_reviews')
      .select('id')
      .eq('influencer_id', influencerId)
      .eq('brand_email', brandEmail)
      .single();

    if (existingReview) {
      const errorMsg = lang === 'el'
        ? 'Έχετε ήδη αξιολογήσει αυτόν τον influencer. Μπορείτε να υποβάλετε μόνο μια αξιολόγηση ανά συνεργασία.'
        : 'You have already reviewed this influencer. You can only submit one review per collaboration.';
      return NextResponse.json({ 
        error: errorMsg 
      }, { status: 400 });
    }

    // Insert review
    const { data: review, error: insertError } = await supabaseAdmin
      .from('influencer_reviews')
      .insert([{
        influencer_id: influencerId,
        brand_email: brandEmail,
        brand_name: brandName || brandEmail,
        rating: parseInt(rating),
        review_text: reviewText || null,
        project_type: projectType || null,
        verified: true // Verified because we checked for completed proposals above
      }])
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Calculate and update average rating
    const { data: allReviews } = await supabaseAdmin
      .from('influencer_reviews')
      .select('rating')
      .eq('influencer_id', influencerId);

    if (allReviews && allReviews.length > 0) {
      const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
      const totalReviews = allReviews.length;

      await supabaseAdmin
        .from('influencers')
        .update({
          avg_rating: Math.round(avgRating * 100) / 100, // Round to 2 decimals
          total_reviews: totalReviews
        })
        .eq('id', influencerId);
    }

    return NextResponse.json({ success: true, review });
  } catch (error: any) {
    console.error('Reviews POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


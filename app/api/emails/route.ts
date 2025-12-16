import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// --- ΤΟ VERIFIED EMAIL (ΤΟ ΔΙΚΟ ΣΟΥ) ---
const VERIFIED_SENDER_EMAIL = 'nd.6@hotmail.com'; // Βάλε το δικό σου verified email

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, email, name } = body;

    let subject = "";
    let html = "";
    let toEmail = email; 

    // --- 1. SET PARAMS ---

    if (type === 'signup_influencer') {
      subject = "Καλωσήρθες στο Influo! 🚀";
      html = `... (Your HTML here) ...`;
    } 
    else if (type === 'signup_admin') {
      toEmail = VERIFIED_SENDER_EMAIL; // Admin email, παραλήπτης είσαι εσύ
      subject = `🔔 Νέα εγγραφή: ${name}`;
      html = `... (Your HTML here) ...`;
    }
    else if (type === 'approved') {
      subject = "Συγχαρητήρια! Το προφίλ σου εγκρίθηκε ✅";
      html = `... (Your HTML here) ...`;
    }

    // --- 2. SEND ---
    
    // ΕΔΩ ΕΙΝΑΙ ΤΟ ΚΛΕΙΔΙ:
    // Αν ο τύπος ΔΕΝ είναι Admin (άρα είναι Influencer), στέλνουμε το mail ΚΑΙ στον εαυτό μας ΚΑΙ στον Influencer.
    // ΟΜΩΣ, για να περάσει το validation, βάζουμε το TO να είναι ΜΟΝΟ το verified email.
    
    let finalTo = [toEmail]; // Το default είναι ο Influencer

    if (type === 'signup_influencer' || type === 'approved') {
        // Αν είναι mail προς Influencer, το στέλνουμε ΜΟΝΟ στον εαυτό μας για να περάσει το validation
        finalTo = [VERIFIED_SENDER_EMAIL];
        // Και προσθέτουμε το email του influencer στο Bcc
        // Αυτή η μέθοδος ΔΕΝ δουλεύει στο Free Tier, οπότε:
        
        // --- ΤΟ ΠΡΑΓΜΑΤΙΚΟ FIX ΓΙΑ ΤΟ FREE TIER ---
        // Στέλνουμε το mail ΜΟΝΟ στον εαυτό μας, και στο subject βάζουμε το πραγματικό mail:
        finalTo = [VERIFIED_SENDER_EMAIL];
        subject = `[INFLUENSER - ${email}] ` + subject;
    }


    const data = await resend.emails.send({
      from: `Influo <${VERIFIED_SENDER_EMAIL}>`, // FROM ΠΑΝΤΑ ΤΟ VERIFIED EMAIL
      to: finalTo,
      subject: subject,
      html: html,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Resend Error:", error);
    return NextResponse.json({ success: false, error }, { status: 500 });
  }
}
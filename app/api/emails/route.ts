import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// --- ΟΡΙΣΤΙΚΟ FIX: ΠΑΝΤΑ ΤΟ @INFLUO.GR (Verified Domain) ---
const VERIFIED_SENDER_EMAIL = 'noreply@influo.gr'; 
const ADMIN_RECEIVING_EMAIL = 'nd.6@hotmail.com'; // Το email που λαμβάνεις notifications

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, email, name } = body;

    let subject = "";
    let html = "";
    let toEmail = email; 
    
    // --- SET PARAMS ---
    if (type === 'signup_admin') {
      toEmail = ADMIN_RECEIVING_EMAIL; // Διορθώνουμε τον παραλήπτη: ΠΑΕΙ ΣΤΟΝ ΕΑΥΤΟ ΜΑΣ
      subject = `🔔 Νέα εγγραφή: ${name}`;
      // ... (Your HTML) ...
    } else if (type === 'approved' || type === 'signup_influencer') {
      // Το From είναι @influo.gr, το To είναι ο Influencer
      subject = type === 'approved' ? "Συγχαρητήρια! Το προφίλ σου εγκρίθηκε ✅" : "Καλωσήρθες στο Influo! 🚀";
      // ... (Your HTML) ...
    }

    // --- SEND ---
    const data = await resend.emails.send({
      from: `Influo <${VERIFIED_SENDER_EMAIL}>`, // <-- FROM ΕΙΝΑΙ ΠΑΝΤΑ @influo.gr
      to: [toEmail],
      subject: subject,
      html: html,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Resend Error:", error);
    return NextResponse.json({ success: false, error }, { status: 500 });
  }
}
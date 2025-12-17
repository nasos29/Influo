import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// --- 1. SENDER: ΠΑΝΤΑ ΤΟ @INFLUO.GR (Verified Domain) ---
const SENDER_EMAIL = 'noreply@influo.gr'; 

// --- 2. RECEIVER: Πρέπει να διαβάζει το email του Admin από το Vercel ---
// Αυτή η μεταβλητή (nd.6@hotmail.com) είναι μόνο για να λαμβάνει, όχι να στέλνει
const ADMIN_RECEIVING_EMAIL = process.env.ADMIN_EMAIL || 'admin@influo.gr'; 

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, email, name } = body;

    let subject = "";
    let html = "";
    let toEmail = email; 

    // --- LOGIC ---
    if (type === 'signup_influencer') {
      subject = "Καλωσήρθες στο Influo! 🚀";
      html = `...`; 
      toEmail = email; // Παραλήπτης: Influencer
    } 
    else if (type === 'signup_admin') {
      toEmail = ADMIN_RECEIVING_EMAIL; // Παραλήπτης: Εσύ
      subject = `🔔 Νέα εγγραφή: ${name}`;
      html = `...`; 
    }
    else if (type === 'approved') {
      toEmail = email;
      subject = "Συγχαρητήρια! Το προφίλ σου εγκρίθηκε ✅";
      html = `...`; 
    }

    // --- SEND: Χρησιμοποιούμε το Verified Domain Email ---
    const data = await resend.emails.send({
      from: `Influo <${SENDER_EMAIL}>`, // <-- FROM ΕΙΝΑΙ ΠΑΝΤΑ @influo.gr
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
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
    if (type === 'signup_influencer') {
      toEmail = email;
      subject = "Καλωσήρθες στο Influo! 🚀";
      html = `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
            <h1 style="color: #1e40af;">Γεια σου ${name}!</h1>
            <p>Λάβαμε την αίτησή σου για το Creator Club. Ευχαριστούμε για την εγγραφή!</p>
            <p>Η ομάδα μας θα ελέγξει το προφίλ και τα screenshots σου εντός 24 ωρών.</p>
            <p>Θα λάβεις νέο email μόλις εγκριθείς και το προφίλ σου γίνει δημόσιο.</p>
            <br/>
            <p>Με εκτίμηση,<br/>Η ομάδα του Influo</p>
        </div>
      `;
    } 
    else if (type === 'signup_admin') {
      toEmail = ADMIN_RECEIVING_EMAIL; // Διορθώνουμε τον παραλήπτη: ΠΑΕΙ ΣΤΟΝ ΕΑΥΤΟ ΜΑΣ
      subject = `🔔 Νέα εγγραφή: ${name}`;
      html = `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9;">
            <h1 style="color: #ca8a04;">Νέος Influencer για έλεγχο!</h1>
            <p>Ο/Η <strong>${name}</strong> μόλις έκανε εγγραφή.</p>
            <p>Email: ${email}</p>
            <p>Location: ${body.location || 'N/A'}</p>
            <p>Παρακαλώ μπες στο Admin Dashboard για έγκριση:</p>
            <a href="https://${req.headers.get('host')}/admin" style="display: inline-block; padding: 10px 20px; background-color: #1e40af; color: white; text-decoration: none; border-radius: 5px;">Πήγαινε στο Admin Dashboard</a>
        </div>
      `;
    }
    else if (type === 'approved') {
      toEmail = email;
      subject = "Συγχαρητήρια! Το προφίλ σου εγκρίθηκε ✅";
      html = `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #10b981; border-radius: 8px; background-color: #ecfdf5;">
            <h1 style="color: #047857;">Είσαι Live! Συγχαρητήρια!</h1>
            <p>Γεια σου ${name},</p>
            <p>Το προφίλ σου ελέγχθηκε και είναι πλέον ενεργό στο Directory μας.</p>
            <p>Ξεκίνα να δέχεσαι προτάσεις συνεργασίας!</p>
            <br/>
            <p>Με εκτίμηση,<br/>Η ομάδα του Influo</p>
        </div>
      `;
    }

    // --- SEND ---
    const data = await resend.emails.send({
      from: `Influo <${VERIFIED_SENDER_EMAIL}>`, 
      to: [toEmail],
      subject: subject,
      html: html, // ΕΔΩ ΕΙΝΑΙ ΠΛΕΟΝ ΤΟ ΠΕΡΙΕΧΟΜΕΝΟ
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Resend Error:", error);
    return NextResponse.json({ success: false, error }, { status: 500 });
  }
}
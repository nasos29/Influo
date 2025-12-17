import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const VERIFIED_SENDER_EMAIL = 'noreply@influo.gr'; 
const ADMIN_RECEIVING_EMAIL = process.env.ADMIN_EMAIL || 'admin@influo.gr'; 

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, email, name, location } = body; // Προσθήκη location για το Admin mail

    let subject = "";
    let html = "";
    let toEmail = email; 
    
    // --- SET PARAMS ---
    if (type === 'signup_influencer') {
      toEmail = email;
      subject = "Επιβεβαίωση Εγγραφής | Welcome to Influo! 🤝"; // ΝΕΟ SUBJECT
      html = `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #1e40af; border-radius: 8px; background-color: #eff6ff;">
            <h1 style="color: #1e40af;">Ευχαριστούμε για την εγγραφή σου, ${name}!</h1>
            <p>Λάβαμε το προφίλ σου. Η αίτησή σου βρίσκεται υπό έλεγχο.</p>
            <p>Θα ελέγξουμε τα Insights σου και θα σε εγκρίνουμε εντός 24 ωρών.</p>
            <br/>
            <p>Θα λάβεις ένα νέο email **μόλις** το προφίλ σου γίνει δημόσιο στο Directory.</p>
            <br/>
            <p>Με εκτίμηση,<br/>Η ομάδα του Influo</p>
        </div>
      `;
    } 
    else if (type === 'signup_admin') {
      toEmail = ADMIN_RECEIVING_EMAIL; 
      subject = `🔔 Νέα εγγραφή: ${name}`;
      html = `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ca8a04; border-radius: 8px; background-color: #fefce8;">
            <h1 style="color: #ca8a04;">Νέος Influencer για έλεγχο!</h1>
            <p>Ο/Η <strong>${name}</strong> μόλις έκανε εγγραφή.</p>
            <p>Email: ${email}</p>
            <p>Location: ${location || 'N/A'}</p>
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
            <p>Το προφίλ σου είναι πλέον ενεργό στο Directory μας. Τα Brands μπορούν να σε βρουν!</p>
            <br/>
            <p>Καλή επιτυχία,<br/>Η ομάδα του Influo</p>
        </div>
      `;
    }

    // --- SEND ---
    const data = await resend.emails.send({
      from: `Influo <${VERIFIED_SENDER_EMAIL}>`, 
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
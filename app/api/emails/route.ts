import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@influo.gr'; // Βάλε το email σου στο .env

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, email, name } = body;

    let subject = "";
    let html = "";
    let toEmail = "";

    // 1. Email στον Influencer μόλις γραφτεί (Confirmation)
    if (type === 'signup_influencer') {
      toEmail = email;
      subject = "Καλωσήρθες στο Influo! 🚀";
      html = `
        <h1>Γεια σου ${name}!</h1>
        <p>Λάβαμε την αίτησή σου για το Creator Club.</p>
        <p>Η ομάδα μας θα ελέγξει το προφίλ και τα screenshots σου εντός 24 ωρών.</p>
        <p>Θα λάβεις νέο email μόλις εγκριθείς.</p>
        <br/>
        <p>Με εκτίμηση,<br/>Η ομάδα του Influo</p>
      `;
    } 
    // 2. Email στον Admin (Εσένα) ότι κάποιος γράφτηκε
    else if (type === 'signup_admin') {
      toEmail = ADMIN_EMAIL;
      subject = `🔔 Νέα εγγραφή: ${name}`;
      html = `
        <h1>Νέος Influencer!</h1>
        <p>Ο/Η <strong>${name}</strong> μόλις έκανε εγγραφή.</p>
        <p>Email: ${email}</p>
        <p><a href="https://influo.gr/admin">Πήγαινε στο Admin Dashboard</a> για έλεγχο και έγκριση.</p>
      `;
    }
    // 3. Email στον Influencer όταν εγκριθεί (Approval)
    else if (type === 'approved') {
      toEmail = email;
      subject = "Συγχαρητήρια! Το προφίλ σου εγκρίθηκε ✅";
      html = `
        <h1>Είσαι Live!</h1>
        <p>Γεια σου ${name},</p>
        <p>Το προφίλ σου ελέγχθηκε και είναι πλέον ενεργό στο Directory μας.</p>
        <p>Τα Brands μπορούν πλέον να βλέπουν τα στοιχεία σου και να σου στέλνουν προτάσεις.</p>
        <br/>
        <p>Καλή επιτυχία,<br/>Η ομάδα του Influo</p>
      `;
    }

    // Αποστολή Email
    const data = await resend.emails.send({
      from: 'Influo <onboarding@resend.dev>', // Στο Free tier, άστο έτσι ή use your verified domain
      to: [toEmail],
      subject: subject,
      html: html,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error }, { status: 500 });
  }
}
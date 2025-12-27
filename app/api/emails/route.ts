import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

// --- ΤΑ VERIFIED EMAILS ---
const VERIFIED_SENDER_EMAIL = 'noreply@influo.gr'; 
const ADMIN_RECEIVING_EMAIL = process.env.ADMIN_EMAIL || 'nd.6@hotmail.com'; 

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, email, name, location, brandName, influencerName, proposalType, influencerId, budget, message } = body;
    const host = req.headers.get('host') || 'influo.gr';

    // Validation
    if (!type || !email) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: type and email' },
        { status: 400 }
      );
    }

    // Check if RESEND_API_KEY is set
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Email service not configured. RESEND_API_KEY missing.' },
        { status: 500 }
      );
    }

    let subject = "";
    let html = "";
    let toEmail = email; 

    // --- SET PARAMS ---

    if (type === 'signup_influencer') {
      subject = "Επιβεβαίωση Εγγραφής | Welcome to Influo! 🤝"; 
      html = `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #1e40af; border-radius: 8px; background-color: #eff6ff;">
            <h1 style="color: #1e40af;">Ευχαριστούμε για την εγγραφή σου, ${name}!</h1>
            <p>Λάβαμε το προφίλ σου. Η αίτησή σου βρίσκεται υπό έλεγχο.</p>
            <p>Θα ελέγξουμε τα Insights σου και θα σε εγκρίνουμε εντός 24 ωρών.</p>
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
            <a href="https://${host}/admin" style="display: inline-block; padding: 10px 20px; background-color: #1e40af; color: white; text-decoration: none; border-radius: 5px;">Πήγαινε στο Admin Dashboard</a>
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
            <p>Το προφίλ σου ελέγχθηκε και είναι πλέον ενεργό στο Directory μας. Τα Brands μπορούν να σε βρουν!</p>
            <br/>
            <p>Καλή επιτυχία,<br/>Η ομάδα του Influo</p>
        </div>
      `;
    }
    // --- NEW: BRAND CONFIRMATION EMAIL ---
    else if (type === 'proposal_brand_confirmation') {
        toEmail = email; // Brand's Email
        subject = `Επιβεβαίωση Πρότασης | Proposal to ${influencerName} received!`;
        html = `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #6366f1; border-radius: 8px; background-color: #f5f3ff;">
                <h1 style="color: #6366f1;">Επιβεβαίωση Πρότασης για τον/την ${influencerName}</h1>
                <p>Λάβαμε επιτυχώς την πρόταση συνεργασίας από την ${brandName} για την υπηρεσία: <strong>${proposalType}</strong>.</p>
                <p>Ο/Η ${influencerName} θα λάβει την πρότασή σου και θα σου απαντήσει άμεσα.</p>
                <br/>
                <p>Μείνετε συντονισμένοι,<br/>Η ομάδα του Influo</p>
            </div>
        `;
    }
    else if (type === 'profile_edit_admin') {
        toEmail = ADMIN_RECEIVING_EMAIL;
        subject = `🔔 Επεξεργασία Προφίλ: ${name}`;
        html = `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #f59e0b; border-radius: 8px; background-color: #fffbeb;">
                <h1 style="color: #d97706;">Προφίλ Επεξεργάστηκε - Απαιτείται Επαν-Επαλήθευση!</h1>
                <p>Ο/Η <strong>${name}</strong> (${email}) μόλις επεξεργάστηκε το προφίλ του/της.</p>
                <p>Location: ${location || 'N/A'}</p>
                <p><strong>Το προφίλ έχει μεταβεί σε "Pending" status και απαιτείται επαν-επαλήθευση.</strong></p>
                <br/>
                <p>Παρακαλώ μπες στο Admin Dashboard για έλεγχο:</p>
                <a href="https://${host}/admin" style="display: inline-block; padding: 10px 20px; background-color: #1e40af; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">Πήγαινε στο Admin Dashboard</a>
            </div>
        `;
    }
    else if (type === 'proposal_admin_notification') {
        toEmail = ADMIN_RECEIVING_EMAIL;
        subject = `📨 Νέα Πρόταση από ${brandName} προς ${influencerName}`;
        html = `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #8b5cf6; border-radius: 8px; background-color: #faf5ff;">
                <h1 style="color: #7c3aed;">Νέα Πρόταση Συνεργασίας!</h1>
                <div style="background-color: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #8b5cf6;">
                    <p><strong>Brand:</strong> ${brandName}</p>
                    <p><strong>Email:</strong> ${email}</p>
                    <p><strong>Influencer:</strong> ${influencerName}</p>
                    <p><strong>Υπηρεσία:</strong> ${proposalType}</p>
                    <p><strong>Budget:</strong> €${budget}</p>
                    ${message ? `<p><strong>Μήνυμα:</strong><br/>${message.replace(/\n/g, '<br/>')}</p>` : ''}
                </div>
                <p>Παρακαλώ μπες στο Admin Dashboard για να δεις όλες τις προτάσεις:</p>
                <a href="https://${host}/admin" style="display: inline-block; padding: 10px 20px; background-color: #8b5cf6; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">Πήγαινε στο Admin Dashboard</a>
            </div>
        `;
    }
    else if (type === 'message_admin_notification') {
        toEmail = ADMIN_RECEIVING_EMAIL;
        const { senderName, senderType, recipientName, conversationId, messageContent } = body;
        subject = `💬 Νέο Μήνυμα: ${senderName} → ${recipientName}`;
        html = `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #0ea5e9; border-radius: 8px; background-color: #f0f9ff;">
                <h1 style="color: #0284c7;">Νέο Μήνυμα στη Συνέντευξη</h1>
                <div style="background-color: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #0ea5e9;">
                    <p><strong>Από:</strong> ${senderName} (${senderType === 'brand' ? 'Brand' : 'Influencer'})</p>
                    <p><strong>Προς:</strong> ${recipientName}</p>
                    <p><strong>Μήνυμα:</strong></p>
                    <div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; margin-top: 8px; white-space: pre-wrap;">${messageContent.replace(/\n/g, '<br/>')}</div>
                </div>
                <p>Παρακαλώ μπες στο Admin Dashboard για να δεις τη συνομιλία:</p>
                <a href="https://${host}/admin?conversation=${conversationId}" style="display: inline-block; padding: 10px 20px; background-color: #0ea5e9; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">Πήγαινε στο Admin Dashboard</a>
            </div>
        `;
    }

    // Validation: Check if subject and html are set
    if (!subject || !html) {
      return NextResponse.json(
        { success: false, error: `Invalid email type: ${type}` },
        { status: 400 }
      );
    }

    // --- SEND ---
    const data = await resend.emails.send({
      from: `Influo <${VERIFIED_SENDER_EMAIL}>`, 
      to: [toEmail],
      subject: subject,
      html: html,
    });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Resend Error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error?.message || 'Unknown error occurred'
      }, 
      { status: 500 }
    );
  }
}
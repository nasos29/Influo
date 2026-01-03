import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

// --- ΤΑ VERIFIED EMAILS ---
const VERIFIED_SENDER_EMAIL = 'noreply@influo.gr'; 
const ADMIN_RECEIVING_EMAIL = process.env.ADMIN_EMAIL || 'nd.6@hotmail.com'; 

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, email, name, location, brandName, influencerName, proposalType, influencerId, budget, message, conversationId, messages } = body;
    const host = req.headers.get('host') || 'influo.gr';

    // Log incoming request for debugging
    console.log('[Email API] Received request:', { 
      type, 
      hasEmail: !!email, 
      hasToEmail: !!body.toEmail, 
      hasBrandName: !!brandName,
      hasInfluencerName: !!influencerName,
      hasMessage: !!message
    });

    // Validation - email is optional for admin notifications
    if (!type) {
      console.error('[Email API] Missing type field');
      return NextResponse.json(
        { success: false, error: 'Missing required field: type' },
        { status: 400 }
      );
    }
    
    // Some email types don't require email field (admin notifications)
    if ((type === 'message_admin_notification' || type === 'proposal_admin_notification' || type === 'profile_edit_admin' || type === 'signup_admin')) {
      // Admin notifications - email is not required from body
    } else if (type === 'conversation_end' || type === 'message_offline') {
      // conversation_end and message_offline require email but it might be in body.email or body.toEmail
      if (!email && !body.toEmail) {
        return NextResponse.json(
          { success: false, error: 'Missing required field: email or toEmail' },
          { status: 400 }
        );
      }
    } else if (!email && !body.toEmail) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: email' },
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
    else if (type === 'message_offline') {
        // toEmail should come from the body for this type (influencer's email)
        toEmail = body.toEmail || email;
        
        // Validate required fields for message_offline
        if (!toEmail) {
          console.error('[Email API] message_offline missing toEmail');
          return NextResponse.json(
            { success: false, error: 'Missing required field: toEmail' },
            { status: 400 }
          );
        }
        if (!message) {
          console.error('[Email API] message_offline missing message');
          return NextResponse.json(
            { success: false, error: 'Missing required field: message' },
            { status: 400 }
          );
        }
        
        const displayBrandName = brandName || body.brandEmail || 'Brand';
        subject = `💬 Νέο μήνυμα από ${displayBrandName}`;
        html = `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #0ea5e9; border-radius: 8px; background-color: #f0f9ff;">
                <h1 style="color: #0284c7;">Νέο Μήνυμα</h1>
                <p>Έχετε λάβει ένα νέο μήνυμα από το brand <strong>${displayBrandName}</strong>.</p>
                <div style="background-color: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #0ea5e9;">
                    <p style="white-space: pre-wrap;">${message}</p>
                </div>
                <p>Παρακαλώ συνδεθείτε στο dashboard σας για να δείτε όλη τη συνομιλία.</p>
                <a href="https://${host}/dashboard" style="display: inline-block; padding: 10px 20px; background-color: #0ea5e9; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">Πήγαινε στο Dashboard</a>
            </div>
        `;
    }
    else if (type === 'proposal_influencer_notification') {
        toEmail = email;
        subject = `📨 Νέα Πρόταση από ${brandName}`;
        html = `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #10b981; border-radius: 8px; background-color: #ecfdf5;">
                <h1 style="color: #047857;">Νέα Πρόταση Συνεργασίας!</h1>
                <p>Γεια σου ${influencerName},</p>
                <p>Έχεις λάβει μια νέα πρόταση συνεργασίας από το brand <strong>${brandName}</strong>.</p>
                <div style="background-color: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #10b981;">
                    <p><strong>Υπηρεσία:</strong> ${proposalType}</p>
                    <p><strong>Budget:</strong> €${budget}</p>
                    ${message ? `<p><strong>Μήνυμα:</strong><br/>${message.replace(/\n/g, '<br/>')}</p>` : ''}
                </div>
                <p>Συνδέσου στο dashboard σου για να δεις την πρόταση:</p>
                <a href="https://${host}/dashboard" style="display: inline-block; padding: 10px 20px; background-color: #10b981; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">Πήγαινε στο Dashboard</a>
            </div>
        `;
    }
    else if (type === 'collaboration_complete') {
        toEmail = email;
        subject = `✅ Η συνεργασία με ${brandName} ολοκληρώθηκε!`;
        html = `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #10b981; border-radius: 8px; background-color: #ecfdf5;">
                <h1 style="color: #047857;">Συνεργασία Ολοκληρώθηκε!</h1>
                <p>Γεια σου ${influencerName},</p>
                <p>Η συνεργασία με το brand <strong>${brandName}</strong> έχει ολοκληρωθεί και το brand προστέθηκε στις συνεργασίες σου!</p>
                <p>Το brand ${brandName} εμφανίζεται πλέον στο προφίλ σου στο tab "Συνεργασίες".</p>
                <br/>
                <p>Συγχαρητήρια για την επιτυχημένη συνεργασία! 🎉</p>
                <p>Η ομάδα του Influo</p>
            </div>
        `;
    }
    else if (type === 'proposal_accepted_brand') {
        toEmail = email;
        subject = `✅ Η πρόταση σας για ${influencerName} έγινε αποδεκτή!`;
        html = `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #10b981; border-radius: 8px; background-color: #ecfdf5;">
                <h1 style="color: #047857;">Πρόταση Αποδεκτή!</h1>
                <p>Γεια σας ${brandName},</p>
                <p>Η πρότασή σας προς τον/την <strong>${influencerName}</strong> έχει γίνει αποδεκτή!</p>
                <p>Για να ολοκληρωθεί η συνεργασία, παρακαλώ αποδεχτείτε τους όρους χρήσης.</p>
                <p>Μόλις και οι δύο πλευρές αποδεχτούν, το όνομα σας θα προστεθεί στις συνεργασίες του influencer.</p>
                <br/>
                <p>Παρακαλώ επισκεφτείτε τη σελίδα του influencer για να αποδεχτείτε την συμφωνία:</p>
                <a href="https://${host}/influencer/${body.influencerId}" style="display: inline-block; padding: 10px 20px; background-color: #10b981; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">Δείτε το Προφίλ</a>
            </div>
        `;
    }
    else if (type === 'counter_proposal_notification') {
        toEmail = email;
        const { brandName, influencerName, influencerId, originalBudget, counterBudget, counterMessage, serviceType } = body;
        subject = `💰 Αντιπρόταση από ${influencerName}`;
        html = `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #f59e0b; border-radius: 8px; background-color: #fffbeb;">
                <h1 style="color: #d97706;">Νέα Αντιπρόταση</h1>
                <p>Γεια σας ${brandName},</p>
                <p>Ο/Η <strong>${influencerName}</strong> σας έστειλε μια αντιπρόταση για τη συνεργασία:</p>
                
                <div style="background-color: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #f59e0b;">
                    <p><strong>Υπηρεσία:</strong> ${serviceType}</p>
                    <p><strong>Προσφερόμενη Τιμή:</strong> <span style="color: #6b7280;">€${originalBudget}</span></p>
                    <p><strong>Αντιπρόταση:</strong> <span style="color: #d97706; font-size: 18px; font-weight: bold;">€${counterBudget}</span></p>
                    ${counterMessage ? `<p style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e5e7eb;"><strong>Σχόλιο:</strong><br/>${counterMessage.replace(/\n/g, '<br/>')}</p>` : ''}
                </div>

                <p>Μπορείτε να:</p>
                <ul style="margin: 15px 0; padding-left: 20px;">
                    <li>✅ Αποδεχτείτε την αντιπρόταση</li>
                    <li>❌ Απορρίψετε την αντιπρόταση</li>
                    <li>💬 Συζητήσετε περισσότερες λεπτομέρειες μέσω μηνυμάτων</li>
                </ul>

                <p>Παρακαλώ επισκεφτείτε το προφίλ του influencer για να δράσετε:</p>
                <a href="https://${host}/influencer/${influencerId || ''}" style="display: inline-block; padding: 10px 20px; background-color: #f59e0b; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">Δείτε το Προφίλ</a>
            </div>
        `;
    }
    else if (type === 'conversation_digest') {
        toEmail = email;
        const messageCount = messages?.length || 0;
        subject = `💬 ${messageCount} νέα μηνύματα στη συνομιλία: ${influencerName} ↔ ${brandName}`;
        
        const messagesHtml = messages && messages.length > 0 ? messages.map((msg: any) => `
            <div style="background-color: ${msg.senderType === 'influencer' ? '#f0f9ff' : '#fef3c7'}; padding: 12px; border-radius: 8px; margin-bottom: 12px; border-left: 4px solid ${msg.senderType === 'influencer' ? '#0ea5e9' : '#f59e0b'};">
                <div style="font-weight: bold; color: ${msg.senderType === 'influencer' ? '#0284c7' : '#d97706'}; margin-bottom: 6px;">
                    ${msg.senderName} ${msg.senderType === 'influencer' ? '(Influencer)' : '(Brand)'}
                </div>
                <div style="color: #1e293b; white-space: pre-wrap; margin-bottom: 4px;">${msg.content.replace(/\n/g, '<br/>')}</div>
                <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
                    ${new Date(msg.createdAt).toLocaleString('el-GR')}
                </div>
            </div>
        `).join('') : '<p>Δεν υπάρχουν νέα μηνύματα.</p>';
        
        html = `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #6366f1; border-radius: 8px; background-color: #faf5ff;">
                <h1 style="color: #7c3aed;">Νέα Μηνύματα στη Συνομιλία</h1>
                <p>Έχετε ${messageCount} ${messageCount === 1 ? 'νέο μήνυμα' : 'νέα μηνύματα'} στη συνομιλία:</p>
                <div style="background-color: white; padding: 10px; border-radius: 8px; margin: 15px 0;">
                    <strong>${influencerName}</strong> ↔ <strong>${brandName}</strong>
                </div>
                <div style="max-height: 500px; overflow-y: auto; margin: 15px 0;">
                    ${messagesHtml}
                </div>
                <p>Παρακαλώ συνδεθείτε στο dashboard σας για να δείτε όλη τη συνομιλία και να απαντήσετε:</p>
                <div style="margin-top: 15px;">
                    ${email === (process.env.ADMIN_EMAIL || 'nd.6@hotmail.com') ? 
                      `<a href="https://${host}/admin?conversation=${conversationId}" style="display: inline-block; padding: 10px 20px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 5px; margin-right: 10px;">Πήγαινε στο Admin Dashboard</a>` 
                      : `<a href="https://${host}/dashboard" style="display: inline-block; padding: 10px 20px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 5px;">Πήγαινε στο Dashboard</a>`
                    }
                </div>
            </div>
        `;
    }
    else if (type === 'conversation_end') {
        toEmail = email || body.toEmail;
        const { autoClose } = body;
        const messageCount = messages?.length || 0;
        const closeReason = autoClose 
            ? 'Η συνομιλία έκλεισε λόγω αδράνειας (5 λεπτά χωρίς δραστηριότητα και από τις δύο πλευρές).'
            : 'Η συνομιλία έκλεισε.';
        
        // Ensure influencerName and brandName are set
        const infName = influencerName || 'Influencer';
        const brName = brandName || 'Brand';
        
        subject = `🔒 Η συνομιλία έκλεισε: ${infName} ↔ ${brName}`;
        
        const messagesHtml = messages && messages.length > 0 ? messages.map((msg: any) => `
            <div style="background-color: ${msg.senderType === 'influencer' ? '#f0f9ff' : '#fef3c7'}; padding: 12px; border-radius: 8px; margin-bottom: 12px; border-left: 4px solid ${msg.senderType === 'influencer' ? '#0ea5e9' : '#f59e0b'};">
                <div style="font-weight: bold; color: ${msg.senderType === 'influencer' ? '#0284c7' : '#d97706'}; margin-bottom: 6px;">
                    ${msg.senderName} ${msg.senderType === 'influencer' ? '(Influencer)' : '(Brand)'}
                </div>
                <div style="color: #1e293b; white-space: pre-wrap; margin-bottom: 4px;">${msg.content.replace(/\n/g, '<br/>')}</div>
                <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
                    ${new Date(msg.createdAt).toLocaleString('el-GR')}
                </div>
            </div>
        `).join('') : '<p>Δεν υπήρχαν μηνύματα στη συνομιλία.</p>';
        
        html = `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #dc2626; border-radius: 8px; background-color: #fef2f2;">
                <h1 style="color: #dc2626;">${autoClose ? 'Η Συνομιλία Έκλεισε Λόγω Αδράνειας' : 'Η Συνομιλία Έκλεισε'}</h1>
                <div style="background-color: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #dc2626;">
                    <p style="margin-bottom: 10px;"><strong>Συνομιλία:</strong> ${infName} ↔ ${brName}</p>
                    <p style="margin-bottom: 10px;"><strong>Αιτία:</strong> ${closeReason}</p>
                    <p style="margin-bottom: 10px;"><strong>Συνολικό πλήθος μηνυμάτων:</strong> ${messageCount}</p>
                </div>
                <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <h2 style="color: #1e293b; margin-bottom: 15px; font-size: 18px;">Ολόκληρη η Συνομιλία:</h2>
                    <div style="max-height: 600px; overflow-y: auto; margin: 15px 0;">
                        ${messagesHtml}
                    </div>
                </div>
                <p style="color: #64748b; font-size: 14px; margin-top: 20px;">
                    Αυτό το email περιέχει ολόκληρη τη συνομιλία για αρχειοθέτηση.
                </p>
            </div>
        `;
    }

    // Validation: Check if subject and html are set
    if (!subject || !html) {
      console.error('[Email API] Missing subject or html for type:', type);
      return NextResponse.json(
        { success: false, error: `Invalid email type: ${type}`, details: 'Subject or HTML template not found' },
        { status: 400 }
      );
    }
    
    // Validation: Check if toEmail is set
    if (!toEmail) {
      console.error('[Email API] Missing toEmail after processing');
      return NextResponse.json(
        { success: false, error: 'Missing recipient email (toEmail)' },
        { status: 400 }
      );
    }

    // --- SEND ---
    console.log('Sending email:', { type, toEmail, subject: subject.substring(0, 50) });
    
    try {
      const data = await resend.emails.send({
        from: `Influo <${VERIFIED_SENDER_EMAIL}>`, 
        to: [toEmail],
        subject: subject,
        html: html,
      });

      console.log('Email sent successfully:', { toEmail, data });
      return NextResponse.json({ success: true, data });
    } catch (sendError: any) {
      console.error('Resend send error:', sendError);
      return NextResponse.json(
        { 
          success: false, 
          error: sendError?.message || 'Failed to send email'
        }, 
        { status: 500 }
      );
    }
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
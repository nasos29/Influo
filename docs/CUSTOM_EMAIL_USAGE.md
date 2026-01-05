# 📧 Custom Email API - Support@influo.gr

Για να στείλεις custom emails από το `support@influo.gr` (και να λαμβάνεις replies), χρησιμοποίησε το νέο email type `custom_email`.

## 🚀 Γρήγορη Χρήση

### Μέθοδος 1: Browser Console (Γρήγορο Test)

1. Άνοιξε το browser console (F12)
2. Στείλε αυτό το code:

```javascript
fetch('/api/emails', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'custom_email',
    toEmail: 'recipient@example.com',
    customSubject: 'Θέμα Email',
    customHtml: '<div style="padding: 20px;"><h1>Γεια σου!</h1><p>Αυτό είναι ένα test email.</p></div>'
  })
})
.then(r => r.json())
.then(data => console.log(data))
.catch(err => console.error(err));
```

### Μέθοδος 2: HTML Form (Δες το `SEND_CUSTOM_EMAIL_EXAMPLE.html`)

Άνοιξε το file `docs/SEND_CUSTOM_EMAIL_EXAMPLE.html` στον browser για ένα ready-to-use form!

### API Endpoint
```
POST /api/emails
```

### Request Body
```json
{
  "type": "custom_email",
  "toEmail": "influencer@example.com",
  "customSubject": "Θέμα του Email",
  "customHtml": "<html><body>Το μήνυμα σου</body></html>"
}
```

### Παράδειγμα με JavaScript/TypeScript

```typescript
const sendCustomEmail = async (toEmail: string, subject: string, html: string) => {
  try {
    const response = await fetch('/api/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'custom_email',
        toEmail: toEmail,
        customSubject: subject,
        customHtml: html,
      }),
    });

    const data = await response.json();
    if (data.success) {
      console.log('Email sent successfully!');
    } else {
      console.error('Error:', data.error);
    }
  } catch (error) {
    console.error('Failed to send email:', error);
  }
};

// Παράδειγμα χρήσης
sendCustomEmail(
  'influencer@example.com',
  'Καλώς ήρθες στο Influo!',
  `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h1>Γεια σου!</h1>
      <p>Αυτό είναι ένα custom email από το support team.</p>
      <p>Μπορείς να απαντήσεις σε αυτό το email και θα φτάσει στο support@influo.gr</p>
    </div>
  `
);
```

## ✨ Χαρακτηριστικά

1. **Sender Email**: `support@influo.gr` (αντί για `noreply@influo.gr`)
2. **Sender Name**: "Influo Support"
3. **Reply-To**: `support@influo.gr` - Μπορείς να λαμβάνεις replies!
4. **Custom Content**: Μπορείς να στείλεις οποιοδήποτε subject και HTML content

## 📋 Required Fields

- `type`: Πρέπει να είναι `"custom_email"`
- `toEmail`: Το email address του παραλήπτη
- `customSubject`: Το θέμα του email
- `customHtml`: Το HTML content του email

## ⚠️ Important Notes

1. **Domain Verification**: Το `support@influo.gr` πρέπει να είναι verified στο Resend (βλέπε [DOMAIN_VERIFICATION_SETUP.md](./DOMAIN_VERIFICATION_SETUP.md))
2. **Receiving Replies**: Για να λαμβάνεις replies στο `support@influo.gr`, χρειάζεσαι:
   - Email inbox setup (π.χ. Gmail, Outlook) που να συνδέεται με το `support@influo.gr`
   - IMAP/POP3 configuration στον email provider σου
   - Ή forwarding από το domain provider σου

## 🔍 Difference from Automated Emails

| Feature | Automated Emails | Custom Emails |
|---------|-----------------|---------------|
| Type | `signup_influencer`, `approved`, etc. | `custom_email` |
| From | `noreply@influo.gr` | `support@influo.gr` |
| Reply-To | None | `support@influo.gr` |
| Content | Predefined templates | Custom HTML |

## 📝 Example HTML Template

```html
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px; border-radius: 12px 12px 0 0;">
    <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 0; padding: 0;">📧 Custom Email</h1>
  </div>
  <div style="background: #ffffff; padding: 24px; border: 1px solid #f3f4f6; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="margin: 0 0 16px 0; font-size: 14px;">Γεια σας,</p>
    <p style="margin: 0 0 12px 0; font-size: 13px; color: #4b5563;">Το custom μήνυμα σας εδώ...</p>
    <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
      <p style="margin: 0; font-size: 12px; color: #9ca3af;">Η ομάδα του Influo</p>
    </div>
  </div>
</div>
```


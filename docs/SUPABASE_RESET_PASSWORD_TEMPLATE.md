# Supabase Password Reset Email Template

## Εγκατάσταση στο Supabase Dashboard

1. Πήγαινε στο **Supabase Dashboard** → **Authentication** → **Email Templates**
2. Βρες το template **"Reset Password"** (`auth.email.template.recovery`)
3. Κάνε **Edit** και αντιγράψε-επικόλλησε το παρακάτω HTML:

## HTML Template (Ελληνικό)

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Επαναφορά Κωδικού Πρόσβασης</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 24px; border-radius: 12px 12px 0 0;">
      <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 0; padding: 0;">🔐 Επαναφορά Κωδικού</h1>
    </div>
    <div style="background: #ffffff; padding: 24px; border: 1px solid #f3f4f6; border-top: none; border-radius: 0 0 12px 12px;">
      <p style="margin: 0 0 16px 0; font-size: 14px;">Γεια σας,</p>
      <p style="margin: 0 0 20px 0; font-size: 13px; color: #4b5563;">Έχετε ζητήσει επαναφορά του κωδικού πρόσβασης για το λογαριασμό σας στο Influo.gr.</p>
      <p style="margin: 0 0 20px 0; font-size: 13px; color: #4b5563;">Πατήστε το παρακάτω κουμπί για να ορίσετε έναν νέο κωδικό πρόσβασης:</p>
      <div style="margin: 24px 0; text-align: center;">
        <a href="{{ .ConfirmationURL }}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">Επαναφορά Κωδικού</a>
      </div>
      <p style="margin: 20px 0 0 0; font-size: 12px; color: #6b7280;">Αν δεν ζητήσατε αυτή την επαναφορά, μπορείτε να αγνοήσετε αυτό το email.</p>
      <p style="margin: 12px 0 0 0; font-size: 12px; color: #9ca3af;">Αυτός ο σύνδεσμος είναι έγκυρος για 1 ώρα.</p>
      <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: #9ca3af;">Η ομάδα του Influo.gr</p>
        <p style="margin: 8px 0 0 0; font-size: 11px; color: #d1d5db;">
          <a href="{{ .SiteURL }}" style="color: #6b7280; text-decoration: none;">{{ .SiteURL }}</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>
```

## Subject (Θέμα Email)

```
Επαναφορά Κωδικού Πρόσβασης - Influo.gr
```

## Μεταβλητές Template

Το Supabase παρέχει τις εξής μεταβλητές που μπορείς να χρησιμοποιήσεις:

- `{{ .ConfirmationURL }}` - Ο σύνδεσμος επαναφοράς κωδικού (περιέχει τα tokens)
- `{{ .SiteURL }}` - Το Site URL της εφαρμογής
- `{{ .Email }}` - Το email του χρήστη
- `{{ .TokenHash }}` - Το hashed token (για custom URLs)

## Επαλήθευση

Μετά την αποθήκευση:
1. Δοκίμασε να ζητήσεις επαναφορά κωδικού
2. Πρέπει να λάβεις **μόνο 1 email** από το Supabase
3. Το email θα έχει ελληνικό περιεχόμενο και custom styling

## Σημειώσεις

- Το template χρησιμοποιεί τα ίδια styles με το custom email μας
- Ο σύνδεσμος `{{ .ConfirmationURL }}` περιέχει όλα τα απαραίτητα tokens για την επαναφορά
- Το email θα στείλει από το SMTP server που έχει ρυθμιστεί στο Supabase Dashboard


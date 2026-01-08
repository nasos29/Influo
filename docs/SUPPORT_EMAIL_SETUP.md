# 📧 Support Email Setup - support@influo.gr

## 📋 Επισκόπηση

Το support system του Influo στέλνει **αυτόματα email notifications** στον διαχειριστή (`nd.6@hotmail.com`) όταν:
1. **Δημιουργείται νέο ticket** από χρήστη (μέσω Help Desk)
2. **Ο χρήστης απαντάει** σε ticket

## ✅ Τι λειτουργεί ήδη

### 1. Email Notifications για Tickets
Όταν κάποιος δημιουργεί ticket μέσω του Help Desk:
- ✅ **Auto-reply email** στον χρήστη (από `support@influo.gr`)
- ✅ **Notification email** στον admin (`nd.6@hotmail.com`)

### 2. Email Notifications για Replies
Όταν ο χρήστης απαντάει σε ticket:
- ✅ **Notification email** στον admin (`nd.6@hotmail.com`)

## 🔧 Configuration

### Environment Variable
Βεβαιώσου ότι έχεις στο `.env.local`:
```env
ADMIN_EMAIL=nd.6@hotmail.com
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

### Email που στέλνονται από:
- **From:** `support@influo.gr` (Influo Support)
- **Reply-To:** `support@influo.gr`
- **To:** `nd.6@hotmail.com` (admin)

## 📬 Email Forwarding Setup (Για Direct Emails)

Αν θέλεις να **λαμβάνεις emails που στέλνονται απευθείας στο `support@influo.gr`** (όχι μέσω Help Desk), χρειάζεσαι **Email Forwarding** setup:

### Επιλογή 1: Email Forwarding από Domain Provider
1. Συνδέσου στον **domain provider** σου (όπου έχεις το `influo.gr`)
2. Πήγαινε στα **Email Settings** ή **Mail Forwarding**
3. Δημιούργησε forwarding rule:
   - **From:** `support@influo.gr`
   - **To:** `nd.6@hotmail.com`
4. Save changes

### Επιλογή 2: Gmail/Outlook Email Account
1. Δημιούργησε Gmail ή Outlook account που συνδέεται με το `support@influo.gr`
2. Setup **IMAP/POP3** forwarding
3. Forward όλα τα emails στο `nd.6@hotmail.com`

### Επιλογή 3: Resend Email Webhooks (Advanced)
Αν χρησιμοποιείς Resend για email delivery, μπορείς να setup webhooks:
1. Go to Resend Dashboard → Webhooks
2. Create webhook για incoming emails στο `support@influo.gr`
3. Forward στο admin email

## 🔍 Troubleshooting

### Problem: Δεν λαμβάνω email notifications
**Solution:**
1. Ελέγξτε τα `.env.local`:
   ```bash
   ADMIN_EMAIL=nd.6@hotmail.com
   RESEND_API_KEY=re_xxxxx
   ```
2. Ελέγξτε server logs για email errors
3. Ελέγξτε Resend Dashboard → Logs
4. Ελέγξτε spam folder στο Hotmail

### Problem: Emails πηγαίνουν στο spam
**Solution:**
1. Προσθέστε το `support@influo.gr` στα contacts
2. Mark ως "Not Spam"
3. Verify domain στο Resend (SPF, DKIM, DMARC records)

### Problem: Δεν λαμβάνω emails που στέλνονται απευθείας στο support@influo.gr
**Solution:**
- Αυτό χρειάζεται **email forwarding setup** από τον domain provider σου
- Δες "Email Forwarding Setup" παραπάνω

## 📊 Email Flow

```
User creates ticket via Help Desk
        ↓
   Ticket API
        ↓
   ┌─────────────────┐
   │                 │
   ↓                 ↓
Auto-reply      Admin Notification
to User         to nd.6@hotmail.com
(support@...)   (support@...)
```

## 📝 Test Email Notifications

Για να δοκιμάσεις αν λειτουργεί:
1. Δημιούργησε test ticket μέσω Help Desk
2. Έλεγξε το inbox στο `nd.6@hotmail.com`
3. Έλεγξε spam folder αν δεν βλέπεις το email

## 🔗 Σχετικά Αρχεία

- `app/api/tickets/create/route.ts` - Ticket creation API
- `app/api/tickets/user-reply/route.ts` - User reply API
- `docs/EMAIL_TROUBLESHOOTING.md` - Email troubleshooting guide


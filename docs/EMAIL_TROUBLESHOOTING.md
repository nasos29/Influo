# Email Troubleshooting Guide

## 🔍 Έλεγχος Email Configuration

### 1. Environment Variables
Βεβαιώσου ότι έχεις στο `.env`:
```env
RESEND_API_KEY=re_xxxxxxxxxxxxx
ADMIN_EMAIL=nd.6@hotmail.com
```

### 2. Resend Domain Verification
Το `noreply@influo.gr` πρέπει να είναι verified στο Resend Dashboard:
1. Πήγαινε στο https://resend.com/domains
2. Verify το domain `influo.gr`
3. Add DNS records (SPF, DKIM, DMARC)

**📖 Δες την πλήρη οδηγία:** [DOMAIN_VERIFICATION_SETUP.md](./DOMAIN_VERIFICATION_SETUP.md)

### 3. Test Email API
```bash
curl -X POST http://localhost:3000/api/emails \
  -H "Content-Type: application/json" \
  -d '{
    "type": "signup_influencer",
    "email": "test@example.com",
    "name": "Test User"
  }'
```

## 🐛 Common Issues

### Issue 1: RESEND_API_KEY missing
**Symptom:** Emails δεν στέλνονται, error στο console

**Solution:**
```env
# Add to .env
RESEND_API_KEY=your_resend_api_key_here
```

### Issue 2: Domain not verified
**Symptom:** `Domain not verified` error

**Solution:**
- Verify domain στο Resend Dashboard
- Add DNS records για SPF, DKIM, DMARC

### Issue 3: Email στο spam
**Symptom:** Emails φτάνουν αλλά στο spam folder

**Solution:**
- Verify domain properly
- Add SPF, DKIM, DMARC records
- Use verified sender email

### Issue 4: Emails fail silently
**Symptom:** No errors αλλά emails δεν φτάνουν

**Solution:**
- Check browser console για errors
- Check server logs (Vercel logs)
- Verify RESEND_API_KEY
- Check Resend dashboard για failed deliveries

## 📋 Email Types Supported

**Automated Emails** (από `noreply@influo.gr`):
1. `signup_influencer` - Confirmation email στον influencer
2. `signup_admin` - Notification στον admin για νέα εγγραφή
3. `approved` - Approval email στον influencer
4. `proposal_brand_confirmation` - Confirmation για proposal
5. ... (όλα τα αυτοματοποιημένα emails)

**Custom Emails** (από `support@influo.gr`):
- `custom_email` - Custom emails που στέλνει ο admin (βλέπε [CUSTOM_EMAIL_USAGE.md](./CUSTOM_EMAIL_USAGE.md))

## ✅ Verification Checklist

- [ ] RESEND_API_KEY is set in environment
- [ ] Domain influo.gr is verified in Resend
- [ ] DNS records are added (SPF, DKIM, DMARC)
- [ ] Sender email `noreply@influo.gr` is verified
- [ ] Test email works (use curl command above)
- [ ] Check browser console για errors
- [ ] Check Vercel logs για API errors

## 🔧 Debug Mode

Άνοιξε browser console και δες:
- `Sending signup confirmation email to: ...`
- `✅ Influencer confirmation email sent successfully`
- `Failed to send influencer confirmation email: ...`

## 📧 Alternative: Use Test Mode

Αν το Resend έχει test mode, μπορείς να χρησιμοποιήσεις test API key για debugging.


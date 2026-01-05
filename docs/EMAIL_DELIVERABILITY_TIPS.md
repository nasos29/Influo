# 📬 Email Deliverability Tips - Avoid Spam Folder

Αν τα emails σου πηγαίνουν στο spam folder, αυτό είναι συνηθισμένο. Εδώ είναι οδηγίες για να βελτιώσεις το deliverability.

## 🔍 Γιατί πηγαίνουν στο Spam?

1. **Νέο Domain/Email Address** - Το `support@influo.gr` είναι νέο, δεν έχει sender reputation ακόμα
2. **DNS Records** - Αν τα SPF, DKIM, DMARC records δεν είναι σωστά configured
3. **Email Content** - Κάποια keywords ή formatting μπορεί να φαίνονται suspicious
4. **Sender Reputation** - Το domain δεν έχει build-up reputation ακόμα

## ✅ Solutions - Step by Step

### 1. Verify DNS Records (Σημαντικό!)

Βεβαιώσου ότι έχεις προσθέσει **όλα** τα DNS records που σου έδωσε το Resend:

- ✅ **SPF Record** (TXT)
- ✅ **DKIM Record** (TXT) - Το πιο σημαντικό!
- ✅ **DMARC Record** (TXT) - Προαιρετικό αλλά συνιστάται

**Πώς να ελέγξεις:**
- Πήγαινε στο [Resend Dashboard → Domains](https://resend.com/domains)
- Επίλεξε το domain `influo.gr`
- Βεβαιώσου ότι όλα τα records είναι **Verified** (πράσινο ✅)

### 2. Warm Up το Email Address

Για νέα email addresses, χρειάζεται "warm-up":

- **Week 1**: Στείλε 5-10 emails τη μέρα
- **Week 2**: Στείλε 10-20 emails τη μέρα
- **Week 3+**: Μπορείς να στέλνεις περισσότερα

**Γιατί:** Τα email providers (Gmail, Outlook, κ.λπ.) χτίζουν trust βασισμένα στο volume και patterns.

### 3. Improve Email Content

**Avoid:**
- Όλες κεφαλαία (ALL CAPS)
- Πολλά exclamation marks (!!!)
- Links σε suspicious URLs
- Attachments (αν δεν είναι απαραίτητα)
- "Spammy" keywords (FREE, URGENT, CLICK HERE, κ.λπ.)

**Best Practices:**
- Professional tone
- Clear subject lines
- Proper HTML structure
- Include unsubscribe link (αν χρειάζεται)

### 4. Check Sender Reputation

**Tools:**
- [MXToolbox Email Health](https://mxtoolbox.com/EmailHealth/)
- [Mail Tester](https://www.mail-tester.com/)
- [Sender Score](https://www.senderscore.org/)

**Τι να ελέγξεις:**
- SPF: PASS
- DKIM: PASS
- DMARC: PASS
- Blacklist status: Clean

### 5. Ask Recipients to Whitelist

Πες στους recipients να:
- Προσθέσουν το `support@influo.gr` στα contacts
- Κάνουν "Mark as Not Spam"
- Μετακινήσουν το email από spam στο inbox

Αυτό βοηθάει το email provider να μάθει ότι τα emails σου είναι legit.

### 6. Use Professional Email Structure

Το email template που χρησιμοποιούμε ήδη είναι καλό, αλλά βεβαιώσου ότι:
- Έχει proper HTML structure
- Έχει text version (plain text alternative)
- Δεν έχει broken links
- Έχει proper encoding (UTF-8)

## 🔧 Quick Fixes

### Fix 1: Verify DKIM Record (Most Important!)

Το DKIM είναι το πιο σημαντικό για deliverability:

1. Πήγαινε στο [Resend Dashboard → Domains](https://resend.com/domains)
2. Επίλεξε `influo.gr`
3. Βεβαιώσου ότι το **DKIM Record** είναι Verified ✅
4. Αν όχι, πρόσθεσε το DNS record που σου δίνει

### Fix 2: Check SPF Record

Βεβαιώσου ότι έχεις μόνο **ένα** SPF record:

```
v=spf1 include:resend.com ~all
```

Μην έχεις duplicate SPF records!

### Fix 3: Add DMARC Record (Recommended)

Πρόσθεσε DMARC record:

```
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=none; rua=mailto:nd.6@hotmail.com
```

## 📊 Expected Timeline

- **Week 1-2**: Emails μπορεί να πηγαίνουν στο spam (normal)
- **Week 2-4**: Με warm-up, θα βελτιωθεί
- **Month 2+**: Θα πηγαίνουν κανονικά στο inbox

## ⚠️ Common Mistakes to Avoid

1. **Μην στείλεις mass emails** από day 1 - θα πάρεις blacklist
2. **Μην αλλάζεις DNS records** συχνά - wait 24-48 ώρες μεταξύ changes
3. **Μην χρησιμοποιείς suspicious content** - keep it professional
4. **Μην στείλεις σε invalid emails** - χρησιμοποίησε email validation

## 🎯 Current Status Check

Για να δεις την τρέχουσα κατάσταση:

1. **Resend Dashboard**: Check domain verification status
2. **DNS Checker**: [dnschecker.org](https://dnschecker.org/) - Ελέγξε αν τα records έχουν propagate
3. **Email Test**: Στείλε test email και δες αν πάει στο spam

## 💡 Pro Tips

1. **Start Small**: Αρχίζεις με λίγα emails και αυξάνεις gradually
2. **Monitor**: Check Resend dashboard για delivery rates
3. **Feedback Loop**: Αν κάποιος στείλει reply, αυτό βοηθάει reputation
4. **Consistency**: Στείλε emails σε regular intervals, όχι bursts

## 🔗 Useful Links

- [Resend Domain Settings](https://resend.com/domains)
- [Mail Tester](https://www.mail-tester.com/) - Test email deliverability
- [MXToolbox Email Health](https://mxtoolbox.com/EmailHealth/)
- [DNS Checker](https://dnschecker.org/) - Check DNS propagation

## ✅ Checklist

- [ ] DKIM record is verified in Resend
- [ ] SPF record is verified in Resend
- [ ] DMARC record is added (recommended)
- [ ] All DNS records have propagated (check with DNS checker)
- [ ] Email content is professional (no spammy keywords)
- [ ] Starting with low volume (warm-up period)
- [ ] Asking recipients to whitelist the email
- [ ] Monitoring delivery rates in Resend dashboard

---

**Remember**: Το να πηγαίνουν emails στο spam όταν ξεκινάς είναι **normal**. Με proper setup και warm-up, θα βελτιωθεί σε 2-4 εβδομάδες!


# 🔐 Domain Verification Setup για Resend (influo.gr)

Για να φαίνεται ότι τα emails έρχονται από το domain **influo.gr** (και όχι από το Resend domain), πρέπει να κάνεις domain verification στο Resend.

## 📋 Βήματα για Domain Verification

### 1. Προσθήκη Domain στο Resend Dashboard

1. Πήγαινε στο [Resend Dashboard](https://resend.com/domains)
2. Κάνε login στον λογαριασμό σου
3. Κάνε click στο **"Add Domain"** ή **"Add New Domain"**
4. Εισήγαγε το domain: `influo.gr`
5. Κάνε click **"Add"**

### 2. DNS Records που χρειάζονται

Το Resend θα σου δώσει **3 τύπους DNS records** που πρέπει να προσθέσεις:

#### A. SPF Record (TXT)
```
Type: TXT
Name: @ (ή influo.gr)
Value: v=spf1 include:resend.com ~all
TTL: 3600 (ή Auto)
```

#### B. DKIM Record (TXT)
```
Type: TXT
Name: resend._domainkey (ή resend._domainkey.influo.gr)
Value: [το value που θα σου δώσει το Resend - είναι unique]
TTL: 3600 (ή Auto)
```

#### C. DMARC Record (TXT) - Προαιρετικό αλλά συνιστάται
```
Type: TXT
Name: _dmarc (ή _dmarc.influo.gr)
Value: v=DMARC1; p=none; rua=mailto:nd.6@hotmail.com
TTL: 3600 (ή Auto)
```

### 3. Προσθήκη DNS Records

**Που να τα προσθέσεις:**
- Αν έχεις το domain στο **GoDaddy**: Domain Settings → DNS Management
- Αν έχεις το domain στο **Namecheap**: Domain List → Manage → Advanced DNS
- Αν έχεις το domain στο **Cloudflare**: DNS → Records → Add Record
- Αν έχεις το domain σε **άλλο provider**: Βρες το DNS Management section

**Πώς να τα προσθέσεις:**
1. Πήγαινε στο DNS Management του domain provider σου
2. Για κάθε record:
   - Επίλεξε **Type**: TXT
   - Επίλεξε **Name**: (το όνομα που σου έδωσε το Resend)
   - Επίλεξε **Value**: (το value που σου έδωσε το Resend)
   - Επίλεξε **TTL**: 3600 ή Auto
3. Κάνε **Save** για κάθε record

### 4. Verification στο Resend

Μετά την προσθήκη των DNS records:

1. **Περίμενε 5-10 λεπτά** για να propagate τα DNS records
2. Πήγαινε πίσω στο [Resend Dashboard](https://resend.com/domains)
3. Κάνε click στο domain `influo.gr`
4. Κάνε click στο **"Verify"** button
5. Το Resend θα ελέγξει αν τα DNS records είναι σωστά

**Status Indicators:**
- ✅ **Verified** = Το domain είναι verified και μπορείς να στέλνεις emails
- ⏳ **Pending** = Περίμενε λίγο, τα DNS records δεν έχουν propagate ακόμα
- ❌ **Failed** = Κάτι πήγε στραβά, ελέγξε τα DNS records

### 5. Verification Time

- **SPF Record**: 5-15 λεπτά
- **DKIM Record**: 5-15 λεπτά  
- **DMARC Record**: 5-15 λεπτά
- **Total**: Συνήθως 10-30 λεπτά, αλλά μπορεί να πάρει μέχρι 24 ώρες

## ✅ Μετά το Verification

Μόλις το domain είναι verified:

1. ✅ Τα emails θα φαίνονται ότι έρχονται από `noreply@influo.gr`
2. ✅ Τα emails θα έχουν καλύτερο deliverability (λιγότερο spam)
3. ✅ Θα μπορείς να χρησιμοποιείς οποιοδήποτε email address από το domain:
   - `noreply@influo.gr`
   - `support@influo.gr`
   - `support@influo.gr`
   - `contact@influo.gr`
   - κ.λπ.

## 🔍 Troubleshooting

### Problem: DNS records δεν verify

**Solutions:**
1. Ελέγξε αν τα records είναι **ακριβώς** όπως τα έδωσε το Resend (copy-paste)
2. Περίμενε περισσότερο (μέχρι 24 ώρες)
3. Χρησιμοποίησε [DNS Checker](https://dnschecker.org/) για να δεις αν τα records έχουν propagate
4. Ελέγξε αν υπάρχουν **duplicate records** (π.χ. δύο SPF records) - αφαίρεσε τα παλιά

### Problem: Emails ακόμα φαίνονται από Resend domain

**Solutions:**
1. Βεβαιώσου ότι το domain είναι **verified** στο Resend
2. Ελέγξε αν το `VERIFIED_SENDER_EMAIL` στο code είναι `noreply@influo.gr`
3. Περίμενε λίγο - μπορεί να χρειαστεί cache refresh

### Problem: Emails πηγαίνουν στο spam

**Solutions:**
1. Βεβαιώσου ότι όλα τα DNS records (SPF, DKIM, DMARC) είναι verified
2. Χρησιμοποίησε **warm-up** για το domain (στείλε λίγα emails την πρώτη εβδομάδα)
3. Ελέγξε το [MXToolbox](https://mxtoolbox.com/) για email deliverability issues

## 📧 Current Configuration

Στο codebase, το sender email είναι ήδη ρυθμισμένο:

```typescript
// app/api/emails/route.ts
const VERIFIED_SENDER_EMAIL = 'noreply@influo.gr';
```

Μόλις κάνεις domain verification, αυτό το email θα λειτουργεί κανονικά!

## 🔗 Useful Links

- [Resend Domains Dashboard](https://resend.com/domains)
- [Resend Documentation - Domain Verification](https://resend.com/docs/dashboard/domains/introduction)
- [DNS Checker](https://dnschecker.org/) - Ελέγχει αν τα DNS records έχουν propagate
- [MXToolbox](https://mxtoolbox.com/) - Email deliverability checker

## ⚠️ Important Notes

1. **Μην αλλάξεις τα DNS records** μετά το verification - μπορεί να χαλάσει
2. **Κάνε backup** των παλιών DNS records πριν προσθέσεις νέα
3. **Ένα domain μπορεί να έχει μόνο ένα SPF record** - αν έχεις ήδη SPF, πρέπει να το merge με το Resend SPF
4. **DMARC είναι προαιρετικό** αλλά συνιστάται για καλύτερη deliverability


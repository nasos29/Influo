/** Shared collaboration-agreement terms (UI modal + completion emails). */

export type AgreementLang = "el" | "en";

export const AGREEMENT_TERMS: Record<AgreementLang, readonly string[]> = {
  el: [
    "Αντικείμενο. Ο Δημιουργός θα δημιουργήσει και θα δημοσιεύσει τα παραδοτέα της σύνοψης, σύμφωνα με τις οδηγίες της Επιχείρησης όπως συμφωνήθηκαν στην πλατφόρμα Influo.",
    "Έγκριση περιεχομένου. Πριν από τη δημοσίευση, ο Δημιουργός στέλνει το περιεχόμενο στην Επιχείρηση για έγκριση. Περιλαμβάνεται έως ένας γύρος διορθώσεων, εκτός αν συμφωνηθεί διαφορετικά.",
    "Αμοιβή. Η Επιχείρηση καταβάλλει απευθείας στον Δημιουργό τη συνολική αμοιβή της σύνοψης, μετά τη δημοσίευση του εγκεκριμένου περιεχομένου, εκτός αν συμφωνηθεί γραπτώς διαφορετικά. Το Influo δεν μεσολαβεί στην πληρωμή και δεν ευθύνεται για αυτήν.",
    "Χρήση περιεχομένου. Τα πνευματικά δικαιώματα ανήκουν στον Δημιουργό. Η Επιχείρηση μπορεί να κοινοποιεί (repost) το περιεχόμενο στα δικά της κανάλια με αναφορά στον Δημιουργό. Χρήση σε πληρωμένες διαφημίσεις ή αποκλειστικότητα ισχύει μόνο αν περιλαμβάνεται στα extras και για τη διάρκεια που ορίζουν. Κάθε extra της σύνοψης αποτελεί μέρος της συμφωνίας.",
    "Σήμανση διαφήμισης. Ο Δημιουργός σημαίνει κάθε δημοσίευση ως εμπορική συνεργασία, με την ένδειξη «Συνεργασία επί πληρωμή» ή #διαφήμιση, σύμφωνα με την ισχύουσα νομοθεσία και τους κανόνες κάθε πλατφόρμας.",
    "Ακύρωση. Οποιαδήποτε πλευρά μπορεί να ακυρώσει τη συνεργασία πριν από την έγκριση του περιεχομένου, ενημερώνοντας την άλλη μέσω της πλατφόρμας. Αν το περιεχόμενο έχει ήδη εγκριθεί ή δημοσιευτεί, οφείλεται η συμφωνημένη αμοιβή.",
    "Εμπιστευτικότητα και επικοινωνία. Οι δύο πλευρές κρατούν εμπιστευτικές τις μη δημόσιες πληροφορίες της συνεργασίας και επικοινωνούν επαγγελματικά, κατά προτίμηση μέσω της πλατφόρμας.",
    "Ρόλος του Influo. Το Influo φέρνει σε επαφή τις δύο πλευρές και καταγράφει τη συμφωνία. Δεν είναι συμβαλλόμενο μέρος και δεν εγγυάται την εκτέλεσή της. Μετά την ολοκλήρωση, η συνεργασία μπορεί να εμφανίζεται στο προφίλ του Δημιουργού και οι δύο πλευρές μπορούν να αξιολογήσουν η μία την άλλη. Τυχόν παρουσία σε χώρο, μετακινήσεις, έξοδα ή άλλες λεπτομέρειες εκτέλεσης συμφωνούνται απευθείας μεταξύ των μερών. Το Influo δεν φέρει καμία ευθύνη για τη συμπεριφορά, τις ενέργειες ή τις υποχρεώσεις των μερών, εντός ή εκτός πλατφόρμας.",
  ],
  en: [
    "Scope. The Creator will create and publish the deliverables in the summary, in accordance with the Brand's instructions as agreed on the Influo platform.",
    "Content approval. Before publication, the Creator submits the content to the Brand for approval. Up to one round of revisions is included, unless otherwise agreed.",
    "Fee. The Brand pays the total fee in the summary directly to the Creator after the approved content is published, unless otherwise agreed in writing. Influo does not process the payment and is not liable for it.",
    "Use of content. Copyright remains with the Creator. The Brand may repost the content on its own channels with credit to the Creator. Use in paid advertising or exclusivity applies only if it is included in the extras and for the duration they specify. Each extra in the summary forms part of the agreement.",
    "Advertising disclosure. The Creator marks every publication as a commercial collaboration, with the label “Paid partnership” or #ad, in accordance with applicable law and the rules of each platform.",
    "Cancellation. Either party may cancel the collaboration before the content is approved, by notifying the other party through the platform. If the content has already been approved or published, the agreed fee is due.",
    "Confidentiality and communication. Both parties keep non-public information about the collaboration confidential and communicate professionally, preferably through the platform.",
    "Role of Influo. Influo brings the two parties together and records the agreement. It is not a contracting party and does not guarantee its performance. After completion, the collaboration may appear on the Creator's profile and both parties may review each other. Any attendance at a location, travel, expenses, or other details of performance are agreed directly between the parties. Influo bears no liability for the conduct, actions, or obligations of the parties, on or off the platform.",
  ],
};

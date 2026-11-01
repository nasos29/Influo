// app/terms/page.tsx
"use client";

import { Fragment, type ReactNode } from 'react';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import { LEGAL_LAST_UPDATED } from '@/lib/legalDates';
import { useMarketingLang } from '@/lib/useMarketingLang';

const SUPPORT_EMAIL = "support@influo.gr";

type TermsSection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

type TermsCopy = {
  title: string;
  lastUpdated: string;
  intro: string;
  sections: TermsSection[];
  back: string;
};

function withMailto(text: string): ReactNode {
  if (!text.includes(SUPPORT_EMAIL)) return text;
  const parts = text.split(SUPPORT_EMAIL);
  return parts.map((part, index) => (
    <Fragment key={index}>
      {part}
      {index < parts.length - 1 ? (
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="text-blue-600 hover:text-blue-700 underline"
        >
          {SUPPORT_EMAIL}
        </a>
      ) : null}
    </Fragment>
  ));
}

function TermsSectionBlock({ section }: { section: TermsSection }) {
  const bullets = section.bullets ?? [];
  // A bullet list sits after the opening paragraph. Any further paragraphs follow the list.
  const lead = bullets.length > 0 ? section.paragraphs.slice(0, 1) : section.paragraphs;
  const trailing = bullets.length > 0 ? section.paragraphs.slice(1) : [];

  return (
    <section className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
      <h2 className="text-2xl font-bold text-slate-900 mb-4">{section.title}</h2>
      {lead.map((paragraph, index) => (
        <p
          key={paragraph}
          className={`text-slate-700 leading-relaxed${
            bullets.length > 0 || index < lead.length - 1 ? " mb-3" : ""
          }`}
        >
          {withMailto(paragraph)}
        </p>
      ))}
      {bullets.length > 0 && (
        <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
          {bullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      {trailing.map((paragraph) => (
        <p key={paragraph} className="text-slate-700 mt-4 leading-relaxed">
          {withMailto(paragraph)}
        </p>
      ))}
    </section>
  );
}

export default function TermsPage() {
  const [lang, setLang] = useMarketingLang();

  const content: Record<"el" | "en", TermsCopy> = {
    el: {
      title: "Όροι Χρήσης",
      lastUpdated: "Τελευταία ενημέρωση:",
      intro: "Οι παρόντες Όροι Χρήσης διέπουν την πρόσβαση και τη χρήση της ηλεκτρονικής πλατφόρμας Influo.gr («Πλατφόρμα» ή «Influo»). Με την πρόσβαση ή τη χρήση της Πλατφόρμας ο χρήστης δηλώνει ότι έχει διαβάσει, κατανοήσει και αποδεχθεί ανεπιφύλακτα τους παρόντες Όρους. Σε αντίθετη περίπτωση οφείλει να απέχει από κάθε χρήση της.",
      sections: [
        {
          title: "1. Ορισμοί",
          paragraphs: [
            "«Χρήστης» είναι κάθε φυσικό ή νομικό πρόσωπο που επισκέπτεται ή χρησιμοποιεί την Πλατφόρμα. «Δημιουργός» (influencer / creator) είναι ο Χρήστης που διατηρεί προφίλ για παροχή υπηρεσιών δημιουργίας και προβολής περιεχομένου. «Brand» είναι ο Χρήστης που αναζητά τέτοιες υπηρεσίες. «Μέρη» είναι ο Δημιουργός και το Brand μιας συγκεκριμένης συνεργασίας. «Συμφωνία Συνεργασίας» είναι η σύνοψη όρων που αποδέχονται τα Μέρη μέσω της Πλατφόρμας.",
          ],
        },
        {
          title: "2. Φύση της υπηρεσίας",
          paragraphs: [
            "Η Πλατφόρμα παρέχει αποκλειστικά υπηρεσία καταχώρισης και διασύνδεσης. Δίνει τα τεχνικά μέσα ώστε Δημιουργοί και Brands να εντοπίζουν ο ένας τον άλλον, να επικοινωνούν, να ανταλλάσσουν προτάσεις και να καταγράφουν τους όρους της συνεργασίας τους. Το Influo δεν είναι συμβαλλόμενο μέρος, αντιπρόσωπος, εντολοδόχος, εργοδότης ή εγγυητής κανενός Χρήστη. Δεν εκτελεί, δεν εποπτεύει και δεν εγγυάται καμία συνεργασία.",
          ],
        },
        {
          title: "3. Εγγραφή και λογαριασμός",
          paragraphs: [
            "Η εγγραφή επιτρέπεται μόνο σε πρόσωπα άνω των 18 ετών με πλήρη δικαιοπρακτική ικανότητα. Νομικό πρόσωπο εγγράφεται μέσω νομίμως εξουσιοδοτημένου εκπροσώπου. Ο Χρήστης οφείλει να παρέχει ακριβή, πλήρη και επίκαιρα στοιχεία. Οφείλει επίσης να τηρεί εμπιστευτικά τα στοιχεία πρόσβασής του και ευθύνεται για κάθε ενέργεια που γίνεται μέσω του λογαριασμού του. Τα προφίλ Δημιουργών δημοσιεύονται κατόπιν έγκρισης. Το Influo μπορεί να αρνηθεί, να αναστείλει ή να αφαιρέσει προφίλ κατά την κρίση του.",
          ],
        },
        {
          title: "4. Προφίλ, πακέτα και πρόσθετες χρεώσεις (extras)",
          paragraphs: [
            "Ο Δημιουργός ορίζει μόνος του τα πακέτα υπηρεσιών και τις τιμές του. Μπορεί επίσης να ορίσει προαιρετικές πρόσθετες χρεώσεις: δικαιώματα χρήσης περιεχομένου σε διαφημίσεις, αποκλειστικότητα, παράδοση ακατέργαστου υλικού (raw footage) και επείγουσα παράδοση. Το περιεχόμενο, η διάρκεια και η έκταση κάθε extra συμφωνούνται μεταξύ των Μερών. Όσα extras επιλεγούν και περιληφθούν στη σύνοψη της Συμφωνίας Συνεργασίας αποτελούν αναπόσπαστο μέρος της. Ο Δημιουργός ευθύνεται αποκλειστικά για την ακρίβεια των στοιχείων, των στατιστικών και των τιμών του προφίλ του. Το Influo δεν επαληθεύει και δεν εγγυάται αυτά τα στοιχεία.",
          ],
        },
        {
          title: "5. Προτάσεις και αντιπροτάσεις",
          paragraphs: [
            "Το Brand μπορεί να υποβάλει πρόταση συνεργασίας σε Δημιουργό, επιλέγοντας πακέτο και, προαιρετικά, extras. Το προτεινόμενο ποσό δεν μπορεί να είναι μικρότερο από την τιμή του πακέτου συν την τιμή των επιλεγμένων extras, όπως τις έχει ορίσει ο Δημιουργός. Ο Δημιουργός μπορεί να αποδεχθεί ή να απορρίψει την πρόταση ή να υποβάλει αντιπρόταση. Αν η αντιπρόταση γίνει αποδεκτή, το ποσό της αποτελεί το τελικό συμφωνηθέν ποσό. Η υποβολή πρότασης ή αντιπρότασης από μόνη της δεν δημιουργεί δέσμευση για συνεργασία.",
          ],
        },
        {
          title: "6. Καμπάνιες και αιτήσεις ενδιαφέροντος",
          paragraphs: [
            "Τα Brands μπορούν να δημοσιεύουν καμπάνιες με περιγραφή, προϋπολογισμό, προθεσμία και παραδοτέα, και να προσκαλούν Δημιουργούς. Οι εγκεκριμένοι Δημιουργοί μπορούν να υποβάλλουν αίτηση ενδιαφέροντος. Το Brand ευθύνεται για την ακρίβεια και τη νομιμότητα της καμπάνιας και επιλέγει ελεύθερα αν και με ποιον θα συνεργαστεί. Το Influo δεν εγγυάται συμμετοχές, επιλογή ή αποτελέσματα.",
          ],
        },
        {
          title: "7. Συμφωνία Συνεργασίας",
          paragraphs: [
            "Πριν από την εκτέλεση της συνεργασίας, τα Μέρη αποδέχονται ηλεκτρονικά, με επιλογή του σχετικού πεδίου μέσα στην Πλατφόρμα, τη Συμφωνία Συνεργασίας. Η Συμφωνία συνοψίζει τα Μέρη, τα παραδοτέα, τα extras, το τελικό ποσό και τους όρους. Θεωρείται ότι έχει συναφθεί όταν την αποδεχθούν και τα δύο Μέρη. Η Συμφωνία δεσμεύει αποκλειστικά τα Μέρη. Το Influo απλώς παρέχει το τεχνικό μέσο καταγραφής και δεν αναλαμβάνει υποχρέωση εκτέλεσης, παρακολούθησης ή επιβολής της. Τα Μέρη μπορούν να καταρτίσουν και επιπλέον γραπτή σύμβαση με δική τους ευθύνη.",
          ],
        },
        {
          title: "8. Τιμές, πληρωμές και φορολογικά",
          paragraphs: [
            "Η εγγραφή και η βασική χρήση της Πλατφόρμας είναι δωρεάν. Το Influo δεν λαμβάνει προμήθεια από τις συνεργασίες. Το Influo δεν επεξεργάζεται, δεν διακρατεί και δεν μεσολαβεί σε πληρωμές μεταξύ των Μερών. Ο τρόπος, ο χρόνος και η διασφάλιση της πληρωμής συμφωνούνται και εκτελούνται απευθείας μεταξύ τους. Κάθε Μέρος ευθύνεται αποκλειστικά για τις φορολογικές, ασφαλιστικές, λογιστικές και λοιπές νόμιμες υποχρεώσεις του, όπως η έκδοση παραστατικών και η απόδοση ΦΠΑ. Ευθύνεται επίσης για τη συμμόρφωση με τους κανόνες σήμανσης εμπορικής επικοινωνίας (π.χ. #ad / «διαφήμιση»). Το Influo διατηρεί το δικαίωμα να εισαγάγει στο μέλλον προαιρετικές επί πληρωμή υπηρεσίες, με προηγούμενη ενημέρωση των Χρηστών.",
          ],
        },
        {
          title: "9. Υποχρεώσεις και συμπεριφορά Χρηστών",
          paragraphs: ["Οι Χρήστες υποχρεούνται:"],
          bullets: [
            "να συμμορφώνονται με την ισχύουσα νομοθεσία",
            "να μην αναρτούν ψευδές, παραπλανητικό, προσβλητικό ή παράνομο περιεχόμενο",
            "να μη χρησιμοποιούν την Πλατφόρμα για απάτη, spam ή αθέμιτες πρακτικές",
            "να σέβονται τα δικαιώματα διανοητικής ιδιοκτησίας και τα προσωπικά δεδομένα τρίτων",
            "να μην επιχειρούν μη εξουσιοδοτημένη πρόσβαση στην Πλατφόρμα ή διατάραξη της λειτουργίας της",
          ],
        },
        {
          title: "10. Διανοητική ιδιοκτησία και άδεια χρήσης υλικού",
          paragraphs: [
            "Το περιεχόμενο που αναρτούν οι Χρήστες παραμένει δικό τους. Ο Δημιουργός παραχωρεί στο Influo μη αποκλειστική, δωρεάν, παγκόσμια άδεια να χρησιμοποιεί τη φωτογραφία προφίλ, τις φωτογραφίες portfolio, τα δημόσια posts και τα στατιστικά που εμφανίζονται στο προφίλ του, με σκοπό την εμφάνισή τους στην Πλατφόρμα και την προβολή του προφίλ του στα μέσα κοινωνικής δικτύωσης και στο προωθητικό υλικό του Influo. Ο Δημιουργός δηλώνει ότι διαθέτει όλα τα αναγκαία δικαιώματα επί του υλικού που αναρτά, συμπεριλαμβανομένης της συναίνεσης τυχόν εικονιζόμενων προσώπων. Η άδεια λήγει με την αφαίρεση του υλικού ή τη διαγραφή του λογαριασμού, με την επιφύλαξη αναρτήσεων που έχουν ήδη δημοσιευθεί. Η μεταβίβαση ή η άδεια χρήσης του περιεχομένου που παράγεται στο πλαίσιο συνεργασίας, συμπεριλαμβανομένων των δικαιωμάτων διαφημιστικής χρήσης και της αποκλειστικότητας, ρυθμίζεται αποκλειστικά από τη συμφωνία των Μερών. Τα σήματα, ο σχεδιασμός και το λογισμικό της Πλατφόρμας ανήκουν στο Influo.",
          ],
        },
        {
          title: "11. Αποποίηση ευθυνών",
          paragraphs: [
            "Η Πλατφόρμα παρέχεται «ως έχει» και «ως διατίθεται», χωρίς ρητή ή σιωπηρή εγγύηση. Το Influo δεν ευθύνεται:",
            "Τυχόν παρουσία σε χώρο, μετακινήσεις, έξοδα ή άλλες λεπτομέρειες εκτέλεσης συμφωνούνται απευθείας μεταξύ των μερών. Το Influo δεν φέρει καμία ευθύνη για τη συμπεριφορά, τις ενέργειες ή τις υποχρεώσεις των μερών, εντός ή εκτός πλατφόρμας.",
          ],
          bullets: [
            "για τη σύναψη, εκτέλεση, ποιότητα, έγκαιρη παράδοση ή αποτελέσματα οποιασδήποτε συνεργασίας",
            "για πληρωμές, οφειλές ή οικονομικές διαφορές μεταξύ των Μερών",
            "για την ακρίβεια των στοιχείων, στατιστικών και τιμών που δηλώνουν οι Χρήστες",
            "για διαφορές μεταξύ Χρηστών",
            "για διακοπές λειτουργίας, σφάλματα ή απώλεια δεδομένων, στον βαθμό που επιτρέπει ο νόμος",
          ],
        },
        {
          title: "12. Περιορισμός ευθύνης και αποζημίωση",
          paragraphs: [
            "Στον μέγιστο βαθμό που επιτρέπει ο νόμος, το Influo δεν ευθύνεται για έμμεσες ή αποθετικές ζημίες, διαφυγόντα κέρδη ή απώλεια φήμης. Ο Χρήστης υποχρεούται να αποζημιώσει το Influo για κάθε αξίωση τρίτου που προκύπτει από παράβαση των παρόντων Όρων ή του νόμου εκ μέρους του.",
          ],
        },
        {
          title: "13. Αναστολή και διακοπή",
          paragraphs: [
            "Το Influo μπορεί να αναστείλει ή να καταργήσει λογαριασμό ή περιεχόμενο που παραβιάζει τους Όρους ή τον νόμο. Ο Χρήστης μπορεί να ζητήσει τη διαγραφή του λογαριασμού του οποτεδήποτε.",
          ],
        },
        {
          title: "14. Τροποποιήσεις",
          paragraphs: [
            "Το Influo μπορεί να τροποποιεί τους παρόντες Όρους. Η ισχύουσα έκδοση αναρτάται με την ημερομηνία τελευταίας ενημέρωσης. Η συνέχιση της χρήσης μετά την ανάρτηση συνιστά αποδοχή των τροποποιήσεων.",
          ],
        },
        {
          title: "15. Εφαρμοστέο δίκαιο",
          paragraphs: [
            "Οι Όροι διέπονται από το ελληνικό δίκαιο, με την επιφύλαξη αναγκαστικών διατάξεων υπέρ των καταναλωτών. Αν κάποια διάταξη κριθεί άκυρη, οι υπόλοιπες εξακολουθούν να ισχύουν.",
          ],
        },
        {
          title: "16. Επικοινωνία",
          paragraphs: [
            "Για ερωτήματα σχετικά με τους Όρους, οι Χρήστες μπορούν να επικοινωνούν μέσω της σελίδας Επικοινωνία ή στο support@influo.gr.",
          ],
        },
      ],
      back: "← Επιστροφή στην Αρχική",
    },
    en: {
      title: "Terms of Service",
      lastUpdated: "Last updated:",
      intro: "These Terms of Service govern access to and use of the online platform Influo.gr (\"Platform\" or \"Influo\"). By accessing or using the Platform, the user declares that they have read, understood, and unconditionally accepted these Terms. Otherwise, the user must refrain from any use of it.",
      sections: [
        {
          title: "1. Definitions",
          paragraphs: [
            "\"User\" means any natural or legal person who visits or uses the Platform. \"Creator\" (influencer / creator) means the User who maintains a profile in order to provide content-creation and promotion services. \"Brand\" means the User who seeks such services. \"Parties\" means the Creator and the Brand of a specific collaboration. \"Collaboration Agreement\" means the summary of terms accepted by the Parties through the Platform.",
          ],
        },
        {
          title: "2. Nature of the service",
          paragraphs: [
            "The Platform provides solely a listing and connection service. It supplies the technical means for Creators and Brands to find one another, communicate, exchange proposals, and record the terms of their collaboration. Influo is not a contracting party, representative, mandatary, employer, or guarantor of any User. It does not perform, supervise, or guarantee any collaboration.",
          ],
        },
        {
          title: "3. Registration and account",
          paragraphs: [
            "Registration is permitted only to persons over 18 years of age with full legal capacity. A legal person registers through a duly authorized representative. The User must provide accurate, complete, and up-to-date information. The User must also keep their access credentials confidential and is responsible for every action taken through their account. Creator profiles are published following approval. Influo may refuse, suspend, or remove a profile at its discretion.",
          ],
        },
        {
          title: "4. Profiles, packages and additional charges (extras)",
          paragraphs: [
            "The Creator alone sets their service packages and prices. The Creator may also set optional additional charges: rights to use content in advertising, exclusivity, delivery of raw footage, and urgent delivery. The content, duration, and scope of each extra are agreed between the Parties. Any extras that are selected and included in the summary of the Collaboration Agreement form an integral part of it. The Creator is solely responsible for the accuracy of the information, statistics, and prices on their profile. Influo does not verify and does not guarantee this information.",
          ],
        },
        {
          title: "5. Proposals and counter-proposals",
          paragraphs: [
            "A Brand may submit a collaboration proposal to a Creator, selecting a package and, optionally, extras. The proposed amount may not be lower than the package price plus the price of the selected extras, as set by the Creator. The Creator may accept or reject the proposal, or submit a counter-proposal. If the counter-proposal is accepted, its amount is the final agreed amount. The submission of a proposal or counter-proposal does not, by itself, create a commitment to collaborate.",
          ],
        },
        {
          title: "6. Campaigns and expressions of interest",
          paragraphs: [
            "Brands may publish campaigns with a description, budget, deadline, and deliverables, and may invite Creators. Approved Creators may submit an expression of interest. The Brand is responsible for the accuracy and legality of the campaign and freely chooses whether and with whom to collaborate. Influo does not guarantee participation, selection, or results.",
          ],
        },
        {
          title: "7. Collaboration Agreement",
          paragraphs: [
            "Before the collaboration is carried out, the Parties electronically accept the Collaboration Agreement by selecting the relevant field within the Platform. The Agreement summarizes the Parties, the deliverables, the extras, the final amount, and the terms. It is deemed to have been concluded when both Parties have accepted it. The Agreement binds the Parties alone. Influo merely provides the technical means of recording it and assumes no obligation to perform, monitor, or enforce it. The Parties may also conclude an additional written contract on their own responsibility.",
          ],
        },
        {
          title: "8. Prices, payments and tax matters",
          paragraphs: [
            "Registration and basic use of the Platform are free of charge. Influo does not take a commission on collaborations. Influo does not process, hold, or act as an intermediary for payments between the Parties. The manner, timing, and securing of payment are agreed and carried out directly between the Parties. Each Party is solely responsible for its tax, social-security, accounting, and other legal obligations, such as issuing tax documents and remitting VAT. Each Party is also responsible for compliance with the rules on labeling commercial communications (e.g. #ad / \"advertisement\"). Influo reserves the right to introduce optional paid services in the future, with prior notice to Users.",
          ],
        },
        {
          title: "9. User obligations and conduct",
          paragraphs: ["Users are required to:"],
          bullets: [
            "comply with applicable law",
            "not post false, misleading, offensive, or unlawful content",
            "not use the Platform for fraud, spam, or unfair practices",
            "respect the intellectual property rights and personal data of third parties",
            "not attempt unauthorized access to the Platform or disruption of its operation",
          ],
        },
        {
          title: "10. Intellectual property and license to use material",
          paragraphs: [
            "Content posted by Users remains their own. The Creator grants Influo a non-exclusive, royalty-free, worldwide license to use the profile photograph, the portfolio photographs, the public posts, and the statistics displayed on their profile, for the purpose of displaying them on the Platform and promoting their profile on social media and in Influo's promotional material. The Creator declares that they hold all necessary rights in the material they post, including the consent of any persons depicted. The license ends upon removal of the material or deletion of the account, without prejudice to posts that have already been published. The transfer or license of content produced in the course of a collaboration, including advertising-use rights and exclusivity, is governed solely by the agreement of the Parties. The trademarks, design, and software of the Platform belong to Influo.",
          ],
        },
        {
          title: "11. Disclaimer of liability",
          paragraphs: [
            "The Platform is provided \"as is\" and \"as available\", without any express or implied warranty. Influo is not liable:",
            "Any on-site presence, travel, expenses or other execution details are agreed directly between the parties. Influo bears no liability for the conduct, actions or obligations of the parties, on or off the platform.",
          ],
          bullets: [
            "for the conclusion, performance, quality, timely delivery, or results of any collaboration",
            "for payments, debts, or financial disputes between the Parties",
            "for the accuracy of the information, statistics, and prices stated by Users",
            "for disputes between Users",
            "for interruptions of operation, errors, or loss of data, to the extent permitted by law",
          ],
        },
        {
          title: "12. Limitation of liability and indemnity",
          paragraphs: [
            "To the maximum extent permitted by law, Influo is not liable for indirect or consequential damages, lost profits, or loss of reputation. The User is required to indemnify Influo for any third-party claim arising from the User's breach of these Terms or of the law.",
          ],
        },
        {
          title: "13. Suspension and termination",
          paragraphs: [
            "Influo may suspend or remove an account or content that violates the Terms or the law. The User may request deletion of their account at any time.",
          ],
        },
        {
          title: "14. Amendments",
          paragraphs: [
            "Influo may amend these Terms. The current version is posted with the date of last update. Continued use after posting constitutes acceptance of the amendments.",
          ],
        },
        {
          title: "15. Governing law",
          paragraphs: [
            "The Terms are governed by Greek law, without prejudice to mandatory provisions in favor of consumers. If any provision is held invalid, the remaining provisions continue to apply.",
          ],
        },
        {
          title: "16. Contact",
          paragraphs: [
            "For questions regarding the Terms, Users may get in touch through the Contact page or at support@influo.gr.",
          ],
        },
      ],
      back: "← Back to Home",
    },
  };

  const txt = content[lang];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <SiteHeader lang={lang} onLangChange={setLang} />

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">{txt.title}</h1>
        <p className="text-slate-600 mb-8">{txt.lastUpdated} {LEGAL_LAST_UPDATED}</p>

        <div className="prose prose-slate max-w-none space-y-8">
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <p className="text-slate-700 leading-relaxed">{txt.intro}</p>
          </div>

          {txt.sections.map((section) => (
            <TermsSectionBlock key={section.title} section={section} />
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-slate-200">
          <Link href={lang === "en" ? "/en" : "/"} className="text-blue-600 hover:text-blue-700 font-medium">
            {txt.back}
          </Link>
        </div>
      </main>
    </div>
  );
}

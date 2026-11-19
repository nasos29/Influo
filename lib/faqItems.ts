export interface FAQItem {
  question: { el: string; en: string };
  answer: { el: string; en: string };
  category: { el: string; en: string };
}

export const faqs: FAQItem[] = [
  {
    category: { el: "Γενικά", en: "General" },
    question: {
      el: "Τι είναι η Influo;",
      en: "What is Influo?"
    },
    answer: {
      el: "Η Influo είναι η πιο σύγχρονη πλατφόρμα Influencer Marketing στην Ελλάδα. Συνδέει brands με εγκεκριμένους influencers για επαγγελματικές συνεργασίες.",
      en: "Influo is the most modern Influencer Marketing platform in Greece. It connects brands with approved influencers for professional collaborations."
    }
  },
  {
    category: { el: "Γενικά", en: "General" },
    question: {
      el: "Πόσο κοστίζει η χρήση της πλατφόρμας;",
      en: "How much does it cost to use the platform?"
    },
    answer: {
      el: "Η εγγραφή και η βασική χρήση είναι δωρεάν για influencers και brands. Δεν παίρνουμε προμήθεια από τις συνεργασίες σας.",
      en: "Registration and basic use is free for influencers and brands. We do not take a commission from your collaborations."
    }
  },
  {
    category: { el: "Για Influencers", en: "For Influencers" },
    question: {
      el: "Πώς γίνομαι influencer στην Influo;",
      en: "How do I become an influencer on Influo?"
    },
    answer: {
      el: "Εγγραφείτε δωρεάν, συμπληρώστε το προφίλ σας με stats, pricing και portfolio. Μετά την έγκριση, θα εμφανίζεστε στον κατάλογο και θα λαμβάνετε προσφορές από brands.",
      en: "Sign up for free, complete your profile with stats, pricing and portfolio. After approval, you'll appear in the directory and receive offers from brands."
    }
  },
  {
    category: { el: "Για Influencers", en: "For Influencers" },
    question: {
      el: "Πόσα στοιχεία μπορώ να βάλω στο portfolio;",
      en: "How many items can I add to my portfolio?"
    },
    answer: {
      el: "Έως 6 στοιχεία συνολικά (βίντεο και φωτογραφίες μαζί), ως συνδέσμους από τους λογαριασμούς που δηλώνετε. Το Influo μπορεί να κατεβάσει και να φιλοξενήσει αυτό το υλικό στους διακομιστές του, για εμφάνιση στο προφίλ σας. Αν το portfolio σας έχει ήδη περισσότερα από 6, τα κρατάτε· μπορείτε μόνο να αφαιρέσετε, όχι να προσθέσετε, μέχρι να μείνουν 6 ή λιγότερα.",
      en: "Up to 6 items in total (videos and photos combined), as links from the accounts you provide. Influo may download and host this media on its own servers, for display on your profile. If your portfolio already has more than 6 items, you keep them; you may only remove items, not add, until you are at 6 or fewer."
    }
  },
  {
    category: { el: "Για Influencers", en: "For Influencers" },
    question: {
      el: "Πώς λειτουργεί η πληρωμή;",
      en: "How does payment work?"
    },
    answer: {
      el: "Οι πληρωμές γίνονται απευθείας μεταξύ εσάς και του brand, σύμφωνα με τους όρους που συμφωνήσατε. Η πλατφόρμα διευκολύνει την επικοινωνία και την οργάνωση.",
      en: "Payments are made directly between you and the brand, according to the terms you agreed on. The platform facilitates communication and organization."
    }
  },
  {
    category: { el: "Για Influencers", en: "For Influencers" },
    question: {
      el: "Τι είναι τα badges και πώς τα κερδίζω;",
      en: "What are badges and how do I earn them?"
    },
    answer: {
      el: "Τα badges αναγνωρίζουν την απόδοση σας (New, Rising, Top Performer, Pro, Elite, VIP). Ενημερώνονται αυτόματα βάσει των followers, engagement rate, συνεργασιών και reviews. Επιπλέον, μπορεί να έχετε και badges συμπεριφοράς: 🌟 Top Rated (μέση βαθμολογία 4,8+ με 3+ αξιολογήσεις), ⚡ Απαντάει γρήγορα (μέσος χρόνος απάντησης κάτω από 4 ώρες σε 3+ συνομιλίες), 🟢 Ενεργός/ή (μπήκατε στο Influo τις τελευταίες 7 μέρες) και 🧩 Πλήρες προφίλ (φωτογραφία, ημερομηνία γέννησης, portfolio, τιμές και κατηγορίες). Το ✓ «Στατιστικά ελεγμένα από το Influo» στο avatar δεν είναι badge κάρτας.",
      en: "Badges recognize your performance (New, Rising, Top Performer, Pro, Elite, VIP). They update automatically based on followers, engagement rate, collaborations and reviews. You can also earn behaviour badges: 🌟 Top Rated (average rating 4.8+ with 3+ reviews), ⚡ Fast responder (average reply under 4 hours across 3+ conversations), 🟢 Active (logged in within the last 7 days) and 🧩 Complete profile (photo, date of birth, portfolio, prices and categories). The ✓ “Stats checked by Influo” on the avatar is not a card badge."
    }
  },
  {
    category: { el: "Για Brands", en: "For Brands" },
    question: {
      el: "Τι σημαίνουν τα badges των brands;",
      en: "What do brand badges mean?"
    },
    answer: {
      el: "Τα brands μπορεί να έχουν δύο badges, που φαίνονται στις καμπάνιες και στον κατάλογο brands: 🌱 Νέο Brand (εγγραφή στο Influo τις τελευταίες 30 μέρες) και 🤝 Συχνός συνεργάτης (3+ ολοκληρωμένες συνεργασίες στο Influo). Υπολογίζονται αυτόματα.",
      en: "Brands can have two badges, shown on campaigns and in the brands directory: 🌱 New brand (joined Influo in the last 30 days) and 🤝 Frequent partner (3+ completed collaborations on Influo). They are calculated automatically."
    }
  },
  {
    category: { el: "Για Brands", en: "For Brands" },
    question: {
      el: "Πώς βρίσκω influencers για το brand μου;",
      en: "How do I find influencers for my brand?"
    },
    answer: {
      el: "Χρησιμοποιήστε τα προηγμένα φίλτρα στον κατάλογο: κατηγορία, engagement rate, followers, budget, location. Κάντε κλικ σε έναν influencer και στείλτε προσφορά.",
      en: "Use the advanced filters in the directory: category, engagement rate, followers, budget, location. Click on an influencer and send a proposal."
    }
  },
  {
    category: { el: "Για Brands", en: "For Brands" },
    question: {
      el: "Πώς ξέρω αν ένας influencer είναι αξιόπιστος;",
      en: "How do I know if an influencer is trustworthy?"
    },
    answer: {
      el: "Ελέγξτε: το ✓ «Στατιστικά ελεγμένα από το Influo», reviews από άλλα brands (μόνο από brands που συνεργάστηκαν μέσω Influo — συμφωνία ή εγκεκριμένη παράδοση καμπάνιας), completion rate, response time, και engagement rate. Οι εγκεκριμένοι influencers εμφανίζονται στον κατάλογο με ελεγμένα στοιχεία.",
      en: "Check: the ✓ “Stats checked by Influo”, reviews from other brands (only brands that collaborated through Influo — agreement or approved campaign deliverable), completion rate, response time, and engagement rate. Approved influencers appear in the directory with checked stats."
    }
  },
  {
    category: { el: "Για Brands", en: "For Brands" },
    question: {
      el: "Πώς αφήνω αξιολόγηση σε influencer;",
      en: "How do I leave a review for an influencer?"
    },
    answer: {
      el: "Αξιολογεί μόνο brand που συνεργάστηκε μέσα από το Influo: είτε με αποδεκτή συμφωνία συνεργασίας σε προσφορά, είτε με εγκεκριμένη παράδοση σε καμπάνια. Συνδεθείτε ως brand, ανοίξτε το προφίλ του influencer → tab Αξιολογήσεις (ή τον σύνδεσμο από το reminder email) και υποβάλετε βαθμολογία (1-5) και υποχρεωτικό κείμενο. Οι creators αξιολογούν επιχειρήσεις από το dashboard → Προσφορές.",
      en: "Only a brand that collaborated through Influo can review: either via an accepted collaboration agreement on a proposal, or an approved campaign deliverable. Sign in as a brand, open the influencer’s profile → Reviews tab (or the reminder email link) and submit a rating (1–5) and required text. Creators rate brands from dashboard → Proposals."
    }
  },
  {
    category: { el: "Για Brands", en: "For Brands" },
    question: {
      el: "Μπορώ να κάνω αντιπροσφορά;",
      en: "Can I make a counter-proposal?"
    },
    answer: {
      el: "Ναι! Αν ένας influencer κάνει αντιπροσφορά, μπορείτε να την αποδεχτείτε, να την απαρνηθείτε ή να συζητήσετε μέσω μηνυμάτων.",
      en: "Yes! If an influencer makes a counter-proposal, you can accept it, reject it, or discuss via messages."
    }
  },
  {
    category: { el: "Για Brands", en: "For Brands" },
    question: {
      el: "Τι είναι η Έξυπνη Υπηρεσία Προτάσεων (AI Recommendations);",
      en: "What is the Smart Recommendation Service (AI Recommendations)?"
    },
    answer: {
      el: "Το AI μας αναλύει το brand σας (κλάδο, προτιμήσεις) και προτείνει αυτόματα influencers. Κάθε πρόταση έχει βαθμό ταιριάσματος και συγκεκριμένους λόγους. Μπορείτε να περιορίσετε τη λίστα με κατηγορία, πλατφόρμα, περιοχή, μέγιστη τιμή, δεξιότητες και μέγεθος κοινού. Η υπηρεσία είναι δωρεάν για όλες τις εγγεγραμμένες επιχειρήσεις.",
      en: "Our AI analyzes your brand (industry, preferences) and suggests influencers. Each recommendation has a match score and specific reasons. You can narrow the list by category, platform, area, max price, skills, and audience size. The service is free for every registered business."
    }
  },
  {
    category: { el: "Για Brands", en: "For Brands" },
    question: {
      el: "Πώς λειτουργεί το match score;",
      en: "How does the match score work?"
    },
    answer: {
      el: "Το match score (0-100%) υπολογίζεται από πολλαπλούς παράγοντες: Category Match (30%), Engagement Quality (25%), Rating Quality (20%), Value/Price Ratio (15%), και Verified Status (10%). Score >80% = Excellent Match (πράσινο), 65-80% = Very Good (μπλε), <65% = Good (κίτρινο).",
      en: "The match score (0-100%) is calculated from multiple factors: Category Match (30%), Engagement Quality (25%), Rating Quality (20%), Value/Price Ratio (15%), and Verified Status (10%). Score >80% = Excellent Match (green), 65-80% = Very Good (blue), <65% = Good (yellow)."
    }
  },
  {
    category: { el: "Για Brands", en: "For Brands" },
    question: {
      el: "Μπορώ να φιλτράρω τις προτάσεις;",
      en: "Can I filter the recommendations?"
    },
    answer: {
      el: "Ναι. Στο tab Προτάσεις μπορείτε να φιλτράρετε με κατηγορία, πλατφόρμα, περιοχή, μέγιστη τιμή πακέτου, δεξιότητες και μέγεθος κοινού. Το «Καθαρισμός φίλτρων» τα επαναφέρει. Υπάρχει και ανανέωση της λίστας.",
      en: "Yes. On the Recommendations tab you can filter by category, platform, area, maximum package price, skills, and audience size. Clear filters resets them. You can also refresh the list."
    }
  },
  {
    category: { el: "Για Brands", en: "For Brands" },
    question: {
      el: "Τι είναι οι «Καμπάνιες» στο brand dashboard;",
      en: "What are “Campaigns” in the brand dashboard?"
    },
    answer: {
      el: "Μπορείτε να δημοσιεύσετε καμπάνια με τίτλο, περιγραφή, budget (€), προαιρετική κατηγορία, προθεσμία και deliverables — δωρεάν, χωρίς προμήθεια. Όταν η κατάσταση είναι «Ανοιχτή», οι εγκεκριμένοι influencers τη βλέπουν στο dashboard τους και στη δημόσια σελίδα Καμπάνιες (/campaigns) και μπορούν να υποβάλουν αίτηση ενδιαφέροντος με προτεινόμενη τιμή, links προηγούμενης δουλειάς (μόνο από social δίκτυα) και προαιρετικό μήνυμα. Διαχειρίζεστε τις αιτήσεις από την ίδια καρτέλα.",
      en: "You can publish a campaign with title, description, budget (€), optional category, deadline and deliverables — free, no commission. When status is “Open”, approved influencers see it on their dashboard and on the public Campaigns page (/en/campaigns) and can submit an interest application with a proposed rate, links to past work (social networks only) and an optional message. You manage applications in the same tab."
    }
  },
  {
    category: { el: "Για Brands", en: "For Brands" },
    question: {
      el: "Πόσο μένει ανοιχτή μια καμπάνια;",
      en: "How long does a campaign stay open?"
    },
    answer: {
      el: "Κλείνει αυτόματα στην προθεσμία της· αν δεν έχει προθεσμία, 15 μέρες μετά το άνοιγμα. Η κάρτα δείχνει «Κλείνει αυτόματα σε N μέρες» ή «Λήγει σε…». 3 μέρες πριν, το brand παίρνει υπενθύμιση email· όταν κλείσει, ενημερώνονται brand και αιτούντες σε εκκρεμότητα. Οι ληγμένες δεν εμφανίζονται δημόσια. Δεν διαγράφονται — μόνο κλείνουν. Για ξανάνοιγμα: επεξεργασία → κατάσταση «Ανοιχτή» (νέο 15ήμερο)· αν η προθεσμία είχε περάσει, ανοίγει αυτόματα για 15 μέρες.",
      en: "It closes automatically on its deadline; with no deadline, 15 days after opening. The card shows “Closes automatically in N days” or “Ends in…”. Three days before close the brand gets an email reminder; when it closes, the brand and pending applicants are emailed. Expired campaigns leave the public list. They are not deleted — only closed. To reopen: edit → set status to Open (new 15-day window); if the deadline had passed, it opens automatically for 15 days."
    }
  },
  {
    category: { el: "Για Influencers", en: "For Influencers" },
    question: {
      el: "Πώς κάνω αίτηση σε καμπάνια brand;",
      en: "How do I apply to a brand campaign?"
    },
    answer: {
      el: "Με εγκεκριμένο προφίλ, από την καρτέλα «Καμπάνιες» ή τη δημόσια σελίδα /campaigns βλέπετε ανοιχτές καμπάνιες από επαληθευμένα brands. Όλοι μπορούν να δουν τις ανοιχτές καμπάνιες· αίτηση κάνουν μόνο οι εγκεκριμένοι influencers. Η αίτηση περιλαμβάνει προτεινόμενη τιμή, links προηγούμενης δουλειάς (μόνο από social δίκτυα, π.χ. Instagram/TikTok/YouTube) και προαιρετικό μήνυμα. Αν δεν έχετε εγκριθεί ακόμα, εμφανίζεται ενημερωτικό μήνυμα.",
      en: "With an approved profile, use the “Campaigns” tab or the public /en/campaigns page to see open campaigns from verified brands. Everyone can view open campaigns; only approved influencers can apply. An application includes a proposed rate, links to past work (social networks only, e.g. Instagram/TikTok/YouTube) and an optional message. If you are not approved yet, you’ll see an explanatory message."
    }
  },
  {
    category: { el: "Για Influencers", en: "For Influencers" },
    question: {
      el: "Πώς παραδίδω τη δουλειά μου;",
      en: "How do I deliver my work?"
    },
    answer: {
      el: "Μετά τη δημοσίευση, επικόλλησε το δημόσιο link του reel / TikTok / post στο πεδίο «Παραδοτέο» της συνεργασίας ή της καμπάνιας (Dashboard → Καμπάνιες / Προσφορές). Μην βασίζεσαι μόνο σε WeTransfer ή links στο chat — εκεί το brand εγκρίνει επίσημα την παράδοση. Όταν εγκριθεί, η συνεργασία μπορεί να εμφανιστεί στις «Πρόσφατες συνεργασίες» (αν συμφωνήσετε και οι δύο).",
      en: "After publishing, paste the public reel / TikTok / post link in the collaboration or campaign’s “Deliverable” field (Dashboard → Campaigns / Proposals). Don’t rely only on WeTransfer or chat links — that’s where the brand officially approves delivery. Once approved, the collaboration may appear in “Recent collaborations” (if both sides agree)."
    }
  },
  {
    category: { el: "Συνεργασίες", en: "Collaborations" },
    question: {
      el: "Τι συμβαίνει μετά την αποδοχή μιας προσφοράς;",
      en: "What happens after accepting a proposal?"
    },
    answer: {
      el: "Εμφανίζονται όροι που πρέπει να αποδεχτούν και οι δύο πλευρές. Μόνο τότε η συνεργασία καταγράφεται επίσημα (π.χ. Past Brands). Ο δημιουργός παραδίδει στο πεδίο «Παραδοτέο»· το brand εγκρίνει ή ζητά αλλαγές. Η συνεργασία ολοκληρώνεται όταν εγκριθεί το δημοσιευμένο link ή επιβεβαιωθεί η εκδήλωση.",
      en: "Terms appear that both sides must accept. Only then is the collaboration recorded officially (e.g. Past Brands). The creator submits work in the Deliverable field; the brand approves or requests changes. The collaboration is completed when the published link is approved or the event is confirmed."
    }
  },
  {
    category: { el: "Συνεργασίες", en: "Collaborations" },
    question: {
      el: "Μπορώ να ακυρώσω μια συνεργασία;",
      en: "Can I cancel a collaboration?"
    },
    answer: {
      el: "Όσο η παράδοση δεν έχει ολοκληρωθεί, επιχείρηση ή δημιουργός πατά «Ακύρωση συμφωνίας» (στις Προσφορές, στις Καμπάνιες ή στη συνομιλία). Ο λόγος είναι υποχρεωτικός (τουλάχιστον 10 χαρακτήρες) και κοινοποιείται στην άλλη πλευρά. Αν την ακυρώσει η ομάδα Influo, φαίνεται ως ακύρωση από τη Διαχείριση. Μια εκκρεμή πρόταση την αποσύρει μόνο το brand με «Απόσυρση πρότασης», χωρίς υποχρεωτικό λόγο.",
      en: "While delivery is not finished, the brand or creator uses Cancel agreement (in Proposals, Campaigns, or the conversation). A reason is required (at least 10 characters) and is shared with the other party. If the Influo team cancels it, it is shown as cancelled by Admin. A pending proposal can be withdrawn only by the brand with Withdraw proposal, without a required reason."
    }
  },
  {
    category: { el: "Συνεργασίες", en: "Collaborations" },
    question: {
      el: "Πώς κάνω αναφορά χρήστη;",
      en: "How do I report a user?"
    },
    answer: {
      el: "Συνδεθείτε και πατήστε την κόκκινη σημαία στο προφίλ ενός creator (δίπλα στην κοινή χρήση), ή «Αναφορά» στο μενού της συνομιλίας — εκεί μπορείτε να αναφέρετε creator ή επιχείρηση. Διαλέγετε λόγο και, αν βάλετε «Άλλο», γράφετε υποχρεωτικά σχόλιο. Η αναφορά πηγαίνει στην ομάδα Influo· ο άλλος χρήστης δεν ειδοποιείται και το προφίλ δεν κρύβεται αυτόματα.",
      en: "Sign in and tap the red flag on a creator’s profile (next to Share), or Report in the conversation menu — there you can report a creator or a business. Choose a reason; if you pick Other, a comment is required. The report goes to the Influo team; the other user is not notified and the profile is not hidden automatically."
    }
  }
];

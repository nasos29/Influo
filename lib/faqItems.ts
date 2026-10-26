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
      el: "Τα badges αναγνωρίζουν την απόδοση σας (New, Rising, Top Performer, Pro, Elite, VIP). Ενημερώνονται αυτόματα βάσει των followers, engagement rate, συνεργασιών και reviews. Το ✓ «Στατιστικά ελεγμένα από το Influo» στο avatar δεν είναι badge κάρτας.",
      en: "Badges recognize your performance (New, Rising, Top Performer, Pro, Elite, VIP). They update automatically based on followers, engagement rate, collaborations and reviews. The ✓ “Stats checked by Influo” on the avatar is not a card badge."
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
      el: "Αξιολογεί μόνο brand που συνεργάστηκε μέσα από το Influo: είτε με αποδεκτή συμφωνία συνεργασίας σε προσφορά, είτε με εγκεκριμένη παράδοση σε καμπάνια. Συνδεθείτε ως brand, ανοίξτε το προφίλ του influencer → tab Αξιολογήσεις και υποβάλετε βαθμολογία (1-5) και κείμενο.",
      en: "Only a brand that collaborated through Influo can review: either via an accepted collaboration agreement on a proposal, or an approved campaign deliverable. Sign in as a brand, open the influencer’s profile → Reviews tab, and submit a rating (1–5) and text."
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
      el: "Το AI μας αναλύει το brand σας (industry, προτιμήσεις) και προτείνει αυτόματα τους καλύτερους influencers. Κάθε πρόταση έχει match score (0-100%), προσωποποιημένες αιτιολογίες (γιατί ταιριάζει), και μπορείτε να χρησιμοποιήσετε advanced filters (budget, engagement, rating, κατηγορία). Η υπηρεσία είναι 100% ΔΩΡΕΑΝ για όλες τις εγγεγραμμένες επιχειρήσεις!",
      en: "Our AI analyzes your brand (industry, preferences) and automatically suggests the best influencers. Each recommendation has a match score (0-100%), personalized reasons (why it matches), and you can use advanced filters (budget, engagement, rating, category). The service is 100% FREE for all registered businesses!"
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
      el: "Ναι! Μπορείτε να φιλτράρετε με: Ελάχιστο Match Score, Μέγιστη Τιμή (€), Κατηγορία, Ελάχιστο Engagement Rate (%), και Ελάχιστο Rating. Υπάρχει επίσης κουμπί ανανέωσης για να λάβετε νέες προτάσεις και stats που δείχνουν πόσες προτάσεις είδατε, πόσα προφίλ επισκεφτήκατε, και πόσες προσφορές στείλατε.",
      en: "Yes! You can filter by: Minimum Match Score, Maximum Price (€), Category, Minimum Engagement Rate (%), and Minimum Rating. There's also a refresh button to get new recommendations and stats showing how many recommendations you viewed, profiles you visited, and proposals you sent."
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
      el: "Κλείνει αυτόματα στην προθεσμία της· αν δεν έχει προθεσμία, 30 μέρες μετά το άνοιγμα. Η κάρτα δείχνει «Κλείνει αυτόματα σε N μέρες» ή «Λήγει σε…». 3 μέρες πριν, το brand παίρνει υπενθύμιση email· όταν κλείσει, ενημερώνονται brand και αιτούντες σε εκκρεμότητα. Οι ληγμένες δεν εμφανίζονται δημόσια. Δεν διαγράφονται — μόνο κλείνουν. Για ξανάνοιγμα: επεξεργασία → κατάσταση «Ανοιχτή» (νέο 30ήμερο)· αν η προθεσμία είχε περάσει, ανοίγει αυτόματα για 30 μέρες.",
      en: "It closes automatically on its deadline; with no deadline, 30 days after opening. The card shows “Closes automatically in N days” or “Ends in…”. Three days before close the brand gets an email reminder; when it closes, the brand and pending applicants are emailed. Expired campaigns leave the public list. They are not deleted — only closed. To reopen: edit → set status to Open (new 30-day window); if the deadline had passed, it opens automatically for 30 days."
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
    category: { el: "Συνεργασίες", en: "Collaborations" },
    question: {
      el: "Τι συμβαίνει μετά την αποδοχή μιας προσφοράς;",
      en: "What happens after accepting a proposal?"
    },
    answer: {
      el: "Εμφανίζεται modal με τους όρους χρήσης. Και οι δύο πλευρές πρέπει να αποδεχτούν. Μετά, το brand προστίθεται στο Past Brands του influencer.",
      en: "A modal appears with terms of service. Both parties must accept. Then, the brand is added to the influencer's Past Brands."
    }
  },
  {
    category: { el: "Συνεργασίες", en: "Collaborations" },
    question: {
      el: "Μπορώ να ακυρώσω μια συνεργασία;",
      en: "Can I cancel a collaboration?"
    },
    answer: {
      el: "Ναι, αλλά συνιστούμε να συζητήσετε πρώτα με την άλλη πλευρά. Οι ακυρώσεις μπορεί να επηρεάσουν το completion rate.",
      en: "Yes, but we recommend discussing first with the other party. Cancellations may affect completion rate."
    }
  }
];

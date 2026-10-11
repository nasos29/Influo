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
      el: "Η Influo είναι η πιο σύγχρονη πλατφόρμα Influencer Marketing στην Ελλάδα. Συνδέει brands με verified influencers για επαγγελματικές συνεργασίες.",
      en: "Influo is the most modern Influencer Marketing platform in Greece. It connects brands with verified influencers for professional collaborations."
    }
  },
  {
    category: { el: "Γενικά", en: "General" },
    question: {
      el: "Πόσο κοστίζει η χρήση της πλατφόρμας;",
      en: "How much does it cost to use the platform?"
    },
    answer: {
      el: "Η εγγραφή και η βασική χρήση είναι δωρεάν για influencers και brands. Κερδίζετε μόνο όταν κλείνετε συνεργασίες!",
      en: "Registration and basic use is free for influencers and brands. You only earn when you close collaborations!"
    }
  },
  {
    category: { el: "Για Influencers", en: "For Influencers" },
    question: {
      el: "Πώς γίνομαι influencer στην Influo;",
      en: "How do I become an influencer on Influo?"
    },
    answer: {
      el: "Εγγραφείτε δωρεάν, συμπληρώστε το προφίλ σας με stats, pricing και portfolio. Μετά την verification, θα εμφανίζεστε στον κατάλογο και θα λαμβάνετε προσφορές από brands.",
      en: "Sign up for free, complete your profile with stats, pricing and portfolio. After verification, you'll appear in the directory and receive offers from brands."
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
      el: "Τα badges αναγνωρίζουν την απόδοση σας (New, Rising, Top Performer, Pro, Elite, VIP). Ενημερώνονται αυτόματα βάσει των followers, engagement rate, συνεργασιών και reviews.",
      en: "Badges recognize your performance (New, Rising, Top Performer, Pro, Elite, VIP). They update automatically based on followers, engagement rate, collaborations and reviews."
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
      el: "Ελέγξτε: Verified badge, reviews από άλλα brands, completion rate, response time, και engagement rate. Όλοι οι influencers είναι verified με πραγματικά stats.",
      en: "Check: Verified badge, reviews from other brands, completion rate, response time, and engagement rate. All influencers are verified with real stats."
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
      el: "Μπορείτε να δημοσιεύσετε καμπάνια με τίτλο, περιγραφή, budget (€), προαιρετική κατηγορία, προθεσμία και deliverables. Όταν η κατάσταση είναι «Ανοιχτή», οι verified influencers τη βλέπουν στο dashboard τους και στη δημόσια σελίδα καμπανιών και μπορούν να υποβάλουν αίτηση ενδιαφέροντος. Διαχειρίζεστε τις αιτήσεις από την ίδια καρτέλα.",
      en: "You can publish a campaign with title, description, budget (€), optional category, deadline and deliverables. When status is “Open”, verified influencers see it on their dashboard and on the public campaigns page and can submit an interest application. You manage applications in the same tab."
    }
  },
  {
    category: { el: "Για Influencers", en: "For Influencers" },
    question: {
      el: "Πώς κάνω αίτηση σε καμπάνια brand;",
      en: "How do I apply to a brand campaign?"
    },
    answer: {
      el: "Με εγκεκριμένο προφίλ, από την καρτέλα «Καμπάνιες» βλέπετε ανοιχτές καμπάνιες από επαληθευμένα brands και υποβάλλετε αίτηση. Αν δεν έχετε εγκριθεί ακόμα, εμφανίζεται ενημερωτικό μήνυμα. Η δημόσια λίστα (μενού «Καμπάνιες») δείχνει καμπάνιες επαληθευμένων brands· ως μη εγκεκριμένος χρήστης δεν εμφανίζονται λεπτομέρειες καμπανιών.",
      en: "With an approved profile, the “Campaigns” tab lists open campaigns from verified brands and you can apply. If you are not approved yet, you’ll see an explanatory message. The public “Campaigns” page lists campaigns from verified brands; until you are approved, campaign details are not shown to you when logged in."
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


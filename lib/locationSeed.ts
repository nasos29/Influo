/**
 * Canonical Greek (and main Cyprus) places for the locations table and the
 * static typeahead. The SQL migration and data/locations.json are generated
 * from this list.
 *
 * Each item is [name_el, name_en, popularity, extra aliases].
 */

export type LocationKind = "city" | "region" | "island";

export type LocationDraft = {
  nameEl: string;
  nameEn: string;
  regionEl: string;
  regionEn: string;
  type: LocationKind;
  country: "GR" | "CY";
  popularity: number;
  aliases: string[];
};

type Item = [string, string, number, string?];

function rows(
  regionEl: string,
  regionEn: string,
  type: LocationKind,
  items: Item[],
  country: "GR" | "CY" = "GR"
): LocationDraft[] {
  return items.map(([nameEl, nameEn, popularity, aliases]) => ({
    nameEl,
    nameEn,
    regionEl: type === "region" ? nameEl : regionEl,
    regionEn: type === "region" ? nameEn : regionEn,
    type,
    country,
    popularity,
    aliases: aliases ? aliases.split("|").map((part) => part.trim()).filter(Boolean) : [],
  }));
}

export const LOCATION_SEED: LocationDraft[] = [
  ...rows("", "", "region", [
    ["Αττική", "Attica", 90],
    ["Κεντρική Μακεδονία", "Central Macedonia", 80],
    ["Θεσσαλία", "Thessaly", 70],
    ["Δυτική Ελλάδα", "Western Greece", 70],
    ["Πελοπόννησος", "Peloponnese", 70],
    ["Κρήτη", "Crete", 75],
    ["Στερεά Ελλάδα", "Central Greece", 65],
    ["Ήπειρος", "Epirus", 65],
    ["Ανατολική Μακεδονία και Θράκη", "Eastern Macedonia and Thrace", 60],
    ["Δυτική Μακεδονία", "Western Macedonia", 55],
    ["Ιόνια Νησιά", "Ionian Islands", 60],
    ["Βόρειο Αιγαίο", "North Aegean", 55],
    ["Νότιο Αιγαίο", "South Aegean", 60],
  ]),

  ...rows("Αττική", "Attica", "city", [
    ["Αθήνα", "Athens", 100, "athina|athinae|attica"],
    ["Πειραιάς", "Piraeus", 88, "peiraias|pireas"],
    ["Περιστέρι", "Peristeri", 60],
    ["Καλλιθέα", "Kallithea", 55],
    ["Νίκαια", "Nikaia", 40],
    ["Κορυδαλλός", "Korydallos", 40],
    ["Αιγάλεω", "Aigaleo", 45, "egaleo"],
    ["Ίλιον", "Ilion", 40],
    ["Πετρούπολη", "Petroupoli", 40],
    ["Γαλάτσι", "Galatsi", 40],
    ["Νέα Σμύρνη", "Nea Smyrni", 50],
    ["Παλαιό Φάληρο", "Palaio Faliro", 50],
    ["Γλυφάδα", "Glyfada", 60],
    ["Βούλα", "Voula", 45],
    ["Βουλιαγμένη", "Vouliagmeni", 40],
    ["Βύρωνας", "Vyronas", 40],
    ["Ηλιούπολη", "Ilioupoli", 45],
    ["Ζωγράφου", "Zografou", 40],
    ["Καισαριανή", "Kaisariani", 35],
    ["Χαλάνδρι", "Chalandri", 55],
    ["Αγία Παρασκευή", "Agia Paraskevi", 50],
    ["Μαρούσι", "Marousi", 55, "amarousio"],
    ["Κηφισιά", "Kifisia", 55, "kifissia"],
    ["Νέα Ιωνία", "Nea Ionia", 40],
    ["Ηράκλειο Αττικής", "Irakleio Attica", 30],
    ["Αχαρνές", "Acharnes", 40, "menidi"],
    ["Ελευσίνα", "Elefsina", 40, "eleusis"],
    ["Μέγαρα", "Megara", 35],
    ["Λαύριο", "Lavrio", 35, "laurium"],
    ["Ραφήνα", "Rafina", 35],
    ["Μαραθώνας", "Marathon", 30, "marathonas"],
  ]),
  ...rows("Αττική", "Attica", "island", [
    ["Σαλαμίνα", "Salamina", 40, "salamis"],
    ["Αίγινα", "Aegina", 45, "aigina"],
    ["Πόρος", "Poros", 30],
    ["Ύδρα", "Hydra", 40, "ydra"],
    ["Σπέτσες", "Spetses", 35],
    ["Κύθηρα", "Kythira", 35, "cythera"],
  ]),

  ...rows("Κεντρική Μακεδονία", "Central Macedonia", "city", [
    ["Θεσσαλονίκη", "Thessaloniki", 98, "salonika|salonica|thessalonikh"],
    ["Καλαμαριά", "Kalamaria", 55],
    ["Ευκαρπία", "Efkarpia", 25],
    ["Συκιές", "Sykies", 30],
    ["Νεάπολη", "Neapoli", 30],
    ["Πυλαία", "Pylaia", 30],
    ["Εύοσμος", "Evosmos", 40],
    ["Σταυρούπολη", "Stavroupoli", 30],
    ["Πολίχνη", "Polichni", 25],
    ["Αμπελόκηποι Θεσσαλονίκης", "Ampelokipoi Thessaloniki", 25],
    ["Σέρρες", "Serres", 55],
    ["Κιλκίς", "Kilkis", 40],
    ["Έδεσσα", "Edessa", 45],
    ["Γιαννιτσά", "Giannitsa", 45, "yannitsa"],
    ["Βέροια", "Veria", 50, "veroia"],
    ["Νάουσα", "Naousa", 35],
    ["Αλεξάνδρεια", "Alexandria", 30],
    ["Κατερίνη", "Katerini", 55],
    ["Λιτόχωρο", "Litochoro", 25],
    ["Πολύγυρος", "Polygyros", 35],
    ["Νέα Μουδανιά", "Nea Moudania", 30],
  ]),

  ...rows("Δυτική Μακεδονία", "Western Macedonia", "city", [
    ["Κοζάνη", "Kozani", 55],
    ["Πτολεμαΐδα", "Ptolemaida", 40],
    ["Φλώρινα", "Florina", 45],
    ["Καστοριά", "Kastoria", 45],
    ["Γρεβενά", "Grevena", 35],
  ]),

  ...rows("Ανατολική Μακεδονία και Θράκη", "Eastern Macedonia and Thrace", "city", [
    ["Κομοτηνή", "Komotini", 50],
    ["Αλεξανδρούπολη", "Alexandroupoli", 60, "alexandroupolis"],
    ["Ορεστιάδα", "Orestiada", 35],
    ["Ξάνθη", "Xanthi", 50],
    ["Δράμα", "Drama", 45],
    ["Καβάλα", "Kavala", 55],
  ]),
  ...rows("Ανατολική Μακεδονία και Θράκη", "Eastern Macedonia and Thrace", "island", [
    ["Θάσος", "Thasos", 40, "thassos"],
    ["Σαμοθράκη", "Samothrace", 30, "samothraki"],
  ]),

  ...rows("Ήπειρος", "Epirus", "city", [
    ["Ιωάννινα", "Ioannina", 70, "yannina|ioannina"],
    ["Άρτα", "Arta", 45],
    ["Πρέβεζα", "Preveza", 45],
    ["Ηγουμενίτσα", "Igoumenitsa", 40],
  ]),

  ...rows("Θεσσαλία", "Thessaly", "city", [
    ["Λάρισα", "Larissa", 75, "larisa"],
    ["Βόλος", "Volos", 70],
    ["Τρίκαλα", "Trikala", 55],
    ["Καρδίτσα", "Karditsa", 45],
  ]),
  ...rows("Θεσσαλία", "Thessaly", "island", [
    ["Σκιάθος", "Skiathos", 50],
    ["Σκόπελος", "Skopelos", 40],
    ["Αλόννησος", "Alonnisos", 35],
  ]),

  ...rows("Στερεά Ελλάδα", "Central Greece", "city", [
    ["Λαμία", "Lamia", 55],
    ["Χαλκίδα", "Chalkida", 55, "halkida|chalcis"],
    ["Λιβαδειά", "Livadeia", 40, "levadia"],
    ["Θήβα", "Thebes", 40, "thiva|thiva"],
    ["Άμφισσα", "Amfissa", 30],
    ["Καρπενήσι", "Karpenisi", 30],
  ]),

  ...rows("Δυτική Ελλάδα", "Western Greece", "city", [
    ["Πάτρα", "Patras", 85, "patra"],
    ["Αγρίνιο", "Agrinio", 50],
    ["Μεσολόγγι", "Mesolongi", 40, "missolonghi"],
    ["Ναύπακτος", "Nafpaktos", 40, "nafpaktos"],
    ["Πύργος", "Pyrgos", 40],
    ["Αμαλιάδα", "Amaliada", 30],
    ["Αμφιλοχία", "Amfilochia", 25],
  ]),

  ...rows("Πελοπόννησος", "Peloponnese", "city", [
    ["Τρίπολη", "Tripoli", 50],
    ["Καλαμάτα", "Kalamata", 65],
    ["Κόρινθος", "Corinth", 50, "korinthos"],
    ["Λουτράκι", "Loutraki", 35],
    ["Άργος", "Argos", 35],
    ["Ναύπλιο", "Nafplio", 50, "nafplion"],
    ["Σπάρτη", "Sparta", 45, "sparti"],
    ["Γύθειο", "Gytheio", 30],
    ["Κυπαρισσία", "Kyparissia", 25],
  ]),

  ...rows("Ιόνια Νησιά", "Ionian Islands", "island", [
    ["Κέρκυρα", "Corfu", 70, "kerkyra"],
    ["Παξοί", "Paxos", 30, "paxi"],
    ["Λευκάδα", "Lefkada", 50, "lefkas"],
    ["Κεφαλονιά", "Kefalonia", 50, "cephalonia"],
    ["Ιθάκη", "Ithaca", 35, "ithaki"],
    ["Ζάκυνθος", "Zakynthos", 55, "zante"],
  ]),
  ...rows("Ιόνια Νησιά", "Ionian Islands", "city", [
    ["Αργοστόλι", "Argostoli", 35],
  ]),

  ...rows("Βόρειο Αιγαίο", "North Aegean", "island", [
    ["Λέσβος", "Lesvos", 50, "lesbos|mytilene"],
    ["Χίος", "Chios", 50, "hios"],
    ["Σάμος", "Samos", 45],
    ["Λήμνος", "Lemnos", 40, "limnos"],
    ["Ικαρία", "Ikaria", 40],
    ["Φούρνοι", "Fournoi", 20],
    ["Άγιος Ευστράτιος", "Agios Efstratios", 15],
  ]),
  ...rows("Βόρειο Αιγαίο", "North Aegean", "city", [
    ["Μυτιλήνη", "Mytilene", 50],
    ["Μύρινα", "Myrina", 25],
    ["Βαθύ Σάμου", "Vathy Samos", 25],
  ]),

  ...rows("Νότιο Αιγαίο", "South Aegean", "city", [
    ["Ερμούπολη", "Ermoupoli", 40, "ermoupolis|syros"],
    ["Ρόδος", "Rhodes", 70, "rodos"],
    ["Κως", "Kos", 55],
  ]),
  ...rows("Νότιο Αιγαίο", "South Aegean", "island", [
    ["Σύρος", "Syros", 40],
    ["Μύκονος", "Mykonos", 65],
    ["Σαντορίνη", "Santorini", 70, "thira|fira"],
    ["Πάρος", "Paros", 55],
    ["Αντίπαρος", "Antiparos", 30],
    ["Νάξος", "Naxos", 55],
    ["Άνδρος", "Andros", 40],
    ["Τήνος", "Tinos", 45],
    ["Μήλος", "Milos", 45],
    ["Ίος", "Ios", 40],
    ["Αμοργός", "Amorgos", 30],
    ["Κέα", "Kea", 25, "tzia"],
    ["Κύθνος", "Kythnos", 25],
    ["Σέριφος", "Serifos", 25],
    ["Σίφνος", "Sifnos", 35],
    ["Φολέγανδρος", "Folegandros", 25],
    ["Κάρπαθος", "Karpathos", 40],
    ["Κάλυμνος", "Kalymnos", 35],
    ["Λέρος", "Leros", 30],
    ["Πάτμος", "Patmos", 40],
    ["Αστυπάλαια", "Astypalaia", 25],
    ["Κάσος", "Kasos", 20],
    ["Σύμη", "Symi", 35],
    ["Νίσυρος", "Nisyros", 20],
    ["Τήλος", "Tilos", 20],
  ]),

  ...rows("Κρήτη", "Crete", "city", [
    ["Ηράκλειο", "Heraklion", 80, "iraklio|irakleio|herakleion"],
    ["Χανιά", "Chania", 70, "hania|xania"],
    ["Ρέθυμνο", "Rethymno", 55, "rethymnon"],
    ["Άγιος Νικόλαος", "Agios Nikolaos", 45],
    ["Ιεράπετρα", "Ierapetra", 40],
    ["Σητεία", "Sitia", 35],
  ]),

  ...rows("Κύπρος", "Cyprus", "city", [
    ["Λευκωσία", "Nicosia", 70, "lefkosia"],
    ["Λεμεσός", "Limassol", 65, "lemesos"],
    ["Λάρνακα", "Larnaca", 55],
    ["Πάφος", "Paphos", 55, "bafos"],
    ["Αμμόχωστος", "Famagusta", 40, "ammochostos"],
    ["Κερύνεια", "Kyrenia", 35, "keryneia"],
    ["Παραλίμνι", "Paralimni", 30],
    ["Αγία Νάπα", "Ayia Napa", 40, "agia napa"],
  ], "CY"),
];

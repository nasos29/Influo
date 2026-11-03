/** Small built-in emoji set (native rendering). Each entry: "emoji|keywords". */
export type EmojiCategory = { id: string; label: string; icon: string; items: string[] };

const raw: [string, string, string, string][] = [
  ["smileys", "Φατσούλες", "😀", "😀|χαμόγελο smile grin;😃|χαρά happy;😄|γέλιο laugh;😁|grin;😆|γέλιο laugh;😅|ιδρώτας sweat;🤣|γέλιο rofl;😂|γέλιο joy tears;🙂|smile;🙃|ανάποδα upside;😉|κλείσιμο ματιού wink;😊|ντροπή blush;😇|άγγελος angel;🥰|αγάπη love;😍|καρδιές love heart eyes;🤩|αστέρια star;😘|φιλί kiss;😗|φιλί kiss;😚|φιλί kiss;😋|νόστιμο yum;😛|γλώσσα tongue;😜|τρελό crazy;🤪|τρελό crazy;😝|γλώσσα;🤑|λεφτά money;🤗|αγκαλιά hug;🤭|oops;🤫|σιωπή shh;🤔|σκέψη think;🤐|zip;🤨|raised;😐|neutral;😑|expressionless;😶|σιωπή;😏|smirk;😒|unamused;🙄|eye roll;😬|grimace;😌|relieved;😔|λύπη pensive;😪|νύστα sleepy;😴|ύπνος sleep;😷|μάσκα mask;🤒|άρρωστος sick;🤧|φτέρνισμα;🥵|ζέστη hot;🥶|κρύο cold;🥴|woozy;😵|dizzy;🤯|mind blown;🤠|cowboy;🥳|πάρτι party;😎|cool γυαλιά;🤓|nerd;🧐|monocle;😕|confused;😟|worried;🙁|frown;😮|έκπληξη wow;😯|hushed;😲|astonished;😳|flushed;🥺|παράκληση pleading;😦|frown;😧|anguish;😨|φόβος fear;😰|anxious;😥|sad;😢|κλάμα cry;😭|κλάμα sob;😱|scream;😖|confounded;😣|persevere;😞|disappointed;😓|sweat;😩|weary;😫|tired;🥱|χασμουρητό yawn;😤|triumph;😡|θυμός angry;😠|θυμός angry;🤬|βρισιές;😈|devil;💀|skull;💩|poop;🤡|clown;👻|ghost;👽|alien;🤖|robot;😺|γάτα cat;😻|γάτα love"],
  ["gestures", "Χειρονομίες", "👍", "👍|like ok μπράβο thumbs up;👎|dislike thumbs down;👌|ok;🤌|pinched;✌️|νίκη peace;🤞|σταυρωμένα fingers crossed;🤟|love you;🤘|rock;🤙|call me;👈|left;👉|right;👆|up;👇|down;☝️|point;✋|χέρι hand;🤚|back hand;🖐️|hand;🖖|vulcan;👋|γεια wave hi;🤝|συμφωνία handshake deal;👏|χειροκρότημα clap bravo;🙌|raise hands;👐|open hands;🤲|palms;🙏|ευχαριστώ παρακαλώ thanks pray;✍️|γράψιμο write;💪|δύναμη strong;🦾|arm;👀|μάτια eyes;👁️|eye;👄|στόμα mouth;🧠|brain;🙋|raise;🙆|ok;🙅|no;🤷|δεν ξέρω shrug;🤦|facepalm;💁|tip;🙇|bow;🕺|χορός dance;💃|χορός dance"],
  ["hearts", "Καρδιές", "❤️", "❤️|καρδιά αγάπη love heart red;🧡|orange heart;💛|yellow heart;💚|green heart;💙|blue heart;💜|purple heart;🖤|black heart;🤍|white heart;🤎|brown heart;💔|broken heart;❣️|heart;💕|hearts;💞|hearts;💓|heartbeat;💗|growing;💖|sparkle heart;💘|cupid;💝|gift heart;💟|heart;💋|φιλί kiss;💯|100;💢|anger;💥|boom;💫|dizzy;💦|sweat;💨|dash;💬|μήνυμα speech;💭|thought;🔥|φωτιά fire hot;✨|sparkles λάμψη;⭐|αστέρι star;🌟|star;⚡|κεραυνός zap;🎉|γιορτή party tada;🎊|confetti;🎈|μπαλόνι balloon;🎁|δώρο gift;🏆|trophy νίκη;🥇|πρώτος gold;🎯|στόχος target"],
  ["animals", "Ζώα & φύση", "🐶", "🐶|σκύλος dog;🐱|γάτα cat;🐭|ποντίκι;🐰|κουνέλι rabbit;🦊|αλεπού fox;🐻|αρκούδα bear;🐼|panda;🐨|koala;🐯|τίγρη;🦁|λιοντάρι lion;🐮|αγελάδα cow;🐷|γουρούνι pig;🐸|βάτραχος frog;🐵|μαϊμού monkey;🙈|see no evil;🐔|κότα chicken;🐧|πιγκουίνος;🐦|πουλί bird;🦋|πεταλούδα butterfly;🐝|μέλισσα bee;🐢|χελώνα turtle;🐙|χταπόδι octopus;🐬|δελφίνι dolphin;🐳|φάλαινα whale;🌸|λουλούδι flower;🌹|τριαντάφυλλο rose;🌻|ηλιοτρόπιο;🌷|tulip;🌱|φυτό plant;🌴|φοίνικας palm;🍀|τύχη clover;🌞|ήλιος sun;🌙|φεγγάρι moon;🌈|ουράνιο τόξο rainbow;☀️|sun;⛅|cloud;🌧️|βροχή rain;❄️|χιόνι snow;🌊|θάλασσα wave sea"],
  ["food", "Φαγητό", "🍕", "🍏|μήλο apple;🍎|apple;🍊|πορτοκάλι;🍋|λεμόνι lemon;🍉|καρπούζι watermelon;🍇|σταφύλι grapes;🍓|φράουλα strawberry;🍒|κεράσι cherry;🍑|ροδάκινο peach;🥑|avocado;🍅|ντομάτα tomato;🥗|σαλάτα salad;🍞|ψωμί bread;🧀|τυρί cheese;🍔|burger;🍟|πατάτες fries;🍕|πίτσα pizza;🌮|taco;🥙|πίτα γύρος gyro;🍝|μακαρόνια pasta;🍣|sushi;🍰|τούρτα cake;🎂|γενέθλια birthday cake;🍫|σοκολάτα chocolate;🍩|donut;🍪|μπισκότο cookie;🍦|παγωτό ice cream;☕|καφές coffee;🍵|τσάι tea;🧃|χυμός juice;🍺|μπύρα beer;🍷|κρασί wine;🥂|cheers στην υγειά μας;🍾|σαμπάνια champagne;🍹|cocktail"],
  ["activity", "Δραστηριότητες", "⚽", "⚽|ποδόσφαιρο football;🏀|μπάσκετ basketball;🎾|tennis;🏐|volley;🏊|κολύμπι swim;🚴|ποδήλατο bike;🏋️|γυμναστήριο gym;🧘|yoga;🎮|παιχνίδι game;🎲|ζάρι dice;🎨|τέχνη art;🎬|ταινία movie film;🎤|μικρόφωνο mic;🎧|ακουστικά headphones;🎵|μουσική music;🎸|κιθάρα guitar;📸|φωτογραφία camera photo;📷|camera;🎥|video;📱|κινητό phone;💻|laptop;✈️|ταξίδι travel plane;🚗|αυτοκίνητο car;🏖️|παραλία beach;🏝️|νησί island;⛰️|βουνό mountain;🏠|σπίτι home"],
  ["objects", "Αντικείμενα", "💡", "💡|ιδέα idea;📌|pin;📎|συνδετήρας clip;📝|σημείωση note;📅|ημερολόγιο calendar;⏰|ξυπνητήρι alarm;⌛|χρόνος time;💰|λεφτά money bag;💵|dollar;💶|ευρώ euro;💳|κάρτα card;📦|δέμα package;🛍️|ψώνια shopping;👗|φόρεμα dress;👠|παπούτσι heel;💄|κραγιόν lipstick;💍|δαχτυλίδι ring;👜|τσάντα bag;🕶️|γυαλιά sunglasses;📣|megaphone;🔔|καμπάνα bell;🔗|σύνδεσμος link;🔒|lock;✅|ok done check;☑️|check;✔️|check;❌|όχι no x;❗|θαυμαστικό;❓|ερώτηση question;⚠️|προσοχή warning;🆗|ok;🆕|new νέο;🔝|top;➡️|δεξιά right;⬅️|left;🔁|repeat"],
  ["flags", "Σημαίες", "🇬🇷", "🇬🇷|ελλάδα greece;🇨🇾|κύπρος cyprus;🇪🇺|ευρώπη eu;🇬🇧|uk;🇺🇸|usa;🇩🇪|germany;🇫🇷|france;🇮🇹|italy;🇪🇸|spain;🏳️‍🌈|pride;🏁|finish"],
];

export const EMOJI_CATEGORIES: EmojiCategory[] = raw.map(([id, label, icon, list]) => ({ id, label, icon, items: list.split(";") }));

export const emojiOf = (item: string) => item.split("|")[0];

export function searchEmojis(query: string, limit = 64): string[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const out: string[] = [];
  for (const c of EMOJI_CATEGORIES)
    for (const it of c.items) {
      const [e, kw = ""] = it.split("|");
      if (kw.toLowerCase().includes(q) && !out.includes(e)) out.push(e);
      if (out.length >= limit) return out;
    }
  return out;
}

export const RECENT_KEY = "influo_recent_emojis";

export function pushRecent(list: string[], emoji: string, max = 24): string[] {
  return [emoji, ...list.filter((e) => e !== emoji)].slice(0, max);
}

/** Inserts text at the selection, returns new value and caret position. */
export function insertAtCursor(value: string, insert: string, start: number | null, end: number | null) {
  const s = start ?? value.length;
  const e = end ?? s;
  return { value: value.slice(0, s) + insert + value.slice(e), caret: s + insert.length };
}

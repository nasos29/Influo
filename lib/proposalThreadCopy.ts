const PREFIX = { el: "Νέα πρόταση:", en: "New proposal:" } as const;
const CAMPAIGN = { el: "Καμπάνια", en: "Campaign" } as const;

function inviteSentence(title: string, lang: "el" | "en"): string {
  return lang === "en"
    ? `We would like to invite you to the campaign “${title}”.`
    : `Θα θέλαμε να σας προσκαλέσουμε στην καμπάνια «${title}».`;
}

/**
 * Proposal thread text in the viewer's language.
 * Swaps the system prefix, the campaign service label on that line,
 * and the default invite sentence. A custom message is left as written.
 */
export function displayProposalThread(content: string, lang: "el" | "en"): string {
  let text = content;
  for (const prefix of [PREFIX.el, PREFIX.en]) {
    if (text.startsWith(prefix)) {
      text = PREFIX[lang] + text.slice(prefix.length);
      break;
    }
  }
  text = text.replace(
    /^(Νέα πρόταση:|New proposal:) (?:Καμπάνια|Campaign):/,
    `${PREFIX[lang]} ${CAMPAIGN[lang]}:`
  );
  text = text.replace(/Θα θέλαμε να σας προσκαλέσουμε στην καμπάνια «([^»]+)»\./g, (_, title: string) =>
    inviteSentence(title, lang)
  );
  text = text.replace(/We would like to invite you to the campaign “([^”]+)”\./g, (_, title: string) =>
    inviteSentence(title, lang)
  );
  text = text.replace(/Αποδοχή αίτησης για την καμπάνια «([^»]+)»\./g, (_, title: string) =>
    lang === "en" ? `Application accepted for the campaign “${title}”.` : `Αποδοχή αίτησης για την καμπάνια «${title}».`
  );
  text = text.replace(/Application accepted for the campaign “([^”]+)”\./g, (_, title: string) =>
    lang === "en" ? `Application accepted for the campaign “${title}”.` : `Αποδοχή αίτησης για την καμπάνια «${title}».`
  );
  text = text.replace(/Η αίτησή σας για «([^»]+)» έγινε αποδεκτή\. Μπορούμε να συνεχίσουμε εδώ\./g, (_, title: string) =>
    lang === "en"
      ? `Your application for “${title}” was accepted. We can continue here.`
      : `Η αίτησή σας για «${title}» έγινε αποδεκτή. Μπορούμε να συνεχίσουμε εδώ.`
  );
  text = text.replace(/Your application for “([^”]+)” was accepted\. We can continue here\./g, (_, title: string) =>
    lang === "en"
      ? `Your application for “${title}” was accepted. We can continue here.`
      : `Η αίτησή σας για «${title}» έγινε αποδεκτή. Μπορούμε να συνεχίσουμε εδώ.`
  );
  return text;
}

/** A stored proposal message, including the default campaign invite. */
export function displayProposalMessage(message: string | null | undefined, lang: "el" | "en"): string {
  return displayProposalThread(typeof message === "string" ? message : "", lang);
}

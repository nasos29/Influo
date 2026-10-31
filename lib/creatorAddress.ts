/** First given name, for headings like the invite popup. */
export function creatorFirstName(name: string): string {
  const first = name.trim().split(/\s+/)[0] || "";
  return first;
}

function greekScript(name: string): boolean {
  return /[Α-ωΆ-ώ]/.test(name) && !/[A-Za-z]/.test(name);
}

/** Light genitive for a Greek given name. Latin names stay unchanged. */
export function greekGenitive(name: string): string {
  if (!greekScript(name)) return name;
  if (/ος$/u.test(name)) return name.slice(0, -2) + "ου";
  if (/ης$/u.test(name)) return name.slice(0, -2) + "η";
  if (/ας$/u.test(name)) return name.slice(0, -2) + "α";
  if (/[αάηή]$/u.test(name)) return name + "ς";
  return name;
}

/** Accusative for "στον Γιώργο". Female -α/-η names keep the nominative. */
export function greekAccusative(name: string, gender: string | null | undefined): string {
  if (!greekScript(name) || gender !== "Male") return name;
  if (/ος$/u.test(name)) return name.slice(0, -2) + "ο";
  if (/ης$/u.test(name)) return name.slice(0, -2) + "η";
  if (/ας$/u.test(name)) return name.slice(0, -2) + "α";
  return name;
}

export function inviteHeading(
  name: string,
  gender: string | null | undefined,
  lang: "el" | "en"
): string {
  const first = creatorFirstName(name) || (lang === "el" ? "creator" : "creator");
  if (lang === "en") return `Invite ${first} to a campaign`;
  if (gender === "Male" && greekScript(first)) {
    return `Πρόσκληση του ${greekGenitive(first)} σε καμπάνια`;
  }
  if (gender === "Female" && greekScript(first)) {
    return `Πρόσκληση της ${greekGenitive(first)} σε καμπάνια`;
  }
  return `Πρόσκληση για ${first} σε καμπάνια`;
}

export function negotiateLead(
  name: string,
  gender: string | null | undefined,
  lang: "el" | "en"
): string {
  const first = creatorFirstName(name) || (lang === "el" ? "creator" : "creator");
  if (lang === "en") return `Send ${first} your own proposal.`;
  if (gender === "Male" && greekScript(first)) {
    return `Στείλε στον ${greekAccusative(first, gender)} τη δική σου πρόταση.`;
  }
  return `Στείλε στη ${first} τη δική σου πρόταση.`;
}

/** Spoken only from a package price the viewer is allowed to see. Never min_rate. */
export function averageRateNote(
  name: string,
  gender: string | null | undefined,
  amountLabel: string,
  unitLabel: string,
  lang: "el" | "en"
): string {
  const first = creatorFirstName(name) || (lang === "el" ? "creator" : "creator");
  if (lang === "en") {
    return `On average ${first} charges ${amountLabel} per ${unitLabel}`;
  }
  if (gender === "Male") return `Κατά μέσο όρο ο ${first} χρεώνει ${amountLabel} ανά ${unitLabel}`;
  if (gender === "Female") return `Κατά μέσο όρο η ${first} χρεώνει ${amountLabel} ανά ${unitLabel}`;
  return `Κατά μέσο όρο η χρέωση είναι ${amountLabel} ανά ${unitLabel}`;
}

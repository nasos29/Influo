export type AgreementRow = {
  status?: string | null;
  influencer_agreement_accepted?: boolean | null;
  brand_agreement_accepted?: boolean | null;
};

export type AgreementQueue<T> = {
  needsBrand: T[];
  awaitingInfluencer: T[];
};

/** Accepted deals that are not signed by both sides. */
export function openBrandAgreements<T extends AgreementRow>(rows: T[]): AgreementQueue<T> {
  const needsBrand: T[] = [];
  const awaitingInfluencer: T[] = [];
  for (const row of rows) {
    if (row.status !== "accepted" && row.status !== "completed") continue;
    if (row.brand_agreement_accepted) continue;
    if (row.influencer_agreement_accepted) needsBrand.push(row);
    else awaitingInfluencer.push(row);
  }
  return { needsBrand, awaitingInfluencer };
}

export function openAgreementCount<T extends AgreementRow>(rows: T[]): number {
  const queue = openBrandAgreements(rows);
  return queue.needsBrand.length + queue.awaitingInfluencer.length;
}

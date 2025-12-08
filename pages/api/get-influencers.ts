import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../lib/supabaseClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    let { platform, category, minFollowers, maxFollowers, sort, page = "1", limit = "12" } = req.query;

    let query = supabase
      .from("influencers")
      .select("*")
      .eq("published", true)
      .range((Number(page) - 1) * Number(limit), Number(page) * Number(limit) - 1);

    if (platform) query = query.eq("platform", platform);
    if (category) query = query.contains("categories", [category]);
    if (minFollowers) query = query.gte("followers", Number(minFollowers));
    if (maxFollowers) query = query.lte("followers", Number(maxFollowers));

    if (sort === "followers") query = query.order("followers", { ascending: false });
    else query = query.order("created_at", { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    res.status(200).json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}


import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../lib/supabaseClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { display_name, username, platform, bio, videos, contact_email } = req.body;

  const { data, error } = await supabase
    .from("influencers")
    .insert([
      {
        display_name,
        username,
        platform,
        bio,
        videos,
        contact_email,
        published: false, // admin approval
      },
    ]);

  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ data });
}



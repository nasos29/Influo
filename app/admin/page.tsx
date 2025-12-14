"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import Image from "next/image";

interface DbInfluencer {
  id: number;
  created_at: string;
  display_name: string;
  gender: string;
  contact_email: string;
  verified: boolean;
  accounts: { platform: string; username: string }[];
  avatar_url: string | null;
  avg_likes: string | null; 
  location: string | null;
}

interface Proposal {
  id: number;
  created_at: string;
  brand_name: string;
  budget: string;
  service_type: string;
  status: string;
  influencer_id: number;
  influencers: { display_name: string };
}

const t = {
  el: {
    title: "Admin Dashboard",
    sub: "Επισκόπηση & Διαχείριση",
    back: "← Πίσω στο Site",
    users: "Χρήστες",
    pending: "Εκκρεμούν",
    verified: "Εγκεκριμένοι",
    reach: "Απήχηση (Reach)",
    pipeline: "Αξία Pipeline",
    tab_inf: "Λίστα Influencers",
    tab_deals: "Προτάσεις & Deals",
    col_inf: "Influencer",
    col_loc: "Τοποθεσία",
    col_stats: "Στατιστικά",
    col_status: "Status",
    col_act: "Ενέργειες",
    btn_approve: "Έγκριση",
    btn_unverify: "Ανάκληση",
    btn_delete: "Διαγραφή",
    col_date: "Ημερομηνία",
    col_brand: "Brand",
    col_srv: "Υπηρεσία",
    col_bud: "Budget",
    no_data: "Δεν υπάρχουν δεδομένα."
  },
  en: {
    title: "Admin Dashboard",
    sub: "Overview & Management",
    back: "← Back to Site",
    users: "Users",
    pending: "Pending",
    verified: "Verified",
    reach: "Total Reach",
    pipeline: "Pipeline Value",
    tab_inf: "Influencers List",
    tab_deals: "Proposals & Deals",
    col_inf: "Influencer",
    col_loc: "Location",
    col_stats: "Stats",
    col_status: "Status",
    col_act: "Actions",
    btn_approve: "Approve",
    btn_unverify: "Unverify",
    btn_delete: "Delete",
    col_date: "Date",
    col_brand: "Brand",
    col_srv: "Service",
    col_bud: "Budget",
    no_data: "No data available."
  }
};

export default function AdminDashboard() {
  const [lang, setLang] = useState<"el" | "en">("el");
  const txt = t[lang];

  const [activeTab, setActiveTab] = useState("influencers");
  const [users, setUsers] = useState<DbInfluencer[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [stats, setStats] = useState({ 
    total: 0, 
    pending: 0, 
    verified: 0, 
    reach: "0",
    pipeline: "0€" 
  });

  const fetchData = async () => {
    setLoading(true);
    
    const { data: usersData } = await supabase.from("influencers").select("*").order("created_at", { ascending: false });
    const { data: propData } = await supabase.from("proposals").select("*, influencers(display_name)").order("created_at", { ascending: false });

    if (usersData) {
      setUsers(usersData);
      const total = usersData.length;
      const verified = usersData.filter((u) => u.verified).length;
      
      const totalReachNum = usersData.reduce((acc, curr) => {
         let val = 0;
         if (curr.avg_likes) {
             const clean = curr.avg_likes.toLowerCase().trim().replace(/,/g, '');
             if (clean.endsWith('k')) val = parseFloat(clean) * 1000;
             else if (clean.endsWith('m')) val = parseFloat(clean) * 1000000;
             else val = parseFloat(clean);
         }
         return acc + (isNaN(val) ? 0 : val);
      }, 0);
      let formattedReach = totalReachNum > 1000000 ? (totalReachNum / 1000000).toFixed(1) + 'M' : (totalReachNum / 1000).toFixed(1) + 'k';

      let pipelineSum = 0;
      if (propData) {
          setProposals(propData as any);
          propData.forEach(p => {
              const val = parseFloat(p.budget);
              if (!isNaN(val)) pipelineSum += val;
          });
      }

      setStats({ 
        total, 
        verified, 
        pending: total - verified, 
        reach: formattedReach,
        pipeline: pipelineSum.toLocaleString() + "€"
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleStatus = async (id: number, currentStatus: boolean) => {
    await supabase.from("influencers").update({ verified: !currentStatus }).eq("id", id);
    fetchData();
  };
  const deleteUser = async (id: number) => {
    if (confirm("Delete user?")) {
        await supabase.from("influencers").delete().eq("id", id);
        fetchData();
    }
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Loading Dashboard...</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans p-8 text-slate-900">
      
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8 flex justify-between items-center">
        <div>
           <h1 className="text-3xl font-bold text-slate-900">{txt.title}</h1>
           <p className="text-slate-500">{txt.sub}</p>
        </div>
        <div className="flex items-center gap-4">
             <button 
                onClick={() => setLang(lang === "el" ? "en" : "el")}
                className="text-xs font-bold border border-slate-300 px-3 py-1 rounded hover:bg-slate-100"
            >
                {lang === "el" ? "🇬🇧 EN" : "🇬🇷 EL"}
            </button>
            <a href="/" className="text-blue-600 hover:underline font-medium">{txt.back}</a>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <p className="text-slate-500 text-xs font-bold uppercase">{txt.users}</p>
            <p className="text-2xl font-extrabold text-slate-900">{stats.total}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <p className="text-slate-500 text-xs font-bold uppercase">{txt.pending}</p>
            <p className="text-2xl font-extrabold text-yellow-600">{stats.pending}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <p className="text-slate-500 text-xs font-bold uppercase">{txt.verified}</p>
            <p className="text-2xl font-extrabold text-green-600">{stats.verified}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <p className="text-slate-500 text-xs font-bold uppercase">{txt.reach}</p>
            <p className="text-2xl font-extrabold text-purple-600">{stats.reach}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 ring-2 ring-blue-100">
            <p className="text-slate-500 text-xs font-bold uppercase">{txt.pipeline}</p>
            <p className="text-2xl font-extrabold text-blue-600">{stats.pipeline}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto mb-6 border-b border-slate-200">
          <div className="flex gap-6">
              <button onClick={() => setActiveTab("influencers")} className={`pb-3 font-bold text-sm ${activeTab === "influencers" ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-500 hover:text-slate-800"}`}>
                  {txt.tab_inf}
              </button>
              <button onClick={() => setActiveTab("proposals")} className={`pb-3 font-bold text-sm ${activeTab === "proposals" ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-500 hover:text-slate-800"}`}>
                  {txt.tab_deals} ({proposals.length})
              </button>
          </div>
      </div>

      {/* --- TAB 1: INFLUENCERS --- */}
      {activeTab === "influencers" && (
          <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                            <th className="p-4 border-b">{txt.col_inf}</th>
                            <th className="p-4 border-b">{txt.col_loc}</th>
                            <th className="p-4 border-b">{txt.col_stats}</th>
                            <th className="p-4 border-b">{txt.col_status}</th>
                            <th className="p-4 border-b text-right">{txt.col_act}</th>
                        </tr>
                    </thead>
                    <tbody className="text-slate-700 text-sm">
                        {users.map((user) => (
                            <tr key={user.id} className="hover:bg-slate-50 border-b border-slate-100">
                                <td className="p-4 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-200 relative overflow-hidden">
                                        {user.avatar_url && <Image src={user.avatar_url} fill className="object-cover" alt="Avatar" />}
                                    </div>
                                    <span className="font-bold">{user.display_name}</span>
                                </td>
                                <td className="p-4">{user.location || "-"}</td>
                                <td className="p-4 font-mono text-xs">{user.avg_likes ? `${user.avg_likes} likes` : "-"}</td>
                                <td className="p-4">
                                    {user.verified ? <span className="text-green-600 font-bold text-xs">{txt.verified}</span> : <span className="text-yellow-600 font-bold text-xs">{txt.pending}</span>}
                                </td>
                                <td className="p-4 text-right">
                                    <button onClick={() => toggleStatus(user.id, user.verified)} className="text-blue-600 font-bold text-xs mr-3 hover:underline">
                                        {user.verified ? txt.btn_unverify : txt.btn_approve}
                                    </button>
                                    <button onClick={() => deleteUser(user.id)} className="text-red-600 font-bold text-xs hover:underline">{txt.btn_delete}</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          </div>
      )}

      {/* --- TAB 2: PROPOSALS --- */}
      {activeTab === "proposals" && (
          <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
             <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                            <th className="p-4 border-b">{txt.col_date}</th>
                            <th className="p-4 border-b">{txt.col_brand}</th>
                            <th className="p-4 border-b">{txt.col_srv}</th>
                            <th className="p-4 border-b">{txt.col_inf}</th>
                            <th className="p-4 border-b">{txt.col_bud}</th>
                            <th className="p-4 border-b">{txt.col_status}</th>
                        </tr>
                    </thead>
                    <tbody className="text-slate-700 text-sm">
                        {proposals.length === 0 ? (
                             <tr><td colSpan={6} className="p-8 text-center text-slate-500">{txt.no_data}</td></tr>
                        ) : (
                            proposals.map((p) => (
                                <tr key={p.id} className="hover:bg-slate-50 border-b border-slate-100">
                                    <td className="p-4 text-slate-500 text-xs">
                                        {new Date(p.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="p-4 font-bold text-slate-900">{p.brand_name}</td>
                                    <td className="p-4">
                                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs border border-blue-100">
                                            {p.service_type}
                                        </span>
                                    </td>
                                    <td className="p-4">{p.influencers?.display_name || "Unknown"}</td>
                                    <td className="p-4 font-bold text-green-600">{p.budget}€</td>
                                    <td className="p-4">
                                        <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs uppercase font-bold tracking-wide">
                                            {p.status}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
          </div>
      )}
    </div>
  );
}
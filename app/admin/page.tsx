"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import Image from "next/image";

// Τύπος δεδομένων βάσης (Ενημερωμένος με τα νέα πεδία)
interface DbInfluencer {
  id: number;
  created_at: string;
  display_name: string;
  gender: string;
  contact_email: string;
  verified: boolean;
  accounts: { platform: string; username: string }[];
  avatar_url: string | null;
  avg_likes: string | null; // Το πεδίο που θα χρησιμοποιήσουμε για το Reach
  location: string | null;
}

export default function AdminDashboard() {
  const [users, setUsers] = useState<DbInfluencer[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 1. ΕΔΩ ΠΡΟΣΘΕΣΑΜΕ ΤΟ 'reach' ΣΤΟ STATE
  const [stats, setStats] = useState({ 
    total: 0, 
    pending: 0, 
    verified: 0, 
    reach: "0" 
  });

  // Φόρτωση δεδομένων
  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("influencers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error:", error);
    } else {
      const allUsers = data || [];
      setUsers(allUsers);

      // Υπολογισμός Βασικών Στατιστικών
      const total = allUsers.length;
      const verified = allUsers.filter((u) => u.verified).length;
      
      // 2. ΥΠΟΛΟΓΙΣΜΟΣ TOTAL REACH (Αλγόριθμος)
      const totalReachNum = allUsers.reduce((acc, curr) => {
         let val = 0;
         if (curr.avg_likes) {
             // Καθαρίζουμε το string και ελέγχουμε για 'k' ή 'm'
             const clean = curr.avg_likes.toLowerCase().trim().replace(/,/g, '');
             
             if (clean.endsWith('k')) {
                 val = parseFloat(clean) * 1000;
             } else if (clean.endsWith('m')) {
                 val = parseFloat(clean) * 1000000;
             } else {
                 val = parseFloat(clean);
             }
         }
         // Αν δεν είναι αριθμός (NaN), προσθέτουμε 0
         return acc + (isNaN(val) ? 0 : val);
      }, 0);

      // Format ξανά σε String (π.χ. 15000 -> 15k)
      let formattedReach = totalReachNum.toString();
      if (totalReachNum >= 1000000) {
          formattedReach = (totalReachNum / 1000000).toFixed(1) + 'M';
      } else if (totalReachNum >= 1000) {
          formattedReach = (totalReachNum / 1000).toFixed(1) + 'k';
      }

      setStats({ 
        total, 
        verified, 
        pending: total - verified, 
        reach: formattedReach 
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Λειτουργία Έγκρισης / Απόρριψης
  const toggleStatus = async (id: number, currentStatus: boolean) => {
    const { error } = await supabase
      .from("influencers")
      .update({ verified: !currentStatus })
      .eq("id", id);

    if (!error) fetchData();
  };

  // Λειτουργία Διαγραφής
  const deleteUser = async (id: number) => {
    if (!window.confirm("Είσαι σίγουρος ότι θες να διαγράψεις αυτόν τον χρήστη;")) return;
    const { error } = await supabase.from("influencers").delete().eq("id", id);
    if (!error) fetchData();
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Φόρτωση Dashboard...</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans p-8">
      
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-10 flex justify-between items-center">
        <div>
           <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
           <p className="text-slate-500">Επισκόπηση πλατφόρμας Influo</p>
        </div>
        <a href="/" className="text-blue-600 hover:underline font-medium">← Επιστροφή στο Site</a>
      </div>

      {/* 3. Η ΝΕΑ ΚΑΡΤΑ REACH ΣΤΟ GRID (grid-cols-4) */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-10">
        
        {/* Card 1: Total Users */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="p-4 bg-blue-100 text-blue-600 rounded-lg text-2xl">👥</div>
            <div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Users</p>
                <p className="text-2xl font-extrabold text-slate-900">{stats.total}</p>
            </div>
        </div>

        {/* Card 2: Pending */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="p-4 bg-yellow-100 text-yellow-600 rounded-lg text-2xl">⏳</div>
            <div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Pending</p>
                <p className="text-2xl font-extrabold text-slate-900">{stats.pending}</p>
            </div>
        </div>

        {/* Card 3: Verified */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="p-4 bg-green-100 text-green-600 rounded-lg text-2xl">✅</div>
            <div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Verified</p>
                <p className="text-2xl font-extrabold text-slate-900">{stats.verified}</p>
            </div>
        </div>

        {/* Card 4: TOTAL REACH (NEW) */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="p-4 bg-purple-100 text-purple-600 rounded-lg text-2xl">🚀</div>
            <div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Total Reach</p>
                <p className="text-2xl font-extrabold text-slate-900">{stats.reach}</p>
            </div>
        </div>

      </div>

      {/* Main Table */}
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-900">Λίστα Influencers</h2>
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">Last update: Just now</span>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                        <th className="p-4 border-b border-slate-200">Influencer</th>
                        <th className="p-4 border-b border-slate-200">Location</th>
                        <th className="p-4 border-b border-slate-200">Avg Likes</th>
                        <th className="p-4 border-b border-slate-200">Email</th>
                        <th className="p-4 border-b border-slate-200">Status</th>
                        <th className="p-4 border-b border-slate-200 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="text-slate-700 text-sm">
                    {users.length === 0 ? (
                        <tr>
                            <td colSpan={6} className="p-10 text-center text-slate-500">
                                Δεν υπάρχουν εγγραφές ακόμα.
                            </td>
                        </tr>
                    ) : (
                        users.map((user) => (
                            <tr key={user.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border border-slate-300 relative">
                                            {user.avatar_url ? (
                                                <Image src={user.avatar_url} fill className="object-cover" alt="Avatar" />
                                            ) : (
                                                <span className="text-lg">👤</span>
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-900">{user.display_name}</p>
                                            <p className="text-xs text-slate-400">{user.gender}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4 font-medium text-slate-600">
                                    {user.location || "-"}
                                </td>
                                <td className="p-4 font-bold text-slate-700">
                                    {user.avg_likes || "0"}
                                </td>
                                <td className="p-4 text-slate-500 font-mono text-xs">
                                    {user.contact_email}
                                </td>
                                <td className="p-4">
                                    {user.verified ? (
                                        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1">
                                            ● Verified
                                        </span>
                                    ) : (
                                        <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1">
                                            ● Pending
                                        </span>
                                    )}
                                </td>
                                <td className="p-4 text-right space-x-2">
                                    <button 
                                        onClick={() => toggleStatus(user.id, user.verified)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                                            user.verified 
                                            ? "bg-white border border-slate-300 text-slate-600 hover:bg-slate-50" 
                                            : "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md"
                                        }`}
                                    >
                                        {user.verified ? "Ανάκληση" : "Έγκριση"}
                                    </button>
                                    <button 
                                        onClick={() => deleteUser(user.id)}
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                                    >
                                        Διαγραφή
                                    </button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}
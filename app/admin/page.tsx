"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import Image from "next/image";

// Τύπος δεδομένων βάσης
interface DbInfluencer {
  id: number;
  created_at: string;
  display_name: string;
  gender: string;
  contact_email: string;
  verified: boolean;
  accounts: { platform: string; username: string }[];
  avatar_url: string | null;
}

export default function AdminDashboard() {
  const [users, setUsers] = useState<DbInfluencer[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, pending: 0, verified: 0 });

  // Φόρτωση δεδομένων
  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("influencers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) console.error("Error:", error);
    else {
      setUsers(data || []);
      // Υπολογισμός Στατιστικών
      const total = data?.length || 0;
      const verified = data?.filter((u) => u.verified).length || 0;
      setStats({ total, verified, pending: total - verified });
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

    if (!error) fetchData(); // Ξαναφορτώνουμε τα δεδομένα
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
           <p className="text-slate-500">Διαχείριση εγγραφών & Influencers</p>
        </div>
        <a href="/" className="text-blue-600 hover:underline">← Επιστροφή στο Site</a>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="p-4 bg-blue-100 text-blue-600 rounded-lg text-2xl">👥</div>
            <div>
                <p className="text-slate-500 text-sm font-medium uppercase">Συνολο Εγγραφων</p>
                <p className="text-3xl font-bold text-slate-900">{stats.total}</p>
            </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="p-4 bg-yellow-100 text-yellow-600 rounded-lg text-2xl">⏳</div>
            <div>
                <p className="text-slate-500 text-sm font-medium uppercase">Εκκρεμουν</p>
                <p className="text-3xl font-bold text-slate-900">{stats.pending}</p>
            </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="p-4 bg-green-100 text-green-600 rounded-lg text-2xl">✅</div>
            <div>
                <p className="text-slate-500 text-sm font-medium uppercase">Εγκριθηκαν</p>
                <p className="text-3xl font-bold text-slate-900">{stats.verified}</p>
            </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-900">Αιτήματα Εγγραφής</h2>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider">
                        <th className="p-4 border-b border-slate-200">ID</th>
                        <th className="p-4 border-b border-slate-200">Influencer</th>
                        <th className="p-4 border-b border-slate-200">Socials</th>
                        <th className="p-4 border-b border-slate-200">Email</th>
                        <th className="p-4 border-b border-slate-200">Status</th>
                        <th className="p-4 border-b border-slate-200 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="text-slate-700 text-sm">
                    {users.length === 0 ? (
                        <tr>
                            <td colSpan={6} className="p-8 text-center text-slate-500">
                                Δεν υπάρχουν εγγραφές ακόμα.
                            </td>
                        </tr>
                    ) : (
                        users.map((user) => (
                            <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4 border-b border-slate-100">#{user.id}</td>
                                <td className="p-4 border-b border-slate-100">
                                    <div className="flex items-center gap-3">
                                        {/* Avatar Placeholder */}
                                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
                                            {user.avatar_url ? (
                                                <Image src={user.avatar_url} width={40} height={40} alt="Avatar" />
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
                                <td className="p-4 border-b border-slate-100">
                                    <div className="flex gap-2 flex-wrap max-w-[200px]">
                                        {Array.isArray(user.accounts) && user.accounts.map((acc, i) => (
                                            <span key={i} className="bg-slate-100 px-2 py-1 rounded text-xs border border-slate-200">
                                                {acc.platform}
                                            </span>
                                        ))}
                                    </div>
                                </td>
                                <td className="p-4 border-b border-slate-100 text-slate-500">
                                    {user.contact_email}
                                </td>
                                <td className="p-4 border-b border-slate-100">
                                    {user.verified ? (
                                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold">
                                            VERIFIED
                                        </span>
                                    ) : (
                                        <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs font-bold animate-pulse">
                                            PENDING
                                        </span>
                                    )}
                                </td>
                                <td className="p-4 border-b border-slate-100 text-right space-x-2">
                                    <button 
                                        onClick={() => toggleStatus(user.id, user.verified)}
                                        className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                                            user.verified 
                                            ? "bg-slate-200 text-slate-600 hover:bg-slate-300" 
                                            : "bg-blue-600 text-white hover:bg-blue-700"
                                        }`}
                                    >
                                        {user.verified ? "Απόρριψη" : "Έγκριση"}
                                    </button>
                                    <button 
                                        onClick={() => deleteUser(user.id)}
                                        className="bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1 rounded text-xs font-bold transition-colors"
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
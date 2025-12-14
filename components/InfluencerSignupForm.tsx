"use client";

import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Account = { platform: string; username: string };

export default function InfluencerSignupForm() {
  const [displayName, setDisplayName] = useState("");
  const [gender, setGender] = useState("Female"); // Default state for gender
  const [accounts, setAccounts] = useState<Account[]>([{ platform: "Instagram", username: "" }]);
  const [bio, setBio] = useState("");
  const [videos, setVideos] = useState<string[]>([""]);
  const [email, setEmail] = useState("");
  const [lang, setLang] = useState<"el" | "en">("el");
  const [message, setMessage] = useState("");

  const handleAccountChange = (i: number, field: keyof Account, value: string) => {
    const copy = [...accounts];
    copy[i][field] = value;
    setAccounts(copy);
  };

  const removeAccount = (i: number) => {
    const copy = [...accounts];
    copy.splice(i, 1);
    setAccounts(copy);
  };

  const addAccount = () => setAccounts([...accounts, { platform: "Instagram", username: "" }]);

  const handleVideoChange = (i: number, val: string) => {
    const copy = [...videos];
    copy[i] = val;
    setVideos(copy);
  };

  const removeVideo = (i: number) => {
    const copy = [...videos];
    copy.splice(i, 1);
    setVideos(copy);
  };

  const addVideo = () => setVideos([...videos, ""]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Included 'gender' in the insert payload
    const { error } = await supabase.from("influencers").insert([
      { 
        display_name: displayName, 
        gender: gender, 
        accounts, 
        bio, 
        videos, 
        contact_email: email 
      }
    ]);

    if (error) {
      setMessage(error.message);
    } else {
      setMessage(
        lang === "el" 
          ? "Το προφίλ δημιουργήθηκε! Περιμένει έγκριση." 
          : "Profile created! Await admin approval."
      );
    }
  };

  return (
    <div className="max-w-2xl mx-auto my-10 p-6 bg-white rounded-lg shadow-lg border border-gray-200
                    max-h-[800px] overflow-y-auto">
      {/* Language Selector */}
      <div className="mb-6 flex justify-end">
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value as "el" | "en")}
          className="border rounded px-2 py-1 text-gray-700"
        >
          <option value="el">Ελληνικά</option>
          <option value="en">English</option>
        </select>
      </div>

      <h2 className="text-2xl font-bold mb-6 text-gray-900">
        {lang === "el" ? "Γίνε Influencer" : "Join as Influencer"}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Full Name */}
        <div>
          <label className="block mb-1 font-medium text-gray-800">
            {lang === "el" ? "Ονοματεπώνυμο" : "Full Name"}
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Gender Selector */}
        <div>
          <label className="block mb-1 font-medium text-gray-800">
            {lang === "el" ? "Φύλο" : "Gender"}
          </label>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="Female">{lang === "el" ? "Γυναίκα" : "Female"}</option>
            <option value="Male">{lang === "el" ? "Άνδρας" : "Male"}</option>
          </select>
        </div>

        {/* Social Accounts */}
        <div>
          <label className="block mb-1 font-medium text-gray-800">
            {lang === "el" ? "Λογαριασμοί Social" : "Social Accounts"}
          </label>
          {accounts.map((acc, i) => (
            <div key={i} className="flex gap-2 mb-2 items-center">
              <select
                value={acc.platform}
                onChange={(e) => handleAccountChange(i, "platform", e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-gray-900"
              >
                <option>Instagram</option>
                <option>TikTok</option>
                <option>YouTube</option>
              </select>
              <input
                type="text"
                placeholder="@username"
                value={acc.username}
                onChange={(e) => handleAccountChange(i, "username", e.target.value)}
                className="flex-1 border border-gray-300 rounded px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button type="button" onClick={() => removeAccount(i)} className="text-red-600 font-bold px-2">Χ</button>
            </div>
          ))}
          <button
            type="button"
            onClick={addAccount}
            className="flex items-center gap-1 text-blue-600 hover:underline font-bold"
          >
            <span className="text-xl">+</span> {lang === "el" ? "Πρόσθεσε άλλο λογαριασμό" : "Add another account"}
          </button>
        </div>

        {/* Bio */}
        <div>
          <label className="block mb-1 font-medium text-gray-800">{lang === "el" ? "Bio" : "Bio"}</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Videos */}
        <div>
          <label className="block mb-1 font-medium text-gray-800">{lang === "el" ? "Βίντεο URL" : "Video URL"}</label>
          {videos.map((vid, i) => (
            <div key={i} className="flex gap-2 mb-2 items-center">
              <input
                type="text"
                placeholder="https://..."
                value={vid}
                onChange={(e) => handleVideoChange(i, e.target.value)}
                className="flex-1 border border-gray-300 rounded px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button type="button" onClick={() => removeVideo(i)} className="text-red-600 font-bold px-2">Χ</button>
            </div>
          ))}
          <button
            type="button"
            onClick={addVideo}
            className="flex items-center gap-1 text-blue-600 hover:underline font-bold"
          >
            <span className="text-xl">+</span> {lang === "el" ? "Πρόσθεσε άλλο βίντεο" : "Add another video"}
          </button>
        </div>

        {/* Email */}
        <div>
          <label className="block mb-1 font-medium text-gray-800">{lang === "el" ? "Email" : "Email"}</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded transition-colors"
        >
          {lang === "el" ? "Εγγραφή" : "Sign Up"}
        </button>
      </form>

      {message && <p className="mt-4 text-green-600 font-medium">{message}</p>}
    </div>
  );
}








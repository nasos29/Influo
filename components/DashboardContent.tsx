// components/DashboardContent.tsx
"use client";

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { sessionFetch } from '@/lib/sessionFetch';
import Image from 'next/image';
import { getVideoThumbnail, isVideoUrl, isDefinitelyVideo, isDefinitelyImage, detectProvider, isEmbeddableVideoUrl } from '@/lib/videoThumbnail';
import {
    FACEBOOK_VIDEO_LINK_ERROR,
    prepareVideosForSave,
} from '@/lib/videoLinks';
import { normalizeVideoUrlKey } from '@/lib/checkVideoPlayable';
import {
    parseHiddenVideos,
    syncHiddenVideosWithVideos,
} from '@/lib/hiddenVideos';
import {
    newVideoRowId,
    toVideoRows,
    useVideoPlayableChecks,
    videoRowsToUrls,
    type VideoRow,
} from '@/lib/useVideoPlayableChecks';
import VideoThumbnail from './VideoThumbnail';
import Messaging from './Messaging';
import Analytics from './Analytics';
import PushNotificationPrompt from './PushNotificationPrompt';
import { prepareImageForStorage } from '@/lib/prepareImageForStorage';
import { normalizeGender } from '@/lib/gender';
import InfluencerCampaignsPanel from './InfluencerCampaignsPanel';
import InfluencerToolsPanel from './InfluencerToolsPanel';
import { INFLUENCER_BROWSER_COLUMNS, loadOwnInfluencer } from '@/lib/ownProfile';
import { useOwnPresenceHeartbeat } from '@/lib/useOwnPresenceHeartbeat';
import { logoutEverywhere } from '@/lib/authSession';
import { formatStoredCategories, parseStoredCategories } from '@/lib/categories';
import CategoryCheckboxList from '@/components/CategoryCheckboxList';
import {
    badgeAfterOpen,
    influencerCampaignSeenKey,
    influencerProposalAlertIds,
    influencerProposalSeenKey,
    readIdList,
    writeIdList,
} from '@/lib/dashboardBadges';
import { displayNameForLang } from '@/lib/greeklish';
import { normalizeYouTubeUsernameForSave } from '@/lib/youtubeHandle';
import {
    BIRTH_DATE_MIN,
    athensTodayYmd,
    birthDateErrorText,
    validateBirthDate,
} from '@/lib/validateBirthDate';
import { getStoredLanguage, setStoredLanguage } from '@/lib/language';

// --- LANGUAGES LIST ---
const LANGUAGES = [
  { code: "el", el: "Ελληνικά", en: "Greek" },
  { code: "en", el: "Αγγλικά", en: "English" },
  { code: "de", el: "Γερμανικά", en: "German" },
  { code: "fr", el: "Γαλλικά", en: "French" },
  { code: "es", el: "Ισπανικά", en: "Spanish" },
  { code: "it", el: "Ιταλικά", en: "Italian" },
  { code: "pt", el: "Πορτογαλικά", en: "Portuguese" },
  { code: "ru", el: "Ρωσικά", en: "Russian" },
  { code: "zh", el: "Κινεζικά", en: "Chinese" },
  { code: "ja", el: "Ιαπωνικά", en: "Japanese" },
  { code: "sq", el: "Αλβανικά", en: "Albanian" },
  { code: "bg", el: "Βουλγαρικά", en: "Bulgarian" },
  { code: "tr", el: "Τουρκικά", en: "Turkish" }
];

interface Account {
  platform: string;
  username: string;
  followers: string;
  engagement_rate?: string;
  avg_likes?: string;
}

interface InfluencerData {
    id: string;
    display_name: string;
    location: string;
    contact_email: string;
    verified: boolean;
    approved?: boolean;
    min_rate: string;
    bio: string;
    engagement_rate: string | null;
    avg_likes: string | null;
    accounts: Account[] | null;
    category: string | null;
    languages: string | null;
    avatar_url: string | null;
    gender: string | null;
    birth_date?: string | null;
    audience_male_percent: number | null;
    audience_female_percent: number | null;
    audience_top_age: string | null;
    videos: string[] | null;
    hidden_videos?: Array<{ url: string; reason?: string; hidden_at?: string }> | null;
    insights_urls: string[] | null;
    availability_status?: string | null;
    rate_card?: { story?: string; post?: string; reel?: string; youtube?: string; facebook?: string } | null;
}

const HIDDEN_VIDEO_NOTICE = {
  title: {
    el: "Κρυφό βίντεο portfolio",
    en: "Hidden portfolio video",
  },
  body: {
    el: "Το βίντεο δεν μπορεί πλέον να παίξει στο Influo (π.χ. μουσική με δικαιώματα ή διαγραφή). Αντικατάστησέ το με άλλο.",
    en: "This video can no longer play on Influo (e.g. licensed music or deletion). Replace it with another.",
  },
  replace: { el: "Αντικατάσταση", en: "Replace" },
  remove: { el: "Αφαίρεση", en: "Remove" },
} as const;

// --- COMPREHENSIVE EDIT MODAL WITH SOCIAL ACCOUNTS ---
const EditModal = ({ user, onClose, onSave, lang = 'el' }: { user: InfluencerData, onClose: () => void, onSave: (updatedUser: InfluencerData) => void, lang?: 'el' | 'en' }) => {
    const L = (el: string, en: string) => (lang === 'en' ? en : el);
    const [name, setName] = useState(user.display_name);
    const [bio, setBio] = useState(user.bio || "");
    const [minRate, setMinRate] = useState(user.min_rate || "");
    const [location, setLocation] = useState(user.location || "");
    const [birthDate, setBirthDate] = useState(user.birth_date || "");
    // Support multiple categories - parse comma-separated string or use single category
    const initialCategories = parseStoredCategories(user.category).length
        ? parseStoredCategories(user.category)
        : ["Lifestyle"];
    const [categories, setCategories] = useState<string[]>(initialCategories);
    // Parse languages from comma-separated string to array of language codes
    const parseLanguages = (langString: string | null): string[] => {
        if (!langString) return [];
        // Try to match language codes or names
        const langArray = langString.split(',').map(l => l.trim().toLowerCase());
        const codes: string[] = [];
        langArray.forEach(lang => {
            // Check if it's already a code
            const foundLang = LANGUAGES.find(l => l.code === lang || l.el.toLowerCase() === lang || l.en.toLowerCase() === lang);
            if (foundLang) {
                codes.push(foundLang.code);
            } else {
                // Try to match partial names
                const partialMatch = LANGUAGES.find(l => 
                    l.el.toLowerCase().includes(lang) || 
                    l.en.toLowerCase().includes(lang) ||
                    lang.includes(l.el.toLowerCase()) ||
                    lang.includes(l.en.toLowerCase())
                );
                if (partialMatch) {
                    codes.push(partialMatch.code);
                }
            }
        });
        return codes;
    };
    const initialLanguages = parseLanguages(user.languages);
    const [selectedLanguages, setSelectedLanguages] = useState<string[]>(initialLanguages);
    const initialGender = normalizeGender(user.gender);
    const [gender, setGender] = useState(initialGender);
    const [accounts, setAccounts] = useState<Account[]>(
        user.accounts && Array.isArray(user.accounts) && user.accounts.length > 0
            ? user.accounts.map((acc: any) => ({ ...acc, engagement_rate: acc.engagement_rate || "", avg_likes: acc.avg_likes || "" }))
            : [{ platform: "Instagram", username: "", followers: "", engagement_rate: "", avg_likes: "" }]
    );
    const [malePercent, setMalePercent] = useState(user.audience_male_percent?.toString() || "");
    const [femalePercent, setFemalePercent] = useState(user.audience_female_percent?.toString() || "");
    const [topAge, setTopAge] = useState(user.audience_top_age || "");
    const [videoRows, setVideoRows] = useState<VideoRow[]>(() =>
        toVideoRows(Array.isArray(user.videos) && user.videos.length ? user.videos : [""])
    );
    const [loading, setLoading] = useState(false);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(user.avatar_url || null);
    
    // Rate card prices (persisted as JSON on influencers.rate_card)
  const [priceStory, setPriceStory] = useState(
    (user as InfluencerData & { rate_card?: { story?: string } }).rate_card?.story || ''
  );
  const [pricePost, setPricePost] = useState(
    (user as InfluencerData & { rate_card?: { post?: string } }).rate_card?.post || ''
  );
  const [priceReel, setPriceReel] = useState(
    (user as InfluencerData & { rate_card?: { reel?: string } }).rate_card?.reel || ''
  );
  const [priceYouTube, setPriceYouTube] = useState(
    (user as InfluencerData & { rate_card?: { youtube?: string } }).rate_card?.youtube || ''
  );

    // Helper function to replace commas with dots in numeric inputs
    const replaceCommaWithDot = (value: string): string => {
        return value.replace(/,/g, '.');
    };

    const handleAccountChange = (i: number, field: keyof Account, value: string) => {
        // ER / avg likes are scrape-only — never editable from the profile form.
        if (field === 'engagement_rate' || field === 'avg_likes') return;
        const copy = [...accounts];
        if (field === 'followers') {
            copy[i][field] = replaceCommaWithDot(value);
        } else {
            copy[i][field] = value;
        }
        setAccounts(copy);
    };

    const addAccount = () => {
        setAccounts([...accounts, { platform: "Instagram", username: "", followers: "" }]);
    };

    /** Keep scraped ER / avg_likes (and related flags) from DB; ignore any client-sent values. */
    const mergeAccountsPreservingMetrics = (
        nextAccounts: Account[],
        previousAccounts: Account[] | null | undefined
    ): Account[] => {
        const prev = Array.isArray(previousAccounts) ? previousAccounts : [];
        return nextAccounts.map((acc) => {
            const platform = String(acc.platform || '').trim().toLowerCase();
            const username = String(acc.username || '').replace(/^@+/, '').trim().toLowerCase();
            const old = prev.find(
                (o) =>
                    String(o.platform || '').trim().toLowerCase() === platform &&
                    String(o.username || '').replace(/^@+/, '').trim().toLowerCase() === username
            );
            // Start from editable fields only; never trust client ER / avg_likes.
            const merged: Record<string, unknown> = {
                platform: acc.platform,
                username: acc.username,
                followers: acc.followers,
            };
            if (!old) return merged as unknown as Account;
            const oldRec = old as unknown as Record<string, unknown>;
            for (const key of [
                'engagement_rate',
                'avg_likes',
                'avg_views',
                'posts_count',
                'er_suspicious',
                'er_flag_reason',
                'engagement_hidden',
                'suspected_fake_penalty',
                'engagement_rate_raw',
                'fake_follower_percent',
                'suspected_fake_percent',
                'fake_followers_percent',
                'quality_penalty_percent',
                'er_penalty_percent',
                'penalty_percent',
                'channel_id',
                'channel_handle',
                'top_posts',
            ]) {
                const val = oldRec[key];
                if (val !== undefined && val !== null && val !== '') merged[key] = val;
            }
            return merged as unknown as Account;
        });
    };

    const removeAccount = (i: number) => {
        if (accounts.length > 1) {
            const copy = [...accounts];
            copy.splice(i, 1);
            setAccounts(copy);
        }
    };

    const [videoLinkError, setVideoLinkError] = useState<string | null>(null);
    const existingVideos = Array.isArray(user.videos) ? user.videos : [];
    const {
        checkingById,
        errorById,
        isChecking: videosChecking,
        hasBlockingError: videosNotPlayable,
        checkingLabel,
        notPlayableMessage,
        runCheck,
        scheduleCheck,
        clearId,
        assertAllNewPlayable,
    } = useVideoPlayableChecks('el', existingVideos);

    useEffect(() => {
        if (!videosNotPlayable && !videosChecking && videoLinkError === notPlayableMessage) {
            setVideoLinkError(null);
        }
    }, [videosNotPlayable, videosChecking, videoLinkError, notPlayableMessage]);

    const handleVideoChange = (id: string, value: string) => {
        setVideoLinkError(null);
        setVideoRows((rows) => rows.map((r) => (r.id === id ? { ...r, url: value } : r)));
        if (!value.trim()) {
            clearId(id);
            return;
        }
        if (isEmbeddableVideoUrl(value) || isDefinitelyImage(value)) {
            scheduleCheck(id, value);
        } else {
            clearId(id);
        }
    };
    const handleVideoBlur = (id: string) => {
        void (async () => {
            const raw = videoRows.find((r) => r.id === id)?.url || '';
            if (!raw.trim()) {
                clearId(id);
                return;
            }
            const cleaned = await runCheck(id, raw);
            if (!cleaned.ok) {
                if (cleaned.reason === 'facebook') {
                    setVideoLinkError(FACEBOOK_VIDEO_LINK_ERROR.el);
                    setVideoRows((rows) => rows.map((r) => (r.id === id ? { ...r, url: '' } : r)));
                    clearId(id);
                }
                return;
            }
            setVideoLinkError(null);
            if (cleaned.url !== raw) {
                setVideoRows((rows) =>
                    rows.map((r) => (r.id === id ? { ...r, url: cleaned.url } : r))
                );
            }
        })();
    };
    const addVideo = () =>
        setVideoRows((rows) => [...rows, { id: newVideoRowId(), url: '' }]);
    const removeVideo = (id: string) => {
        setVideoRows((rows) => {
            if (rows.length <= 1) return rows;
            return rows.filter((r) => r.id !== id);
        });
        clearId(id);
        setVideoLinkError(null);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!confirm(
            "Οι αλλαγές στο προφίλ σου θα απαιτήσουν επαν-επαλήθευση. Το προφίλ σου θα μεταβεί σε κατάσταση «Εκκρεμότητα» μέχρι να εγκριθεί ξανά. Θέλεις να συνεχίσεις;"
        )) {
            return;
        }

        setLoading(true);

        try {
            // First, fetch current values from database to compare
            const current = await loadOwnInfluencer(supabase);
            if (!current.ok) {
                throw new Error(current.reason === "missing" ? "Failed to fetch current profile" : current.message);
            }
            const currentData = current.profile as unknown as InfluencerData;

            // Only validate when the user actually changes birth_date (legacy invalid values stay).
            const prevBirth = String(currentData.birth_date || '').slice(0, 10);
            const nextBirth = (birthDate || '').trim();
            if (nextBirth && nextBirth !== prevBirth) {
                const birthCheck = validateBirthDate(nextBirth);
                if (!birthCheck.ok) {
                    alert(birthDateErrorText(birthCheck, 'el'));
                    setLoading(false);
                    return;
                }
            }

            let avatarUrl = user.avatar_url || null;

            // Upload avatar if new file selected
            if (avatarFile) {
                const preparedAvatar = await prepareImageForStorage(avatarFile, {
                  maxSide: 640,
                  webpQuality: 0.72,
                  jpegQuality: 0.78,
                });
                const fileName = `avatar-${Date.now()}-${preparedAvatar.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
                const { error: uploadError } = await supabase.storage.from("avatars").upload(fileName, preparedAvatar, { cacheControl: '31536000', upsert: false });
                
                if (uploadError) {
                    throw uploadError;
                }
                
                const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);
                avatarUrl = data.publicUrl;
            }

            // Store categories as comma-separated string for backward compatibility
            const categoryString = formatStoredCategories(categories) || "Lifestyle";
            const languagesString = selectedLanguages.map(code => {
                const lang = LANGUAGES.find(l => l.code === code);
                return lang ? lang.el : code;
            }).join(", ");
            
            const validGender = normalizeGender(gender);
            
            const filteredAccounts = accounts
                .filter(
                    (acc) => acc.username && acc.platform && acc.platform !== 'Facebook'
                )
                .map((acc) => {
                    if (String(acc.platform || '').toLowerCase() !== 'youtube') return acc;
                    return {
                        ...acc,
                        username: normalizeYouTubeUsernameForSave(acc.username),
                    };
                });
            const accountsForSave = mergeAccountsPreservingMetrics(
                filteredAccounts,
                (currentData.accounts || []) as Account[]
            );

            const preparedVideos = prepareVideosForSave(videoRowsToUrls(videoRows));
            if (!preparedVideos.ok) {
                setVideoLinkError(FACEBOOK_VIDEO_LINK_ERROR.el);
                alert(FACEBOOK_VIDEO_LINK_ERROR.el);
                setLoading(false);
                return;
            }
            if (videosChecking || videosNotPlayable) {
                setVideoLinkError(notPlayableMessage);
                alert(notPlayableMessage);
                setLoading(false);
                return;
            }
            const playableOk = await assertAllNewPlayable(videoRows);
            if (!playableOk) {
                setVideoLinkError(notPlayableMessage);
                alert(notPlayableMessage);
                setLoading(false);
                return;
            }

            const nextHidden = syncHiddenVideosWithVideos(
                preparedVideos.videos,
                user.hidden_videos
            );

            const newValues: any = {
                display_name: name, 
                bio: bio, 
                min_rate: minRate,
                location: location,
                birth_date: birthDate || null,
                category: categoryString,
                languages: languagesString,
                gender: validGender,
                accounts: accountsForSave,
                videos: preparedVideos.videos,
                hidden_videos: nextHidden,
                audience_male_percent: malePercent ? parseInt(malePercent) : null,
                audience_female_percent: femalePercent ? parseInt(femalePercent) : null,
                audience_top_age: topAge || null,
                rate_card: {
                    ...(priceStory.trim() ? { story: priceStory.trim() } : {}),
                    ...(pricePost.trim() ? { post: pricePost.trim() } : {}),
                    ...(priceReel.trim() ? { reel: priceReel.trim() } : {}),
                    ...(priceYouTube.trim() ? { youtube: priceYouTube.trim() } : {}),
                },
            };

            // Only update avatar_url if we have a new URL
            if (avatarUrl) {
                newValues.avatar_url = avatarUrl;
            }

            // Compare old and new values to find changes
            // Ensure old gender is valid for comparison
            const oldGender = normalizeGender(currentData.gender);
            
            const oldValues: any = {
                display_name: currentData.display_name || '',
                bio: currentData.bio || '',
                min_rate: currentData.min_rate || '',
                location: currentData.location || '',
                birth_date: currentData.birth_date || null,
                category: currentData.category || '',
                languages: currentData.languages || '',
                gender: oldGender,
                accounts: currentData.accounts || [],
                videos: currentData.videos || [],
                audience_male_percent: currentData.audience_male_percent || null,
                audience_female_percent: currentData.audience_female_percent || null,
                audience_top_age: currentData.audience_top_age || null,
                avatar_url: currentData.avatar_url || null,
            };

            // Find changed fields
            const changedFields: string[] = [];
            const fieldsToCheck = [
                'display_name', 'bio', 'min_rate', 'location', 'birth_date',
                'category', 'languages', 'gender', 'avatar_url',
                'audience_male_percent', 'audience_female_percent', 'audience_top_age'
            ];

            fieldsToCheck.forEach(field => {
                const oldVal = oldValues[field];
                const newVal = newValues[field];
                
                // Handle arrays/objects comparison
                if (field === 'accounts' || field === 'videos') {
                    const oldArr = JSON.stringify(oldValues[field] || []);
                    const newArr = JSON.stringify(newValues[field] || []);
                    if (oldArr !== newArr) {
                        changedFields.push(field);
                    }
                } else if (oldVal !== newVal) {
                    changedFields.push(field);
                }
            });

            // Add accounts and videos to check
            const oldAccountsStr = JSON.stringify(oldValues.accounts || []);
            const newAccountsStr = JSON.stringify(newValues.accounts || []);
            if (oldAccountsStr !== newAccountsStr) {
                if (!changedFields.includes('accounts')) {
                    changedFields.push('accounts');
                }
            }

            const oldVideosStr = JSON.stringify(oldValues.videos || []);
            const newVideosStr = JSON.stringify(newValues.videos || []);
            if (oldVideosStr !== newVideosStr) {
                if (!changedFields.includes('videos')) {
                    changedFields.push('videos');
                }
            }

            // Update the profile
            const updateData = {
                ...newValues,
                approved: false, // Reset approval status
                analytics_verified: false, // Reset analytics verification
            };

            let data: InfluencerData | null = null;
            let error: { message?: string; code?: string } | null = null;
            const saved = await supabase
                .from('influencers')
                .update(updateData)
                .eq('id', user.id)
                .select(INFLUENCER_BROWSER_COLUMNS.join(","))
                .single();
            data = saved.data as unknown as InfluencerData | null;
            error = saved.error;

            if (
                error &&
                (/rate_card/i.test(error.message || '') || error.code === '42703' || error.code === 'PGRST204')
            ) {
                const { rate_card: _omit, ...withoutRateCard } = updateData as typeof updateData & {
                    rate_card?: unknown;
                };
                const retry = await supabase
                    .from('influencers')
                    .update(withoutRateCard)
                    .eq('id', user.id)
                    .select(INFLUENCER_BROWSER_COLUMNS.join(","))
                    .single();
                data = retry.data as unknown as InfluencerData | null;
                error = retry.error;
            }

            if (error || !data) {
                setLoading(false);
                alert("Σφάλμα: " + (error?.message || "Δεν επιστράφηκε το προφίλ"));
                return;
            }

            // Save profile changes if there are any
            if (changedFields.length > 0 && data) {
                try {
                    console.log('[Profile Changes] Saving changes for influencer:', user.id);
                    console.log('[Profile Changes] Changed fields:', changedFields);
                    
                    const response = await fetch('/api/profile-changes', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            influencerId: String(user.id), // Ensure it's a string
                            oldValues: oldValues,
                            newValues: newValues,
                            changedFields: changedFields
                        })
                    });
                    
                    const result = await response.json();
                    if (result.success) {
                        console.log('[Profile Changes] Successfully saved changes');
                    } else {
                        console.error('[Profile Changes] Failed to save:', result.error);
                    }
                } catch (changeError) {
                    console.error("[Profile Changes] Failed to save profile changes:", changeError);
                    // Don't fail the whole operation if change tracking fails
                }
            }

            // Insert follower snapshot if accounts changed
            if (changedFields.includes('accounts') && data.accounts) {
                try {
                    await fetch('/api/influencer/snapshot', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            influencerId: String(user.id),
                            accounts: data.accounts,
                        }),
                    });
                } catch (snapshotErr) {
                    console.error('Error inserting follower snapshot:', snapshotErr);
                    // Don't fail the whole edit if snapshot fails
                }
            }

            setLoading(false);

            // Send email notification to admin
            try {
                await fetch('/api/emails', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        type: 'profile_edit_admin',
                        email: user.contact_email,
                        name: data.display_name,
                        location: data.location || 'N/A'
                    })
                });
            } catch (mailError) {
                console.error("Email notification failed:", mailError);
            }

            onSave({
                ...(data as InfluencerData),
                contact_email: user.contact_email,
                min_rate: newValues.min_rate,
                birth_date: newValues.birth_date,
                rate_card: newValues.rate_card,
                insights_urls: user.insights_urls,
            });
            alert("Το προφίλ σου ενημερώθηκε! Θα ελέγξουμε τις αλλαγές και θα σε ενημερώσουμε όταν εγκριθεί ξανά.");
            onClose();
        } catch (err: any) {
            setLoading(false);
            alert("Σφάλμα: " + err.message);
        }
    };

    const platforms = ["Instagram", "TikTok", "YouTube", "Twitter"];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto my-8">
                <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-slate-900">{L("Επεξεργασία Προφίλ", "Edit Profile")}</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
                </div>
                
                <form onSubmit={handleSave} className="p-6 space-y-6">
                    {/* Basic Info */}
                    <div>
                        <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase">{L("Βασικές Πληροφορίες", "Basic Information")}</h3>
                        
                        {/* Avatar Upload */}
                        <div className="mb-4">
                            <label className="block text-sm font-semibold text-slate-900 mb-2">{L("Φωτογραφία Προφίλ", "Profile Photo")}</label>
                            <div className="flex items-center gap-4">
                                <div className="relative w-20 h-20 rounded-full border-2 border-slate-300 overflow-hidden bg-slate-100">
                                    {avatarPreview ? (
                                        <img src={avatarPreview} alt="Avatar preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gray-200">
                                            <span className="text-gray-500 text-xs font-medium">{L("ΧΩΡΙΣ ΦΩΤΟ", "NO PHOTO")}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <label className="block">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    setAvatarFile(file);
                                                    setAvatarPreview(URL.createObjectURL(file));
                                                }
                                            }}
                                            className="hidden"
                                        />
                                        <span className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
                                            Επιλογή Αρχείου
                                        </span>
                                    </label>
                                    <p className="text-xs text-slate-500 mt-1">PNG, JPG, GIF έως 5MB</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-semibold text-slate-900 mb-1">{L("Ονοματεπώνυμο *", "Full name *")}</label>
                                <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900" required />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-900 mb-1">{L("Τοποθεσία", "Location")}</label>
                                <input type="text" value={location} onChange={e => setLocation(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-900 mb-1">{L("Ημερομηνία Γέννησης", "Date of Birth")}</label>
                                <input
                                    type="date"
                                    value={birthDate}
                                    onChange={e => setBirthDate(e.target.value)}
                                    min={BIRTH_DATE_MIN}
                                    max={athensTodayYmd()}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
                                />
                            </div>
                            <CategoryCheckboxList
                                lang={lang}
                                selected={categories}
                                onChange={setCategories}
                                label="Κατηγορίες *"
                                description="Επιλέξτε μία ή περισσότερες κατηγορίες"
                                emptyFallback="Lifestyle"
                                compact
                            />
                            <div>
                                <label className="block text-xs font-semibold text-slate-900 mb-1">{L("Φύλο", "Gender")}</label>
                                <select value={gender} onChange={e => setGender(normalizeGender(e.target.value))} className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900">
                                    <option value="Female">Γυναίκα</option>
                                    <option value="Male">Άνδρας</option>
                                    <option value="AI">AI (Artificial Intelligence)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-900 mb-1">{L("Ελάχιστη Χρέωση (€)", "Minimum Rate (€)")}</label>
                                <input type="text" value={minRate} onChange={e => setMinRate(replaceCommaWithDot(e.target.value))} className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900" placeholder="250" />
                            </div>
                        </div>
                        <div className="mt-3">
                            <label className="block text-xs font-semibold text-slate-900 mb-1">{L("Βιογραφικό", "Bio")}</label>
                            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={2} className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-slate-900" />
                        </div>
                    </div>

                    {/* Pricing Section - Compact */}
                    <div>
                        <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase">{L("Τιμές Ανά Υπηρεσία", "Prices per Service")}</h3>
                        <p className="text-xs text-slate-600 mb-3">{L('Αφήστε κενό για "Ρώτησε".', 'Leave empty for "Ask".')}</p>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
                            <div>
                                <label className="block text-xs font-semibold text-slate-900 mb-1">{L("Instagram Story (€)", "Instagram Story (€)")}</label>
                                <input 
                                    type="text" 
                                    value={priceStory} 
                                    onChange={e => setPriceStory(replaceCommaWithDot(e.target.value))} 
                                    className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900" 
                                    placeholder="100" 
                                />
                            </div>
                        <div>
                                <label className="block text-xs font-semibold text-slate-900 mb-1">{L("Instagram Post (€)", "Instagram Post (€)")}</label>
                                <input 
                                    type="text" 
                                    value={pricePost} 
                                    onChange={e => setPricePost(replaceCommaWithDot(e.target.value))} 
                                    className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900" 
                                    placeholder="200" 
                                />
                        </div>
                        <div>
                                <label className="block text-xs font-semibold text-slate-900 mb-1">{L("Reel / TikTok (€)", "Reel / TikTok (€)")}</label>
                                <input 
                                    type="text" 
                                    value={priceReel} 
                                    onChange={e => setPriceReel(replaceCommaWithDot(e.target.value))} 
                                    className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900" 
                                    placeholder="300" 
                                />
                        </div>
                         <div>
                                <label className="block text-xs font-semibold text-slate-900 mb-1">{L("YouTube Video (€)", "YouTube Video (€)")}</label>
                                <input 
                                    type="text" 
                                    value={priceYouTube} 
                                    onChange={e => setPriceYouTube(replaceCommaWithDot(e.target.value))} 
                                    className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900" 
                                    placeholder="400" 
                                />
                        </div>
                    </div>
                            <div className="mt-6">
                                <label className="block text-sm font-semibold text-slate-900 mb-1">{L("Γλώσσες", "Languages")}</label>
                                <div className="border-2 border-slate-200 rounded-lg p-3 bg-slate-50">
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                        {LANGUAGES.map(langItem => {
                                            const isSelected = selectedLanguages.includes(langItem.code);
                                            return (
                                                <label 
                                                    key={langItem.code} 
                                                    className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-all ${
                                                        isSelected 
                                                            ? 'bg-blue-100 border-2 border-blue-500' 
                                                            : 'bg-white border-2 border-slate-200 hover:border-blue-300'
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedLanguages([...selectedLanguages, langItem.code]);
                                                            } else {
                                                                setSelectedLanguages(selectedLanguages.filter(l => l !== langItem.code));
                                                            }
                                                        }}
                                                        className="w-4 h-4 text-blue-600 border-2 border-slate-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                                    />
                                                    <span className={`text-xs font-medium ${isSelected ? 'text-blue-900' : 'text-slate-700'}`}>
                                                        {langItem.el}
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>

                    {/* Social Accounts */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 mb-3 uppercase">{L("Κανάλια Social Media", "Social Media Channels")}</h3>
                        <div className="space-y-2">
                            {accounts.map((acc, i) => (
                                <div key={i} className="flex gap-3 items-start p-3 border border-slate-200 rounded-lg">
                                    <select value={acc.platform} onChange={e => handleAccountChange(i, 'platform', e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900">
                                        {platforms.map(p => <option key={p}>{p}</option>)}
                                    </select>
                                    <input type="text" placeholder="Username" value={acc.username} onChange={e => handleAccountChange(i, 'username', e.target.value)} className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900" />
                                    <input type="text" placeholder="Followers" value={acc.followers} onChange={e => handleAccountChange(i, 'followers', e.target.value)} className="w-32 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900" />
                                    {accounts.length > 1 && (
                                        <button type="button" onClick={() => removeAccount(i)} className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg">✕</button>
                                    )}
                                </div>
                            ))}
                            <button type="button" onClick={addAccount} className="text-sm text-blue-600 hover:text-blue-700 font-medium">{L("+ Προσθήκη Καναλιού", "+ Add Channel")}</button>
                        </div>
                    </div>

                    {/* Audience */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 mb-3 uppercase">{L("Κοινό", "Audience")}</h3>
                        <div className="grid md:grid-cols-3 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-slate-900 mb-1">{L("Άνδρες (%)", "Men (%)")}</label>
                                <input type="number" value={malePercent} onChange={e => setMalePercent(e.target.value)} min="0" max="100" className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-900 mb-1">{L("Γυναίκες (%)", "Women (%)")}</label>
                                <input type="number" value={femalePercent} onChange={e => setFemalePercent(e.target.value)} min="0" max="100" className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-900 mb-1">{L("Κύρια Ηλικιακή Ομάδα", "Main Age Group")}</label>
                                <input 
                                    type="text" 
                                    value={topAge} 
                                    onChange={(e) => {
                                        let value = e.target.value;
                                        // Allow only numbers and dashes
                                        value = value.replace(/[^0-9-]/g, '');
                                        // Auto-add dash after 2 digits if not already present
                                        if (value.length === 2 && !value.includes('-')) {
                                            value = value + '-';
                                        }
                                        setTopAge(value);
                                    }}
                                    className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900" 
                                    placeholder="18-24" 
                                    maxLength={6}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Videos */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 mb-3 uppercase">{L("Video Links / Φωτογραφίες", "Video Links / Photos")}</h3>
                        <p className="text-xs text-slate-600 mb-2">{L('Μπορείτε να προσθέσετε links από TikTok, Reels, YouTube ή φωτογραφίες από δουλειές σας.', 'You can add links from TikTok, Reels, YouTube or photos of your work.')}</p>
                        {parseHiddenVideos(user.hidden_videos).map((hidden) => {
                          const short =
                            hidden.url.length > 64 ? `${hidden.url.slice(0, 61)}…` : hidden.url;
                          return (
                            <div
                              key={normalizeVideoUrlKey(hidden.url)}
                              className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-900"
                            >
                              <p className="font-semibold">{HIDDEN_VIDEO_NOTICE.title[lang]}</p>
                              <p className="mt-1 break-all text-amber-800/90">{short}</p>
                              <p className="mt-1">{HIDDEN_VIDEO_NOTICE.body[lang]}</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900 ring-1 ring-amber-300 hover:bg-amber-200"
                                  onClick={() => {
                                    const key = normalizeVideoUrlKey(hidden.url);
                                    const row = videoRows.find(
                                      (r) => normalizeVideoUrlKey(r.url) === key
                                    );
                                    if (row) {
                                      handleVideoChange(row.id, "");
                                    } else {
                                      addVideo();
                                    }
                                  }}
                                >
                                  {HIDDEN_VIDEO_NOTICE.replace[lang]}
                                </button>
                                <button
                                  type="button"
                                  className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-50"
                                  onClick={() => {
                                    const key = normalizeVideoUrlKey(hidden.url);
                                    const row = videoRows.find(
                                      (r) => normalizeVideoUrlKey(r.url) === key
                                    );
                                    if (row) {
                                      if (videoRows.length > 1) removeVideo(row.id);
                                      else handleVideoChange(row.id, "");
                                    }
                                  }}
                                >
                                  {HIDDEN_VIDEO_NOTICE.remove[lang]}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        <div className="space-y-2">
                            {videoRows.map((row) => {
                                const video = row.url;
                                const rejected = !!errorById[row.id];
                                const isVideo = isDefinitelyVideo(video);
                                const isImage = isDefinitelyImage(video);
                                const isInstagramPost = video && /instagram\.com\/(?:[A-Za-z0-9._]+\/)?p\//i.test(video);
                                const isTikTokPhoto = video && /tiktok\.com\/[^?\s]*\/photo\/\d+/i.test(video);
                                const videoProfileWarn = {
                                  el: "Αυτό είναι link προφίλ, όχι video. Βάλε link από συγκεκριμένο reel/video/post.",
                                  en: "This is a profile link, not a video. Paste a link to a specific reel/video/post.",
                                };
                                const isProfileNotVideo =
                                  !!video?.trim() &&
                                  !!detectProvider(video) &&
                                  !isImage &&
                                  !isEmbeddableVideoUrl(video);
                                const isHiddenRow =
                                  !!video?.trim() &&
                                  parseHiddenVideos(user.hidden_videos).some(
                                    (h) =>
                                      normalizeVideoUrlKey(h.url) ===
                                      normalizeVideoUrlKey(video)
                                  );

                                return (
                                    <div key={row.id} className="flex gap-3 items-start">
                                        <div className="flex-1">
                                            <input 
                                                type="url" 
                                                value={video} 
                                                onChange={e => handleVideoChange(row.id, e.target.value)}
                                                onBlur={() => handleVideoBlur(row.id)}
                                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900 ${
                                                  isHiddenRow
                                                    ? "border-amber-400 bg-amber-50/40"
                                                    : "border-slate-300"
                                                }`}
                                                placeholder={L("https://youtube.com/... ή https://image.com/...", "https://youtube.com/... or https://image.com/...")} 
                                                autoComplete="off"
                                            />
                                            {checkingById[row.id] ? (
                                              <p className="mt-2 text-sm text-slate-500">{checkingLabel}</p>
                                            ) : null}
                                            {errorById[row.id] ? (
                                              <p className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                                {errorById[row.id]}
                                              </p>
                                            ) : null}
                                            {isProfileNotVideo && !rejected && (
                                              <p className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                                {videoProfileWarn[lang]}
                                              </p>
                                            )}
                                            {!rejected && video && isEmbeddableVideoUrl(video) && (
                                                <div className="mt-2 relative w-full h-32 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                                                    <VideoThumbnail 
                                                        url={video}
                                                        alt="Video/Photo thumbnail"
                                                        fill
                                                        className={isImage ? "object-contain" : "object-cover"}
                                                    />
                                                    {isVideo && !isInstagramPost && !isTikTokPhoto && (
                                                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                                                            <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center">
                                                                <span className="text-xl ml-1">▶</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {!rejected && video && isImage && (
                                                <div className="mt-2 relative w-full h-32 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                                                    <VideoThumbnail
                                                        url={video}
                                                        alt="Video/Photo thumbnail"
                                                        fill
                                                        className="object-contain"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        {videoRows.length > 1 && (
                                            <button type="button" onClick={() => removeVideo(row.id)} className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg mt-8">✕</button>
                                        )}
                                    </div>
                                );
                            })}
                            {videoLinkError ? (
                              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                {videoLinkError}
                              </p>
                            ) : null}
                            <button type="button" onClick={addVideo} className="text-sm text-blue-600 hover:text-blue-700 font-medium">{L("+ Προσθήκη Video Link / Φωτογραφίας", "+ Add Video Link / Photo")}</button>
                        </div>
                    </div>

                    {/* Warning */}
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <p className="text-sm text-yellow-800">
                            ⚠️ <strong>{L('Σημαντικό:', 'Important:')}</strong> {L('Μετά την αποθήκευση, το προφίλ σου θα μεταβεί σε κατάσταση «Εκκρεμότητα» και θα χρειαστεί επαν-επαλήθευση από τον admin.', 'After saving, your profile will switch to "Pending" and will need to be re-verified by an admin.')}
                        </p>
                    </div>
                    
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg font-medium transition-colors">{L("Ακύρωση", "Cancel")}</button>
                        <button type="submit" disabled={loading || videosChecking || videosNotPlayable} className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium disabled:opacity-50 transition-colors">
                            {loading ? L('Αποθήκευση...', 'Saving...') : L('Αποθήκευση Αλλαγών', 'Save Changes')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- MAIN DASHBOARD CONTENT ---
interface Proposal {
  id: number;
  brand_name: string;
  brand_email: string;
  budget: string;
  service_type: string;
  status: string;
  message: string;
  created_at: string;
  influencer_agreement_accepted: boolean | null;
  brand_agreement_accepted: boolean | null;
  brand_added_to_past_brands: boolean | null;
  counter_proposal_budget?: string | null;
  counter_proposal_status?: string | null;
  counter_proposal_message?: string | null;
}

function tabBadgeText(count: number): string {
  if (count > 99) return "99+";
  if (count > 9) return "9+";
  return String(count);
}

export default function DashboardContent({ profile: initialProfile }: { profile: InfluencerData }) {
    const [profile, setProfile] = useState(initialProfile);
    const [showEditModal, setShowEditModal] = useState(false);
    const [availabilitySaving, setAvailabilitySaving] = useState(false);
    const [availabilityError, setAvailabilityError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'profile' | 'tools' | 'messages' | 'proposals' | 'campaigns' | 'analytics' | 'announcements'>('profile');
    const activeTabRef = useRef(activeTab);
    activeTabRef.current = activeTab;
    const searchParams = useSearchParams();
    const [lang, setLang] = useState<'el' | 'en'>(() => getStoredLanguage());
    const ui = lang === 'en'
      ? {
          welcome: 'Welcome,',
          subtitle: 'Manage your profile and settings',
          backHome: 'Back to Home',
          status: 'Status',
          minRate: 'Min Rate',
          engagement: 'Engagement',
          approved: 'Approved',
          pending: 'Pending',
          pendingHint:
            'Pending means you cannot yet view or apply to campaigns. Other dashboard tabs stay available. The team usually reviews within 1–2 business days.',
          logout: 'Log out',
          deleteAccount: 'Delete Account',
          deleteAccountTitle: 'Delete account',
          deleteAccountBody1: 'Are you sure you want to permanently delete your account?',
          deleteAccountBody2:
            'Your profile, conversations, collaboration proposals, campaign applications, and Influo access will be removed. This action cannot be undone.',
          deleteCancel: 'No, cancel',
          deleteConfirm: 'Yes, delete',
          deleting: 'Deleting…',
          dangerHint:
            'Account deletion is permanent and removes your profile, conversations, and related data from the platform.',
          channelAnalytics: 'Channel Analytics',
          dangerZone: 'Danger zone',
          tabProfile: 'Profile',
          tabTools: 'Tools',
          tabCampaigns: 'Campaigns',
          tabOffers: 'Offers',
          tabMessages: 'Messages',
          tabStats: 'Analytics',
          tabAnnouncements: 'Announcements',
          campaignsTitle: 'Campaigns · expressions of interest',
          offersTitle: 'Offers from Brands',
          offersEmpty: 'No offers yet.',
          announcementsTitle: 'Announcements',
          announcementsLoading: 'Loading...',
          announcementsEmpty: 'No announcements.',
          unreadTitle: 'Unread',
          markRead: 'Mark as read',
          readAt: 'Read',
          hideFromList: 'Hide from list',
          deleteLabel: 'Delete',
          profileOverview: 'Profile Overview',
          editProfile: 'Edit Profile',
          availabilityTitle: 'Availability status',
          availabilityHint: 'Shown on the "Status" card of your public profile.',
          available: 'Available',
          unavailable: 'Temporarily unavailable',
          availableHint: 'Open to new collaborations',
          unavailableHint: 'Pausing new collaborations for now',
          saving: 'Saving…',
          socialChannels: 'Social Media Channels',
          docTitle: 'Creator Dashboard | Influo',
        }
      : {
          welcome: 'Καλώς ήρθες,',
          subtitle: 'Διαχείριση προφίλ και ρυθμίσεων',
          backHome: 'Επιστροφή στην Αρχική',
          status: 'Κατάσταση',
          minRate: 'Ελάχ. τιμή',
          engagement: 'Απήχηση',
          approved: 'Εγκεκριμένο',
          pending: 'Σε Εκκρεμότητα',
          pendingHint:
            'Η εκκρεμότητα σημαίνει ότι δεν μπορείτε ακόμη να δείτε ή να κάνετε αίτηση σε καμπάνιες. Τα υπόλοιπα tabs του dashboard παραμένουν διαθέσιμα. Η ομάδα ελέγχει το προφίλ, συνήθως εντός 1–2 εργάσιμων ημερών.',
          logout: 'Αποσύνδεση',
          deleteAccount: 'Διαγραφή Λογαριασμού',
          deleteAccountTitle: 'Διαγραφή λογαριασμού',
          deleteAccountBody1: 'Είστε σίγουροι/η ότι θέλετε να διαγράψετε οριστικά τον λογαριασμό σας;',
          deleteAccountBody2:
            'Θα διαγραφούν όλα τα στοιχεία του προφίλ σας, οι συνομιλίες, οι προτάσεις συνεργασίας, οι αιτήσεις σε καμπάνιες και η πρόσβασή σας στην Influo. Η ενέργεια δεν μπορεί να αναιρεθεί.',
          deleteCancel: 'Όχι, ακύρωση',
          deleteConfirm: 'Ναι, διαγραφή',
          deleting: 'Διαγραφή…',
          dangerHint:
            'Η διαγραφή λογαριασμού είναι οριστική και αφαιρεί το προφίλ σας, τις συνομιλίες και όλα τα σχετικά δεδομένα από την πλατφόρμα.',
          channelAnalytics: 'Αναλυτικά Καναλιού',
          dangerZone: 'Επικίνδυνη ζώνη',
          tabProfile: 'Προφίλ',
          tabTools: 'Εργαλεία',
          tabCampaigns: 'Καμπάνιες',
          tabOffers: 'Προσφορές',
          tabMessages: 'Μηνύματα',
          tabStats: 'Στατιστικά',
          tabAnnouncements: 'Ανακοινώσεις',
          campaignsTitle: 'Καμπάνιες · αιτήσεις ενδιαφέροντος',
          offersTitle: 'Προσφορές από Brands',
          offersEmpty: 'Δεν υπάρχουν προσφορές ακόμα.',
          announcementsTitle: 'Ανακοινώσεις',
          announcementsLoading: 'Φόρτωση...',
          announcementsEmpty: 'Δεν υπάρχουν ανακοινώσεις.',
          unreadTitle: 'Μη διαβασμένο',
          markRead: 'Σήμανση ως διαβασμένο',
          readAt: 'Διαβάστηκε',
          hideFromList: 'Απόκρυψη από τη λίστα',
          deleteLabel: 'Διαγραφή',
          profileOverview: 'Επισκόπηση Προφίλ',
          editProfile: 'Επεξεργασία Προφίλ',
          availabilityTitle: 'Κατάσταση διαθεσιμότητας',
          availabilityHint: 'Εμφανίζεται στην κάρτα «Κατάσταση» του δημόσιου προφίλ σου.',
          available: 'Διαθέσιμος',
          unavailable: 'Μη διαθέσιμος προσωρινά',
          availableHint: 'Ανοιχτός σε νέες συνεργασίες',
          unavailableHint: 'Παύση νέων συνεργασιών προς το παρόν',
          saving: 'Αποθήκευση…',
          socialChannels: 'Κανάλια Social Media',
          docTitle: 'Πίνακας δημιουργού | Influo',
        };

    useEffect(() => {
        if (typeof document === 'undefined') return;
        document.title = ui.docTitle;
    }, [ui.docTitle]);

    const dateLocale = lang === 'en' ? 'en-GB' : 'el-GR';
    const T = (el: string, en: string) => (lang === 'en' ? en : el);

    const switchLang = (next: 'el' | 'en') => {
      setLang(next);
      setStoredLanguage(next);
    };

    const isAvailable =
        !profile.availability_status ||
        profile.availability_status === 'available';

    const setAvailabilityStatus = async (next: 'available' | 'unavailable') => {
        if (availabilitySaving) return;
        const current = isAvailable ? 'available' : 'unavailable';
        if (current === next) return;

        setAvailabilitySaving(true);
        setAvailabilityError(null);
        const previous = profile.availability_status;
        setProfile((p) => ({ ...p, availability_status: next }));

        try {
            const { error } = await supabase
                .from('influencers')
                .update({ availability_status: next })
                .eq('id', profile.id);

            if (error) throw error;
        } catch (err: unknown) {
            setProfile((p) => ({ ...p, availability_status: previous ?? 'available' }));
            const msg = err instanceof Error ? err.message : 'Σφάλμα ενημέρωσης';
            setAvailabilityError(msg);
        } finally {
            setAvailabilitySaving(false);
        }
    };

    useEffect(() => {
        const tab = searchParams?.get('tab');
        if (
            tab === 'profile' ||
            tab === 'tools' ||
            tab === 'messages' ||
            tab === 'proposals' ||
            tab === 'campaigns' ||
            tab === 'analytics' ||
            tab === 'announcements'
        ) {
            setActiveTab(tab);
        }
    }, [searchParams]);

    useOwnPresenceHeartbeat(profile?.id ? { kind: 'influencer', influencerId: profile.id } : null);

    const [loading, setLoading] = useState(false);
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
    const [showAgreementModal, setShowAgreementModal] = useState(false);
    const [agreementAccepted, setAgreementAccepted] = useState(false);
    const [savingAgreement, setSavingAgreement] = useState(false);
    const [showCounterProposalModal, setShowCounterProposalModal] = useState(false);
    const [counterBudget, setCounterBudget] = useState('');
    const [counterMessage, setCounterMessage] = useState('');
    const [savingCounterProposal, setSavingCounterProposal] = useState(false);
    const [selectedProposalForMessaging, setSelectedProposalForMessaging] = useState<Proposal | null>(null);
    const [proposalsLoaded, setProposalsLoaded] = useState(false);
    const [unseenProposalCount, setUnseenProposalCount] = useState(0);
    const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
    const [announcementsList, setAnnouncementsList] = useState<Array<{ id: string; title: string; body: string; created_at: string; read: boolean; read_at: string | null }>>([]);
    const [unreadAnnouncementsCount, setUnreadAnnouncementsCount] = useState(0);
    const [announcementsLoading, setAnnouncementsLoading] = useState(false);
    const [openCampaignIds, setOpenCampaignIds] = useState<string[]>([]);
    const [campaignsLoaded, setCampaignsLoaded] = useState(false);
    const [changesRequestedCount, setChangesRequestedCount] = useState(0);
    const [unseenCampaignCount, setUnseenCampaignCount] = useState(0);
    const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
    const [deletingAccount, setDeletingAccount] = useState(false);
    const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);

    const handleDeleteAccount = async () => {
        setDeletingAccount(true);
        setDeleteAccountError(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                throw new Error('Δεν βρέθηκε ενεργή σύνδεση. Συνδεθείτε ξανά.');
            }

            const res = await fetch('/api/account/delete', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || 'Η διαγραφή απέτυχε. Δοκιμάστε ξανά.');
            }

            await logoutEverywhere('/?account_deleted=1');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Η διαγραφή απέτυχε. Δοκιμάστε ξανά.';
            setDeleteAccountError(message);
        } finally {
            setDeletingAccount(false);
        }
    };

    const reloadProposals = async () => {
        const response = await sessionFetch('/api/proposals?role=influencer', { cache: 'no-store' });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !Array.isArray(result.proposals)) return null;
        const rows = result.proposals as Proposal[];
        setProposals(rows);
        setProposalsLoaded(true);
        return rows;
    };

    // Load proposals and counts
    useEffect(() => {
        const loadProposals = async () => {
            await reloadProposals();
        };
        
        const loadUnreadMessages = async () => {
            const influencerId = profile?.id;
            if (!influencerId) return;
            const { data: conversations } = await supabase
                .from('conversations')
                .select('id')
                .eq('influencer_id', influencerId);

            if (!conversations || conversations.length === 0) {
                setUnreadMessagesCount(0);
                return;
            }

            const conversationIds = conversations.map(c => c.id);
            const { count, error } = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .in('conversation_id', conversationIds)
                .eq('sender_type', 'brand')
                .or('read.eq.false,read.is.null');

            if (!error && count !== null) {
                setUnreadMessagesCount(count);
            } else if (error) {
                console.error('Error counting unread messages:', error);
                setUnreadMessagesCount(0);
            }
        };
        
        const loadUnreadAnnouncementsCount = async () => {
            if (activeTabRef.current === 'announcements') return;
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) return;
            try {
                const res = await fetch('/api/announcements/unread-count', {
                    headers: { Authorization: `Bearer ${session.access_token}` },
                });
                const data = await res.json();
                if (res.ok && typeof data.count === 'number') setUnreadAnnouncementsCount(data.count);
            } catch (e) {
                console.error('Error loading unread announcements count:', e);
            }
        };

        const loadCampaignAttention = async () => {
            if (!profile?.approved) {
                setOpenCampaignIds([]);
                setChangesRequestedCount(0);
                setCampaignsLoaded(true);
                return;
            }
            const { data: openRows, error: openErr } = await supabase
                .from('brand_campaigns')
                .select('id')
                .eq('status', 'open');
            if (openErr) {
                console.error('Error loading open campaigns for badge', openErr);
                return;
            }
            const { count, error: changeErr } = await supabase
                .from('campaign_applications')
                .select('id', { count: 'exact', head: true })
                .eq('influencer_id', profile.id)
                .eq('deliverable_status', 'changes_requested');
            if (changeErr) {
                console.error('Error loading deliverable changes for badge', changeErr);
                return;
            }
            setOpenCampaignIds((openRows || []).map((row) => String(row.id)));
            setChangesRequestedCount(count ?? 0);
            setCampaignsLoaded(true);
        };

        loadProposals();
        loadUnreadMessages();
        loadUnreadAnnouncementsCount();
        void loadCampaignAttention();
        
        // Listen for messages read event to update count immediately
        const handleMessagesRead = () => {
            loadUnreadMessages();
        };
        window.addEventListener('messagesRead', handleMessagesRead);
        window.addEventListener('focus', handleMessagesRead);
        
        const refreshCounts = () => {
            loadProposals();
            loadUnreadMessages();
            loadUnreadAnnouncementsCount();
            void loadCampaignAttention();
        };
        const interval = setInterval(() => {
            if (document.hidden) return;
            refreshCounts();
        }, 120000);
        const onVisibility = () => {
            if (!document.hidden) refreshCounts();
        };
        document.addEventListener('visibilitychange', onVisibility);
        
        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisibility);
            window.removeEventListener('messagesRead', handleMessagesRead);
            window.removeEventListener('focus', handleMessagesRead);
        };
    }, [profile?.id, profile?.approved]);

    useEffect(() => {
        if (!profile?.id || typeof window === 'undefined') return;
        const store = window.localStorage;
        setUnseenCampaignCount(
            badgeAfterOpen(
                activeTab === 'campaigns',
                campaignsLoaded,
                openCampaignIds,
                readIdList(store, influencerCampaignSeenKey(profile.id))
            )
        );
        if (activeTab === 'campaigns' && campaignsLoaded) {
            writeIdList(store, influencerCampaignSeenKey(profile.id), openCampaignIds);
        }
        const offerIds = influencerProposalAlertIds(proposals);
        setUnseenProposalCount(
            badgeAfterOpen(
                activeTab === 'proposals',
                proposalsLoaded,
                offerIds,
                readIdList(store, influencerProposalSeenKey(profile.id))
            )
        );
        if (activeTab === 'proposals' && proposalsLoaded) {
            writeIdList(store, influencerProposalSeenKey(profile.id), offerIds);
        }
    }, [profile?.id, activeTab, campaignsLoaded, openCampaignIds, proposals, proposalsLoaded]);

    useEffect(() => {
        if (activeTab !== 'announcements' || !profile?.id) return;
        let cancelled = false;
        void (async () => {
            setAnnouncementsLoading(true);
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.access_token || cancelled) return;
                const res = await fetch('/api/announcements', {
                    headers: { Authorization: `Bearer ${session.access_token}` },
                });
                const data = await res.json();
                if (cancelled || !res.ok || !Array.isArray(data.data)) return;
                const rows = data.data as typeof announcementsList;
                const unread = rows.filter((row) => !row.read);
                const now = new Date().toISOString();
                setAnnouncementsList(rows.map((row) => (row.read ? row : { ...row, read: true, read_at: row.read_at || now })));
                setUnreadAnnouncementsCount(0);
                await Promise.all(unread.map((row) => fetch(`/api/announcements/${row.id}/read`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${session.access_token}` },
                })));
            } catch (e) {
                console.error('Error loading announcements:', e);
            } finally {
                if (!cancelled) setAnnouncementsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [activeTab, profile?.id]);

    useEffect(() => {
        // Refresh profile data periodically
        const refreshProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const loaded = await loadOwnInfluencer(supabase);
                if (loaded.ok) {
                    setProfile(loaded.profile as unknown as InfluencerData);
                }
            }
        };

        refreshProfile();
    }, []);

    const handleProfileSave = (updatedUser: InfluencerData) => {
        setProfile(updatedUser);
        setShowEditModal(false);
    };

    const handleSubmitCounterProposal = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProposal || !counterBudget) return;

        setSavingCounterProposal(true);
        try {
            const response = await sessionFetch('/api/proposals/counter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    proposalId: selectedProposal.id,
                    counterBudget: counterBudget,
                    counterMessage: counterMessage
                })
            });

            const result = await response.json();
            if (result.success) {
                await reloadProposals();

                setShowCounterProposalModal(false);
                setSelectedProposal(null);
                setCounterBudget('');
                setCounterMessage('');
                alert('Η αντιπρόταση στάλθηκε! Το brand θα λάβει email με τις λεπτομέρειες.');
            } else {
                throw new Error(result.error || 'Σφάλμα αποστολής αντιπρότασης');
            }
        } catch (err: any) {
            console.error('Error submitting counter-proposal:', err);
            alert('Σφάλμα: ' + err.message);
        } finally {
            setSavingCounterProposal(false);
        }
    };

    const handleAcceptAgreement = async () => {
        if (!selectedProposal || !agreementAccepted) {
            alert('Παρακαλώ διαβάστε και αποδεχτείτε τους όρους χρήσης');
            return;
        }

        setSavingAgreement(true);
        try {
            const response = await sessionFetch('/api/proposals/agreement', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    proposalId: selectedProposal.id,
                    userType: 'influencer',
                    accepted: true
                })
            });

            const result = await response.json();
            if (result.success) {
                const acceptedId = selectedProposal.id;
                const withAcceptance = (rows: Proposal[]) =>
                    rows.map((row) => row.id === acceptedId ? { ...row, influencer_agreement_accepted: true } : row);
                setProposals((prev) => withAcceptance(prev));
                const data = await reloadProposals();
                if (data) {
                    setProposals(withAcceptance(data));
                    // Refresh profile to get updated past_brands
                    const profileData = await loadOwnInfluencer(supabase);
                    if (profileData.ok) {
                        setProfile(profileData.profile as unknown as InfluencerData);
                    }
                }

                setShowAgreementModal(false);
                setSelectedProposal(null);
                setAgreementAccepted(false);
                alert('Η συμφωνία αποδεχτήθηκε! Το brand θα προστεθεί στις συνεργασίες σας όταν και το brand αποδεχτεί.');
            } else {
                throw new Error(result.error || 'Σφάλμα αποδοχής συμφωνίας');
            }
        } catch (err: any) {
            console.error('Error accepting agreement:', err);
            alert('Σφάλμα: ' + err.message);
        } finally {
            setSavingAgreement(false);
        }
    };

    return (
        <div className="min-h-screen p-6 md:p-8 bg-slate-50">
            <PushNotificationPrompt userType="influencer" userIdentifier={profile?.id || ''} lang={lang} />
            <div className="max-w-6xl mx-auto">
                {/* Back to Home Link */}
                <div className="mb-4">
                    <a 
                        href="/" 
                        className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors text-sm font-medium"
                    >
                        <span>←</span> {ui.backHome}
                    </a>
                </div>
                <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
                    <div>
                    <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
                        {ui.welcome} <span className="text-slate-900">{displayNameForLang(profile.display_name, lang)}</span>!
                </h1>
                    <p className="text-slate-600">{ui.subtitle}</p>
                    </div>
                    <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => switchLang(lang === 'el' ? 'en' : 'el')}
                        className="px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                        {lang === 'el' ? 'EN' : 'ΕΛ'}
                    </button>
                    <button
                        type="button"
                        onClick={() => logoutEverywhere("/login")}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium text-sm transition-colors"
                    >
                        {ui.logout}
                    </button>
                    </div>
                </div>
                
                <div className="bg-white rounded-lg border border-slate-200">
                    {/* Tabs */}
                    <div className="border-b border-slate-200 overflow-x-auto">
                        <div className="flex min-w-max sm:min-w-0">
                            <button
                                onClick={() => setActiveTab('profile')}
                                className={`px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-medium border-b-2 transition-colors whitespace-nowrap ${
                                    activeTab === 'profile'
                                        ? 'border-slate-900 text-slate-900'
                                        : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                {ui.tabProfile}
                            </button>
                            <button
                                onClick={() => setActiveTab('tools')}
                                className={`px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-medium border-b-2 transition-colors whitespace-nowrap ${
                                    activeTab === 'tools'
                                        ? 'border-slate-900 text-slate-900'
                                        : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                <span className="hidden md:inline">🧰 </span>{ui.tabTools}
                            </button>
                            <button
                                onClick={() => setActiveTab('campaigns')}
                                className={`px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-medium border-b-2 transition-colors whitespace-nowrap relative ${
                                    activeTab === 'campaigns'
                                        ? 'border-slate-900 text-slate-900'
                                        : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                <span className="hidden md:inline">📣 </span>{ui.tabCampaigns}
                                {unseenCampaignCount > 0 && (
                                    <span className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 bg-red-500 text-white text-[9px] sm:text-[10px] font-bold rounded-full min-w-[14px] sm:min-w-[16px] h-[14px] sm:h-[16px] flex items-center justify-center px-0.5">
                                        {tabBadgeText(unseenCampaignCount)}
                                    </span>
                                )}
                                {changesRequestedCount > 0 && (
                                    <span className="ml-1.5 inline-flex items-center justify-center min-w-[14px] sm:min-w-[16px] h-[14px] sm:h-[16px] px-0.5 rounded-full bg-amber-500 text-white text-[9px] sm:text-[10px] font-bold">
                                        {changesRequestedCount > 99 ? '99+' : changesRequestedCount}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => setActiveTab('proposals')}
                                className={`px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-medium border-b-2 transition-colors relative whitespace-nowrap ${
                                    activeTab === 'proposals'
                                        ? 'border-slate-900 text-slate-900'
                                        : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                <span className="hidden md:inline">📋 </span>{ui.tabOffers}
                                {unseenProposalCount > 0 && (
                                    <span className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 bg-red-500 text-white text-[9px] sm:text-[10px] font-bold rounded-full min-w-[14px] sm:min-w-[16px] h-[14px] sm:h-[16px] flex items-center justify-center px-0.5">
                                        {tabBadgeText(unseenProposalCount)}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => setActiveTab('messages')}
                                className={`px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-medium border-b-2 transition-colors relative whitespace-nowrap ${
                                    activeTab === 'messages'
                                        ? 'border-slate-900 text-slate-900'
                                        : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                <span className="hidden md:inline">💬 </span>{ui.tabMessages}
                                {unreadMessagesCount > 0 && (
                                    <span className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 bg-red-500 text-white text-[9px] sm:text-[10px] font-bold rounded-full min-w-[14px] sm:min-w-[16px] h-[14px] sm:h-[16px] flex items-center justify-center px-0.5">
                                        {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => setActiveTab('analytics')}
                                className={`px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-medium border-b-2 transition-colors whitespace-nowrap ${
                                    activeTab === 'analytics'
                                        ? 'border-slate-900 text-slate-900'
                                        : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                <span className="hidden md:inline">📊 </span>{ui.tabStats}
                            </button>
                            <button
                                onClick={() => setActiveTab('announcements')}
                                className={`px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-medium border-b-2 transition-colors relative whitespace-nowrap ${
                                    activeTab === 'announcements'
                                        ? 'border-slate-900 text-slate-900'
                                        : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                <span className="hidden md:inline">📢 </span>{ui.tabAnnouncements}
                                {unreadAnnouncementsCount > 0 && (
                                    <span className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 bg-red-500 text-white text-[9px] sm:text-[10px] font-bold rounded-full min-w-[14px] sm:min-w-[16px] h-[14px] sm:h-[16px] flex items-center justify-center px-0.5">
                                        {unreadAnnouncementsCount > 99 ? '99+' : unreadAnnouncementsCount > 9 ? '9+' : unreadAnnouncementsCount}
                                    </span>
                                )}
                            </button>
                            <Link
                                href="/help-desk"
                                className={`px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-medium border-b-2 transition-colors whitespace-nowrap ${
                                    'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                <span className="hidden md:inline">📧 </span>Help Desk
                            </Link>
                        </div>
                    </div>

                    <div className="p-6">
                        {activeTab === 'tools' ? (
                            <InfluencerToolsPanel
                                approved={!!profile.approved}
                                displayName={profile.display_name}
                            />
                        ) : activeTab === 'campaigns' ? (
                            <div className="space-y-4">
                                <h2 className="text-xl font-semibold text-slate-900">{ui.campaignsTitle}</h2>
                                <InfluencerCampaignsPanel
                                  influencerId={profile.id}
                                  approved={!!profile.approved}
                                  available={isAvailable}
                                  onMarkAvailable={() => setAvailabilityStatus("available")}
                                />
                            </div>
                        ) : activeTab === 'proposals' ? (
                            <div className="space-y-4">
                                <h2 className="text-xl font-semibold text-slate-900">{ui.offersTitle}</h2>
                                
                                {proposals.length === 0 ? (
                                    <div className="text-center py-12 text-slate-500">
                                        <p>{ui.offersEmpty}</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {proposals.map((prop) => {
                                            const needsAgreement = (prop.status === 'accepted' || prop.status === 'completed') 
                                                && !prop.influencer_agreement_accepted;
                                            const hasAgreement = prop.influencer_agreement_accepted && prop.brand_agreement_accepted;
                                            
                                            return (
                                                <div key={prop.id} className={`border rounded-lg p-4 ${needsAgreement ? 'border-amber-400 bg-gradient-to-r from-amber-50 to-yellow-50 shadow-md' : hasAgreement ? 'border-green-200 bg-green-50' : 'border-slate-200 bg-white'}`}>
                                                    {needsAgreement && (
                                                        <div className="mb-3 p-3 bg-amber-100 border border-amber-300 rounded-lg">
                                                            <p className="text-sm font-semibold text-amber-900 flex items-center gap-2">
                                                                💡 <span>{T("Γιατί να αποδεχτείτε τη συμφωνία;", "Why accept the agreement?")}</span>
                                                            </p>
                                                            <ul className="text-xs text-amber-800 mt-2 space-y-1 ml-5 list-disc">
                                                                <li>{T("Θα μπορείτε να λάβετε αξιολογήσεις που βελτιώνουν την αξιοπιστία σας", "You can receive reviews that improve your credibility")}</li>
                                                                <li>{T("Το brand θα εμφανίζεται στις συνεργασίες σας, αυξάνοντας την προβολή", "The brand will appear in your collaborations, boosting your visibility")}</li>
                                                                <li>{T("Περισσότερες συνεργασίες = πιο επαγγελματικό προφίλ", "More collaborations = a more professional profile")}</li>
                                                            </ul>
                                                        </div>
                                                    )}
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-3 mb-2">
                                                                <h3 className="font-bold text-slate-900">{prop.brand_name}</h3>
                                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                                    prop.status === 'accepted' || prop.status === 'completed' 
                                                                        ? hasAgreement ? 'bg-green-100 text-green-700' : 'bg-green-100 text-green-700'
                                                                        : prop.status === 'rejected' 
                                                                        ? 'bg-red-100 text-red-700'
                                                                        : 'bg-blue-100 text-blue-700'
                                                                }`}>
                                                                    {prop.status === 'pending' ? T("Εκκρεμεί", "Pending") : 
                                                                     prop.status === 'accepted' ? (hasAgreement ? T("✅ Συμφωνία Αποδεκτή", "✅ Agreement Accepted") : T("Αποδεκτή - Αναμένεται Συμφωνία", "Accepted - Awaiting Agreement")) :
                                                                     prop.status === 'completed' ? (hasAgreement ? T("✅ Ολοκληρωμένη", "✅ Completed") : T("Ολοκληρωμένη - Αναμένεται Συμφωνία", "Completed - Awaiting Agreement")) :
                                                                     prop.status === 'rejected' ? T("Απορρίφθηκε", "Rejected") : prop.status}
                                                                </span>
                                                            </div>
                                                            <p className="text-sm text-slate-600 mb-2">
                                                                <strong>{T("Υπηρεσία:", "Service:")}</strong> {prop.service_type} • <strong>Budget:</strong> {prop.budget}€
                                                            </p>
                                                            {prop.message && (
                                                                <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg mt-2">{prop.message}</p>
                                                            )}
                                                            {prop.counter_proposal_budget && prop.counter_proposal_status === 'pending' && (
                                                                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                                                    <p className="text-sm font-semibold text-blue-900 mb-1">💰 {T("Αντιπρόταση στάλθηκε", "Counter-offer sent")}</p>
                                                                    <p className="text-xs text-blue-700">{T("Νέα προτεινόμενη τιμή:", "New proposed price:")} <strong>{prop.counter_proposal_budget}€</strong></p>
                                                                    {prop.counter_proposal_message && (
                                                                        <p className="text-xs text-blue-600 mt-1 italic">"{prop.counter_proposal_message}"</p>
                                                                    )}
                                                                    <p className="text-xs text-blue-500 mt-2">⏳ {T("Αναμένεται απάντηση από το brand", "Awaiting reply from the brand")}</p>
                                                                </div>
                                                            )}
                                                            <p className="text-xs text-slate-500 mt-2">
                                                                {new Date(prop.created_at).toLocaleDateString(dateLocale, { 
                                                                    day: 'numeric', 
                                                                    month: 'long', 
                                                                    year: 'numeric' 
                                                                })}
                                                            </p>
                                                        </div>
                                                        <div className="ml-4 flex flex-col gap-2">
                                                            {needsAgreement && (
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedProposal(prop);
                                                                        setShowAgreementModal(true);
                                                                    }}
                                                                    className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-semibold rounded-lg transition-all text-xs whitespace-nowrap shadow-lg hover:shadow-xl"
                                                                >
                                                                    ⚠️ {T("Συμφωνία", "Agreement")}
                                                                </button>
                                                            )}
                                                            {prop.status === 'pending' && !prop.counter_proposal_budget && (
                                                                <>
                                                                    <button
                                                                        onClick={async () => {
                                                                            try {
                                                                                const response = await sessionFetch('/api/proposals/accept', {
                                                                                    method: 'POST',
                                                                                    headers: { 'Content-Type': 'application/json' },
                                                                                    body: JSON.stringify({ proposalId: prop.id })
                                                                                });

                                                                                const result = await response.json();
                                                                                if (result.success) {
                                                                                    const data = await reloadProposals();
                                                                                    const acceptedProp = data?.find((p: Proposal) => p.id === prop.id);
                                                                                    if (acceptedProp && acceptedProp.status === 'accepted') {
                                                                                        setSelectedProposal(acceptedProp);
                                                                                        setShowAgreementModal(true);
                                                                                    }
                                                                                } else {
                                                                                    alert(T("Σφάλμα: ", "Error: ") + (result.error || T("Αποτυχία αποδοχής προσφοράς", "Failed to accept offer")));
                                                                                }
                                                                            } catch (error: any) {
                                                                                console.error('Error accepting proposal:', error);
                                                                                alert(T("Σφάλμα: ", "Error: ") + error.message);
                                                                            }
                                                                        }}
                                                                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-all text-xs whitespace-nowrap"
                                                                    >
                                                                        ✅ {T("Αποδοχή", "Accept")}
                                                                    </button>
                                                                    <button
                                                                        onClick={async () => {
                                                                            if (!confirm(T("Να απορριφθεί η πρόταση; Το brand θα ειδοποιηθεί.", "Reject this offer? The brand will be notified."))) return;
                                                                            try {
                                                                                const response = await sessionFetch('/api/proposals/reject', {
                                                                                    method: 'POST',
                                                                                    headers: { 'Content-Type': 'application/json' },
                                                                                    body: JSON.stringify({ proposalId: prop.id })
                                                                                });
                                                                                const result = await response.json();
                                                                                if (result.success) {
                                                                                    await reloadProposals();
                                                                                } else {
                                                                                    alert(T("Σφάλμα: ", "Error: ") + (result.error || T("Αποτυχία απόρριψης", "Failed to reject")));
                                                                                }
                                                                            } catch (error: any) {
                                                                                alert(T("Σφάλμα: ", "Error: ") + error.message);
                                                                            }
                                                                        }}
                                                                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-all text-xs whitespace-nowrap"
                                                                    >
                                                                        {T("Απόρριψη", "Reject")}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            setSelectedProposal(prop);
                                                                            setCounterBudget('');
                                                                            setCounterMessage('');
                                                                            setShowCounterProposalModal(true);
                                                                        }}
                                                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all text-xs whitespace-nowrap"
                                                                    >
                                                                        💰 {T("Αντιπρόταση", "Counter-offer")}
                                                                    </button>
                                                                    <button
                                                                        onClick={async () => {
                                                                            try {
                                                                                await sessionFetch('/api/proposals/thread', {
                                                                                    method: 'POST',
                                                                                    headers: { 'Content-Type': 'application/json' },
                                                                                    body: JSON.stringify({ proposalId: prop.id }),
                                                                                });
                                                                            } catch (error) {
                                                                                console.error('Error opening proposal chat:', error);
                                                                            }
                                                                            setSelectedProposalForMessaging(prop);
                                                                            setActiveTab('messages');
                                                                        }}
                                                                        className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white font-semibold rounded-lg transition-all text-xs whitespace-nowrap"
                                                                    >
                                                                        💬 {T("Συζήτησε το", "Discuss")}
                                                                    </button>
                                                                </>
                                                            )}
                                                            {hasAgreement && (
                                                                <div className="px-4 py-2 bg-green-100 text-green-700 font-medium rounded-lg text-xs whitespace-nowrap text-center">
                                                                    ✅ {T("Συμφωνία", "Agreement")}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ) : activeTab === 'analytics' ? (
                            <Analytics influencerId={profile.id} lang={lang} />
                        ) : activeTab === 'announcements' ? (
                            <div className="space-y-4">
                                <h2 className="text-xl font-semibold text-slate-900">{ui.announcementsTitle}</h2>
                                {announcementsLoading ? (
                                    <div className="text-center py-8 text-slate-500">{ui.announcementsLoading}</div>
                                ) : announcementsList.length === 0 ? (
                                    <div className="text-center py-12 text-slate-500">
                                        {ui.announcementsEmpty}
                                    </div>
                                ) : (
                                    <ul className="space-y-3">
                                        {announcementsList.map((a) => (
                                            <li
                                                key={a.id}
                                                className={`border rounded-lg p-4 transition-colors ${
                                                    a.read ? 'bg-slate-50 border-slate-200' : 'bg-white border-blue-200 ring-1 ring-blue-100'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-semibold text-slate-900 flex items-center gap-2">
                                                            {a.title}
                                                            {!a.read && (
                                                                <span className="shrink-0 inline-flex items-center justify-center w-2.5 h-2.5 rounded-full bg-red-500" title={ui.unreadTitle} />
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{a.body}</p>
                                                        <p className="text-xs text-slate-500 mt-2">
                                                            {new Date(a.created_at).toLocaleString(dateLocale, { dateStyle: 'medium', timeStyle: 'short' })}
                                                            {a.read && a.read_at && (
                                                                <span className="ml-2">· {ui.readAt} {new Date(a.read_at).toLocaleString(dateLocale, { dateStyle: 'short', timeStyle: 'short' })}</span>
                                                            )}
                                                        </p>
                                                    </div>
                                                    <div className="shrink-0 flex flex-col sm:flex-row gap-2">
                                                        {!a.read && (
                                                            <button
                                                                type="button"
                                                                onClick={async () => {
                                                                    const { data: { session } } = await supabase.auth.getSession();
                                                                    if (!session?.access_token) return;
                                                                    try {
                                                                        const res = await fetch(`/api/announcements/${a.id}/read`, {
                                                                            method: 'POST',
                                                                            headers: { Authorization: `Bearer ${session.access_token}` },
                                                                        });
                                                                        if (res.ok) {
                                                                            setAnnouncementsList(prev =>
                                                                                prev.map(x => x.id === a.id ? { ...x, read: true, read_at: new Date().toISOString() } : x)
                                                                            );
                                                                            setUnreadAnnouncementsCount(prev => Math.max(0, prev - 1));
                                                                        }
                                                                    } catch (e) {
                                                                        console.error('Error marking announcement as read:', e);
                                                                    }
                                                                }}
                                                                className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                                                            >
                                                                {ui.markRead}
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={async () => {
                                                                const { data: { session } } = await supabase.auth.getSession();
                                                                if (!session?.access_token) return;
                                                                try {
                                                                    const res = await fetch(`/api/announcements/${a.id}/dismiss`, {
                                                                        method: 'POST',
                                                                        headers: { Authorization: `Bearer ${session.access_token}` },
                                                                    });
                                                                    if (res.ok) {
                                                                        setAnnouncementsList(prev => prev.filter(x => x.id !== a.id));
                                                                        if (!a.read) setUnreadAnnouncementsCount(prev => Math.max(0, prev - 1));
                                                                    }
                                                                } catch (e) {
                                                                    console.error('Error dismissing announcement:', e);
                                                                }
                                                            }}
                                                            className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                                                            title={ui.hideFromList}
                                                        >
                                                            {ui.deleteLabel}
                                                        </button>
                                                    </div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        ) : activeTab === 'profile' ? (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-semibold text-slate-900">{ui.profileOverview}</h2>
                                    <button onClick={() => setShowEditModal(true)} className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium transition-colors">
                                        ✏️ {ui.editProfile}
                                    </button>
                                </div>

                                {parseHiddenVideos(profile.hidden_videos).length > 0 ? (
                                  <div className="space-y-2">
                                    {parseHiddenVideos(profile.hidden_videos).map((hidden) => {
                                      const short =
                                        hidden.url.length > 72
                                          ? `${hidden.url.slice(0, 69)}…`
                                          : hidden.url;
                                      return (
                                        <div
                                          key={normalizeVideoUrlKey(hidden.url)}
                                          className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm"
                                        >
                                          <p className="font-semibold">{HIDDEN_VIDEO_NOTICE.title[lang]}</p>
                                          <p className="mt-1 break-all text-amber-900/80">{short}</p>
                                          <p className="mt-1">{HIDDEN_VIDEO_NOTICE.body[lang]}</p>
                                          <button
                                            type="button"
                                            onClick={() => setShowEditModal(true)}
                                            className="mt-2 rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900 ring-1 ring-amber-300 hover:bg-amber-200"
                                          >
                                            {HIDDEN_VIDEO_NOTICE.replace[lang]}
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : null}

                                <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <h3 className="text-sm font-semibold text-slate-900">{ui.availabilityTitle}</h3>
                                            <p className="mt-1 text-sm text-slate-500">
                                                {ui.availabilityHint}
                                            </p>
                                        </div>
                                        <span
                                            className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                                                isAvailable
                                                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                                                    : 'bg-amber-50 text-amber-700 ring-amber-200'
                                            }`}
                                        >
                                            <span
                                                className={`h-1.5 w-1.5 rounded-full ${
                                                    isAvailable ? 'bg-emerald-500' : 'bg-amber-500'
                                                }`}
                                            />
                                            {isAvailable ? ui.available : ui.unavailable}
                                        </span>
                                    </div>

                                    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                        <button
                                            type="button"
                                            disabled={availabilitySaving}
                                            onClick={() => setAvailabilityStatus('available')}
                                            className={`rounded-xl border px-4 py-3 text-left transition-all ${
                                                isAvailable
                                                    ? 'border-emerald-300 bg-emerald-50/80 ring-2 ring-emerald-200'
                                                    : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'
                                            } ${availabilitySaving ? 'opacity-60 cursor-wait' : ''}`}
                                        >
                                            <div className="text-sm font-semibold text-slate-900">{ui.available}</div>
                                            <div className="mt-0.5 text-xs text-slate-500">
                                                {ui.availableHint}
                                            </div>
                                        </button>
                                        <button
                                            type="button"
                                            disabled={availabilitySaving}
                                            onClick={() => setAvailabilityStatus('unavailable')}
                                            className={`rounded-xl border px-4 py-3 text-left transition-all ${
                                                !isAvailable
                                                    ? 'border-amber-300 bg-amber-50/80 ring-2 ring-amber-200'
                                                    : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'
                                            } ${availabilitySaving ? 'opacity-60 cursor-wait' : ''}`}
                                        >
                                            <div className="text-sm font-semibold text-slate-900">
                                                {ui.unavailable}
                                            </div>
                                            <div className="mt-0.5 text-xs text-slate-500">
                                                {ui.unavailableHint}
                                            </div>
                                        </button>
                                    </div>
                                    {availabilitySaving && (
                                        <p className="mt-2 text-xs text-slate-500">{ui.saving}</p>
                                    )}
                                    {availabilityError && (
                                        <p className="mt-2 text-xs text-red-600">{availabilityError}</p>
                                    )}
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <span className="block text-xs text-slate-500 uppercase font-medium mb-2">{ui.status}</span>
                            <span className={`text-lg font-semibold ${profile.approved ? 'text-green-600' : 'text-yellow-600'}`}>
                                {profile.approved ? `✅ ${ui.approved}` : `⏳ ${ui.pending}`}
                            </span>
                            {!profile.approved && (
                                <p className="text-sm text-amber-800 mt-2 leading-relaxed">
                                    {ui.pendingHint}
                                </p>
                            )}
                        </div>
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <span className="block text-xs text-slate-500 uppercase font-medium mb-2">{ui.minRate}</span>
                            <span className="text-lg font-semibold text-slate-900">{profile.min_rate || '—'}€</span>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <span className="block text-xs text-slate-500 uppercase font-medium mb-2">{ui.engagement}</span>
                            <span className="text-lg font-semibold text-slate-900">{profile.engagement_rate || '—'}</span>
                        </div>
                    </div>
                    
                    {profile.accounts && profile.accounts.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-slate-700 mb-3">
                              {ui.socialChannels}
                            </h3>
                            <div className="grid md:grid-cols-2 gap-3">
                                {profile.accounts.map((acc, i) => (
                                    <div key={i} className="p-3 border border-slate-200 rounded-lg">
                                        <div className="font-medium text-slate-900">{acc.platform}</div>
                                        <div className="text-sm text-slate-600">@{acc.username}</div>
                                        {acc.followers ? (
                                            <div className="text-sm text-slate-500">{acc.followers} followers</div>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        </div>
                                )}
                                
                                <div className="pt-6 mt-2 border-t-2 border-red-100 space-y-3">
                                    <h3 className="text-sm font-semibold text-red-800 uppercase tracking-wide">{ui.dangerZone}</h3>
                                    <p className="text-xs text-slate-500 max-w-xl">
                                        {ui.dangerHint}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setDeleteAccountError(null);
                                            setShowDeleteAccountModal(true);
                                        }}
                                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                                    >
                                        {ui.deleteAccount}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <Messaging
                                influencerId={profile.id}
                                influencerName={profile.display_name}
                                brandEmail={selectedProposalForMessaging?.brand_email}
                                brandName={selectedProposalForMessaging?.brand_name}
                                proposalId={selectedProposalForMessaging?.id}
                                initialConversationId={searchParams?.get('conversation')}
                                mode="influencer"
                                lang={lang}
                                onUnreadCountChange={setUnreadMessagesCount}
                            />
                        )}
                    </div>
                </div>
            </div>
            
            {showEditModal && (
                <EditModal 
                    user={profile}
                    onClose={() => setShowEditModal(false)}
                    onSave={handleProfileSave}
                    lang={lang}
                />
            )}

            {showDeleteAccountModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="px-6 py-5 border-b border-slate-200">
                            <h2 className="text-xl font-bold text-slate-900">{ui.deleteAccountTitle}</h2>
                        </div>
                        <div className="px-6 py-5 space-y-4">
                            <p className="text-sm text-slate-600 leading-relaxed">
                                {ui.deleteAccountBody1}
                            </p>
                            <p className="text-sm text-slate-600 leading-relaxed">
                                {ui.deleteAccountBody2}
                            </p>
                            {deleteAccountError && (
                                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                    {deleteAccountError}
                                </p>
                            )}
                        </div>
                        <div className="px-6 py-4 border-t border-slate-200 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    if (deletingAccount) return;
                                    setShowDeleteAccountModal(false);
                                    setDeleteAccountError(null);
                                }}
                                disabled={deletingAccount}
                                className="px-4 py-2 rounded-lg font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-60"
                            >
                                {ui.deleteCancel}
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteAccount}
                                disabled={deletingAccount}
                                className="px-4 py-2 rounded-lg font-medium bg-red-600 hover:bg-red-700 text-white disabled:opacity-60"
                            >
                                {deletingAccount ? ui.deleting : ui.deleteConfirm}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Agreement Modal */}
            {showAgreementModal && selectedProposal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-slate-900">Συμφωνία Συνεργασίας</h2>
                            <button 
                                onClick={() => {
                                    setShowAgreementModal(false);
                                    setSelectedProposal(null);
                                    setAgreementAccepted(false);
                                }}
                                className="text-slate-400 hover:text-slate-600 text-2xl"
                            >
                                ×
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-6">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <p className="text-sm text-blue-900 font-medium mb-2">
                                    Συνεργασία με: <strong>{selectedProposal.brand_name}</strong>
                                </p>
                                <p className="text-sm text-blue-800">
                                    Υπηρεσία: {selectedProposal.service_type} • Budget: {selectedProposal.budget}€
                                </p>
                            </div>

                            {/* Benefits Section */}
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-5 space-y-3">
                                <h3 className="font-bold text-blue-900 text-lg flex items-center gap-2">
                                    ✨ Γιατί να αποδεχτείτε τη συμφωνία;
                                </h3>
                                <div className="grid md:grid-cols-2 gap-3">
                                    <div className="flex items-start gap-2">
                                        <span className="text-2xl">⭐</span>
                                        <div>
                                            <p className="font-semibold text-blue-900">Αξιολογήσεις & Reviews</p>
                                            <p className="text-sm text-blue-700">Θα μπορείτε να λάβετε αξιολογήσεις από το brand, που θα βελτιώσουν την αξιοπιστία σας</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="text-2xl">📈</span>
                                        <div>
                                            <p className="font-semibold text-blue-900">Μεγαλύτερη Προβολή</p>
                                            <p className="text-sm text-blue-700">Το brand θα εμφανίζεται στις συνεργασίες σας, αυξάνοντας την προβολή σας</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="text-2xl">🎯</span>
                                        <div>
                                            <p className="font-semibold text-blue-900">Επαγγελματικός Προφίλ</p>
                                            <p className="text-sm text-blue-700">Περισσότερες συνεργασίες = πιο επαγγελματικό και αξιόπιστο προφίλ</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="text-2xl">💼</span>
                                        <div>
                                            <p className="font-semibold text-blue-900">Περισσότερες Ευκαιρίες</p>
                                            <p className="text-sm text-blue-700">Το portfolio σας μεγάλωνει και ελκύει περισσότερα brands</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-3 pt-3 border-t border-blue-200">
                                    <p className="text-sm font-medium text-blue-900">
                                        💡 <strong>Συμβουλή:</strong> Οι influencers με πολλές αποδεκτές συνεργασίες εμφανίζονται πρώτοι στις αναζητήσεις!
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-bold text-slate-900">Όροι Χρήσης & Συμφωνία</h3>
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 max-h-64 overflow-y-auto text-sm text-slate-700 space-y-3">
                                    <p><strong>1. Υποχρεώσεις Influencer:</strong></p>
                                    <ul className="list-disc list-inside ml-2 space-y-1">
                                        <li>Παροχή υψηλής ποιότητας περιεχομένου σύμφωνα με τις προδιαγραφές</li>
                                        <li>Σεβασμός προθεσμιών και deadlines</li>
                                        <li>Επικοινωνία με το brand για οποιαδήποτε απορία</li>
                                        <li>Χρήση προϊόντων/υπηρεσιών όπως συμφωνήθηκε</li>
                                    </ul>

                                    <p><strong>2. Πληρωμή:</strong></p>
                                    <ul className="list-disc list-inside ml-2 space-y-1">
                                        <li>Η πληρωμή θα γίνει σύμφωνα με τις προδιαγραφές της προσφοράς</li>
                                        <li>Ο influencer θα λάβει πληρωμή μετά την ολοκλήρωση και έγκριση του περιεχομένου</li>
                                    </ul>

                                    <p><strong>3. Δικαιώματα:</strong></p>
                                    <ul className="list-disc list-inside ml-2 space-y-1">
                                        <li>Το brand έχει δικαίωμα έγκρισης/απόρριψης περιεχομένου</li>
                                        <li>Το brand μπορεί να χρησιμοποιήσει το περιεχόμενο για marketing σκοπούς</li>
                                    </ul>

                                    <p><strong>4. Confidentiality:</strong></p>
                                    <ul className="list-disc list-inside ml-2 space-y-1">
                                        <li>Ο influencer δεσμεύεται να διατηρήσει εμπιστευτικότητα για προσωπικά στοιχεία του brand</li>
                                    </ul>

                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-4">
                                        <p className="text-xs font-medium text-amber-900">
                                            ⚠️ <strong>Σημαντικό:</strong> Με την αποδοχή αυτής της συμφωνίας:
                                        </p>
                                        <ul className="text-xs text-amber-800 mt-2 space-y-1 list-disc list-inside ml-2">
                                            <li>Συμφωνείτε με τους παραπάνω όρους χρήσης</li>
                                            <li>Το όνομα του brand θα προστεθεί στις συνεργασίες σας (public)</li>
                                            <li>Το brand θα μπορεί να σας αξιολογήσει μετά την ολοκλήρωση</li>
                                            <li>Η συνεργασία θα εμφανίζεται στο προφίλ σας</li>
                                        </ul>
                                    </div>
                                </div>

                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={agreementAccepted}
                                        onChange={(e) => setAgreementAccepted(e.target.checked)}
                                        className="mt-1 w-5 h-5 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-slate-700">
                                        <strong>Αποδέχομαι τους όρους χρήσης</strong> και συμφωνώ να προστεθεί το brand <strong>{selectedProposal.brand_name}</strong> στις συνεργασίες μου
                                    </span>
                                </label>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                                <button
                                    onClick={() => {
                                        setShowAgreementModal(false);
                                        setSelectedProposal(null);
                                        setAgreementAccepted(false);
                                    }}
                                    className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                                >
                                    Ακύρωση
                                </button>
                                <button
                                    onClick={handleAcceptAgreement}
                                    disabled={!agreementAccepted || savingAgreement}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {savingAgreement ? 'Αποθήκευση...' : 'Αποδοχή Συμφωνίας'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Counter-Proposal Modal */}
            {showCounterProposalModal && selectedProposal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
                        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-slate-900">💰 Υποβολή Αντιπρότασης</h2>
                            <button 
                                onClick={() => {
                                    setShowCounterProposalModal(false);
                                    setSelectedProposal(null);
                                    setCounterBudget('');
                                    setCounterMessage('');
                                }}
                                className="text-slate-400 hover:text-slate-600 text-2xl"
                            >
                                ×
                            </button>
                        </div>
                        
                        <form onSubmit={handleSubmitCounterProposal} className="p-6 space-y-6">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <p className="text-sm text-blue-900 font-medium mb-2">
                                    Αυτή τη στιγμή: <strong>{selectedProposal.brand_name}</strong> προτείνει
                                </p>
                                <p className="text-sm text-blue-800">
                                    <strong>{selectedProposal.service_type}</strong> • <strong>{selectedProposal.budget}€</strong>
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-900 mb-2">
                                    Προτεινόμενη Τιμή (€) *
                                </label>
                                <input
                                    type="text"
                                    value={counterBudget}
                                    onChange={(e) => setCounterBudget(e.target.value)}
                                    placeholder={selectedProposal.budget}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
                                    required
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    Προσφέρετε την τιμή που θεωρείτε δίκαιη για αυτή τη συνεργασία
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-900 mb-2">
                                    Μήνυμα (Προαιρετικό)
                                </label>
                                <textarea
                                    value={counterMessage}
                                    onChange={(e) => setCounterMessage(e.target.value)}
                                    placeholder="Εξηγήστε γιατί η αντιπρότασή σας είναι δίκαιη..."
                                    rows={4}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-slate-900"
                                />
                            </div>

                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                <p className="text-xs text-amber-800">
                                    💡 <strong>Συμβουλή:</strong> Η αντιπρόταση σας θα σταλεί ως email στο brand. 
                                    Μπορείτε να συζητήσετε περισσότερες λεπτομέρειες μέσω των μηνυμάτων.
                                </p>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCounterProposalModal(false);
                                        setSelectedProposal(null);
                                        setCounterBudget('');
                                        setCounterMessage('');
                                    }}
                                    className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                                >
                                    Ακύρωση
                                </button>
                                <button
                                    type="submit"
                                    disabled={!counterBudget || savingCounterProposal}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {savingCounterProposal ? 'Αποστολή...' : 'Αποστολή Αντιπρότασης'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

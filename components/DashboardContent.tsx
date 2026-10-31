// components/DashboardContent.tsx
"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { sessionFetch } from '@/lib/sessionFetch';
import { formatEuro, formatEuroAmount } from '@/lib/formatEuro';
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
import ServicePackagesEditor, { initialPackagesFromUser } from '@/components/ServicePackagesEditor';
import {
    deriveMinRate,
    extrasFromRateCard,
    extrasHaveInvalidPrice,
    FIXED_PRICE_MESSAGE,
    mergeRateCard,
    packagesHaveInvalidPrice,
    packagesForSave,
    rateCardFromPackages,
    type ServiceExtras,
    type ServicePackage,
} from '@/lib/servicePackages';
import {
    BIRTH_DATE_MIN,
    athensTodayYmd,
    birthDateErrorText,
    validateBirthDate,
} from '@/lib/validateBirthDate';
import { getStoredLanguage, setStoredLanguage } from '@/lib/language';
import { formatDate, formatTime } from '@/lib/formatDateTime';
import { isTimeoutError, withTimeout } from '@/lib/withTimeout';
import ToastViewport, { useToasts } from '@/components/ui/Toast';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import {
    BarChart3,
    Bell,
    FileText,
    Home,
    LayoutDashboard,
    LifeBuoy,
    LogOut,
    Megaphone,
    Menu,
    MessageSquare,
    User,
    Wrench,
    X,
} from 'lucide-react';

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
    rate_card?: Record<string, string> | null;
    service_packages?: ServicePackage[] | null;
    avg_rating?: number | null;
    total_reviews?: number | null;
}

type EditSection = 'basics' | 'platforms' | 'packages' | 'portfolio';
type CreatorTab = 'overview' | 'profile' | 'tools' | 'messages' | 'proposals' | 'campaigns' | 'analytics' | 'announcements';

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
const EditModal = ({ user, onClose, onSave, lang = 'el', notify, initialSection = 'basics' }: { user: InfluencerData, onClose: () => void, onSave: (updatedUser: InfluencerData) => void, lang?: 'el' | 'en', notify: (message: string, tone?: 'success' | 'error' | 'info') => void, initialSection?: EditSection }) => {
    const L = (el: string, en: string) => (lang === 'en' ? en : el);
    const [name, setName] = useState(user.display_name);
    const [bio, setBio] = useState(user.bio || "");
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
    
    const [servicePackages, setServicePackages] = useState<ServicePackage[]>(() =>
        initialPackagesFromUser(user.service_packages, user.rate_card)
    );
    const [serviceExtras, setServiceExtras] = useState<ServiceExtras>(() =>
        extrasFromRateCard(user.rate_card)
    );
    const [section, setSection] = useState<EditSection>(initialSection);
    const [confirmSave, setConfirmSave] = useState(false);
    const [confirmDiscard, setConfirmDiscard] = useState(false);

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
    } = useVideoPlayableChecks(lang, existingVideos);

    const formSignature = JSON.stringify({
        name,
        bio,
        location,
        birthDate,
        categories,
        selectedLanguages,
        gender,
        accounts: accounts.map((acc) => ({ platform: acc.platform, username: acc.username, followers: acc.followers })),
        malePercent,
        femalePercent,
        topAge,
        videos: videoRows.map((row) => row.url),
        avatarPreview,
        servicePackages,
        serviceExtras,
    });
    const baselineRef = useRef<string | null>(null);
    if (baselineRef.current === null) baselineRef.current = formSignature;
    const unsaved = formSignature !== baselineRef.current;

    const requestClose = () => {
        if (loading) return;
        if (unsaved) setConfirmDiscard(true);
        else onClose();
    };

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
                    setVideoLinkError(FACEBOOK_VIDEO_LINK_ERROR[lang]);
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

    const performSave = async () => {
        setConfirmSave(false);
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
                    notify(birthDateErrorText(birthCheck, lang), 'error');
                    setSection('basics');
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
                setVideoLinkError(FACEBOOK_VIDEO_LINK_ERROR[lang]);
                notify(FACEBOOK_VIDEO_LINK_ERROR[lang], 'error');
                setSection('portfolio');
                setLoading(false);
                return;
            }
            if (videosChecking || videosNotPlayable) {
                setVideoLinkError(notPlayableMessage);
                notify(notPlayableMessage, 'error');
                setSection('portfolio');
                setLoading(false);
                return;
            }
            const playableOk = await assertAllNewPlayable(videoRows);
            if (!playableOk) {
                setVideoLinkError(notPlayableMessage);
                notify(notPlayableMessage, 'error');
                setSection('portfolio');
                setLoading(false);
                return;
            }

            const nextHidden = syncHiddenVideosWithVideos(
                preparedVideos.videos,
                user.hidden_videos
            );

            if (packagesHaveInvalidPrice(servicePackages) || extrasHaveInvalidPrice(serviceExtras)) {
                notify(FIXED_PRICE_MESSAGE[lang], 'error');
                setSection('packages');
                setLoading(false);
                return;
            }
            const packagesPayload = packagesForSave(servicePackages);
            if (packagesPayload.length < 1) {
                notify(L("Προσθέστε τουλάχιστον ένα πακέτο με τιμή.", "Add at least one package with a price."), 'error');
                setSection('packages');
                setLoading(false);
                return;
            }
            const rateCardPayload = mergeRateCard(rateCardFromPackages(packagesPayload), serviceExtras);

            const newValues: any = {
                display_name: name, 
                bio: bio, 
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
            };

            const priceRes = await sessionFetch("/api/influencer/prices", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    influencerId: String(user.id),
                    service_packages: packagesPayload,
                    rate_card: rateCardPayload,
                }),
            });
            const priceBody = await priceRes.json().catch(() => ({}));
            if (!priceRes.ok) {
                const message = priceBody?.message;
                notify(
                    message && typeof message === "object"
                        ? (lang === "en" ? message.en : message.el) || FIXED_PRICE_MESSAGE[lang]
                        : priceBody?.error || FIXED_PRICE_MESSAGE[lang],
                    "error"
                );
                setSection("packages");
                setLoading(false);
                return;
            }

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
                'display_name', 'bio', 'location', 'birth_date',
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
                (/(rate_card|service_packages)/i.test(error.message || '') || error.code === '42703' || error.code === 'PGRST204')
            ) {
                const {
                    rate_card: _omitRc,
                    service_packages: _omitPkgs,
                    ...withoutPricing
                } = updateData as typeof updateData & {
                    rate_card?: unknown;
                    service_packages?: unknown;
                };
                const retry = await supabase
                    .from('influencers')
                    .update(withoutPricing)
                    .eq('id', user.id)
                    .select(INFLUENCER_BROWSER_COLUMNS.join(","))
                    .single();
                data = retry.data as unknown as InfluencerData | null;
                error = retry.error;
            }

            if (error || !data) {
                setLoading(false);
                notify(L("Σφάλμα: ", "Error: ") + (error?.message || L("Δεν επιστράφηκε το προφίλ", "The profile was not returned")), 'error');
                return;
            }

            let syncedMinRate = currentData.min_rate || "";
            try {
                const syncRes = await sessionFetch("/api/influencer/sync-min-rate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ influencerId: String(user.id) }),
                });
                const syncBody = await syncRes.json().catch(() => ({}));
                if (syncRes.ok && typeof syncBody.min_rate === "string") {
                    syncedMinRate = syncBody.min_rate;
                    if ((currentData.min_rate || "") !== syncBody.min_rate) {
                        if (!changedFields.includes("min_rate")) changedFields.push("min_rate");
                        oldValues.min_rate = currentData.min_rate || "";
                        newValues.min_rate = syncBody.min_rate;
                    }
                }
            } catch (syncErr) {
                console.error("[Profile] min_rate sync failed:", syncErr);
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
                min_rate: syncedMinRate,
                birth_date: newValues.birth_date,
                rate_card: newValues.rate_card,
                service_packages: newValues.service_packages,
                insights_urls: user.insights_urls,
            });
            notify(L("Το προφίλ σου ενημερώθηκε. Θα ελέγξουμε τις αλλαγές και θα σε ενημερώσουμε όταν εγκριθεί ξανά.", "Your profile was updated. We will review the changes and let you know when it is approved again."), 'success');
            onClose();
        } catch (err: any) {
            setLoading(false);
            notify(L("Σφάλμα: ", "Error: ") + err.message, 'error');
        }
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!unsaved) {
            notify(L("Δεν υπάρχουν αλλαγές για αποθήκευση.", "There are no changes to save."), 'info');
            return;
        }
        setConfirmSave(true);
    };

    const platforms = ["Instagram", "TikTok", "YouTube", "Twitter"];

    const editSections: { id: EditSection; label: string }[] = [
        { id: 'basics', label: L('Βασικά', 'Basics') },
        { id: 'platforms', label: L('Πλατφόρμες και στατιστικά', 'Platforms and stats') },
        { id: 'packages', label: L('Πακέτα και τιμές', 'Packages and prices') },
        { id: 'portfolio', label: L('Portfolio', 'Portfolio') },
    ];

    return (
        <>
        <ConfirmDialog
            open={confirmSave}
            title={L('Αποθήκευση και νέος έλεγχος;', 'Save and send for review?')}
            body={L('Οι αλλαγές θα βάλουν το προφίλ σε εκκρεμότητα μέχρι να εγκριθεί ξανά.', 'Saving puts your profile back to pending until it is approved again.')}
            confirmLabel={L('Αποθήκευση', 'Save')}
            cancelLabel={L('Ακύρωση', 'Cancel')}
            onConfirm={() => { void performSave(); }}
            onCancel={() => setConfirmSave(false)}
        />
        <ConfirmDialog
            open={confirmDiscard}
            title={L('Απόρριψη αλλαγών;', 'Discard changes?')}
            body={L('Υπάρχουν αλλαγές που δεν έχουν αποθηκευτεί.', 'There are unsaved changes.')}
            confirmLabel={L('Απόρριψη', 'Discard')}
            cancelLabel={L('Συνέχεια επεξεργασίας', 'Keep editing')}
            onConfirm={() => { setConfirmDiscard(false); onClose(); }}
            onCancel={() => setConfirmDiscard(false)}
        />
        <div className="fixed inset-0 z-50 flex bg-black/50 sm:items-center sm:justify-center sm:p-4">
            <div className="flex h-full w-full flex-col bg-white shadow-xl sm:h-auto sm:max-h-[92vh] sm:max-w-4xl sm:rounded-2xl">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
                    <div className="min-w-0">
                        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">{L("Επεξεργασία προφίλ", "Edit profile")}</h2>
                        {unsaved ? <p className="mt-0.5 text-xs text-amber-700">{L('Μη αποθηκευμένες αλλαγές', 'Unsaved changes')}</p> : null}
                    </div>
                    <button type="button" onClick={requestClose} aria-label={L('Κλείσιμο', 'Close')} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">✕</button>
                </div>
                <div className="relative border-b border-slate-200">
                    <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory px-3 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {editSections.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setSection(item.id)}
                                className={`inline-flex min-h-11 shrink-0 snap-start items-center rounded-full px-4 text-sm font-medium ${section === item.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                    <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent" aria-hidden="true" />
                </div>
                
                <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
                    <div className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
                    {section === 'basics' ? (
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
                                        <span className="inline-flex min-h-11 items-center px-4 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
                                            {L("Επιλογή αρχείου", "Choose file")}
                                        </span>
                                    </label>
                                    <p className="text-xs text-slate-500 mt-1">{L("PNG, JPG ή GIF έως 5MB", "PNG, JPG or GIF up to 5MB")}</p>
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
                                label={L("Κατηγορίες *", "Categories *")}
                                description={L("Επίλεξε μία ή περισσότερες κατηγορίες", "Choose one or more categories")}
                                emptyFallback="Lifestyle"
                                compact
                            />
                            <div>
                                <label className="block text-xs font-semibold text-slate-900 mb-1">{L("Φύλο", "Gender")}</label>
                                <select value={gender} onChange={e => setGender(normalizeGender(e.target.value))} className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900">
                                    <option value="Female">{L("Γυναίκα", "Woman")}</option>
                                    <option value="Male">{L("Άνδρας", "Man")}</option>
                                    <option value="AI">{L("AI (τεχνητή νοημοσύνη)", "AI (artificial intelligence)")}</option>
                                </select>
                            </div>
                        </div>
                        <div className="mt-3">
                            <label className="block text-xs font-semibold text-slate-900 mb-1">{L("Βιογραφικό", "Biography")}</label>
                            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={2} className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-slate-900" />
                        </div>
                    </div>
                    ) : null}

                    {section === 'packages' ? (
                    <ServicePackagesEditor
                        lang={lang}
                        packages={servicePackages}
                        extras={serviceExtras}
                        onChange={setServicePackages}
                        onExtrasChange={setServiceExtras}
                    />
                    ) : null}

                    {section === 'basics' ? (
                    <div>
                            <div className="mt-2">
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
                                                        {lang === 'en' ? langItem.en : langItem.el}
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {section === 'platforms' ? (
                    <>
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 mb-3 uppercase">{L("Κοινωνικά δίκτυα", "Social accounts")}</h3>
                        <div className="space-y-2">
                            {accounts.map((acc, i) => (
                                <div key={i} className="flex gap-3 items-start p-3 border border-slate-200 rounded-lg">
                                    <select value={acc.platform} onChange={e => handleAccountChange(i, 'platform', e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900">
                                        {platforms.map(p => <option key={p}>{p}</option>)}
                                    </select>
                                    <input type="text" placeholder={L("Όνομα χρήστη", "Username")} value={acc.username} onChange={e => handleAccountChange(i, 'username', e.target.value)} className="min-h-11 flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900" />
                                    <input type="text" placeholder={L("Ακόλουθοι", "Followers")} value={acc.followers} onChange={e => handleAccountChange(i, 'followers', e.target.value)} className="min-h-11 w-32 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900" />
                                    {accounts.length > 1 && (
                                        <button type="button" onClick={() => removeAccount(i)} aria-label={L("Αφαίρεση", "Remove")} className="inline-flex min-h-11 min-w-11 items-center justify-center text-red-600 hover:bg-red-50 rounded-lg">✕</button>
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
                    </>
                    ) : null}

                    {section === 'portfolio' ? (
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 mb-3 uppercase">{L("Σύνδεσμοι βίντεο και φωτογραφίες", "Video links and photos")}</h3>
                        <p className="text-xs text-slate-600 mb-2">{L('Μπορείς να προσθέσεις συνδέσμους από TikTok, Reels ή YouTube, ή φωτογραφίες από δουλειές σου.', 'You can add TikTok, Reels or YouTube links, or photos of your work.')}</p>
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

                    ) : null}
                    </div>

                    <div className="sticky bottom-0 z-10 border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
                        <p className="mb-2 text-xs text-amber-800">
                            {L('Μετά την αποθήκευση το προφίλ μπαίνει σε εκκρεμότητα μέχρι τον νέο έλεγχο.', 'After saving, the profile stays pending until it is reviewed again.')}
                        </p>
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-xs font-medium text-slate-500">
                                {unsaved ? L('Μη αποθηκευμένες αλλαγές', 'Unsaved changes') : L('Όλα αποθηκευμένα', 'All changes saved')}
                            </p>
                            <div className="flex gap-2">
                                <button type="button" onClick={requestClose} className="inline-flex min-h-11 items-center px-4 text-slate-700 hover:bg-slate-100 rounded-lg font-medium transition-colors">{L("Ακύρωση", "Cancel")}</button>
                                <button type="submit" disabled={loading || !unsaved || videosChecking || videosNotPlayable} className="inline-flex min-h-11 items-center px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium disabled:opacity-50 transition-colors">
                                    {loading ? L('Αποθήκευση...', 'Saving...') : L('Αποθήκευση', 'Save')}
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </div>
        </>
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
    const [editSection, setEditSection] = useState<EditSection>('basics');
    const [availabilitySaving, setAvailabilitySaving] = useState(false);
    const [availabilityError, setAvailabilityError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<CreatorTab>('overview');
    const activeTabRef = useRef(activeTab);
    activeTabRef.current = activeTab;
    const searchParams = useSearchParams();
    const router = useRouter();
    const tabsNavRef = useRef<HTMLElement | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const { toasts, push: pushToast, dismiss: dismissToast } = useToasts();
    const notify = (message: string, tone: 'success' | 'error' | 'info' = 'info') => pushToast(message, tone);
    const [rejectProposalId, setRejectProposalId] = useState<number | null>(null);
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
            'Pending means you cannot yet view or apply to campaigns. The other sections stay available. The team usually reviews within 1–2 business days.',
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
          offersTitle: 'Offers from brands',
          offersEmpty: 'No offers yet.',
          announcementsTitle: 'Announcements',
          announcementsLoading: 'Loading...',
          announcementsError: 'Announcements could not be loaded.',
          announcementsTimeout: 'This took too long. Try again.',
          retry: 'Try again',
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
          socialChannels: 'Social accounts',
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
            'Η εκκρεμότητα σημαίνει ότι δεν μπορείς ακόμη να δεις ή να κάνεις αίτηση σε καμπάνιες. Οι υπόλοιπες ενότητες μένουν διαθέσιμες. Η ομάδα ελέγχει το προφίλ, συνήθως εντός 1–2 εργάσιμων ημερών.',
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
          offersTitle: 'Προσφορές από επιχειρήσεις',
          offersEmpty: 'Δεν υπάρχουν προσφορές ακόμα.',
          announcementsTitle: 'Ανακοινώσεις',
          announcementsLoading: 'Φόρτωση...',
          announcementsError: 'Οι ανακοινώσεις δεν φορτώθηκαν.',
          announcementsTimeout: 'Η φόρτωση άργησε. Δοκίμασε ξανά.',
          retry: 'Δοκίμασε ξανά',
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
          socialChannels: 'Κοινωνικά δίκτυα',
          docTitle: 'Πίνακας δημιουργού | Influo',
        };

    const T = (el: string, en: string) => (lang === 'en' ? en : el);

    useEffect(() => {
        if (typeof document === 'undefined') return;
        const titles = lang === 'en'
            ? {
                overview: 'Overview | Influo',
                profile: 'Profile | Influo',
                tools: 'Tools | Influo',
                campaigns: 'Campaigns | Influo',
                proposals: 'Offers | Influo',
                messages: 'Messages | Influo',
                analytics: 'Analytics | Influo',
                announcements: 'Announcements | Influo',
            }
            : {
                overview: 'Επισκόπηση | Influo',
                profile: 'Προφίλ | Influo',
                tools: 'Εργαλεία | Influo',
                campaigns: 'Καμπάνιες | Influo',
                proposals: 'Προσφορές | Influo',
                messages: 'Μηνύματα | Influo',
                analytics: 'Στατιστικά | Influo',
                announcements: 'Ανακοινώσεις | Influo',
            };
        document.title = titles[activeTab] || ui.docTitle;
    }, [lang, activeTab, ui.docTitle]);

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
            const msg = err instanceof Error ? err.message : T('Σφάλμα ενημέρωσης', 'Could not update');
            setAvailabilityError(msg);
        } finally {
            setAvailabilitySaving(false);
        }
    };

    useEffect(() => {
        const tab = searchParams?.get('tab');
        const allowed: CreatorTab[] = ['overview', 'profile', 'tools', 'messages', 'proposals', 'campaigns', 'analytics', 'announcements'];
        if (tab && allowed.includes(tab as CreatorTab)) {
            setActiveTab(tab as CreatorTab);
        } else if (!tab) {
            setActiveTab('overview');
        }
    }, [searchParams]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (window.matchMedia('(min-width: 768px)').matches) return;
        const nav = tabsNavRef.current;
        if (!nav) return;
        const btn = nav.querySelector<HTMLElement>(`[data-creator-tab="${activeTab}"]`);
        btn?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
    }, [activeTab]);

    const openCreatorTab = (tab: CreatorTab) => {
        setMenuOpen(false);
        setActiveTab(tab);
        const url = tab === 'overview' ? '/dashboard' : `/dashboard?tab=${tab}`;
        if (typeof window !== 'undefined') {
            window.history.replaceState({ ...(window.history.state || {}), as: url, url }, '', url);
        }
        router.replace(url, { scroll: false });
    };

    const openEdit = (section: EditSection) => {
        setEditSection(section);
        setMenuOpen(false);
        setShowEditModal(true);
    };

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
    const [proposalsLoading, setProposalsLoading] = useState(true);
    const [proposalsError, setProposalsError] = useState<null | 'timeout' | 'error'>(null);
    const [unseenProposalCount, setUnseenProposalCount] = useState(0);
    const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
    const [announcementsList, setAnnouncementsList] = useState<Array<{ id: string; title: string; body: string; created_at: string; read: boolean; read_at: string | null }>>([]);
    const [unreadAnnouncementsCount, setUnreadAnnouncementsCount] = useState(0);
    const [announcementsLoading, setAnnouncementsLoading] = useState(false);
    const [announcementsError, setAnnouncementsError] = useState<null | 'timeout' | 'error'>(null);
    const [announcementsAttempt, setAnnouncementsAttempt] = useState(0);
    const [profileViews, setProfileViews] = useState<number | null>(null);
    const [profileViewsState, setProfileViewsState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [profileViewsAttempt, setProfileViewsAttempt] = useState(0);
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
                throw new Error(T('Δεν βρέθηκε ενεργή σύνδεση. Συνδέσου ξανά.', 'No active session. Sign in again.'));
            }

            const res = await fetch('/api/account/delete', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || T('Η διαγραφή απέτυχε. Δοκίμασε ξανά.', 'Deletion failed. Try again.'));
            }

            await logoutEverywhere('/?account_deleted=1');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : T('Η διαγραφή απέτυχε. Δοκίμασε ξανά.', 'Deletion failed. Try again.');
            setDeleteAccountError(message);
        } finally {
            setDeletingAccount(false);
        }
    };

    const reloadProposals = async (quiet = false) => {
        if (!quiet) setProposalsLoading(true);
        try {
            const response = await withTimeout(sessionFetch('/api/proposals?role=influencer', { cache: 'no-store' }), 20000);
            const result = await response.json().catch(() => ({}));
            if (!response.ok || !Array.isArray(result.proposals)) {
                throw new Error(typeof result.error === 'string' ? result.error : 'proposals');
            }
            const rows = result.proposals as Proposal[];
            setProposals(rows);
            setProposalsLoaded(true);
            setProposalsError(null);
            return rows;
        } catch (error) {
            console.error('Error loading proposals:', error);
            setProposalsError(isTimeoutError(error) ? 'timeout' : 'error');
            return null;
        } finally {
            if (!quiet) setProposalsLoading(false);
        }
    };

    // Load proposals and counts
    useEffect(() => {
        const loadProposals = async () => {
            await reloadProposals(false);
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
                .select('id', { count: 'exact', head: true })
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
        if ((activeTab !== 'announcements' && activeTab !== 'overview') || !profile?.id) return;
        let cancelled = false;
        const markRead = activeTab === 'announcements';
        void (async () => {
            setAnnouncementsLoading(true);
            setAnnouncementsError(null);
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.access_token || cancelled) {
                    if (!cancelled) setAnnouncementsError('error');
                    return;
                }
                const res = await withTimeout(fetch('/api/announcements', {
                    headers: { Authorization: `Bearer ${session.access_token}` },
                }), 20000);
                const data = await res.json();
                if (cancelled) return;
                if (!res.ok || !Array.isArray(data.data)) {
                    setAnnouncementsError('error');
                    return;
                }
                const rows = data.data as typeof announcementsList;
                if (markRead) {
                    const unread = rows.filter((row) => !row.read);
                    const now = new Date().toISOString();
                    setAnnouncementsList(rows.map((row) => (row.read ? row : { ...row, read: true, read_at: row.read_at || now })));
                    setUnreadAnnouncementsCount(0);
                    await Promise.all(unread.map((row) => fetch(`/api/announcements/${row.id}/read`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${session.access_token}` },
                    })));
                } else {
                    setAnnouncementsList(rows);
                }
            } catch (e) {
                console.error('Error loading announcements:', e);
                if (!cancelled) setAnnouncementsError(isTimeoutError(e) ? 'timeout' : 'error');
            } finally {
                if (!cancelled) setAnnouncementsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [activeTab, profile?.id, announcementsAttempt]);

    useEffect(() => {
        if (!profile?.id) return;
        let cancelled = false;
        void (async () => {
            setProfileViewsState('loading');
            try {
                const res = await withTimeout(
                    fetch(`/api/analytics/stats?influencerId=${encodeURIComponent(String(profile.id))}&metric=profile_views`),
                    20000
                );
                const data = await res.json().catch(() => ({}));
                if (!res.ok || typeof data.profileViews !== 'number') throw new Error('views');
                if (!cancelled) {
                    setProfileViews(data.profileViews);
                    setProfileViewsState('ready');
                }
            } catch (error) {
                console.error('Error loading profile views:', error);
                if (!cancelled) setProfileViewsState('error');
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [profile?.id, profileViewsAttempt]);

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
                await reloadProposals(true);

                setShowCounterProposalModal(false);
                setSelectedProposal(null);
                setCounterBudget('');
                setCounterMessage('');
                notify(T('Η αντιπρόταση στάλθηκε. Η επιχείρηση θα λάβει email με τις λεπτομέρειες.', 'The counter-offer was sent. The brand will get an email with the details.'), 'success');
            } else {
                throw new Error(result.error || T('Σφάλμα αποστολής αντιπρότασης', 'Could not send the counter-offer'));
            }
        } catch (err: any) {
            console.error('Error submitting counter-proposal:', err);
            notify(T('Σφάλμα: ', 'Error: ') + err.message, 'error');
        } finally {
            setSavingCounterProposal(false);
        }
    };

    const handleAcceptAgreement = async () => {
        if (!selectedProposal || !agreementAccepted) {
            notify(T('Διάβασε και αποδέξου τους όρους χρήσης.', 'Read and accept the terms first.'), 'error');
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
                const data = await reloadProposals(true);
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
                notify(T('Η συμφωνία αποδεχτήθηκε. Η επιχείρηση θα προστεθεί στις συνεργασίες σου όταν αποδεχτεί και εκείνη.', 'Agreement accepted. The brand will be added to your collaborations once they accept too.'), 'success');
            } else {
                throw new Error(result.error || T('Σφάλμα αποδοχής συμφωνίας', 'Could not accept the agreement'));
            }
        } catch (err: any) {
            console.error('Error accepting agreement:', err);
            notify(T('Σφάλμα: ', 'Error: ') + err.message, 'error');
        } finally {
            setSavingAgreement(false);
        }
    };

    const confirmRejectProposal = async () => {
        const id = rejectProposalId;
        setRejectProposalId(null);
        if (id == null) return;
        try {
            const response = await sessionFetch('/api/proposals/reject', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ proposalId: id }),
            });
            const result = await response.json();
            if (result.success) {
                await reloadProposals(true);
                notify(T('Η προσφορά απορρίφθηκε. Η επιχείρηση θα ειδοποιηθεί.', 'The offer was rejected. The brand will be notified.'), 'success');
            } else {
                notify(T('Σφάλμα: ', 'Error: ') + (result.error || T('Αποτυχία απόρριψης', 'Failed to reject')), 'error');
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : T('Αποτυχία απόρριψης', 'Failed to reject');
            notify(T('Σφάλμα: ', 'Error: ') + message, 'error');
        }
    };

    const activeCollaborations = proposals.filter((item) => item.status === 'accepted' || item.status === 'completed').length;
    const ratingValue = typeof profile.avg_rating === 'number' && profile.avg_rating > 0 ? profile.avg_rating : null;
    const profileIncomplete = !(profile.bio || '').trim() || !profile.avatar_url || !(profile.accounts || []).some((account) => String(account.username || '').trim());
    const missingPackages = packagesForSave(profile.service_packages || []).length < 1;
    const missingPortfolio = !(profile.videos || []).some((url) => String(url || '').trim());
    const waitingAgreements = proposals.filter((item) => (item.status === 'accepted' || item.status === 'completed') && !item.influencer_agreement_accepted).length;
    const overviewSteps = (
        [
            !profile.approved
                ? { id: 'approval', text: T('Ο λογαριασμός περιμένει έγκριση. Μπορείς να συμπληρώσεις το προφίλ στο μεταξύ.', 'Your account is waiting for approval. You can complete your profile in the meantime.'), tab: 'profile' as const, cta: T('Προφίλ', 'Profile') }
                : null,
            profileIncomplete
                ? { id: 'profile', text: T('Συμπλήρωσε φωτογραφία, βιογραφικό και τουλάχιστον ένα κανάλι.', 'Add a photo, a biography, and at least one channel.'), tab: 'profile' as const, cta: T('Συμπλήρωση', 'Complete'), section: 'basics' as const }
                : null,
            missingPackages
                ? { id: 'packages', text: T('Πρόσθεσε πακέτα με τιμή για να σε βρίσκουν οι επιχειρήσεις.', 'Add priced packages so brands can find you.'), tab: 'profile' as const, cta: T('Πακέτα', 'Packages'), section: 'packages' as const }
                : null,
            missingPortfolio
                ? { id: 'portfolio', text: T('Πρόσθεσε δείγματα δουλειάς στο portfolio.', 'Add work samples to your portfolio.'), tab: 'profile' as const, cta: T('Portfolio', 'Portfolio'), section: 'portfolio' as const }
                : null,
            waitingAgreements > 0
                ? { id: 'agreements', text: T('Υπάρχουν συμφωνίες που δεν έχεις αποδεχτεί ακόμη.', 'Some agreements are still waiting for you.'), tab: 'proposals' as const, cta: T('Συμφωνίες', 'Agreements') }
                : null,
            unreadMessagesCount > 0
                ? { id: 'messages', text: T(`Έχεις ${unreadMessagesCount} αδιάβαστα μηνύματα.`, `You have ${unreadMessagesCount} unread messages.`), tab: 'messages' as const, cta: T('Άνοιγμα', 'Open') }
                : null,
        ] as Array<{ id: string; text: string; tab: CreatorTab; cta: string; section?: EditSection } | null>
    ).filter((step): step is { id: string; text: string; tab: CreatorTab; cta: string; section?: EditSection } => step !== null).slice(0, 4);

    const announcementsErrorText = announcementsError === 'timeout' ? ui.announcementsTimeout : ui.announcementsError;
    const proposalsErrorText = proposalsError === 'timeout'
        ? T('Η φόρτωση άργησε. Δοκίμασε ξανά.', 'This took too long. Try again.')
        : T('Οι προσφορές δεν φορτώθηκαν.', 'Offers could not be loaded.');

    return (
        <div className="min-h-screen bg-slate-50">
            <ToastViewport toasts={toasts} onDismiss={dismissToast} dismissLabel={T('Κλείσιμο', 'Dismiss')} />
            <ConfirmDialog
                open={rejectProposalId != null}
                title={T('Απόρριψη προσφοράς;', 'Reject this offer?')}
                body={T('Η επιχείρηση θα ειδοποιηθεί.', 'The brand will be notified.')}
                confirmLabel={T('Απόρριψη', 'Reject')}
                cancelLabel={T('Ακύρωση', 'Cancel')}
                onConfirm={() => { void confirmRejectProposal(); }}
                onCancel={() => setRejectProposalId(null)}
            />
            <PushNotificationPrompt userType="influencer" userIdentifier={profile?.id || ''} lang={lang} />
            <div className="bg-white border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-4 sm:gap-6 min-w-0">
                            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0">
                                <Image src="/logo.svg" alt="Influo" width={120} height={48} className="h-6 sm:h-8 w-auto" />
                            </Link>
                            <div className="min-w-0">
                                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">{T('Πίνακας δημιουργού', 'Creator dashboard')}</h1>
                                <p className="text-sm text-slate-500 truncate">{ui.welcome} {displayNameForLang(profile.display_name, lang)}</p>
                            </div>
                        </div>
                        <div className="hidden md:flex flex-wrap items-center gap-2">
                            <Link href="/" className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                                <Home className="w-4 h-4" aria-hidden="true" />
                                {T('Αρχική', 'Home')}
                            </Link>
                            <Link href="/help-desk" className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-purple-200 px-3 text-sm font-medium text-purple-700 hover:bg-purple-50">
                                <LifeBuoy className="w-4 h-4" aria-hidden="true" />
                                {T('Βοήθεια', 'Help')}
                            </Link>
                            <button type="button" onClick={() => openEdit('basics')} className="inline-flex min-h-11 items-center rounded-lg border border-blue-200 px-3 text-sm font-medium text-blue-700 hover:bg-blue-50">
                                {ui.editProfile}
                            </button>
                            <button type="button" onClick={() => switchLang(lang === 'el' ? 'en' : 'el')} className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-blue-700 hover:bg-blue-50">
                                {lang === 'el' ? 'EN' : 'ΕΛ'}
                            </button>
                            <button type="button" onClick={() => logoutEverywhere('/login')} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                                <LogOut className="w-4 h-4" aria-hidden="true" />
                                {ui.logout}
                            </button>
                        </div>
                        <button
                            type="button"
                            className="md:hidden inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-700"
                            aria-label={T('Μενού', 'Menu')}
                            aria-expanded={menuOpen}
                            onClick={() => setMenuOpen((open) => !open)}
                        >
                            {menuOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
                        </button>
                    </div>
                    {menuOpen ? (
                        <div className="md:hidden mt-3 flex flex-col gap-1 border-t border-slate-100 pt-3">
                            <Link href="/" className="min-h-11 inline-flex items-center gap-2 rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                                <Home className="w-4 h-4" aria-hidden="true" />
                                {T('Αρχική', 'Home')}
                            </Link>
                            <Link href="/help-desk" className="min-h-11 inline-flex items-center gap-2 rounded-lg px-3 text-sm font-medium text-purple-700 hover:bg-purple-50">
                                <LifeBuoy className="w-4 h-4" aria-hidden="true" />
                                {T('Βοήθεια', 'Help')}
                            </Link>
                            <button type="button" onClick={() => openEdit('basics')} className="min-h-11 text-left rounded-lg px-3 text-sm font-medium text-blue-700 hover:bg-blue-50">
                                {ui.editProfile}
                            </button>
                            <button type="button" onClick={() => switchLang(lang === 'el' ? 'en' : 'el')} className="min-h-11 text-left rounded-lg px-3 text-sm font-medium text-blue-700 hover:bg-blue-50">
                                {lang === 'el' ? 'English' : 'Ελληνικά'}
                            </button>
                            <button type="button" onClick={() => logoutEverywhere('/login')} className="min-h-11 inline-flex items-center gap-2 rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                                <LogOut className="w-4 h-4" aria-hidden="true" />
                                {ui.logout}
                            </button>
                        </div>
                    ) : null}
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
                <div className={`mb-6 rounded-xl border px-4 py-3 text-sm ${profile.approved ? 'border-emerald-200 bg-emerald-50 text-emerald-950' : 'border-amber-200 bg-amber-50 text-amber-950'}`}>
                    <p className="font-semibold">{profile.approved ? T('Ο λογαριασμός είναι εγκεκριμένος', 'Your account is approved') : T('Έγκριση σε αναμονή', 'Approval pending')}</p>
                    <p className="mt-1 leading-relaxed">{profile.approved ? T('Το προφίλ σου είναι ορατό στις επιχειρήσεις και μπορείς να κάνεις αιτήσεις σε καμπάνιες.', 'Your profile is visible to brands and you can apply to campaigns.') : ui.pendingHint}</p>
                </div>

                <div className="relative bg-white rounded-xl border border-slate-200 mb-6 overflow-hidden">
                    <nav
                        ref={tabsNavRef}
                        role="tablist"
                        aria-label={T('Ενότητες πίνακα', 'Dashboard sections')}
                        className="flex gap-2 overflow-x-auto snap-x snap-mandatory px-3 py-2 md:gap-0 md:overflow-visible md:snap-none md:px-0 md:py-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    >
                        {(
                            [
                                { id: 'overview' as const, label: T('Επισκόπηση', 'Overview'), icon: LayoutDashboard, count: 0 },
                                { id: 'profile' as const, label: ui.tabProfile, icon: User, count: 0 },
                                { id: 'campaigns' as const, label: ui.tabCampaigns, icon: Megaphone, count: unseenCampaignCount + changesRequestedCount },
                                { id: 'proposals' as const, label: ui.tabOffers, icon: FileText, count: unseenProposalCount },
                                { id: 'messages' as const, label: ui.tabMessages, icon: MessageSquare, count: unreadMessagesCount },
                                { id: 'analytics' as const, label: ui.tabStats, icon: BarChart3, count: 0 },
                                { id: 'tools' as const, label: ui.tabTools, icon: Wrench, count: 0 },
                                { id: 'announcements' as const, label: ui.tabAnnouncements, icon: Bell, count: unreadAnnouncementsCount },
                            ]
                        ).map((tab) => {
                            const selected = activeTab === tab.id;
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    role="tab"
                                    data-creator-tab={tab.id}
                                    aria-selected={selected}
                                    onClick={() => openCreatorTab(tab.id)}
                                    className={`inline-flex min-h-11 shrink-0 snap-start items-center gap-2 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors md:min-h-0 md:rounded-none md:px-5 md:py-4 md:text-base md:border-b-2 ${
                                        selected
                                            ? 'bg-blue-600 text-white md:bg-transparent md:text-blue-600 md:border-blue-600'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 md:bg-transparent md:text-slate-500 md:hover:text-slate-700 md:border-transparent'
                                    }`}
                                >
                                    <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                                    {tab.label}
                                    {tab.count > 0 ? (
                                        <span className={`text-xs font-bold rounded-full min-w-[18px] h-[18px] inline-flex items-center justify-center px-1 ${selected ? 'bg-white text-blue-700 md:bg-red-500 md:text-white' : 'bg-red-500 text-white'}`}>
                                            {tabBadgeText(tab.count)}
                                        </span>
                                    ) : null}
                                </button>
                            );
                        })}
                    </nav>
                    <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white to-transparent md:hidden" aria-hidden="true" />
                </div>

                {activeTab === 'overview' ? (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <div className="min-h-[88px] rounded-xl border border-slate-200 bg-white p-4">
                                <p className="text-2xl font-semibold text-slate-900 tabular-nums">
                                    {profileViewsState === 'loading' ? <span className="inline-block h-7 w-12 rounded bg-slate-100 animate-pulse" /> : profileViewsState === 'ready' ? profileViews : '—'}
                                </p>
                                <p className="mt-1 text-sm text-slate-600">{T('Προβολές προφίλ', 'Profile views')}</p>
                                {profileViewsState === 'error' ? (
                                    <button type="button" onClick={() => setProfileViewsAttempt((n) => n + 1)} className="mt-2 min-h-11 text-sm font-medium text-blue-700">
                                        {ui.retry}
                                    </button>
                                ) : null}
                            </div>
                            <button type="button" onClick={() => openCreatorTab('proposals')} className="min-h-[88px] rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-slate-300">
                                <p className="text-2xl font-semibold text-slate-900 tabular-nums">{(proposalsLoading || proposalsError) && proposals.length === 0 ? '—' : proposals.length}</p>
                                <p className="mt-1 text-sm text-slate-600">{T('Προσφορές', 'Offers')}</p>
                            </button>
                            <button type="button" onClick={() => openCreatorTab('proposals')} className="min-h-[88px] rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-slate-300">
                                <p className="text-2xl font-semibold text-slate-900 tabular-nums">{(proposalsLoading || proposalsError) && proposals.length === 0 ? '—' : activeCollaborations}</p>
                                <p className="mt-1 text-sm text-slate-600">{T('Ενεργές συνεργασίες', 'Active collaborations')}</p>
                            </button>
                            <div className="min-h-[88px] rounded-xl border border-slate-200 bg-white p-4">
                                <p className="text-2xl font-semibold text-slate-900 tabular-nums">{ratingValue == null ? '—' : ratingValue.toFixed(1)}</p>
                                <p className="mt-1 text-sm text-slate-600">{T('Μέση αξιολόγηση', 'Average rating')}</p>
                            </div>
                        </div>
                        <div className="grid gap-6 lg:grid-cols-2">
                            <section className="rounded-xl border border-slate-200 bg-white p-5">
                                <h2 className="text-lg font-semibold text-slate-900">{T('Επόμενα βήματα', 'Next steps')}</h2>
                                <ul className="mt-4 space-y-3">
                                    {overviewSteps.length === 0 ? (
                                        <li className="text-sm text-slate-600">{T('Είσαι ενήμερος. Δεν εκκρεμεί κάποιο βήμα.', 'You are up to date. Nothing is waiting.')}</li>
                                    ) : overviewSteps.map((step) => (
                                        <li key={step.id} className="flex items-start justify-between gap-3">
                                            <p className="text-sm text-slate-700 leading-relaxed">{step.text}</p>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (step.section) openEdit(step.section);
                                                    else openCreatorTab(step.tab);
                                                }}
                                                className="shrink-0 min-h-11 px-3 text-sm font-medium text-blue-700 hover:bg-blue-50 rounded-lg"
                                            >
                                                {step.cta}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                            <section className="rounded-xl border border-slate-200 bg-white p-5">
                                <div className="flex items-center justify-between gap-3">
                                    <h2 className="text-lg font-semibold text-slate-900">{ui.announcementsTitle}</h2>
                                    <button type="button" onClick={() => openCreatorTab('announcements')} className="min-h-11 text-sm font-medium text-blue-700">
                                        {T('Όλες', 'All')}
                                    </button>
                                </div>
                                {announcementsLoading && announcementsList.length === 0 ? (
                                    <div className="mt-4 h-24 rounded-lg bg-slate-100 animate-pulse" />
                                ) : announcementsError && announcementsList.length === 0 ? (
                                    <div className="mt-4 text-sm text-slate-600">
                                        <p>{announcementsErrorText}</p>
                                        <button type="button" onClick={() => setAnnouncementsAttempt((n) => n + 1)} className="mt-3 min-h-11 px-4 rounded-lg bg-slate-900 text-white text-sm font-medium">
                                            {ui.retry}
                                        </button>
                                    </div>
                                ) : announcementsList.length === 0 ? (
                                    <p className="mt-4 text-sm text-slate-600">{ui.announcementsEmpty}</p>
                                ) : (
                                    <ul className="mt-4 space-y-3">
                                        {announcementsList.slice(0, 3).map((item) => (
                                            <li key={item.id} className="border-b border-slate-100 pb-3 last:border-0">
                                                <p className="text-sm font-medium text-slate-900">{item.title}</p>
                                                <p className="text-xs text-slate-500 mt-1">{formatDate(item.created_at, lang)} {formatTime(item.created_at, lang)}</p>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>
                        </div>
                    </div>
                ) : (
                <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
                        {activeTab === 'tools' ? (
                            <InfluencerToolsPanel
                                approved={!!profile.approved}
                                displayName={profile.display_name}
                                lang={lang}
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
                                
                                {proposalsLoading && proposals.length === 0 ? (
                                    <div className="space-y-3" aria-busy="true">
                                        <div className="h-28 rounded-xl bg-slate-100 animate-pulse" />
                                        <div className="h-28 rounded-xl bg-slate-100 animate-pulse" />
                                    </div>
                                ) : proposalsError && proposals.length === 0 ? (
                                    <div className="rounded-xl border border-slate-200 p-6 text-center">
                                        <p className="text-sm text-slate-600">{proposalsErrorText}</p>
                                        <button type="button" onClick={() => void reloadProposals(false)} className="mt-4 inline-flex min-h-11 items-center px-5 rounded-xl bg-slate-900 text-white text-sm font-medium">
                                            {ui.retry}
                                        </button>
                                    </div>
                                ) : proposals.length === 0 ? (
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
                                                                <strong>{T("Υπηρεσία:", "Service:")}</strong> {prop.service_type} • <strong>{T("Προϋπολογισμός:", "Budget:")}</strong> {formatEuroAmount(prop.budget, lang)}
                                                            </p>
                                                            {prop.message && (
                                                                <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg mt-2">{prop.message}</p>
                                                            )}
                                                            {prop.counter_proposal_budget && prop.counter_proposal_status === 'pending' && (
                                                                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                                                    <p className="text-sm font-semibold text-blue-900 mb-1">💰 {T("Αντιπρόταση στάλθηκε", "Counter-offer sent")}</p>
                                                                    <p className="text-xs text-blue-700">{T("Νέα προτεινόμενη τιμή:", "New proposed price:")} <strong>{formatEuroAmount(prop.counter_proposal_budget, lang)}</strong></p>
                                                                    {prop.counter_proposal_message && (
                                                                        <p className="text-xs text-blue-600 mt-1 italic">"{prop.counter_proposal_message}"</p>
                                                                    )}
                                                                    <p className="text-xs text-blue-500 mt-2">⏳ {T("Αναμένεται απάντηση από το brand", "Awaiting reply from the brand")}</p>
                                                                </div>
                                                            )}
                                                            <p className="text-xs text-slate-500 mt-2">
                                                                {formatDate(prop.created_at, lang)} {formatTime(prop.created_at, lang)}
                                                            </p>
                                                        </div>
                                                        <div className="ml-4 flex flex-col gap-2">
                                                            {needsAgreement && (
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedProposal(prop);
                                                                        setShowAgreementModal(true);
                                                                    }}
                                                                    className="inline-flex min-h-11 items-center px-4 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg transition-all text-sm whitespace-nowrap"
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
                                                                                    const data = await reloadProposals(true);
                                                                                    const acceptedProp = data?.find((p: Proposal) => p.id === prop.id);
                                                                                    if (acceptedProp && acceptedProp.status === 'accepted') {
                                                                                        setSelectedProposal(acceptedProp);
                                                                                        setShowAgreementModal(true);
                                                                                    }
                                                                                } else {
                                                                                    notify(T("Σφάλμα: ", "Error: ") + (result.error || T("Αποτυχία αποδοχής προσφοράς", "Failed to accept offer")), 'error');
                                                                                }
                                                                            } catch (error: any) {
                                                                                console.error('Error accepting proposal:', error);
                                                                                notify(T("Σφάλμα: ", "Error: ") + error.message, 'error');
                                                                            }
                                                                        }}
                                                                        className="inline-flex min-h-11 items-center px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-all text-sm whitespace-nowrap"
                                                                    >
                                                                        ✅ {T("Αποδοχή", "Accept")}
                                                                    </button>
                                                                    <button
                                                                        onClick={async () => {
                                                                            setRejectProposalId(prop.id);
                                                                        }}
                                                                        className="inline-flex min-h-11 items-center px-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-all text-sm whitespace-nowrap"
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
                                                                        className="inline-flex min-h-11 items-center px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all text-sm whitespace-nowrap"
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
                                                                            openCreatorTab('messages');
                                                                        }}
                                                                        className="inline-flex min-h-11 items-center px-4 bg-slate-600 hover:bg-slate-700 text-white font-semibold rounded-lg transition-all text-sm whitespace-nowrap"
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
                                    <div className="space-y-3" aria-busy="true">
                                        <div className="h-20 rounded-lg bg-slate-100 animate-pulse" />
                                        <div className="h-20 rounded-lg bg-slate-100 animate-pulse" />
                                    </div>
                                ) : announcementsError ? (
                                    <div className="rounded-xl border border-slate-200 p-6 text-center">
                                        <p className="text-sm text-slate-600">{announcementsErrorText}</p>
                                        <button type="button" onClick={() => setAnnouncementsAttempt((n) => n + 1)} className="mt-4 inline-flex min-h-11 items-center px-5 rounded-xl bg-slate-900 text-white text-sm font-medium">
                                            {ui.retry}
                                        </button>
                                    </div>
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
                                                            {formatDate(a.created_at, lang)} {formatTime(a.created_at, lang)}
                                                            {a.read && a.read_at && (
                                                                <span className="ml-2">· {ui.readAt} {formatDate(a.read_at, lang)} {formatTime(a.read_at, lang)}</span>
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
                                    <button onClick={() => openEdit('basics')} className="inline-flex min-h-11 items-center px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium transition-colors">
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
                                            onClick={() => openEdit('portfolio')}
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
                            <span className="text-lg font-semibold text-slate-900">{(() => {
                                const derived = deriveMinRate(profile.service_packages, profile.rate_card);
                                if (derived) return formatEuro(Number(derived), lang === "en" ? "en" : "el");
                                return profile.min_rate ? formatEuroAmount(profile.min_rate, lang) : "—";
                            })()}</span>
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
                                            <div className="text-sm text-slate-500">{acc.followers} {T("ακόλουθοι", "followers")}</div>
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
                )}
            </div>
            
            {showEditModal && (
                <EditModal 
                    user={profile}
                    onClose={() => setShowEditModal(false)}
                    onSave={handleProfileSave}
                    lang={lang}
                    notify={notify}
                    initialSection={editSection}
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
                            <h2 className="text-xl font-bold text-slate-900">{T('Συμφωνία συνεργασίας', 'Collaboration agreement')}</h2>
                            <button 
                                type="button"
                                onClick={() => {
                                    setShowAgreementModal(false);
                                    setSelectedProposal(null);
                                    setAgreementAccepted(false);
                                }}
                                aria-label={T('Κλείσιμο', 'Close')}
                                className="inline-flex min-h-11 min-w-11 items-center justify-center text-slate-400 hover:text-slate-600 text-2xl"
                            >
                                ×
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-6">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <p className="text-sm text-blue-900 font-medium mb-2">
                                    {T('Συνεργασία με:', 'Collaboration with:')} <strong>{selectedProposal.brand_name}</strong>
                                </p>
                                <p className="text-sm text-blue-800">
                                    {T('Υπηρεσία:', 'Service:')} {selectedProposal.service_type} • {T('Προϋπολογισμός:', 'Budget:')} {formatEuroAmount(selectedProposal.budget, lang)}
                                </p>
                            </div>

                            {/* Benefits Section */}
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-5 space-y-3">
                                <h3 className="font-bold text-blue-900 text-lg flex items-center gap-2">
                                    ✨ {T('Γιατί να αποδεχτείς τη συμφωνία;', 'Why accept the agreement?')}
                                </h3>
                                <div className="grid md:grid-cols-2 gap-3">
                                    <div className="flex items-start gap-2">
                                        <span className="text-2xl">⭐</span>
                                        <div>
                                            <p className="font-semibold text-blue-900">{T('Αξιολογήσεις', 'Reviews')}</p>
                                            <p className="text-sm text-blue-700">{T('Μπορείς να λάβεις αξιολογήσεις από την επιχείρηση, που βελτιώνουν την αξιοπιστία σου.', 'You can receive reviews from the brand, which improve your credibility.')}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="text-2xl">📈</span>
                                        <div>
                                            <p className="font-semibold text-blue-900">{T('Μεγαλύτερη προβολή', 'More visibility')}</p>
                                            <p className="text-sm text-blue-700">{T('Η επιχείρηση εμφανίζεται στις συνεργασίες σου.', 'The brand appears in your collaborations.')}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="text-2xl">🎯</span>
                                        <div>
                                            <p className="font-semibold text-blue-900">{T('Πιο επαγγελματικό προφίλ', 'A more professional profile')}</p>
                                            <p className="text-sm text-blue-700">{T('Περισσότερες συνεργασίες κάνουν το προφίλ πιο αξιόπιστο.', 'More collaborations make the profile more trusted.')}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="text-2xl">💼</span>
                                        <div>
                                            <p className="font-semibold text-blue-900">{T('Περισσότερες ευκαιρίες', 'More opportunities')}</p>
                                            <p className="text-sm text-blue-700">{T('Το υλικό σου μεγαλώνει και προσελκύει περισσότερες επιχειρήσεις.', 'Your work samples grow and attract more brands.')}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-3 pt-3 border-t border-blue-200">
                                    <p className="text-sm font-medium text-blue-900">
                                        💡 <strong>{T('Συμβουλή:', 'Tip:')}</strong> {T('Οι δημιουργοί με πολλές αποδεκτές συνεργασίες εμφανίζονται πρώτοι στις αναζητήσεις.', 'Creators with many accepted collaborations appear first in search.')}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-bold text-slate-900">{T('Όροι και συμφωνία', 'Terms and agreement')}</h3>
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 max-h-64 overflow-y-auto text-sm text-slate-700 space-y-3">
                                    <p><strong>{T('1. Υποχρεώσεις δημιουργού:', '1. Creator obligations:')}</strong></p>
                                    <ul className="list-disc list-inside ml-2 space-y-1">
                                        <li>{T('Παροχή περιεχομένου σύμφωνα με τις προδιαγραφές', 'Deliver content that matches the brief')}</li>
                                        <li>{T('Σεβασμός στις προθεσμίες', 'Respect the deadlines')}</li>
                                        <li>{T('Επικοινωνία με την επιχείρηση για απορίες', 'Talk to the brand when something is unclear')}</li>
                                        <li>{T('Χρήση προϊόντων ή υπηρεσιών όπως συμφωνήθηκε', 'Use products or services as agreed')}</li>
                                    </ul>

                                    <p><strong>{T('2. Πληρωμή:', '2. Payment:')}</strong></p>
                                    <ul className="list-disc list-inside ml-2 space-y-1">
                                        <li>{T('Η πληρωμή ακολουθεί όσα λέει η προσφορά', 'Payment follows the offer')}</li>
                                        <li>{T('Η πληρωμή γίνεται μετά την ολοκλήρωση και την έγκριση του περιεχομένου', 'Payment happens after the content is finished and approved')}</li>
                                    </ul>

                                    <p><strong>{T('3. Δικαιώματα:', '3. Rights:')}</strong></p>
                                    <ul className="list-disc list-inside ml-2 space-y-1">
                                        <li>{T('Η επιχείρηση μπορεί να εγκρίνει ή να απορρίψει το περιεχόμενο', 'The brand can approve or reject the content')}</li>
                                        <li>{T('Η επιχείρηση μπορεί να χρησιμοποιήσει το περιεχόμενο για προώθηση', 'The brand can use the content for promotion')}</li>
                                    </ul>

                                    <p><strong>{T('4. Εμπιστευτικότητα:', '4. Confidentiality:')}</strong></p>
                                    <ul className="list-disc list-inside ml-2 space-y-1">
                                        <li>{T('Κρατάς εμπιστευτικά τα προσωπικά στοιχεία της επιχείρησης', 'You keep the brand’s private details confidential')}</li>
                                    </ul>

                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-4">
                                        <p className="text-xs font-medium text-amber-900">
                                            ⚠️ <strong>{T('Σημαντικό:', 'Important:')}</strong> {T('Με την αποδοχή αυτής της συμφωνίας:', 'By accepting this agreement:')}
                                        </p>
                                        <ul className="text-xs text-amber-800 mt-2 space-y-1 list-disc list-inside ml-2">
                                            <li>{T('Συμφωνείς με τους παραπάνω όρους', 'You agree to the terms above')}</li>
                                            <li>{T('Το όνομα της επιχείρησης προστίθεται δημόσια στις συνεργασίες σου', 'The brand name is added publicly to your collaborations')}</li>
                                            <li>{T('Η επιχείρηση μπορεί να σε αξιολογήσει μετά την ολοκλήρωση', 'The brand can review you after the work is done')}</li>
                                            <li>{T('Η συνεργασία εμφανίζεται στο προφίλ σου', 'The collaboration appears on your profile')}</li>
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
                                        <strong>{T('Αποδέχομαι τους όρους', 'I accept the terms')}</strong> {T('και συμφωνώ να προστεθεί η επιχείρηση', 'and I agree that')} <strong>{selectedProposal.brand_name}</strong> {T('στις συνεργασίες μου', 'is added to my collaborations')}
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
                                    className="inline-flex min-h-11 items-center px-4 text-slate-700 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                                >
                                    {T('Ακύρωση', 'Cancel')}
                                </button>
                                <button
                                    onClick={handleAcceptAgreement}
                                    disabled={!agreementAccepted || savingAgreement}
                                    className="inline-flex min-h-11 items-center px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {savingAgreement ? T('Αποθήκευση...', 'Saving...') : T('Αποδοχή συμφωνίας', 'Accept agreement')}
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
                            <h2 className="text-xl font-bold text-slate-900">{T('Υποβολή αντιπρότασης', 'Send a counter-offer')}</h2>
                            <button 
                                type="button"
                                onClick={() => {
                                    setShowCounterProposalModal(false);
                                    setSelectedProposal(null);
                                    setCounterBudget('');
                                    setCounterMessage('');
                                }}
                                aria-label={T('Κλείσιμο', 'Close')}
                                className="inline-flex min-h-11 min-w-11 items-center justify-center text-slate-400 hover:text-slate-600 text-2xl"
                            >
                                ×
                            </button>
                        </div>
                        
                        <form onSubmit={handleSubmitCounterProposal} className="p-6 space-y-6">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <p className="text-sm text-blue-900 font-medium mb-2">
                                    {T('Αυτή τη στιγμή η επιχείρηση', 'Right now')} <strong>{selectedProposal.brand_name}</strong> {T('προτείνει', 'offers')}
                                </p>
                                <p className="text-sm text-blue-800">
                                    <strong>{selectedProposal.service_type}</strong> • <strong>{formatEuroAmount(selectedProposal.budget, lang)}</strong>
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-900 mb-2">
                                    {T('Προτεινόμενη τιμή (€) *', 'Proposed price (€) *')}
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
                                    {T('Γράψε την τιμή που θεωρείς δίκαιη για αυτή τη συνεργασία.', 'Enter the price you think is fair for this collaboration.')}
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-900 mb-2">
                                    {T('Μήνυμα (προαιρετικό)', 'Message (optional)')}
                                </label>
                                <textarea
                                    value={counterMessage}
                                    onChange={(e) => setCounterMessage(e.target.value)}
                                    placeholder={T('Εξήγησε γιατί η αντιπρόταση είναι δίκαιη...', 'Explain why the counter-offer is fair...')}
                                    rows={4}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-slate-900"
                                />
                            </div>

                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                <p className="text-xs text-amber-800">
                                    💡 <strong>{T('Συμβουλή:', 'Tip:')}</strong> {T('Η αντιπρόταση στέλνεται με email στην επιχείρηση. Περισσότερες λεπτομέρειες μπορούν να συζητηθούν στα μηνύματα.', 'The counter-offer is emailed to the brand. You can discuss details in messages.')}
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
                                    className="inline-flex min-h-11 items-center px-4 text-slate-700 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                                >
                                    {T('Ακύρωση', 'Cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={!counterBudget || savingCounterProposal}
                                    className="inline-flex min-h-11 items-center px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {savingCounterProposal ? T('Αποστολή...', 'Sending...') : T('Αποστολή αντιπρότασης', 'Send counter-offer')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import NeonButton from "./NeonButton";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function PublicProfileEditor() {
  const existingProfile = useQuery(api.publicProfile.getMyPublicProfile);

  // Basic info
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [tagline, setTagline] = useState("");

  // Photo
  const [stagedPhotoBase64, setStagedPhotoBase64] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Colors
  const [brandColor1, setBrandColor1] = useState("#00D558");
  const [brandColor2, setBrandColor2] = useState("#A44AFF");

  // Marketplace URLs
  const [ebayUrl, setEbayUrl] = useState("");
  const [buySportsCardsUrl, setBuySportsCardsUrl] = useState("");
  const [sportlotsUrl, setSportlotsUrl] = useState("");
  const [mySlabsUrl, setMySlabsUrl] = useState("");
  const [myCardPostUrl, setMyCardPostUrl] = useState("");

  // Payment handles
  const [paypalUsername, setPaypalUsername] = useState("");
  const [venmoUsername, setVenmoUsername] = useState("");
  const [cashAppUsername, setCashAppUsername] = useState("");

  // Social URLs
  const [twitterUrl, setTwitterUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [threadsUrl, setThreadsUrl] = useState("");

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveMessageType, setSaveMessageType] = useState<"success" | "error">("success");
  const [savedUsername, setSavedUsername] = useState<string | null>(null);

  // Username availability
  const debouncedUsername = useDebounce(username, 400);
  const usernameAvailable = useQuery(
    api.publicProfile.checkUsernameAvailable,
    debouncedUsername.length > 0 ? { username: debouncedUsername } : "skip"
  );

  // Convex hooks
  const upsertPublicProfile = useMutation(api.publicProfile.upsertPublicProfile);
  const uploadProfilePhoto = useAction(api.adapters.gcs.uploadProfilePhoto);

  // Populate form from existing profile
  useEffect(() => {
    if (existingProfile) {
      setUsername(existingProfile.username ?? "");
      setDisplayName(existingProfile.displayName ?? "");
      setTagline(existingProfile.tagline ?? "");
      setBrandColor1(existingProfile.brandColor1 ?? "#00D558");
      setBrandColor2(existingProfile.brandColor2 ?? "#A44AFF");
      setEbayUrl(existingProfile.ebayUrl ?? "");
      setBuySportsCardsUrl(existingProfile.buySportsCardsUrl ?? "");
      setSportlotsUrl(existingProfile.sportlotsUrl ?? "");
      setMySlabsUrl(existingProfile.mySlabsUrl ?? "");
      setMyCardPostUrl(existingProfile.myCardPostUrl ?? "");
      setPaypalUsername(existingProfile.paypalUsername ?? "");
      setVenmoUsername(existingProfile.venmoUsername ?? "");
      setCashAppUsername(existingProfile.cashAppUsername ?? "");
      setTwitterUrl(existingProfile.twitterUrl ?? "");
      setInstagramUrl(existingProfile.instagramUrl ?? "");
      setTiktokUrl(existingProfile.tiktokUrl ?? "");
      setYoutubeUrl(existingProfile.youtubeUrl ?? "");
      setFacebookUrl(existingProfile.facebookUrl ?? "");
      setThreadsUrl(existingProfile.threadsUrl ?? "");
      if (existingProfile.photoUrl) {
        setPhotoPreview(existingProfile.photoUrl);
      }
      setSavedUsername(existingProfile.username ?? null);
    }
  }, [existingProfile]);

  const handleUsernameChange = useCallback((value: string) => {
    const sanitized = value.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setUsername(sanitized);
  }, []);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setStagedPhotoBase64(result);
      setPhotoPreview(result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!username) {
      setSaveMessage("Username is required.");
      setSaveMessageType("error");
      return;
    }
    if (!/^[a-z0-9-]+$/.test(username)) {
      setSaveMessage("Username may only contain lowercase letters, numbers, and hyphens.");
      setSaveMessageType("error");
      return;
    }

    setIsSaving(true);
    setSaveMessage("");

    try {
      let photoUrl: string | undefined;

      // Upload staged photo if present
      if (stagedPhotoBase64) {
        const uploadResult = await uploadProfilePhoto({ imageBase64: stagedPhotoBase64 });
        if (uploadResult.success && uploadResult.imageUrl) {
          // Vercel Blob upload successful
          photoUrl = uploadResult.imageUrl;
        } else if (uploadResult.message === "Vercel Blob storage not configured") {
          // Fallback to base64 data URL if Vercel Blob is not configured
          photoUrl = stagedPhotoBase64;
        } else {
          throw new Error(uploadResult.message);
        }
      }

      await upsertPublicProfile({
        username,
        displayName: displayName || undefined,
        photoUrl: photoUrl ?? (existingProfile?.photoUrl || undefined),
        tagline: tagline || undefined,
        brandColor1: brandColor1 || undefined,
        brandColor2: brandColor2 || undefined,
        ebayUrl: ebayUrl || undefined,
        buySportsCardsUrl: buySportsCardsUrl || undefined,
        sportlotsUrl: sportlotsUrl || undefined,
        mySlabsUrl: mySlabsUrl || undefined,
        myCardPostUrl: myCardPostUrl || undefined,
        paypalUsername: paypalUsername || undefined,
        venmoUsername: venmoUsername || undefined,
        cashAppUsername: cashAppUsername || undefined,
        twitterUrl: twitterUrl || undefined,
        instagramUrl: instagramUrl || undefined,
        tiktokUrl: tiktokUrl || undefined,
        youtubeUrl: youtubeUrl || undefined,
        facebookUrl: facebookUrl || undefined,
        threadsUrl: threadsUrl || undefined,
      });

      setSavedUsername(username);
      setSaveMessage("Profile saved!");
      setSaveMessageType("success");
      setStagedPhotoBase64(null);
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "Failed to save profile.");
      setSaveMessageType("error");
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2 border border-slate-700 rounded-md bg-slate-900 text-foreground focus:outline-none focus:ring-2 focus:ring-[#00D558]";

  const labelClass = "block text-sm font-medium mb-1 text-slate-300";

  const isOwnUsername = existingProfile?.username === debouncedUsername;
  const showAvailability = debouncedUsername.length > 0 && !isOwnUsername;

  return (
    <div className="space-y-8">
      {/* Basic Info */}
      <div className="space-y-4">
        <h3 className="font-semibold text-slate-200">Basic Info</h3>

        {/* Username */}
        <div>
          <label htmlFor="pub-username" className={labelClass}>
            Username <span className="text-slate-500 text-xs">(neonbinder.com/u/[username])</span>
          </label>
          <div className="relative">
            <input
              id="pub-username"
              type="text"
              value={username}
              onChange={(e) => handleUsernameChange(e.target.value)}
              className={inputClass}
              placeholder="e.g. coolcardcollector"
              autoComplete="off"
            />
            {showAvailability && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium">
                {usernameAvailable === undefined ? (
                  <span className="text-slate-400">checking…</span>
                ) : usernameAvailable ? (
                  <span className="text-[#00D558]">available</span>
                ) : (
                  <span className="text-[#FF2EB3]">taken</span>
                )}
              </span>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="pub-display-name" className={labelClass}>
            Display Name
          </label>
          <input
            id="pub-display-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className={inputClass}
            placeholder="Your name or shop name"
          />
        </div>

        <div>
          <label htmlFor="pub-tagline" className={labelClass}>
            Tagline
          </label>
          <input
            id="pub-tagline"
            type="text"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            className={inputClass}
            placeholder="e.g. Vintage baseball cards & rare finds"
          />
        </div>
      </div>

      {/* Profile Photo */}
      <div className="space-y-3">
        <h3 className="font-semibold text-slate-200">Profile Photo</h3>
        <div className="flex items-center gap-4">
          {photoPreview ? (
            <img
              src={photoPreview}
              alt="Profile photo preview"
              className="w-20 h-20 rounded-full object-cover border-2 border-slate-700"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-slate-500 text-2xl">
              ?
            </div>
          )}
          <div>
            <input
              ref={fileInputRef}
              id="pub-photo-input"
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
            />
            <label
              htmlFor="pub-photo-input"
              className="cursor-pointer px-4 py-2 rounded-md bg-slate-800 border border-slate-700 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Choose photo
            </label>
            {stagedPhotoBase64 && (
              <p className="text-xs text-slate-400 mt-1">Photo staged — will upload on save</p>
            )}
          </div>
        </div>
      </div>

      {/* Brand Colors */}
      <div className="space-y-3">
        <h3 className="font-semibold text-slate-200">Brand Colors</h3>
        <div className="flex flex-col sm:flex-row gap-6">
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={brandColor1}
              onChange={(e) => setBrandColor1(e.target.value)}
              className="w-10 h-10 rounded cursor-pointer border border-slate-700 bg-transparent"
              aria-label="Brand color 1"
            />
            <input
              type="text"
              value={brandColor1}
              onChange={(e) => setBrandColor1(e.target.value)}
              className="w-28 px-2 py-1 border border-slate-700 rounded bg-slate-900 text-sm font-mono text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#00D558]"
              placeholder="#00D558"
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={brandColor2}
              onChange={(e) => setBrandColor2(e.target.value)}
              className="w-10 h-10 rounded cursor-pointer border border-slate-700 bg-transparent"
              aria-label="Brand color 2"
            />
            <input
              type="text"
              value={brandColor2}
              onChange={(e) => setBrandColor2(e.target.value)}
              className="w-28 px-2 py-1 border border-slate-700 rounded bg-slate-900 text-sm font-mono text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#00D558]"
              placeholder="#A44AFF"
            />
          </div>
        </div>
        {/* Gradient preview strip */}
        <div
          className="h-8 rounded-md w-full"
          style={{ background: `linear-gradient(135deg, ${brandColor1}, ${brandColor2})` }}
          aria-label="Gradient preview"
        />
      </div>

      {/* Marketplace Links */}
      <div className="space-y-4">
        <h3 className="font-semibold text-slate-200">Marketplace Links</h3>
        {[
          { id: "pub-ebay", label: "eBay Store URL", value: ebayUrl, setter: setEbayUrl, placeholder: "https://www.ebay.com/str/yourstore" },
          { id: "pub-bsc", label: "BuySportsCards URL", value: buySportsCardsUrl, setter: setBuySportsCardsUrl, placeholder: "https://www.buysportscards.com/sellers/..." },
          { id: "pub-sportlots", label: "Sportlots URL", value: sportlotsUrl, setter: setSportlotsUrl, placeholder: "https://www.sportlots.com/..." },
          { id: "pub-myslabs", label: "MySlabs URL", value: mySlabsUrl, setter: setMySlabsUrl, placeholder: "https://www.myslabs.com/..." },
          { id: "pub-mycardpost", label: "MyCardPost URL", value: myCardPostUrl, setter: setMyCardPostUrl, placeholder: "https://www.mycardpost.com/..." },
        ].map(({ id, label, value, setter, placeholder }) => (
          <div key={id}>
            <label htmlFor={id} className={labelClass}>{label}</label>
            <input
              id={id}
              type="url"
              value={value}
              onChange={(e) => setter(e.target.value)}
              className={inputClass}
              placeholder={placeholder}
            />
          </div>
        ))}
      </div>

      {/* Payment Handles */}
      <div className="space-y-4">
        <h3 className="font-semibold text-slate-200">Payment Handles</h3>
        <div>
          <label htmlFor="pub-paypal" className={labelClass}>
            PayPal username{" "}
            {paypalUsername && (
              <span className="text-slate-500 text-xs">→ paypal.me/{paypalUsername}</span>
            )}
          </label>
          <input
            id="pub-paypal"
            type="text"
            value={paypalUsername}
            onChange={(e) => setPaypalUsername(e.target.value)}
            className={inputClass}
            placeholder="yourpaypalname"
          />
        </div>
        <div>
          <label htmlFor="pub-venmo" className={labelClass}>
            Venmo username{" "}
            {venmoUsername && (
              <span className="text-slate-500 text-xs">→ venmo.com/{venmoUsername}</span>
            )}
          </label>
          <input
            id="pub-venmo"
            type="text"
            value={venmoUsername}
            onChange={(e) => setVenmoUsername(e.target.value)}
            className={inputClass}
            placeholder="yourvenmoname"
          />
        </div>
        <div>
          <label htmlFor="pub-cashapp" className={labelClass}>
            Cash App username{" "}
            {cashAppUsername && (
              <span className="text-slate-500 text-xs">→ cash.app/${cashAppUsername}</span>
            )}
          </label>
          <input
            id="pub-cashapp"
            type="text"
            value={cashAppUsername}
            onChange={(e) => setCashAppUsername(e.target.value)}
            className={inputClass}
            placeholder="yourcashapptag"
          />
        </div>
      </div>

      {/* Social Media */}
      <div className="space-y-4">
        <h3 className="font-semibold text-slate-200">Social Media</h3>
        {[
          { id: "pub-twitter", label: "Twitter / X URL", value: twitterUrl, setter: setTwitterUrl, placeholder: "https://x.com/yourhandle" },
          { id: "pub-instagram", label: "Instagram URL", value: instagramUrl, setter: setInstagramUrl, placeholder: "https://www.instagram.com/yourhandle" },
          { id: "pub-tiktok", label: "TikTok URL", value: tiktokUrl, setter: setTiktokUrl, placeholder: "https://www.tiktok.com/@yourhandle" },
          { id: "pub-youtube", label: "YouTube URL", value: youtubeUrl, setter: setYoutubeUrl, placeholder: "https://www.youtube.com/@yourchannel" },
          { id: "pub-facebook", label: "Facebook URL", value: facebookUrl, setter: setFacebookUrl, placeholder: "https://www.facebook.com/yourpage" },
          { id: "pub-threads", label: "Threads URL", value: threadsUrl, setter: setThreadsUrl, placeholder: "https://www.threads.net/@yourhandle" },
        ].map(({ id, label, value, setter, placeholder }) => (
          <div key={id}>
            <label htmlFor={id} className={labelClass}>{label}</label>
            <input
              id={id}
              type="url"
              value={value}
              onChange={(e) => setter(e.target.value)}
              className={inputClass}
              placeholder={placeholder}
            />
          </div>
        ))}
      </div>

      {/* Save */}
      <div className="space-y-3">
        <NeonButton
          onClick={handleSave}
          disabled={isSaving}
          className="w-full"
        >
          {isSaving ? "Saving…" : "Save Public Profile"}
        </NeonButton>

        {saveMessage && (
          <div
            className={`p-3 rounded-md text-sm ${
              saveMessageType === "success"
                ? "bg-green-900/30 text-green-300 border border-green-800"
                : "bg-red-900/30 text-red-300 border border-red-800"
            }`}
          >
            {saveMessage}
            {saveMessageType === "success" && savedUsername && (
              <>
                {" "}
                <a
                  href={`/u/${savedUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium"
                >
                  View your profile at /u/{savedUsername}
                </a>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

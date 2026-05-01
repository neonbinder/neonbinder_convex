import React, { useEffect, useMemo, useState } from "react";
import NeonButton from "../modules/NeonButton";
import type { PlatformItem } from "./ReconciliationModal";

type BaseSetPickerProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selected: PlatformItem) => Promise<void>;
  slOptions: PlatformItem[];
  setName: string;
  manufacturer?: string;
};

// Returns a score indicating how likely `slValue` is the base set.
// Tiers (higher = more likely):
//   1000 — exact match on set name or manufacturer
//    900 — "<setName> Base Set" / "<setName> Base"
//    800 — trailing "Base Set" / "Base" (generic base row)
//    <800 — weaker fuzzy signals
function scoreBaseSetMatch(
  slValue: string,
  setName: string,
  manufacturer: string,
): number {
  const norm = slValue.toLowerCase().trim();
  const setNorm = setName.toLowerCase().trim();
  const mfgNorm = manufacturer.toLowerCase().trim();

  // Tier 1: exact match on set name or manufacturer
  if (setNorm && norm === setNorm) return 1000;
  if (mfgNorm && norm === mfgNorm) return 1000;

  // Tier 2: exact match on set name with manufacturer prefix stripped
  // (e.g., setName "Topps Opening Day", mfg "Topps" → match "Opening Day")
  const stripped =
    mfgNorm && setNorm.startsWith(`${mfgNorm} `)
      ? setNorm.slice(mfgNorm.length + 1).trim()
      : "";
  if (stripped && norm === stripped) return 950;

  // Tier 3: set name + "Base Set"/"Base" appended
  if (setNorm) {
    if (norm === `${setNorm} base set`) return 900;
    if (norm === `${setNorm} base`) return 895;
  }
  if (stripped) {
    if (norm === `${stripped} base set`) return 890;
    if (norm === `${stripped} base`) return 885;
  }

  // Tier 4: generic "Base Set" / "Base" row
  if (norm === "base set") return 800;
  if (norm === "base") return 795;

  // Weaker fuzzy signals below
  if (setNorm && norm.startsWith(setNorm)) {
    const suffix = norm.slice(setNorm.length).trim();
    return 500 - suffix.length;
  }
  if (setNorm && norm.includes(setNorm)) return 300;

  return 0;
}

export default function BaseSetPicker({
  isOpen,
  onClose,
  onConfirm,
  slOptions,
  setName,
  manufacturer = "",
}: BaseSetPickerProps) {
  const [selectedValue, setSelectedValue] = useState<string | null>(null);
  const [userPicked, setUserPicked] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");

  const sortedOptions = useMemo(() => {
    const scored = slOptions.map((opt) => ({
      ...opt,
      score: scoreBaseSetMatch(opt.value, setName, manufacturer),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored;
  }, [slOptions, setName, manufacturer]);

  useEffect(() => {
    if (userPicked) return;
    if (sortedOptions.length > 0 && sortedOptions[0].score >= 795) {
      setSelectedValue(sortedOptions[0].value);
    }
  }, [sortedOptions, userPicked]);

  const filteredOptions = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    if (!q) return sortedOptions;

    const queryTokens = q.split(/\s+/).filter(Boolean);

    const scoreQueryMatch = (value: string): number => {
      const v = value.toLowerCase();
      if (v === q) return 1000;
      if (v.startsWith(q + " ") || v === q) return 900;
      if (new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(v))
        return 800;
      if (v.includes(q)) return 700;
      // All tokens present as whole words
      const allTokensMatch = queryTokens.every((tok) =>
        new RegExp(`\\b${tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(v),
      );
      if (allTokensMatch) return 600 - (v.length - q.length);
      // All tokens present anywhere
      const allTokensLoose = queryTokens.every((tok) => v.includes(tok));
      if (allTokensLoose) return 400 - (v.length - q.length);
      return -1;
    };

    return sortedOptions
      .map((opt) => ({ ...opt, queryScore: scoreQueryMatch(opt.value) }))
      .filter((opt) => opt.queryScore >= 0)
      .sort((a, b) => {
        if (b.queryScore !== a.queryScore) return b.queryScore - a.queryScore;
        return a.value.length - b.value.length;
      });
  }, [sortedOptions, searchFilter]);

  const handleConfirm = async () => {
    const selected = slOptions.find((o) => o.value === selectedValue);
    if (!selected) return;
    setConfirming(true);
    try {
      await onConfirm(selected);
    } finally {
      setConfirming(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && selectedValue && !confirming) {
        e.preventDefault();
        void handleConfirm();
      } else if (e.key === "Escape" && !confirming) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, selectedValue, confirming]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl max-w-lg w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">
            Select Base Set
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Choose which SportLots set is the base set for <strong className="text-gray-200">{setName}</strong>.
            The rest will be discarded.
          </p>
        </div>

        {/* Search */}
        {slOptions.length > 8 && (
          <div className="px-6 pt-3">
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-600 rounded-lg text-gray-200 placeholder-gray-500"
              placeholder="Search sets..."
              autoFocus
            />
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-1.5">
          {filteredOptions.map((opt) => (
            <button
              key={`${opt.platformValue}-${opt.value}`}
              onClick={() => {
                setSelectedValue(opt.value);
                setUserPicked(true);
              }}
              className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all text-sm ${
                selectedValue === opt.value
                  ? "border-[#00D558] bg-[#00D558]/10 ring-1 ring-[#00D558]"
                  : "border-gray-600 bg-gray-800 hover:border-gray-400"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-200">{opt.value}</span>
                {opt.score >= 795 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-900/40 text-green-400 border border-green-700 shrink-0">
                    likely match
                  </span>
                )}
              </div>
            </button>
          ))}
          {filteredOptions.length === 0 && (
            <p className="text-sm text-gray-500 py-4 text-center">
              No matching sets found
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
          <NeonButton cancel onClick={onClose} disabled={confirming}>
            Cancel
          </NeonButton>
          <NeonButton
            onClick={handleConfirm}
            disabled={!selectedValue || confirming}
          >
            {confirming ? "Saving..." : "Confirm Base Set"}
          </NeonButton>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { EXPECTED_FEATURES } from "../../convex/features/expectedFeatures";

/**
 * NEO-24 — set-level feature editor (renders for any selectorOption
 * row, but only mounted by SetSelector when a setName-level row is
 * active per the plan).
 *
 * Reads the active row's `features` map, lets the operator edit each
 * `EXPECTED_FEATURES` key, and persists via `setSelectorOptionFeature`
 * — the propagation engine fans the change out to every descendant
 * cardChecklist row whose value matches the previous set-level value
 * (or is undefined).
 *
 * Header chips render the read-only `setMetadata` (releaseDate,
 * totalCardCount, block, tcdbSetId, lastSyncedAt) so the operator
 * sees the BSC/SL/TCDB sync state at a glance.
 *
 * Save flow:
 *   1. User types a new value into a row.
 *   2. Blur triggers the mutation.
 *   3. Mutation returns `{ propagatedToCardCount, skippedAsOverridden }`.
 *   4. Toast renders "Updated N cards; skipped M with overrides".
 *
 * "Will propagate to N descendant cards" preview is shown above the
 * edit area as a static count from `getDescendantCardCount`.
 */
export default function SetFeaturesPanel({
  selectorOptionId,
}: {
  selectorOptionId: Id<"selectorOptions">;
}) {
  const row = useQuery(api.selectorOptions.getSelectorOptionById, {
    id: selectorOptionId,
  });
  const chain = useQuery(api.selectorOptions.getAncestorChain, {
    id: selectorOptionId,
  });
  const descendantCardCount = useQuery(
    api.selectorOptions.getDescendantCardCount,
    { selectorOptionId },
  );
  const setSelectorOptionFeature = useMutation(
    api.selectorOptions.setSelectorOptionFeature,
  );

  const [toast, setToast] = useState<string | null>(null);

  // Derive the sport from the ancestor chain so we can drop features
  // that don't apply (e.g. "League" hidden for Pokemon).
  const ancestorSport = useMemo(() => {
    if (!chain) return undefined;
    return chain.find((c) => c.level === "sport")?.value;
  }, [chain]);

  // Inherited value per feature (from strictly-shallower ancestors —
  // siblings + self are excluded so the "Inherited:" hint shows what
  // the row falls back to when the operator clears the key).
  const inheritedByKey = useMemo(() => {
    const map: Record<string, string> = {};
    if (!chain) return map;
    for (const ancestor of chain) {
      if (ancestor._id === selectorOptionId) continue;
      if (!ancestor.features) continue;
      for (const [k, v] of Object.entries(ancestor.features)) {
        map[k] = v;
      }
    }
    return map;
  }, [chain, selectorOptionId]);

  const applicable = useMemo(() => {
    return EXPECTED_FEATURES.filter((f) => {
      if (!f.applicableSports) return true;
      if (!ancestorSport) return true;
      return f.applicableSports.includes(ancestorSport);
    });
  }, [ancestorSport]);

  if (!row || !chain) return null;

  const features = row.features ?? {};
  const setMeta = row.setMetadata ?? {};

  const handleSave = async (key: string, value: string) => {
    const trimmed = value.trim();
    if (trimmed.length === 0) return;
    if (features[key] === trimmed) return; // no-op
    try {
      const result = await setSelectorOptionFeature({
        selectorOptionId,
        key,
        value: trimmed,
      });
      setToast(
        `Updated ${result.propagatedToCardCount} card${result.propagatedToCardCount === 1 ? "" : "s"}` +
          (result.skippedAsOverridden > 0
            ? `; skipped ${result.skippedAsOverridden} with overrides`
            : ""),
      );
      // Auto-dismiss after 6s so the next edit gets a fresh toast.
      setTimeout(() => setToast(null), 6000);
    } catch (e) {
      setToast(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div
      className="border border-gray-700 rounded-lg bg-gray-900/60 p-4 space-y-3"
      aria-label="Set features panel"
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-100">Set features</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Marketplace-listing attributes for{" "}
            <span className="font-mono">{row.value}</span>. Saving a value
            propagates to descendant cards that haven&apos;t overridden the key.
          </p>
        </div>
        <span
          className="text-xs text-gray-500"
          aria-label={`Will propagate to ${descendantCardCount ?? "?"} descendant cards`}
        >
          {descendantCardCount !== undefined ? (
            <>
              Will propagate to{" "}
              <span className="text-[#00D558] font-semibold">
                {descendantCardCount}
              </span>{" "}
              card{descendantCardCount === 1 ? "" : "s"}
            </>
          ) : (
            "Counting…"
          )}
        </span>
      </div>

      {/* setMetadata read-only chips (NEO-24 set-level identifiers) */}
      <SetMetadataChips meta={setMeta} />

      {toast && (
        <div
          className="p-2 bg-[#00D558]/10 border border-[#00D558]/40 rounded text-xs text-[#00D558]"
          role="status"
          aria-live="polite"
        >
          {toast}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {applicable.map((feat) => (
          <SetFeatureRow
            key={feat.key}
            featKey={feat.key}
            label={feat.label}
            value={features[feat.key]}
            inherited={inheritedByKey[feat.key]}
            onSave={(v) => handleSave(feat.key, v)}
          />
        ))}
      </div>
    </div>
  );
}

function SetMetadataChips({
  meta,
}: {
  meta: {
    releaseDate?: string;
    totalCardCount?: number;
    block?: string;
    tcdbSetId?: string;
    sourceUrl?: string;
    lastSyncedAt?: number;
  };
}) {
  const chips: Array<{ label: string; value: string }> = [];
  if (meta.releaseDate) chips.push({ label: "Released", value: meta.releaseDate });
  if (meta.totalCardCount !== undefined)
    chips.push({ label: "Cards", value: String(meta.totalCardCount) });
  if (meta.block) chips.push({ label: "Block", value: meta.block });
  if (meta.tcdbSetId)
    chips.push({ label: "TCDB SID", value: meta.tcdbSetId });
  if (meta.lastSyncedAt) {
    chips.push({
      label: "Synced",
      value: new Date(meta.lastSyncedAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    });
  }
  if (chips.length === 0) {
    return (
      <div className="text-xs text-gray-500 italic" aria-label="No set metadata yet">
        No set metadata yet — pending sync.
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5" aria-label="Set metadata chips">
      {chips.map((c) => (
        <span
          key={c.label}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-[10px]"
        >
          <span className="uppercase tracking-wide text-gray-500">
            {c.label}
          </span>
          <span className="text-gray-200">{c.value}</span>
        </span>
      ))}
    </div>
  );
}

function SetFeatureRow({
  featKey,
  label,
  value,
  inherited,
  onSave,
}: {
  featKey: string;
  label: string;
  value: string | undefined;
  inherited: string | undefined;
  onSave: (value: string) => Promise<unknown>;
}) {
  const [draft, setDraft] = useState(value ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the draft in sync with reactive value updates from
  // propagation engine writes triggered elsewhere on the page —
  // Convex pushes a fresh `row.features` map; without this the
  // input would still show the local draft, masking the new value.
  // Skip the auto-sync when the user is actively typing (input is
  // focused) so we don't stomp keystrokes.
  useEffect(() => {
    if (busy) return;
    if (typeof document !== "undefined" && document.activeElement === inputRef.current) {
      return;
    }
    setDraft(value ?? "");
  }, [value, busy]);

  const commit = async () => {
    if (busy) return;
    const trimmed = draft.trim();
    if (trimmed === (value ?? "")) return;
    if (trimmed.length === 0) {
      // Empty input: no clear-key mutation at set-level (the spec
      // calls only for write-time propagation), so we treat the
      // empty input as a no-op + revert the draft.
      setDraft(value ?? "");
      return;
    }
    setBusy(true);
    try {
      await onSave(trimmed);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const hasOwn = value !== undefined && value !== "";
  const isMissing = !hasOwn && (inherited === undefined || inherited === "");

  return (
    <label
      className={`flex flex-col gap-0.5 p-2 rounded border text-xs ${
        isMissing
          ? "border-amber-500/60 bg-amber-500/5"
          : "border-gray-700 bg-gray-900/30"
      }`}
      aria-label={`Set feature ${label}`}
    >
      <span className="flex items-center justify-between text-[10px] uppercase tracking-wide text-gray-400">
        <span>
          {isMissing && (
            <span
              className="text-amber-500 mr-1"
              aria-label="Missing required feature"
              title="Missing required feature"
            >
              ⚠
            </span>
          )}
          {label}
        </span>
      </span>
      <input
        ref={inputRef}
        type="text"
        data-feat-key={featKey}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void commit();
          }
        }}
        disabled={busy}
        aria-label={`Value for ${label}`}
        placeholder={inherited ?? "—"}
        className="w-full p-1 border rounded text-xs dark:bg-gray-900 dark:border-gray-700 focus:border-[#00D558] focus:outline-none"
      />
      {!hasOwn && inherited !== undefined && inherited !== "" && (
        <span
          className="text-[10px] text-gray-500"
          aria-label={`Inherited value: ${inherited}`}
        >
          Inherited: {inherited}
        </span>
      )}
      {err && (
        <span className="text-[10px] text-[#FF2EB3]" role="alert">
          {err}
        </span>
      )}
    </label>
  );
}

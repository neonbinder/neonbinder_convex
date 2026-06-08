import { ReactNode, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { GenericId } from "convex/values";
import NeonButton from "../modules/NeonButton";

type Level =
  | "sport"
  | "year"
  | "manufacturer"
  | "setName"
  | "variantType"
  | "insert"
  | "parallel";

type EntityColumnProps = {
  selector: ReactNode;
  renderForm: (onDone: () => void) => ReactNode;
  addButtonText: string;
  isVisible: boolean;
  level?: Level;
  parentId?: GenericId<"selectorOptions">;
  // Called when the user types a value into "+ Custom" that already exists at
  // this column (synced marketplace data OR a prior custom entry). Instead of
  // minting a duplicate, we drive the parent's level-select handler so the
  // cascade drills into the existing row — identical to searching for and
  // selecting it. A genuinely-new value still creates a custom entry.
  onSelectExisting?: (id: GenericId<"selectorOptions">) => void;
  // Extra buttons rendered alongside Sync / + Custom in idle mode. Used by
  // the Variants column to expose the "Group Parallels" trigger without
  // forcing every column to learn about that domain.
  extraActions?: ReactNode;
};

export default function EntityColumn({
  selector,
  renderForm,
  addButtonText,
  isVisible,
  level,
  parentId,
  onSelectExisting,
  extraActions,
}: EntityColumnProps) {
  const [mode, setMode] = useState<"idle" | "sync" | "custom">("idle");
  const [customValue, setCustomValue] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);
  // Set once the user engages this column after its first sync — see the
  // freeze-on-interaction effect below. Frozen columns stop auto-syncing.
  const [hasInteracted, setHasInteracted] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const wasVisibleRef = useRef(isVisible);

  // Query the items at this column's level so we can auto-trigger sync
  // when the column opens empty. Skipped when no level is provided
  // (defensive — every caller in SetSelector.tsx supplies one).
  const items = useQuery(
    api.selectorOptions.getSelectorOptions,
    level ? { level, parentId } : "skip",
  );

  // Track which (level, parentId) keys have already had auto-sync fired
  // so closing the form doesn't immediately retrigger it. A fresh
  // parentId (user picks a different parent) gets its own attempt.
  const autoSyncedRef = useRef<Set<string>>(new Set());

  // Has this column finished its first sync (data loaded, or a sync cycle
  // completed)? Freeze-on-interaction only engages after this, so a never-
  // synced column still gets its first sync even if the user scrolls it early.
  const hasSyncedRef = useRef(false);
  const prevModeRef = useRef<"idle" | "sync" | "custom">(mode);

  useEffect(() => {
    if (isVisible && !wasVisibleRef.current && containerRef.current) {
      containerRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "end",
      });
    }
    wasVisibleRef.current = isVisible;
  }, [isVisible]);

  // Latch "first sync done" for this column: either the items query has
  // returned data, or a sync cycle has completed (sync → idle). Freeze-on-
  // interaction only engages after this point ("freeze only after first sync").
  useEffect(() => {
    if (items && items.length > 0) hasSyncedRef.current = true;
    if (prevModeRef.current === "sync" && mode === "idle") {
      hasSyncedRef.current = true;
    }
    prevModeRef.current = mode;
  }, [items, mode]);

  // A different parent is a fresh, untouched context: re-allow auto-sync and
  // require a new first-sync before interaction can freeze the column again.
  useEffect(() => {
    setHasInteracted(false);
    hasSyncedRef.current = false;
  }, [parentId]);

  // Freeze-on-interaction (FE stability for concurrent users): once the user
  // engages a column that has ALREADY synced — selects a row, types in the
  // search box, or scrolls — stop auto-syncing it and drop out of any in-flight
  // auto-sync. A background re-sync (triggered by this or another user's writes
  // to the shared selectorOptions) can then no longer blank the column or
  // swallow the interaction. The reactive items query stays live, so
  // collaborative adds/updates still appear; only the marketplace re-fetch
  // stops. Columns the user hasn't touched keep syncing normally.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onInteract = () => {
      if (!hasSyncedRef.current) return; // only after the first sync
      setHasInteracted(true);
      setMode((m) => (m === "sync" ? "idle" : m));
    };
    // capture phase so we freeze before the row's own onClick runs.
    const opts = { capture: true, passive: true } as const;
    // pointerdown = select a row / press a button; keydown = type in search;
    // wheel + touchstart = scroll. We deliberately do NOT listen for the
    // generic `scroll` event, so the programmatic scrollIntoView that fires
    // when a column first appears can't falsely freeze an untouched column.
    el.addEventListener("pointerdown", onInteract, opts);
    el.addEventListener("keydown", onInteract, opts);
    el.addEventListener("wheel", onInteract, opts);
    el.addEventListener("touchstart", onInteract, opts);
    return () => {
      el.removeEventListener("pointerdown", onInteract, opts);
      el.removeEventListener("keydown", onInteract, opts);
      el.removeEventListener("wheel", onInteract, opts);
      el.removeEventListener("touchstart", onInteract, opts);
    };
  }, [isVisible]);

  // Auto-sync: when this column is visible, not frozen by interaction, in idle
  // mode, the items query has resolved to an empty list, and we haven't already
  // auto-synced this (level, parentId) — switch to sync mode. The form itself
  // auto-runs `fetchRawOptions`/`fetchAggregatedOptions` on mount, so this is
  // the only nudge needed.
  useEffect(() => {
    if (!isVisible) return;
    if (hasInteracted) return;
    if (mode !== "idle") return;
    if (!level) return;
    if (items === undefined) return;
    if (items.length > 0) return;
    const key = `${level}:${parentId ?? "root"}`;
    if (autoSyncedRef.current.has(key)) return;
    autoSyncedRef.current.add(key);
    setMode("sync");
  }, [isVisible, mode, level, parentId, items, hasInteracted]);

  const addCustomOption = useMutation(
    api.selectorOptions.addCustomSelectorOption,
  );

  const handleFormDone = () => {
    setMode("idle");
  };

  const handleCustomSubmit = async () => {
    const trimmed = customValue.trim();
    if (!trimmed || !level) return;
    setCustomError(null);

    // "Custom" is only for values the marketplaces don't have. If the typed
    // value already exists at this column — whether it was synced from a
    // marketplace OR added as a prior custom entry — treat it exactly like
    // searching for and selecting it: drill into the existing row via the
    // parent's level-select handler. No duplicate, no error. (The server's
    // addCustomSelectorOption is idempotent and returns the existing _id on a
    // match, but the FE drives the actual selection so the cascade advances.)
    const normalized = trimmed.toLowerCase();
    const existing = (items ?? []).find(
      (o) => o.value.toLowerCase().trim() === normalized,
    );
    if (existing) {
      setCustomValue("");
      setMode("idle");
      onSelectExisting?.(existing._id);
      return;
    }

    // Genuinely-new value → create a custom entry. The new row appears in the
    // list and the operator taps it to drill (unchanged behavior — existing
    // custom-drill Maestro flows depend on it NOT auto-drilling here).
    try {
      await addCustomOption({
        level,
        value: trimmed,
        parentId,
      });
      setCustomValue("");
      setMode("idle");
    } catch (error) {
      setCustomError(
        error instanceof Error ? error.message : "Failed to add custom entry",
      );
    }
  };

  if (!isVisible) return null;

  return (
    <div
      ref={containerRef}
      className="min-w-[260px] max-w-[340px] flex-shrink-0 flex flex-col gap-4"
    >
      {selector}
      {mode === "sync" ? (
        renderForm(handleFormDone)
      ) : mode === "custom" ? (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-3">Add Custom Entry</h2>
          <input
            type="text"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCustomSubmit();
            }}
            className="w-full p-2 mb-3 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            placeholder="Enter custom value..."
            autoFocus
          />
          {customError && (
            <div className="p-2 mb-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-md text-red-800 dark:text-red-200 text-sm">
              {customError}
            </div>
          )}
          <div className="flex gap-2">
            <NeonButton onClick={handleCustomSubmit}>Add</NeonButton>
            <NeonButton cancel onClick={() => setMode("idle")}>
              Cancel
            </NeonButton>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <NeonButton onClick={() => setMode("sync")}>
            {addButtonText}
          </NeonButton>
          {level && (
            <NeonButton
              secondary
              onClick={() => setMode("custom")}
              aria-label={`Add custom ${addButtonText.replace(/^Sync /, "")}`}
            >
              + Custom
            </NeonButton>
          )}
          {extraActions}
        </div>
      )}
    </div>
  );
}

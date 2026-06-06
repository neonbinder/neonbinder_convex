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

  // Auto-sync: when this column is visible, in idle mode, the items
  // query has resolved to an empty list, and we haven't already auto-
  // synced this (level, parentId) — switch to sync mode. The form
  // itself auto-runs `fetchRawOptions`/`fetchAggregatedOptions` on mount,
  // so this is the only nudge needed.
  useEffect(() => {
    if (!isVisible) return;
    if (mode !== "idle") return;
    if (!level) return;
    if (items === undefined) return;
    if (items.length > 0) return;
    const key = `${level}:${parentId ?? "root"}`;
    if (autoSyncedRef.current.has(key)) return;
    autoSyncedRef.current.add(key);
    setMode("sync");
  }, [isVisible, mode, level, parentId, items]);

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

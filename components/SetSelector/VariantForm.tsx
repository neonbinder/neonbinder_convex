import React, { useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { GenericId } from "convex/values";
import NeonButton from "../modules/NeonButton";
import ReconciliationModal, { type ReconciledResult, type MatchedPair, type PlatformItem } from "./ReconciliationModal";
import BaseSetPicker from "./BaseSetPicker";

type RawOptionsResult = {
  success: boolean;
  bscOptions: PlatformItem[];
  slOptions: PlatformItem[];
  autoMatched: MatchedPair[];
  unmatchedBsc: PlatformItem[];
  unmatchedSl: PlatformItem[];
  message?: string;
};

export default function VariantForm({
  variantTypeId,
  onDone,
}: {
  variantTypeId: GenericId<"selectorOptions">;
  onDone?: () => void;
}) {
  const fetchRawOptions = useAction(api.setReconciliation.fetchRawOptions);
  const storeReconciledOptions = useMutation(api.setReconciliation.storeReconciledOptions);
  const ancestorChain = useQuery(api.selectorOptions.getAncestorChain, {
    id: variantTypeId,
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showReconciliation, setShowReconciliation] = useState(false);
  const [showBasePicker, setShowBasePicker] = useState(false);
  const [reconciliationData, setReconciliationData] = useState<RawOptionsResult | null>(null);
  const triggered = useRef(false);

  const sportValue = ancestorChain?.find((a: { level: string }) => a.level === "sport")?.value;
  const yearValue = ancestorChain?.find((a: { level: string }) => a.level === "year")?.value;
  const manufacturerValue = ancestorChain?.find(
    (a: { level: string }) => a.level === "manufacturer",
  )?.value;
  const setNameAncestor = ancestorChain?.find(
    (a: { level: string }) => a.level === "setName",
  );
  const setNameValue = setNameAncestor?.value;
  const setId = setNameAncestor?._id as GenericId<"selectorOptions"> | undefined;

  // Exclude the *current* variantType from the "used" check so re-running
  // the same sync still surfaces previously-saved rows (the user can then
  // prune them via the keep shelf). Sibling variantTypes remain blocked.
  const usedIdentifiers = useQuery(
    api.selectorOptions.getUsedInsertIdentifiersBySet,
    setId ? { setId, excludeVariantTypeId: variantTypeId } : "skip",
  );
  const variantTypeValue = ancestorChain?.find(
    (a: { level: string }) => a.level === "variantType",
  )?.value;

  const isBase = variantTypeValue?.toLowerCase() === "base";

  // For Insert/Parallel variantTypes, look up the sibling Base variant so we
  // can pass its name as an additional SL prefix to ReconciliationModal —
  // SL has no native set entity, so the Base anchor's name is the tightest
  // SL-side filter we have without a new scraper.
  const baseVariant = useQuery(
    api.selectorOptions.getBaseVariantBySet,
    setId && !isBase ? { setId } : "skip",
  );

  const doSync = async () => {
    if (!sportValue || !yearValue) return;
    setLoading(true);
    setMessage(null);
    try {
      const result = await fetchRawOptions({
        level: "insert",
        parentId: variantTypeId,
        parentFilters: {
          sport: sportValue,
          year: yearValue,
          manufacturer: manufacturerValue,
          setName: setNameValue,
          variantType: variantTypeValue,
        },
      });

      if (!result.success) {
        setMessage(result.message || "Failed to fetch options");
        return;
      }

      if (isBase) {
        // Base variant: show picker if either platform has options
        if (result.slOptions.length > 0) {
          setReconciliationData(result);
          setShowBasePicker(true);
        } else if (result.bscOptions.length > 0) {
          // No SL data — auto-take the highest BSC option (or first) as base
          const bscPick = result.bscOptions[0];
          await storeReconciledOptions({
            level: "insert",
            parentId: variantTypeId,
            reconciledItems: [{
              value: bscPick.value,
              platformData: { bsc: bscPick.platformValue },
            }],
          });
          setMessage(`Stored base set: ${bscPick.value}`);
          onDone?.();
        } else {
          // No data on either platform — fall back to set name. Inherit the
          // SET's BSC slug so the Base variant still routes to BSC's set
          // search (BSC's variantName facet is commonly empty under
          // variant=Base).
          const baseName = setNameValue || "Base";
          const setBsc = setNameAncestor?.platformData?.bsc;
          const bscFallback =
            typeof setBsc === "string"
              ? setBsc
              : Array.isArray(setBsc) && setBsc.length > 0
                ? setBsc[0]
                : undefined;
          await storeReconciledOptions({
            level: "insert",
            parentId: variantTypeId,
            reconciledItems: [{
              value: baseName,
              platformData: bscFallback ? { bsc: bscFallback } : {},
            }],
          });
          setMessage(`Stored base set: ${baseName}`);
          onDone?.();
        }
      } else if (result.bscOptions.length > 0 && result.slOptions.length > 0) {
        // Both platforms have data — show reconciliation modal
        setReconciliationData(result);
        setShowReconciliation(true);
        setMessage(result.message || null);
      } else {
        // Only one platform has data — store directly
        const items = [
          ...result.bscOptions.map((o: PlatformItem) => ({
            value: o.value,
            platformData: { bsc: o.platformValue as string | undefined, sportlots: undefined },
          })),
          ...result.slOptions.map((o: PlatformItem) => ({
            value: o.value,
            platformData: { bsc: undefined, sportlots: o.platformValue as string | undefined },
          })),
        ];

        if (items.length > 0) {
          await storeReconciledOptions({
            level: "insert",
            parentId: variantTypeId,
            reconciledItems: items,
          });
        }

        setMessage(
          result.message || `Stored ${items.length} variants (single platform)`,
        );
        onDone?.();
      }
    } catch (error) {
      setMessage(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBaseSetConfirm = async (selected: { sl: PlatformItem; bsc?: PlatformItem }) => {
    // BSC's variantName facet is often empty under variant=Base — for those
    // sets the Base variant maps directly to the SET's BSC slug. Fall back
    // to that when the picker had no BSC options to surface.
    const setBsc = setNameAncestor?.platformData?.bsc;
    const bscPlatformValue =
      selected.bsc?.platformValue ??
      (typeof setBsc === "string"
        ? setBsc
        : Array.isArray(setBsc) && setBsc.length > 0
          ? setBsc[0]
          : undefined);

    await storeReconciledOptions({
      level: "insert",
      parentId: variantTypeId,
      reconciledItems: [{
        value: selected.sl.value,
        platformData: {
          sportlots: selected.sl.platformValue,
          ...(bscPlatformValue ? { bsc: bscPlatformValue } : {}),
        },
      }],
    });
    setShowBasePicker(false);
    onDone?.();
  };

  const handleReconciliationConfirm = async (result: ReconciledResult) => {
    await storeReconciledOptions({
      level: "insert",
      parentId: variantTypeId,
      reconciledItems: result.items.map((item) => ({
        value: item.value,
        platformData: item.platformData,
        metadata: item.metadata,
      })),
    });
    setShowReconciliation(false);
    onDone?.();
  };

  useEffect(() => {
    if (sportValue && yearValue && !triggered.current) {
      triggered.current = true;
      doSync();
    }
  }, [sportValue, yearValue]);

  return (
    <>
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">
          {isBase ? "Select Base Set" : "Syncing Variants"}
        </h2>

        {loading && (
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {isBase
              ? `Finding base set for ${setNameValue || "..."}...`
              : `Fetching variants for ${setNameValue || "..."} ${variantTypeValue || ""} from all connected platforms...`
            }
          </p>
        )}

        {message && !showReconciliation && !showBasePicker && (
          <div className="p-3 mb-4 bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-md text-blue-800 dark:text-blue-200 text-sm">
            {message}
          </div>
        )}

        {!loading && !showReconciliation && !showBasePicker && (
          <div className="flex gap-2">
            {(message?.startsWith("Error") || message?.startsWith("Failed")) && (
              <NeonButton onClick={doSync}>Retry</NeonButton>
            )}
            <NeonButton cancel onClick={onDone}>
              {message?.startsWith("Error") || message?.startsWith("Failed") ? "Cancel" : "Close"}
            </NeonButton>
          </div>
        )}
      </div>

      {showBasePicker && reconciliationData && (
        <BaseSetPicker
          isOpen={showBasePicker}
          onClose={() => {
            setShowBasePicker(false);
            onDone?.();
          }}
          onConfirm={handleBaseSetConfirm}
          slOptions={reconciliationData.slOptions}
          bscOptions={reconciliationData.bscOptions}
          setName={setNameValue || ""}
          manufacturer={manufacturerValue || ""}
        />
      )}

      {showReconciliation && reconciliationData && (
        <ReconciliationModal
          isOpen={showReconciliation}
          onClose={() => {
            setShowReconciliation(false);
            onDone?.();
          }}
          onConfirm={handleReconciliationConfirm}
          level="insert"
          initialData={{
            autoMatched: reconciliationData.autoMatched,
            unmatchedBsc: reconciliationData.unmatchedBsc,
            unmatchedSl: reconciliationData.unmatchedSl,
          }}
          showMetadata
          setName={setNameValue || ""}
          manufacturer={manufacturerValue || ""}
          extraSlPrefixes={baseVariant?.value ? [baseVariant.value] : []}
          usedSlPlatformValues={usedIdentifiers?.slPlatformValues}
          usedBscPlatformValues={usedIdentifiers?.bscPlatformValues}
        />
      )}
    </>
  );
}

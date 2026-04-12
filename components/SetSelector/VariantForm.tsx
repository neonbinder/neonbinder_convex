import React, { useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { GenericId } from "convex/values";
import NeonButton from "../modules/NeonButton";
import ReconciliationModal, { type ReconciledResult, type MatchedPair, type PlatformItem } from "./ReconciliationModal";

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
  const [reconciliationData, setReconciliationData] = useState<RawOptionsResult | null>(null);
  const triggered = useRef(false);

  const sportValue = ancestorChain?.find((a: { level: string }) => a.level === "sport")?.value;
  const yearValue = ancestorChain?.find((a: { level: string }) => a.level === "year")?.value;
  const manufacturerValue = ancestorChain?.find(
    (a: { level: string }) => a.level === "manufacturer",
  )?.value;
  const setNameValue = ancestorChain?.find(
    (a: { level: string }) => a.level === "setName",
  )?.value;
  const variantTypeValue = ancestorChain?.find(
    (a: { level: string }) => a.level === "variantType",
  )?.value;

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

      // If both platforms returned data, show reconciliation modal
      if (result.bscOptions.length > 0 && result.slOptions.length > 0) {
        setReconciliationData(result);
        setShowReconciliation(true);
        setMessage(result.message || null);
      } else {
        // Only one platform has data — store directly without reconciliation
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
        <h2 className="text-xl font-semibold mb-4">Syncing Variants</h2>

        {loading && (
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Fetching variants for{" "}
            <strong>
              {setNameValue || "..."} {variantTypeValue || ""}
            </strong>{" "}
            from all connected platforms...
          </p>
        )}

        {message && !showReconciliation && (
          <div className="p-3 mb-4 bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-md text-blue-800 dark:text-blue-200 text-sm">
            {message}
          </div>
        )}

        {!loading && !showReconciliation && (
          <div className="flex gap-2">
            {message?.startsWith("Error") && (
              <NeonButton onClick={doSync}>Retry</NeonButton>
            )}
            <NeonButton cancel onClick={onDone}>
              {message?.startsWith("Error") ? "Cancel" : "Close"}
            </NeonButton>
          </div>
        )}
      </div>

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
        />
      )}
    </>
  );
}

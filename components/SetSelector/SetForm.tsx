import React, { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { GenericId } from "convex/values";
import NeonButton from "../modules/NeonButton";

export default function SetForm({
  manufacturerId,
  onDone,
}: {
  manufacturerId: GenericId<"selectorOptions">;
  onDone?: () => void;
}) {
  const fetchAggregatedOptions = useAction(
    api.selectorOptions.fetchAggregatedOptions,
  );
  const ancestorChain = useQuery(api.selectorOptions.getAncestorChain, {
    id: manufacturerId,
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const sportValue = ancestorChain?.find((a: { level: string }) => a.level === "sport")?.value;
  const yearValue = ancestorChain?.find((a: { level: string }) => a.level === "year")?.value;
  const manufacturerValue = ancestorChain?.find(
    (a: { level: string }) => a.level === "manufacturer",
  )?.value;

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Sync Set Options</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        Fetch set options for{" "}
        <strong>
          {yearValue || "..."} {manufacturerValue || ""}
        </strong>{" "}
        from all connected platforms.
      </p>

      {message && (
        <div className="p-3 mb-4 bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-md text-blue-800 dark:text-blue-200 text-sm">
          {message}
        </div>
      )}

      <div className="flex gap-2">
        <NeonButton
          disabled={loading || !ancestorChain}
          onClick={async () => {
            if (!sportValue || !yearValue || !manufacturerValue) return;
            setLoading(true);
            setMessage(null);
            try {
              const result = await fetchAggregatedOptions({
                level: "setName",
                parentId: manufacturerId,
                parentFilters: {
                  sport: sportValue,
                  year: yearValue,
                  manufacturer: manufacturerValue,
                },
              });
              setMessage(result.message);
              if (result.success) {
                onDone?.();
              }
            } catch (error) {
              setMessage(
                `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
              );
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? "Syncing..." : "Sync from Marketplaces"}
        </NeonButton>
        <NeonButton cancel onClick={onDone}>
          Cancel
        </NeonButton>
      </div>
    </div>
  );
}

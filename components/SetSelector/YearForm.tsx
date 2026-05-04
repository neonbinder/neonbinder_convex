import React, { useEffect, useRef, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { GenericId } from "convex/values";
import NeonButton from "../modules/NeonButton";

export default function YearForm({
  sportId,
  onDone,
}: {
  sportId: GenericId<"selectorOptions">;
  onDone?: () => void;
}) {
  const fetchAggregatedOptions = useAction(
    api.selectorOptions.fetchAggregatedOptions,
  );
  const sportOption = useQuery(api.selectorOptions.getSelectorOptionById, {
    id: sportId,
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const triggered = useRef(false);

  const doSync = async () => {
    if (!sportOption) return;
    setLoading(true);
    setMessage(null);
    try {
      const result = await fetchAggregatedOptions({
        level: "year",
        parentId: sportId,
        parentFilters: {
          sport: sportOption.value,
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
  };

  useEffect(() => {
    if (sportOption && !triggered.current) {
      triggered.current = true;
      doSync();
    }
  }, [sportOption]);

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Syncing Year Options</h2>

      {loading && (
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Fetching year options for{" "}
          <strong>{sportOption?.value || "..."}</strong> from all connected
          platforms...
        </p>
      )}

      {message && (
        <div className="p-3 mb-4 bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-md text-blue-800 dark:text-blue-200 text-sm">
          {message}
        </div>
      )}

      {!loading && (
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
  );
}

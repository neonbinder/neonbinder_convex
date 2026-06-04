import React, { useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import NeonButton from "../modules/NeonButton";

export function SportForm({ onDone }: { onDone?: () => void }) {
  const fetchAggregatedOptions = useAction(
    api.selectorOptions.fetchAggregatedOptions,
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const triggered = useRef(false);

  const doSync = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const result = await fetchAggregatedOptions({
        level: "sport",
        parentFilters: {},
      });
      setMessage(result.message);
      // NEO-47: go idle on an empty result (optionsCount === 0) too, not only on
      // success, so a no-marketplace-data case doesn't hard-block "+ Custom".
      // autoSyncedRef prevents a re-sync loop; a thrown error (catch) keeps Retry.
      if (result.success || result.optionsCount === 0) {
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
    if (!triggered.current) {
      triggered.current = true;
      doSync();
    }
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Syncing Sport Options</h2>

      {loading && (
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Fetching the latest sport options from all connected platforms...
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

// Re-export the SportSelector for backward compatibility
export { default as SportSelector } from "./SportSelector";

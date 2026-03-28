import React, { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import NeonButton from "../modules/NeonButton";

export function SportForm({ onDone }: { onDone?: () => void }) {
  const fetchAggregatedOptions = useAction(
    api.selectorOptions.fetchAggregatedOptions,
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Sync Sport Options</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        Fetch the latest sport options from all connected platforms.
      </p>

      {message && (
        <div className="p-3 mb-4 bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-md text-blue-800 dark:text-blue-200 text-sm">
          {message}
        </div>
      )}

      <div className="flex gap-2">
        <NeonButton
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            setMessage(null);
            try {
              const result = await fetchAggregatedOptions({
                level: "sport",
                parentFilters: {},
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

// Re-export the SportSelector for backward compatibility
export { default as SportSelector } from "./SportSelector";

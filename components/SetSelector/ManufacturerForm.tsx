import React, { useEffect, useRef, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { GenericId } from "convex/values";
import NeonButton from "../modules/NeonButton";

export default function ManufacturerForm({
  yearId,
  onDone,
}: {
  yearId: GenericId<"selectorOptions">;
  onDone?: () => void;
}) {
  const fetchAggregatedOptions = useAction(
    api.selectorOptions.fetchAggregatedOptions,
  );
  const ancestorChain = useQuery(api.selectorOptions.getAncestorChain, {
    id: yearId,
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const triggered = useRef(false);

  // Extract sport and year values from the ancestor chain
  const sportValue = ancestorChain?.find((a: { level: string }) => a.level === "sport")?.value;
  const yearValue = ancestorChain?.find((a: { level: string }) => a.level === "year")?.value;

  const doSync = async () => {
    if (!sportValue || !yearValue) return;
    setLoading(true);
    setMessage(null);
    try {
      const result = await fetchAggregatedOptions({
        level: "manufacturer",
        parentId: yearId,
        parentFilters: {
          sport: sportValue,
          year: yearValue,
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
    if (sportValue && yearValue && !triggered.current) {
      triggered.current = true;
      doSync();
    }
  }, [sportValue, yearValue]);

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">
        Syncing Manufacturer Options
      </h2>

      {loading && (
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Fetching manufacturer options for{" "}
          <strong>
            {yearValue || "..."} {sportValue || ""}
          </strong>{" "}
          from all connected platforms...
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

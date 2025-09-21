import React from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { GenericId } from "convex/values";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/solid";

export function SportForm({ onDone }: { onDone?: () => void }) {
  const updateSelectorOptions = useAction(
    api.myFunctions.updateSelectorOptions,
  );

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Update Sport Options</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        This will fetch the latest sport options from all connected platforms
        and update the database.
      </p>

      <div className="flex gap-2">
        <button
          onClick={async () => {
            try {
              const result = await updateSelectorOptions({
                level: "sport",
                parentFilters: {},
              });
              console.log("Updated sport options:", result);
              onDone?.();
            } catch (error) {
              console.error("Failed to update sport options:", error);
            }
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Update Sport Options
        </button>
        <button
          onClick={onDone}
          className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function SportSelector({
  selectedSportId,
  onSportSelect,
  expanded,
  setExpanded,
}: {
  selectedSportId: GenericId<"selectorOptions"> | null;
  onSportSelect: (id: GenericId<"selectorOptions">) => void;
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
}) {
  const sports = useQuery(api.myFunctions.getSelectorOptions, {
    level: "sport",
  });
  const selected = sports?.find((s) => s._id === selectedSportId);
  if (!sports) return <div>Loading sports...</div>;
  if (selectedSportId && selected && !expanded) {
    return (
      <div
        className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(true)}
      >
        <div>
          <div className="font-semibold">{selected.value}</div>
        </div>
        <ChevronDownIcon className="w-5 h-5 text-gray-500" />
      </div>
    );
  }
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Sports</h2>
        {selectedSportId && expanded && (
          <button
            onClick={() => setExpanded(false)}
            aria-label="Collapse"
            className="ml-2"
          >
            <ChevronUpIcon className="w-5 h-5 text-gray-500" />
          </button>
        )}
      </div>
      <div className="space-y-2">
        {sports.map((sport) => (
          <button
            key={sport._id}
            onClick={() => {
              onSportSelect(sport._id);
              setExpanded(false);
            }}
            className={`w-full text-left p-3 rounded-md border transition-colors ${
              selectedSportId === sport._id
                ? "bg-pink-100 dark:bg-pink-900 border-pink-300 dark:border-pink-700"
                : "bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600"
            }`}
          >
            <div className="font-semibold">{sport.value}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

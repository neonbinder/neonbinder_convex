import React from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { GenericId } from "convex/values";

export default function SetForm({
  manufacturerId: _manufacturerId,
  onDone,
}: {
  manufacturerId: GenericId<"selectorOptions">;
  onDone?: () => void;
}) {
  const updateSelectorOptions = useAction(
    api.myFunctions.updateSelectorOptions,
  );

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Update Set Options</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        This will fetch the latest set options from all connected platforms and
        update the database.
      </p>

      <div className="flex gap-2">
        <button
          onClick={async () => {
            try {
              const result = await updateSelectorOptions({
                level: "setName",
                // TODO: Look up manufacturer value from selectorOptions table using manufacturerId
                // parentFilters: { manufacturer: manufacturerValue },
              });
              console.log("Updated set options:", result);
              onDone?.();
            } catch (error) {
              console.error("Failed to update set options:", error);
            }
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Update Set Options
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

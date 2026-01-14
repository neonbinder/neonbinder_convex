import React from "react";
import type { GenericId } from "convex/values";

export default function ManufacturerForm({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  yearId: _yearId,
  onDone,
}: {
  yearId: GenericId<"selectorOptions">;
  onDone?: () => void;
}) {
  const [message, setMessage] = React.useState<string | null>(null);

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">
        Update Manufacturer Options
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        This will fetch the latest manufacturer options from all connected
        platforms and update the database.
      </p>

      {message && (
        <div className="p-3 mb-4 bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-md text-amber-800 dark:text-amber-200 text-sm">
          {message}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={async () => {
            // TODO: Implement proper year value lookup before calling updateSelectorOptions
            setMessage("Manufacturer sync is not yet fully implemented. Coming soon!");
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Update Manufacturer Options
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

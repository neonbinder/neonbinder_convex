import { useQuery } from "convex/react";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/solid";
import { FunctionReference } from "convex/server";

type EntitySelectorProps = {
  title: string;
  query: FunctionReference<"query">;
  queryArgs?: Record<string, unknown>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
  getDisplayName: (item: { _id: string; [key: string]: unknown }) => string;
  getDescription?: (item: {
    _id: string;
    [key: string]: unknown;
  }) => string | undefined;
  selectedColor: string;
};

export default function EntitySelector({
  title,
  query,
  queryArgs,
  selectedId,
  onSelect,
  expanded,
  setExpanded,
  getDisplayName,
  getDescription,
  selectedColor,
}: EntitySelectorProps) {
  const items = useQuery(query, queryArgs);
  const selected = items?.find(
    (item: { _id: string; [key: string]: unknown }) => item._id === selectedId,
  );

  if (!items) return <div>Loading {title.toLowerCase()}...</div>;

  // Sort items by their display names
  const sortedItems = [...items].sort((a, b) => {
    const nameA = getDisplayName(a);
    const nameB = getDisplayName(b);

    // Check if both values are numbers (for years)
    const numA = Number(nameA);
    const numB = Number(nameB);

    if (!isNaN(numA) && !isNaN(numB)) {
      // Sort numbers in descending order (newest first)
      return numB - numA;
    } else {
      // Sort strings alphabetically
      return nameA.localeCompare(nameB);
    }
  });

  if (selectedId && selected && !expanded) {
    return (
      <div
        className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(true)}
      >
        <div>
          <div className="font-semibold">{getDisplayName(selected)}</div>
          {getDescription && getDescription(selected) && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {getDescription(selected)}
            </div>
          )}
        </div>
        <ChevronDownIcon className="w-5 h-5 text-gray-500" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        {selectedId && expanded && (
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
        {sortedItems.map((item: { _id: string; [key: string]: unknown }) => (
          <button
            key={item._id}
            onClick={() => {
              onSelect(item._id);
              setExpanded(false);
            }}
            className={`w-full text-left p-3 rounded-md border transition-colors ${
              selectedId === item._id
                ? `${selectedColor}`
                : "bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600"
            }`}
          >
            <div className="font-semibold">{getDisplayName(item)}</div>
            {getDescription && getDescription(item) && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {getDescription(item)}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

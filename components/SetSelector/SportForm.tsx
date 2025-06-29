import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/solid";
import GenericEntityForm from "./GenericEntityForm";

export function SportForm({ onDone }: { onDone?: () => void }) {
  const createSport = useMutation(api.myFunctions.createSport);

  return (
    <GenericEntityForm
      title="Create Sport"
      fields={[
        {
          name: "name",
          label: "Sport Name",
          type: "text",
          placeholder: "e.g., Baseball, Basketball, Soccer",
          required: true,
        },
        {
          name: "description",
          label: "Description (optional)",
          type: "text",
          placeholder: "e.g., MLB, NBA, FIFA",
        },
      ]}
      submitLabel="Create Sport"
      onSubmit={async (values) => {
        await createSport({
          name: values.name,
          description: values.description || undefined,
        });
        onDone?.();
      }}
      onCancel={onDone!}
    />
  );
}

export function SportSelector({
  selectedSportId,
  onSportSelect,
  expanded,
  setExpanded,
}: {
  selectedSportId: Id<"sports"> | null;
  onSportSelect: (id: Id<"sports">) => void;
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
}) {
  const sports = useQuery(api.myFunctions.getSports);
  const selected = sports?.find((s) => s._id === selectedSportId);
  if (!sports) return <div>Loading sports...</div>;
  if (selectedSportId && selected && !expanded) {
    return (
      <div
        className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(true)}
      >
        <div>
          <div className="font-semibold">{selected.name}</div>
          {selected.description && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {selected.description}
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
            <div className="font-semibold">{sport.name}</div>
            {sport.description && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {sport.description}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

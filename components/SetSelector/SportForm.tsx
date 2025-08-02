import React, { useState, useEffect } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/solid";
import GenericEntityForm from "./GenericEntityForm";

interface StoredParameter {
  site: string;
  value: string;
}

export function SportForm({ onDone }: { onDone?: () => void }) {
  const createSport = useMutation(api.myFunctions.createSport);
  const getAvailableSetParameters = useAction(
    api.adapters.index.getAvailableSetParameters,
  );
  const [sites, setSites] = useState<StoredParameter[]>([]);
  const [siteOptions, setSiteOptions] = useState<
    { site: string; values: { label: string; value: string }[] }[]
  >([]);
  const [loadingSites, setLoadingSites] = useState(true);

  useEffect(() => {
    async function fetchSites() {
      setLoadingSites(true);
      try {
        const result = await getAvailableSetParameters({ partialParams: {} });
        const sportsOptions = result?.availableOptions?.sports;
        setSiteOptions(sportsOptions || []);
        // Default to one mapping for the first site/value
        if (sportsOptions && sportsOptions.length > 0) {
          setSites([
            {
              site: sportsOptions[0].site,
              value: sportsOptions[0].values[0]?.value || "",
            },
          ]);
        }
      } finally {
        setLoadingSites(false);
      }
    }
    fetchSites();
  }, [getAvailableSetParameters]);

  const handleSiteChange = (idx: number, newSite: string) => {
    const siteObj = siteOptions.find((s) => s.site === newSite);
    const newValue = siteObj?.values[0]?.value || "";
    setSites((prev) =>
      prev.map((s, i) => (i === idx ? { site: newSite, value: newValue } : s)),
    );
  };

  const handleValueChange = (idx: number, newValue: string) => {
    setSites((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, value: newValue } : s)),
    );
  };

  const handleAddMapping = () => {
    if (siteOptions.length === 0) return;
    setSites((prev) => [
      ...prev,
      {
        site: siteOptions[0].site,
        value: siteOptions[0].values[0]?.value || "",
      },
    ]);
  };

  const handleRemoveMapping = (idx: number) => {
    setSites((prev) => prev.filter((_, i) => i !== idx));
  };

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
          sites,
        });
        setSites([]);
        onDone?.();
      }}
      onCancel={onDone!}
    >
      <div className="mb-2">
        <label className="block text-xs font-medium mb-1">
          Sites (platform mapping)
        </label>
        {loadingSites ? (
          <div>Loading site options...</div>
        ) : (
          sites.map((siteObj, idx) => (
            <div key={idx} className="flex items-center gap-2 mb-1">
              <select
                className="w-1/3 p-1 border rounded-md"
                value={siteObj.site}
                onChange={(e) => handleSiteChange(idx, e.target.value)}
              >
                {siteOptions.map((opt) => (
                  <option key={opt.site} value={opt.site}>
                    {opt.site}
                  </option>
                ))}
              </select>
              <select
                className="w-2/3 p-1 border rounded-md"
                value={siteObj.value}
                onChange={(e) => handleValueChange(idx, e.target.value)}
              >
                {(
                  siteOptions.find((s) => s.site === siteObj.site)?.values || []
                ).map((val) => (
                  <option key={val.value} value={val.value}>
                    {val.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="text-red-500 text-xs"
                onClick={() => handleRemoveMapping(idx)}
                disabled={sites.length === 1}
              >
                Remove
              </button>
            </div>
          ))
        )}
        <button
          type="button"
          className="text-blue-600 text-xs mt-1"
          onClick={handleAddMapping}
          disabled={loadingSites || siteOptions.length === 0}
        >
          + Add Site Mapping
        </button>
      </div>
    </GenericEntityForm>
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

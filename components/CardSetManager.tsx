"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { useState } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/solid";
import NeonButton from "./NeonButton";

export default function CardSetManager() {
  const [selectedSportId, setSelectedSportId] = useState<Id<"sports"> | null>(
    null,
  );
  const [selectedYearId, setSelectedYearId] = useState<Id<"years"> | null>(
    null,
  );
  const [selectedManufacturerId, setSelectedManufacturerId] =
    useState<Id<"manufacturers"> | null>(null);
  const [selectedSetId, setSelectedSetId] = useState<Id<"sets"> | null>(null);
  const [selectedVariantId, setSelectedVariantId] =
    useState<Id<"setVariants"> | null>(null);

  // Toggle states for showing forms
  const [showSportForm, setShowSportForm] = useState(false);
  const [showYearForm, setShowYearForm] = useState(false);
  const [showManufacturerForm, setShowManufacturerForm] = useState(false);
  const [showSetForm, setShowSetForm] = useState(false);
  const [showVariantForm, setShowVariantForm] = useState(false);
  const [showCardForm, setShowCardForm] = useState(false);

  // Expanded state for each selector
  const [sportExpanded, setSportExpanded] = useState(false);
  const [yearExpanded, setYearExpanded] = useState(false);
  const [manufacturerExpanded, setManufacturerExpanded] = useState(false);
  const [setExpanded, setSetExpanded] = useState(false);
  const [variantExpanded, setVariantExpanded] = useState(false);

  // Reset downstream selections when a parent changes
  const handleSportSelect = (id: Id<"sports">) => {
    setSelectedSportId(id);
    setSelectedYearId(null);
    setSelectedManufacturerId(null);
    setSelectedSetId(null);
    setSelectedVariantId(null);
  };
  const handleYearSelect = (id: Id<"years">) => {
    setSelectedYearId(id);
    setSelectedManufacturerId(null);
    setSelectedSetId(null);
    setSelectedVariantId(null);
  };
  const handleManufacturerSelect = (id: Id<"manufacturers">) => {
    setSelectedManufacturerId(id);
    setSelectedSetId(null);
    setSelectedVariantId(null);
  };
  const handleSetSelect = (id: Id<"sets">) => {
    setSelectedSetId(id);
    setSelectedVariantId(null);
  };
  const handleVariantSelect = (id: Id<"setVariants">) => {
    setSelectedVariantId(id);
  };

  return (
    <div className="max-w-full mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8 text-center">Card Set Manager</h1>
      <div className="flex flex-row gap-4 overflow-x-auto">
        {/* Sport Column */}
        <div className="min-w-[260px] flex flex-col gap-4">
          <SportSelector
            selectedSportId={selectedSportId}
            onSportSelect={handleSportSelect}
            expanded={sportExpanded}
            setExpanded={setSportExpanded}
          />
          {(sportExpanded || !selectedSportId) &&
            (showSportForm ? (
              <SportForm onDone={() => setShowSportForm(false)} />
            ) : (
              <NeonButton onClick={() => setShowSportForm(true)}>
                Add Sport
              </NeonButton>
            ))}
        </div>
        {/* Year Column */}
        {selectedSportId && (
          <div className="min-w-[260px] flex flex-col gap-4">
            <YearSelector
              sportId={selectedSportId}
              selectedYearId={selectedYearId}
              onYearSelect={handleYearSelect}
              expanded={yearExpanded}
              setExpanded={setYearExpanded}
            />
            {(yearExpanded || !selectedYearId) &&
              (showYearForm ? (
                <YearForm
                  sportId={selectedSportId}
                  onDone={() => setShowYearForm(false)}
                />
              ) : (
                <NeonButton onClick={() => setShowYearForm(true)}>
                  Add Year
                </NeonButton>
              ))}
          </div>
        )}
        {/* Manufacturer Column */}
        {selectedYearId && (
          <div className="min-w-[260px] flex flex-col gap-4">
            <ManufacturerSelector
              yearId={selectedYearId}
              selectedManufacturerId={selectedManufacturerId}
              onManufacturerSelect={handleManufacturerSelect}
              expanded={manufacturerExpanded}
              setExpanded={setManufacturerExpanded}
            />
            {(manufacturerExpanded || !selectedManufacturerId) &&
              (showManufacturerForm ? (
                <ManufacturerForm
                  yearId={selectedYearId}
                  onDone={() => setShowManufacturerForm(false)}
                />
              ) : (
                <NeonButton onClick={() => setShowManufacturerForm(true)}>
                  Add Manufacturer
                </NeonButton>
              ))}
          </div>
        )}
        {/* Set Column */}
        {selectedManufacturerId && (
          <div className="min-w-[260px] flex flex-col gap-4">
            <SetSelector
              manufacturerId={selectedManufacturerId}
              selectedSetId={selectedSetId}
              onSetSelect={handleSetSelect}
              expanded={setExpanded}
              setExpanded={setSetExpanded}
            />
            {(setExpanded || !selectedSetId) &&
              (showSetForm ? (
                <SetForm
                  manufacturerId={selectedManufacturerId}
                  onDone={() => setShowSetForm(false)}
                />
              ) : (
                <NeonButton onClick={() => setShowSetForm(true)}>
                  Add Set
                </NeonButton>
              ))}
          </div>
        )}
        {/* Set Variant Column */}
        {selectedSetId && (
          <div className="min-w-[260px] flex flex-col gap-4">
            <SetVariantSelector
              setId={selectedSetId}
              selectedVariantId={selectedVariantId}
              onVariantSelect={handleVariantSelect}
              expanded={variantExpanded}
              setExpanded={setVariantExpanded}
            />
            {(variantExpanded || !selectedVariantId) &&
              (showVariantForm ? (
                <SetVariantForm
                  setId={selectedSetId}
                  onDone={() => setShowVariantForm(false)}
                />
              ) : (
                <NeonButton onClick={() => setShowVariantForm(true)}>
                  Add Variant
                </NeonButton>
              ))}
          </div>
        )}
        {/* Cards Column */}
        {selectedVariantId && (
          <div className="min-w-[260px] flex flex-col gap-4">
            <CardList setVariantId={selectedVariantId} />
            {showCardForm ? (
              <CardForm
                setVariantId={selectedVariantId}
                onDone={() => setShowCardForm(false)}
              />
            ) : (
              <NeonButton onClick={() => setShowCardForm(true)}>
                Add Card
              </NeonButton>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SportSelector({
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

function SportForm({ onDone }: { onDone?: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const createSport = useMutation(api.myFunctions.createSport);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    try {
      await createSport({ name, description: description || undefined });
      setName("");
      setDescription("");
      onDone?.();
    } catch (error) {
      console.error("Error creating sport:", error);
    }
  };
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Create Sport</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Sport Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            placeholder="e.g., Baseball, Basketball, Soccer"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">
            Description (optional)
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            placeholder="e.g., MLB, NBA, FIFA"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 bg-neon-green text-white py-2 px-4 rounded-md hover:bg-neon-yellow hover:text-black transition-colors"
          >
            Create Sport
          </button>
          <NeonButton cancel onClick={onDone}>
            Cancel
          </NeonButton>
        </div>
      </form>
    </div>
  );
}

function YearForm({
  sportId,
  onDone,
}: {
  sportId: Id<"sports">;
  onDone?: () => void;
}) {
  const [year, setYear] = useState("");
  const [description, setDescription] = useState("");
  const createYear = useMutation(api.myFunctions.createYear);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!year) return;
    try {
      await createYear({
        sportId,
        year: parseInt(year),
        description: description || undefined,
      });
      setYear("");
      setDescription("");
      onDone?.();
    } catch (error) {
      console.error("Error creating year:", error);
    }
  };
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Create Year</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Year</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            placeholder="e.g., 2024"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">
            Description (optional)
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            placeholder="e.g., Great year for baseball cards"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 bg-neon-green text-white py-2 px-4 rounded-md hover:bg-neon-yellow hover:text-black transition-colors"
          >
            Create Year
          </button>
          <NeonButton cancel onClick={onDone}>
            Cancel
          </NeonButton>
        </div>
      </form>
    </div>
  );
}

function YearSelector({
  sportId,
  selectedYearId,
  onYearSelect,
  expanded,
  setExpanded,
}: {
  sportId: Id<"sports">;
  selectedYearId: Id<"years"> | null;
  onYearSelect: (id: Id<"years">) => void;
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
}) {
  const years = useQuery(api.myFunctions.getYearsBySport, { sportId });
  const selected = years?.find((y) => y._id === selectedYearId);
  if (!years) return <div>Loading years...</div>;
  if (selectedYearId && selected && !expanded) {
    return (
      <div
        className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(true)}
      >
        <div>
          <div className="font-semibold">{selected.year}</div>
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
        <h2 className="text-xl font-semibold">Years</h2>
        {selectedYearId && expanded && (
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
        {years.map((year) => (
          <button
            key={year._id}
            onClick={() => {
              onYearSelect(year._id);
              setExpanded(false);
            }}
            className={`w-full text-left p-3 rounded-md border transition-colors ${
              selectedYearId === year._id
                ? "bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700"
                : "bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600"
            }`}
          >
            <div className="font-semibold">{year.year}</div>
            {year.description && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {year.description}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function ManufacturerForm({
  yearId,
  onDone,
}: {
  yearId: Id<"years">;
  onDone?: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const createManufacturer = useMutation(api.myFunctions.createManufacturer);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    try {
      await createManufacturer({
        yearId,
        name,
        description: description || undefined,
      });
      setName("");
      setDescription("");
      onDone?.();
    } catch (error) {
      console.error("Error creating manufacturer:", error);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Create Manufacturer</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            placeholder="e.g., Topps, Panini, Upper Deck"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">
            Description (optional)
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            placeholder="e.g., Leading baseball card manufacturer"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 bg-neon-green text-white py-2 px-4 rounded-md hover:bg-neon-yellow hover:text-black transition-colors"
          >
            Create Manufacturer
          </button>
          <NeonButton cancel onClick={onDone}>
            Cancel
          </NeonButton>
        </div>
      </form>
    </div>
  );
}

function SetForm({
  manufacturerId,
  onDone,
}: {
  manufacturerId: Id<"manufacturers">;
  onDone?: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const createSet = useMutation(api.myFunctions.createSet);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    try {
      await createSet({
        manufacturerId,
        name,
        description: description || undefined,
      });
      setName("");
      setDescription("");
      onDone?.();
    } catch (error) {
      console.error("Error creating set:", error);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Create Set</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Set Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            placeholder="e.g., Series 1, Chrome, Heritage"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">
            Description (optional)
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            placeholder="e.g., Main flagship set"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 bg-neon-green text-white py-2 px-4 rounded-md hover:bg-neon-yellow hover:text-black transition-colors"
          >
            Create Set
          </button>
          <NeonButton cancel onClick={onDone}>
            Cancel
          </NeonButton>
        </div>
      </form>
    </div>
  );
}

function SetVariantForm({
  setId,
  onDone,
}: {
  setId: Id<"sets">;
  onDone?: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [variantType, setVariantType] = useState<
    "base" | "parallel" | "insert" | "parallel_of_insert"
  >("base");
  const [parallelName, setParallelName] = useState("");
  const [insertName, setInsertName] = useState("");
  const [parentVariantId, setParentVariantId] = useState("");
  const createSetVariant = useMutation(api.myFunctions.createSetVariant);
  const variants = useQuery(api.myFunctions.getSetVariantsBySet, { setId });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    try {
      await createSetVariant({
        setId,
        name,
        description: description || undefined,
        variantType,
        parallelName:
          variantType === "parallel" || variantType === "parallel_of_insert"
            ? parallelName
            : undefined,
        insertName: variantType === "insert" ? insertName : undefined,
        parentVariantId:
          variantType === "parallel_of_insert"
            ? (parentVariantId as Id<"setVariants">)
            : undefined,
      });
      setName("");
      setDescription("");
      setParallelName("");
      setInsertName("");
      setParentVariantId("");
      onDone?.();
    } catch (error) {
      console.error("Error creating set variant:", error);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Create Set Variant</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Variant Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            placeholder="e.g., Base Set, Gold Parallel, All-Star Insert"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Variant Type</label>
          <select
            value={variantType}
            onChange={(e) =>
              setVariantType(
                e.target.value as
                  | "base"
                  | "parallel"
                  | "insert"
                  | "parallel_of_insert",
              )
            }
            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
          >
            <option value="base">Base Set</option>
            <option value="parallel">Parallel</option>
            <option value="insert">Insert</option>
            <option value="parallel_of_insert">Parallel of Insert</option>
          </select>
        </div>
        {(variantType === "parallel" ||
          variantType === "parallel_of_insert") && (
          <div>
            <label className="block text-sm font-medium mb-2">
              Parallel Name
            </label>
            <input
              type="text"
              value={parallelName}
              onChange={(e) => setParallelName(e.target.value)}
              className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              placeholder="e.g., Gold, Silver, Refractor"
              required
            />
          </div>
        )}
        {variantType === "insert" && (
          <div>
            <label className="block text-sm font-medium mb-2">
              Insert Name
            </label>
            <input
              type="text"
              value={insertName}
              onChange={(e) => setInsertName(e.target.value)}
              className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              placeholder="e.g., All-Star, Rookie, Legend"
              required
            />
          </div>
        )}
        {variantType === "parallel_of_insert" && variants && (
          <div>
            <label className="block text-sm font-medium mb-2">
              Parent Insert Variant
            </label>
            <select
              value={parentVariantId}
              onChange={(e) => setParentVariantId(e.target.value)}
              className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              required
            >
              <option value="">Select an insert variant</option>
              {variants
                .filter((v) => v.variantType === "insert")
                .map((variant) => (
                  <option key={variant._id} value={variant._id}>
                    {variant.name}{" "}
                    {variant.insertName && `(${variant.insertName})`}
                  </option>
                ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-2">
            Description (optional)
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            placeholder="e.g., Main base set, Limited gold parallel"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 bg-neon-green text-white py-2 px-4 rounded-md hover:bg-neon-yellow hover:text-black transition-colors"
          >
            Create Set Variant
          </button>
          <NeonButton cancel onClick={onDone}>
            Cancel
          </NeonButton>
        </div>
      </form>
    </div>
  );
}

function CardForm({
  setVariantId,
  onDone,
}: {
  setVariantId: Id<"setVariants">;
  onDone?: () => void;
}) {
  const [cardNumber, setCardNumber] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [team, setTeam] = useState("");
  const [position, setPosition] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const createCard = useMutation(api.myFunctions.createCard);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardNumber) return;
    try {
      await createCard({
        setVariantId,
        cardNumber,
        playerName: playerName || undefined,
        team: team || undefined,
        position: position || undefined,
        description: description || undefined,
        imageUrl: imageUrl || undefined,
      });
      setCardNumber("");
      setPlayerName("");
      setTeam("");
      setPosition("");
      setDescription("");
      setImageUrl("");
      onDone?.();
    } catch (error) {
      console.error("Error creating card:", error);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Add Card</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Card Number</label>
          <input
            type="text"
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value)}
            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            placeholder="e.g., 1, 2A, 2B"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">
            Player Name (optional)
          </label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            placeholder="e.g., Mike Trout"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">
            Team (optional)
          </label>
          <input
            type="text"
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            placeholder="e.g., Los Angeles Angels"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">
            Position (optional)
          </label>
          <input
            type="text"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            placeholder="e.g., CF, P, C"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">
            Description (optional)
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            placeholder="e.g., Rookie card, All-Star"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">
            Image URL (optional)
          </label>
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            placeholder="https://example.com/card-image.jpg"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 bg-neon-green text-white py-2 px-4 rounded-md hover:bg-neon-yellow hover:text-black transition-colors"
          >
            Add Card
          </button>
          <NeonButton cancel onClick={onDone}>
            Cancel
          </NeonButton>
        </div>
      </form>
    </div>
  );
}

function ManufacturerSelector({
  yearId,
  selectedManufacturerId,
  onManufacturerSelect,
  expanded,
  setExpanded,
}: {
  yearId: Id<"years">;
  selectedManufacturerId: Id<"manufacturers"> | null;
  onManufacturerSelect: (manufacturerId: Id<"manufacturers">) => void;
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
}) {
  const manufacturers = useQuery(api.myFunctions.getManufacturersByYear, {
    yearId,
  });
  const selected = manufacturers?.find((m) => m._id === selectedManufacturerId);
  if (!manufacturers) return <div>Loading manufacturers...</div>;
  if (selectedManufacturerId && selected && !expanded) {
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
        <h2 className="text-xl font-semibold">Manufacturers</h2>
        {selectedManufacturerId && expanded && (
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
        {manufacturers.map((manufacturer) => (
          <button
            key={manufacturer._id}
            onClick={() => {
              onManufacturerSelect(manufacturer._id);
              setExpanded(false);
            }}
            className={`w-full text-left p-3 rounded-md border transition-colors ${
              selectedManufacturerId === manufacturer._id
                ? "bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700"
                : "bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600"
            }`}
          >
            <div className="font-semibold">{manufacturer.name}</div>
            {manufacturer.description && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {manufacturer.description}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function SetSelector({
  manufacturerId,
  selectedSetId,
  onSetSelect,
  expanded,
  setExpanded,
}: {
  manufacturerId: Id<"manufacturers">;
  selectedSetId: Id<"sets"> | null;
  onSetSelect: (setId: Id<"sets">) => void;
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
}) {
  const sets = useQuery(api.myFunctions.getSetsByManufacturer, {
    manufacturerId,
  });
  const selected = sets?.find((s) => s._id === selectedSetId);
  if (!sets) return <div>Loading sets...</div>;
  if (selectedSetId && selected && !expanded) {
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
        <h2 className="text-xl font-semibold">Sets</h2>
        {selectedSetId && expanded && (
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
        {sets.map((set) => (
          <button
            key={set._id}
            onClick={() => {
              onSetSelect(set._id);
              setExpanded(false);
            }}
            className={`w-full text-left p-3 rounded-md border transition-colors ${
              selectedSetId === set._id
                ? "bg-purple-100 dark:bg-purple-900 border-purple-300 dark:border-purple-700"
                : "bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600"
            }`}
          >
            <div className="font-semibold">{set.name}</div>
            {set.description && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {set.description}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function SetVariantSelector({
  setId,
  selectedVariantId,
  onVariantSelect,
  expanded,
  setExpanded,
}: {
  setId: Id<"sets">;
  selectedVariantId: Id<"setVariants"> | null;
  onVariantSelect: (variantId: Id<"setVariants">) => void;
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
}) {
  const variants = useQuery(api.myFunctions.getSetVariantsBySet, { setId });
  const selected = variants?.find((v) => v._id === selectedVariantId);
  if (!variants) return <div>Loading set variants...</div>;
  if (selectedVariantId && selected && !expanded) {
    return (
      <div
        className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(true)}
      >
        <div>
          <div className="font-semibold">{selected.name}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Type: {selected.variantType}
            {selected.variantType === "parallel" &&
              selected.parallelName &&
              ` - ${selected.parallelName}`}
            {selected.variantType === "insert" &&
              selected.insertName &&
              ` - ${selected.insertName}`}
            {selected.variantType === "parallel_of_insert" &&
              selected.parallelName &&
              ` - ${selected.parallelName}`}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Cards: {selected.cardCount}
          </div>
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
        <h2 className="text-xl font-semibold">Set Variants</h2>
        {selectedVariantId && expanded && (
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
        {variants.map((variant) => (
          <button
            key={variant._id}
            onClick={() => {
              onVariantSelect(variant._id);
              setExpanded(false);
            }}
            className={`w-full text-left p-3 rounded-md border transition-colors ${
              selectedVariantId === variant._id
                ? "bg-indigo-100 dark:bg-indigo-900 border-indigo-300 dark:border-indigo-700"
                : "bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600"
            }`}
          >
            <div className="font-semibold">{variant.name}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Type: {variant.variantType}
              {variant.variantType === "parallel" &&
                variant.parallelName &&
                ` - ${variant.parallelName}`}
              {variant.variantType === "insert" &&
                variant.insertName &&
                ` - ${variant.insertName}`}
              {variant.variantType === "parallel_of_insert" &&
                variant.parallelName &&
                ` - ${variant.parallelName}`}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Cards: {variant.cardCount}
            </div>
            {variant.description && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {variant.description}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function CardList({ setVariantId }: { setVariantId: Id<"setVariants"> }) {
  const cards = useQuery(api.myFunctions.getCardsBySetVariant, {
    setVariantId,
  });

  if (!cards) return <div>Loading cards...</div>;

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Cards ({cards.length})</h2>
      <div className="space-y-2">
        {cards.map((card) => (
          <div
            key={card._id}
            className="p-3 border border-gray-200 dark:border-gray-600 rounded-md"
          >
            <div className="font-semibold">#{card.cardNumber}</div>
            {card.playerName && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Player: {card.playerName}
              </div>
            )}
            {card.team && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Team: {card.team}
              </div>
            )}
            {card.position && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Position: {card.position}
              </div>
            )}
            {card.description && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {card.description}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

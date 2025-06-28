"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { useState } from "react";

export default function CardSetManager() {
  const [selectedYearId, setSelectedYearId] = useState<Id<"years"> | null>(
    null,
  );
  const [selectedManufacturerId, setSelectedManufacturerId] =
    useState<Id<"manufacturers"> | null>(null);
  const [selectedSetId, setSelectedSetId] = useState<Id<"sets"> | null>(null);
  const [selectedVariantId, setSelectedVariantId] =
    useState<Id<"setVariants"> | null>(null);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8 text-center">Card Set Manager</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column - Forms */}
        <div className="space-y-6">
          <YearForm />
          {selectedYearId && <ManufacturerForm yearId={selectedYearId} />}
          {selectedManufacturerId && (
            <SetForm manufacturerId={selectedManufacturerId} />
          )}
          {selectedSetId && <SetVariantForm setId={selectedSetId} />}
          {selectedVariantId && <CardForm setVariantId={selectedVariantId} />}
        </div>

        {/* Right Column - Hierarchy Display */}
        <div className="space-y-6">
          <YearSelector
            selectedYearId={selectedYearId}
            onYearSelect={setSelectedYearId}
          />
          {selectedYearId && (
            <ManufacturerSelector
              yearId={selectedYearId}
              selectedManufacturerId={selectedManufacturerId}
              onManufacturerSelect={setSelectedManufacturerId}
            />
          )}
          {selectedManufacturerId && (
            <SetSelector
              manufacturerId={selectedManufacturerId}
              selectedSetId={selectedSetId}
              onSetSelect={setSelectedSetId}
            />
          )}
          {selectedSetId && (
            <SetVariantSelector
              setId={selectedSetId}
              selectedVariantId={selectedVariantId}
              onVariantSelect={setSelectedVariantId}
            />
          )}
          {selectedVariantId && <CardList setVariantId={selectedVariantId} />}
        </div>
      </div>
    </div>
  );
}

function YearForm() {
  const [year, setYear] = useState("");
  const [description, setDescription] = useState("");
  const createYear = useMutation(api.myFunctions.createYear);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!year) return;

    try {
      await createYear({
        year: parseInt(year),
        description: description || undefined,
      });
      setYear("");
      setDescription("");
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
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
        >
          Create Year
        </button>
      </form>
    </div>
  );
}

function ManufacturerForm({ yearId }: { yearId: Id<"years"> }) {
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
        <button
          type="submit"
          className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700"
        >
          Create Manufacturer
        </button>
      </form>
    </div>
  );
}

function SetForm({ manufacturerId }: { manufacturerId: Id<"manufacturers"> }) {
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
        <button
          type="submit"
          className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700"
        >
          Create Set
        </button>
      </form>
    </div>
  );
}

function SetVariantForm({ setId }: { setId: Id<"sets"> }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [variantType, setVariantType] = useState<
    "base" | "parallel" | "insert" | "parallel_of_insert"
  >("base");
  const [parallelName, setParallelName] = useState("");
  const [insertName, setInsertName] = useState("");
  const [parentVariantId, setParentVariantId] = useState("");
  const createSetVariant = useMutation(api.myFunctions.createSetVariant);

  // Get existing variants for parent selection
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
        <button
          type="submit"
          className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700"
        >
          Create Set Variant
        </button>
      </form>
    </div>
  );
}

function CardForm({ setVariantId }: { setVariantId: Id<"setVariants"> }) {
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
        <button
          type="submit"
          className="w-full bg-orange-600 text-white py-2 px-4 rounded-md hover:bg-orange-700"
        >
          Add Card
        </button>
      </form>
    </div>
  );
}

function YearSelector({
  selectedYearId,
  onYearSelect,
}: {
  selectedYearId: Id<"years"> | null;
  onYearSelect: (yearId: Id<"years">) => void;
}) {
  const years = useQuery(api.myFunctions.getYears);

  if (!years) return <div>Loading years...</div>;

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Years</h2>
      <div className="space-y-2">
        {years.map((year) => (
          <button
            key={year._id}
            onClick={() => onYearSelect(year._id)}
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

function ManufacturerSelector({
  yearId,
  selectedManufacturerId,
  onManufacturerSelect,
}: {
  yearId: Id<"years">;
  selectedManufacturerId: Id<"manufacturers"> | null;
  onManufacturerSelect: (manufacturerId: Id<"manufacturers">) => void;
}) {
  const manufacturers = useQuery(api.myFunctions.getManufacturersByYear, {
    yearId,
  });

  if (!manufacturers) return <div>Loading manufacturers...</div>;

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Manufacturers</h2>
      <div className="space-y-2">
        {manufacturers.map((manufacturer) => (
          <button
            key={manufacturer._id}
            onClick={() => onManufacturerSelect(manufacturer._id)}
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
}: {
  manufacturerId: Id<"manufacturers">;
  selectedSetId: Id<"sets"> | null;
  onSetSelect: (setId: Id<"sets">) => void;
}) {
  const sets = useQuery(api.myFunctions.getSetsByManufacturer, {
    manufacturerId,
  });

  if (!sets) return <div>Loading sets...</div>;

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Sets</h2>
      <div className="space-y-2">
        {sets.map((set) => (
          <button
            key={set._id}
            onClick={() => onSetSelect(set._id)}
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
}: {
  setId: Id<"sets">;
  selectedVariantId: Id<"setVariants"> | null;
  onVariantSelect: (variantId: Id<"setVariants">) => void;
}) {
  const variants = useQuery(api.myFunctions.getSetVariantsBySet, { setId });

  if (!variants) return <div>Loading set variants...</div>;

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Set Variants</h2>
      <div className="space-y-2">
        {variants.map((variant) => (
          <button
            key={variant._id}
            onClick={() => onVariantSelect(variant._id)}
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

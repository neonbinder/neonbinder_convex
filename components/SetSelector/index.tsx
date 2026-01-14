"use client";

import type { GenericId } from "convex/values";
import { useState } from "react";

// Import the new selector components
import SportSelector from "./SportSelector";
import YearSelector from "./YearSelector";
import ManufacturerSelector from "./ManufacturerSelector";
import SetSelector from "./SetSelector";
import SetVariantSelector from "./SetVariantSelector";

// Import the form components
import { SportForm } from "./SportForm";
import YearForm from "./YearForm";
import ManufacturerForm from "./ManufacturerForm";
import SetForm from "./SetForm";
import SetVariantForm from "./SetVariantForm";

// Import the EntityColumn component
import EntityColumn from "./EntityColumn";

export default function CardSetManager() {
  const [selectedSportId, setSelectedSportId] =
    useState<GenericId<"selectorOptions"> | null>(null);
  const [selectedYearId, setSelectedYearId] =
    useState<GenericId<"selectorOptions"> | null>(null);
  const [selectedManufacturerId, setSelectedManufacturerId] =
    useState<GenericId<"selectorOptions"> | null>(null);
  const [selectedSetId, setSelectedSetId] = useState<GenericId<"selectorOptions"> | null>(
    null,
  );
  const [selectedVariantId, setSelectedVariantId] =
    useState<GenericId<"selectorOptions"> | null>(null);

  // Expanded state for each selector
  const [sportExpanded, setSportExpanded] = useState(false);
  const [yearExpanded, setYearExpanded] = useState(false);
  const [manufacturerExpanded, setManufacturerExpanded] = useState(false);
  const [setExpanded, setSetExpanded] = useState(false);
  const [variantExpanded, setVariantExpanded] = useState(false);

  // Reset downstream selections when a parent changes
  const handleSportSelect = (id: GenericId<"selectorOptions">) => {
    setSelectedSportId(id);
    setSelectedYearId(null);
    setSelectedManufacturerId(null);
    setSelectedSetId(null);
    setSelectedVariantId(null);
  };
  const handleYearSelect = (id: GenericId<"selectorOptions">) => {
    setSelectedYearId(id);
    setSelectedManufacturerId(null);
    setSelectedSetId(null);
    setSelectedVariantId(null);
  };
  const handleManufacturerSelect = (id: GenericId<"selectorOptions">) => {
    setSelectedManufacturerId(id);
    setSelectedSetId(null);
    setSelectedVariantId(null);
  };
  const handleSetSelect = (id: GenericId<"selectorOptions">) => {
    setSelectedSetId(id);
    setSelectedVariantId(null);
  };
  const handleVariantSelect = (id: GenericId<"selectorOptions">) => {
    setSelectedVariantId(id);
  };

  return (
    <div className="max-w-full mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8 text-center">Card Set Manager</h1>
      <div className="flex flex-row gap-4 overflow-x-auto">
        {/* Sport Column */}
        <EntityColumn
          selector={
            <SportSelector
              selectedSportId={selectedSportId}
              onSportSelect={handleSportSelect}
              expanded={sportExpanded}
              setExpanded={setSportExpanded}
            />
          }
          renderForm={(onDone) => <SportForm onDone={onDone} />}
          addButtonText="Add Sport"
          isVisible={true}
        />

        {/* Year Column */}
        <EntityColumn
          selector={
            <YearSelector
              sportId={selectedSportId!}
              selectedYearId={selectedYearId}
              onYearSelect={handleYearSelect}
              expanded={yearExpanded}
              setExpanded={setYearExpanded}
            />
          }
          renderForm={(onDone) => (
            <YearForm sportId={selectedSportId!} onDone={onDone} />
          )}
          addButtonText="Add Year"
          isVisible={!!selectedSportId}
        />

        {/* Manufacturer Column */}
        <EntityColumn
          selector={
            <ManufacturerSelector
              yearId={selectedYearId!}
              selectedManufacturerId={selectedManufacturerId}
              onManufacturerSelect={handleManufacturerSelect}
              expanded={manufacturerExpanded}
              setExpanded={setManufacturerExpanded}
            />
          }
          renderForm={(onDone) => (
            <ManufacturerForm yearId={selectedYearId!} onDone={onDone} />
          )}
          addButtonText="Add Manufacturer"
          isVisible={!!selectedYearId}
        />

        {/* Set Column */}
        <EntityColumn
          selector={
            <SetSelector
              manufacturerId={selectedManufacturerId!}
              selectedSetId={selectedSetId}
              onSetSelect={handleSetSelect}
              expanded={setExpanded}
              setExpanded={setSetExpanded}
            />
          }
          renderForm={(onDone) => (
            <SetForm manufacturerId={selectedManufacturerId!} onDone={onDone} />
          )}
          addButtonText="Add Set"
          isVisible={!!selectedManufacturerId}
        />

        {/* Set Variant Column */}
        <EntityColumn
          selector={
            <SetVariantSelector
              setId={selectedSetId!}
              selectedVariantId={selectedVariantId}
              onVariantSelect={handleVariantSelect}
              expanded={variantExpanded}
              setExpanded={setVariantExpanded}
            />
          }
          renderForm={(onDone) => (
            <SetVariantForm setId={selectedSetId!} onDone={onDone} />
          )}
          addButtonText="Add Variant"
          isVisible={!!selectedSetId}
        />

        {/* Cards Column */}
        {selectedVariantId && (
          <div className="min-w-[260px] flex flex-col gap-4">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">Cards</h2>
              <p className="text-gray-600 dark:text-gray-400">
                Card management coming soon...
              </p>
            </div>
            <button className="bg-neon-green text-white py-2 px-4 rounded-md hover:bg-neon-yellow hover:text-black transition-colors">
              Add Card
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

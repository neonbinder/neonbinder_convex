"use client";

import { Id } from "../convex/_generated/dataModel";
import { useState } from "react";

// Import the new selector components
import SportSelector from "./SetSelector/SportSelector";
import YearSelector from "./SetSelector/YearSelector";
import ManufacturerSelector from "./SetSelector/ManufacturerSelector";
import SetSelectorComponent from "./SetSelector/SetSelector";
import SetVariantSelector from "./SetSelector/SetVariantSelector";

// Import the form components
import { SportForm } from "./SetSelector/SportForm";
import YearForm from "./SetSelector/YearForm";
import ManufacturerForm from "./SetSelector/ManufacturerForm";
import SetForm from "./SetSelector/SetForm";
import SetVariantForm from "./SetSelector/SetVariantForm";

// Import the EntityColumn component
import EntityColumn from "./SetSelector/EntityColumn";

export default function SetSelector() {
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
      <h1 className="text-3xl font-bold mb-8 text-center">Set Selector</h1>
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
            <SetSelectorComponent
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

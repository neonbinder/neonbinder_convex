"use client";

import type { GenericId } from "convex/values";
import { useState } from "react";

import SportSelector from "../SetSelector/SportSelector";
import YearSelector from "../SetSelector/YearSelector";
import ManufacturerSelector from "../SetSelector/ManufacturerSelector";
import SetSelectorComponent from "../SetSelector/SetSelector";
import SetVariantSelector from "../SetSelector/SetVariantSelector";
import VariantSelector from "../SetSelector/VariantSelector";
import ParallelSelector from "../SetSelector/ParallelSelector";

import { SportForm } from "../SetSelector/SportForm";
import YearForm from "../SetSelector/YearForm";
import ManufacturerForm from "../SetSelector/ManufacturerForm";
import SetForm from "../SetSelector/SetForm";
import SetVariantForm from "../SetSelector/SetVariantForm";
import VariantForm from "../SetSelector/VariantForm";
import ParallelForm from "../SetSelector/ParallelForm";

import EntityColumn from "../SetSelector/EntityColumn";
import CardChecklist from "../SetSelector/CardChecklist";
import VariantMetadataEditor from "../SetSelector/VariantMetadataEditor";

export default function SetSelector() {
  // Level 1: Sport
  const [selectedSportId, setSelectedSportId] =
    useState<GenericId<"selectorOptions"> | null>(null);
  // Level 2: Year
  const [selectedYearId, setSelectedYearId] =
    useState<GenericId<"selectorOptions"> | null>(null);
  // Level 3: Manufacturer (SL only)
  const [selectedManufacturerId, setSelectedManufacturerId] =
    useState<GenericId<"selectorOptions"> | null>(null);
  // Level 4: Set (BSC only)
  const [selectedSetId, setSelectedSetId] =
    useState<GenericId<"selectorOptions"> | null>(null);
  // Level 5: Variant Type (BSC only)
  const [selectedVariantTypeId, setSelectedVariantTypeId] =
    useState<GenericId<"selectorOptions"> | null>(null);
  // Level 6: Variant (reconciled BSC + SL)
  const [selectedVariantId, setSelectedVariantId] =
    useState<GenericId<"selectorOptions"> | null>(null);
  // Level 7: Variant of Variant (NB only)
  const [selectedVariantOfVariantId, setSelectedVariantOfVariantId] =
    useState<GenericId<"selectorOptions"> | null>(null);

  const [sportExpanded, setSportExpanded] = useState(false);
  const [yearExpanded, setYearExpanded] = useState(false);
  const [manufacturerExpanded, setManufacturerExpanded] = useState(false);
  const [setExpanded, setSetExpanded] = useState(false);
  const [variantTypeExpanded, setVariantTypeExpanded] = useState(false);
  const [variantExpanded, setVariantExpanded] = useState(false);
  const [variantOfVariantExpanded, setVariantOfVariantExpanded] = useState(false);

  const clearFrom = (level: number) => {
    if (level <= 2) setSelectedYearId(null);
    if (level <= 3) setSelectedManufacturerId(null);
    if (level <= 4) setSelectedSetId(null);
    if (level <= 5) setSelectedVariantTypeId(null);
    if (level <= 6) setSelectedVariantId(null);
    if (level <= 7) setSelectedVariantOfVariantId(null);
  };

  const handleSportSelect = (id: GenericId<"selectorOptions">) => {
    setSelectedSportId(id);
    clearFrom(2);
  };
  const handleYearSelect = (id: GenericId<"selectorOptions">) => {
    setSelectedYearId(id);
    clearFrom(3);
  };
  const handleManufacturerSelect = (id: GenericId<"selectorOptions">) => {
    setSelectedManufacturerId(id);
    clearFrom(4);
  };
  const handleSetSelect = (id: GenericId<"selectorOptions">) => {
    setSelectedSetId(id);
    clearFrom(5);
  };
  const handleVariantTypeSelect = (id: GenericId<"selectorOptions">) => {
    setSelectedVariantTypeId(id);
    clearFrom(6);
  };
  const handleVariantSelect = (id: GenericId<"selectorOptions">) => {
    setSelectedVariantId(id);
    clearFrom(7);
  };
  const handleVariantOfVariantSelect = (id: GenericId<"selectorOptions">) => {
    setSelectedVariantOfVariantId(id);
  };

  // CardChecklist attaches to the deepest selected node
  const cardChecklistId = selectedVariantOfVariantId || selectedVariantId;

  return (
    <div className="max-w-full mx-auto p-6 flex flex-col gap-6">
      <div className="flex flex-row gap-4 overflow-x-auto">
        {/* 1. Sport (SL & BSC) */}
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
          addButtonText="Sync Sports"
          isVisible={true}
          level="sport"
        />

        {/* 2. Year (SL & BSC) */}
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
          addButtonText="Sync Years"
          isVisible={!!selectedSportId}
          level="year"
          parentId={selectedSportId || undefined}
        />

        {/* 3. Manufacturer (SL only) */}
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
          addButtonText="Sync Manufacturers"
          isVisible={!!selectedYearId}
          level="manufacturer"
          parentId={selectedYearId || undefined}
        />

        {/* 4. Set (BSC only) */}
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
            <SetForm
              manufacturerId={selectedManufacturerId!}
              onDone={onDone}
            />
          )}
          addButtonText="Sync Sets"
          isVisible={!!selectedManufacturerId}
          level="setName"
          parentId={selectedManufacturerId || undefined}
        />

        {/* 5. Variant Type (BSC only: Base, Insert, Parallel, Promo) */}
        <EntityColumn
          selector={
            <SetVariantSelector
              setId={selectedSetId!}
              selectedVariantTypeId={selectedVariantTypeId}
              onVariantTypeSelect={handleVariantTypeSelect}
              expanded={variantTypeExpanded}
              setExpanded={setVariantTypeExpanded}
            />
          }
          renderForm={(onDone) => (
            <SetVariantForm setId={selectedSetId!} onDone={onDone} />
          )}
          addButtonText="Sync Variant Types"
          isVisible={!!selectedSetId}
          level="variantType"
          parentId={selectedSetId || undefined}
        />

        {/* 6. Variant (reconciled BSC variantName + SL set list) */}
        <EntityColumn
          selector={
            <>
              <VariantSelector
                variantTypeId={selectedVariantTypeId!}
                selectedVariantId={selectedVariantId}
                onVariantSelect={handleVariantSelect}
                expanded={variantExpanded}
                setExpanded={setVariantExpanded}
              />
              {selectedVariantId && (
                <VariantMetadataEditor optionId={selectedVariantId} />
              )}
            </>
          }
          renderForm={(onDone) => (
            <VariantForm
              variantTypeId={selectedVariantTypeId!}
              onDone={onDone}
            />
          )}
          addButtonText="Sync Variants"
          isVisible={!!selectedVariantTypeId}
          level="insert"
          parentId={selectedVariantTypeId || undefined}
        />

        {/* 7. Variant of Variant (NB only — translates to variant on BSC/SL) */}
        {selectedVariantId && (
          <EntityColumn
            selector={
              <>
                <ParallelSelector
                  insertId={selectedVariantId!}
                  selectedParallelId={selectedVariantOfVariantId}
                  onParallelSelect={handleVariantOfVariantSelect}
                  expanded={variantOfVariantExpanded}
                  setExpanded={setVariantOfVariantExpanded}
                />
                {selectedVariantOfVariantId && (
                  <VariantMetadataEditor optionId={selectedVariantOfVariantId} />
                )}
              </>
            }
            renderForm={(onDone) => (
              <ParallelForm insertId={selectedVariantId!} onDone={onDone} />
            )}
            addButtonText="Sync Sub-Variants"
            isVisible={true}
            level="parallel"
            parentId={selectedVariantId || undefined}
          />
        )}

      </div>

      {/* Cards — full width below the selector row */}
      {cardChecklistId && <CardChecklist variantId={cardChecklistId} />}
    </div>
  );
}

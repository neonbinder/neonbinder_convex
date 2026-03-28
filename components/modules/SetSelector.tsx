"use client";

import type { GenericId } from "convex/values";
import { useState } from "react";

import SportSelector from "../SetSelector/SportSelector";
import YearSelector from "../SetSelector/YearSelector";
import ManufacturerSelector from "../SetSelector/ManufacturerSelector";
import SetSelectorComponent from "../SetSelector/SetSelector";
import SetVariantSelector from "../SetSelector/SetVariantSelector";

import { SportForm } from "../SetSelector/SportForm";
import YearForm from "../SetSelector/YearForm";
import ManufacturerForm from "../SetSelector/ManufacturerForm";
import SetForm from "../SetSelector/SetForm";
import SetVariantForm from "../SetSelector/SetVariantForm";

import EntityColumn from "../SetSelector/EntityColumn";
import CardChecklist from "../SetSelector/CardChecklist";

export default function SetSelector() {
  const [selectedSportId, setSelectedSportId] =
    useState<GenericId<"selectorOptions"> | null>(null);
  const [selectedYearId, setSelectedYearId] =
    useState<GenericId<"selectorOptions"> | null>(null);
  const [selectedManufacturerId, setSelectedManufacturerId] =
    useState<GenericId<"selectorOptions"> | null>(null);
  const [selectedSetId, setSelectedSetId] =
    useState<GenericId<"selectorOptions"> | null>(null);
  const [selectedVariantId, setSelectedVariantId] =
    useState<GenericId<"selectorOptions"> | null>(null);

  const [sportExpanded, setSportExpanded] = useState(false);
  const [yearExpanded, setYearExpanded] = useState(false);
  const [manufacturerExpanded, setManufacturerExpanded] = useState(false);
  const [setExpanded, setSetExpanded] = useState(false);
  const [variantExpanded, setVariantExpanded] = useState(false);

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
          addButtonText="Sync Sports"
          isVisible={true}
          level="sport"
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
          addButtonText="Sync Years"
          isVisible={!!selectedSportId}
          level="year"
          parentId={selectedSportId || undefined}
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
          addButtonText="Sync Manufacturers"
          isVisible={!!selectedYearId}
          level="manufacturer"
          parentId={selectedYearId || undefined}
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
          addButtonText="Sync Variants"
          isVisible={!!selectedSetId}
          level="variantType"
          parentId={selectedSetId || undefined}
        />

        {/* Cards Column */}
        {selectedVariantId && <CardChecklist variantId={selectedVariantId} />}
      </div>
    </div>
  );
}

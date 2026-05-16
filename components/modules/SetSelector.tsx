"use client";

import type { GenericId } from "convex/values";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

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
import BaseMappingForm from "../SetSelector/BaseMappingForm";
import VariantMetadataEditor from "../SetSelector/VariantMetadataEditor";
import ParallelGroupingModal from "../SetSelector/ParallelGroupingModal";
import NeonButton from "./NeonButton";

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

  // Base is a terminal variantType: when selected, the cascade stops
  // there and the CardChecklist attaches to the variantType row itself
  // (no Variant / Variant-of-Variant columns). Read the row to detect
  // value === "Base" and to drive the auto-mapping prompt.
  const selectedVariantType = useQuery(
    api.selectorOptions.getSelectorOptionById,
    selectedVariantTypeId ? { id: selectedVariantTypeId } : "skip",
  );
  const isBaseVariantTypeSelected =
    selectedVariantType?.value.toLowerCase().trim() === "base";
  // Auto-prompt is gated on the SportLots mapping specifically. The BSC
  // slug on the row is auto-populated by "Sync Variant Types" (BSC's
  // variant facet returns "Base" with a slug), so testing it would
  // suppress the auto-prompt on every freshly-synced Base. Only the
  // SportLots value is exclusively written by BaseSetPicker, so its
  // presence is the reliable "user has mapped this Base" signal.
  const baseHasMapping = !!selectedVariantType?.platformData?.sportlots;
  // Manual re-map trigger; the form also auto-opens on first selection
  // when no platformData exists yet.
  const [baseMappingOpen, setBaseMappingOpen] = useState(false);
  // Parallel-grouping modal trigger for the Variants column.
  const [groupingOpen, setGroupingOpen] = useState(false);

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

  // CardChecklist attaches to the deepest selected node — for Base
  // variantTypes that's the variantType row itself (Base is terminal).
  const cardChecklistId =
    selectedVariantOfVariantId ||
    selectedVariantId ||
    (isBaseVariantTypeSelected ? selectedVariantTypeId : null);

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

        {/* 6. Variant (reconciled BSC variantName + SL set list) — hidden
            when Base is selected (Base is terminal). */}
        {!isBaseVariantTypeSelected && (
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
            extraActions={
              selectedVariantTypeId ? (
                <NeonButton
                  secondary
                  onClick={() => setGroupingOpen(true)}
                >
                  Group Parallels
                </NeonButton>
              ) : undefined
            }
          />
        )}

        {/* 7. Variant of Variant (NB only — translates to variant on BSC/SL) */}
        {!isBaseVariantTypeSelected && selectedVariantId && (
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

      {/* Base mapping: auto-prompts BaseSetPicker the first time a Base
          variantType without platformData is selected; user can also re-map
          via the Re-map Base button below. */}
      {selectedVariantTypeId && isBaseVariantTypeSelected && (
        <>
          {(!baseHasMapping || baseMappingOpen) && (
            <BaseMappingForm
              key={`${selectedVariantTypeId}-${baseMappingOpen ? "remap" : "auto"}`}
              variantTypeId={selectedVariantTypeId}
              autoOpen={true}
              onClose={() => setBaseMappingOpen(false)}
            />
          )}
          {baseHasMapping && !baseMappingOpen && (
            <div>
              <NeonButton secondary onClick={() => setBaseMappingOpen(true)}>
                Re-map Base
              </NeonButton>
            </div>
          )}
        </>
      )}

      {/* Cards — full width below the selector row.
          For Base variantTypes, gate on `baseHasMapping` so the cards UI doesn't
          render until the SL↔BSC mapping has been written to the variantType row.
          Without this gate, a user (or test) lands on a freshly-selected Base
          before the auto-mapping completes, sees an interactive Cards section,
          starts adding a card, and then BaseMappingForm's autoOpen mutation
          patches the variantType row mid-interaction — invalidating
          getSelectorOptionById, briefly returning isBaseVariantTypeSelected=false,
          and unmounting CardChecklist along with the in-progress form. Gating
          here means CardChecklist only mounts AFTER the mapping is stable, so
          the row patch never races with user input. Non-Base variants render as
          before (their mapping is on the row itself, not derived async). */}
      {cardChecklistId &&
        (!isBaseVariantTypeSelected || baseHasMapping) && (
          <CardChecklist variantId={cardChecklistId} />
        )}

      {/* Parallel-grouping modal — mounted at the page root so it overlays
          on top of the selector row regardless of horizontal scroll. */}
      {selectedVariantTypeId && !isBaseVariantTypeSelected && (
        <ParallelGroupingModal
          isOpen={groupingOpen}
          onClose={() => setGroupingOpen(false)}
          variantTypeId={selectedVariantTypeId}
        />
      )}
    </div>
  );
}

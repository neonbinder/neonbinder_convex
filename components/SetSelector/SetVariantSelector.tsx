import type { GenericId } from "convex/values";
import { api } from "../../convex/_generated/api";
import EntitySelector from "./EntitySelector";

type SetVariantSelectorProps = {
  setId: GenericId<"selectorOptions">;
  selectedVariantTypeId: GenericId<"selectorOptions"> | null;
  onVariantTypeSelect: (id: GenericId<"selectorOptions">) => void;
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
};

export default function SetVariantSelector({
  setId,
  selectedVariantTypeId,
  onVariantTypeSelect,
  expanded,
  setExpanded,
}: SetVariantSelectorProps) {
  return (
    <EntitySelector
      title="Variant Types"
      query={api.selectorOptions.getSelectorOptions}
      queryArgs={{ level: "variantType", parentId: setId }}
      selectedId={selectedVariantTypeId as string | null}
      onSelect={(id) => onVariantTypeSelect(id as GenericId<"selectorOptions">)}
      expanded={expanded}
      setExpanded={setExpanded}
      getDisplayName={(variant) => variant.value as string}
      getDescription={() => undefined}
      selectedColor="bg-orange-100 dark:bg-orange-900 border-orange-300 dark:border-orange-700"
    />
  );
}

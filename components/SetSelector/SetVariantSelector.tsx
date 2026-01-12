import type { GenericId } from "convex/values";
import { api } from "../../convex/_generated/api";
import EntitySelector from "./EntitySelector";

type SetVariantSelectorProps = {
  setId: GenericId<"selectorOptions">;
  selectedVariantId: GenericId<"selectorOptions"> | null;
  onVariantSelect: (id: GenericId<"selectorOptions">) => void;
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
};

export default function SetVariantSelector({
  setId,
  selectedVariantId,
  onVariantSelect,
  expanded,
  setExpanded,
}: SetVariantSelectorProps) {
  return (
    <EntitySelector
      title="Set Variants"
      query={api.myFunctions.getSelectorOptions}
      queryArgs={{ level: "variantType", parentId: setId }}
      selectedId={selectedVariantId as string | null}
      onSelect={(id) => onVariantSelect(id as GenericId<"selectorOptions">)}
      expanded={expanded}
      setExpanded={setExpanded}
      getDisplayName={(variant) => variant.value as string}
      getDescription={() => undefined}
      selectedColor="bg-orange-100 dark:bg-orange-900 border-orange-300 dark:border-orange-700"
    />
  );
}

import { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import EntitySelector from "./EntitySelector";

type SetVariantSelectorProps = {
  setId: Id<"sets">;
  selectedVariantId: Id<"setVariants"> | null;
  onVariantSelect: (id: Id<"setVariants">) => void;
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
      query={api.myFunctions.getSetVariantsBySet}
      queryArgs={{ setId }}
      selectedId={selectedVariantId as string | null}
      onSelect={(id) => onVariantSelect(id as Id<"setVariants">)}
      expanded={expanded}
      setExpanded={setExpanded}
      getDisplayName={(variant) => variant.name as string}
      getDescription={(variant) => variant.description as string | undefined}
      selectedColor="bg-orange-100 dark:bg-orange-900 border-orange-300 dark:border-orange-700"
    />
  );
}

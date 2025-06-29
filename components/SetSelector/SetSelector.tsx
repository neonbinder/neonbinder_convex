import { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import EntitySelector from "./EntitySelector";

type SetSelectorProps = {
  manufacturerId: Id<"manufacturers">;
  selectedSetId: Id<"sets"> | null;
  onSetSelect: (id: Id<"sets">) => void;
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
};

export default function SetSelector({
  manufacturerId,
  selectedSetId,
  onSetSelect,
  expanded,
  setExpanded,
}: SetSelectorProps) {
  return (
    <EntitySelector
      title="Sets"
      query={api.myFunctions.getSetsByManufacturer}
      queryArgs={{ manufacturerId }}
      selectedId={selectedSetId as string | null}
      onSelect={(id) => onSetSelect(id as Id<"sets">)}
      expanded={expanded}
      setExpanded={setExpanded}
      getDisplayName={(set) => set.name as string}
      getDescription={(set) => set.description as string | undefined}
      selectedColor="bg-purple-100 dark:bg-purple-900 border-purple-300 dark:border-purple-700"
    />
  );
}

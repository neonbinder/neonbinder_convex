import { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import EntitySelector from "./EntitySelector";

type SportSelectorProps = {
  selectedSportId: Id<"sports"> | null;
  onSportSelect: (id: Id<"sports">) => void;
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
};

export default function SportSelector({
  selectedSportId,
  onSportSelect,
  expanded,
  setExpanded,
}: SportSelectorProps) {
  return (
    <EntitySelector
      title="Sports"
      query={api.myFunctions.getSports}
      selectedId={selectedSportId as string | null}
      onSelect={(id) => onSportSelect(id as Id<"sports">)}
      expanded={expanded}
      setExpanded={setExpanded}
      getDisplayName={(sport) => sport.name as string}
      getDescription={(sport) => sport.description as string | undefined}
      selectedColor="bg-pink-100 dark:bg-pink-900 border-pink-300 dark:border-pink-700"
    />
  );
}

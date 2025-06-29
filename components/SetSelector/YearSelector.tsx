import { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import EntitySelector from "./EntitySelector";

type YearSelectorProps = {
  sportId: Id<"sports">;
  selectedYearId: Id<"years"> | null;
  onYearSelect: (id: Id<"years">) => void;
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
};

export default function YearSelector({
  sportId,
  selectedYearId,
  onYearSelect,
  expanded,
  setExpanded,
}: YearSelectorProps) {
  return (
    <EntitySelector
      title="Years"
      query={api.myFunctions.getYearsBySport}
      queryArgs={{ sportId }}
      selectedId={selectedYearId as string | null}
      onSelect={(id) => onYearSelect(id as Id<"years">)}
      expanded={expanded}
      setExpanded={setExpanded}
      getDisplayName={(year) => (year.year as number).toString()}
      getDescription={(year) => year.description as string | undefined}
      selectedColor="bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700"
    />
  );
}

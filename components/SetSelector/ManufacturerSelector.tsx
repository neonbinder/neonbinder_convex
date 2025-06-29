import { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import EntitySelector from "./EntitySelector";

type ManufacturerSelectorProps = {
  yearId: Id<"years">;
  selectedManufacturerId: Id<"manufacturers"> | null;
  onManufacturerSelect: (id: Id<"manufacturers">) => void;
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
};

export default function ManufacturerSelector({
  yearId,
  selectedManufacturerId,
  onManufacturerSelect,
  expanded,
  setExpanded,
}: ManufacturerSelectorProps) {
  return (
    <EntitySelector
      title="Manufacturers"
      query={api.myFunctions.getManufacturersByYear}
      queryArgs={{ yearId }}
      selectedId={selectedManufacturerId as string | null}
      onSelect={(id) => onManufacturerSelect(id as Id<"manufacturers">)}
      expanded={expanded}
      setExpanded={setExpanded}
      getDisplayName={(manufacturer) => manufacturer.name as string}
      getDescription={(manufacturer) =>
        manufacturer.description as string | undefined
      }
      selectedColor="bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700"
    />
  );
}

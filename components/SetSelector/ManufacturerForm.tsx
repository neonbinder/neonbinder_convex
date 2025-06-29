import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import GenericEntityForm from "./GenericEntityForm";

export default function ManufacturerForm({
  yearId,
  onDone,
}: {
  yearId: Id<"years">;
  onDone?: () => void;
}) {
  const createManufacturer = useMutation(api.myFunctions.createManufacturer);

  return (
    <GenericEntityForm
      title="Create Manufacturer"
      fields={[
        {
          name: "name",
          label: "Name",
          type: "text",
          placeholder: "e.g., Topps, Panini, Upper Deck",
          required: true,
        },
        {
          name: "description",
          label: "Description (optional)",
          type: "text",
          placeholder: "e.g., Leading baseball card manufacturer",
        },
      ]}
      submitLabel="Create Manufacturer"
      onSubmit={async (values) => {
        await createManufacturer({
          yearId,
          name: values.name,
          description: values.description || undefined,
        });
        onDone?.();
      }}
      onCancel={onDone!}
    />
  );
}

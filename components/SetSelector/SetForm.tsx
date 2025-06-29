import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import GenericEntityForm from "./GenericEntityForm";

export default function SetForm({
  manufacturerId,
  onDone,
}: {
  manufacturerId: Id<"manufacturers">;
  onDone?: () => void;
}) {
  const createSet = useMutation(api.myFunctions.createSet);

  return (
    <GenericEntityForm
      title="Create Set"
      fields={[
        {
          name: "name",
          label: "Set Name",
          type: "text",
          placeholder: "e.g., Series 1, Chrome, Heritage",
          required: true,
        },
        {
          name: "description",
          label: "Description (optional)",
          type: "text",
          placeholder: "e.g., Main flagship set",
        },
      ]}
      submitLabel="Create Set"
      onSubmit={async (values) => {
        await createSet({
          manufacturerId,
          name: values.name,
          description: values.description || undefined,
        });
        onDone?.();
      }}
      onCancel={onDone!}
    />
  );
}

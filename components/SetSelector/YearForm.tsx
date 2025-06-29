import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import GenericEntityForm from "./GenericEntityForm";

export default function YearForm({
  sportId,
  onDone,
}: {
  sportId: Id<"sports">;
  onDone?: () => void;
}) {
  const createYear = useMutation(api.myFunctions.createYear);

  return (
    <GenericEntityForm
      title="Create Year"
      fields={[
        {
          name: "year",
          label: "Year",
          type: "number",
          placeholder: "e.g., 2024",
          required: true,
        },
        {
          name: "description",
          label: "Description (optional)",
          type: "text",
          placeholder: "e.g., Great year for baseball cards",
        },
      ]}
      submitLabel="Create Year"
      onSubmit={async (values) => {
        await createYear({
          sportId,
          year: parseInt(values.year),
          description: values.description || undefined,
        });
        onDone?.();
      }}
      onCancel={onDone!}
    />
  );
}

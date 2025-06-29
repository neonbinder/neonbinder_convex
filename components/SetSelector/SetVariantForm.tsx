import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useState } from "react";
import GenericEntityForm from "./GenericEntityForm";

export default function SetVariantForm({
  setId,
  onDone,
}: {
  setId: Id<"sets">;
  onDone?: () => void;
}) {
  const [variantType, setVariantType] = useState<
    "base" | "parallel" | "insert" | "parallel_of_insert"
  >("base");
  const [parallelName, setParallelName] = useState("");
  const [insertName, setInsertName] = useState("");
  const [parentVariantId, setParentVariantId] = useState("");
  const createSetVariant = useMutation(api.myFunctions.createSetVariant);
  const variants = useQuery(api.myFunctions.getSetVariantsBySet, { setId });

  return (
    <GenericEntityForm
      title="Create Set Variant"
      fields={[
        {
          name: "name",
          label: "Variant Name",
          type: "text",
          placeholder: "e.g., Base Set, Gold Parallel, All-Star Insert",
          required: true,
        },
        {
          name: "description",
          label: "Description (optional)",
          type: "text",
          placeholder: "e.g., Main base set, Limited gold parallel",
        },
      ]}
      submitLabel="Create Set Variant"
      onSubmit={async (values) => {
        await createSetVariant({
          setId,
          name: values.name,
          description: values.description || undefined,
          variantType,
          parallelName:
            variantType === "parallel" || variantType === "parallel_of_insert"
              ? parallelName
              : undefined,
          insertName: variantType === "insert" ? insertName : undefined,
          parentVariantId:
            variantType === "parallel_of_insert"
              ? (parentVariantId as Id<"setVariants">)
              : undefined,
        });
        onDone?.();
      }}
      onCancel={onDone!}
    >
      {/* Custom fields for variantType, parallelName, insertName, parentVariantId */}
      <div className="space-y-4 mt-4">
        <div>
          <label className="block text-sm font-medium mb-2">Variant Type</label>
          <select
            value={variantType}
            onChange={(e) =>
              setVariantType(
                e.target.value as
                  | "base"
                  | "parallel"
                  | "insert"
                  | "parallel_of_insert",
              )
            }
            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
          >
            <option value="base">Base Set</option>
            <option value="parallel">Parallel</option>
            <option value="insert">Insert</option>
            <option value="parallel_of_insert">Parallel of Insert</option>
          </select>
        </div>
        {(variantType === "parallel" ||
          variantType === "parallel_of_insert") && (
          <div>
            <label className="block text-sm font-medium mb-2">
              Parallel Name
            </label>
            <input
              type="text"
              value={parallelName}
              onChange={(e) => setParallelName(e.target.value)}
              className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              placeholder="e.g., Gold, Silver, Refractor"
              required
            />
          </div>
        )}
        {variantType === "insert" && (
          <div>
            <label className="block text-sm font-medium mb-2">
              Insert Name
            </label>
            <input
              type="text"
              value={insertName}
              onChange={(e) => setInsertName(e.target.value)}
              className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              placeholder="e.g., All-Star, Rookie, Legend"
              required
            />
          </div>
        )}
        {variantType === "parallel_of_insert" && variants && (
          <div>
            <label className="block text-sm font-medium mb-2">
              Parent Insert Variant
            </label>
            <select
              value={parentVariantId}
              onChange={(e) => setParentVariantId(e.target.value)}
              className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              required
            >
              <option value="">Select an insert variant</option>
              {variants
                .filter((v) => v.variantType === "insert")
                .map((variant) => (
                  <option key={variant._id} value={variant._id}>
                    {variant.name}{" "}
                    {variant.insertName && `(${variant.insertName})`}
                  </option>
                ))}
            </select>
          </div>
        )}
      </div>
    </GenericEntityForm>
  );
}

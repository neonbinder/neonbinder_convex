import { ReactNode, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { GenericId } from "convex/values";
import NeonButton from "../modules/NeonButton";

type Level =
  | "sport"
  | "year"
  | "manufacturer"
  | "setName"
  | "variantType"
  | "insert"
  | "parallel";

type EntityColumnProps = {
  selector: ReactNode;
  renderForm: (onDone: () => void) => ReactNode;
  addButtonText: string;
  isVisible: boolean;
  level?: Level;
  parentId?: GenericId<"selectorOptions">;
};

export default function EntityColumn({
  selector,
  renderForm,
  addButtonText,
  isVisible,
  level,
  parentId,
}: EntityColumnProps) {
  const [mode, setMode] = useState<"idle" | "sync" | "custom">("idle");
  const [customValue, setCustomValue] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);

  const addCustomOption = useMutation(
    api.selectorOptions.addCustomSelectorOption,
  );

  const handleFormDone = () => {
    setMode("idle");
  };

  const handleCustomSubmit = async () => {
    if (!customValue.trim() || !level) return;
    setCustomError(null);
    try {
      await addCustomOption({
        level,
        value: customValue.trim(),
        parentId,
      });
      setCustomValue("");
      setMode("idle");
    } catch (error) {
      setCustomError(
        error instanceof Error ? error.message : "Failed to add custom entry",
      );
    }
  };

  if (!isVisible) return null;

  return (
    <div className="min-w-[260px] flex flex-col gap-4">
      {selector}
      {mode === "sync" ? (
        renderForm(handleFormDone)
      ) : mode === "custom" ? (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-3">Add Custom Entry</h2>
          <input
            type="text"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCustomSubmit();
            }}
            className="w-full p-2 mb-3 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            placeholder="Enter custom value..."
            autoFocus
          />
          {customError && (
            <div className="p-2 mb-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-md text-red-800 dark:text-red-200 text-sm">
              {customError}
            </div>
          )}
          <div className="flex gap-2">
            <NeonButton onClick={handleCustomSubmit}>Add</NeonButton>
            <NeonButton cancel onClick={() => setMode("idle")}>
              Cancel
            </NeonButton>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <NeonButton onClick={() => setMode("sync")}>
            {addButtonText}
          </NeonButton>
          {level && (
            <NeonButton secondary onClick={() => setMode("custom")}>
              + Custom
            </NeonButton>
          )}
        </div>
      )}
    </div>
  );
}

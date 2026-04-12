import React, { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { GenericId } from "convex/values";
import NeonButton from "../modules/NeonButton";

type VariantMetadataEditorProps = {
  optionId: GenericId<"selectorOptions">;
};

export default function VariantMetadataEditor({
  optionId,
}: VariantMetadataEditorProps) {
  const option = useQuery(api.selectorOptions.getSelectorOptionById, {
    id: optionId,
  });
  const updateMetadata = useMutation(
    api.selectorOptions.updateSelectorOptionMetadata,
  );

  const [isInsert, setIsInsert] = useState(false);
  const [isParallel, setIsParallel] = useState(false);
  const [cardNumberPrefix, setCardNumberPrefix] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sync local state from query result
  useEffect(() => {
    if (option?.metadata) {
      setIsInsert(option.metadata.isInsert ?? false);
      setIsParallel(option.metadata.isParallel ?? false);
      setCardNumberPrefix(option.metadata.cardNumberPrefix ?? "");
      setDirty(false);
    } else if (option) {
      setIsInsert(false);
      setIsParallel(false);
      setCardNumberPrefix("");
      setDirty(false);
    }
  }, [option?._id, option?.metadata?.isInsert, option?.metadata?.isParallel, option?.metadata?.cardNumberPrefix]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await updateMetadata({
        id: optionId,
        metadata: {
          isInsert,
          isParallel,
          cardNumberPrefix: cardNumberPrefix || undefined,
        },
      });
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }, [optionId, isInsert, isParallel, cardNumberPrefix, updateMetadata]);

  if (!option) return null;

  return (
    <div className="mt-3 p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
      <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
        Metadata
      </h4>
      <div className="flex flex-wrap gap-3 items-center">
        <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={isInsert}
            onChange={(e) => {
              setIsInsert(e.target.checked);
              setDirty(true);
            }}
            className="rounded border-gray-600 bg-gray-700"
          />
          Insert
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={isParallel}
            onChange={(e) => {
              setIsParallel(e.target.checked);
              setDirty(true);
            }}
            className="rounded border-gray-600 bg-gray-700"
          />
          Parallel
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-300">
          Prefix:
          <input
            type="text"
            value={cardNumberPrefix}
            onChange={(e) => {
              setCardNumberPrefix(e.target.value);
              setDirty(true);
            }}
            placeholder="e.g. DK-"
            className="w-20 px-1.5 py-0.5 text-xs bg-gray-700 border border-gray-600 rounded text-gray-200"
          />
        </label>
        {dirty && (
          <NeonButton
            size="1"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "..." : "Save"}
          </NeonButton>
        )}
      </div>
    </div>
  );
}

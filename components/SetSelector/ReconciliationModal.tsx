import React, { useCallback, useMemo, useReducer, useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import NeonButton from "../modules/NeonButton";

// ===== TYPES =====

export type PlatformItem = {
  value: string;
  platformValue: string;
};

export type MatchedPair = {
  displayName: string;
  bsc: PlatformItem;
  sl: PlatformItem;
  confidence: number;
};

export type ItemMetadata = {
  cardNumberPrefix?: string;
  isInsert?: boolean;
  isParallel?: boolean;
};

type MatchedPairWithMetadata = MatchedPair & { metadata?: ItemMetadata };

type ReconciliationState = {
  matched: MatchedPairWithMetadata[];
  unmatchedBsc: PlatformItem[];
  unmatchedSl: PlatformItem[];
};

type ReconciliationAction =
  | { type: "LINK"; bscValue: string; slValue: string }
  | { type: "UNLINK"; index: number }
  | { type: "UPDATE_METADATA"; index: number; metadata: ItemMetadata }
  | { type: "UPDATE_UNMATCHED_BSC_METADATA"; bscValue: string; metadata: ItemMetadata }
  | { type: "UPDATE_UNMATCHED_SL_METADATA"; slValue: string; metadata: ItemMetadata };

export type ReconciledResult = {
  items: Array<{
    value: string;
    platformData: {
      bsc?: string;
      sportlots?: string;
    };
    metadata?: ItemMetadata;
  }>;
};

function reconciliationReducer(
  state: ReconciliationState,
  action: ReconciliationAction,
): ReconciliationState {
  switch (action.type) {
    case "LINK": {
      const bscIndex = state.unmatchedBsc.findIndex(
        (item) => item.value === action.bscValue,
      );
      const slIndex = state.unmatchedSl.findIndex(
        (item) => item.value === action.slValue,
      );
      if (bscIndex === -1 || slIndex === -1) return state;

      const bscItem = state.unmatchedBsc[bscIndex];
      const slItem = state.unmatchedSl[slIndex];

      return {
        matched: [
          ...state.matched,
          {
            displayName: bscItem.value,
            bsc: bscItem,
            sl: slItem,
            confidence: 0,
          },
        ],
        unmatchedBsc: state.unmatchedBsc.filter((_, i) => i !== bscIndex),
        unmatchedSl: state.unmatchedSl.filter((_, i) => i !== slIndex),
      };
    }
    case "UNLINK": {
      const pair = state.matched[action.index];
      if (!pair) return state;
      return {
        matched: state.matched.filter((_, i) => i !== action.index),
        unmatchedBsc: [...state.unmatchedBsc, pair.bsc],
        unmatchedSl: [...state.unmatchedSl, pair.sl],
      };
    }
    case "UPDATE_METADATA": {
      const newMatched = [...state.matched];
      if (newMatched[action.index]) {
        newMatched[action.index] = {
          ...newMatched[action.index],
          metadata: {
            ...(newMatched[action.index].metadata || {}),
            ...action.metadata,
          },
        };
      }
      return { ...state, matched: newMatched };
    }
    default:
      return state;
  }
}

// ===== PROPS =====

type ReconciliationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (result: ReconciledResult) => Promise<void>;
  level: string;
  initialData: {
    autoMatched: MatchedPair[];
    unmatchedBsc: PlatformItem[];
    unmatchedSl: PlatformItem[];
  };
  showMetadata?: boolean;
  setName?: string;
  manufacturer?: string;
  usedValues?: string[];
  usedSlPlatformValues?: string[];
  usedBscPlatformValues?: string[];
};

// ===== DRAGGABLE ITEM =====

function DraggableItem({
  id,
  value,
  platform,
  isSelected,
  onClick,
}: {
  id: string;
  value: string;
  platform: "bsc" | "sl";
  isSelected?: boolean;
  onClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const platformLabel = platform === "bsc" ? "BSC" : "SL";
  const platformColor =
    platform === "bsc"
      ? "bg-blue-900/40 text-blue-300 border-blue-700"
      : "bg-purple-900/40 text-purple-300 border-purple-700";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`
        px-3 py-2 rounded-lg border cursor-grab active:cursor-grabbing
        text-sm font-medium transition-all select-none
        ${isSelected
          ? "ring-2 ring-[#00B7FF] bg-[#00B7FF]/10 border-[#00B7FF]"
          : "bg-gray-800 border-gray-600 hover:border-gray-400"
        }
      `}
    >
      <div className="flex items-start gap-2">
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded border ${platformColor} shrink-0 mt-0.5`}
        >
          {platformLabel}
        </span>
        <span className="text-gray-200 break-words">{value}</span>
      </div>
    </div>
  );
}

// ===== MATCHED ROW =====

function MatchedRow({
  pair,
  index,
  onUnlink,
  showMetadata,
  onUpdateMetadata,
}: {
  pair: MatchedPairWithMetadata;
  index: number;
  onUnlink: () => void;
  showMetadata?: boolean;
  onUpdateMetadata?: (metadata: ItemMetadata) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const confidenceColor =
    pair.confidence >= 0.9
      ? "text-green-400"
      : pair.confidence >= 0.75
        ? "text-yellow-400"
        : "text-orange-400";

  return (
    <div className="border-l-4 border-[#00D558] bg-gray-800/50 rounded-r-lg p-3 mb-2">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 text-sm">
            <span className="text-[10px] px-1.5 py-0.5 rounded border bg-blue-900/40 text-blue-300 border-blue-700 shrink-0 mt-0.5">
              BSC
            </span>
            <span className="text-gray-200 break-words">{pair.bsc.value}</span>
          </div>
          <div className="flex items-start gap-2 text-sm mt-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded border bg-purple-900/40 text-purple-300 border-purple-700 shrink-0 mt-0.5">
              SL
            </span>
            <span className="text-gray-400 break-words">{pair.sl.value}</span>
          </div>
        </div>
        {pair.confidence > 0 && (
          <span className={`text-xs ${confidenceColor}`}>
            {Math.round(pair.confidence * 100)}%
          </span>
        )}
        {showMetadata && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-gray-400 hover:text-gray-200 px-2"
          >
            {expanded ? "▲" : "▼"}
          </button>
        )}
        <button
          onClick={onUnlink}
          className="text-xs text-pink-400 hover:text-pink-300 px-2 py-1 rounded hover:bg-pink-900/20"
          title="Unlink"
        >
          ✕
        </button>
      </div>

      {showMetadata && expanded && onUpdateMetadata && (
        <MetadataEditor
          metadata={pair.metadata || {}}
          onChange={onUpdateMetadata}
        />
      )}
    </div>
  );
}

// ===== METADATA EDITOR (inline) =====

function MetadataEditor({
  metadata,
  onChange,
}: {
  metadata: ItemMetadata;
  onChange: (metadata: ItemMetadata) => void;
}) {
  return (
    <div className="mt-2 pt-2 border-t border-gray-700 flex flex-wrap gap-3 items-center">
      <label className="flex items-center gap-1.5 text-xs text-gray-400">
        <input
          type="checkbox"
          checked={metadata.isInsert || false}
          onChange={(e) => onChange({ isInsert: e.target.checked })}
          className="rounded border-gray-600 bg-gray-700"
        />
        Insert
      </label>
      <label className="flex items-center gap-1.5 text-xs text-gray-400">
        <input
          type="checkbox"
          checked={metadata.isParallel || false}
          onChange={(e) => onChange({ isParallel: e.target.checked })}
          className="rounded border-gray-600 bg-gray-700"
        />
        Parallel
      </label>
      <label className="flex items-center gap-1.5 text-xs text-gray-400">
        Prefix:
        <input
          type="text"
          value={metadata.cardNumberPrefix || ""}
          onChange={(e) => onChange({ cardNumberPrefix: e.target.value })}
          placeholder="e.g. DK-"
          className="w-20 px-1.5 py-0.5 text-xs bg-gray-700 border border-gray-600 rounded text-gray-200"
        />
      </label>
    </div>
  );
}

// ===== MAIN COMPONENT =====

export default function ReconciliationModal({
  isOpen,
  onClose,
  onConfirm,
  level,
  initialData,
  showMetadata = false,
  setName = "",
  manufacturer = "",
  usedValues = [],
  usedSlPlatformValues = [],
  usedBscPlatformValues = [],
}: ReconciliationModalProps) {
  const usedValueSet = useMemo(
    () => new Set(usedValues.map((v) => v.toLowerCase())),
    [usedValues],
  );
  const usedSlSet = useMemo(
    () => new Set(usedSlPlatformValues),
    [usedSlPlatformValues],
  );
  const usedBscSet = useMemo(
    () => new Set(usedBscPlatformValues),
    [usedBscPlatformValues],
  );
  const initialState: ReconciliationState = {
    matched: initialData.autoMatched.map((m) => ({ ...m })),
    unmatchedBsc: [...initialData.unmatchedBsc],
    unmatchedSl: [...initialData.unmatchedSl],
  };
  const [state, dispatch] = useReducer(reconciliationReducer, initialState);

  const [selectedBsc, setSelectedBsc] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [matchedCollapsed, setMatchedCollapsed] = useState(true);
  // Default SL-side prefixes: full set name, and set name with manufacturer prefix stripped.
  // e.g. setName="Topps Fire", manufacturer="Topps" → ["topps fire", "fire"]
  const defaultSlPrefixes = useMemo(() => {
    const setNorm = setName.trim().toLowerCase();
    const mfgNorm = manufacturer.trim().toLowerCase();
    const prefixes: string[] = [];
    if (setNorm) prefixes.push(setNorm);
    if (mfgNorm && setNorm.startsWith(`${mfgNorm} `)) {
      const stripped = setNorm.slice(mfgNorm.length + 1).trim();
      if (stripped) prefixes.push(stripped);
    }
    return prefixes;
  }, [setName, manufacturer]);

  const [slFilter, setSlFilter] = useState<string>("");

  const activeSlPrefixes = useMemo(() => {
    const q = slFilter.trim().toLowerCase();
    if (q) return [q];
    return defaultSlPrefixes;
  }, [slFilter, defaultSlPrefixes]);

  const filteredUnmatchedSl = useMemo(() => {
    return state.unmatchedSl.filter((item) => {
      if (usedSlSet.has(item.platformValue)) return false;
      if (usedValueSet.has(item.value.toLowerCase())) return false;
      if (activeSlPrefixes.length === 0) return true;
      const v = item.value.toLowerCase();
      return activeSlPrefixes.some((p) => v.startsWith(p));
    });
  }, [state.unmatchedSl, activeSlPrefixes, usedSlSet, usedValueSet]);

  const filteredUnmatchedBsc = useMemo(() => {
    return state.unmatchedBsc.filter((item) => {
      if (usedBscSet.has(item.platformValue)) return false;
      if (usedValueSet.has(item.value.toLowerCase())) return false;
      return true;
    });
  }, [state.unmatchedBsc, usedBscSet, usedValueSet]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  // Build ID maps for DnD
  const bscIds = useMemo(
    () => state.unmatchedBsc.map((item) => `bsc-${item.value}`),
    [state.unmatchedBsc],
  );
  const slIds = useMemo(
    () => state.unmatchedSl.map((item) => `sl-${item.value}`),
    [state.unmatchedSl],
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragId(null);
      const { active, over } = event;
      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      const isActiveBsc = activeId.startsWith("bsc-");
      const isOverSl = overId.startsWith("sl-");
      const isActiveSl = activeId.startsWith("sl-");
      const isOverBsc = overId.startsWith("bsc-");

      if (isActiveBsc && isOverSl) {
        dispatch({
          type: "LINK",
          bscValue: activeId.replace("bsc-", ""),
          slValue: overId.replace("sl-", ""),
        });
      } else if (isActiveSl && isOverBsc) {
        dispatch({
          type: "LINK",
          bscValue: overId.replace("bsc-", ""),
          slValue: activeId.replace("sl-", ""),
        });
      }
    },
    [],
  );

  // Click-to-link: click BSC item then click SL item
  const handleBscClick = useCallback(
    (value: string) => {
      if (selectedBsc === value) {
        setSelectedBsc(null);
      } else {
        setSelectedBsc(value);
      }
    },
    [selectedBsc],
  );

  const handleSlClick = useCallback(
    (value: string) => {
      if (selectedBsc) {
        dispatch({ type: "LINK", bscValue: selectedBsc, slValue: value });
        setSelectedBsc(null);
      }
    },
    [selectedBsc],
  );

  const handleConfirm = useCallback(async () => {
    setConfirming(true);
    try {
      const items: ReconciledResult["items"] = [];

      // Matched pairs: both platforms
      for (const pair of state.matched) {
        items.push({
          value: pair.displayName,
          platformData: {
            bsc: pair.bsc.platformValue,
            sportlots: pair.sl.platformValue,
          },
          metadata: pair.metadata,
        });
      }

      // Unmatched BSC: BSC only
      for (const item of state.unmatchedBsc) {
        items.push({
          value: item.value,
          platformData: { bsc: item.platformValue },
        });
      }

      // Unmatched SL: SL only
      for (const item of state.unmatchedSl) {
        items.push({
          value: item.value,
          platformData: { sportlots: item.platformValue },
        });
      }

      await onConfirm({ items });
    } finally {
      setConfirming(false);
    }
  }, [state, onConfirm]);

  // Find the dragged item for the overlay
  const activeDragItem = useMemo(() => {
    if (!activeDragId) return null;
    if (activeDragId.startsWith("bsc-")) {
      const value = activeDragId.replace("bsc-", "");
      return { value, platform: "bsc" as const };
    }
    if (activeDragId.startsWith("sl-")) {
      const value = activeDragId.replace("sl-", "");
      return { value, platform: "sl" as const };
    }
    return null;
  }, [activeDragId]);

  if (!isOpen) return null;

  const levelLabel =
    level === "insert"
      ? "Variants"
      : level === "parallel"
        ? "Variants of Variants"
        : level;

  const totalItems =
    state.matched.length + state.unmatchedBsc.length + state.unmatchedSl.length;

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl max-w-6xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">
            Reconcile {levelLabel}
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            {state.matched.length} matched, {state.unmatchedBsc.length} BSC-only,{" "}
            {state.unmatchedSl.length} SL-only ({totalItems} total)
          </p>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Auto-matched section (collapsible) */}
          {state.matched.length > 0 && (
            <div>
              <button
                onClick={() => setMatchedCollapsed(!matchedCollapsed)}
                className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2 hover:text-gray-100 transition-colors"
              >
                <span className="text-xs">{matchedCollapsed ? "▶" : "▼"}</span>
                <span>Matched ({state.matched.length})</span>
                {matchedCollapsed && (
                  <span className="text-xs text-gray-500">— click to review</span>
                )}
              </button>
              {!matchedCollapsed && state.matched.map((pair, index) => (
                <MatchedRow
                  key={`${pair.bsc.value}-${pair.sl.value}`}
                  pair={pair}
                  index={index}
                  onUnlink={() => dispatch({ type: "UNLINK", index })}
                  showMetadata={showMetadata}
                  onUpdateMetadata={(metadata) =>
                    dispatch({ type: "UPDATE_METADATA", index, metadata })
                  }
                />
              ))}
            </div>
          )}

          {/* Unmatched section with DnD */}
          {(state.unmatchedBsc.length > 0 || state.unmatchedSl.length > 0) && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div>
                <h3 className="text-sm font-medium text-gray-300 mb-2">
                  Unmatched — drag to link, or click BSC then SL
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {/* BSC column */}
                  <div>
                    <div className="text-xs text-blue-400 font-medium mb-2 uppercase tracking-wide">
                      BSC ({filteredUnmatchedBsc.length}
                      {filteredUnmatchedBsc.length !== state.unmatchedBsc.length
                        ? ` of ${state.unmatchedBsc.length}`
                        : ""}
                      )
                    </div>
                    <div className="space-y-1.5 min-h-[60px]">
                      {filteredUnmatchedBsc.map((item) => (
                        <DraggableItem
                          key={`bsc-${item.value}`}
                          id={`bsc-${item.value}`}
                          value={item.value}
                          platform="bsc"
                          isSelected={selectedBsc === item.value}
                          onClick={() => handleBscClick(item.value)}
                        />
                      ))}
                      {state.unmatchedBsc.length === 0 && (
                        <p className="text-xs text-gray-500 italic py-2">
                          All BSC items matched
                        </p>
                      )}
                    </div>
                  </div>

                  {/* SL column */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs text-purple-400 font-medium uppercase tracking-wide">
                        SportLots ({filteredUnmatchedSl.length}
                        {filteredUnmatchedSl.length !== state.unmatchedSl.length
                          ? ` of ${state.unmatchedSl.length}`
                          : ""}
                        )
                      </div>
                    </div>
                    <input
                      type="text"
                      value={slFilter}
                      onChange={(e) => setSlFilter(e.target.value)}
                      placeholder={
                        defaultSlPrefixes.length > 0
                          ? `Starts with "${defaultSlPrefixes.join('" or "')}"`
                          : "Filter by prefix..."
                      }
                      className="w-full mb-2 px-2.5 py-1.5 text-xs bg-gray-800 border border-gray-600 rounded-md text-gray-200 placeholder-gray-500"
                    />
                    <div className="space-y-1.5 min-h-[60px]">
                      {filteredUnmatchedSl.map((item) => (
                        <DraggableItem
                          key={`sl-${item.value}`}
                          id={`sl-${item.value}`}
                          value={item.value}
                          platform="sl"
                          onClick={
                            selectedBsc
                              ? () => handleSlClick(item.value)
                              : undefined
                          }
                        />
                      ))}
                      {state.unmatchedSl.length === 0 && (
                        <p className="text-xs text-gray-500 italic py-2">
                          All SL items matched
                        </p>
                      )}
                      {state.unmatchedSl.length > 0 &&
                        filteredUnmatchedSl.length === 0 && (
                          <p className="text-xs text-gray-500 italic py-2">
                            No SL items start with{" "}
                            {activeSlPrefixes.map((p, i) => (
                              <span key={p}>
                                {i > 0 ? " or " : ""}
                                "{p}"
                              </span>
                            ))}
                          </p>
                        )}
                    </div>
                  </div>
                </div>
              </div>

              <DragOverlay>
                {activeDragItem && (
                  <div className="px-3 py-2 rounded-lg border bg-gray-800 border-[#00B7FF] ring-2 ring-[#00B7FF] shadow-lg text-sm font-medium">
                    <span className="text-gray-200">
                      {activeDragItem.value}
                    </span>
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
          <NeonButton cancel onClick={onClose} disabled={confirming}>
            Cancel
          </NeonButton>
          <NeonButton onClick={handleConfirm} disabled={confirming}>
            {confirming ? "Saving..." : `Confirm ${totalItems} Items`}
          </NeonButton>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import TeamPicker from "./TeamPicker";
import CardFeaturesEditor from "./CardFeaturesEditor";

type CardChecklistItemProps = {
  card: {
    _id: Id<"cardChecklist">;
    selectorOptionId: Id<"selectorOptions">;
    cardNumber: string;
    cardName: string;
    playerIds?: Array<Id<"players">>;
    teamOnCardIds?: Array<Id<"teams">>;
    attributes?: string[];
    isRookie?: boolean;
    isRelic?: boolean;
    printRun?: number;
    autographType?: string;
    cardVariation?: string;
    features?: Record<string, string>;
    platformData: {
      bsc?: string;
      sportlots?: string;
    };
    sourcePlatformIds?: {
      bsc?: string;
      sportlots?: string;
    };
    isCustom?: boolean;
  };
  // NEO-6: id→label map for the parent variant's attached platform IDs.
  // When sourcePlatformIds.<side> is set AND a label exists for that ID,
  // we render a small "Source (SL): Series 2" badge.
  sourceLabelMaps?: {
    bsc: Record<string, string>;
    sportlots: Record<string, string>;
  };
  /**
   * Sport from the active variant's ancestor chain. Forwarded to the
   * TeamPicker (typeahead filter) and CardFeaturesEditor (drives
   * EXPECTED_FEATURES applicability). Passed in from the parent
   * CardChecklist so we don't re-query the ancestor chain per row.
   */
  ancestorSport?: string;
};

/**
 * Map raw attribute tokens to display-friendly badge content.
 * "unmatched-bsc" / "unmatched-sl" indicate cards that only appeared on
 * one side during reconciliation — surfaced to the user as a review tag.
 */
function badgeLabel(token: string): { label: string; cls: string } {
  switch (token) {
    case "RC":
      return { label: "RC", cls: "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700" };
    case "AU":
      return { label: "AU", cls: "bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700" };
    case "RELIC":
      return { label: "RELIC", cls: "bg-pink-100 dark:bg-pink-900 text-pink-700 dark:text-pink-300 border-pink-300 dark:border-pink-700" };
    case "SP":
    case "SSP":
      return { label: token, cls: "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700" };
    case "NUM":
      return { label: "#'d", cls: "bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700" };
    case "unmatched-bsc":
    case "unmatched-sl":
      return { label: token === "unmatched-bsc" ? "SL only" : "BSC only", cls: "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700" };
    default:
      return { label: token, cls: "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600" };
  }
}

export default function CardChecklistItem({
  card,
  sourceLabelMaps,
  ancestorSport,
}: CardChecklistItemProps) {
  const [editing, setEditing] = useState(false);
  const cardNameInputRef = useRef<HTMLInputElement | null>(null);

  const [cardName, setCardName] = useState(card.cardName);
  // NEO-26: teamOnCardIds is the canonical representation. Local
  // draft list is committed on Save; cancel reverts to the prop value.
  const [teamIds, setTeamIds] = useState<Array<Id<"teams">>>(
    card.teamOnCardIds ?? [],
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Resolve team display names for the non-editing view + for chip
  // labels inside the editor. Skipped when the card has no teams.
  const teamsToShow = card.teamOnCardIds ?? [];
  const teamRows = useQuery(
    api.teams.getManyByIds,
    teamsToShow.length > 0 ? { ids: teamsToShow } : "skip",
  );

  // Reset the editor draft whenever the prop changes (e.g. a propagation
  // engine write updated teamOnCardIds elsewhere on the page). Without
  // this, opening Edit would show a stale list.
  useEffect(() => {
    if (!editing) {
      setTeamIds(card.teamOnCardIds ?? []);
      setCardName(card.cardName);
    }
  }, [card.teamOnCardIds, card.cardName, editing]);

  const updateCard = useMutation(api.selectorOptions.updateCard);
  const deleteCard = useMutation(api.selectorOptions.deleteCard);

  const handleSave = async () => {
    await updateCard({
      id: card._id,
      cardName,
      // Always pass the full array (NEO-26): a card moving from
      // 1 team to 2 (or 0) is the same write path.
      teamOnCardIds: teamIds,
    });
    setEditing(false);
  };

  const handleDelete = async () => {
    await deleteCard({ id: card._id });
    setConfirmDelete(false);
  };

  const teamLabel = useMemo(() => {
    if (!teamRows || teamRows.length === 0) return "";
    return teamRows.map((t) => t.name).join(", ");
  }, [teamRows]);

  const cancelEdit = () => {
    setCardName(card.cardName);
    setTeamIds(card.teamOnCardIds ?? []);
    setEditing(false);
  };

  // Focus the card-name input when the modal opens.
  useEffect(() => {
    if (editing) cardNameInputRef.current?.focus();
  }, [editing]);

  // Escape closes the modal with cancel semantics. Listening on the
  // document covers Escape from inside the TeamPicker popover too.
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancelEdit();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  // Portal to document.body so the modal isn't a descendant of the
  // Virtuoso row's React tree. Virtuoso re-measures and shuffles its
  // children aggressively; rendering the modal as a row sibling caused
  // Maestro's hierarchy-based-tap to occasionally not see the modal
  // appear after clicking Edit. The portal renders the modal as a
  // direct child of <body>, fully decoupled from Virtuoso.
  const editModal = editing ? createPortal(
    // Fixed positioning escapes Virtuoso's inner scroll + the row's any
    // ancestor overflow boundary, so Save/Cancel + the TeamPicker
    // popover are always reachable on the Maestro headless 1024×629
    // viewport without scrolling a nested container.
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`edit-card-title-${card._id}`}
      onClick={(e) => {
        // Click-outside-to-cancel: only fire when the backdrop itself is
        // the target, not when a click bubbles up from the content box.
        if (e.target === e.currentTarget) cancelEdit();
      }}
    >
      <div className="bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="px-4 py-3 border-b border-gray-300 dark:border-gray-600">
          <h2
            id={`edit-card-title-${card._id}`}
            className="text-sm font-semibold text-gray-900 dark:text-gray-100"
          >
            Edit card #{card.cardNumber}
          </h2>
        </div>
        {/* Static section: name + teams. No overflow-y-auto so the
            TeamPicker's absolute-positioned popover can extend below
            its trigger without being clipped at the section boundary. */}
        <div className="px-4 pt-4 pb-3 space-y-3">
          <div className="flex gap-2 flex-wrap">
            <input
              ref={cardNameInputRef}
              type="text"
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleSave();
                }
              }}
              className="flex-1 min-w-[160px] p-1.5 border rounded text-sm dark:bg-gray-800 dark:border-gray-600"
              placeholder="Card name"
              aria-label="Card name"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-gray-400 mb-1">
              Teams
            </label>
            <TeamPicker
              value={teamIds}
              onChange={setTeamIds}
              sport={ancestorSport}
            />
          </div>
        </div>
        {/* Features editor is the tall section — give it the modal's
            remaining vertical space with its own scroll boundary so the
            modal as a whole doesn't need a content-wide scroll (which
            would clip the TeamPicker popover). */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0">
          <CardFeaturesEditor
            cardChecklistId={card._id}
            selectorOptionId={card.selectorOptionId}
            cardFeatures={card.features}
            ancestorSport={ancestorSport}
          />
        </div>
        <div className="px-4 py-3 border-t border-gray-300 dark:border-gray-600 flex gap-2 justify-end">
          <button
            onClick={cancelEdit}
            aria-label="Cancel card edit"
            className="px-3 py-1.5 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            aria-label="Save card edit"
            className="px-3 py-1.5 text-xs bg-neon-green text-black rounded hover:bg-neon-green/85"
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  ) : null;

  // Build the secondary line: "<team(s)> · /99 · Refractor · On-Card auto"
  const subParts: string[] = [];
  if (teamLabel) subParts.push(teamLabel);
  if (card.printRun) subParts.push(`/${card.printRun}`);
  if (card.cardVariation) subParts.push(card.cardVariation);
  if (card.autographType) subParts.push(`${card.autographType} auto`);

  return (
    <>
    {editModal}
    <div className="flex items-center gap-3 p-2.5 border rounded-md dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 group">
      <span className="text-sm font-mono text-gray-500 dark:text-gray-400 w-12 text-right shrink-0">
        #{card.cardNumber}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{card.cardName}</div>
        {subParts.length > 0 && (
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {subParts.join(" · ")}
          </div>
        )}
      </div>
      {/* Attribute badges */}
      {card.attributes && card.attributes.length > 0 && (
        <div className="flex gap-1 shrink-0 flex-wrap max-w-[40%] justify-end">
          {card.attributes.map((attr) => {
            const { label, cls } = badgeLabel(attr);
            return (
              <span
                key={attr}
                className={`text-xs px-1 py-0.5 rounded border ${cls}`}
              >
                {label}
              </span>
            );
          })}
        </div>
      )}
      {/* Platform badges */}
      <div className="flex gap-1 shrink-0 items-center flex-wrap justify-end">
        {/* NEO-6 source-set badges: rendered only when the parent variant
            exposes a label map for that side AND this card carries a
            sourcePlatformIds entry. Replaces the bare "SL" / "BSC" tag
            with the operator-given label (e.g. "Series 2"). */}
        {sourceLabelMaps?.sportlots[card.sourcePlatformIds?.sportlots ?? ""] ? (
          <span
            className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200 border border-blue-300 dark:border-blue-700"
            title={`SL source: ${card.sourcePlatformIds?.sportlots}`}
          >
            SL: {sourceLabelMaps.sportlots[card.sourcePlatformIds!.sportlots!]}
          </span>
        ) : (
          card.platformData.sportlots && (
            <span className="text-xs px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300">
              SL
            </span>
          )
        )}
        {sourceLabelMaps?.bsc[card.sourcePlatformIds?.bsc ?? ""] ? (
          <span
            className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200 border border-blue-300 dark:border-blue-700"
            title={`BSC source: ${card.sourcePlatformIds?.bsc}`}
          >
            BSC: {sourceLabelMaps.bsc[card.sourcePlatformIds!.bsc!]}
          </span>
        ) : (
          card.platformData.bsc && (
            <span className="text-xs px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300">
              BSC
            </span>
          )
        )}
        {card.isCustom && (
          <span className="text-xs px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700">
            Custom
          </span>
        )}
      </div>
      {/* Actions always rendered. Hiding them behind hover (opacity-0
          group-hover:opacity-100) made the buttons unreachable for
          Maestro headless web (no mouse hover) — taps registered
          but `setEditing` never fired. Always-on also keeps the
          flow keyboard-accessible (feedback_keyboard_navigation).
          Subtle text-only buttons stay visually quiet enough not
          to clutter the row. */}
      <div className="flex gap-1 shrink-0">
        <button
          onClick={() => setEditing(true)}
          aria-label={`Edit card ${card.cardNumber}`}
          className="px-1.5 py-0.5 text-xs text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
          title="Edit"
        >
          Edit
        </button>
        {confirmDelete ? (
          <button
            onClick={handleDelete}
            aria-label={`Confirm delete card ${card.cardNumber}`}
            className="px-1.5 py-0.5 text-xs text-red-600 dark:text-red-400 font-medium"
          >
            Confirm?
          </button>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            onBlur={() => setConfirmDelete(false)}
            aria-label={`Delete card ${card.cardNumber}`}
            className="px-1.5 py-0.5 text-xs text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
            title="Delete"
          >
            Del
          </button>
        )}
      </div>
    </div>
    </>
  );
}

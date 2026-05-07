import { useState } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { GenericId } from "convex/values";
import CardChecklistItem from "./CardChecklistItem";
import NeonButton from "../modules/NeonButton";
import UnknownEntitiesDialog from "./UnknownEntitiesDialog";

type CardChecklistProps = {
  variantId: GenericId<"selectorOptions">;
};

/**
 * Preview shape returned by fetchCardChecklist. We hold this in component
 * state between fetch (action) and commit (mutation) so the user can
 * confirm new players/teams in UnknownEntitiesDialog before the entities
 * are persisted.
 */
type FetchPreview = {
  sport: string;
  cards: Array<{
    cardNumber: string;
    cardName: string;
    team?: string;
    teams?: string[];
    players?: string[];
    attributes?: string[];
    isRookie?: boolean;
    isRelic?: boolean;
    printRun?: number;
    autographType?: string;
    cardVariation?: string;
    platformData: { bsc?: string; sportlots?: string };
    unmatched?: "bsc" | "sl";
  }>;
  unknownPlayers: string[];
  unknownTeams: string[];
};

export default function CardChecklist({ variantId }: CardChecklistProps) {
  const cards = useQuery(api.selectorOptions.getCardChecklist, {
    selectorOptionId: variantId,
  });
  const fetchChecklist = useAction(api.selectorOptions.fetchCardChecklist);
  const commitChecklist = useMutation(api.selectorOptions.commitCardChecklist);
  const addCustomCard = useMutation(api.selectorOptions.addCustomCard);

  const [syncing, setSyncing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCardNumber, setNewCardNumber] = useState("");
  const [newCardName, setNewCardName] = useState("");
  const [newTeam, setNewTeam] = useState("");
  const [pendingPreview, setPendingPreview] = useState<FetchPreview | null>(null);

  /**
   * Two-phase pipeline:
   *   1. fetchChecklist → preview (no DB writes; player/team strings, not IDs)
   *   2. If unknowns: open dialog → user confirms subset → commit
   *      Otherwise: commit immediately with empty confirmedNew*.
   * Either way, commitCardChecklist is the only path that writes
   * cardChecklist rows + new player/team entities.
   */
  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const result = await fetchChecklist({ selectorOptionId: variantId });
      if (!result.success || !result.sport) {
        setSyncMessage(result.message);
        return;
      }
      const preview: FetchPreview = {
        sport: result.sport,
        cards: result.cards,
        unknownPlayers: result.unknownPlayers,
        unknownTeams: result.unknownTeams,
      };
      if (preview.unknownPlayers.length === 0 && preview.unknownTeams.length === 0) {
        await runCommit(preview, [], []);
        setSyncMessage(`Saved ${result.cards.length} cards.`);
      } else {
        // Stash preview; dialog handles the rest.
        setPendingPreview(preview);
        setSyncMessage(result.message);
      }
    } catch (error) {
      setSyncMessage(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setSyncing(false);
    }
  };

  const runCommit = async (
    preview: FetchPreview,
    confirmedPlayers: string[],
    confirmedTeams: string[],
  ) => {
    setCommitting(true);
    try {
      const result = await commitChecklist({
        selectorOptionId: variantId,
        sport: preview.sport,
        cards: preview.cards,
        confirmedNewPlayers: confirmedPlayers,
        confirmedNewTeams: confirmedTeams,
      });
      const enrichmentNote =
        result.createdPlayerIds.length || result.createdTeamIds.length
          ? ` (${result.createdPlayerIds.length} players + ${result.createdTeamIds.length} teams enriching from Wikidata in background)`
          : "";
      setSyncMessage(`Saved ${result.count} cards.${enrichmentNote}`);
    } catch (error) {
      setSyncMessage(
        `Commit failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setCommitting(false);
    }
  };

  const handleConfirmUnknowns = async (
    confirmedPlayers: string[],
    confirmedTeams: string[],
  ) => {
    if (!pendingPreview) return;
    await runCommit(pendingPreview, confirmedPlayers, confirmedTeams);
    setPendingPreview(null);
  };

  const handleAddCard = async () => {
    if (!newCardNumber.trim()) return;
    try {
      await addCustomCard({
        selectorOptionId: variantId,
        cardNumber: newCardNumber.trim(),
        cardName: newCardName.trim() || `Card #${newCardNumber.trim()}`,
        team: newTeam.trim() || undefined,
      });
      setNewCardNumber("");
      setNewCardName("");
      setNewTeam("");
      setShowAddForm(false);
    } catch (error) {
      console.error("Failed to add card:", error);
    }
  };

  if (!cards) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Cards</h2>
        <div className="text-gray-500">Loading checklist...</div>
      </div>
    );
  }

  const sortedCards = [...cards].sort((a, b) => a.sortOrder - b.sortOrder);
  const lastSynced = cards.length > 0
    ? Math.max(...cards.map((c: { lastUpdated: number }) => c.lastUpdated))
    : null;

  const busy = syncing || committing;
  const fetchLabel = syncing
    ? "Fetching..."
    : committing
      ? "Saving..."
      : sortedCards.length === 0
        ? "Fetch from Marketplaces"
        : "Refresh";

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">
            Cards{" "}
            {cards.length > 0 && (
              <span className="text-sm font-normal text-gray-500">
                ({cards.length})
              </span>
            )}
          </h2>
        </div>

        {lastSynced && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Last synced:{" "}
            {new Date(lastSynced).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {Date.now() - lastSynced > 7 * 24 * 60 * 60 * 1000 && (
              <span className="ml-1 text-amber-500">(stale)</span>
            )}
          </div>
        )}

        {syncMessage && (
          <div className="p-2 mb-3 bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-md text-blue-800 dark:text-blue-200 text-sm">
            {syncMessage}
          </div>
        )}

        {sortedCards.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              No cards in this checklist yet.
            </p>
            <NeonButton onClick={handleSync} disabled={busy}>
              {fetchLabel}
            </NeonButton>
          </div>
        ) : (
          <div className="space-y-1.5">
            {sortedCards.map((card) => (
              <CardChecklistItem key={card._id} card={card} />
            ))}
          </div>
        )}
      </div>

      {/* Add Card Form */}
      {showAddForm ? (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow space-y-3">
          <h3 className="font-semibold text-sm">Add Card</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={newCardNumber}
              onChange={(e) => setNewCardNumber(e.target.value)}
              className="w-20 p-2 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600"
              placeholder="#"
              autoFocus
            />
            <input
              type="text"
              value={newCardName}
              onChange={(e) => setNewCardName(e.target.value)}
              className="flex-1 p-2 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600"
              placeholder="Player name"
            />
          </div>
          <input
            type="text"
            value={newTeam}
            onChange={(e) => setNewTeam(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddCard();
            }}
            className="w-full p-2 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600"
            placeholder="Team (optional)"
          />
          <div className="flex gap-2">
            <NeonButton onClick={handleAddCard}>Add</NeonButton>
            <NeonButton cancel onClick={() => setShowAddForm(false)}>
              Cancel
            </NeonButton>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <NeonButton onClick={() => setShowAddForm(true)}>
            Add Card
          </NeonButton>
          {sortedCards.length > 0 && (
            <NeonButton secondary onClick={handleSync} disabled={busy}>
              {fetchLabel}
            </NeonButton>
          )}
        </div>
      )}

      <UnknownEntitiesDialog
        isOpen={pendingPreview !== null}
        unknownPlayers={pendingPreview?.unknownPlayers ?? []}
        unknownTeams={pendingPreview?.unknownTeams ?? []}
        sport={pendingPreview?.sport ?? ""}
        saving={committing}
        onConfirm={handleConfirmUnknowns}
        onCancel={() => {
          setPendingPreview(null);
          setSyncMessage("Fetch cancelled — no cards saved.");
        }}
      />
    </div>
  );
}

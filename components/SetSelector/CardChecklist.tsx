import { useState } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { GenericId } from "convex/values";
import CardChecklistItem from "./CardChecklistItem";
import NeonButton from "../modules/NeonButton";

type CardChecklistProps = {
  variantId: GenericId<"selectorOptions">;
};

export default function CardChecklist({ variantId }: CardChecklistProps) {
  const cards = useQuery(api.selectorOptions.getCardChecklist, {
    selectorOptionId: variantId,
  });
  const fetchChecklist = useAction(api.selectorOptions.fetchCardChecklist);
  const addCustomCard = useMutation(api.selectorOptions.addCustomCard);

  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCardNumber, setNewCardNumber] = useState("");
  const [newCardName, setNewCardName] = useState("");
  const [newTeam, setNewTeam] = useState("");

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const result = await fetchChecklist({
        selectorOptionId: variantId,
      });
      setSyncMessage(result.message);
    } catch (error) {
      setSyncMessage(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setSyncing(false);
    }
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

  // Sort cards by sortOrder
  const sortedCards = [...cards].sort((a, b) => a.sortOrder - b.sortOrder);

  // Find the most recent lastUpdated timestamp
  const lastSynced = cards.length > 0
    ? Math.max(...cards.map((c: { lastUpdated: number }) => c.lastUpdated))
    : null;

  return (
    <div className="min-w-[320px] flex flex-col gap-4">
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
            <NeonButton onClick={handleSync} disabled={syncing}>
              {syncing ? "Fetching..." : "Fetch from Marketplaces"}
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
            <NeonButton secondary onClick={handleSync} disabled={syncing}>
              {syncing ? "Syncing..." : "Refresh"}
            </NeonButton>
          )}
        </div>
      )}
    </div>
  );
}

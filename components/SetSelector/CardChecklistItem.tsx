import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

type CardChecklistItemProps = {
  card: {
    _id: Id<"cardChecklist">;
    cardNumber: string;
    cardName: string;
    team?: string;
    attributes?: string[];
    platformData: {
      bsc?: string;
      sportlots?: string;
    };
    isCustom?: boolean;
  };
};

export default function CardChecklistItem({ card }: CardChecklistItemProps) {
  const [editing, setEditing] = useState(false);
  const [cardName, setCardName] = useState(card.cardName);
  const [team, setTeam] = useState(card.team || "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const updateCard = useMutation(api.selectorOptions.updateCard);
  const deleteCard = useMutation(api.selectorOptions.deleteCard);

  const handleSave = async () => {
    await updateCard({
      id: card._id,
      cardName,
      team: team || undefined,
    });
    setEditing(false);
  };

  const handleDelete = async () => {
    await deleteCard({ id: card._id });
    setConfirmDelete(false);
  };

  if (editing) {
    return (
      <div className="p-3 border rounded-md dark:border-gray-600 bg-gray-50 dark:bg-gray-700 space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={cardName}
            onChange={(e) => setCardName(e.target.value)}
            className="flex-1 p-1.5 border rounded text-sm dark:bg-gray-800 dark:border-gray-600"
            placeholder="Card name"
          />
          <input
            type="text"
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            className="w-32 p-1.5 border rounded text-sm dark:bg-gray-800 dark:border-gray-600"
            placeholder="Team"
          />
        </div>
        <div className="flex gap-1">
          <button
            onClick={handleSave}
            className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
          >
            Save
          </button>
          <button
            onClick={() => {
              setCardName(card.cardName);
              setTeam(card.team || "");
              setEditing(false);
            }}
            className="px-2 py-1 text-xs bg-gray-400 text-white rounded hover:bg-gray-500"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-2.5 border rounded-md dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 group">
      <span className="text-sm font-mono text-gray-500 dark:text-gray-400 w-10 text-right shrink-0">
        #{card.cardNumber}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{card.cardName}</div>
        {card.team && (
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {card.team}
          </div>
        )}
      </div>
      {/* Attribute badges */}
      {card.attributes && card.attributes.length > 0 && (
        <div className="flex gap-1 shrink-0">
          {card.attributes.map((attr) => (
            <span
              key={attr}
              className="text-xs px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
            >
              {attr}
            </span>
          ))}
        </div>
      )}
      {/* Platform badges */}
      <div className="flex gap-1 shrink-0">
        {card.platformData.sportlots && (
          <span className="text-xs px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300">
            SL
          </span>
        )}
        {card.platformData.bsc && (
          <span className="text-xs px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300">
            BSC
          </span>
        )}
        {card.isCustom && (
          <span className="text-xs px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700">
            Custom
          </span>
        )}
      </div>
      {/* Actions (visible on hover) */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={() => setEditing(true)}
          className="px-1.5 py-0.5 text-xs text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
          title="Edit"
        >
          Edit
        </button>
        {confirmDelete ? (
          <button
            onClick={handleDelete}
            className="px-1.5 py-0.5 text-xs text-red-600 dark:text-red-400 font-medium"
          >
            Confirm?
          </button>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            onBlur={() => setConfirmDelete(false)}
            className="px-1.5 py-0.5 text-xs text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
            title="Delete"
          >
            Del
          </button>
        )}
      </div>
    </div>
  );
}

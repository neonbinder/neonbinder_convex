import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import NeonButton from "../modules/NeonButton";
import type { GenericId } from "convex/values";

export default function CardForm({
  setVariantId,
  onDone,
}: {
  setVariantId: GenericId<"setVariants">;
  onDone?: () => void;
}) {
  const [cardNumber, setCardNumber] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [team, setTeam] = useState("");
  const [position, setPosition] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const createCard = useMutation(api.myFunctions.createCard);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardNumber) return;
    try {
      await createCard({
        setVariantId,
        cardNumber,
        playerName: playerName || undefined,
        team: team || undefined,
        position: position || undefined,
        description: description || undefined,
        imageUrl: imageUrl || undefined,
      });
      setCardNumber("");
      setPlayerName("");
      setTeam("");
      setPosition("");
      setDescription("");
      setImageUrl("");
      onDone?.();
    } catch (error) {
      console.error("Error creating card:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Error details:", errorMessage);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Add Card</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Card Number</label>
          <input
            type="text"
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value)}
            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            placeholder="e.g., 1, 2A, 2B"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">
            Player Name (optional)
          </label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            placeholder="e.g., Mike Trout"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">
            Team (optional)
          </label>
          <input
            type="text"
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            placeholder="e.g., Los Angeles Angels"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">
            Position (optional)
          </label>
          <input
            type="text"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            placeholder="e.g., CF, P, C"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">
            Description (optional)
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            placeholder="e.g., Rookie card, All-Star"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">
            Image URL (optional)
          </label>
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            placeholder="https://example.com/card-image.jpg"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 bg-neon-green text-white py-2 px-4 rounded-md hover:bg-neon-yellow hover:text-black transition-colors"
          >
            Add Card
          </button>
          <NeonButton cancel onClick={onDone}>
            Cancel
          </NeonButton>
        </div>
      </form>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { GenericId } from "convex/values";
import CardChecklistItem from "./CardChecklistItem";
import NeonButton from "../modules/NeonButton";
import UnknownEntitiesDialog from "./UnknownEntitiesDialog";
import ChecklistSourceFilter, {
  type SourceChips,
  type SourceFilter,
} from "./ChecklistSourceFilter";

type CardChecklistProps = {
  variantId: GenericId<"selectorOptions">;
  // NEO-6: source-set chip data + per-card label maps derived in the
  // parent SetSelector from the variant row. Lifted out so this component
  // no longer needs its own useQuery for the row, which kept the
  // chip-data hooks above the `if (!cards) return Loading` early-return
  // and previously violated the Rules of Hooks.
  sourceChips: SourceChips;
  sourceLabelMaps: {
    bsc: Record<string, string>;
    sportlots: Record<string, string>;
  };
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

export default function CardChecklist({
  variantId,
  sourceChips,
  sourceLabelMaps,
}: CardChecklistProps) {
  const cards = useQuery(api.selectorOptions.getCardChecklist, {
    selectorOptionId: variantId,
  });
  // NEO-26: walk the ancestor chain once at this layer so every
  // CardChecklistItem below can hand the resolved sport to TeamPicker
  // (typeahead filter) + CardFeaturesEditor (applicability filter).
  // Convex deduplicates same-arg queries, so the additional hook here
  // does not cost a round trip beyond what the existing query graph
  // already pays.
  const ancestorChain = useQuery(api.selectorOptions.getAncestorChain, {
    id: variantId,
  });
  const ancestorSport = ancestorChain?.find((c) => c.level === "sport")?.value;
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
  // Comma-separated player names — forwarded to addCustomCard.players so
  // the next fetchCardChecklist surfaces them in the UnknownEntitiesDialog
  // (which lets the user confirm Wikidata enrichment). Optional.
  const [newPlayers, setNewPlayers] = useState("");
  const [pendingPreview, setPendingPreview] = useState<FetchPreview | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>({
    bsc: null,
    sportlots: null,
  });

  // Reset filter when the variant changes — chips for one variant don't
  // apply to another.
  useEffect(() => {
    setSourceFilter({ bsc: null, sportlots: null });
  }, [variantId]);

  // Scroll-to-new-card: one-shot flag so when the user adds a card via the
  // form, the just-added row is scrolled into view. New cards sort to the
  // end of the list (sortOrder = max + 1). Used by the scrollIntoView
  // effect below. Without it the user (and Maestro) would see no visible
  // feedback after submit. Cleared once `cards` length has grown.
  const newCardRowRef = useRef<HTMLDivElement>(null);
  const scrollToNewCardRef = useRef(false);
  const prevCardCountRef = useRef(0);

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
    const players = newPlayers
      .split(",")
      .map((n) => n.trim())
      .filter((n) => n.length > 0);
    const teamTrimmed = newTeam.trim();
    try {
      await addCustomCard({
        selectorOptionId: variantId,
        cardNumber: newCardNumber.trim(),
        cardName: newCardName.trim() || `Card #${newCardNumber.trim()}`,
        // NEO-26: legacy `team: string` arg removed. The team string
        // is surfaced via `teams` → pendingTeamNames → UnknownEntitiesDialog
        // confirmation on the next sync, which materializes a teams
        // entity link via `teamOnCardIds[]`.
        ...(players.length > 0 ? { players } : {}),
        ...(teamTrimmed ? { teams: [teamTrimmed] } : {}),
      });
      setNewCardNumber("");
      setNewCardName("");
      setNewTeam("");
      setNewPlayers("");
      setShowAddForm(false);
      scrollToNewCardRef.current = true;
    } catch (error) {
      console.error("Failed to add card:", error);
    }
  };

  // After the addCustomCard mutation resolves, Convex's reactive query
  // refreshes `cards` with the new row appended. Detect the length growth
  // and scroll the new (last) DOM row into view exactly once.
  useEffect(() => {
    const count = cards?.length ?? 0;
    if (
      scrollToNewCardRef.current &&
      count > prevCardCountRef.current &&
      count > 0
    ) {
      newCardRowRef.current?.scrollIntoView({
        block: "center",
        behavior: "auto",
      });
      scrollToNewCardRef.current = false;
    }
    prevCardCountRef.current = count;
  }, [cards?.length]);

  if (!cards) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Cards</h2>
        <div className="text-gray-500">Loading checklist...</div>
      </div>
    );
  }

  const sortedCards = [...cards]
    .filter((c) => {
      if (sourceFilter.bsc && c.sourcePlatformIds?.bsc !== sourceFilter.bsc) {
        return false;
      }
      if (
        sourceFilter.sportlots &&
        c.sourcePlatformIds?.sportlots !== sourceFilter.sportlots
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);
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
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <h2 className="text-xl font-semibold">
            Cards{" "}
            {cards.length > 0 && (
              <span className="text-sm font-normal text-gray-500">
                ({cards.length})
              </span>
            )}
          </h2>
          {!showAddForm && (
            <div className="flex gap-2">
              <NeonButton
                onClick={() => setShowAddForm(true)}
                aria-label="Open add card form"
              >
                Add Card
              </NeonButton>
              {sortedCards.length > 0 && (
                <NeonButton
                  secondary
                  onClick={handleSync}
                  disabled={busy}
                  aria-label="Sync card checklist"
                >
                  {fetchLabel}
                </NeonButton>
              )}
            </div>
          )}
        </div>

        {/* Add Card Form — rendered inline right under the header so the
            inputs are immediately visible after the user taps "Add Card".
            Previously this lived below the 70vh Virtuoso list, which on
            headless 1024×629 viewports put Player name 440–800px off-screen
            and broke every flow that wanted to add a custom card. */}
        {showAddForm && (
          <div className="bg-gray-50 dark:bg-gray-900/40 p-4 mb-4 rounded-lg space-y-3">
            <h3 className="font-semibold text-sm">Add Card</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCardNumber}
                onChange={(e) => setNewCardNumber(e.target.value)}
                className="w-20 p-2 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600"
                placeholder="#"
                aria-label="Card number"
                autoFocus
              />
              <input
                type="text"
                value={newCardName}
                onChange={(e) => setNewCardName(e.target.value)}
                className="flex-1 p-2 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600"
                placeholder="Player name"
                aria-label="Card name"
              />
            </div>
            <input
              type="text"
              value={newPlayers}
              onChange={(e) => setNewPlayers(e.target.value)}
              className="w-full p-2 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600"
              placeholder="Player(s) — comma separated, optional"
              aria-label="Players"
            />
            <input
              type="text"
              value={newTeam}
              onChange={(e) => setNewTeam(e.target.value)}
              className="w-full p-2 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600"
              placeholder="Team (optional)"
              aria-label="Team"
            />
            <div className="flex gap-2">
              <NeonButton onClick={handleAddCard} aria-label="Submit new card">
                Add
              </NeonButton>
              <NeonButton
                cancel
                onClick={() => setShowAddForm(false)}
                aria-label="Cancel new card"
              >
                Cancel
              </NeonButton>
            </div>
          </div>
        )}

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

        <ChecklistSourceFilter
          chips={sourceChips}
          filter={sourceFilter}
          onChange={setSourceFilter}
        />

        {sortedCards.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              No cards in this checklist yet.
            </p>
            <NeonButton
              onClick={handleSync}
              disabled={busy}
              aria-label="Sync card checklist"
            >
              {fetchLabel}
            </NeonButton>
          </div>
        ) : (
          // Non-virtualized: every card row is in the DOM regardless of
          // viewport. Trade-off: 600+ cards = 600+ items mounted at once,
          // which is a one-time render cost but completely flat for
          // subsequent interactions. Why we left virtualization behind:
          // Virtuoso's inner-scroll container hid off-fold rows from
          // Maestro's page-level `scrollUntilVisible` (Maestro can't
          // scroll inside another scrollable element) — features-propagation
          // Step E and team-picker Test 7 reload-check both needed to
          // find a freshly-added card that virtualization had unmounted.
          // `useWindowScroll` mode of Virtuoso changed which "Value for
          // League" Maestro matched (SetFeaturesPanel vs CardFeaturesEditor)
          // because items rendered at different page positions, breaking
          // unrelated assertions. Non-virtualized is the simplest path
          // where Maestro and a real user behave the same.
          <div className="space-y-1.5">
            {sortedCards.map((card, i) => (
              <div
                key={card._id}
                ref={i === sortedCards.length - 1 ? newCardRowRef : undefined}
              >
                <CardChecklistItem
                  card={card}
                  sourceLabelMaps={sourceLabelMaps}
                  ancestorSport={ancestorSport}
                />
              </div>
            ))}
          </div>
        )}
      </div>

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

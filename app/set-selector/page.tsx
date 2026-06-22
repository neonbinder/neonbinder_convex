import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import SetSelector from "../../components/modules/SetSelector";
import AdminTools from "../../components/SetSelector/AdminTools";
import MissingCredentialsBanner from "../../components/SetSelector/MissingCredentialsBanner";

const REQUIRED_SITES = ["buysportscards", "sportlots"];

export default function SetSelectorPage() {
  const profile = useQuery(api.userProfile.getUserProfile);

  if (profile === undefined) {
    return (
      <div className="p-6 text-center text-sm text-slate-400">
        Loading credentials…
      </div>
    );
  }

  const missing = REQUIRED_SITES.filter(
    (site) =>
      !profile?.siteCredentials?.some(
        (c) => c.site === site && c.hasCredentials,
      ),
  );

  if (missing.length > 0) {
    return (
      <div className="p-6">
        <MissingCredentialsBanner missing={missing} />
      </div>
    );
  }

  // The cascade lives in a horizontally-scrollable columns row, so it does NOT
  // need to break out of the layout for width — it scrolls. A prior vw-based
  // full-bleed break-out (negative margins) caused multiple CI bugs: a left-edge
  // clip (custom-entry-survives-resync) and — fatally for in-place seeding — it
  // let the columns row slide UNDER the fixed nav so taps landed on the nav and
  // navigated to /inventory (NEO-63). It also only added width above ~1300px; at
  // ≤1280 (incl the 1024px Maestro CI viewport) it was equal-or-narrower anyway.
  // So: no break-out. The section renders in normal flow inside main's
  // lg:pr-[170px] gutter — nav-safe exactly like every other page — capped at
  // the layout's max-w-6xl; the columns row's overflow-x-auto handles extra
  // columns via horizontal scroll. (AdminTools already lives in its own padded
  // section and never needed the break-out either.)
  return (
    <>
      <div className="max-w-6xl mx-auto px-6 pt-6 mb-4">
        <h1 className="text-3xl font-bold mb-6 text-center">Set Selector</h1>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-6">
          Build set parameters using marketplace APIs with searchable dropdowns
        </p>
        <AdminTools />
      </div>
      <div className="px-6 pb-6">
        <SetSelector />
      </div>
    </>
  );
}

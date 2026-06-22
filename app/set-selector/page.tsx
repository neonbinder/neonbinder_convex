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

  // The break-out negative margins below are tuned for wide viewports (≥1280 px).
  // At 1024 px (Maestro CI headless viewport), they push the inner content past
  // x=0 and clip the leftmost AdminTools button by ~1%, which trips Maestro's
  // 100 % visibility threshold and breaks cascade/setup.yaml. AdminTools doesn't
  // need the break-out — it lives in a max-w-6xl wrapper either way — so render
  // it OUTSIDE the break-out container in its own normally-padded section.
  return (
    <>
      <div className="max-w-6xl mx-auto px-6 pt-6 mb-4">
        <h1 className="text-3xl font-bold mb-6 text-center">Set Selector</h1>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-6">
          Build set parameters using marketplace APIs with searchable dropdowns
        </p>
        <AdminTools />
      </div>
      <div
        className="px-6 pb-6"
        style={{
          width: "calc((100vw - 170px) * 0.9)",
          marginLeft: "calc(-50vw + 50% + (100vw - 170px) * 0.05)",
          marginRight: "calc(-50vw + 50% + 170px + (100vw - 170px) * 0.05)",
        }}
      >
        <SetSelector />
      </div>
    </>
  );
}

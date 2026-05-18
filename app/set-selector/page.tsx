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

  return (
    // Break out of binder-layout's max-w-6xl constraint using viewport-width margins.
    // The Set Selector needs full horizontal space for its 7+ hierarchical columns.
    <div
      className="p-6"
      style={{
        width: "calc((100vw - 170px) * 0.9)",
        marginLeft: "calc(-50vw + 50% + (100vw - 170px) * 0.05)",
        marginRight: "calc(-50vw + 50% + 170px + (100vw - 170px) * 0.05)",
      }}
    >
      <h1 className="text-3xl font-bold mb-6 text-center">Set Selector</h1>
      <p className="text-center text-gray-600 dark:text-gray-400 mb-6">
        Build set parameters using marketplace APIs with searchable dropdowns
      </p>
      <div className="max-w-6xl mx-auto mb-4">
        <AdminTools />
      </div>
      <SetSelector />
    </div>
  );
}

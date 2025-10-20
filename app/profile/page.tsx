"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import NeonButton from "../../components/modules/NeonButton";
import Image from "next/image";

const SUPPORTED_SITES = [
  { key: "buysportscards", label: "BuySportsCards" },
  { key: "ebay", label: "eBay" },
  { key: "sportlots", label: "Sportlots" },
  // Add more sites here as needed
];

export default function ProfilePage() {
  const router = useRouter();
  const [selectedSite, setSelectedSite] = useState(SUPPORTED_SITES[0].key);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageDetails, setMessageDetails] = useState<string | undefined>(
    undefined,
  );
  const [messageType, setMessageType] = useState<"success" | "error">(
    "success",
  );
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Prize Pool state
  const [newPrizeName, setNewPrizeName] = useState("");
  const [newPrizePercentage, setNewPrizePercentage] = useState("");
  const [editingPrizeId, setEditingPrizeId] = useState<string | null>(null);
  const [editPrizeName, setEditPrizeName] = useState("");
  const [editPrizePercentage, setEditPrizePercentage] = useState("");
  const [prizeMessage, setPrizeMessage] = useState("");
  const [prizeMessageType, setPrizeMessageType] = useState<"success" | "error">("success");

  // Actions and Mutations
  const storeCredentials = useAction(
    api.adapters.secret_manager.storeSiteCredentials,
  );
  const updateCredentialStatus = useMutation(
    api.userProfile.updateSiteCredentialStatus,
  );
  const removeCredentialStatus = useMutation(
    api.userProfile.removeSiteCredentialStatus,
  );
  const deleteSiteCredentials = useAction(
    api.adapters.secret_manager.deleteSiteCredentials,
  );
  const getSiteCredentials = useAction(
    api.adapters.secret_manager.getSiteCredentials,
  );
  const testSiteCredentials = useAction(
    api.adapters.secret_manager.testSiteCredentials,
  );

  // Prize Pool mutations and queries
  const createPrize = useMutation(api.userProfile.createPrize);
  const updatePrize = useMutation(api.userProfile.updatePrize);
  const deletePrize = useMutation(api.userProfile.deletePrize);
  const prizes = useQuery(api.userProfile.getPrizes);

  // Get user profile to check if credentials are stored
  const profile = useQuery(api.userProfile.getUserProfile);
  const siteMeta = SUPPORTED_SITES.find((s) => s.key === selectedSite);
  const hasStoredCredentials =
    profile?.siteCredentials?.some(
      (cred) => cred.site === selectedSite && cred.hasCredentials,
    ) || false;

  // Debug logging
  console.log("[ProfilePage] profile:", profile);
  console.log("[ProfilePage] selectedSite:", selectedSite);
  console.log("[ProfilePage] hasStoredCredentials:", hasStoredCredentials);

  // Reset form fields and edit mode when site changes
  useEffect(() => {
    setUsername("");
    setPassword("");
    setMessage("");
    setIsAuthenticated(false);
    setEditMode(false);
  }, [selectedSite]);

  // Check if credentials exist in Secret Manager for the selected site
  useEffect(() => {
    const check = async () => {
      if (!hasStoredCredentials) {
        setIsAuthenticated(false);
        return;
      }
      setIsLoading(true);
      try {
        const creds = await getSiteCredentials({ site: selectedSite });
        console.log("[ProfilePage] getSiteCredentials result:", creds);
        setIsAuthenticated(!!creds);
      } catch (err) {
        console.log("[ProfilePage] getSiteCredentials error:", err);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSite, hasStoredCredentials]);

  const handleSaveCredentials = async () => {
    if (!username || !password) {
      setMessage("Please enter both username and password to save.");
      setMessageType("error");
      return;
    }
    setIsLoading(true);
    setMessage("");
    try {
      // Store credentials in Secret Manager
      const secretResult = await storeCredentials({
        site: selectedSite,
        username,
        password,
      });
      if (!secretResult.success) {
        throw new Error(secretResult.message);
      }
      // Update user profile status
      await updateCredentialStatus({
        site: selectedSite,
        hasCredentials: true,
      });
      setMessage(
        `Credentials saved successfully! Your credentials have been securely stored in Google Cloud Secret Manager for ${siteMeta?.label}.`,
      );
      setMessageType("success");
      setIsAuthenticated(true);
      setPassword("");
    } catch (error) {
      setMessage(
        `Failed to save credentials: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      setMessageType("error");
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestCredentials = async () => {
    if (!hasStoredCredentials) {
      setMessage("Please save credentials first before testing.");
      setMessageType("error");
      setMessageDetails(undefined);
      return;
    }
    setIsLoading(true);
    setMessage(`Testing stored credentials with ${siteMeta?.label}...`);
    setMessageDetails(undefined);
    try {
      // Test credentials using the platform-specific test action
      console.log("Testing credentials for site:", selectedSite);

      // For BuySportsCards, show a note about the browser service
      if (selectedSite === "buysportscards") {
        console.log(
          "Note: BuySportsCards requires the browser service to be running locally at http://localhost:8080",
        );
        console.log(
          'If you see an error about the browser service, please run "npm start" in the neonbinder_browser directory',
        );
      }

      const testResult = await testSiteCredentials({ site: selectedSite });
      console.log("Test credentials result:", testResult);

      if (testResult.success) {
        setMessage(testResult.message);
        setMessageDetails(testResult.details);
        setMessageType("success");
        setIsAuthenticated(true);
      } else {
        setMessage(testResult.message);
        setMessageDetails(testResult.details);
        setMessageType("error");
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error("Error testing credentials:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setMessage("Failed to test credentials. Please try again.");
      setMessageDetails(
        `An unexpected error occurred while testing credentials: ${errorMessage}`,
      );
      setMessageType("error");
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearCredentials = async () => {
    if (
      !confirm(
        `Are you sure you want to clear your ${siteMeta?.label} credentials?`,
      )
    ) {
      return;
    }
    setIsLoading(true);
    setMessage("");
    try {
      // Delete from Secret Manager
      await deleteSiteCredentials({ site: selectedSite });
      // Remove from user profile
      await removeCredentialStatus({ site: selectedSite });
      setUsername("");
      setPassword("");
      setIsAuthenticated(false);
      setMessage("Credentials cleared successfully!");
      setMessageType("success");
    } catch {
      setMessage("Failed to clear credentials. Please try again.");
      setMessageType("error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-10 bg-background p-4 border-b-2 border-slate-200 dark:border-slate-800 flex flex-row justify-between items-center">
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt="Neon Binder" width={40} height={40} />
          <span className="neon-header">Neon Binder</span>
        </div>
        <NeonButton onClick={() => router.push("/")}>Back to Home</NeonButton>
      </header>
      <main className="p-8 max-w-2xl mx-auto">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Profile Settings</h1>
            <p className="text-muted-foreground">
              Manage your account settings and credentials for supported
              platforms.
            </p>
          </div>
          {/* Site Selector */}
          <div className="mb-6">
            <label
              htmlFor="site-select"
              className="block text-sm font-medium mb-2"
            >
              Select Platform
            </label>
            <select
              id="site-select"
              value={selectedSite}
              onChange={(e) => setSelectedSite(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {SUPPORTED_SITES.map((site) => (
                <option key={site.key} value={site.key}>
                  {site.label}
                </option>
              ))}
            </select>
          </div>
          {/* Credentials Section */}
          <div className="space-y-6 p-6 border border-slate-200 dark:border-slate-800 rounded-lg">
            <div>
              <h2 className="text-xl font-semibold mb-2">
                {siteMeta?.label} Credentials
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Enter your {siteMeta?.label} login credentials to enable
                automatic authentication. Your credentials are securely stored
                in Google Cloud Secret Manager.
              </p>
            </div>
            {/* If credentials are stored and not in edit mode, show summary and buttons */}
            {hasStoredCredentials && !editMode ? (
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800 rounded-md">
                  <strong>💾 Credentials saved for {siteMeta?.label}</strong>
                  <p className="text-sm mt-1">
                    Your credentials are securely stored. You can edit or test
                    them below.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                  <NeonButton
                    onClick={() => setEditMode(true)}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    Edit
                  </NeonButton>
                  <NeonButton
                    onClick={handleTestCredentials}
                    disabled={isLoading}
                    className="flex-1 bg-slate-600 hover:bg-slate-700"
                  >
                    {isLoading ? "Testing..." : "Test Credentials"}
                  </NeonButton>
                  <NeonButton
                    onClick={handleClearCredentials}
                    disabled={isLoading}
                    className="flex-1 bg-red-600 hover:bg-red-700"
                  >
                    {isLoading ? "Clearing..." : "Clear Credentials"}
                  </NeonButton>
                </div>
              </div>
            ) : (
              // Show input fields and Save/Test buttons if editing or no credentials
              <>
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="username"
                      className="block text-sm font-medium mb-2"
                    >
                      {siteMeta?.label} Username/Email
                    </label>
                    <input
                      id="username"
                      type="email"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder={`Enter your ${siteMeta?.label} email`}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium mb-2"
                    >
                      {siteMeta?.label} Password
                    </label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder={`Enter your ${siteMeta?.label} password`}
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                  <NeonButton
                    onClick={handleSaveCredentials}
                    disabled={isLoading || !username || !password}
                    className="flex-1"
                  >
                    {isLoading ? "Saving..." : "Save Credentials"}
                  </NeonButton>
                  <NeonButton
                    onClick={handleTestCredentials}
                    disabled={isLoading || !hasStoredCredentials}
                    className="flex-1 bg-slate-600 hover:bg-slate-700"
                  >
                    {isLoading ? "Testing..." : "Test Stored Credentials"}
                  </NeonButton>
                  {hasStoredCredentials && (
                    <NeonButton
                      onClick={handleClearCredentials}
                      disabled={isLoading}
                      className="flex-1 bg-red-600 hover:bg-red-700"
                    >
                      {isLoading ? "Clearing..." : "Clear Credentials"}
                    </NeonButton>
                  )}
                </div>
                {hasStoredCredentials && (
                  <NeonButton
                    onClick={() => setEditMode(false)}
                    disabled={isLoading}
                    className="mt-2"
                  >
                    Cancel
                  </NeonButton>
                )}
              </>
            )}
            {message && (
              <div
                className={`p-4 rounded-md ${
                  messageType === "success"
                    ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800"
                    : "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800"
                }`}
              >
                <div className="font-medium">{message}</div>
                {messageDetails && (
                  <div className="mt-2 text-sm opacity-90">
                    <hr
                      className={`my-2 border-t ${
                        messageType === "success"
                          ? "border-green-200 dark:border-green-700"
                          : "border-red-200 dark:border-red-700"
                      }`}
                    />
                    {messageDetails}
                  </div>
                )}
              </div>
            )}
            {hasStoredCredentials && !isAuthenticated && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800 rounded-md">
                <strong>💾 Credentials Stored</strong>
                <p className="text-sm mt-1">
                  Your credentials are saved. Click &quot;Test Stored
                  Credentials&quot; to verify they work.
                </p>
              </div>
            )}
          </div>
          {/* Security Information */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
              🔒 Security Information
            </h3>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li>
                • Your credentials are securely stored in Google Cloud Secret
                Manager
              </li>
              <li>
                • Credentials are encrypted and only accessible to your account
              </li>
              <li>• We never share your credentials with third parties</li>
              <li>• You can clear your credentials at any time</li>
              <li>• Test button uses stored credentials from Secret Manager</li>
            </ul>
          </div>
        </div>
      </main>
    </>
  );
}

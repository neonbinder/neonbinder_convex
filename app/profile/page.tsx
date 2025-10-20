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
  const [newPokemonImage, setNewPokemonImage] = useState<string | null>(null);
  const [newPokemonImagePreview, setNewPokemonImagePreview] = useState<string | null>(null);
  const [newSportsImages, setNewSportsImages] = useState<string[]>([]);
  const [newSportsImagePreviews, setNewSportsImagePreviews] = useState<string[]>([]);
  const [editingPrizeId, setEditingPrizeId] = useState<string | null>(null);
  const [editPrizeName, setEditPrizeName] = useState("");
  const [editPrizePercentage, setEditPrizePercentage] = useState("");
  const [editPokemonImage, setEditPokemonImage] = useState<string | null>(null);
  const [editPokemonImagePreview, setEditPokemonImagePreview] = useState<string | null>(null);
  const [editSportsImages, setEditSportsImages] = useState<string[]>([]);
  const [editSportsImagePreviews, setEditSportsImagePreviews] = useState<string[]>([]);
  const [prizeMessage, setPrizeMessage] = useState("");
  const [prizeMessageType, setPrizeMessageType] = useState<"success" | "error">("success");
  const [isMounted, setIsMounted] = useState(false);

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
  const uploadPrizeImage = useAction(api.adapters.gcs.uploadPrizeImage);
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

  // Set mounted flag after hydration
  useEffect(() => {
    setIsMounted(true);
  }, []);

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

  const handleAddPrize = async () => {
    if (!newPrizeName.trim()) {
      setPrizeMessage("Please enter a prize name.");
      setPrizeMessageType("error");
      return;
    }
    if (!newPrizePercentage || isNaN(Number(newPrizePercentage))) {
      setPrizeMessage("Please enter a valid percentage.");
      setPrizeMessageType("error");
      return;
    }
    if (!newPokemonImage && newSportsImages.length === 0) {
      setPrizeMessage("Please select at least one image (Pokemon or Sports).");
      setPrizeMessageType("error");
      return;
    }
    const percentage = Number(newPrizePercentage);
    if (percentage < 0 || percentage > 100) {
      setPrizeMessage("Percentage must be between 0 and 100.");
      setPrizeMessageType("error");
      return;
    }

    // Check if percentages will sum to 100
    if (prizes) {
      const currentTotal = prizes.reduce((sum, prize) => sum + prize.percentage, 0);
      const newTotal = currentTotal + percentage;
      if (newTotal !== 100) {
        const diff = 100 - newTotal;
        setPrizeMessage(
          `Prize percentages must sum to 100%. Current total with this prize would be ${newTotal}% (${diff > 0 ? '+' + diff : diff}%).`
        );
        setPrizeMessageType("error");
        return;
      }
    } else {
      if (percentage !== 100) {
        setPrizeMessage(`Prize percentage must be exactly 100% (currently ${percentage}%).`);
        setPrizeMessageType("error");
        return;
      }
    }

    setIsLoading(true);
    setPrizeMessage("");
    try {
      let pokemonImageUrl: string | undefined;
      let sportsImageUrls: string[] = [];

      // Upload Pokemon image if provided
      if (newPokemonImage) {
        const uploadResult = await uploadPrizeImage({
          imageBase64: newPokemonImage,
          prizeName: `${newPrizeName.trim()}_pokemon`,
        });

        if (!uploadResult.success || !uploadResult.imageUrl) {
          throw new Error(uploadResult.message);
        }
        pokemonImageUrl = uploadResult.imageUrl;
      }

      // Upload Sports images if provided
      for (let i = 0; i < newSportsImages.length; i++) {
        const uploadResult = await uploadPrizeImage({
          imageBase64: newSportsImages[i],
          prizeName: `${newPrizeName.trim()}_sports_${i + 1}`,
        });

        if (!uploadResult.success || !uploadResult.imageUrl) {
          throw new Error(uploadResult.message);
        }
        sportsImageUrls.push(uploadResult.imageUrl);
      }

      // Create prize with both image URLs
      await createPrize({
        prizeName: newPrizeName.trim(),
        percentage,
        pokemonImageUrl,
        sportsImageUrls: sportsImageUrls.length > 0 ? sportsImageUrls : undefined,
      });
      setNewPrizeName("");
      setNewPrizePercentage("");
      setNewPokemonImage(null);
      setNewPokemonImagePreview(null);
      setNewSportsImages([]);
      setNewSportsImagePreviews([]);
      setPrizeMessage("Prize added successfully!");
      setPrizeMessageType("success");
    } catch (error) {
      setPrizeMessage(`Failed to add prize: ${error instanceof Error ? error.message : "Unknown error"}`);
      setPrizeMessageType("error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePrize = async () => {
    if (!editingPrizeId) return;
    if (!editPrizeName.trim()) {
      setPrizeMessage("Please enter a prize name.");
      setPrizeMessageType("error");
      return;
    }
    if (!editPrizePercentage || isNaN(Number(editPrizePercentage))) {
      setPrizeMessage("Please enter a valid percentage.");
      setPrizeMessageType("error");
      return;
    }
    const percentage = Number(editPrizePercentage);
    if (percentage < 0 || percentage > 100) {
      setPrizeMessage("Percentage must be between 0 and 100.");
      setPrizeMessageType("error");
      return;
    }

    // Check if percentages will sum to 100
    if (prizes) {
      const currentTotal = prizes.reduce((sum, prize) => sum + prize.percentage, 0);
      const editingPrize = prizes.find(p => p._id === editingPrizeId);
      const editingPrizePercentage = editingPrize?.percentage || 0;
      const newTotal = currentTotal - editingPrizePercentage + percentage;
      if (newTotal !== 100) {
        const diff = 100 - newTotal;
        setPrizeMessage(
          `Prize percentages must sum to 100%. Current total with this change would be ${newTotal}% (${diff > 0 ? '+' + diff : diff}%).`
        );
        setPrizeMessageType("error");
        return;
      }
    }

    setIsLoading(true);
    setPrizeMessage("");
    try {
      let pokemonImageUrl: string | undefined;
      let sportsImageUrls: string[] = [];

      // Upload new Pokemon image if selected
      if (editPokemonImage && editPokemonImage !== editPokemonImagePreview?.split(",")[1]) {
        const uploadResult = await uploadPrizeImage({
          imageBase64: editPokemonImage,
          prizeName: `${editPrizeName.trim()}_pokemon`,
        });

        if (!uploadResult.success || !uploadResult.imageUrl) {
          throw new Error(uploadResult.message);
        }
        pokemonImageUrl = uploadResult.imageUrl;
      }

      // Upload new Sports images if selected
      for (let i = 0; i < editSportsImages.length; i++) {
        const currentImage = editSportsImages[i];
        const isNewImage = !editSportsImagePreviews.some(preview =>
          preview === currentImage || currentImage === preview.split(",")[1]
        );

        if (isNewImage) {
          const uploadResult = await uploadPrizeImage({
            imageBase64: currentImage,
            prizeName: `${editPrizeName.trim()}_sports_${i + 1}`,
          });

          if (!uploadResult.success || !uploadResult.imageUrl) {
            throw new Error(uploadResult.message);
          }
          sportsImageUrls.push(uploadResult.imageUrl);
        } else {
          sportsImageUrls.push(currentImage);
        }
      }

      // Update prize
      await updatePrize({
        prizeId: editingPrizeId,
        prizeName: editPrizeName.trim(),
        percentage,
        pokemonImageUrl,
        sportsImageUrls: sportsImageUrls.length > 0 ? sportsImageUrls : undefined,
      });
      setEditingPrizeId(null);
      setEditPrizeName("");
      setEditPrizePercentage("");
      setEditPokemonImage(null);
      setEditPokemonImagePreview(null);
      setEditSportsImages([]);
      setEditSportsImagePreviews([]);
      setPrizeMessage("Prize updated successfully!");
      setPrizeMessageType("success");
    } catch (error) {
      setPrizeMessage(`Failed to update prize: ${error instanceof Error ? error.message : "Unknown error"}`);
      setPrizeMessageType("error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditPrize = (prizeId: string, prizeName: string, percentage: number, pokemonImageUrl?: string, sportsImageUrls?: string[]) => {
    setEditingPrizeId(prizeId);
    setEditPrizeName(prizeName);
    setEditPrizePercentage(percentage.toString());
    setEditPokemonImage(null);
    setEditPokemonImagePreview(pokemonImageUrl || null);
    setEditSportsImages([]);
    setEditSportsImagePreviews(sportsImageUrls || []);
    setPrizeMessage("");
  };

  const handleDeletePrize = async (prizeId: string) => {
    if (!confirm("Are you sure you want to delete this prize?")) {
      return;
    }

    setIsLoading(true);
    setPrizeMessage("");
    try {
      await deletePrize({ prizeId });
      setPrizeMessage("Prize deleted successfully!");
      setPrizeMessageType("success");
    } catch (error) {
      setPrizeMessage(`Failed to delete prize: ${error instanceof Error ? error.message : "Unknown error"}`);
      setPrizeMessageType("error");
    } finally {
      setIsLoading(false);
    }
  };

  const cancelEditPrize = () => {
    setEditingPrizeId(null);
    setEditPrizeName("");
    setEditPrizePercentage("");
    setEditPokemonImage(null);
    setEditPokemonImagePreview(null);
    setEditSportsImages([]);
    setEditSportsImagePreviews([]);
    setPrizeMessage("");
  };

  const handleImageFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    imageType: "pokemon" | "sports",
    isEdit: boolean = false
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setPrizeMessage("Please select a valid image file.");
      setPrizeMessageType("error");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setPrizeMessage("Image size must be less than 5MB.");
      setPrizeMessageType("error");
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = event.target?.result as string;
      if (isEdit) {
        if (imageType === "pokemon") {
          setEditPokemonImage(base64String);
          setEditPokemonImagePreview(base64String);
        } else {
          setEditSportsImages([...editSportsImages, base64String]);
          setEditSportsImagePreviews([...editSportsImagePreviews, base64String]);
        }
      } else {
        if (imageType === "pokemon") {
          setNewPokemonImage(base64String);
          setNewPokemonImagePreview(base64String);
        } else {
          setNewSportsImages([...newSportsImages, base64String]);
          setNewSportsImagePreviews([...newSportsImagePreviews, base64String]);
        }
      }
      setPrizeMessage("");
    };
    reader.readAsDataURL(file);
  };

  const removeSportsImage = (index: number, isEdit: boolean = false) => {
    if (isEdit) {
      setEditSportsImages(editSportsImages.filter((_, i) => i !== index));
      setEditSportsImagePreviews(editSportsImagePreviews.filter((_, i) => i !== index));
    } else {
      setNewSportsImages(newSportsImages.filter((_, i) => i !== index));
      setNewSportsImagePreviews(newSportsImagePreviews.filter((_, i) => i !== index));
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
          {/* Prize Pool Section */}
          <div className="space-y-6 p-6 border border-slate-200 dark:border-slate-800 rounded-lg">
            <div>
              <h2 className="text-xl font-semibold mb-2">Prize Pool</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Manage your prize pool for the wheel of fortune spin. Prizes with higher percentages are more likely to be won.
              </p>
            </div>

            {/* Add/Edit Prize Form */}
            <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-900/30 rounded-md">
              <div>
                <label
                  htmlFor={editingPrizeId ? "edit-prize-name" : "prize-name"}
                  className="block text-sm font-medium mb-2"
                >
                  Prize Name
                </label>
                <input
                  id={editingPrizeId ? "edit-prize-name" : "prize-name"}
                  type="text"
                  value={editingPrizeId ? editPrizeName : newPrizeName}
                  onChange={(e) => editingPrizeId ? setEditPrizeName(e.target.value) : setNewPrizeName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Enter prize name (e.g., Extra Card, Booster Pack)"
                />
              </div>
              <div>
                <label
                  htmlFor={editingPrizeId ? "edit-prize-percentage" : "prize-percentage"}
                  className="block text-sm font-medium mb-2"
                >
                  Win Percentage (0-100)
                </label>
                <input
                  id={editingPrizeId ? "edit-prize-percentage" : "prize-percentage"}
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={editingPrizeId ? editPrizePercentage : newPrizePercentage}
                  onChange={(e) => editingPrizeId ? setEditPrizePercentage(e.target.value) : setNewPrizePercentage(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Enter percentage (0-100)"
                />
              </div>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor={editingPrizeId ? "edit-prize-pokemon-image" : "prize-pokemon-image"}
                    className="block text-sm font-medium mb-2"
                  >
                    Pokémon Image {editingPrizeId && "(leave blank to keep current)"}
                  </label>
                  <input
                    id={editingPrizeId ? "edit-prize-pokemon-image" : "prize-pokemon-image"}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageFileChange(e, "pokemon", editingPrizeId !== null)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                {(editingPrizeId ? editPokemonImagePreview : newPokemonImagePreview) && (
                  <div className="mt-2">
                    <p className="text-sm font-medium mb-2">Pokémon Preview:</p>
                    <img
                      src={editingPrizeId ? editPokemonImagePreview : newPokemonImagePreview}
                      alt="Pokemon preview"
                      className="h-32 w-32 object-cover rounded-md border border-slate-300 dark:border-slate-600"
                    />
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor={editingPrizeId ? "edit-prize-sports-image" : "prize-sports-image"}
                    className="block text-sm font-medium mb-2"
                  >
                    Sports Images {editingPrizeId && "(leave blank to keep current)"}
                  </label>
                  <input
                    id={editingPrizeId ? "edit-prize-sports-image" : "prize-sports-image"}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageFileChange(e, "sports", editingPrizeId !== null)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Upload multiple sports images (one at a time)</p>
                </div>
                {(editingPrizeId ? editSportsImagePreviews : newSportsImagePreviews).length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-medium mb-2">Sports Previews ({(editingPrizeId ? editSportsImagePreviews : newSportsImagePreviews).length}):</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {(editingPrizeId ? editSportsImagePreviews : newSportsImagePreviews).map((preview, index) => (
                        <div key={index} className="relative">
                          <img
                            src={preview}
                            alt={`Sports preview ${index + 1}`}
                            className="h-24 w-24 object-cover rounded-md border border-slate-300 dark:border-slate-600"
                          />
                          <button
                            type="button"
                            onClick={() => removeSportsImage(index, editingPrizeId !== null)}
                            className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <NeonButton
                  onClick={editingPrizeId ? handleUpdatePrize : handleAddPrize}
                  disabled={isLoading}
                  className="flex-1"
                >
                  {isLoading ? "Processing..." : editingPrizeId ? "Update Prize" : "Add Prize"}
                </NeonButton>
                {editingPrizeId && (
                  <NeonButton
                    onClick={cancelEditPrize}
                    disabled={isLoading}
                    className="flex-1 bg-slate-600 hover:bg-slate-700"
                  >
                    Cancel
                  </NeonButton>
                )}
              </div>
            </div>

            {/* Prize Messages */}
            {isMounted && prizeMessage && (
              <div
                className={`p-4 rounded-md ${
                  prizeMessageType === "success"
                    ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800"
                    : "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800"
                }`}
              >
                <div className="font-medium">{prizeMessage}</div>
              </div>
            )}

            {/* Prizes List */}
            {isMounted && (
              prizes && prizes.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm">Your Prizes ({prizes.length})</h3>
                  <div className="space-y-3">
                    {prizes.map((prize) => (
                      <div
                        key={prize._id}
                        className="flex items-start justify-between p-4 bg-slate-50 dark:bg-slate-900/30 rounded-md border border-slate-200 dark:border-slate-700"
                      >
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          <div className="flex flex-wrap gap-3 flex-shrink-0">
                            {prize.pokemonImageUrl && (
                              <div className="flex flex-col items-center">
                                <img
                                  src={prize.pokemonImageUrl}
                                  alt={`${prize.prizeName} Pokemon`}
                                  className="h-20 w-20 object-cover rounded border border-slate-300 dark:border-slate-600"
                                />
                                <span className="text-xs mt-1 text-muted-foreground">Pokémon</span>
                              </div>
                            )}
                            {prize.sportsImageUrls && prize.sportsImageUrls.length > 0 && (
                              <>
                                {prize.sportsImageUrls.map((imageUrl, index) => (
                                  <div key={index} className="flex flex-col items-center">
                                    <img
                                      src={imageUrl}
                                      alt={`${prize.prizeName} Sports ${index + 1}`}
                                      className="h-20 w-20 object-cover rounded border border-slate-300 dark:border-slate-600"
                                    />
                                    <span className="text-xs mt-1 text-muted-foreground">Sports</span>
                                  </div>
                                ))}
                              </>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{prize.prizeName}</p>
                            <p className="text-sm text-muted-foreground">{prize.percentage}% win chance</p>
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4 flex-shrink-0">
                          <NeonButton
                            onClick={() => handleEditPrize(prize._id, prize.prizeName, prize.percentage, prize.pokemonImageUrl, prize.sportsImageUrls)}
                            disabled={isLoading || editingPrizeId !== null}
                            className="bg-slate-600 hover:bg-slate-700 px-3 py-1 text-sm"
                          >
                            Edit
                          </NeonButton>
                          <NeonButton
                            onClick={() => handleDeletePrize(prize._id)}
                            disabled={isLoading}
                            className="bg-red-600 hover:bg-red-700 px-3 py-1 text-sm"
                          >
                            Delete
                          </NeonButton>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 dark:bg-slate-900/30 rounded-md text-center text-muted-foreground">
                  <p>No prizes configured yet. Add your first prize above.</p>
                </div>
              )
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
              <li>�� We never share your credentials with third parties</li>
              <li>• You can clear your credentials at any time</li>
              <li>• Test button uses stored credentials from Secret Manager</li>
            </ul>
          </div>
        </div>
      </main>
    </>
  );
}

import { useState, useEffect } from "react";
import {
  Settings,
  Database,
  Info,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Image,
  Trash2,
  TrendingUp,
  Save,
} from "lucide-react";
import api, {
  checkHealth,
  getLidarrRootFolders,
  getLidarrQualityProfiles,
  getLidarrMetadataProfiles,
  getAppSettings,
  updateAppSettings,
} from "../utils/api";

function SettingsPage() {
  const [health, setHealth] = useState(null);
  const [rootFolders, setRootFolders] = useState([]);
  const [qualityProfiles, setQualityProfiles] = useState([]);
  const [metadataProfiles, setMetadataProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshingDiscovery, setRefreshingDiscovery] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [saving, setSaving] = useState(false);

  const [settings, setSettings] = useState({
    rootFolderPath: "",
    qualityProfileId: "",
    metadataProfileId: "",
    monitored: true,
    searchForMissingAlbums: false,
    albumFolders: true,
  });

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const [healthData, savedSettings] = await Promise.all([
          checkHealth(),
          getAppSettings(),
        ]);
      setHealth(healthData);
        setSettings(savedSettings);

        if (healthData.lidarrConfigured) {
          const [folders, quality, metadata] = await Promise.all([
            getLidarrRootFolders(),
            getLidarrQualityProfiles(),
            getLidarrMetadataProfiles(),
          ]);
          setRootFolders(folders);
          setQualityProfiles(quality);
          setMetadataProfiles(metadata);
        }
      } catch (err) {
        console.error("Failed to fetch settings:", err);
      } finally {
        setLoading(false);
    }
  };

    fetchSettings();
  }, []);
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateAppSettings(settings);
      alert("Default settings saved successfully!");
    } catch (err) {
      alert("Failed to save settings: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRefreshDiscovery = async () => {
    if (refreshingDiscovery) return;
    setRefreshingDiscovery(true);
    try {
      await api.post("/discover/refresh");
      alert(
        "Discovery refresh started in background. This may take a few minutes to fully hydrate images.",
      );
      const healthData = await checkHealth();
      setHealth(healthData);
    } catch (err) {
      alert(
        "Failed to start refresh: " +
          (err.response?.data?.message || err.message),
      );
    } finally {
      setRefreshingDiscovery(false);
    }
  };

  const handleClearCache = async () => {
    if (
      !window.confirm(
        "Are you sure you want to clear the discovery and image cache? This will reset all recommendations until the next refresh.",
      )
    )
      return;
    setClearingCache(true);
    try {
      await api.post("/discover/clear");
      alert("Cache cleared successfully.");
      const healthData = await checkHealth();
      setHealth(healthData);
    } catch (err) {
      alert(
        "Failed to clear cache: " +
          (err.response?.data?.message || err.message),
      );
    } finally {
      setClearingCache(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="card mb-8">
        <div className="flex items-center mb-6">
          <Settings className="w-8 h-8 text-primary-600 mr-3" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Settings
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Configuration and system information
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-8">
          <div className="card">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6 flex items-center">
              <Database className="w-6 h-6 mr-2 text-primary-500" />
              Default Artist Options
            </h2>
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Root Folder
                </label>
                <select
                  className="input"
                  value={settings.rootFolderPath || ""}
                  onChange={(e) =>
                    setSettings({ ...settings, rootFolderPath: e.target.value })
                  }
                >
                  <option value="">Select a default folder...</option>
                  {rootFolders.map((f) => (
                    <option key={f.id} value={f.path}>
                      {f.path} (
                      {f.freeSpace
                        ? `${(f.freeSpace / 1024 / 1024 / 1024).toFixed(2)} GB free`
                        : "unknown"}
                      )
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Quality Profile
                  </label>
                  <select
                    className="input"
                    value={settings.qualityProfileId || ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        qualityProfileId: parseInt(e.target.value) || "",
                      })
                    }
                  >
                    <option value="">Select default...</option>
                    {qualityProfiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Metadata Profile
                  </label>
                  <select
                    className="input"
                    value={settings.metadataProfileId || ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        metadataProfileId: parseInt(e.target.value) || "",
                      })
                    }
                  >
                    <option value="">Select default...</option>
                    {metadataProfiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <label className="flex items-center space-x-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    className="form-checkbox h-5 w-5 text-primary-600 rounded border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                    checked={settings.monitored}
                    onChange={(e) =>
                      setSettings({ ...settings, monitored: e.target.checked })
                    }
                  />
                  <span className="text-gray-700 dark:text-gray-300">
                    Monitor Artist
                  </span>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    className="form-checkbox h-5 w-5 text-primary-600 rounded border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                    checked={settings.searchForMissingAlbums}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        searchForMissingAlbums: e.target.checked,
                      })
                    }
                  />
                  <span className="text-gray-700 dark:text-gray-300">
                    Search for missing albums on add
                  </span>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    className="form-checkbox h-5 w-5 text-primary-600 rounded border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                    checked={settings.albumFolders}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        albumFolders: e.target.checked,
                      })
                    }
                  />
                  <span className="text-gray-700 dark:text-gray-300">
                    Create album folders
                  </span>
                </label>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary w-full flex items-center justify-center"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? "Saving..." : "Save Default Settings"}
                </button>
              </div>
            </form>
          </div>

          <div className="card">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
              <Info className="w-6 h-6 mr-2" />
              System Status
            </h2>
            {loading ? (
              <div className="text-gray-500 dark:text-gray-400">Loading...</div>
            ) : health ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    Backend API
                  </span>
                  <div className="flex items-center">
                    {health.status === "ok" ? (
                      <>
                        <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                        <span className="text-green-700 dark:text-green-400 font-medium">
                          Connected
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                        <span className="text-red-700 dark:text-red-400 font-medium">
                          Disconnected
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    Lidarr Connection
                  </span>
                  <div className="flex items-center">
                    {health.lidarrConfigured ? (
                      <>
                        <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                        <span className="text-green-700 dark:text-green-400 font-medium">
                          Configured
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-5 h-5 text-yellow-500 mr-2" />
                        <span className="text-yellow-700 dark:text-yellow-400 font-medium">
                          Not Configured
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    Last.fm API
                  </span>
                  <div className="flex items-center">
                    {health.lastfmConfigured ? (
                      <>
                        <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                        <span className="text-green-700 dark:text-green-400 font-medium">
                          Configured
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-5 h-5 text-gray-400 mr-2" />
                        <span className="text-gray-500 dark:text-gray-400 font-medium">
                          Optional
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {health.timestamp && (
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      Last Checked
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">
                      {new Date(health.timestamp).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-red-600 dark:text-red-400">
                Failed to load health status
              </div>
            )}
          </div>
      </div>

        <div className="space-y-8">
          {health?.discovery && (
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                  Discovery Engine
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={handleClearCache}
                    disabled={clearingCache || health.discovery.isUpdating}
                    className="btn btn-secondary btn-sm text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-2" />
                    Clear Cache
                  </button>
                  <button
                    onClick={handleRefreshDiscovery}
                    disabled={
                      refreshingDiscovery || health.discovery.isUpdating
                    }
                    className="btn btn-secondary btn-sm"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 mr-2 ${refreshingDiscovery || health.discovery.isUpdating ? "animate-spin" : ""}`}
                    />
                    {health.discovery.isUpdating ? "Updating..." : "Refresh"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <div className="flex items-center text-gray-500 dark:text-gray-400 text-xs mb-1">
                    <Sparkles className="w-3 h-3 mr-1" /> Recommendations
                  </div>
                  <div className="text-xl font-bold">
                    {health.discovery.recommendationsCount}
                  </div>
                </div>

                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <div className="flex items-center text-gray-500 dark:text-gray-400 text-xs mb-1">
                    <TrendingUp className="w-3 h-3 mr-1" /> Global Top
                  </div>
                  <div className="text-xl font-bold">
                    {health.discovery.globalTopCount}
                  </div>
                </div>

                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <div className="flex items-center text-gray-500 dark:text-gray-400 text-xs mb-1">
                    <Image className="w-3 h-3 mr-1" /> Cached Images
                  </div>
                  <div className="text-xl font-bold">
                    {health.discovery.cachedImagesCount}
                  </div>
                </div>
              </div>

              {health.discovery.lastUpdated && (
                <div className="text-xs text-gray-400 text-right">
                  Cache last built:{" "}
                  {new Date(health.discovery.lastUpdated).toLocaleString()}
                </div>
              )}
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="flex items-center space-x-4 mb-6">
              <img
                src="/arralogo.svg"
                alt="Aurral Logo"
                className="w-12 h-12"
              />
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  About Aurral
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Version 1.0.0
                </p>
              </div>
            </div>
            <div className="space-y-4 text-gray-700 dark:text-gray-300">
              <p>
                Aurral is a streamlined artist request manager designed to
                simplify expanding your Lidarr music library.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-gray-100 dark:border-gray-800">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                    Data Sources
                  </h4>
                  <ul className="text-sm space-y-1">
                    <li>MusicBrainz (Artist Discovery)</li>
                    <li>Last.fm (Metadata & Images)</li>
                    <li>Lidarr API (Library Management)</li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                    Stack
                  </h4>
                  <p className="text-sm">
                    Built with React, Tailwind CSS, and Node.js.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!health?.lidarrConfigured && !loading && (
        <div className="card bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-500/20 mt-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Setup Instructions
          </h2>
          <div className="prose prose-sm text-gray-700 dark:text-gray-300">
            <p className="mb-4">
              To configure Aurral, you need to set up the backend:
            </p>
            <ol className="list-decimal list-inside space-y-2">
              <li>
                Navigate to the{" "}
                <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                  backend
                </code>{" "}
                directory
              </li>
              <li>
                Copy{" "}
                <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                  .env.example
                </code>{" "}
                to{" "}
                <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                  .env
                </code>
              </li>
              <li>
                Edit the{" "}
                <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                  .env
                </code>{" "}
                file and add:
                <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                  <li>
                    Your Lidarr URL (e.g.,{" "}
                    <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                      http://localhost:8686
                    </code>
                    )
                  </li>
                  <li>
                    Your Lidarr API key (found in Lidarr Settings → General →
                    Security)
                  </li>
                  <li>Your contact email for MusicBrainz API compliance</li>
                  <li>
                    (Optional) Your Last.fm API key for better images and
                    recommendations
                  </li>
                </ul>
              </li>
              <li>Restart the backend server</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

export default SettingsPage;


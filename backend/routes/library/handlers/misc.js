import { UUID_REGEX } from "../../../config/constants.js";
import { libraryManager } from "../../../services/libraryManager.js";
import { qualityManager } from "../../../services/qualityManager.js";
import { dbOps } from "../../../config/db-helpers.js";
import { NavidromeClient } from "../../../services/navidrome.js";

export default function registerMisc(router) {
  router.post("/scan", async (req, res) => {
    res.status(400).json({ error: "Scanning is handled by Lidarr" });
  });

  router.get("/rootfolder", async (req, res) => {
    try {
      const { lidarrClient } =
        await import("../../../services/lidarrClient.js");
      if (!lidarrClient.isConfigured()) {
        return res.json([]);
      }
      const rootFolders = await lidarrClient.getRootFolders();
      const list = Array.isArray(rootFolders)
        ? rootFolders.map((r) => ({ path: r.path }))
        : [];
      res.json(list);
    } catch (error) {
      res.status(500).json({
        error: "Failed to fetch root folder",
        message: error.message,
      });
    }
  });

  router.get("/qualityprofile", async (req, res) => {
    try {
      const profiles = qualityManager.getQualityProfiles();
      res.json(profiles);
    } catch (error) {
      res.status(500).json({
        error: "Failed to fetch quality profiles",
        message: error.message,
      });
    }
  });

  router.get("/lookup/:mbid", async (req, res) => {
    try {
      const { mbid } = req.params;
      if (!UUID_REGEX.test(mbid)) {
        return res.status(400).json({ error: "Invalid MBID format" });
      }

      const artist = await libraryManager.getArtist(mbid);
      if (artist) {
        res.json({
          exists: true,
          artist: {
            ...artist,
            foreignArtistId: artist.foreignArtistId || artist.mbid,
          },
        });
      } else {
        res.json({
          exists: false,
          artist: null,
        });
      }
    } catch (error) {
      res.status(500).json({
        error: "Failed to lookup artist",
        message: error.message,
      });
    }
  });

  router.post("/lookup/batch", async (req, res) => {
    try {
      const { mbids } = req.body;
      if (!Array.isArray(mbids)) {
        return res.status(400).json({ error: "mbids must be an array" });
      }

      const libraryArtists = await libraryManager.getAllArtists();
      const existingArtistIds = new Set(
        libraryArtists.map((artist) => artist.mbid).filter(Boolean),
      );
      const results = {};
      for (const mbid of mbids) {
        results[mbid] = existingArtistIds.has(mbid);
      }

      res.json(results);
    } catch (error) {
      res.status(500).json({
        error: "Failed to batch lookup artists",
        message: error.message,
      });
    }
  });

  router.get("/recent", async (req, res) => {
    try {
      const artists = await libraryManager.getAllArtists();
      const recent = [...artists]
        .sort(
          (a, b) =>
            new Date(b.addedAt || b.added) - new Date(a.addedAt || a.added),
        )
        .slice(0, 20)
        .map((artist) => ({
          ...artist,
          foreignArtistId: artist.foreignArtistId || artist.mbid,
          added: artist.addedAt || artist.added,
        }));
      res.set("Cache-Control", "public, max-age=300");
      res.json(recent);
    } catch (error) {
      res.status(500).json({
        error: "Failed to fetch recent artists",
        message: error.message,
      });
    }
  });

  router.get("/recent-releases", async (req, res) => {
    try {
      const { lidarrClient } =
        await import("../../../services/lidarrClient.js");
      if (!lidarrClient.isConfigured()) {
        return res.json([]);
      }

      const settings = dbOps.getSettings();
      const navidromeConfig = settings.integrations?.navidrome || {};
      let navidromeClient = null;
      if (
        navidromeConfig.url &&
        navidromeConfig.username &&
        navidromeConfig.password
      ) {
        navidromeClient = new NavidromeClient(
          navidromeConfig.url,
          navidromeConfig.username,
          navidromeConfig.password
        );
      } else {
        return res.json([]);
      }

      const [artists, navidromeAlbums, navidromeArtists] = await Promise.all([
        lidarrClient.request("/artist"),
        navidromeClient.getAlbumList("newest", 6),
        navidromeClient.getArtistList(),
      ]);

      const artistsById = new Map();
      if (Array.isArray(artists)) {
        artists.forEach((artist) => {
          if (artist?.foreignArtistId != null) {
            artistsById.set(artist.foreignArtistId, artist);
          }
        });
      }

      const navidromeArtistsById = new Map();
      if (Array.isArray(navidromeArtists)) {
        navidromeArtists.forEach((artist) => {
          if (artist?.id != null) {
            navidromeArtistsById.set(artist.id, artist);
          }
        });
      }

      console.log("Navidrome recent albums:", navidromeAlbums[0]);
      const recent = navidromeAlbums.map((album) => {
        const navidromeArtist = navidromeArtistsById.get(album.artistId);
        if (!navidromeArtist) {
          console.log('Failed to find', album);
          return null;
        } else {
          return {
            artistName: album.displayArtist,
            artistMbid: navidromeArtist?.musicBrainzId || null,
            foreignArtistId: navidromeArtist?.musicBrainzId || null,
            albumName: album.name,
            mbid: album.musicBrainzId || null,
            foreignAlbumId: album.musicBrainzId || null,
            navidromeCoverArtId: album.coverArt || null,
          }
        }
      });        

      res.set("Cache-Control", "public, max-age=300");
      res.json(recent);
    } catch (error) {
      res.status(500).json({
        error: "Failed to fetch recent releases",
        message: error.message,
      });
    }
  });
}

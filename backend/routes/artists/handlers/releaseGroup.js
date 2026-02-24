import axios from "axios";
import { UUID_REGEX, NAVIDROME_COVER_REGEX } from "../../../config/constants.js";
import {
  musicbrainzRequest,
  deezerGetAlbumTracks,
} from "../../../services/apiClients.js";
import { dbOps } from "../../../config/db-helpers.js";
import { NavidromeClient } from "../../../services/navidrome.js";

export default function registerReleaseGroup(router) {
  router.get("/release-group/:mbid/cover", async (req, res) => {
    try {
      const { mbid } = req.params;

      const isUUID = UUID_REGEX.test(mbid);
      const isNavidromeCover = NAVIDROME_COVER_REGEX.test(mbid);
      
      if (!isUUID && !isNavidromeCover) {
        return res.status(400).json({ error: "Invalid MBID format", images: [] });
      }

      // Build navidrome cover URL and skip db caching
      if (isNavidromeCover) {
        try {
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

          const imageUrl = await navidromeClient.getCoverArtURL(mbid);
          return res.json({
            images: [
              { image: imageUrl, front: true, types: ["Front"] },
            ],
          });
        } catch (e) {
          console.log(
            `[Cover Route] Navidrome error for ${mbid}:`,
            e.message
          );
          return res.json([]);
        }
      }

      const cacheKey = `rg:${mbid}`;
      const cachedImage = dbOps.getImage(cacheKey);

      if (
        cachedImage &&
        cachedImage.imageUrl &&
        cachedImage.imageUrl !== "NOT_FOUND"
      ) {
        const cachedUrl = cachedImage.imageUrl;
        res.set("Cache-Control", "public, max-age=31536000, immutable");
        return res.json({
          images: [
            {
              image: cachedUrl,
              front: true,
              types: ["Front"],
            },
          ],
        });
      }

      if (cachedImage && cachedImage.imageUrl === "NOT_FOUND") {
        res.set("Cache-Control", "public, max-age=3600");
        return res.json({ images: [] });
      }

      try {
        const coverArtJson = await axios
          .get(`https://coverartarchive.org/release-group/${mbid}`, {
            headers: { Accept: "application/json" },
            timeout: 2000,
          })
          .catch(() => null);

        if (coverArtJson?.data?.images && coverArtJson.data.images.length > 0) {
          const frontImage =
            coverArtJson.data.images.find((img) => img.front) ||
            coverArtJson.data.images[0];
          if (frontImage) {
            const imageUrl =
              frontImage.thumbnails?.["500"] ||
              frontImage.thumbnails?.["large"] ||
              frontImage.image;
            if (imageUrl) {
              dbOps.setImage(cacheKey, imageUrl);

              res.set("Cache-Control", "public, max-age=31536000, immutable");
              return res.json({
                images: [
                  {
                    image: imageUrl,
                    front: true,
                    types: frontImage.types || ["Front"],
                  },
                ],
              });
            }
          }
        }
      } catch (e) {}

      dbOps.setImage(cacheKey, "NOT_FOUND");
      res.set("Cache-Control", "public, max-age=3600");
      res.json({ images: [] });
    } catch (error) {
      console.error(
        `Error in release-group cover route for ${req.params.mbid}:`,
        error.message
      );
      res.set("Cache-Control", "public, max-age=60");
      res.json({ images: [] });
    }
  });

  router.get("/release-group/:mbid/tracks", async (req, res) => {
    try {
      const { mbid } = req.params;
      const deezerAlbumId = req.query.deezerAlbumId
        ? String(req.query.deezerAlbumId).trim()
        : null;
      if (deezerAlbumId) {
        const tracks = await deezerGetAlbumTracks(
          deezerAlbumId.startsWith("dz-") ? deezerAlbumId : `dz-${deezerAlbumId}`
        );
        return res.json(tracks);
      }
      if (String(mbid).startsWith("dz-")) {
        const tracks = await deezerGetAlbumTracks(mbid);
        return res.json(tracks);
      }
      if (!UUID_REGEX.test(mbid)) {
        return res.status(400).json({ error: "Invalid MBID format" });
      }

      const rgData = await musicbrainzRequest(`/release-group/${mbid}`, {
        inc: "releases",
      });

      if (!rgData.releases || rgData.releases.length === 0) {
        return res.json([]);
      }

      const releaseId = rgData.releases[0].id;
      const releaseData = await musicbrainzRequest(`/release/${releaseId}`, {
        inc: "recordings",
      });

      const tracks = [];
      if (releaseData.media && releaseData.media.length > 0) {
        for (const medium of releaseData.media) {
          if (medium.tracks) {
            for (const track of medium.tracks) {
              const recording = track.recording;
              if (recording) {
                tracks.push({
                  id: recording.id,
                  mbid: recording.id,
                  title: recording.title,
                  trackName: recording.title,
                  trackNumber: track.position || 0,
                  position: track.position || 0,
                  length: recording.length || null,
                });
              }
            }
          }
        }
      }

      res.json(tracks);
    } catch (error) {
      console.error("Error fetching release group tracks:", error);
      res.status(500).json({
        error: "Failed to fetch tracks",
        message: error.message,
      });
    }
  });
}

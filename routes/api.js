const express = require("express");
const router = express.Router();
const axios = require("axios");
const prisma = require("../lib/prismaClient");
const moment = require("moment");
const ethers = require("ethers");
const theSource = require("../lib/theSource");
const { getUserInformationFromFid } = require("../lib/neynar");

const contractAddress = "0x000000000001A36777f9930aAEFf623771b13e70";

const privateKey = process.env.PRIVATE_KEY;

// // Initialize provider and wallet
const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_RPC_URL);
const wallet = new ethers.Wallet(privateKey, provider);

router.get("/present-recommendation", async (req, res) => {
  try {
    const presentRecommendation = await prisma.recommendation.findFirst({
      where: { status: "present" },
    });
    if (presentRecommendation) {
      const now = new Date().getTime();
      const elapsedMilliseconds =
        now -
        new Date(
          presentRecommendation.startingRecommendationTimestamp
        ).getTime();
      const elapsedSeconds = Math.floor(elapsedMilliseconds / 1000);

      res.json({
        youtubeID: presentRecommendation.youtubeID,
        elapsedSeconds: elapsedSeconds,
        presentRecommendation: {
          ...presentRecommendation,
          elapsedSeconds: elapsedSeconds, // Add elapsed seconds to the recommendation object
        },
      });
    } else {
      console.log(
        "No present recommendation found. Running checkSystem function..."
      );
      await theSource.checkSystem(); // Ensure this is defined and exports an async function
      res.status(404).send("No current recommendation");
    }
  } catch (error) {
    console.error("Failed to retrieve current recommendation:", error);
    res.status(500).send("Internal Server Error");
  }
});

function youtube_parser(url) {
  var regExp =
    /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  var match = url.match(regExp);
  return match && match[7].length == 11 ? match[7] : false;
}

const getYoutubeData = async (url) => {
  const youtubeID = youtube_parser(url);
  const apiKey = process.env.YOUTUBE_API_KEY;
  const youtubeApiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${youtubeID}&key=${apiKey}&fields=items(id,snippet(title,thumbnails),contentDetails(duration))&part=snippet,contentDetails`;

  try {
    const response = await axios.get(youtubeApiUrl);
    if (response.data.items.length > 0) {
      const item = response.data.items[0];
      const durationISO = item.contentDetails.duration;
      const duration = moment.duration(durationISO).asMilliseconds();
      const name = item.snippet.title;
      const thumbnail = item.snippet.thumbnails.high.url;

      return { name, duration, youtubeID, thumbnail };
    } else {
      throw new Error("No data found for the given YouTube ID.");
    }
  } catch (error) {
    console.error("Error fetching YouTube data:", error);
    throw error;
  }
};

router.post("/recommendation", async (req, res) => {
  const { authorFid, url, bidAmount, castHash } = req.body;
  const { name, duration, youtubeID, thumbnail } = await getYoutubeData(url);
  let userPfp, username;
  try {
    try {
      const neynarResponse = await getUserInformationFromFid(authorFid);
      userPfp = neynarResponse.pfp.url;
      username = neynarResponse.username;
    } catch (error) {
      userPfp =
        "https://res.cloudinary.com/merkle-manufactory/image/fetch/c_fill,f_jpg,w_168/https%3A%2F%2Fi.imgur.com%2FPPYWuJU.jpg";
      username = "";
    }

    let user = await prisma.user.upsert({
      where: { fid: authorFid.toString() },
      update: {},
      create: { fid: authorFid.toString() },
    });

    const recommendation = await prisma.recommendation.create({
      data: {
        author: { connect: { fid: authorFid.toString() } },
        authorPfp: userPfp,
        authorUsername: username,
        castHash,
        name,
        url,
        status: "future",
        duration,
        youtubeID,
        placeholderImageUrl: thumbnail,
        bidAmount: parseInt(bidAmount, 10),
      },
    });
    console.log(
      `the recommendation ${recommendation.name} was added successfully by ${authorFid} to the future`
    );
    res.status(201).json({
      message: "Recommendation added successfully",
      success: true,
    });
  } catch (error) {
    console.log(
      "there was an error adding the recommendation to the database",
      error
    );
    res.status(400).json({ success: false, error: error.message });
  }
});

// Endpoint to get the current queue
router.get("/future", async (req, res) => {
  try {
    const queueItems = await prisma.recommendation.findMany({
      where: { status: "future" },
      orderBy: { bidAmount: "desc" },
      include: { author: true },
    });
    res.json({ queue: queueItems });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

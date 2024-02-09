const express = require("express");
const router = express.Router();
const axios = require("axios");
const prisma = require("../lib/prismaClient");
const moment = require("moment");
const { soundAPI } = require("../lib/soundxyz");
const ethers = require("ethers");
const SOUNDXYZ_ABI = require("../abis/SOUND_XYZ.json");
const theSource = require("../lib/theSource");

const contractAddress = "0x000000000001A36777f9930aAEFf623771b13e70";

const privateKey = process.env.PRIVATE_KEY;

// // Initialize provider and wallet
const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_RPC_URL);
const wallet = new ethers.Wallet(privateKey, provider);

const soundxyzContract = new ethers.Contract(
  contractAddress,
  SOUNDXYZ_ABI,
  wallet
);

const music = [
  {
    title: "Lateralus",
    artist: "Tool",
    year: "2001",
    cover:
      "https://i.discogs.com/6TL2Yqaqf1XRy11HUVdtnZ_hVhxtoGo9tzpuaBBk9SM/rs:fit/g:sm/q:90/h:600/w:600/czM6Ly9kaXNjb2dz/LWRhdGFiYXNlLWlt/YWdlcy9SLTczMjU0/MjYtMTY2MzQzOTQ4/NC02MjE5LmpwZWc.jpeg",
  },
  {
    title: "Ommadawn",
    artist: "Mike Oldfield",
    year: "1975",
    cover:
      "https://i.discogs.com/7EZGVh9d3iPr6tT-oHbTe3PH4Psyk7RUAUtoc-UB7qY/rs:fit/g:sm/q:90/h:600/w:600/czM6Ly9kaXNjb2dz/LWRhdGFiYXNlLWlt/YWdlcy9SLTQ1NTc5/OC0xNDk3OTc0MjA1/LTMzMTguanBlZw.jpeg",
  },
  {
    title: "Medicine Work",
    artist: "Byron Metcalf & Rob Thomas",
    year: "2013",
    cover:
      "https://i.discogs.com/YkPsf69kKFk91jyB7f6QslIJGhhG41Rr3uhgfr0uL08/rs:fit/g:sm/q:90/h:600/w:600/czM6Ly9kaXNjb2dz/LWRhdGFiYXNlLWlt/YWdlcy9SLTQ2NzEz/NzYtMTM3MTc0NTgz/OC03NDcyLmpwZWc.jpeg",
  },
];

router.get("/present-recommendation", async (req, res) => {
  try {
    console.log("on the present recommendaiton route");
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

router.get("/music", async (req, res) => {
  try {
    console.log(
      "here i should fetch all the music available on the wallet that is connected"
    );

    res.json({
      success: true,
      data: music,
    });
    return res.status(200).json({ jukeboxMusic: music });
  } catch (error) {
    console.log("there was an error fetching the jukebox", error);
    res.status(401).json({ message: "there was an error" });
  }
});

function youtube_parser(url) {
  var regExp =
    /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  var match = url.match(regExp);
  return match && match[7].length == 11 ? match[7] : false;
}

const getYoutubeData = async (url) => {
  console.log("fetching the youtube data for this url", url);
  const youtubeID = youtube_parser(url);
  console.log("the youtube id is: ", youtubeID);
  const apiKey = process.env.YOUTUBE_API_KEY;
  const youtubeApiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${youtubeID}&key=${apiKey}&fields=items(id,snippet(title,thumbnails),contentDetails(duration))&part=snippet,contentDetails`;

  try {
    const response = await axios.get(youtubeApiUrl);
    console.log(
      "the response from the call is: ",
      response.data.items[0].contentDetails
    );
    console.log(
      "the response from the call is: ",
      response.data.items[0].snippet
    );
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
  console.log("inside the recommendations api", req.body);
  const { authorFid, url, bidAmount } = req.body;
  const { name, duration, youtubeID, thumbnail } = await getYoutubeData(url);
  console.log("THE THUMBNAIL IS: ", thumbnail);
  console.log("in here, the name and duration are: ", name, duration);
  try {
    let user = await prisma.user.upsert({
      where: { fid: authorFid.toString() },
      update: {},
      create: { fid: authorFid.toString() },
    });

    const recommendation = await prisma.recommendation.create({
      data: {
        author: { connect: { fid: authorFid.toString() } },
        name,
        url,
        status: "future",
        duration,
        youtubeID,
        placeholderImageUrl: thumbnail,
        bidAmount: parseInt(bidAmount, 10),
      },
    });
    const queue = await prisma.recommendation.findMany({
      where: { status: "future" },
      orderBy: { bidAmount: "desc" },
    });
    res.status(201).json({
      message: "Recommendation added successfully!",
      recommendation,
      queue,
    });
  } catch (error) {
    console.log("there was an error in here", error);
    res.status(400).json({ error: error.message });
  }
});

// Endpoint to add a bid to the queue
router.get("/queue", async (req, res) => {
  try {
    // Check if the recommendation already has a queue item
    let queue = await prisma.recommendation.findMany({
      where: { status: "future" },
      orderBy: { bidAmount: "desc" },
      include: { author: true },
    });

    res.status(201).json({ queue });
  } catch (error) {
    res.status(400).json({ error: error.message });
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
    res.json(queueItems);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

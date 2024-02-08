const express = require("express");
const router = express.Router();
const axios = require("axios");
const prisma = require("../lib/prismaClient");

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

router.get("/music", async (req, res) => {
  try {
    console.log(
      "here i should fetch all the music available on the wallet that is connected"
    );
    return res.status(200).json({ jukeboxMusic: music });
  } catch (error) {
    console.log("there was an error fetching the jukebox");
    res.status(401).json({ message: "there was an error" });
  }
});

module.exports = router;

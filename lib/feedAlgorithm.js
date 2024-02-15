// lib/jpAlgo.js
const axios = require("axios");

async function jpAlgo(fid) {
  try {
    const response = await axios.get(
      `https://api.neynar.com/v2/farcaster/feed?feed_type=filter&filter_type=fids&fids=${fid}&limit=50`,
      {
        headers: {
          api_key: process.env.NEYNAR_API_KEY,
        },
      }
    );
    return response.data.casts;
  } catch (error) {
    console.log("there was an erorrrrrr", error);
    return null;
  }
}

module.exports = jpAlgo;

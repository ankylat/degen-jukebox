const express = require("express");
const router = express.Router();
const axios = require("axios");
const { ethers } = require("ethers");
const cheerio = require("cheerio");
const { createCanvas, loadImage, registerFont } = require("canvas");
const sharp = require("sharp");
const prisma = require("../lib/prismaClient");
const {
  NeynarAPIClient,
  CastParamType,
  FeedType,
  FilterType,
} = require("@neynar/nodejs-sdk");

const client = new NeynarAPIClient(process.env.NEYNAR_API_KEY);

router.post("/podium-image", async (req, res) => {
  try {
    console.log("iiiin here");
    // Fetch the top 5 future recommendations based on bid amount
    const podium = await prisma.recommendation.findMany({
      where: { status: "future" },
      orderBy: { bidAmount: "desc" },
      take: 5,
    });

    const queue = await prisma.recommendation.count({
      where: { status: "future" },
    });
    console.log("in here");
    const response = await axios({
      url: "https://jpfraneto.github.io/images/the-cosmic-festival.jpeg",
      responseType: "arraybuffer",
    });
    console.log("the response hjere is: ", response);
    const a = "";
    const imageBuffer = Buffer.from(response.data, "utf-8");
    const metadata = await sharp(imageBuffer).metadata();
    const imageWidth = metadata.width;
    const imageHeight = metadata.height;
    const offsetX = imageWidth / 2; // Adjust if necessary
    const offsetY = imageHeight / 4; // Adjust if necessary
    const returnString = `${queue} elements on the queue`;
    // Create an overlay SVG
    const svgOverlay = `
<svg width="${imageWidth}" height="${imageHeight}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .percentage { font: bold 70px 'Comic Sans MS', cursive; fill: white; transform: translateY(-120px); }
  </style>
  <text x="50%" y="${offsetY}" class="title" dominant-baseline="middle" text-anchor="middle">${returnString}</text>
  <text x="${offsetX}" y="${
      offsetY + 80
    }" class="percentage" dominant-baseline="middle" text-anchor="middle">@${
      podium[0].authorUsername
    } · ${
      podium[0].bidAmount > 0 ? podium[0].bidAmount + " $degen" : "repeated"
    }</text>
  <text x="${offsetX}" y="${
      offsetY + 180
    }" class="percentage" dominant-baseline="middle" text-anchor="middle">@${
      podium[1].authorUsername
    } · ${
      podium[1].bidAmount > 0 ? podium[1].bidAmount + " $degen" : "repeated"
    }</text>
  <text x="${offsetX}" y="${
      offsetY + 280
    }" class="percentage" dominant-baseline="middle" text-anchor="middle">@${
      podium[2].authorUsername
    } · ${
      podium[2].bidAmount > 0 ? podium[2].bidAmount + " $degen" : "repeated"
    }</text>
  <text x="${offsetX}" y="${
      offsetY + 380
    }" class="percentage" dominant-baseline="middle" text-anchor="middle">@${
      podium[3].authorUsername
    } · ${
      podium[3].bidAmount > 0 ? podium[3].bidAmount + " $degen" : "repeated"
    }</text>
  <text x="${offsetX}" y="${
      offsetY + 480
    }" class="percentage" dominant-baseline="middle" text-anchor="middle">@${
      podium[4].authorUsername
    } · ${
      podium[4].bidAmount > 0 ? podium[4].bidAmount + " $degen" : "repeated"
    }</text>

</svg>`;

    sharp(imageBuffer)
      .composite([{ input: Buffer.from(svgOverlay), gravity: "northwest" }])
      .toFormat("png")
      .toBuffer()
      .then((outputBuffer) => {
        // Set the content type to PNG and send the response
        res.setHeader("Content-Type", "image/png");
        res.setHeader("Cache-Control", "max-age=10");
        res.send(outputBuffer);
      })
      .catch((error) => {
        console.error("Error processing image", error);
        res.status(500).send("Error processing image");
      });
  } catch (error) {
    console.error("There was an error generating the image", error);
    res.status(500).send("Error generating image");
  }
});

router.post("/add-music", async (req, res) => {
  try {
    console.log("inside the added music route", req.body);
    const fullUrl = req.protocol + "://" + req.get("host");
    const videoUrl = req.body.untrustedData.inputText;
    const presentRecommendation = await prisma.recommendation.findFirst({
      where: { status: "present" },
    });
    if (!videoUrl) return;
    function youtube_parser(url) {
      console.log("inside the yourtube parser url", url);
      var regExp =
        /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
      var match = url.match(regExp);
      return match && match[7].length == 11 ? match[7] : false;
    }
    const youtubeID = youtube_parser(videoUrl);
    if (youtubeID.length != 11) {
      console.log("invalid id");
      return res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>jukebox</title>
        <meta property="og:title" content="jukebox">
        <meta property="og:image" content="https://jpfraneto.github.io/images/wrong-link.png">
        <meta name="fc:frame" content="vNext">
        <meta name="fc:frame:post_url" content="${fullUrl}/jukebox/added-music">
        <meta name="fc:frame:image" content="https://jpfraneto.github.io/images/wrong-link.png">
        <meta name="fc:frame:input:text" content="youtube 🔗">
        <meta name="fc:frame:button:1" content="✅">
        </head>
      </html>`);
    } else {
      console.log("valid id", presentRecommendation, fullUrl);
      return res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>jukebox</title>
        <meta property="og:title" content="jukebox">
        <meta property="og:image" content="https://jpfraneto.github.io/images/gratitude.png">
        <meta name="fc:frame" content="vNext">
        <meta name="fc:frame:post_url" content="${fullUrl}/jukebox/add-music">
        <meta name="fc:frame:image" content="https://jpfraneto.github.io/images/gratitude.png">
        <meta name="fc:frame:button:1" content="🎶"> 
        <meta name="fc:frame:button:1:action" content="link">   
        <meta name="fc:frame:button:1:target" content="${presentRecommendation.url}">     
        </head>
      </html>`);
    }
  } catch (error) {}
});

router.get("/", async (req, res) => {
  try {
    const fullUrl = req.protocol + "://" + req.get("host");
    res.setHeader("Content-Type", "text/html");
    res.status(200).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>degen jukebox</title>
      <meta property="og:title" content="degen jukebox">
      <meta property="og:image" content="https://jpfraneto.github.io/images/portada.png">
      <meta name="fc:frame" content="vNext">
      <meta name="fc:frame:image" content="https://jpfraneto.github.io/images/portada.png">

      <meta name="fc:frame:post_url" content="${fullUrl}/jukebox">
      <meta name="fc:frame:button:1" content="ಸ್ವಾಗತ">
    </head>
    </html>
    `);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error generating image");
  }
});

router.post("/", async (req, res) => {
  console.log("inside the post route");
  const fullUrl = req.protocol + "://" + req.get("host");
  const buttonIndex = req.body.untrustedData.buttonIndex.toString();
  const presentRecommendation = await prisma.recommendation.findFirst({
    where: { status: "present" },
  });
  try {
    if (buttonIndex == "2") {
      let imageUrl = `https://api.thegenradio.com/jukebox/podium-image`;
      return res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>jukebox</title>
        <meta property="og:title" content="jukebox">
        <meta property="og:image" content="${imageUrl}">
        <meta name="fc:frame" content="vNext">
        <meta name="fc:frame:image" content="${imageUrl}">
        <meta name="fc:frame:button:1" content="🎶"> 
        <meta name="fc:frame:button:1:action" content="link">   
        <meta name="fc:frame:button:1:target" content="${presentRecommendation.url}">     
        </head>
      </html>
        `);
    } else if (buttonIndex == "3") {
      console.log("display for adding music");
      return res.status(200).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>jukebox</title>
      <meta property="og:title" content="jukebox">
      <meta property="og:image" content="https://jpfraneto.github.io/images/add-music.png">
      <meta name="fc:frame" content="vNext">
      <meta name="fc:frame:post_url" content="${fullUrl}/jukebox/add-music">
      <meta name="fc:frame:image" content="https://jpfraneto.github.io/images/add-music.png">
      <meta name="fc:frame:input:text" content="youtube 🔗">
      <meta name="fc:frame:button:1" content="✅">
      </head>
    </html>
      `);
    }
    return res.status(200).send(`
  <!DOCTYPE html>
  <html>
  <head>
    <title>jukebox</title>
    <meta property="og:title" content="jukebox">
    <meta property="og:image" content="${presentRecommendation.placeholderImageUrl}">
    <meta name="fc:frame" content="vNext">
    <meta name="fc:frame:image" content="${presentRecommendation.placeholderImageUrl}">
    <meta name="fc:frame:post_url" content="${fullUrl}/jukebox">
    <meta name="fc:frame:button:1" content="🎶"> 
    <meta name="fc:frame:button:1:action" content="link">   
    <meta name="fc:frame:button:1:target" content="${presentRecommendation.url}">     
    </head>
  </html>
    `);
  } catch (error) {
    console.log("there was an error");
    return res.status(200).send(`
    <!DOCTYPE html>
    <html>
    <head>
    <title>anky mint</title>
    <meta property="og:title" content="anky mint">
    <meta property="og:image" content="https://jpfraneto.github.io/images/error.png">
    <meta name="fc:frame:image" content="https://jpfraneto.github.io/images/error.png">

    <meta name="fc:frame:post_url" content="${fullUrl}/jukebox">
    <meta name="fc:frame" content="vNext">     
  </head>
  </html>
    </html>
    `);
  }
});

module.exports = router;

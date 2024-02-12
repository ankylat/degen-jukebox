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

router.get("/podium-image", async (req, res) => {
  try {
    // Fetch the top 5 future recommendations based on bid amount
    const podium = await prisma.recommendation.findMany({
      where: { status: "future" },
      orderBy: { bidAmount: "desc" },
      take: 5,
    });

    const queue = await prisma.recommendation.count({
      where: { status: "future" },
    });

    let returnString = `there are ${queue} items on the queue`;
    console.log("the return string is: ", returnString);
    const response = await axios({
      url: "https://jpfraneto.github.io/images/the-gen-queue.png",
      responseType: "arraybuffer",
    });
    const imageBuffer = Buffer.from(response.data, "utf-8");
    const metadata = await sharp(imageBuffer).metadata();
    const imageWidth = metadata.width;
    const imageHeight = metadata.height;
    const offsetX = imageWidth / 2; // Adjust if necessary
    const offsetY = imageHeight / 4; // Adjust if necessary
    // Create an overlay SVG
    const svgOverlay = `
    <svg width="${imageWidth}" height="${imageHeight}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .percentage { font: bold 120px sans-serif; fill: white; transform: translateY(-120px) }
        .bottomText { font: bold 60px sans-serif; fill: white; }
      </style>
      <text x="${offsetX}" y="${
      offsetY + 100
    }" class="percentage" dominant-baseline="middle" text-anchor="middle">@${
      podium[0].authorUsername
    } · ${
      podium[0].bidAmount > 0 ? podium[0].bidAmount + "$degen" : "repeated"
    }</text>
    <text x="${offsetX}" y="${
      offsetY + 220
    }" class="percentage" dominant-baseline="middle" text-anchor="middle">@${
      podium[1].authorUsername
    } · ${
      podium[1].bidAmount > 0 ? podium[1].bidAmount + "$degen" : "repeated"
    }</text>
    <text x="${offsetX}" y="${
      offsetY + 340
    }" class="percentage" dominant-baseline="middle" text-anchor="middle">@${
      podium[2].authorUsername
    } · ${
      podium[2].bidAmount > 0 ? podium[2].bidAmount + "$degen" : "repeated"
    }</text>
    <text x="${offsetX}" y="${
      offsetY + 460
    }" class="percentage" dominant-baseline="middle" text-anchor="middle">@${
      podium[3].authorUsername
    } · ${
      podium[3].bidAmount > 0 ? podium[3].bidAmount + "$degen" : "repeated"
    }</text>
    <text x="${offsetX}" y="${
      offsetY + 580
    }" class="percentage" dominant-baseline="middle" text-anchor="middle">@${
      podium[4].authorUsername
    } · ${
      podium[4].bidAmount > 0 ? podium[4].bidAmount + "$degen" : "repeated"
    }</text>
    <text x="50%" y="${
      imageHeight - 10
    }" class="bottomText" dominant-baseline="middle" text-anchor="middle">${returnString}</text>
    </svg>`;
    console.log("right before the sharp", svgOverlay);

    sharp(imageBuffer)
      .composite([{ input: Buffer.from(svgOverlay), gravity: "northwest" }])
      .toFormat("png")
      .toBuffer()
      .then((outputBuffer) => {
        // Set the content type to PNG and send the response
        console.log("the output buffer is: ", outputBuffer);
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
      <meta property="og:image" content="https://jpfraneto.github.io/images/the-gen-radioo2.png">
      <meta name="fc:frame" content="vNext">
      <meta name="fc:frame:image" content="https://jpfraneto.github.io/images/the-gen-radioo2.png">

      <meta name="fc:frame:post_url" content="${fullUrl}/jukebox">
      <meta name="fc:frame:button:1" content="time to vibe">

    </head>
    </html>
    `);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error generating image");
  }
});

router.post("/", async (req, res) => {
  const fullUrl = req.protocol + "://" + req.get("host");
  const buttonIndex = req.body.untrustedData.buttonIndex.toString();
  const presentRecommendation = await prisma.recommendation.findFirst({
    where: { status: "present" },
  });
  try {
    if (buttonIndex == "2") {
      let imageUrl = `${fullUrl}/jukebox/podium-image`;
      return res.status(200).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>jukebox</title>
      <meta property="og:title" content="jukebox">
      <meta property="og:image" content="${imageUrl}">
      <meta name="fc:frame" content="vNext">
      <meta name="fc:frame:post_url" content="${imageUrl}">
      <meta name="fc:frame:button:1" content="jukebox"> 
      <meta name="fc:frame:button:1:action" content="link">   
      <meta name="fc:frame:button:1:target" content="${process.env.FRONTEND_ROUTE}">     
      <meta name="fc:frame:button:2" content="queue">   
      <meta name="fc:frame:button:3" content="instructions"> 
      </head>
    </html>
      `);
    } else if (buttonIndex == "3") {
      console.log("button index is 3");
      return res.status(200).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>jukebox</title>
      <meta property="og:title" content="jukebox">
      <meta property="og:image" content="https://jpfraneto.github.io/images/degennnn.png">
      <meta name="fc:frame" content="vNext">
      <meta name="fc:frame:image" content="https://jpfraneto.github.io/images/degennnn.png">
      <meta name="fc:frame:button:1" content="jukebox"> 
      <meta name="fc:frame:button:1:action" content="link">   
      <meta name="fc:frame:button:1:target" content="${process.env.FRONTEND_ROUTE}">     
      <meta name="fc:frame:button:2" content="queue">   
      <meta name="fc:frame:button:3" content="instructions"> 
      </head>
    </html>
      `);
    }
    console.log("at the end here");
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
    <meta name="fc:frame:button:1" content="jukebox"> 
    <meta name="fc:frame:button:1:action" content="link">   
    <meta name="fc:frame:button:1:target" content="${process.env.FRONTEND_ROUTE}">     
    <meta name="fc:frame:button:2" content="queue">   
    <meta name="fc:frame:button:3" content="instructions"> 
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

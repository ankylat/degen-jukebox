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
    // Fetch the top 5 future recommendations sorted by bidAmount descending
    const podium = await prisma.recommendation.findMany({
      where: { status: "future" },
      orderBy: { bidAmount: "desc" },
      take: 5,
    });

    // Define the base image dimensions
    const imageWidth = 800; // Adjust as needed
    const imageHeight = podium.length * 100; // Dynamic height based on the number of entries
    const pfpDiameter = 80; // Diameter of the profile picture
    const fontSize = 24; // Adjust as needed
    const textOffsetY = pfpDiameter / 2 + fontSize / 2; // Center text with the profile picture
    const textOffsetX = pfpDiameter + 20; // Space after the profile picture

    // Create a composite array for sharp
    let compositeArray = [];

    // Define a function to process profile images and text
    async function processEntries() {
      // Process each podium entry to create an image layer
      for (const [index, entry] of podium.entries()) {
        const yPos = index * 100 + textOffsetY; // Adjust Y position based on entry index
        let pfpBuffer;

        try {
          // Fetch the profile picture
          const response = await axios.get(entry.authorPfp, {
            responseType: "arraybuffer",
          });
          pfpBuffer = Buffer.from(response.data);
        } catch (error) {
          // Handle error (e.g., set a default profile picture or skip the entry)
          console.error("Error fetching profile picture:", error);
          continue; // Skip this entry
        }

        // Resize and mask the profile picture to be circular
        const pfpImage = await sharp(pfpBuffer)
          .resize(pfpDiameter, pfpDiameter)
          .png()
          .toBuffer();

        // Add the profile picture to the composite array
        compositeArray.push({
          input: pfpImage,
          top: index * 100,
          left: 0,
        });

        // Prepare SVG text element for this entry
        const svgText = `
          <text x="${textOffsetX}" y="${yPos}" font-family="Arial" font-size="${fontSize}" fill="white">
            @${entry.authorUsername} · ${entry.bidAmount} $degen
          </text>
        `;

        // Add the text as an SVG layer
        compositeArray.push({
          input: Buffer.from(
            `<svg width="${imageWidth}" height="${imageHeight}" xmlns="http://www.w3.org/2000/svg">${svgText}</svg>`
          ),
          top: 0,
          left: 0,
        });
      }
    }

    // Process the entries
    await processEntries();

    // Create the base image
    let baseImage = sharp({
      create: {
        width: imageWidth,
        height: imageHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 1 }, // Black background
      },
    });

    // Composite all the images and text onto the base image
    baseImage
      .composite(compositeArray)
      .toFormat("png")
      .toBuffer()
      .then((outputBuffer) => {
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
      <meta name="fc:frame:button:1" content="listen live"> 
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
      <meta name="fc:frame:button:1" content="listen live"> 
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
    <meta name="fc:frame:button:1" content="listen live"> 
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

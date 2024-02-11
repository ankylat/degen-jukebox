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
    const podium = await prisma.recommendation.findMany({
      where: { status: "future" },
      orderBy: { bidAmount: "desc" },
      take: 5,
    });

    let svgParts = [];
    let compositeArray = [];
    const imageWidth = 800; // Adjust as needed
    const imageHeight = podium.length * 100; // Dynamic height based on the number of entries
    const pfpDiameter = 80; // Diameter of the profile pictures

    for (const [index, entry] of podium.entries()) {
      const yPos = index * 100 + pfpDiameter / 2; // Center profile picture vertically
      const xPos = 10; // Margin from the left for the profile picture

      // Fetch the profile picture
      try {
        const response = await axios.get(entry.authorPfp, {
          responseType: "arraybuffer",
        });
        const pfpBuffer = Buffer.from(response.data);

        // Resize the profile picture to be circular
        const pfpImage = await sharp(pfpBuffer)
          .resize(pfpDiameter, pfpDiameter)
          .ensureAlpha()
          .composite([
            {
              input: Buffer.from(
                `<svg><circle cx="${pfpDiameter / 2}" cy="${
                  pfpDiameter / 2
                }" r="${pfpDiameter / 2}" fill="#FFF"/></svg>`
              ),
              blend: "dest-in",
            },
          ])
          .png()
          .toBuffer();

        compositeArray.push({
          input: pfpImage,
          top: index * 100,
          left: xPos,
        });

        // Create SVG text element
        svgParts.push(`
          <text x="${
            xPos + pfpDiameter + 10
          }" y="${yPos}" font-family="Arial" font-size="24" fill="white" dominant-baseline="middle">@${
          entry.authorUsername
        } · ${entry.bidAmount} $degen</text>
        `);
      } catch (error) {
        console.error("Error fetching profile picture:", error);
        // Handle error or continue without profile picture
      }
    }

    // Combine all SVG parts into one SVG element
    const svgOverlay = `
    <svg width="${imageWidth}" height="${imageHeight}" xmlns="http://www.w3.org/2000/svg">
      ${svgParts.join("")}
    </svg>`;

    // Create a base image with a black background
    const baseImageBuffer = await sharp({
      create: {
        width: imageWidth,
        height: imageHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    // Composite the SVG overlay and the profile pictures onto the base image
    sharp(baseImageBuffer)
      .composite([{ input: Buffer.from(svgOverlay), gravity: "northwest" }])
      .toFormat("png")
      .toBuffer()
      .then((outputBuffer) => {
        // Set the content type to PNG and send the response
        res.setHeader("Content-Type", "image/png");
        res.setHeader("Cache-Control", "max-age=10");
        res.send(outputBuffer);
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

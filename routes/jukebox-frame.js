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
    console.log("inside the podium");
    const podium = await prisma.recommendation.findMany({
      where: { status: "future" },
      orderBy: { bidAmount: "desc" },
      take: 5,
    });
    console.log("the podium is: ", podium);
    const canvasWidth = 800; // Adjust canvas width as needed
    const canvasHeight = 600; // Adjust canvas height as needed
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext("2d");

    // Set canvas background color
    ctx.fillStyle = "#000"; // Replace with your desired background color
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Set font properties
    const fontSize = 24; // Adjust font size as needed
    ctx.font = `${fontSize}px Arial`; // Use the loaded font
    ctx.fillStyle = "#FFF"; // Set font color

    // Draw the podium data as a list
    const lineHeight = fontSize * 1.5; // Adjust line height as needed
    let yPos = 50; // Starting y-position for drawing
    podium.forEach((entry, index) => {
      const text = `@${entry.authorUsername} · ${entry.bidAmount} $degen`;
      ctx.fillText(text, 50, yPos);
      yPos += lineHeight; // Increment y-position for the next line
    });

    // Convert canvas to buffer
    const buffer = canvas.toBuffer();
    console.log("the buffer is: ", buffer);

    // Send the image in the response
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "max-age=10");
    res.send(buffer);
  } catch (error) {
    console.log("there was an error creating the image", error);
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
      console.log("the button index is 2", fullUrl);
      let imageUrl = `${fullUrl}/jukebox/podium-image`;
      console.log("the image url is: ", imageUrl);
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
      <meta property="og:image" content="https://jpfraneto.github.io/images/jukebox-instructions.png">
      <meta name="fc:frame" content="vNext">
      <meta name="fc:frame:image" content="https://jpfraneto.github.io/images/jukebox-instructions.png">
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

require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const axios = require("axios");
const prisma = require("../lib/prismaClient");
const fs = require("fs");
const { getAddrByFid } = require("../lib/neynar");
const { ethers } = require("ethers");
const sharp = require("sharp");
const path = require("path");
const { v2 } = require("cloudinary");

const privateKey = process.env.PRIVATE_KEY;

const FormData = require("form-data");

const {
  uploadMetadataToPinata,
  uploadImageToPinata,
  uploadToPinataFromUrl,
} = require("../lib/pinataSetup");
const {
  NeynarAPIClient,
  CastParamType,
  FeedType,
  FilterType,
} = require("@neynar/nodejs-sdk");
const neynarClient = new NeynarAPIClient(process.env.NEYNAR_API_KEY);

v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_RPC_URL);
const wallet = new ethers.Wallet(privateKey, provider);

const ANKY_ON_A_FRAME_ABI = require("../abis/AnkyOnAFrame.json");

const ankyOnAFrameContract = new ethers.Contract(
  "0x5fd77ab7fd080e3e6ccbc8fe7d33d8abd2fe65a5",
  ANKY_ON_A_FRAME_ABI,
  wallet
);

const checkAndUpdateAnkys = async () => {
  const ankys = await prisma.generatedAnky.findMany({
    where: {
      OR: [
        { imagineApiStatus: "pending" },
        { imagineApiStatus: "in-progress" },
        { imagineApiStatus: "failed" },
      ],
    },
  });

  for (const anky of ankys) {
    try {
      const response = await axios.get(
        `http://${process.env.MIDJOURNEY_SERVER_IP}:8055/items/images/${anky.imagineApiID}`,
        {
          headers: { Authorization: `Bearer ${process.env.IMAGINE_API_TOKEN}` },
        }
      );
      const apiData = response.data.data;
      if (apiData.status === "completed") {
        // Assuming uploadImageToPinata function takes buffer and returns IPFS hash
        const randomUpscaledId =
          apiData.upscaled[Math.floor(Math.random() * apiData.upscaled.length)];
        const thisImageUrl = `http://${process.env.MIDJOURNEY_SERVER_IP}:8055/assets/${randomUpscaledId}/${randomUpscaledId}.png`;

        const imageBuffer = await axios
          .get(thisImageUrl, { responseType: "arraybuffer" })
          .then((res) => res.data);
        const ipfsHash = await uploadImageToPinata(imageBuffer, anky.cid);
        if (!ipfsHash) return;
        const nftMetadata = {
          name: "you",
          description: anky.ankyBio,
          image: `ipfs://${ipfsHash}`,
        };
        const ipfsMetadataHash = await uploadMetadataToPinata(nftMetadata);
        if (!ipfsMetadataHash) return;

        await prisma.generatedAnky.update({
          where: { cid: anky.cid },
          data: {
            imagineApiStatus: apiData.status,
            imageIPFSHash: ipfsHash,
            metadataIPFSHash: ipfsMetadataHash,
          },
        });
        // NOW IT IS TIME TO CREATE THE NFT. WORK HERE:

        const cast = `your anky is ready to be minted.\n\n here... yes, here.`;
        let castOptions = {
          parent: `https://warpcast.com/~/channel/anky`,
          text: cast,
          embeds: [
            {
              url: `https://api.anky.lat/farcaster-frames/mintable-ankys?cid=${anky.cid}`,
            },
          ],
          signer_uuid: process.env.MFGA_SIGNER_UUID,
        };
        const response = await axios.post(
          "https://api.neynar.com/v2/farcaster/cast",
          castOptions,
          {
            headers: {
              api_key: process.env.MFGA_API_KEY,
            },
          }
        );
        await prisma.generatedAnky.update({
          where: { cid: anky.cid },
          data: {
            castHash: response.data.cast.hash,
          },
        });
      } else if (apiData.status === "failed") {
        await createImageAgain(anky);
      } else {
        await prisma.generatedAnky.update({
          where: { cid: anky.cid },
          data: { imagineApiStatus: apiData.status },
        });
      }
    } catch (error) {
      console.error(
        `Error updating GeneratedAnky with cid ${anky.cid}: `,
        error?.response?.data?.errors || error
      );
    }
  }
};

const uploadToCloudinary = (filePath, id) => {
  return new Promise((resolve, reject) => {
    const streamUpload = v2.uploader.upload_stream(
      {
        public_id: id, // optional, remove if not needed
      },
      (error, result) => {
        if (result) {
          resolve(result);
        } else {
          reject(error);
        }
      }
    );

    // Create a read stream from the file and pipe it to the Cloudinary upload_stream
    fs.createReadStream(filePath).pipe(streamUpload);
  });
};

async function downloadImages(dataArray) {
  console.log("inside the download images", dataArray);
  const uniqueUrls = [
    ...new Set(dataArray.map((item) => item.imageAvailableUrl)),
  ];
  const directory = "AnkyOnAFrame";

  // Create directory if it doesn't exist
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  // Download each image
  for (const url of uniqueUrls) {
    const filename = path.join(directory, url.split("/").pop());
    const writer = fs.createWriteStream(filename);

    try {
      const response = await axios({
        url,
        method: "GET",
        responseType: "stream",
      });

      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      console.log(`Downloaded: ${filename}`);
    } catch (error) {
      console.error(`Error downloading ${url}:`, error);
    }
  }
}

function delay(duration) {
  return new Promise((resolve) => setTimeout(resolve, duration));
}

async function fetchImageAsBuffer(url) {
  const response = await axios.get(url, {
    responseType: "arraybuffer",
  });
  return response.data;
}

async function createAndUploadSummaryImage(imageUrls) {
  try {
    const finalWidth = 1920;
    const finalHeight = 1006;
    const individualWidth = finalWidth / 2;
    const individualHeight = finalHeight / 2;

    const canvas = sharp({
      create: {
        width: finalWidth,
        height: finalHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    });

    const imageBuffers = await Promise.all(
      imageUrls.map(async (url) => {
        return sharp(await fetchImageAsBuffer(url))
          .resize(individualWidth, individualHeight, {
            fit: sharp.fit.cover,
            position: sharp.strategy.entropy,
          })
          .toBuffer();
      })
    );

    const compositeOperations = imageBuffers.map((buffer, index) => {
      const row = Math.floor(index / 2);
      const col = index % 2;
      return {
        input: buffer,
        top: row * individualHeight,
        left: col * individualWidth,
      };
    });

    // Apply the composite operations
    await canvas.composite(compositeOperations);

    // Save to a local file to test the buffer
    await canvas.toFile("/tmp/test-output.png");

    // Convert to a buffer and specify the format explicitly
    const outputBuffer = await canvas.png().toBuffer();
    console.log("the output buffer is :", outputBuffer);
    // Upload to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = v2.uploader.upload_stream(
        { resource_type: "image" },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(outputBuffer);
    });
    console.log("the upload result is : ", uploadResult);

    return uploadResult.url;
  } catch (error) {
    console.log("there was an error creating the summarized image", error);
  }
}

const finalImageWidth = 1920; // Set the width of the final image
const spacingBetweenImages = 10; // Set the spacing between images and the margin

const checkAndUpdateGeneratedAnkys = async () => {
  const ankys = await prisma.generatedAnky.findMany({
    where: {
      OR: [
        { imagineApiStatus: "pending" },
        { imagineApiStatus: "in-progress" },
        { imagineApiStatus: "failed" },
      ],
    },
  });
  console.log("the ankys are: ", ankys.length);

  for (const anky of ankys) {
    try {
      await delay(555);
      if (anky.alreadyMinted && anky.metadataIPFSHash) return null;
      const response = await axios.get(
        `http://${process.env.MIDJOURNEY_SERVER_IP}:8055/items/images/${anky.imagineApiID}`,
        {
          headers: { Authorization: `Bearer ${process.env.IMAGINE_API_TOKEN}` },
        }
      );
      const apiData = response.data.data;

      if (apiData.status === "completed") {
        const userResponse = await neynarClient.lookupUserByFid(anky.userFid);

        const upscaledIds = apiData.upscaled;

        const imageUrls = [];
        for (const imageId of upscaledIds) {
          const thisImageUrl = `http://${process.env.MIDJOURNEY_SERVER_IP}:8055/assets/${imageId}/${imageId}.png`;
          const result = await v2.uploader.upload(thisImageUrl);
          imageUrls.push(result.url);
        }
        const finalImageUrl = await createAndUploadSummaryImage(imageUrls);
        // Here this image should be casted with the numbers for the user to choose below.

        // const ipfsHash = await uploadToPinataFromUrl(thisImageUrl);
        // if (!ipfsHash || ipfsHash == null) return;
        // const nftMetadata = {
        //   name: "you",
        //   description: anky.imagePrompt,
        //   image: `ipfs://${ipfsHash}`,
        // };
        // const ipfsMetadataHash = await uploadMetadataToPinata(nftMetadata);

        // if (!ipfsMetadataHash || ipfsMetadataHash == null) return;

        let thisCastOptions = {
          parent: ``,
          text: `Hey @${userResponse.result.user.username}, your anky is ready.\n\nYou can mint it on the frame.`,
          embeds: [
            {
              url: `https://api.anky.lat/farcaster-frames/generated-anky?cid=${anky.cid}&revealed=0&choosingAnky=0&chosenAnky=0&mint=0`,
            },
          ],
          signer_uuid: process.env.ANKY_SIGNER_UUID,
        };
        const thisCastCreationResponse = await axios.post(
          "https://api.neynar.com/v2/farcaster/cast",
          thisCastOptions,
          {
            headers: {
              api_key: process.env.NEYNAR_API_KEY,
            },
          }
        );

        await prisma.generatedAnky.update({
          where: { cid: anky.cid },
          data: {
            imagineApiStatus: apiData.status,
            wasCastedOnFrame: true,
            frameImageUrl: finalImageUrl,
            imageOneUrl: imageUrls[0],
            imageTwoUrl: imageUrls[1],
            imageThreeUrl: imageUrls[2],
            imageFourUrl: imageUrls[3],
            castHash: thisCastCreationResponse.data.cast.hash,
          },
        });
      } else if (apiData.status === "failed") {
        console.log("the image creation failed");
        // await createImageAgain(anky);
      } else {
        await prisma.generatedAnky.update({
          where: { cid: anky.cid },
          data: { imagineApiStatus: apiData.status },
        });
      }
      break;
    } catch (error) {
      console.error(
        `Error updating GeneratedAnky with cid ${anky.userFid}: `,
        error?.response?.data?.errors || error
      );
    }
  }
};

const createImageAgain = async (anky) => {
  try {
    const config = {
      headers: { Authorization: `Bearer ${process.env.IMAGINE_API_TOKEN}` },
    };
    const responseFromImagineApi = await axios.post(
      `http://${process.env.MIDJOURNEY_SERVER_IP}:8055/items/images`,
      {
        prompt: anky.imagePrompt,
      },
      config
    );
    await prisma.midjourneyOnAFrame.update({
      where: { userFid: anky.userFid },
      data: {
        imagineApiStatus: "pending",
        imagineApiID: responseFromImagineApi.data.data.id,
      },
    });
  } catch (error) {
    console.log("there was an error creating the image again,", error);
  }
};

module.exports = {
  checkAndUpdateAnkys,
  checkAndUpdateGeneratedAnkys,
};

const express = require("express");
const router = express.Router();
const axios = require("axios");
const prisma = require("../lib/prismaClient");
const { mnemonicToAccount } = require("viem/accounts");
const {
  NeynarAPIClient,
  CastParamType,
  FeedType,
  FilterType,
} = require("@neynar/nodejs-sdk");

const client = new NeynarAPIClient(process.env.NEYNAR_API_KEY);

if (typeof process.env.FARCASTER_DEVELOPER_MNEMONIC === "undefined") {
  throw new Error("FARCASTER_DEVELOPER_MNEMONIC is not defined");
}
const FARCASTER_DEVELOPER_MNEMONIC = process.env.FARCASTER_DEVELOPER_MNEMONIC;

if (typeof process.env.FARCASTER_DEVELOPER_FID === "undefined") {
  throw new Error("FARCASTER_DEVELOPER_FID is not defined");
}
const FARCASTER_DEVELOPER_FID = process.env.FARCASTER_DEVELOPER_FID;

const generate_signature = async function (public_key) {
  // DO NOT CHANGE ANY VALUES IN THIS CONSTANT
  const SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN = {
    name: "Farcaster SignedKeyRequestValidator",
    version: "1",
    chainId: 10,
    verifyingContract: "0x00000000fc700472606ed4fa22623acf62c60553",
  };

  // DO NOT CHANGE ANY VALUES IN THIS CONSTANT
  const SIGNED_KEY_REQUEST_TYPE = [
    { name: "requestFid", type: "uint256" },
    { name: "key", type: "bytes" },
    { name: "deadline", type: "uint256" },
  ];

  const account = mnemonicToAccount(FARCASTER_DEVELOPER_MNEMONIC);

  const deadline = Math.floor(Date.now() / 1000) + 3 * 86400;
  // const deadline = 1705751578 + 3 * 86400;

  // Generates the signature
  const signature = await account.signTypedData({
    domain: SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN,
    types: {
      SignedKeyRequest: SIGNED_KEY_REQUEST_TYPE,
    },
    primaryType: "SignedKeyRequest",
    message: {
      requestFid: BigInt(FARCASTER_DEVELOPER_FID),
      key: public_key,
      deadline: BigInt(deadline),
    },
  });

  return { deadline, signature };
};

router.get("/feed-by-fid/:fid", async (req, res) => {
  try {
    if (!req.params.fid)
      return res.status(500).json({ message: "invalid fid" });
    const url = `https://api.neynar.com/v2/farcaster/feed?feed_type=following&fid=${req.params.fid}&with_recasts=true&with_replies=true&limit=100`;
    const response = await axios.get(url, {
      headers: {
        api_key: process.env.NEYNAR_API_KEY,
      },
    });
    res.status(200).json({ feed: response.data.casts });
  } catch (error) {
    console.log("there was an error");
    res.status(401).json({ message: "there was an error" });
  }
});

router.post("/api/signer", async (req, res) => {
  try {
    const { privyId } = req.body;
    const createSignerResponse = await axios.post(
      "https://api.neynar.com/v2/farcaster/signer",
      {},
      {
        headers: {
          api_key: process.env.NEYNAR_API_KEY,
        },
      }
    );

    const { deadline, signature } = await generate_signature(
      createSignerResponse.data.public_key
    );

    const signedKeyResponse = await axios.post(
      "https://api.neynar.com/v2/farcaster/signer/signed_key",
      {
        signer_uuid: createSignerResponse.data.signer_uuid,
        app_fid: FARCASTER_DEVELOPER_FID,
        deadline,
        signature,
      },
      {
        headers: {
          api_key: process.env.NEYNAR_API_KEY,
        },
      }
    );
    const { public_key, signer_uuid, status } = signedKeyResponse.data;
    const existingFarcasterAccount = await prisma.farcasterAccount.findUnique({
      where: { userId: privyId },
    });
    if (existingFarcasterAccount) {
      await prisma.farcasterAccount.update({
        where: { id: existingFarcasterAccount.id },
        data: {
          publicKey: public_key,
          signerUuid: signer_uuid,
          signerStatus: status,
        },
      });
    } else {
      await prisma.farcasterAccount.create({
        data: {
          user: { connect: { privyId: privyId } },
          publicKey: public_key,
          signerUuid: signer_uuid,
          signerStatus: status,
        },
      });
    }

    // Respond with the signed key response data
    res.json(signedKeyResponse.data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/api/signer", async (req, res) => {
  const { signer_uuid, privyId } = req.query;
  try {
    const response = await axios.get(
      "https://api.neynar.com/v2/farcaster/signer",
      {
        params: {
          signer_uuid,
        },
        headers: {
          api_key: process.env.NEYNAR_API_KEY,
        },
      }
    );
    if (response.data.status == "approved") {
      const existingFarcasterAccount = await prisma.farcasterAccount.findUnique(
        {
          where: { userId: privyId },
        }
      );
      if (existingFarcasterAccount) {
        await prisma.farcasterAccount.update({
          where: { id: existingFarcasterAccount.id },
          data: {
            signerStatus: response.data.status,
          },
        });
      }
    }
    res.json(response.data);
  } catch (error) {
    console.log("there was an error inside here!");
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/u/:fid", async (req, res) => {
  try {
    const response = await client.lookupUserByFid(req.params.fid);
    res.status(200).json({ user: response.result.user });
  } catch (error) {
    console.log("there was an error here");
  }
});

router.get("/u/:fid/feed", async (req, res) => {
  try {
    if (typeof req.params.fid == "number") {
      const response = await axios.get(
        `https://api.neynar.com/v2/farcaster/feed?feed_type=filter&filter_type=fids&fids=${req.params.fid}&limit=50`,
        {
          headers: {
            api_key: process.env.NEYNAR_API_KEY,
          },
        }
      );
      res.status(200).json({ casts: response.data.casts });
    } else {
      res.status(200).json({ casts: null });
    }
  } catch (error) {
    console.log("there was an error fetching the feed");
  }
});

router.get("/degen-channel-feed", async (req, res) => {
  try {
    const response = await axios.get(
      `https://api.neynar.com/v2/farcaster/feed/channels?channel_ids=degen&with_recasts=true&with_replies=false&limit=10`,
      {
        headers: {
          api_key: process.env.NEYNAR_API_KEY,
        },
      }
    );
    res.status(200).json({ feed: response.data.casts });
  } catch (error) {
    console.log("there was an error getting the anky feed");
    res
      .status(500)
      .json({ message: "there was an error loading the anky feed" });
  }
});

router.post("/u/:fid/feed", async (req, res) => {
  try {
    let { viewerFid } = req.body;
    const ankyChannelUrl = "https://warpcast.com/~/channel/degen";
    const usersFid = req.params.fid;

    const result = await client.fetchFeed(FeedType.Filter, {
      filterType: FilterType.ParentUrl,
      parentUrl: ankyChannelUrl,
      limit: 20,
      fid: usersFid,
    });

    res.status(200).json({ feed: result.data.casts });
  } catch (error) {
    console.log("there was an error here", error);
  }
});

router.get("/get-feed/:collectionId", async (req, res) => {
  try {
    const addrs = await getAddressesThatOwnNFT(req.params.collectionId);

    const usersLookup = async (addrs) => {
      const users = await Promise.all(
        addrs.map(async (addr) => {
          try {
            const response = await client.lookupUserByVerification(addr);
            return response ? response.result.user : undefined;
          } catch (error) {
            return undefined;
          }
        })
      );
      return users.filter((fid) => fid !== undefined);
    };

    const usersThatOwnThisNft = await usersLookup(addrs);

    res.status(200).json({ users: usersThatOwnThisNft });
  } catch (error) {
    console.log("there was an error getting the random feed", error);
  }
});

router.post("/api/reaction", async (req, res) => {
  try {
    const { reactionType, hash, signer_uuid } = req.body;

    const response = await axios.post(
      "https://api.neynar.com/v2/farcaster/reaction",
      {
        signer_uuid: signer_uuid,
        reaction_type: reactionType,
        target: hash,
      },
      {
        headers: {
          api_key: process.env.NEYNAR_API_KEY,
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.log("there was an error", error);
    res.status(500).json({ message: "there was an error adding the reaction" });
  }
});

router.post("/api/cast/anon", async (req, res) => {
  const { text, parent, embeds, cid, manaEarned, channelId, time } = req.body;
  let fullCast;
  let castOptions = {
    text: text,
    embeds: embeds,
    signer_uuid: process.env.ANKY_SIGNER_UUID,
  };

  if (channelId) {
    castOptions.channel_id = channelId;
  } else if (
    (parent && parent.includes("/channel")) ||
    parent.slice(0, 2) == "0x"
  ) {
    castOptions.parent = parent;
  } else if (parent.includes("warpcast")) {
    fullCast = await getFullCastFromWarpcasterUrl(parent);
    castOptions.parent = fullCast.hash;
  }

  try {
    const response = await axios.post(
      "https://api.neynar.com/v2/farcaster/cast",
      castOptions,
      {
        headers: {
          api_key: process.env.NEYNAR_API_KEY,
        },
      }
    );
    const prismaResponse = await prisma.castWrapper.create({
      data: {
        time: time,
        cid: cid,
        manaEarned: manaEarned,
        castHash: response.data.cast.hash,
        castAuthor: response.data.cast.author.username,
      },
    });

    res.json({ cast: response.data.cast });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/api/cast/anon-reply", async (req, res) => {
  const { text, parent } = req.body;
  try {
    const response = await axios.post(
      "https://api.neynar.com/v2/farcaster/cast",
      {
        text: text,
        embeds: embeds,
        signer_uuid: process.env.ANKY_SIGNER_UUID,
        parent: parent,
      },
      {
        headers: {
          api_key: process.env.NEYNAR_API_KEY,
        },
      }
    );
    res.json({ cast: response.data.cast });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/api/cast/:hash", async (req, res) => {
  try {
    const response = await axios.get(
      "https://api.neynar.com/v2/farcaster/cast",
      {
        params: {
          identifier: req.params.hash,
          type: "hash",
        },
        headers: {
          api_key: process.env.NEYNAR_API_KEY,
        },
      }
    );
    res.json({ cast: response.data.cast });
  } catch (error) {
    console.log("there was an error)");
    console.log(error);
    res.json({ cast: null });
  }
});

async function getFullCastFromWarpcasterUrl(url) {
  try {
    const apiRoute = `https://api.neynar.com/v2/farcaster/cast?identifier=${url.replace(
      "/",
      "%2F"
    )}&type=url`;
    const response = await axios.get(apiRoute, {
      headers: {
        api_key: process.env.NEYNAR_API_KEY,
      },
    });
    return response.data.cast;
  } catch (error) {
    console.log("there was an error ", error);
  }
}

router.post("/api/cast", async (req, res) => {
  const { embeds, text, signer_uuid, parent, cid, manaEarned, channelId } =
    req.body;
  // Parent is on this format: { parent: 'https://warpcast.com/jpfraneto/0xa7c31262' }
  let fullCast;
  let castOptions = {
    text: text,
    embeds: embeds,
    signer_uuid: signer_uuid,
    parent: fullCast,
  };
  if (channelId) {
    castOptions.channel_id = channelId;
  }
  if (parent.includes("/channel")) {
    fullCast = parent;
  } else {
    fullCast = await getFullCastFromWarpcasterUrl(parent);
    fullCast = fullCast.hash;
  }

  try {
    const response = await axios.post(
      "https://api.neynar.com/v2/farcaster/cast",
      castOptions,
      {
        headers: {
          api_key: process.env.NEYNAR_API_KEY,
        },
      }
    );
    const prismaResponse = await prisma.castWrapper.create({
      data: {
        cid: cid,
        manaEarned: manaEarned,
        castHash: response.data.cast.hash,
        castAuthor: response.data.cast.author.username,
      },
    });

    res.status(200).json(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;

const { SoundAPI } = require("@soundxyz/sdk/api/sound");

const apiKey = process.env.SOUNDXYZ_API_KEY;

if (!apiKey) throw Error("Missing sound API key");

const soundAPI = SoundAPI({
  apiKey,
});

module.exports = { soundAPI };

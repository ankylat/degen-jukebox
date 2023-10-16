const express = require('express');
const { openai } = require('openai');
const { generateAnkyFromUserWriting } = require('../lib/ai/anky-factory');
const { fetchImageProgress } = require('../lib/ai/midjourney');
const { reflectUserWriting } = require('../lib/ai/chatgtp'); // Import the functions
const {
  getInitialAnkyDementorNotebook,
  getSubsequentAnkyDementorNotebookPage,
} = require('../lib/ai/anky-dementor');
const { uploadToBundlr } = require('../lib/bundlrSetup');
const router = express.Router();

router.get('/', (req, res) => {
  console.log('in the ai get route');
});

router.post('/tell-me-who-you-are', async (req, res) => {
  try {
    console.log('inside the tell us who you are route', req.body);

    // Error handling if the body doesn't have 'text'
    if (!req.body.finishText) {
      return res
        .status(400)
        .json({ error: "The 'text' parameter is missing." });
    }
    return res
      .status(200)
      .json({ firstPageCid: '_2niarNbm4IcJ8S4BYVfShALzAUUhNwxoOrhSwq50wM' });

    const firstPageCid = await getInitialAnkyDementorNotebook(
      req.body.finishText
    );
    console.log('out heere', firstPageCid);
    res.status(200).json({ firstPageCid: firstPageCid }); // changed the response to be more meaningful
  } catch (error) {
    console.log('There was an error');
    res.status(500).json({ message: 'server error' });
  }
});

router.post('/get-subsequent-page', async (req, res) => {
  try {
    console.log('inside the get subsequent page route', req.body);

    // Error handling if the body doesn't have 'text'
    if (!req.body.finishText || !req.body.prompts) {
      return res
        .status(400)
        .json({ error: "The 'text' or 'prompts' parameter is missing." });
    }

    return res.status(200).json({
      thisWritingCid: 'mqb55JMU9OR43Hk6AZL5l6TEVjImcwMsY03Z5rKd3as',
      newPageCid: '5rCS8IHvoEUwt6zfzqfdkR5cRcEuaSJPZeRTQCsHZSQ',
    });
    const thisWritingCid = await uploadToBundlr(req.body.finishText);
    console.log('this writing cid is: ', thisWritingCid);
    const newPageCid = await getSubsequentAnkyDementorNotebookPage(
      req.body.finishText,
      req.body.prompts
    );
    console.log('out heeeREEEEE', newPageCid);
    res.status(200).json({ newPageCid: newPageCid }); // changed the response to be more meaningful
  } catch (error) {
    console.log('There was an error', error);
    res.status(500).json({ message: 'server error' });
  }
});

router.post('/get-feedback-from-writing', async (req, res) => {
  console.log('Inside the get feedback from writing route', req.body);
  const response = await reflectUserWriting(
    req.body.text,
    req.body.user,
    req.body.prompt,
    res
  );
  res.json({ ankyResponse: response });
});

router.post('/create-anky-from-writing', async (req, res) => {
  console.log('Inside the create anky from writing function');
  const response = await generateAnkyFromUserWriting(req.body.text);
  console.log('The response is: ', response);
  res.json({ anky: response });
});

router.get('/check-image/:imageId', async (req, res) => {
  console.log('checking the image with the following id: ', req.params.imageId);
  const imageId = req.params.imageId;
  const imageProgress = await fetchImageProgress(imageId);
  if (imageProgress) {
    return res.json(imageProgress);
  } else {
    return res.status(404).send('Image not found');
  }
});

module.exports = router;

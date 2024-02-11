const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const theSource = {};

async function castNewRecommendationToPresent(recommendation) {
  try {
    let castOptions = {
      text: `@${recommendation.authorUsername} · ${recommendation.bidAmount} $degen\n\n${recommendation.name}`,
      embeds: [{ url: recommendation.url }],
      signer_uuid: process.env.THEGENRADIO_SIGNER_UUID,
      channel_id: "thegenradio",
    };
    const response = await axios.post(
      "https://api.neynar.com/v2/farcaster/cast",
      castOptions,
      {
        headers: {
          api_key: process.env.NEYNAR_API_KEY,
        },
      }
    );
    console.log(
      `the cast signalling this recommendation coming to the present was sent to farcaster`
    );
    return true;
  } catch (error) {
    console.log("there was an error casting the recommendation");
    console.log(error);
    return false;
  }
}

theSource.sendRecommendationToPast = async () => {
  const presentRecommendation = await prisma.recommendation.findFirst({
    where: { status: "present" },
  });

  if (presentRecommendation) {
    let timestampDifference =
      new Date().getTime() -
      presentRecommendation.endingRecommendationTimestamp;

    await prisma.recommendation.update({
      where: { id: presentRecommendation.id },
      data: {
        status: "past",
        timestampDifference: timestampDifference,
      },
    });

    console.log(
      `The recommendation ${presentRecommendation.name} was sent to the past.`
    );

    theSource.theMind();
  }
};

theSource.checkSystem = async () => {
  const presentRecommendation = await prisma.recommendation.findFirst({
    where: { status: "present" },
  });

  if (presentRecommendation) {
    let now = new Date().getTime();
    let timestampDifference =
      presentRecommendation.endingRecommendationTimestamp - now;
    if (timestampDifference > 0) {
      console.log(
        "a timeout will be triggered on this amoount of milliseconds",
        timestampDifference
      );
      setTimeout(theSource.sendRecommendationToPast, timestampDifference);
    } else {
      console.log("sending it to the past");
      await theSource.sendRecommendationToPast();
    }
  } else {
    theSource.theMind();
  }
};

theSource.theMind = async () => {
  const futureRecommendations = await prisma.recommendation.findMany({
    where: { status: "future" },
    include: { author: true },
    orderBy: { bidAmount: "desc" },
  });
  if (futureRecommendations.length > 0) {
    const recommendation = futureRecommendations[0];
    let now = new Date();
    let endingTime = new Date(now.getTime() + recommendation.duration);

    await prisma.recommendation.update({
      where: { id: recommendation.id },
      data: {
        status: "present",
        startingRecommendationTimestamp: now,
        endingRecommendationTimestamp: endingTime,
      },
    });
    await castNewRecommendationToPresent(recommendation);
    console.log(
      "the recommendation was brought to the present",
      recommendation.name
    );

    setTimeout(theSource.sendRecommendationToPast, recommendation.duration);
  } else {
    theSource.bigBang();
  }
};

theSource.bigBang = async () => {
  const pastRecommendations = await prisma.recommendation.findMany({
    where: { status: "past" },
  });

  if (pastRecommendations.length > 0) {
    for (const recommendation of pastRecommendations) {
      await prisma.recommendation.update({
        where: { id: recommendation.id },
        data: {
          status: "future",
          startingRecommendationTimestamp: null,
          endingRecommendationTimestamp: null,
          timestampDifference: null,
          bidAmount: 0,
        },
      });
    }
    theSource.closeCycle(pastRecommendations.length);
  }

  theSource.theMind();
};

theSource.openCycle = async () => {
  const foundCycles = await prisma.cycle.findMany();

  let newCycleIndex = foundCycles.length;
  await prisma.cycle.create({
    data: {
      cycleIndex: newCycleIndex,
      startingTimestamp: new Date().getTime(),
    },
  });
  console.log("The new cycle was opened.");
};

theSource.closeCycle = async (numberOfRecommendations = 0) => {
  const foundCycles = await prisma.cycle.findMany();

  if (foundCycles.length > 0) {
    const lastCycle = foundCycles[foundCycles.length - 1];
    await prisma.cycle.update({
      where: { id: lastCycle.id },
      data: {
        numberOfRecommendations: numberOfRecommendations,
        cycleDuration: new Date().getTime() - lastCycle.startingTimestamp,
      },
    });
    console.log(
      `The cycle #${lastCycle.cycleIndex} was closed and saved in the DB.`
    );
  }

  theSource.openCycle();
};

module.exports = theSource;

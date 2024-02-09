const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const theSource = {};

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
      setTimeout(theSource.sendRecommendationToPast, timestampDifference);
    } else {
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
    orderBy: { bidAmount: "desc" }, // Order by highest bid
  });
  if (futureRecommendations.length > 0) {
    const recommendation = futureRecommendations[0]; // Pick the highest bid
    let now = new Date();
    let endingTime = new Date(now.getTime() + recommendation.duration); // Calculate the ending time

    await prisma.recommendation.update({
      where: { id: recommendation.id },
      data: {
        status: "present",
        startingRecommendationTimestamp: now,
        endingRecommendationTimestamp: endingTime,
      },
    });

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

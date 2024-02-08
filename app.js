// Load environment variables
require("dotenv").config();

// Third-party libraries
const schedule = require("node-schedule");
const express = require("express");
const { ethers } = require("ethers");
const cors = require("cors");
const fs = require("fs").promises;
const path = require("path");
const bodyParser = require("body-parser");
const prisma = require("./lib/prismaClient");
const rateLimit = require("express-rate-limit");

// Internal Modules

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 100 requests per windowMs
});

// Routes
const jukeboxRoute = require("./routes/jukebox-frame");
const apiRoute = require("./routes/api");
const farcasterRoute = require("./routes/farcaster");

const app = express();
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);
app.options("*", cors());
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

app.use((req, res, next) => {
  next();
});

app.use("/jukebox", jukeboxRoute);
app.use("/api", apiRoute);
app.use("/farcaster", farcasterRoute);

app.get("/", (req, res) => {
  res.send("Welcome to the degen jukebox!");
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});

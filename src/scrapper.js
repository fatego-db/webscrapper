require("dotenv").config();
const path = require("path");

const SetupProcessor = require("./processors/setupProcessor");
const ServantProcessor = require("./processors/servantProcessor");

const SERVANT_VERSION = process.env.SERVANT_VERSION;

const dataDir = path.join(__dirname, "..", "data");
const setupProcessor = new SetupProcessor(dataDir);
const servantProcessor = new ServantProcessor(dataDir, SERVANT_VERSION);

setupProcessor.process()
  .then(servantProcessor.process())
  .then(() => console.log("servant data collected"));

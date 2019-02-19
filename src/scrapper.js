require("dotenv").config();
const path = require("path");

const SetupProcessor = require("./processors/setupProcessor");
const ServantProcessor = require("./processors/servantProcessor");
const SkillProcessor = require("./processors/skillProcessor");

const dataDir = path.join(__dirname, "..", "data");
const setupProcessor = new SetupProcessor(dataDir);
const servantProcessor = new ServantProcessor(dataDir);
const skillProcessor = new SkillProcessor(dataDir);

setupProcessor.process()
  .then(() => servantProcessor.process())
  .then(() => console.log("servants data collected"))
  .then(() => skillProcessor.process())
  .then(() => console.log("skills data collected"));

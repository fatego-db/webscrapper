require("dotenv").config();
const path = require("path");

const SetupProcessor = require("./processors/setupProcessor");
const ServantProcessor = require("./processors/servantProcessor");
const SkillProcessor = require("./processors/skillProcessor");

const SERVANT_VERSION = process.env.SERVANT_VERSION;
const SKILL_VERSION = process.env.SKILL_VERSION;

const dataDir = path.join(__dirname, "..", "data");
const setupProcessor = new SetupProcessor(dataDir);
const servantProcessor = new ServantProcessor(dataDir, SERVANT_VERSION);
const skillProcessor = new SkillProcessor(dataDir, SKILL_VERSION);

setupProcessor.process()
  .then(() => servantProcessor.process())
  .then(() => console.log("servants data collected"))
  .then(() => skillProcessor.process())
  .then(() => console.log("skills data collected"));

const axios = require("axios");
const cheerio = require("cheerio");
const cheerioTableParser = require("cheerio-tableparser");
const fs = require("fs");
const sleep = require("sleep");
const Entities = require("html-entities").AllHtmlEntities;
const jsonfile = require("jsonfile");
const path = require("path");
const fetchEndpointFor = require("./fetchUtil");

class SkillProcessor {
  constructor(dataDir) {
    this.dataDir = dataDir;

    this.entities = new Entities();

    this.getSkillGrowth = this.getSkillGrowth.bind(this);
    this.getServantSkills = this.getServantSkills.bind(this);
    this.createFileName = this.createFileName.bind(this);
    this.cacheFile = this.cacheFile.bind(this);
    this.filterServerErrors = this.filterServerErrors.bind(this);
    this.unescapeTitle = this.unescapeTitle.bind(this);
    this.comb = this.comb.bind(this);
  }

  getSkillGrowth(name, meta, effects, skillRef) {
    if (skillRef.includes("http")) {
      throw new Error(skillRef);
    }
    const skillUrl = `https://grandorder.gamepress.gg${skillRef}`;
    return axios.get(skillUrl)
      .then((response) => response.data)
      .then((skillHtml) => {
        const skill = cheerio.load(skillHtml);
        cheerioTableParser(skill);
        const tableData = skill("table").parsetable(true, true, true);
        const enhancement = tableData[0][1].trim();
        const growthData = tableData.slice(1);
        const growth = growthData.map((grow, index) => {
          let level, effect, cooldown;
          [level, effect, cooldown] = grow;
          effect = effect.trim();
          return {level, effect, cooldown};
        });
        return {
          name,
          meta,
          effects,
          leveling: {
            enhancement,
            growth
          }
        };
      })
      .catch((error) => {
        let status;
        if (error.response) {
          status = error.response.status;
        } else if (error.request) {
          status = "REQUEST_ERROR";
        } else {
          status = "UNKNOWN";
        }
        
        console.error(`failed: name=${name} error=${error} status=${status} url=${skillUrl}`);
        const ref = (status === 503) ? {error: "NOT_FOUND"} : {ref: skillRef};
        return {
          name,
          meta,
          effects,
          leveling: ref
        };
      });
  }

  getServantSkills() {
    return fetchEndpointFor("servant-skills-FGO")
      .then((url) => axios.get(url))
      .then((response) => response.data)
      .then((data) => {
        return Promise.all(data.map((datum, index) => {
          if (index % 10 === 0) {
            sleep.sleep(1);
          }
          console.log(`${index} / ${data.length} ${datum.title_plain}`);
          const name = datum.title_plain;
          const meta = {
            type: datum.skill_type,
            category: datum.skill_type_specific
          };
          const $ = cheerio.load(datum.title);
          const effects = $("p").text().split("\n");

          const skillRef = $("a").attr("href");
          return this.getSkillGrowth(name, meta, effects, skillRef);
        }));
      });
  }

  createFileName(tag) {
    return path.join(this.dataDir, `skills.${tag}.json`);
  }

  cacheFile(data, tag) {
    jsonfile.writeFileSync(this.createFileName(tag), data, {spaces: 2});
    return data;
  }

  filterServerErrors(data) {
    return data.filter((datum) => datum.leveling !== 503);
  }

  unescapeTitle(data) {
    return data.map((datum) => Object.assign(datum, {name: this.entities.decode(datum.name)}));
  }

  comb(data) {
    const missingData = data.filter((datum) => datum.leveling.ref);
    if (missingData.length > 0) {
      return Promise.all(data.map((datum) => {
        if (datum.leveling.ref) {
          return this.getSkillGrowth(datum.name, datum.meta, datum.effects, datum.leveling.ref);
        } else {
          return Promise.resolve(datum);
        }
      }))
      .then(this.comb);
    } else {
      return Promise.resolve(data);
    }
  }

  process() {
    let basicData;
    let basicPath = this.createFileName("basic");
    if (fs.existsSync(basicPath)) {
      console.log("reading skills from cache")
      basicData = new Promise((resolve, reject) => {
        jsonfile.readFile(basicPath, (error, data) => {
          if (error) {
            reject(error)
          } else {
            resolve(data);
          }
        })
      });
    } else {
      console.log("fetching skills");
      basicData = this.getServantSkills()
        .then((data) => this.cacheFile(data, "basic"));
    }

    return basicData
      .then(this.filterServerErrors)
      .then(this.unescapeTitle)
      .then((data) => this.cacheFile(data, "filter"))
      .then(this.comb)
      .then((data) => data.filter((datum) => datum.leveling.error !== "NOT_FOUND"))
      .then((data) => this.cacheFile(data, "clean"))
      .catch((error) => console.error(error.message));
  }
}

module.exports = SkillProcessor;

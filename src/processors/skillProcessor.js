const axios = require("axios");
const cheerio = require("cheerio");
const cheerioTableParser = require("cheerio-tableparser");
const fs = require("fs");
const jsonfile = require("jsonfile");
const path = require("path");

class SkillProcessor {
  constructor(dataDir, version) {
    this.dataDir = dataDir;
    this.version = version;

    this.getSkillGrowth = this.getSkillGrowth.bind(this);
    this.getServantSkills = this.getServantSkills.bind(this);
    this.createFileName = this.createFileName.bind(this);
    this.cacheFile = this.cacheFile.bind(this);
    this.filterServerErrors = this.filterServerErrors.bind(this);
    this.comb = this.comb.bind(this);
  }

  getSkillGrowth(skillRef) {
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
        const errorType = (error.response) ? error.response.status
                                           : {ref: skillRef};
        console.error(`failed: ${name} : ${errorType}`);
        return {
          name,
          meta,
          effects,
          leveling: errorType
        };
      });
  }

  getServantSkills() {
    const url = `https://grandorder.gamepress.gg/sites/grandorder/files/fgo-jsons/servant-skills.json?${this.version}`;
    return axios.get(url)
      .then((response) => response.data)
      .then((data) => {
        return Promise.all(data.map((datum, index) => {
          const name = datum.title_plain;
          const meta = {
            type: datum.skill_type,
            category: datum.skill_type_specific
          };
          const $ = cheerio.load(datum.title);
          const effects = $("p").text().split("\n");

          const skillRef = $("a").attr("href");
          return this.getSkillGrowth(skillRef);
        }));
      });
  }

  createFileName(tag) {
    return path.join(this.dataDir, `skills_${this.version}.${tag}.json`);
  }

  cacheFile(data, tag) {
    jsonfile.writeFileSync(this.createFileName(tag), data, {spaces: 2});
    return data;
  }

  filterServerErrors(data) {
    return data.filter((datum) => datum.leveling !== 503);
  }

  comb(data) {
    const missingData = data.filter((datum) => datum.leveling.ref);
    if (missingData.length > 0) {
      return Promise.all(data.map((datum) => {
        if (datum.leveling.ref) {
          return this.getSkillGrowth(datum.leveling.ref);
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
      .then((data) => this.cacheFile(data, "filter"))
      .then(this.comb)
      .then((data) => this.cacheFile(data, "clean"))
      .catch((error) => console.error(error.message));

  }
}

module.exports = SkillProcessor;

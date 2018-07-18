const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const jsonfile = require("jsonfile");
const path = require("path");
const sleep = require("sleep");

class ServantProcessor {
  constructor(dataDir, version) {
    this.dataDir = dataDir;
    this.version = version;

    this.createFileName = this.createFileName.bind(this);
    this.getServantStats = this.getServantStats.bind(this);
    this.fetchServantData = this.fetchServantData.bind(this);
    this.getServantData = this.getServantData.bind(this);
    this.comb = this.comb.bind(this);
    this.cacheFile = this.cacheFile.bind(this);
    this.cleanStats = this.cleanStats.bind(this);
    this.cleanClass = this.cleanClass.bind(this);
  }

  /**
   *  Create a filename for Servant data.
   *
   *  @param  {String} tag     Tag to append to file servant_version.tag.json
   *  @return {String}         Path string to data file.
   */
  createFileName(tag) {
    return path.join(this.dataDir, `servants_${this.version}.${tag}.json`);
  };

  /**
   *  Get servant stats for a given servant datum.
   *
   *  @param  {Object} datum Servant datum
   *  @return {Promise}      Axios request promise
   */
  getServantStats(datum) {
    const urlName = datum.name.replace(/[()'\/&]/g, "")
      .replace(/ of /g, " ")
      .replace(/ the /g, " ")
      .replace(/\s+/g, "-")
      .toLowerCase();
    const profileEndpoint = `https://grandorder.gamepress.gg/servant/${urlName}`;
    return axios.get(profileEndpoint)
      .then((response) => response.data)
      .then((profileHtml) => { // Get nid for stats
        const $ = cheerio.load(profileHtml);
        return $("article").attr("id").split("node-")[1];
      })
      .then((nid) => { // Fetch stats
        const statEndpoint = `https://grandorder.gamepress.gg/calc-stats?_format=json&nid=${nid}`;
        return axios.get(statEndpoint);
      })
      .then((response) => response.data)
      .then((stats) => Object.assign(datum, {stats}))
      .catch((error) => { // Avoid crashing; cache data and comb through it later.
        if (error.response) {
          console.log(error.response.config);
          console.log(error.response.config.url)
        } else {
          console.log(error);
        }
        return Object.assign(datum, {stats: "error"});
      });
  };


  /**
   *  Fetch Servant Data from gamepress.
   *
   *  @return {Array}          Array of Servant datum
   */
  fetchServantData() {
    const servantEndpoint = "https://grandorder.gamepress.gg/sites/grandorder/files/fgo-jsons/servants.json";
    const endpoint = `${servantEndpoint}?${this.version}`;

    return axios.get(endpoint)
      .then((response) => response.data)
      .then((data) => {
        return data.map((datum) => {
          const rating = datum.stars.split(" ")[0]; // ex: 4 <span ...>
          const $ = cheerio.load(datum.title);
          const name = $("a").text().trim(); // should be only one anchor tag
          return {
            name,
            class: datum.field_class.replace(/\s+/g, ""),
            servantId: datum.servant_id,
            release: datum.release_status,
            rating
          };
        })
      })
      .then((data) => this.cacheFile(data, "basic"))
      .then((data) => {
        return Promise.all(data.map((datum, index) => {
          console.log(`${index} / ${data.length - 1} ${datum.name}`);
          if (index % 10 === 0) {
            sleep.sleep(1);
          }
          return this.getServantStats(datum);
        }));
      })
      .then((data) => this.cacheFile(data, "stat"));
  }

  /**
   *  Get the version of data from gamepress.
   *
   *  @return {[Array]}          Servant datum
   */
  getServantData() {
    const filename = this.createFileName("stat");
    let fetchTask;
    if (fs.existsSync(filename)) {
      console.log("reading servants data from cache");
      fetchTask = new Promise((resolve, reject) => {
        jsonfile.readFile(filename, (error, data) => {
          if (error) {
            reject(error);
          } else {
            resolve(data);
          }
        });
      });
    } else {
      console.log("fetching data from gamepress");
      fetchTask = this.fetchServantData();
    }

    return fetchTask;
  }

  /**
   *  Go through existing data and fetch missing stats.
   *  In case of connection timeout, any datum will have a stats field with
   *  value "error".
   *
   *  @param  {[Array]} data Array of servant datum
   *  @return {[Array]}      Array of servant datum
   */
  comb(data) {
    const missingStats = data.filter((datum) => datum.stats === "error");
    if (missingStats.length > 0) {
      const statFetches = data.map((datum, index) => {
        if (datum.stats === "error") {
          console.log(`fixing ${index} / ${data.length - 1} ${datum.name}`);
          return this.getServantStats(datum);
        } else {
          return Promise.resolve(datum);
        }
      });
      return Promise.all(statFetches)
        .then(this.comb);
    }
    return Promise.resolve(data);
  }

  cacheFile(data, tag) {
    jsonfile.writeFileSync(this.createFileName(tag), data, {spaces: 2});
    return data;
  }

  cleanStats(data) {
    return data
      .filter((datum) => datum.name !== "Solomon (Grand Caster)")
      .map((datum, index) => {
        if (!datum.stats) {
          console.log(index);
        }
        if (datum.stats.length === 0) {
          return Object.assign(datum, {stats: {attack: [], hp: []}});
        }
        const stats = datum.stats[0];
        const statKeys = Object.keys(stats);

        const attackFields = Object.keys(stats)
          .filter((key) => key.startsWith("field_atk_"));
        const hpFields = Object.keys(stats)
          .filter((key) => key.startsWith("field_hp_"));

        const attackStats = new Array(attackFields.length);
        const hpStats = new Array(hpFields.length);

        let level;
        for (let a of attackFields) {
          level = parseInt(a.split("field_atk_")[1], 10) - 1;
          attackStats[level] = parseInt(stats[a], 10);
        }
        for (let h of hpFields) {
          level = parseInt(h.split("field_hp_")[1], 10) - 1;
          hpStats[level] = parseInt(stats[h], 10);
        }

        return Object.assign(datum,
                             {stats: {attack: attackStats, hp: hpStats}});
    });
  }

  cleanClass(data) {
    return data.map((datum, index) => {
      let classUpdate = {class: "unclassified"};
      const categories = ["saber", "archer", "lancer",
                          "rider", "assassin", "caster",
                          "berserker", "shielder",
                          "alterego", "ruler", "avenger",
                          "foreigner", "mooncancer", "beast"];
      for (let category of categories) {
        if (datum.class.toLowerCase().startsWith(category)) {
          classUpdate = {class: category};
          break;
        }
      }

      return Object.assign(datum, classUpdate);
    })
  }

  /**
  *  Process:
  *  1. Get the servant.json for gamepress
  *  2. Obtain desired fields
  *  3. Save basic.json
  *  4. Use name to get profile url
  *  5. Get nid from HTML
  *  6. Get stats
  *  7. Save stat.json
  *  8. Comb results
  *  9. Save comb.json
  *  10. Clean up stats field.
  *  11. Save clean.json
  */
  process() {
    return this.getServantData(this.version)
      .then(this.comb)
      .then((data) => this.cacheFile(data, "comb"))
      .then(this.cleanStats)
      .then(this.cleanClass)
      .then((data) => this.cacheFile(data, "clean"));
  }
}

module.exports = ServantProcessor;

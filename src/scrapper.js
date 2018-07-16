const path = require("path");
const fs = require("fs");
const mkdirp = require("mkdirp");
const axios = require("axios");
const cheerio = require("cheerio");
const sleep = require("sleep");
const jsonfile = require("jsonfile");

const dataDir = path.join(__dirname, "..", "data");
const dataDirPromise = new Promise((resolve, reject) => {
  mkdirp(dataDir, (error) => {
    if (error) {
      console.error("failed to setup data directory");
      reject(false);
    } else {
      console.log(`setup ${dataDir}`);
      resolve(true);
    }
  });
});

/**
 *  Get servant stats for a given servant datum.
 *
 *  @param  {Object} datum Servant datum
 *  @return {Promise}      Axios request promise
 */
const getServantStats = (datum) => {
  const urlName = datum.name.replace(/[()'\/&]/g, "")
    .replace(/ of /g, " ")
    .replace(/ the /g, " ")
    .replace(/\s+/g, "-")
    .toLowerCase();
  const profileEndpoint = `https://grandorder.gamepress.gg/servant/${urlName}`;
  return axios.get(profileEndpoint)
    .then((response) => response.data)
    .then((profileHtml) => {
      const $ = cheerio.load(profileHtml);
      return $("article").attr("id").split("node-")[1]
    })
    .then((nid) => {
      const statEndpoint = `https://grandorder.gamepress.gg/calc-stats?_format=json&nid=${nid}`;
      return axios.get(statEndpoint);
    })
    .then((response) => response.data)
    .then((stats) => Object.assign(datum, {stats}))
    .catch((error) => {
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
 *  Create a filename for Servant data.
 *
 *  @param  {String} version Numeric string (ex: "v20")
 *  @param  {String} tag     Tag to append to file servant_version.tag.json
 *  @return {String}         Path string to data file.
 */
const createFileName = (version, tag) => {
  return path.join(dataDir, `servants_${version}.${tag}.json`);
};

/**
 *  Fetch Servant Data from gamepress.
 *
 *  @param  {String} version Numeric string (ex: "v20")
 *  @return {Array}          Array of Servant datum
 */
const fetchServantData = (version) => {
  const servantEndpoint = "https://grandorder.gamepress.gg/sites/grandorder/files/fgo-jsons/servants.json";
  const endpoint = `${servantEndpoint}?${version}`;

  return axios.get(endpoint)
    .then((response) => response.data)
    .then((data) => {
      return data.map((datum) => {
        const rating = datum.stars.split(" ")[0]; // ex: 4 <span ...>
        const $ = cheerio.load(datum.title);
        const name = $("a").text().trim(); // should be only one anchor tag
        return {
          name,
          field: datum.field_class,
          servantId: datum.servant_id,
          release: datum.release_status,
          rating
        };
      })
    })
    .then((data) => {
      jsonfile.writeFileSync(`${createFileName(version, "basic")}`, data, {spaces: 2});
      return data;
    })
    .then((data) => {
      return Promise.all(data.map((datum, index) => {
        console.log(`${index} / ${data.length - 1} ${datum.name}`);
        if (index % 10 === 0) {
          sleep.sleep(1);
        }
        return getServantStats(datum);
      }));
    })
    .then((data) => {
      jsonfile.writeFileSync(createFileName(version, "stat"), data, {spaces: 2});
      return data;
    });
}

/**
 *  Get the version of data from gamepress.
 *
 *  @param  {[String]} version Numerical string (e.x. "v20")
 *  @return {[Array]}          Servant datum
 */
const getServantData = (version) => {
  const filename = createFileName(version, "stat");
  let fetchTask;
  if (fs.existsSync(filename)) {
    console.log("reading cached data");
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
    fetchTask = fetchServantData(version);
  }

  return fetchTask;
};

/**
 *  Go through existing data and fetch missing stats.
 *  In case of connection timeout, any datum will have a stats field with
 *  value "error".
 *
 *  @param  {[Array]} data Array of servant datum
 *  @return {[Array]}      Array of servant datum
 */
const comb = (data) => {
  const missingStats = data.filter((datum) => datum.stats === "error");
  if (missingStats.length > 0) {
    return comb(data.map((datum, index) => {
      if (datum.error === "error") {
        console.log(`fixing ${index} / ${datum.length - 1} ${datum.name}`);
        return getServantStats(datum);
      } else {
        return Promise.resolve(datum);
      }
    }));
  }
  return data;
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
 */
const currentVersion = "v20";
dataDirPromise
  .then((success) => getServantData(currentVersion))
  .then(comb)
  .then((data) => jsonfile.writeFileSync(createFileName(currentVersion, "comb"), data, {spaces: 2}))
  .then(() => console.log(`Version ${currentVersion} data collected`));

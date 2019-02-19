const axios = require("axios");
const generalEndpoint = "https://gamepress.gg/json-list?_format=json&game_tid=26&1550536807693"

/**
 * Given a keyword to fetch a url for using Gamepress's generalized URL mapping endpoint,
 * this function will return the corresponding value. It is up to the user to catch
 * any promise errors.
 * 
 * @param {String} keyword 
 * @returns Promise(String)
 */
const fetchEndpointFor = (keyword) => {
    return axios.get(generalEndpoint)
      .then((response) => response.data)
      .then((data) => data.find((item) => item.title === keyword))
      .then((item) => item.url);
}

module.exports = fetchEndpointFor;

const axios = require("axios");
const generalEndpoint = "https://gamepress.gg/json-list?_format=json&game_tid=26&1550536807693"

const fetchEndpointFor = (keyword) => {
    return axios.get(generalEndpoint)
      .then((response) => response.data)
      .then((data) => data.find((item) => item.title === keyword))
      .then((item) => item.url);
}

module.exports = fetchEndpointFor;

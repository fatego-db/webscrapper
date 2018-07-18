const fs = require("fs");
const mkdirp = require("mkdirp");
const path = require("path");

class SetupProcessor {
  constructor(dataDir) {
    this.dataDir = dataDir;

    this.process = this.process.bind(this);
  }
  process() {
    return new Promise((resolve, reject) => {
      mkdirp(this.dataDir, (error) => {
        if (error) {
          console.error("failed to setup data directory");
          reject();
        } else {
          console.log(`setup ${this.dataDir}`);
          resolve();
        }
      });
    });
  }
}

module.exports = SetupProcessor;

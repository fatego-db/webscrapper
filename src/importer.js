require("dotenv").config();
const MongoClient = require("mongodb").MongoClient;
const path = require("path");
const jsonfile = require("jsonfile");

const url = process.env.MONGO_URI;

const currentVersion = process.env.VERSION;
const data = jsonfile.readFileSync(path.join(__dirname, "..", "data", `servants_${currentVersion}.clean.json`));

MongoClient.connect(url, {useNewUrlParser: true}, (error, client) => {
  if (error) {
    console.error(`failed to connect ${error.message}`);
    return;
  }
  console.log("connection success");

  const db = client.db("fatego-db");
  const servants = db.collection("servants");

  data.forEach((datum) => {
    servants.findOneAndUpdate({servantId: datum.servantId}, {$set: datum}, {upsert: true}, (error, result) => {
      if (error) {
        console.error(`failed to add ${datum.name} : ${error.message}`);
      } else {
        console.log(`insert success ${datum.name}`);
      }
    });
  });

  client.close();
});

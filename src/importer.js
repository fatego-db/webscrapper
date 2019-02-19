require("dotenv").config();
const MongoClient = require("mongodb").MongoClient;
const path = require("path");
const jsonfile = require("jsonfile");

const url = process.env.MONGO_URI;

const servantData = jsonfile.readFileSync(path.join(__dirname, "..", "data",
  `servants.clean.json`));
const skillData = jsonfile.readFileSync(path.join(__dirname, "..", "data",
  `skills.clean.json`));

const constructInsertHandler = (operation, datum) => {
  return (error, result) => {
    if (error) {
      console.error(`[${operation}] failed to add ${datum.name} : ${error.message}`);
    } else {
      console.log(`[${operation}] insert success ${datum.name}`);
    }
  }
};

const insertCollection = (data, operation, filterGen, mongoCollection) => {
  data.forEach((datum) => {
    mongoCollection.findOneAndUpdate(filterGen(datum),
                                     {$set: datum},
                                     {upsert: true},
                                     constructInsertHandler(operation, datum));
  });
};

MongoClient.connect(url, {useNewUrlParser: true}, (error, client) => {
  if (error) {
    console.error(`failed to connect ${error.message}`);
    return;
  }
  console.log("connection success");

  const db = client.db("fatego-db");

  const servantsCollection = db.collection("servants");
  insertCollection(servantData,
                   "servants",
                   (servant) => { return {servantId: servant.servantId} },
                   servantsCollection);

  const skillsCollection = db.collection("skills");
  insertCollection(skillData,
                   "skills",
                   (skill) => { return {name: skill.name} },
                   skillsCollection);

  client.close();
});

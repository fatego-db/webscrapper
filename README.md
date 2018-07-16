# Fate Go Web Scrapper
A node based FateGo for Gamepress. It does hit the server pretty relentlessly
so please use sparingly. If there are any errors (i.e. connection timeout),
the scrapper attempts to regularly cache results and fix them up towards
completion.

## Usage:
Create a `.env`
```
MONGO_URI=mongodb://<username>:<password>@<endpoint>:<port>/<db>
VERSION=v<number>
```

### Scrape
```
npm run scrape
yarn scrape
```

### Import
```
npm run importdb
yarn importdb
```

**Note** `VERSION` must be prefixed by the character `v`.

## Features
1. Servants
   - [x] name
   - [x] class
   - [x] servantId
   - [x] release
   - [x] rating
   - [x] attack stat growth
   - [x] hp stat growth
   - [ ] active skills
   - [ ] passive skills
2. Craft Essence
   - [ ] name
   - [ ] effects
3. Skills
   - [ ] name
   - [ ] effects
   - [ ] growth
4. Materials
   - [ ] name
   - [ ] farm location

/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
const { parse } = require('json2csv');
const fetch = require('node-fetch');
const fs = require('fs');
const { RateLimit } = require('async-sema');
const cheerio = require('cheerio');

// configure a limit of maximum 10 requests / second
const limit = RateLimit(20);
const DOMAIN_PREFIX = 'https://www.militarycampgrounds.us';
const LIST_URL = `${DOMAIN_PREFIX}/index.php?option=com_jreviews&format=ajax&url=maps_payload%2Fpayload&order=featured&init=1&referrer=module-517`;

class MilitaryCampgrounds {
  /**
   * Gets the list of the military campgrounds
   *
   * @return  {Object}
   */
  static async getList() {
    const payload = await fetch(LIST_URL);
    const json = await payload.json();
    return json;
  }

  /**
   * Converts the campground list json to csv format and returns it.
   *
   * @return  {String}
   */
  static convertToCSV(payload) {
    const csv = parse(payload, { ...Object.keys(payload[0]) });
    return csv;
  }

  /**
   * Writes the csv to disk
   *
   * @param   {[type]}  csv  [csv description]
   *
   * @return  {[type]}       [return description]
   */
  static export(csv) {
    fs.writeFile('./military-campgrounds.csv', csv, (err) => {
      if (err) {
        console.error(err);
      }
      // file written successfully
    });
  }

  /**
   * Transforms payload to add/modify/remove any information
   *
   * @param   {Array}  payload  [payload description]
   *
   * @return  {[type]}           [return description]
   */
  static transform(payload) {
    return payload.map((obj) => ({
      ...obj,
      url: `${DOMAIN_PREFIX}/${obj.url}`,
      imageUrl: `${DOMAIN_PREFIX}/${obj.imageUrl}`,
    }));
  }

  /**
   * Makes a request to the details page for each campground returned from
   * getList which gets more details for each campground.
   *
   * @param   {[type]}  campgrounds  [campgrounds description]
   *
   * @return  {[type]}               [return description]
   */
  static async getDetailsForCampgrounds(campgrounds) {
    for (const campground of campgrounds) {
      await limit();
      console.log('Fetching details for', `${DOMAIN_PREFIX}/${campground.url}`);
      const response = await fetch(`${DOMAIN_PREFIX}/${campground.url}`);
      const $ = cheerio.load(await response.text());
      $('.jrFieldLabel').each((i, elem) => {
        const label = $(elem).text();
        const value = $(elem).next().text();
        campground[label] = value;
      });
    }
    return campgrounds;
  }

  /**
   * Entry point
   *
   * @return  {[type]}  [return description]
   */
  static async execute() {
    const { payload } = await MilitaryCampgrounds.getList();
    const addedDetailsPayload = await MilitaryCampgrounds.getDetailsForCampgrounds(payload);
    const finalPayload = MilitaryCampgrounds.transform(addedDetailsPayload);
    const csv = MilitaryCampgrounds.convertToCSV(finalPayload);
    MilitaryCampgrounds.export(csv);
  }
}

MilitaryCampgrounds.execute();

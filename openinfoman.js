'use strict'

const request = require('request')
const URI = require('urijs')
const utils = require('./utils')

// openinfoman object factory function
module.exports = function (cnf) {
  const config = cnf

  return {
    /**
    * fetchAllEntities - fetches all entities in a particular CSD document and
    * callsback with the full CSD document.
    *
    * @param {Function} callback The callback takes the form of
    * callback(err, result, orchestrations).
    */
    fetchAllEntities: function (callback) {
      let uri = new URI(config.url)
        .segment('/CSD/csr/')
        .segment(config.queryDocument)
        .segment('/urn:ihe:iti:csd:2014:stored-function:provider-search')

      var options = {
        url: uri.toString(),
        headers: {
          'Content-Type': 'text/xml'
        },
        body: `<csd:requestParams xmlns:csd="urn:ihe:iti:csd:2013">
        </csd:requestParams>`
      }

      let before = new Date()

      request.post(options, function (err, res, body) {
        if (err) {
          return callback(err)
        }
        callback(null, body, [utils.buildOrchestration('OpenInfoMan fetch all entities', before, res, body)])
      })
    }
  }
}

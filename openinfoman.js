'use strict'

const http = require('http')
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
      var options = {
        hostname: config.host,
        port: config.port,
        path: config.path,
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml'
        }
      }

      let before = new Date()

      let req = http.request(options, function (res) {
        let body = ''
        res.on('data', function (chunk) {
          body += chunk.toString()
        })
        res.on('end', function () {
          callback(null, body, [utils.buildOrchestration('OpenInfoMan fetch all entities', before, res, body)])
        })
      })

      req.on('error', function (err) {
        callback(err)
      })

      let body = `<csd:requestParams xmlns:csd="urn:ihe:iti:csd:2013">
                  </csd:requestParams>`

      req.write(body)
      req.end()
    }
  }
}

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
    fetchAllEntities: function (last_sync,reset,callback) {
      let uri = new URI(config.url)
        .segment('/CSD/csr/')
        .segment(config.queryDocument)
        .segment('careServicesRequest')
        .segment('/urn:ihe:iti:csd:2014:stored-function:provider-search')

      if(reset) {
        var record = '<csd:record updated="1970-01-01T00:00:00"/>'
      }
      else
        var record = '<csd:record updated="' + last_sync +'"/>'
      var options = {
        url: uri.toString(),
        headers: {
          'Content-Type': 'text/xml'
        },
        body: `<csd:requestParams xmlns:csd="urn:ihe:iti:csd:2013">
                ${record}
                </csd:requestParams>`
      }

      let before = new Date()
      request.post(options, function (err, res, body) {
        if (err) {
          return callback(err)
        }
        callback(null, body, [utils.buildOrchestration('OpenInfoMan fetch all entities', before, 'POST', options.url, options.body, res, body)])
      })
    },

    /**
     * loadProviderDirectory - loads a complete provider directory into OpenInfoMan.
     * Note that this will clear any existing data in the directory and then load the new contents.
     *
     * @param {Array} providers a string array containing the xml provider entities
     * @param {Function} callback (err, orchestrations)
     */
    loadProviderDirectory: function (providers, callback) {
      let orchestrations = []

      let emptyDirectoryURI = new URI(config.url)
        .segment('/CSD/emptyDirectory/')
        .segment(config.rapidProDocument)

      let before = new Date()

      request.get(emptyDirectoryURI.toString(), (err, res, body) => {
        if (err) {
          return callback(err)
        }
        orchestrations.push(utils.buildOrchestration('OpenInfoMan clear RapidPro directory', before, 'GET', emptyDirectoryURI.toString(), null, res, body))

        let updateURI = new URI(config.url)
          .segment('/CSD/csr/')
          .segment(config.rapidProDocument)
          .segment('/careServicesRequest/update/urn:openhie.org:openinfoman:provider_create')

        var options = {
          url: updateURI.toString(),
          headers: {
            'Content-Type': 'text/xml'
          },
          body: `<requestParams xmlns="urn:ihe:iti:csd:2013" xmlns:csd="urn:ihe:iti:csd:2013">
            ${providers.join('\n')}
          </requestParams>`
        }

        before = new Date()

        request.post(options, (err, res, body) => {
          if (err) {
            return callback(err)
          }

          orchestrations.push(utils.buildOrchestration('OpenInfoMan load RapidPro directory', before, 'POST', options.url, options.body, res, body))
          callback(null, orchestrations)
        })
      })
    }
  }
}

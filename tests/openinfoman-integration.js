'use strict'

const Openinfoman = require('../openinfoman')
const tap = require('tap')
const xpath = require('xpath')
const Dom = require('xmldom').DOMParser
const csdServer = require('./test-csd-server')

const openinfoman = Openinfoman({
  path: '/CSD/csr/CSD-Providers-Connectathon-20150120/careServicesRequest/urn:ihe:iti:csd:2014:stored-function:provider-search',
  port: 8984,
  host: 'localhost'
})

tap.test('openinfoman module', (t) => {
  csdServer.start(() => {
    openinfoman.fetchAllEntities((err, result) => {
      if (err) {
        console.error(err.stack)
      }
      t.ok(result, 'the result should be instanciated')
      const doc = new Dom().parseFromString(result)
      const select = xpath.useNamespaces({'csd': 'urn:ihe:iti:csd:2013'})
      const count = select('count(//csd:CSD/csd:providerDirectory/csd:provider)', doc)
      t.equal(count, 2, 'two provider should exist in the result')
      csdServer.stop(() => {
        t.end()
      })
    })
  })
})

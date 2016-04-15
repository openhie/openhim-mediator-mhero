'use strict'

const Openinfoman = require('../openinfoman')
const tap = require('tap')
const xpath = require('xpath')
const Dom = require('xmldom').DOMParser
const csdServer = require('./test-csd-server')

// don't log during tests - comment these out for debugging
console.log = () => {}
console.error = () => {}

const openinfoman = Openinfoman({
  path: '/CSD/csr/CSD-Providers-Connectathon-20150120/careServicesRequest/urn:ihe:iti:csd:2014:stored-function:provider-search',
  port: 8984,
  host: 'localhost'
})

tap.test('openinfoman.fetchAllEntities should fetch all entries', (t) => {
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

tap.test('openinfoman.fetchAllEntities should error if the CSD server couldn\'t be contacted', (t) => {
  openinfoman.fetchAllEntities((err, result) => {
    t.ok(err, 'error should be set')
    t.end()
  })
})

tap.test('openinfoman.fetchAllEntities should add return a single orchestration', (t) => {
  csdServer.start(() => {
    openinfoman.fetchAllEntities((err, result, orchestrations) => {
      t.error(err, 'should not error')
      t.ok(orchestrations, 'orchestrations should be set')
      t.equals(orchestrations.length, 1, 'there should only be one orchestration')
      t.equals(orchestrations[0].name, 'OpenInfoMan fetch all entities')
      t.ok(orchestrations[0].request)
      t.ok(orchestrations[0].response)
      t.equal(200, orchestrations[0].response.status, 'response status should be captured correctly')
      csdServer.stop(() => {
        t.end()
      })
    })
  })
})

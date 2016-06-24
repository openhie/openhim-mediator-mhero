'use strict'

const Openinfoman = require('../openinfoman')
const tap = require('tap')
const xpath = require('xpath')
const Dom = require('xmldom').DOMParser
const winston = require('winston')
const csdServer = require('./test-csd-server')

const openinfoman = Openinfoman({
  url: 'http://localhost:8984',
  queryDocument: 'Providers',
  rapidProDocument: 'RapidProContacts'
})

tap.test('openinfoman.fetchAllEntities should fetch all entries', (t) => {
  csdServer.start(() => {
    openinfoman.fetchAllEntities((err, result) => {
      if (err) {
        winston.info.error(err.stack)
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

const testProviders = [
  `<provider entityID="urn:uuid:20258004-a149-4225-975b-5f64b14910dc">
    <demographic>
      <name>
        <commonName>Provider One</commonName>
      </name>
    </demographic>
  </provider>`,
  `<provider entityID="urn:uuid:5e971a37-bed4-4204-b662-ef8b4fcec5f2">
    <demographic>
      <name>
        <commonName>Provider Two</commonName>
      </name>
    </demographic>
  </provider>`
]

tap.test('openinfoman.loadProviderDirectory should add two orchestrations', (t) => {
  csdServer.start(() => {
    openinfoman.loadProviderDirectory(testProviders, (err, orchestrations) => {
      t.error(err, 'should not error')
      t.ok(orchestrations, 'orchestrations should be set')
      t.equals(orchestrations.length, 2, 'there should only be two orchestrations')

      t.equals(orchestrations[0].name, 'OpenInfoMan clear RapidPro directory')
      t.ok(orchestrations[0].request)
      t.equals('GET', orchestrations[0].request.method)
      t.ok(orchestrations[0].response)
      t.equal(200, orchestrations[0].response.status, 'response status should be captured correctly')

      t.equals(orchestrations[1].name, 'OpenInfoMan load RapidPro directory')
      t.ok(orchestrations[1].request)
      t.equals('POST', orchestrations[1].request.method)
      t.ok(orchestrations[1].response)
      t.equal(200, orchestrations[1].response.status, 'response status should be captured correctly')

      csdServer.stop(() => {
        t.end()
      })
    })
  })
})

tap.test('openinfoman.loadProviderDirectory should build a valid CSD update request', (t) => {
  csdServer.start(() => {
    openinfoman.loadProviderDirectory(testProviders, (err, orchestrations) => {
      t.error(err, 'should not error')
      t.ok(orchestrations, 'orchestrations should be set')
      t.equals(orchestrations.length, 2, 'there should only be two orchestrations')

      t.ok(orchestrations[1].request.body)

      const doc = new Dom().parseFromString(orchestrations[1].request.body)
      const select = xpath.useNamespaces({'csd': 'urn:ihe:iti:csd:2013'})
      const providers = select('/csd:requestParams/csd:provider/@entityID', doc)
      t.equals(providers[0].value, 'urn:uuid:20258004-a149-4225-975b-5f64b14910dc')
      t.equals(providers[1].value, 'urn:uuid:5e971a37-bed4-4204-b662-ef8b4fcec5f2')

      csdServer.stop(() => {
        t.end()
      })
    })
  })
})

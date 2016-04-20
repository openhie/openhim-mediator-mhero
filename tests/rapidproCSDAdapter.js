'use strict'

const tap = require('tap')
const xpath = require('xpath')
const Dom = require('xmldom').DOMParser
const testServer = require('./test-rapidpro-server')

const RapidProCSDAdapter = require('../rapidproCSDAdapter.js')

// don't log during tests - comment these out for debugging
console.log = () => {}
console.error = () => {}

const adapter = RapidProCSDAdapter({
  rapidpro: { 
    url: 'http://localhost:6700',
    slug: 'http://localhost:6700',
    authtoken: '1234secret'
  }
})

const adapter_withGroup = RapidProCSDAdapter({
  rapidpro: {
    url: 'http://localhost:6700',
    slug: 'http://localhost:6700',
    authtoken: '1234secret',
    groupname: 'group-1'
  }
})

let testEntityID = (t, xml, expected) => {
  let doc = new Dom().parseFromString(xml)
  let entityID = xpath.select1('/provider/@entityID', doc)
  t.ok(entityID.value)
  t.equals(entityID.value, expected, `XML should contain a provider with entity ID`)
}

tap.test('rapidproCSDAdapter.getContactsAsCSDEntities should fetch contacts and convert each entry', (t) => {
  testServer.start(6700, testServer.testResponses.testRapidProResponse, (server) => {
    adapter.getRapidProContactsAsCSDEntities((err, results, orchestrations) => {
      t.error(err)
      t.ok(results)

      if (results) {
        t.equal(2, results.length)

        testEntityID(t, results[0], 'test-1')
        testEntityID(t, results[1], 'test-2')
      }

      server.close()
      t.end()
    })
  })
})

tap.test('rapidproCSDAdapter.getContactsAsCSDEntities should forward the orchestrations setup by getContacts', (t) => {
  testServer.start(6700, testServer.testResponses.testRapidProResponse, (server) => {
    adapter.getRapidProContactsAsCSDEntities((err, results, orchestrations) => {
      t.error(err)
      t.ok(orchestrations)

      if (orchestrations) {
        t.equal(1, orchestrations.length)
        t.ok(orchestrations[0])
        t.equals(orchestrations[0].name, 'RapidPro Fetch Contacts')
      }

      server.close()
      t.end()
    })
  })
})

tap.test('rapidproCSDAdapter.getContactsAsCSDEntities should filter by groupname', (t) => {
  testServer.start(6700, testServer.testResponses.testRapidProResponse, testServer.testRapidProResponse_groupSearch, (server) => {
    adapter_withGroup.getRapidProContactsAsCSDEntities((err, results, orchestrations) => {
      t.error(err)
      t.ok(results)

      if (results) {
        t.equal(2, results.length)
        testEntityID(t, results[0], 'test-1')
        testEntityID(t, results[1], 'test-2')
      }

      server.close()
      t.end()
    })
  })
})

tap.test('rapidproCSDAdapter.getContactsAsCSDEntities should return an error if groupname could not be resolved', (t) => {
  testServer.start(6700, testServer.testResponses.testRapidProResponse, testServer.testResponses.testRapidProResponse_noResults, (server) => {
    adapter_withGroup.getRapidProContactsAsCSDEntities((err, results, orchestrations) => {
      t.ok(err)
      server.close()
      t.end()
    })
  })
})

tap.test('rapidproCSDAdapter.getContactsAsCSDEntities should forward group search and contacts orchestrations', (t) => {
  testServer.start(6700, testServer.testResponses.testRapidProResponse, testServer.testRapidProResponse_groupSearch, (server) => {
    adapter_withGroup.getRapidProContactsAsCSDEntities((err, results, orchestrations) => {
      t.error(err)
      t.ok(orchestrations)

      if (orchestrations) {
        t.equal(2, orchestrations.length)
        t.equals(orchestrations[0].name, 'RapidPro Get Group UUID')
        t.equals(orchestrations[1].name, 'RapidPro Fetch Contacts')
      }

      server.close()
      t.end()
    })
  })
})
 
tap.test('rapidproCSDAdapter.getContactsAsCSDEntities should group contacts by globalid', (t) => {
  testServer.start(6700, testServer.testResponses.testRapidProResponse_multi, (server) => {
    adapter.getRapidProContactsAsCSDEntities((err, results, orchestrations) => {
      t.error(err)
      t.ok(results)

      if (results) {
        t.equal(2, results.length)

        // result[0] should contain a combine result
        let doc = new Dom().parseFromString(results[0])
        let names = xpath.select('/provider/demographic/name/commonName/text()', doc)
        t.equal(names.length, 2)
        t.equal(names[0].nodeValue, 'One Contact', 'First common name should be One Contact')
        t.equal(names[1].nodeValue, 'Contact One', 'Second common name should be Contact One')

        testEntityID(t, results[1], 'test-2')
      }

      server.close()
      t.end()
    })
  })
})

tap.test('rapidproCSDAdapter.convertContactToCSD should build a CSD provider string from a contact', (t) => {
  let result = adapter.convertRapidProContactToCSD('test-1', [testServer.testResponses.testRapidProResponse.results[0]])
  let doc = new Dom().parseFromString(result)

  let entityID = xpath.select1('/provider/@entityID', doc)
  t.ok(entityID)
  t.equal('test-1', entityID.value)

  let otherID = xpath.select1('/provider/otherID/text()', doc)
  t.ok(otherID)
  t.equal('86fe9d78-8c44-4815-ace7-5b4e0f5eadfb', otherID.nodeValue)

  let codedType = xpath.select1('/provider/codedType/@code', doc)
  t.ok(codedType)
  t.equal('036204f3-7967-44b5-964e-c64b961e7285', codedType.value)

  let commonName = xpath.select1('/provider/demographic/name/commonName/text()', doc)
  t.ok(commonName)
  t.equal('One Contact', commonName.nodeValue)

  let tel = xpath.select1('/provider/demographic/contactPoint/codedType/text()', doc)
  t.ok(tel)
  t.equal('27731234567', tel.nodeValue)

  t.end()
})

tap.test('rapidproCSDAdapter.convertContactToCSD should build a CSD provider string from multiple contacts', (t) => {
  let result = adapter.convertRapidProContactToCSD('test-1', [testServer.testResponses.testRapidProResponse_multi.results[0], testServer.testResponses.testRapidProResponse_multi.results[2]])
  let doc = new Dom().parseFromString(result)

  let entityID = xpath.select1('/provider/@entityID', doc)
  t.ok(entityID)
  t.equal('test-1', entityID.value)

  let otherID = xpath.select1('/provider/otherID/text()', doc)
  t.ok(otherID)
  t.equal('86fe9d78-8c44-4815-ace7-5b4e0f5eadfb,f3873a12-9e3d-485f-8d30-99fd221fc437', otherID.nodeValue)

  let codedType = xpath.select1('/provider/codedType/@code', doc)
  t.ok(codedType)
  t.equal('036204f3-7967-44b5-964e-c64b961e7285', codedType.value)

  let commonName = xpath.select('/provider/demographic/name/commonName/text()', doc)
  t.ok(commonName)
  t.equal(2, commonName.length)
  t.equal('One Contact', commonName[0].nodeValue)
  t.equal('Contact One', commonName[1].nodeValue)

  let tel = xpath.select('/provider/demographic/contactPoint/codedType/text()', doc)
  t.ok(tel)
  t.equal(2, tel.length)
  t.equal('27731234567', tel[0].nodeValue)
  t.equal('27732345678', tel[1].nodeValue)

  t.end()
})

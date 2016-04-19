'use strict'

const tap = require('tap')
const rewire = require('rewire')
const xpath = require('xpath')
const Dom = require('xmldom').DOMParser
const testServer = require('./test-rapidpro-server')

const RapidPro = require('../rapidpro.js')

// don't log during tests - comment these out for debugging
console.log = () => {}
console.error = () => {}

const rapidpro = RapidPro({
  url: 'http://localhost:6700',
  slug: 'http://localhost:6700',
  authtoken: '1234secret'
})

const rapidpro_withGroup = RapidPro({
  url: 'http://localhost:6700',
  slug: 'http://localhost:6700',
  authtoken: '1234secret',
  groupname: 'group-1'
})

tap.test('rapidpro.getContacts should fetch contacts', (t) => {
  testServer.start(6700, testServer.testResponses.testRapidProResponse, (server) => {
    rapidpro.getContacts(null, (err, contacts, orchestrations) => {
      t.error(err)
      t.ok(contacts)

      if (contacts) {
        t.equal(2, contacts.length)
        t.equal('86fe9d78-8c44-4815-ace7-5b4e0f5eadfb', contacts[0].uuid)
        t.equal('b1bddaa4-7461-4613-b35e-14a2eba7712d', contacts[1].uuid)
      }

      server.close()
      t.end()
    })
  })
})

tap.test('rapidpro.getContacts should respond with an error if server unavailable', (t) => {
  rapidpro.getContacts(null, (err, contacts, orchestrations) => {
    t.ok(err)
    t.end()
  })
})

tap.test('rapidpro.getContacts should add orchestrations', (t) => {
  testServer.start(6700, testServer.testResponses.testRapidProResponse, (server) => {
    rapidpro.getContacts(null, (err, contacts, orchestrations) => {
      t.error(err)
      t.ok(orchestrations)

      if (orchestrations) {
        t.equal(1, orchestrations.length)
        t.ok(orchestrations[0].request)
        t.ok(orchestrations[0].response)
        t.equal(200, orchestrations[0].response.status)
        t.equal('b1bddaa4-7461-4613-b35e-14a2eba7712d', contacts[1].uuid)
      }

      server.close()
      t.end()
    })
  })
})

tap.test('rapidpro.getGroupUUID should fetch a group', (t) => {
  testServer.start(6700, testServer.testResponses.testRapidProResponse_groupSearch, (server) => {
    rapidpro_withGroup.getGroupUUID((err, groupUUID, orchestrations) => {
      t.error(err)
      t.ok(groupUUID)

      if (groupUUID) {
        t.equal('036204f3-7967-44b5-964e-c64b961e7285', groupUUID)
      }

      server.close()
      t.end()
    })
  })
})

tap.test('rapidpro.getGroupUUID should respond with null value if no results', (t) => {
  testServer.start(6700, testServer.testResponses.testRapidProResponse_noResults, (server) => {
    rapidpro_withGroup.getGroupUUID((err, groupUUID, orchestrations) => {
      t.error(err)
      t.notOk(groupUUID)
      server.close()
      t.end()
    })
  })
})

tap.test('rapidpro.getContacts should filter out contacts that do not have a field.globalid', (t) => {
  testServer.start(6700, testServer.testResponses.testRapidProResponse_noGlobalId, (server) => {
    rapidpro.getContacts(null, (err, contacts, orchestrations) => {
      t.error(err)
      t.ok(contacts)

      if (contacts) {
        t.equal(1, contacts.length)
        t.equal('86fe9d78-8c44-4815-ace7-5b4e0f5eadfb', contacts[0].uuid)
      }

      server.close()
      t.end()
    })
  })
})

let testEntityID = (t, xml, expected) => {
  let doc = new Dom().parseFromString(xml)
  let entityID = xpath.select1('/provider/@entityID', doc)
  t.ok(entityID.value)
  t.equals(entityID.value, expected, `XML should contain a provider with entity ID`)
}

tap.test('rapidpro.getContactsAsCSDEntities should fetch contacts and convert each entry', (t) => {
  testServer.start(6700, testServer.testResponses.testRapidProResponse, (server) => {
    rapidpro.getContactsAsCSDEntities((err, results, orchestrations) => {
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

tap.test('rapidpro.getContactsAsCSDEntities should forward the orchestrations setup by getContacts', (t) => {
  testServer.start(6700, testServer.testResponses.testRapidProResponse, (server) => {
    rapidpro.getContactsAsCSDEntities((err, results, orchestrations) => {
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

tap.test('rapidpro.getContactsAsCSDEntities should filter by groupname', (t) => {
  testServer.start(6700, testServer.testResponses.testRapidProResponse, testServer.testRapidProResponse_groupSearch, (server) => {
    rapidpro_withGroup.getContactsAsCSDEntities((err, results, orchestrations) => {
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

tap.test('rapidpro.getContactsAsCSDEntities should return an error if groupname could not be resolved', (t) => {
  testServer.start(6700, testServer.testResponses.testRapidProResponse, testServer.testResponses.testRapidProResponse_noResults, (server) => {
    rapidpro_withGroup.getContactsAsCSDEntities((err, results, orchestrations) => {
      t.ok(err)
      server.close()
      t.end()
    })
  })
})

tap.test('rapidpro.getContactsAsCSDEntities should forward group search and contacts orchestrations', (t) => {
  testServer.start(6700, testServer.testResponses.testRapidProResponse, testServer.testRapidProResponse_groupSearch, (server) => {
    rapidpro_withGroup.getContactsAsCSDEntities((err, results, orchestrations) => {
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
 
tap.test('rapidpro.getContactsAsCSDEntities should group contacts by globalid', (t) => {
  testServer.start(6700, testServer.testResponses.testRapidProResponse_multi, (server) => {
    rapidpro.getContactsAsCSDEntities((err, results, orchestrations) => {
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

tap.test('rapidpro.convertContactToCSD should build a CSD provider string from a contact', (t) => {
  let result = rapidpro.convertContactToCSD('test-1', [testServer.testResponses.testRapidProResponse.results[0]])
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

tap.test('rapidpro.convertContactToCSD should build a CSD provider string from multiple contacts', (t) => {
  let result = rapidpro.convertContactToCSD('test-1', [testServer.testResponses.testRapidProResponse_multi.results[0], testServer.testResponses.testRapidProResponse_multi.results[2]])
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

tap.test('rapidpro.addContact should add a contact', (t) => {
  testServer.start(6700, testServer.testResponses.testRapidProResponse_addContactSuccess, 'POST', (server) => {
    rapidpro.addContact({
      name: 'Ben Haggerty',
      groups: [
        'Top 10 Artists'
      ],
      urns: [
        'tel:+250788123123'
      ]
    }, (err, contact) => {
      t.error(err, 'should not error')
      t.ok(contact, 'should recieve the contact object back')
      t.equals(contact.uuid, '09d23a05-47fe-11e4-bfe9-b8f6b119e9ab', 'contact should now have a uuid set')
      server.close()
      t.end()
    })
  })
})

tap.test('rapidpro.addContact should produce an orchestration', (t) => {
  testServer.start(6700, testServer.testResponses.testRapidProResponse_addContactSuccess, (server) => {
    rapidpro.addContact({
      name: 'Ben Haggerty',
      groups: [
        'Top 10 Artists'
      ],
      urns: [
        'tel:+250788123123'
      ]
    }, (err, contact, orchestrations) => {
      t.error(err, 'should not error')
      t.equals(orchestrations.length, 1, 'should return a single orchestration')
      t.equals(orchestrations[0].name, 'Add/Update RapidPro Contact', 'should have the correct name')
      server.close()
      t.end()
    })
  })
})

tap.test('rapidpro.addContact should error when no body is returned', (t) => {
  testServer.start(6700, null, (server) => {
    rapidpro.addContact({
      name: 'Ben Haggerty',
      groups: [
        'Top 10 Artists'
      ],
      urns: [
        'tel:+250788123123'
      ]
    }, (err, contact) => {
      t.ok(err, 'should error')
      t.equal(err.message, 'No body returned, the contact probably didn\'t get saved in RapidPro', 'should produce the correct error')
      server.close()
      t.end()
    })
  })
})

tap.test('rapidpro.addContact should error when uuid is not set from RapidPro', (t) => {
  testServer.start(6700, {}, (server) => {
    rapidpro.addContact({
      name: 'Ben Haggerty',
      groups: [
        'Top 10 Artists'
      ],
      urns: [
        'tel:+250788123123'
      ]
    }, (err, contact) => {
      t.ok(err, 'should error')
      t.equal(err.message, 'No uuid set in contact, it probably didn\'t get saved in RapidPro', 'should produce the correct error')
      server.close()
      t.end()
    })
  })
})

tap.test('rapidpro.addContact should error when a request error occurs', (t) => {
  rapidpro.addContact({
    name: 'Ben Haggerty',
    groups: [
      'Top 10 Artists'
    ],
    urns: [
      'tel:+250788123123'
    ]
  }, (err, contact) => {
    t.ok(err, 'should return an error')
    t.end()
  })
})

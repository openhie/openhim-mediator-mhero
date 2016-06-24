'use strict'

const tap = require('tap')
const testServer = require('./test-rapidpro-server')

const RapidPro = require('../rapidpro.js')

const rapidpro = RapidPro({
  url: 'http://localhost:6700',
  slug: 'http://localhost:6700',
  authtoken: '1234secret',
  logDetailedOrch: true
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
    rapidpro_withGroup.getGroupUUID('test', (err, groupUUID, orchestrations) => {
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
    rapidpro_withGroup.getGroupUUID('test', (err, groupUUID, orchestrations) => {
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

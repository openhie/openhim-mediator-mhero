'use strict'

const http = require('http')
const tap = require('tap')
const rewire = require('rewire')

const rapidpro = rewire('../rapidpro.js')

// don't log during tests - comment these out for debugging
// console.log = () => {}
console.error = () => {}

const mediatorConf = {
  rapidpro: {
    url: 'http://localhost:6700',
    slug: 'http://localhost:6700',
    authtoken: '1234secret'
  }
}

const testRapidProResponse = {
  count: 2,
  next: null,
  previous: null,
  results: [
    {
      uuid: '86fe9d78-8c44-4815-ace7-5b4e0f5eadfb',
      name: 'One Contact',
      language: null,
      group_uuids: ['036204f3-7967-44b5-964e-c64b961e7285'],
      urns: [ 'tel:27731234567' ],
      fields: {
        globalid: 'test-1'
      },
      blocked: false,
      failed: false,
      modified_on: '2016-03-17T15:16:52.215Z',
      phone: '',
      groups: []
    },
    {
      uuid: 'b1bddaa4-7461-4613-b35e-14a2eba7712d',
      name: 'Two Contact',
      language: null,
      group_uuids: ['036204f3-7967-44b5-964e-c64b961e7285'],
      urns: [ 'tel:27833450987' ],
      fields: {
        globalid: 'test-2'
      },
      blocked: false,
      failed: false,
      modified_on: '2016-03-17T14:07:50.623Z',
      phone: '',
      groups: []
    }
  ]
}

const testRapidProResponse_noGlobalId = {
  count: 2,
  next: null,
  previous: null,
  results: [
    {
      uuid: '86fe9d78-8c44-4815-ace7-5b4e0f5eadfb',
      name: 'One Contact',
      language: null,
      group_uuids: ['036204f3-7967-44b5-964e-c64b961e7285'],
      urns: [ 'tel:27731234567' ],
      fields: {
        globalid: 'test-1'
      },
      blocked: false,
      failed: false,
      modified_on: '2016-03-17T15:16:52.215Z',
      phone: '',
      groups: []
    },
    {
      uuid: 'b1bddaa4-7461-4613-b35e-14a2eba7712d',
      name: 'Two Contact',
      language: null,
      group_uuids: ['036204f3-7967-44b5-964e-c64b961e7285'],
      urns: [ 'tel:27833450987' ],
      fields: {
      },
      blocked: false,
      failed: false,
      modified_on: '2016-03-17T14:07:50.623Z',
      phone: '',
      groups: []
    }
  ]
}

// first and third entries share the same globalid
const testRapidProResponse_multi = {
  count: 3,
  next: null,
  previous: null,
  results: [
    {
      uuid: '86fe9d78-8c44-4815-ace7-5b4e0f5eadfb',
      name: 'One Contact',
      language: null,
      group_uuids: ['036204f3-7967-44b5-964e-c64b961e7285'],
      urns: [ 'tel:27731234567' ],
      fields: {
        globalid: 'test-1'
      },
      blocked: false,
      failed: false,
      modified_on: '2016-03-17T15:16:52.215Z',
      phone: '',
      groups: []
    },
    {
      uuid: 'b1bddaa4-7461-4613-b35e-14a2eba7712d',
      name: 'Two Contact',
      language: null,
      group_uuids: ['036204f3-7967-44b5-964e-c64b961e7285'],
      urns: [ 'tel:27833450987' ],
      fields: {
        globalid: 'test-2'
      },
      blocked: false,
      failed: false,
      modified_on: '2016-03-17T14:07:50.623Z',
      phone: '',
      groups: []
    },
    {
      uuid: 'f3873a12-9e3d-485f-8d30-99fd221fc437',
      name: 'Contact One',
      language: null,
      group_uuids: ['036204f3-7967-44b5-964e-c64b961e7285'],
      urns: [ 'tel:27732345678' ],
      fields: {
        globalid: 'test-1'
      },
      blocked: false,
      failed: false,
      modified_on: '2016-03-17T15:16:52.215Z',
      phone: '',
      groups: []
    }
  ]
}

function mockRapidPro (port, response, callback) {
  let server = http.createServer((req, res) => {
    res.end(JSON.stringify(response))
  })
  server.listen(port, () => callback(server))
}

tap.test('rapidpro.contactsURL should build up the url from a base url', (t) => {
  let contactsURL = rapidpro.__get__('contactsURL')
  t.equal(contactsURL('http://test:1234/base'), 'http://test:1234/base/api/v1/contacts.json')
  t.end()
})

tap.test('rapidpro.contactsURL should add group uuid param if supplied', (t) => {
  let contactsURL = rapidpro.__get__('contactsURL')
  t.equal(contactsURL('http://test', '1234'), 'http://test/api/v1/contacts.json?group_uuids=1234')
  t.end()
})

tap.test('rapidpro.contactsURL should handle trailing slashes correctly', (t) => {
  let contactsURL = rapidpro.__get__('contactsURL')
  t.equal(contactsURL('http://test:1234/base/'), 'http://test:1234/base/api/v1/contacts.json')
  t.end()
})

tap.test('rapidpro.groupsURL should build up the url from a base url', (t) => {
  let groupsURL = rapidpro.__get__('groupsURL')
  t.equal(groupsURL('http://test', 'group1'), 'http://test/api/v1/groups.json?name=group1')
  t.end()
})

tap.test('rapidpro.getContacts should fetch contacts', (t) => {
  mockRapidPro(6700, testRapidProResponse, (server) => {
    let getContacts = rapidpro.__get__('getContacts')
    getContacts(mediatorConf, null, (err, contacts, orchestrations) => {
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

tap.test('rapidpro.getContacts should add orchestrations', (t) => {
  mockRapidPro(6700, testRapidProResponse, (server) => {
    let getContacts = rapidpro.__get__('getContacts')
    getContacts(mediatorConf, null, (err, contacts, orchestrations) => {
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

tap.test('rapidpro.getContacts should filter out contacts that do not have a field.globalid', (t) => {
  mockRapidPro(6700, testRapidProResponse_noGlobalId, (server) => {
    let getContacts = rapidpro.__get__('getContacts')
    getContacts(mediatorConf, null, (err, contacts, orchestrations) => {
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

tap.test('rapidpro.getContactsAsCSDEntities should fetch contacts and convert each entry', (t) => {
  rapidpro.__with__({
    getContacts: (config, groupUUID, callback) => callback(null, testRapidProResponse.results, []),
    buildContactsByGlobalIDMap: (contacts) => {
      return {
        '86fe9d78-8c44-4815-ace7-5b4e0f5eadfb': [],
        'b1bddaa4-7461-4613-b35e-14a2eba7712d': []
      }
    },
    convertContactToCSD: (config, globalid, contacts) => `test ${globalid}`
  })(() => {
    rapidpro.getContactsAsCSDEntities(mediatorConf, (err, results, orchestrations) => {
      t.error(err)
      t.ok(results)

      if (t.results) {
        t.equal(2, results.length)
        // did getContactsAsCSDEntities call getContacts, buildContactsByGlobalIDMap and apply convertContactToCSD to each entry
        t.equal('test 86fe9d78-8c44-4815-ace7-5b4e0f5eadfb', results[0])
        t.equal('test b1bddaa4-7461-4613-b35e-14a2eba7712d', results[1])
      }

      t.end()
    })
  })
})

tap.test('rapidpro.getContactsAsCSDEntities should forward the orchestrations setup by getContacts', (t) => {
  rapidpro.__with__({
    getContacts: (config, groupUUID, callback) => callback(null, testRapidProResponse.results, [{data: 'test orch'}]),
    buildContactsByGlobalIDMap: (contacts) => {
      return {
        '86fe9d78-8c44-4815-ace7-5b4e0f5eadfb': [],
        'b1bddaa4-7461-4613-b35e-14a2eba7712d': []
      }
    },
    convertContactToCSD: (config, globalid, contacts) => `test ${globalid}`
  })(() => {
    rapidpro.getContactsAsCSDEntities(mediatorConf, (err, results, orchestrations) => {
      t.error(err)
      t.ok(orchestrations)

      if (t.orchestrations) {
        t.equal(1, orchestrations.length)
        t.ok(orchestrations[0])
        t.equal('test orch', orchestrations[0].data)
      }

      t.end()
    })
  })
})

tap.test('rapidpro.buildContactsByGlobalIDMap should group contacts by globalid', (t) => {
  let buildContactsByGlobalIDMap = rapidpro.__get__('buildContactsByGlobalIDMap')
  let result = buildContactsByGlobalIDMap(testRapidProResponse_multi.results)
  t.ok(result)
  t.ok(result['test-1'])
  t.ok(result['test-2'])
  t.equal(2, result['test-1'].length)
  t.equal('86fe9d78-8c44-4815-ace7-5b4e0f5eadfb', result['test-1'][0].uuid)
  t.equal('f3873a12-9e3d-485f-8d30-99fd221fc437', result['test-1'][1].uuid)
  t.equal(1, result['test-2'].length)
  t.equal('b1bddaa4-7461-4613-b35e-14a2eba7712d', result['test-2'][0].uuid)
  t.end()
})

tap.test('rapidpro.convertContactToCSD should build a CSD provider string from a contact', (t) => {
  let convertContactToCSD = rapidpro.__get__('convertContactToCSD')
  let result = convertContactToCSD(mediatorConf, 'test-1', [testRapidProResponse.results[0]])
  // TODO
  console.log(result)
  t.end()
})

tap.test('rapidpro.convertContactToCSD should build a CSD provider string from multiple contacts', (t) => {
  let convertContactToCSD = rapidpro.__get__('convertContactToCSD')
  let result = convertContactToCSD(mediatorConf, 'test-1', [testRapidProResponse_multi.results[0], testRapidProResponse_multi.results[2]])
  // TODO
  console.log(result)
  t.end()
})

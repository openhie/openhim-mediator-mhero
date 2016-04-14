'use strict'

const http = require('http')
const tap = require('tap')
const rewire = require('rewire')

const index = rewire('../index.js')
const rapidpro = rewire('../rapidpro.js')

// don't log during tests - comment these out for debugging
console.log = () => {}
console.error = () => {}

tap.test('some unit test', (t) => {
  index.__get__('setupServer') // fetch some non-exported function that you need
  const actual = 1
  const expected = 1
  t.equal(actual, expected, 'actual should equal the expected')
  t.end()
})

tap.test('rapidpro.contactsURL should build up the url from a base url', (t) => {
  let contactsURL = rapidpro.__get__('contactsURL')
  t.equal(contactsURL('http://test'), 'http://test/api/v1/contacts.json')
  t.end()
})

tap.test('rapidpro.contactsURL should handle trailing slashes correctly', (t) => {
  let contactsURL = rapidpro.__get__('contactsURL')
  t.equal(contactsURL('http://test/'), 'http://test/api/v1/contacts.json')
  t.end()
})

const mediatorConf = {
  rapidpro: {
    url: 'http://localhost:6700',
    authtoken: '1234secret'
  }
}

function mockRapidPro (port, callback) {
  let server = http.createServer((req, res) => {
    res.end(JSON.stringify({
      count: 2,
      next: null,
      previous: null,
      results: [
        {
          uuid: '86fe9d78-8c44-4815-ace7-5b4e0f5eadfb',
          name: 'One Contact',
          language: null,
          group_uuids: [],
          urns: [ 'telegram:163628247' ],
          fields: {
            field1: 'value'
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
          group_uuids: [],
          urns: [ 'telegram:200092201' ],
          fields: {
            field1: 'demotest'
          },
          blocked: false,
          failed: false,
          modified_on: '2016-03-17T14:07:50.623Z',
          phone: '',
          groups: []
        }
      ]
    }))
  })
  server.listen(port, () => callback(server))
}

tap.test('rapidpro.getContacts should fetch contacts', (t) => {
  mockRapidPro(6700, (server) => {
    let getContacts = rapidpro.__get__('getContacts')
    getContacts(mediatorConf, (err, contacts, orchestrations) => {
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
  mockRapidPro(6700, (server) => {
    let getContacts = rapidpro.__get__('getContacts')
    getContacts(mediatorConf, (err, contacts, orchestrations) => {
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

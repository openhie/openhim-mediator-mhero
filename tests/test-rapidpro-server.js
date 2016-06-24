#!/usr/bin/env node
'use strict'

const http = require('http')
const winston = require('winston')

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

const testRapidProResponse_groupSearch = {
  count: 1,
  next: null,
  previous: null,
  results: [
    {
      uuid: '036204f3-7967-44b5-964e-c64b961e7285',
      name: 'group-1'
    }
  ]
}

const testRapidProResponse_noResults = {
  count: 0,
  next: null,
  previous: null,
  results: [
  ]
}

const testRapidProResponse_addContactSuccess = {
  uuid: '09d23a05-47fe-11e4-bfe9-b8f6b119e9ab',
  name: 'Ben Haggerty',
  groups: [
    'Top 10 Artists'
  ],
  urns: [
    'tel:+250788123123'
  ],
  blocked: false,
  failed: false
}

exports.testResponses = {
  testRapidProResponse: testRapidProResponse,
  testRapidProResponse_noGlobalId: testRapidProResponse_noGlobalId,
  testRapidProResponse_multi: testRapidProResponse_multi,
  testRapidProResponse_groupSearch: testRapidProResponse_groupSearch,
  testRapidProResponse_noResults: testRapidProResponse_noResults,
  testRapidProResponse_addContactSuccess: testRapidProResponse_addContactSuccess
}

/**
 * start - Starts the test server
 *
 * @param  {Number} port        eg. 6700
 * @param  {Object} responseDoc (optional) the doc to return on contact queries
 * @param  {Object} groupDoc    (optional) the doc to return on group queries
 * @param  {String} method      (optional) eg. 'POST'
 * @param  {Function} callback  (server) => {}
 */
function start (port, responseDoc, groupDoc, method, callback) {
  if (typeof groupDoc === 'function') {
    callback = groupDoc
    method = undefined
    groupDoc = undefined
  }
  if (typeof groupDoc === 'string') {
    callback = method
    method = groupDoc
  }
  if (typeof method === 'function') {
    callback = method
    method = undefined
  }

  let server = http.createServer((req, res) => {
    if (method && method !== req.method) {
      res.writeHead(400)
      res.end()
    }
    if (groupDoc && req.url.indexOf('groups') > -1) {
      res.end(JSON.stringify(groupDoc))
    } else if (responseDoc === 'dynamic') {
      if (req.method === 'GET') {
        res.end(JSON.stringify(testRapidProResponse))
      } else if (req.method === 'POST') {
        res.end(JSON.stringify(testRapidProResponse_addContactSuccess))
      }
    } else {
      res.end(JSON.stringify(responseDoc))
    }
  })
  server.listen(port, () => callback(server))
}
exports.start = start

if (!module.parent) {
  // if this script is run directly, start the server
  start(6700, 'dynamic', () => winston.info('Mock RapidPro Server listening on 6700...'))
}

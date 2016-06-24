'use strict'

const request = require('request')
const tap = require('tap')

const config = require('../config/config')
config.register = false
const mConfig = require('../config/mediator')
mConfig.config.rapidpro.groupname = 'test'
const csdServer = require('./test-csd-server')
const index = require('../index')
const rapidProServer = require('./test-rapidpro-server')

tap.test('full integration test', (t) => {
  csdServer.start(() => {
    rapidProServer.start(6700, 'dynamic', (rapidProServer) => {
      index.start((server) => {
        request('http://localhost:8544/sync', (err, res, body) => {
          t.error(err)
          t.equals(res.statusCode, 200, 'should return a 200 response code')
          server.close(() => {
            rapidProServer.close(() => {
              csdServer.stop(() => {
                t.end()
              })
            })
          })
        })
      })
    })
  })
})

tap.test('no RapidPro server', (t) => {
  csdServer.start(() => {
    index.start((server) => {
      request('http://localhost:8544/sync', (err, res, body) => {
        t.error(err)
        t.equals(res.statusCode, 500, 'should return a 500 response code')
        server.close(() => {
          csdServer.stop(() => {
            t.end()
          })
        })
      })
    })
  })
})

tap.test('no CSD server', (t) => {
  rapidProServer.start(6700, 'dynamic', (rapidProServer) => {
    index.start((server) => {
      request('http://localhost:8544/sync', (err, res, body) => {
        t.error(err)
        t.equals(res.statusCode, 500, 'should return a 500 response code')
        server.close(() => {
          rapidProServer.close(() => {
            t.end()
          })
        })
      })
    })
  })
})

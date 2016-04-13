#!/usr/bin/env node
'use strict'

const http = require('http')
const utils = require('openhim-mediator-utils')

// Config
var config = {} // this will vary depending on whats set in openhim-core
const apiConf = require('./config/config')
const mediatorConfig = require('./config/mediator')

/**
 * setupServer - configures the http server for this mediator
 *
 * @return {http.Server}  the configured http server
 */
function setupServer () {
  return http.createServer((req, res) => {
    console.log('Current config is:', config)
    res.writeHead(200)
    res.end()
  })
}

/**
 * start - starts the mediator
 *
 * @param  {Function} callback a node style callback that is called once the
 * server is started
 */
function start (callback) {
  if (apiConf.register) {
    utils.registerMediator(apiConf.api, mediatorConfig, (err) => {
      if (err) {
        console.log('Failed to register this mediator, check your config')
        console.log(err.stack)
        process.exit(1)
      }
      apiConf.api.urn = mediatorConfig.urn
      utils.fetchConfig(apiConf.api, (err, newConfig) => {
        console.log('Received initial config:')
        console.log(JSON.stringify(newConfig))
        config = newConfig
        if (err) {
          console.log('Failed to fetch initial config')
          console.log(err.stack)
          process.exit(1)
        } else {
          console.log('Successfully registered mediator!')
          let server = setupServer()
          server.listen(8544, () => {
            let configEmitter = utils.activateHeartbeat(apiConf.api)
            configEmitter.on('config', (newConfig) => {
              console.log('Received updated config:')
              console.log(JSON.stringify(newConfig))
              config = newConfig
            })
            callback(server)
          })
        }
      })
    })
  } else {
    // default to config from mediator registration
    config = mediatorConfig.config
    let server = setupServer()
    server.listen(8544, () => callback(server))
  }
}
exports.start = start

if (!module.parent) {
  // if this script is run directly, start the server
  start(() => console.log('Listening on 8544...'))
}

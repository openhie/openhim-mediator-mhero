#!/usr/bin/env node
'use strict'

const Dom = require('xmldom').DOMParser
const express = require('express')
const medUtils = require('openhim-mediator-utils')
const xpath = require('xpath')

const Openinfoman = require('./openinfoman')
const RapidPro = require('./rapidpro')
const RapidProCSDAdapter = require('./rapidproCSDAdapter.js')
const utils = require('./utils')

// Config
var config = {} // this will vary depending on whats set in openhim-core
const apiConf = require('./config/config')
const mediatorConfig = require('./config/mediator')

/**
 * setupApp - configures the http server for this mediator
 *
 * @return {express.App}  the configured http server
 */
function setupApp () {
  const app = express()

  app.get('/sync', (req, res) => {
    let orchestrations = []
    const openinfoman = Openinfoman(config.openinfoman)
    const rapidpro = RapidPro(config.rapidpro)
    const adapter = RapidProCSDAdapter(config)

    function reportFailure (err) {
      res.writeHead(500)
      console.error(err.stack)
      res.end(JSON.stringify({
        'x-mediator-urn': mediatorConfig.urn,
        status: 'Failed',
        response: {
          status: 500,
          body: err.stack,
          timestamp: new Date()
        },
        orchestrations: orchestrations
      }))
    }

    openinfoman.fetchAllEntities((err, csdDoc, orchs) => {
      orchestrations = orchestrations.concat(orchs)
      if (err) {
        return reportFailure(err)
      }
      if (!csdDoc) {
        return reportFailure(new Error('No CSD document returned'))
      }

      // extract each CSD entity for processing
      const doc = new Dom().parseFromString(csdDoc)
      const select = xpath.useNamespaces({'csd': 'urn:ihe:iti:csd:2013'})
      let entities = select('/csd:CSD/csd:providerDirectory/csd:provider', doc)
      entities = entities.map((entity) => entity.toString())
      let contacts = entities.map((entity) => {
        try {
          return utils.convertCSDToContact(entity)
        } catch (err) {
          console.warn('Warning: ' + err.message)
        }
      })

      new Promise((resolve, reject) => {
        if (config.rapidpro.groupname) {
          rapidpro.getGroupUUID(config.rapidpro.groupname, (err, groupUUID, orchs) => {
            orchestrations = orchestrations.concat(orchs)
            if (err) {
              reject(err)
            }
            resolve(groupUUID)
          })
        } else {
          resolve(null)
        }
      }).then((groupUUID) => {
        // add group to contacts
        if (groupUUID) {
          contacts = contacts.map((c) => {
            c.group_uuids = [groupUUID]
            return c
          })
        }

        // Add all contacts to RapidPro
        const promises = []
        contacts.forEach((contact) => {
          promises.push(new Promise((resolve, reject) => {
            rapidpro.addContact(contact, (err, contact, orchs) => {
              orchestrations = orchestrations.concat(orchs)
              if (err) {
                reject(err)
              }
              resolve()
            })
          }))
        })

        Promise.all(promises).then(() => {
          adapter.getRapidProContactsAsCSDEntities(groupUUID, (err, contacts, orchs) => {
            orchestrations = orchestrations.concat(orchs)
            if (err) {
              return reportFailure(err)
            }

            openinfoman.loadProviderDirectory(contacts, (err, orchs) => {
              orchestrations = orchestrations.concat(orchs)
              if (err) {
                return reportFailure(err)
              }

              res.writeHead(200, { 'Content-Type': 'application/json+openhim' })
              res.end(JSON.stringify({
                'x-mediator-urn': mediatorConfig.urn,
                status: 'Successful',
                response: {
                  status: 200,
                  timestamp: new Date()
                },
                orchestrations: orchestrations
              }))
            })
          })
        }, reportFailure)
      }, (err) => {
        return reportFailure(err)
      })
    })
  })
  return app
}

/**
 * start - starts the mediator
 *
 * @param  {Function} callback a node style callback that is called once the
 * server is started
 */
function start (callback) {
  if (apiConf.register) {
    medUtils.registerMediator(apiConf.api, mediatorConfig, (err) => {
      if (err) {
        console.log('Failed to register this mediator, check your config')
        console.log(err.stack)
        process.exit(1)
      }
      apiConf.api.urn = mediatorConfig.urn
      medUtils.fetchConfig(apiConf.api, (err, newConfig) => {
        console.log('Received initial config:')
        console.log(JSON.stringify(newConfig))
        config = newConfig
        if (err) {
          console.log('Failed to fetch initial config')
          console.log(err.stack)
          process.exit(1)
        } else {
          console.log('Successfully registered mediator!')
          let app = setupApp()
          const server = app.listen(8544, () => {
            let configEmitter = medUtils.activateHeartbeat(apiConf.api)
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
    let app = setupApp()
    const server = app.listen(8544, () => callback(server))
  }
}
exports.start = start

if (!module.parent) {
  // if this script is run directly, start the server
  start(() => console.log('Listening on 8544...'))
}

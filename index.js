#!/usr/bin/env node
'use strict'

const Dom = require('xmldom').DOMParser
const express = require('express')
const medUtils = require('openhim-mediator-utils')
const winston = require('winston')
const xpath = require('xpath')

const Openinfoman = require('./openinfoman')
const RapidPro = require('./rapidpro')
const RapidProCSDAdapter = require('./rapidproCSDAdapter')
const OpenHIM = require('./openhim')

// Config
var config = {} // this will vary depending on whats set in openhim-core
const apiConf = require('./config/config')
const mediatorConfig = require('./config/mediator')

// socket config - large documents can cause machine to max files open
const https = require('https')
const http = require('http')

https.globalAgent.maxSockets = 5
http.globalAgent.maxSockets = 5

// Logging setup
winston.remove(winston.transports.Console)
winston.add(winston.transports.Console, {level: 'info', timestamp: true, colorize: true})

/**
 * setupApp - configures the http server for this mediator
 *
 * @return {express.App}  the configured http server
 */
function setupApp () {
  const app = express()

  app.get('/sync', (req, res) => {
    req.timestamp = new Date()
    let orchestrations = []
    const openinfoman = Openinfoman(config.openinfoman)
    const rapidpro = RapidPro(config.rapidpro)
    const adapter = RapidProCSDAdapter(config)

    function reportFailure (err, req) {
      res.writeHead(500, { 'Content-Type': 'application/json+openhim' })
      winston.error(err.stack)
      winston.error('Something went wrong, relaying error to OpenHIM-core')
      let response = JSON.stringify({
        'x-mediator-urn': mediatorConfig.urn,
        status: 'Failed',
        request: {
          method: req.method,
          headers: req.headers,
          timestamp: req.timestamp,
          path: req.path
        },
        response: {
          status: 500,
          body: err.stack,
          timestamp: new Date()
        },
        orchestrations: orchestrations
      })
      res.end(response)
    }

    winston.info(`Fetching all providers from ${config.openinfoman.queryDocument}...`)
    openinfoman.fetchAllEntities((err, csdDoc, orchs) => {
      if (orchs) {
        orchestrations = orchestrations.concat(orchs)
      }
      if (err) {
        return reportFailure(err, req)
      }
      if (!csdDoc) {
        return reportFailure(new Error('No CSD document returned'), req)
      }
      winston.info('Done fetching providers.')

      // extract each CSD entity for processing
      const doc = new Dom().parseFromString(csdDoc)
      const select = xpath.useNamespaces({'csd': 'urn:ihe:iti:csd:2013'})
      let entities = select('/csd:CSD/csd:providerDirectory/csd:provider', doc)
      entities = entities.map((entity) => entity.toString())
      winston.info(`Converting ${entities.length} CSD entities to RapidPro contacts...`)
      let contacts = entities.map((entity) => {
        try {
          return adapter.convertCSDToContact(entity)
        } catch (err) {
          winston.warn(`${err.message}, skipping contact`)
          return null
        }
      }).filter((c) => {
        return c !== null
      })
      winston.info('Done converting to contacts.')

      new Promise((resolve, reject) => {
        if (config.rapidpro.groupname) {
          winston.info('Fetching group uuid for RapidPro...')
          rapidpro.getGroupUUID(config.rapidpro.groupname, (err, groupUUID, orchs) => {
            if (orchs) {
              orchestrations = orchestrations.concat(orchs)
            }
            if (err) {
              reject(err)
            }
            winston.info(`Done fetching group uuid - ${groupUUID}`)
            resolve(groupUUID)
          })
        } else {
          resolve(null)
        }
      }).then((groupUUID) => {
        // add group to contacts
        if (groupUUID) {
          winston.info('Adding group to each contact...')
          contacts = contacts.map((c) => {
            c.group_uuids = [groupUUID]
            return c
          })
          winston.info('Done adding group to contacts.')
        }

        // Add all contacts to RapidPro
        let errCount = 0
        winston.info(`Adding/Updating ${contacts.length} contacts to in RapidPro...`)
        const promises = []
        contacts.forEach((contact) => {
          promises.push(new Promise((resolve, reject) => {
            rapidpro.addContact(contact, (err, contact, orchs) => {
              if (orchs) {
                orchestrations = orchestrations.concat(orchs)
              }
              if (err) {
                winston.error(err)
                errCount++
              }
              resolve()
            })
          }))
        })

        Promise.all(promises).then(() => {
          winston.info(`Done adding/updating ${contacts.length} contacts to RapidPro, there were ${errCount} errors.`)
          winston.info('Fetching RapidPro contacts and converting them to CSD entities...')
          adapter.getRapidProContactsAsCSDEntities(groupUUID, (err, contacts, orchs) => {
            if (orchs) {
              orchestrations = orchestrations.concat(orchs)
            }
            if (err) {
              return reportFailure(err, req)
            }
            winston.info(`Done fetching and converting ${contacts.length} contacts.`)

            winston.info('Loading provider directory with contacts...')
            openinfoman.loadProviderDirectory(contacts, (err, orchs) => {
              if (orchs) {
                orchestrations = orchestrations.concat(orchs)
              }
              if (err) {
                return reportFailure(err, req)
              }
              winston.info('Done loading provider directory.')

              res.writeHead(200, { 'Content-Type': 'application/json+openhim' })
              res.end(JSON.stringify({
                'x-mediator-urn': mediatorConfig.urn,
                status: 'Successful',
                request: {
                  method: req.method,
                  headers: req.headers,
                  timestamp: req.timestamp,
                  path: req.path
                },
                response: {
                  status: 200,
                  timestamp: new Date()
                },
                orchestrations: orchestrations
              }))
            })
          })
        })
      }, (err) => {
        return reportFailure(err, req)
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
        winston.error('Failed to register this mediator, check your config')
        winston.error(err.stack)
        process.exit(1)
      }
      apiConf.api.urn = mediatorConfig.urn
      medUtils.fetchConfig(apiConf.api, (err, newConfig) => {
        winston.info('Received initial config:', newConfig)
        config = newConfig
        if (err) {
          winston.info('Failed to fetch initial config')
          winston.info(err.stack)
          process.exit(1)
        } else {
          winston.info('Successfully registered mediator!')
          let app = setupApp()
          const server = app.listen(8544, () => {
            let configEmitter = medUtils.activateHeartbeat(apiConf.api)
            configEmitter.on('config', (newConfig) => {
              winston.info('Received updated config:', newConfig)
              // set new config for mediator
              config = newConfig
              // edit iHRIS channel with new config
              const openhim = OpenHIM(apiConf.api)
              openhim.fetchChannelByName('AUTO - mHero - update OpenInfoMan from iHRIS', (err, channel) => {
                if (err) { return winston.error('Error: Unable to update iHRIS channel - ', err) }
                channel.routes[0].path = `/CSD/pollService/directory/${config.openinfoman.queryDocument}/update_cache`
                openhim.updateChannel(channel._id, channel, (err) => {
                  if (err) { return winston.info('Error: Unable to update iHRIS channel - ', err) }
                  winston.info('Updated iHRIS channel')
                })
              })
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
  start(() => winston.info('Listening on 8544...'))
}

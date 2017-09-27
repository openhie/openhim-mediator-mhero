#!/usr/bin/env node
/**
This mediator synchronises contactacts between OpenInfoMan and Rapidpro. It starts by creating contacts from OpenInfoMan to Rapidpro and then take all created contacts in rapidpro back to OpenInfoMan
If there is exist a contact in rapidpro that has the same globalid as the one we want to create from openInfoMan then the contact in rapidpro will be updated.
If there is another contact in rapidpro having one one of the phone numbers of the contact we want to create into rapidpro but this rapidpro contact has no any globalid then this rapidpro contact is updated.
If there is another contact in rapidpro having one one of the phone numbers of the contact we want to create into rapidpro but this rapidpro contact has a different globalid to what we want to create then this rapidpro contact is not going to be updated.
**/
'use strict'

const Dom = require('xmldom').DOMParser
const express = require('express')
const medUtils = require('openhim-mediator-utils')
const winston = require('winston')
const unique = require('array-unique');
const async = require('async')
const moment = require('moment')
const xpath = require('xpath')
const _ = require('underscore');
const fs = require('fs');
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

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

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
    const openhim = OpenHIM(apiConf.api)

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

    function search_rapidpro_by_urn(oim_cont,rapidpro_contacts,callback) {
      const promises = []
      var matched_cont = ""
      for(var uuid in rapidpro_contacts) {
        var rp_cont = rapidpro_contacts[uuid]
        promises.push(new Promise((resolve, reject) => {
          if(rp_cont.fields.globalid == null || rp_cont.fields.globalid == undefined || rp_cont.fields.globalid == ""){
            var intersection = _.intersection(oim_cont.urns,rp_cont.urns)
            if(intersection.length>0) {
              matched_cont = rp_cont
            }
            resolve()
          }
          else
          resolve()
        }))
      }

      Promise.all(promises).then(() => {
        callback(matched_cont)
      })
    }

    function extract_groupuuids (groups,callback) {
      var uuids = []
      async.eachSeries(groups,(group,nxtgrp)=>{
        uuids.push(group.uuid)
        nxtgrp()
      },function(){
        return callback(uuids)
      })
    }

    function merge_contacts(rapidpro_contact,oim_cont,groupUUID,callback) {
      var record = []
      var oim_urns = oim_cont.urns
      record = rapidpro_contact
      if(!record.hasOwnProperty("urns")) {
        record.urns = []
      }
      async.eachSeries(oim_urns,(oim_urn,nextUrn)=>{
        if(record.urns.indexOf(oim_urn) != -1) {
          return nextUrn()
        }
        record.urns.push(oim_urn)
        return nextUrn()

      },function(){
        record.fields.globalid = oim_cont.fields.globalid
        if(oim_cont.hasOwnProperty("name") && (rapidpro_contact.name==null||rapidpro_contact.name==undefined||rapidpro_contact.name=="")) {
          record.name = oim_cont.name
        }
        if(record.hasOwnProperty("groups")) {
          var groups = record.groups
          delete record.groups
        }
        extract_groupuuids(groups,(grp_uuids)=>{
          if(grp_uuids.length>0) {
            record.groups = []
            record.groups = grp_uuids
          }
          if (groupUUID) {
            if(!record.hasOwnProperty("groups"))
            record.groups = []
            record.groups.push(groupUUID)
          }
          if(record.hasOwnProperty("groups"))
          unique(record.groups)
          return callback(record)
        })
      })
    }

    function generate_contacts (openifoman_contacts,rapidpro_contacts,groupUUID,callback) {
      var records = []
      async.eachSeries(openifoman_contacts,(oim_cont,nextOIMCont)=>{
        if( !oim_cont.hasOwnProperty("fields") ||
            !oim_cont.fields.hasOwnProperty("globalid") ||
            !oim_cont.hasOwnProperty("urns") ||
            Object.keys(oim_cont.urns).length == 0
          ) {
          return nextOIMCont()
        }
        var globalid = oim_cont.fields.globalid
        if(!globalid) {
          return nextOIMCont()
        }
        var oim_urns = oim_cont.urns
        //if any of rapidpro cont has this globalid then merge with ihris contact
        if(rapidpro_contacts.hasOwnProperty(globalid)) {
          merge_contacts(rapidpro_contacts[globalid],oim_cont,groupUUID,(record)=>{
            records.push(record)
            return nextOIMCont()
          })
        }
        //if nothing mathes by globalid then try mathes by phone number
        else {
          search_rapidpro_by_urn(oim_cont,rapidpro_contacts,(matched_cont)=>{
            if(matched_cont.uuid != null && matched_cont.uuid != undefined && matched_cont.uuid != "") {
              merge_contacts(matched_cont,oim_cont,groupUUID,(record)=>{
                records.push(record)
                return nextOIMCont()
              })
            }
            else {
              var record = {"urns":oim_urns,"fields":{"globalid":globalid}}
              if(oim_cont.hasOwnProperty("name")) {
                record.name = oim_cont.name
              }
              if (groupUUID) {
                if(record.hasOwnProperty("groups"))
                record.groups.push(groupUUID)
                else {
                  record.groups = []
                  record.groups.push(groupUUID)
                }
              }
              records.push(record)
              return nextOIMCont()
            }
          })
        }

      },function(){
        callback(records)
      })
    }

    function edit_phone (contacts,callback) {
      //ensure all contacts starts with country code
      const promises = []
      contacts = contacts.map((c) => {
        for(var i=c.urns.length-1;i>=0;i--){
          var index = i
          var originalCont = c.urns[index]
          promises.push(new Promise((resolve, reject) => {
          //some contacts are grouped together using / i.e phone1/phone2
          var modifiedCont = originalCont.split("/").map((cont)=>{
            cont = cont.toString()
            cont = cont.trim()
            cont = cont.replace(/-/gi,"")
            cont = cont.replace(/ /g,'')
            var pos = cont.indexOf("+231")
            if(pos === -1) {
              if(cont.indexOf("tel:0") !== -1) {
                cont = cont.replace("tel:0","tel:+231")
              }
              else if(cont.indexOf("tel:8") !== -1) {
                cont = cont.replace("tel:8","tel:+2318")
              }
              else if(cont.indexOf("tel:7") !== -1) {
                cont = cont.replace("tel:7","tel:+2317")
              }
              else if(cont.indexOf("0") === 0) {
                cont = cont.replace("0","tel:+231")
              }
              else if(cont.indexOf("8") === 0) {
                cont = cont.replace("8","tel:+2318")
              }
              else if(cont.indexOf("7") === 0) {
                cont = cont.replace("7","tel:+2317")
              }
              else {
                winston.error("Unkown format of phone "+ cont)
              }
            }
            if(cont.length!=17) {
              fs.appendFile('wrongphone.csv', cont+ "," + c.fields.globalid + "\n", (err) => {
                if (err) throw err;
                return ""
              })
            }
            else
            return cont
          })
          if(modifiedCont.length === 1) {
            if(modifiedCont[0] == "" || modifiedCont[0] == null || modifiedCont[0] == undefined) {
              c.urns.splice(index,1)
            }
            else {
              c.urns[index] = modifiedCont[0]
              unique(c.urns);
            }
            resolve()
          }
          else {
            async.eachOfSeries(modifiedCont,(mod,index1,nextMod)=>{
              if(mod == "" || mod == null || mod == undefined) {
                if(index1 == 0)
                c.urns.splice(index,1)
                else {
                  var total = c.urns.length
                  c.urns.splice(total,1)
                }
                return nextMod()
              }
              if(index1 == 0)
              c.urns[index] = mod
              else {
                var total = c.urns.length
                c.urns[total] = mod
              }
              return nextMod()
            },function(){
              unique(c.urns);
              resolve()
            })
          }
        }))
        }
        return c
      })
      Promise.all(promises).then(() => {
        callback(contacts)
      })
    }

    winston.info(`Fetching all providers from ${config.openinfoman.queryDocument}...`)
    openinfoman.fetchAllEntities(config.sync.last_sync,config.sync.reset,(err, csdDoc, orchs) => {
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
      winston.info(`Converting ${entities.length} CSD entities to RapidPro contacts format...`)
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
      winston.info('Done converting Providers to rapidpro contact format.')

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
        let errCount = 0
        winston.info("Editing phone numbers")
        edit_phone(contacts,(contacts)=>{
          winston.info("Done editing phone numbers")
          winston.info("Getting Rapidpro Contacts")
          rapidpro.getContacts(false,false,false,(rp_contacts)=>{
            winston.info("Done getting Rapidpro Contacts")
            winston.info("Generating Contacts based on iHRIS and Rapidpro")
            generate_contacts(contacts,rp_contacts,groupUUID,(contacts)=>{
              winston.info("Done Generating Contacts based on iHRIS and Rapidpro")
              winston.info(`Adding/Updating ${contacts.length} contacts to in RapidPro...`)
              /*Rapidpro is limited to 2500 requests per hour,this means 1 req/1.44seconds for every 2500 requests
                Lets calculate the number of miliseconds to wait before processing the next contact
              **/
              var total_contacts = contacts.length
              var wait_time = total_contacts*1440/2500
              var counter = 0
              async.eachSeries(contacts,(contact,nextContact)=>{
                rapidpro.addContact(contact, (err, contact, orchs) => {
                  counter++
                  winston.info("Processed " + counter + "/" + total_contacts + " Contacts")
                  if (orchs) {
                    orchestrations = orchestrations.concat(orchs)
                  }
                  if (err) {
                    winston.error(err)
                    errCount++
                  }
                  return nextContact()
                })
              },function(){
                winston.info(`Done adding/updating ${contacts.length} contacts to RapidPro, there were ${errCount} errors.`)
                var now = moment().format("YYYY-MM-DDTHH:mm:ss")
                config.sync.last_sync = now
                config.sync.reset = false
                winston.info("Updating Last Sync")
                openhim.updateConfig(mediatorConfig.urn,config,(res)=>{
                  winston.info("Done Updating Last Sync")
                })
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
          const server = app.listen(8586, () => {
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
    const server = app.listen(8586, () => callback(server))
  }
}
exports.start = start

if (!module.parent) {
  // if this script is run directly, start the server
  start(() => winston.info('Listening on 8586...'))
}

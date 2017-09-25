'use strict'
const request = require('request')
const URI = require('urijs')
const utils = require('./utils')
const winston = require('winston')
const async = require('async')
const fs = require('fs');

module.exports = function (config) {
  const contactsURL = function (groupUUID) {
    let url = URI(config.url).segment('api/v2/contacts.json')
    if (groupUUID) {
      url = url.addQuery('group_uuids', groupUUID)
    }
    return url.toString()
  }

  const hasGlobalID = function (contact) {
    return contact.fields && contact.fields.globalid
  }

  const getGroupUUID = function (groupName, callback) {
    let url = URI(config.url)
      .segment('api/v2/groups.json')
      .addQuery('name', groupName)
      .toString()
    let before = new Date()

    let options = {
      url: url,
      headers: {
        Authorization: `Token ${config.authtoken}`
      }
    }

    request(options, (err, res, body) => {
      isThrottled(JSON.parse(body),(wasThrottled)=>{
        if(wasThrottled) {
          //reprocess this request
          getGroupUUID(groupName, (err, groupUUID, orchs) => {
            return callback(err,groupUUID,orchs)
          })
        }
        else{
          if (err) {
            callback(err)
            return
          }

          let orchestrations = [utils.buildOrchestration('RapidPro Get Group UUID', before, 'GET', options.url, null, res, body)]

          if (res.statusCode !== 200) {
            callback(new Error(`RapidPro responded with status ${res.statusCode}`), null, orchestrations)
            return
          }

          let results = JSON.parse(body).results
          if (!results || results.length === 0) {
            callback(null, null, orchestrations)
          } else {
            callback(null, results[0].uuid, orchestrations)
          }
        }
      })
    })
  }

  function isThrottled (results,callback) {
    if(results.hasOwnProperty("detail")) {
      var detail = results.detail.toLowerCase()
      if(detail.indexOf("throttled") != -1) {
        var detArr = detail.split(" ")
        async.eachSeries(detArr,(det,nxtDet)=>{
          if(!isNaN(det)) {
            //add 30 more seconds on top of the wait time expected by rapidpro then convert to miliseconds
            var wait_time = (parseInt(det) + 30)*1000
            winston.warn("Rapidpro has throttled my requests,i will wait for " + wait_time/1000 + " Seconds Before i proceed,please dont interrupt me")
            setTimeout(function() {
              return callback(true)
            }, wait_time)
          }
          else
            return nxtDet()
        },function(){
          return callback(false)
        })
      }
      else
      return callback(false)
    }
    else {
      callback(false)
    }
  }

  const getContacts = function(next,requireGlobalid,groupUUID,callback) {
    if(!next){
      var next = contactsURL(groupUUID)
    }
    //need to make this variable independent of this function so that to handle throttled
    winston.info(next)
    var contacts = {}
    async.doWhilst(
      function(callback) {
        let options = {
          url: next,
          headers: {
            Authorization: `Token ${config.authtoken}`
          }
        }
        request(options, (err, res, body) => {
          isThrottled(JSON.parse(body),(wasThrottled)=>{
            if(wasThrottled) {
              //reprocess this contact
              getContacts(next,requireGlobalid,groupUUID,(rp_contacts) => {
                next = false
                const promises = []
                for(var uuid in rp_contacts) {
                  promises.push(new Promise((resolve, reject) => {
                    contacts[uuid] = rp_contacts[uuid]
                    resolve()
                  }))
                }
                Promise.all(promises).then(() => {
                  return callback(false,false)
                })
              })
            }
            else {
              if (err) {
                callback(err)
                return
              }
              body = JSON.parse(body)
              if(!body.hasOwnProperty("results")) {
                winston.error(JSON.stringify(body))
                winston.error("An error occured while fetching contacts to rapidpro")
                return callback()
              }
              if(body.next)
                next = body.next
              else
                next = false
              async.eachSeries(body["results"],(contact,nextCont)=>{
                if( requireGlobalid &&
                    (
                      !contact.fields.hasOwnProperty("globalid") ||
                      contact.fields.globalid == null ||
                      contact.fields.globalid == undefined ||
                      contact.fields.globalid == ""
                    )
                  ) {
                    return nextCont()
                  }

                if( contact.fields.hasOwnProperty("globalid") &&
                    contact.fields.globalid != null &&
                    contact.fields.globalid != undefined &&
                    contact.fields.globalid != ""
                  ) {
                    contacts[contact.fields.globalid] = contact
                    return nextCont()
                }
                else {
                  contacts[contact.uuid] = contact
                  return nextCont()
                  }
              },function(){
                return callback(false,next)
              })
            }
          })
        })
      },
      function() {
        if(next)
        winston.info("Fetching In " + next)
        return (next!=false)
      },
      function() {
        return callback(contacts)
      }
    )
  }

  const addContact = function (contact, callback) {
    let url = contactsURL()
    if(contact.hasOwnProperty("uuid"))
    url = url + "?uuid=" + contact.uuid
    let before = new Date()

    let options = {
      url: url,
      headers: {
        Authorization: `Token ${config.authtoken}`
      },
      body: contact,
      json: true
    }
    request.post(options, (err, res, newContact) => {
      isThrottled(newContact,(wasThrottled)=>{
        if(wasThrottled) {
          //reprocess this contact
          addContact(contact, (err, newContact, orchs) => {
            return callback(err,newContact,orchs)
          })
        }
        else {
          if(!newContact.hasOwnProperty("uuid")) {
            winston.error("An error occured while adding contact " + JSON.stringify(contact) + JSON.stringify(contact))
            fs.appendFile('unprocessed.csv', JSON.stringify(contact) + "," + JSON.stringify(newContact) + "\n", (err) => {
              if (err) throw err;
              return ""
            })
          }
          else
          winston.info(newContact)
          if (err) {
            callback(err)
            return
          }

          let orchestrations = []
          if (config.logDetailedOrch) {
            orchestrations.push(utils.buildOrchestration('Add/Update RapidPro Contact', before, 'POST', options.url, JSON.stringify(contact), res, JSON.stringify(newContact)))
          }
          if (newContact) {
            if (newContact.uuid) {
              callback(null, newContact, orchestrations)
            } else {
        //winston.error('No uuid set in contact, it probably didn\'t get saved in RapidPro')
        callback(null, newContact, orchestrations)
            }
          } else {
            callback(new Error('No body returned, the contact probably didn\'t get saved in RapidPro'), null, orchestrations)
          }
        }
      })
    })
  }

  return {
    /**
     * getGroupUUID - query RapidPro for the UUID for the configured group name
     *
     * @param {String} groupName - the name of the group whose uuid we want to fetch
     * @param {Function} callback (err, groupUUID, orchestrations)
     */
    getGroupUUID: getGroupUUID,

    /**
    Gets all currently available contacts in rapidpro
    **/
    getContacts: getContacts,
    /**
     * addContact - Adds or updates a contact to RapidPro
     *
     * @param  {Object} contact  The contact object to add
     * @param  {Function} callback (err, contact, orchestrations)
     */
    addContact: addContact
  }
}

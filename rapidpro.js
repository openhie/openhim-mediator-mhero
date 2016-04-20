'use strict'
const request = require('request')
const URI = require('urijs')
const utils = require('./utils')

module.exports = function (config) {

  const contactsURL = function (groupUUID) {
    let url = URI(config.url).segment('api/v1/contacts.json')
    if (groupUUID) {
      url = url.addQuery('group_uuids', groupUUID)
    }
    return url.toString()
  }

  const hasGlobalID = function (contact) {
    return contact.fields && contact.fields.globalid
  }

  const getGroupUUID = function (callback) {
    let url = URI(config.url)
      .segment('api/v1/groups.json')
      .addQuery('name', config.groupname)
      .toString()
    let before = new Date()

    let options = {
      url: url,
      headers: {
        Authorization: `Token ${config.authtoken}`
      }
    }
    console.log(`Fetching group from ${url}`)

    request(options, (err, res, body) => {
      if (err) {
        callback(err)
        return
      }

      let orchestrations = [utils.buildOrchestration('RapidPro Get Group UUID', before, 'GET', null, res, body)]

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
    })
  }

  const getContacts = function (groupUUID, callback) {
    let url = contactsURL(groupUUID)
    let before = new Date()

    let options = {
      url: url,
      headers: {
        Authorization: `Token ${config.authtoken}`
      }
    }
    console.log(`Fetching contacts from ${url}`)

    request(options, (err, res, body) => {
      if (err) {
        callback(err)
        return
      }

      let orchestrations = [utils.buildOrchestration('RapidPro Fetch Contacts', before, 'GET', null, res, body)]

      if (res.statusCode !== 200) {
        callback(`RapidPro responded with status ${res.statusCode}`, null, orchestrations)
        return
      }

      let results = JSON.parse(body).results
      if (!results) {
        results = []
      }
      results = results.filter(hasGlobalID)

      callback(null, results, orchestrations)
    })
  }

  return {
    /**
     * getGroupUUID - query RapidPro for the UUID for the configured group name
     *
     * @param {Function} callback (err, groupUUID, orchestrations)
     */
    getGroupUUID: getGroupUUID,

    /**
     * getContacts - retrieves a list of contacts from RapidPro
     *
     * @param {String} groupUUID (nullable) a groupUUID to filter by
     * @param {Function} callback (err, contacts, orchestrations)
     */
    getContacts: getContacts,

    /**
     * addContact - Adds or updates a contact to RapidPro
     *
     * @param  {Object} contact  The contact object to add
     * @param  {Function} callback (err, contact, orchestrations)
     */
    addContact: function (contact, callback) {
      let url = contactsURL()
      let before = new Date()

      let options = {
        url: url,
        headers: {
          Authorization: `Token ${config.authtoken}`
        },
        body: contact,
        json: true
      }
      console.log(`Adding/Updating contact via ${url}`)

      request.post(options, (err, res, newContact) => {
        if (err) {
          callback(err)
          return
        }

        let orchestrations = [utils.buildOrchestration('Add/Update RapidPro Contact', before, 'GET', null, res, JSON.stringify(newContact))]

        if (newContact) {
          if (newContact.uuid) {
            callback(null, newContact, orchestrations)
          } else {
            callback(new Error('No uuid set in contact, it probably didn\'t get saved in RapidPro'), newContact, orchestrations)
          }
        } else {
          callback(new Error('No body returned, the contact probably didn\'t get saved in RapidPro'), null, orchestrations)
        }
      })
    }
  }
}

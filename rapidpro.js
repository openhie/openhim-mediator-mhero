'use strict'
const request = require('request')
const URI = require('urijs')
const _ = require('lodash')
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

  /**
   * buildContactsByGlobalIDMap - build a map that groups contacts by globalid
   *
   * @param  {Array} contacts an array of RapidPro contacts
   * @return {Object} a map with K: globalid and V: an array of contacts that share globalid
   */
  const buildContactsByGlobalIDMap = function (contacts) {
    let map = {}
    for (let contact of contacts) {
      if (!map[contact.fields.globalid]) {
        map[contact.fields.globalid] = []
      }
      map[contact.fields.globalid].push(contact)
    }
    return map
  }

  const convertContactToCSD = function (globalid, contacts) {
    let names = ''
    let groups = ''
    let telNums = ''

    let uniqFlatCompactByAttr = (attr) => _.uniq(_.flatten(_.compact(contacts.map((c) => c[attr]))))

    for (let name of uniqFlatCompactByAttr('name')) {
      names += `<commonName>${name}</commonName>\n`
    }

    for (let groupUUID of uniqFlatCompactByAttr('group_uuids')) {
      groups += `<codedType code="${groupUUID}" codingScheme="${config.url}"/>\n`
    }

    for (let urn of uniqFlatCompactByAttr('urns')) {
      if (urn.startsWith('tel:')) {
        telNums += `<contactPoint><codedType code="BP" codingScheme="urn:ihe:iti:csd:2013:contactPoint">${urn.replace('tel:', '')}</codedType></contactPoint>\n`
      }
    }

    return `
      <provider entityID="${globalid}">
        <otherID code="rapidpro_contact_id" assigningAuthorityName="{${config.url}}{${config.slug}}">${contacts.map((c) => c.uuid)}</otherID>
        ${groups}
        <demographic>
          <name>
            ${names}
          </name>
          ${telNums}
        </demographic>
      </provider>`
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
     * convertContactToCSD - convert a RapidPro contact into CSD
     *
     * @param  {String} globalid the contact's globalid
     * @param  {Array} contacts all rapidpro contacts that share the globalid
     * @return {String} the converted contact
     */
    convertContactToCSD: convertContactToCSD,

    /**
     * getContactsAsCSDEntities - retrieves a list of contacts from RapidPro
     * and converts them into CSD entities
     *
     * @param {Function} callback (err, contacts, orchestrations)
     */
    getContactsAsCSDEntities: function (callback) {
      let getContactsCallback = (_orchestrations) => (err, contacts, orchestrations) => {
        if (err) {
          callback(err, null, _orchestrations)
        } else {
          let contactsMap = buildContactsByGlobalIDMap(contacts)
          let converted = []

          for (let k in contactsMap) {
            converted.push(convertContactToCSD(k, contactsMap[k]))
          }

          callback(null, converted, _orchestrations.concat(orchestrations))
        }
      }

      if (config.groupname) {
        getGroupUUID((err, groupUUID, orchestrations) => {
          if (err) {
            callback(err)
          } else {
            if (groupUUID) {
              getContacts(groupUUID, getContactsCallback(orchestrations))
            } else {
              callback(new Error(`Configured group name '${config.groupname}' could not be resolved`), null, orchestrations)
            }
          }
        })
      } else {
        getContacts(null, getContactsCallback([]))
      }
    },

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

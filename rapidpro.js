'use strict'
const request = require('request')
const URI = require('urijs')
const _ = require('lodash')
const utils = require('./utils')

function contactsURL (baseURL, groupUUID) {
  let url = URI(baseURL).segment('api/v1/contacts.json')
  if (groupUUID) {
    url = url.addQuery('group_uuids', groupUUID)
  }
  return url.toString()
}

function groupsURL (baseURL, groupName) {
  return URI(baseURL)
    .segment('api/v1/groups.json')
    .addQuery('name', groupName)
    .toString()
}

function hasGlobalID (contact) {
  return contact.fields && contact.fields.globalid
}

/**
 * getGroupUUID - lookup the UUID for the configured group name
 *
 * @param {Object} config the dynamic mediator configuration
 * @param {Function} callback (err, groupUUID, orchestrations)
 */
function getGroupUUID (config, callback) {
  let url = groupsURL(config.rapidpro.url, config.rapidpro.groupname)
  let before = new Date()

  let options = {
    url: url,
    headers: {
      Authorization: `Token ${config.rapidpro.authtoken}`
    }
  }
  console.log(`Fetching group from ${url}`)

  request(options, (err, res, body) => {
    if (err) {
      callback(err)
      return
    }

    let orchestrations = [utils.buildOrchestration(before, res, body)]

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

/**
 * getContacts - retrieves a list of contacts from RapidPro
 *
 * @param {Object} config the dynamic mediator configuration
 * @param {String} groupUUID (nullable) a groupUUID to filter by
 * @param {Function} callback (err, contacts, orchestrations)
 */
function getContacts (config, groupUUID, callback) {
  let url = contactsURL(config.rapidpro.url)
  let before = new Date()

  let options = {
    url: url,
    headers: {
      Authorization: `Token ${config.rapidpro.authtoken}`
    }
  }
  console.log(`Fetching contacts from ${url}`)

  request(options, (err, res, body) => {
    if (err) {
      callback(err)
      return
    }

    let orchestrations = [utils.buildOrchestration('RapidPro Fetch Contacts', before, res, body)]

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
function buildContactsByGlobalIDMap (contacts) {
  let map = {}
  for (let contact of contacts) {
    if (!map[contact.fields.globalid]) {
      map[contact.fields.globalid] = []
    }
    map[contact.fields.globalid].push(contact)
  }
  return map
}

/**
 * convertContactToCSD - convert a RapidPro contact into CSD
 *
 * @param  {Object} config the dynamic mediator configuration
 * @param  {String} globalid the contact's globalid
 * @param  {Array} contacts all rapidpro contacts that share the globalid
 * @return {String} the converted contact
 */
function convertContactToCSD (config, globalid, contacts) {
  let names = ''
  let groups = ''
  let telNums = ''

  let uniqFlatCompactByAttr = (attr) => _.uniq(_.flatten(_.compact(contacts.map((c) => c[attr]))))

  for (let name of uniqFlatCompactByAttr('name')) {
    names += `<commonName>${name}</commonName>\n`
  }

  for (let groupUUID of uniqFlatCompactByAttr('group_uuids')) {
    groups += `<codedType code="${groupUUID}" codingScheme="${config.rapidpro.url}"/>\n`
  }

  for (let urn of uniqFlatCompactByAttr('urns')) {
    if (urn.startsWith('tel:')) {
      telNums += `<contactPoint><codedType code="BP" codingScheme="urn:ihe:iti:csd:2013:contactPoint">${urn.replace('tel:', '')}</codedType></contactPoint>\n`
    }
  }

  return `
    <provider entityID="${globalid}">
      <otherID code="rapidpro_contact_id" assigningAuthorityName="{${config.rapidpro.url}}{${config.rapidpro.slug}}">${contacts.map((c) => c.uuid)}</otherID>
      ${groups}
      <demographic>
        <name>
          ${names}
        </name>
        ${telNums}
      </demographic>
    </provider>`
}

/**
 * getContactsAsCSDEntities - retrieves a list of contacts from RapidPro
 * and converts them into CSD entities
 *
 * @param {Object} config the dynamic mediator configuration
 * @param {Function} callback (err, contacts, orchestrations)
 */
function getContactsAsCSDEntities (config, callback) {
  let getContactsCallback = (_orchestrations) => (err, contacts, orchestrations) => {
    if (err) {
      callback(err, null, _orchestrations)
    } else {
      let contactsMap = buildContactsByGlobalIDMap(contacts)
      let converted = []

      for (let k in contactsMap) {
        converted.push(convertContactToCSD(config, k, contactsMap[k]))
      }

      callback(null, converted, _orchestrations.concat(orchestrations))
    }
  }

  if (config.rapidpro.groupname) {
    getGroupUUID(config, (err, groupUUID, orchestrations) => {
      if (err) {
        callback(err)
      } else {
        if (groupUUID) {
          getContacts(config, groupUUID, getContactsCallback(orchestrations))
        } else {
          callback(new Error(`Configured group name '${config.rapidpro.groupname}' could not be resolved`), null, orchestrations)
        }
      }
    })
  } else {
    getContacts(config, null, getContactsCallback([]))
  }
}

exports.getContactsAsCSDEntities = getContactsAsCSDEntities

/**
 * addContact - Adds or updates a contact to RapidPro
 *
 * @param  {Object} config the mediator config conaining the RapidPro details
 * @param  {Object} contact  The contact object to add
 * @param  {Function} callback (err, contact, orchestrations)
 */
function addContact (config, contact, callback) {
  let url = contactsURL(config.rapidpro.url)
  let before = new Date()

  let options = {
    url: url,
    headers: {
      Authorization: `Token ${config.rapidpro.authtoken}`
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

    let orchestrations = [utils.buildOrchestration('Add/Update RapidPro Contact', before, res, JSON.stringify(newContact))]

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
exports.addContact = addContact

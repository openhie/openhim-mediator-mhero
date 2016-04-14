'use strict'
const request = require('request')

function contactsURL (baseURL) {
  if (baseURL.slice(-1) === '/') {
    baseURL = baseURL.slice(0, -1)
  }
  return `${baseURL}/api/v1/contacts.json`
}

function buildOrchestration (beforeTimestamp, res, body) {
  return {
    name: 'RapidPro Fetch Contacts',
    request: {
      method: 'GET',
      timestamp: beforeTimestamp
    },
    response: {
      status: res.statusCode,
      headers: res.headers,
      body: body,
      timestamp: new Date()
    }
  }
}

/**
 * getContacts - retrieves a list of contacts from RapidPro
 *
 * @param {Object} config the dynamic mediator configuration
 * @param {Function} callback (err, contacts, orchestrations)
 */
function getContacts (config, callback) {
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

    let orchestrations = [buildOrchestration(before, res, body)]

    if (res.statusCode !== 200) {
      callback(`RapidPro responded with status ${res.statusCode}`, null, orchestrations)
      return
    }

    callback(null, JSON.parse(body).results, orchestrations)
  })
}

/**
 * convertContactToCSD - convert a RapidPro contact into CSD
 *
 * @param  {Object} config a RapidPro contact
 * @return {String} the converted contact
 */
function convertContactToCSD (contact) {
  return ''
}

/**
 * getContactsAsCSDEntities - retrieves a list of contacts from RapidPro
 * and converts them into CSD entities
 *
 * @param {Object} config the dynamic mediator configuration
 * @param {Function} callback (err, contacts, orchestrations)
 */
function getContactsAsCSDEntities (config, callback) {
  getContacts(config, (err, contacts, orchestrations) => {
    if (err) {
      callback(err)
    } else {
      let converted = contacts.map(convertContactToCSD)
      callback(null, converted, orchestrations)
    }
  })
}

exports.getContactsAsCSDEntities = getContactsAsCSDEntities

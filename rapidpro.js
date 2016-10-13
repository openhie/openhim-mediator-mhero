'use strict'
const request = require('request')
const URI = require('urijs')
const utils = require('./utils')
const winston = require('winston')

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

  const getGroupUUID = function (groupName, callback) {
    let url = URI(config.url)
      .segment('api/v1/groups.json')
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
    })
  }

  const getContacts = function (groupUUID, nextpage, results, orchestrations, callback) {
  	 if (typeof nextpage === 'function') {
    	callback = nextpage
  	 }

  	 if (typeof nextpage !== 'function' && nextpage) {
  	 	var url = nextpage
  	 }
  	 else if(!nextpage || typeof nextpage === 'function') {
    	var url = contactsURL(groupUUID)
 	 }
    
    nextpage = null
  
    let before = new Date()

    let options = {
      url: url,
      headers: {
        Authorization: `Token ${config.authtoken}`
      }
    }

    request(options, (err, res, body) => {
      if (err) {
        callback(err)
        return
      }
		
		if(!orchestrations)
      orchestrations = [utils.buildOrchestration('RapidPro Fetch Contacts', before, 'GET', options.url, null, res, body)]
      else
      orchestrations.push([utils.buildOrchestration('RapidPro Fetch Contacts', before, 'GET', options.url, null, res, body)])

      if (res.statusCode !== 200) {
        callback(`RapidPro responded with status ${res.statusCode}`, null, orchestrations)
        return
      }
		
		if(results)
      results = results.concat(JSON.parse(body).results)
      else
      results = JSON.parse(body).results
      
      let next = JSON.parse(body).next
      if(next) {
      	getContacts (groupUUID,next,results,orchestrations,callback)
      }
      else {
      	if (!results) {
        		results = []
      	}
      	results = results.filter(hasGlobalID)

      	callback(null, results, orchestrations)
      }
      
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

      request.post(options, (err, res, newContact) => {
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
	    winston.error('No uuid set in contact, it probably didn\'t get saved in RapidPro')
	    callback(null, newContact, orchestrations)
          }
        } else {
          callback(new Error('No body returned, the contact probably didn\'t get saved in RapidPro'), null, orchestrations)
        }
      })
    }
  }
}

'use strict'
const RapidPro = require('./rapidpro')
const _ = require('lodash')

module.exports = function (config) {

  const rapidpro = RapidPro(config.rapidpro)

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

  const convertRapidProContactToCSD = function (globalid, contacts) {
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

  return {
    /**
     * convertRapidProContactToCSD - convert a RapidPro contact into CSD
     *
     * @param  {String} globalid the contact's globalid
     * @param  {Array} contacts all rapidpro contacts that share the globalid
     * @return {String} the converted contact
     */
    convertRapidProContactToCSD: convertRapidProContactToCSD,

    /**
     * getRapidProContactsAsCSDEntities - retrieves a list of contacts from RapidPro
     * and converts them into CSD entities
     *
     * @param {Function} callback (err, contacts, orchestrations)
     */
    getRapidProContactsAsCSDEntities: function (callback) {
      let getContactsCallback = (_orchestrations) => (err, contacts, orchestrations) => {
        if (err) {
          callback(err, null, _orchestrations)
        } else {
          let contactsMap = buildContactsByGlobalIDMap(contacts)
          let converted = []

          for (let k in contactsMap) {
            converted.push(convertRapidProContactToCSD(k, contactsMap[k]))
          }

          callback(null, converted, _orchestrations.concat(orchestrations))
        }
      }

      if (config.rapidpro.groupname) {
        rapidpro.getGroupUUID((err, groupUUID, orchestrations) => {
          if (err) {
            callback(err)
          } else {
            if (groupUUID) {
              rapidpro.getContacts(groupUUID, getContactsCallback(orchestrations))
            } else {
              callback(new Error(`Configured group name '${config.rapidpro.groupname}' could not be resolved`), null, orchestrations)
            }
          }
        })
      } else {
        rapidpro.getContacts(null, getContactsCallback([]))
      }
    }
  }
}

'use strict'
const Dom = require('xmldom').DOMParser
const RapidPro = require('./rapidpro')
const xpath = require('xpath')
const _ = require('lodash')
const winston = require('winston')

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
    for (let globalid in contacts) {
      if (!map[globalid]) {
        map[globalid] = []
      }
      map[globalid].push(contacts[globalid])
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
        <otherID code="rapidpro_contact_id" assigningAuthorityName="${config.rapidpro.url}/${config.rapidpro.slug}">${contacts.map((c) => c.uuid)}</otherID>
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
    getRapidProContactsAsCSDEntities: function (groupUUID, callback) {
      rapidpro.getContacts(false,true,groupUUID,(contacts)=>{
        let contactsMap = buildContactsByGlobalIDMap(contacts)
        let converted = []
        for (let k in contactsMap) {
          converted.push(convertRapidProContactToCSD(k, contactsMap[k]))
        }
        callback(null, converted)
      })
    },

    /**
     * convertCSDToContact - converts a CSD provider into a rapidPro contact
     *
     * @param  {String} entity An CSD XML representation of the provider
     * @return {Object}        A javascript object representing the RapidPro contact
     */
    convertCSDToContact: function (entity) {
      const doc = new Dom().parseFromString(entity)
      const uuid = xpath.select('/provider/@entityID', doc)[0].value
      const name = xpath.select('/provider/demographic/name/commonName/text()', doc)[0].toString()
      const telNodes = xpath.select('/provider/demographic/contactPoint/codedType[@code="BP" and @codingScheme="urn:ihe:iti:csd:2013:contactPoint"]/text()', doc)
      let tels = []
      telNodes.forEach((telNode) => {
        tels.push('tel:' + telNode.toString())
      })

      if (tels.length === 0) {
        throw new Error(`couldn\'t find a telephone number for provider with entityID ${uuid}, this is a required field for a contact`)
      }

      return {
        name: name,
        urns: tels,
        fields: {
          globalid: uuid
        }
      }
    }
  }
}

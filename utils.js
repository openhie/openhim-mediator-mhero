'use strict'

const Dom = require('xmldom').DOMParser
const URI = require('urijs')
const xpath = require('xpath')

exports.buildOrchestration = (name, beforeTimestamp, method, url, requestContent, res, body) => {
  let uri = new URI(url)
  return {
    name: name,
    request: {
      method: method,
      body: requestContent,
      timestamp: beforeTimestamp,
      path: uri.path(),
      querystring: uri.query()

    },
    response: {
      status: res.statusCode,
      headers: res.headers,
      body: body,
      timestamp: new Date()
    }
  }
}

exports.convertCSDToContact = (entity) => {
  const doc = new Dom().parseFromString(entity)
  const uuid = xpath.select('/provider/@entityID', doc)[0].value
  const name = xpath.select('/provider/demographic/name/commonName/text()', doc)[0].toString()
  const telNodes = xpath.select('/provider/demographic/contactPoint/codedType[@code="BP" and @codingScheme="urn:ihe:iti:csd:2013:contactPoint"]/text()', doc)
  let tels = []
  telNodes.forEach((telNode) => {
    tels.push('tel:' + telNode.toString())
  })

  if (tels.length === 0) {
    throw new Error('couldn\'t find a telephone number, this is a required field for a contact')
  }

  return {
    name: name,
    urns: tels,
    fields: {
      globalid: uuid
    }
  }
}

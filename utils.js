'use strict'

const Dom = require('xmldom').DOMParser
const xpath = require('xpath')

exports.buildOrchestration = (name, beforeTimestamp, res, body) => {
  return {
    name: name,
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

exports.convertCSDToContact = (entity) => {
  const doc = new Dom().parseFromString(entity)
  const select = xpath.useNamespaces({'csd': 'urn:ihe:iti:csd:2013'})
  const name = select('/csd:provider/csd:demographic/csd:name/csd:commonName/text()', doc)[0].toString()
  const telNodes = select('/csd:provider/csd:demographic/csd:contactPoint/csd:codedType[@code="BP" and @codingScheme="urn:ihe:iti:csd:2013:contactPoint"]/text()', doc)
  let tels = []
  telNodes.forEach((telNode) => {
    tels.push('tel:' + telNode.toString())
  })

  if (tels.length === 0) {
    throw new Error('couldn\'t find a telephone number, this is a required field for a contact')
  }

  return {
    name: name,
    urns: tels
  }
}

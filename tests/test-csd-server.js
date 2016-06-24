#!/usr/bin/env node
'use strict'

const http = require('http')
const winston = require('winston')

const response = `<CSD xmlns='urn:ihe:iti:csd:2013'>
                    <serviceDirectory/>
                    <organizationDirectory/>
                    <facilityDirectory>
                    </facilityDirectory>
                    <providerDirectory>
                      <provider entityID="urn:uuid:20258004-a149-4225-975b-5f64b14910dc">
                        <demographic>
                          <name>
                            <commonName>Provider One</commonName>
                          </name>
                          <contactPoint>
                            <codedType code="BP" codingScheme="urn:ihe:iti:csd:2013:contactPoint">555-777-1111</codedType>
                          </contactPoint>
                          <contactPoint>
                            <codedType code="BP" codingScheme="urn:ihe:iti:csd:2013:contactPoint">555-777-2222</codedType>
                          </contactPoint>
                        </demographic>
                      </provider>
                      <provider entityID="urn:uuid:5e971a37-bed4-4204-b662-ef8b4fcec5f2">
                        <demographic>
                          <name>
                            <commonName>Provider Two</commonName>
                          </name>
                          <contactPoint>
                            <codedType code="BP" codingScheme="urn:ihe:iti:csd:2013:contactPoint">555-777-3333</codedType>
                          </contactPoint>
                        </demographic>
                      </provider>
                    </providerDirectory>
                  </CSD>`

const server = http.createServer(function (req, res) {
  let body = ''
  req.on('data', function (chunk) {
    body += chunk.toString()
  })
  req.on('end', function () {
    winston.info(`Recieved ${req.method} request to ${req.url}`)
    winston.info(`with body: ${body}`)
    res.writeHead(200)
    res.end(response)
  })
})

function start (callback) {
  server.listen(8984, function () {
    winston.info('Mock server listening on 8984')
    callback()
  })
}
exports.start = start

function stop (callback) {
  server.close(callback)
}
exports.stop = stop

if (!module.parent) {
  // if this script is run directly, start the server
  start(() => winston.info('CSD Server listening on 8984...'))
}

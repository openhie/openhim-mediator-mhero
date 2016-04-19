#!/usr/bin/env node
'use strict'

const http = require('http')

const response = `<CSD xmlns='urn:ihe:iti:csd:2013'>
                    <serviceDirectory/>
                    <organizationDirectory/>
                    <facilityDirectory>
                    </facilityDirectory>
                    <providerDirectory>
                      <provider entityID='123'>
                        <!-- POTENTIALLY LARGE AMOUNT OF CONTENT ON THE PROVIDER -->
                      </provider>
                      <provider entityID='456'>
                        <!-- POTENTIALLY LARGE AMOUNT OF CONTENT ON THE PROVIDER -->
                      </provider>
                    </providerDirectory>
                  </CSD>`

const server = http.createServer(function (req, res) {
  let body = ''
  req.on('data', function (chunk) {
    body += chunk.toString()
  })
  req.on('end', function () {
    console.log(`Recieved ${req.method} request to ${req.url}`)
    console.log(`with body: ${body}`)
    res.writeHead(200)
    if (req.method === 'POST') {
      res.end()
    } else {
      res.end(response)
    }
  })
})

function start (callback) {
  server.listen(8984, function () {
    console.log('Mock server listening on 8984')
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
  start(() => console.log('CSD Server listening on 8984...'))
}

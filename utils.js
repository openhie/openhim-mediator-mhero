'use strict'

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

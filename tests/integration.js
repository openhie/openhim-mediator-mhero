'use strict'

const tap = require('tap')
const rewire = require('rewire')

const index = rewire('../index.js')

// don't log during tests - comment these out for debugging
console.log = () => {}
console.error = () => {}

tap.test('some integration test', (t) => {
  index.__get__('setupServer') // fetch some non-exported function that you need
  const actual = 1
  const expected = 1
  t.equal(actual, expected, 'actual should equal the expected')
  t.end()
})

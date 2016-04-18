'use strict'

const tap = require('tap')
const utils = require('../utils.js')

const csdProvider = `
<provider xmlns="urn:ihe:iti:csd:2013" entityID="urn:uuid:a97b9397-ce4e-4a57-b12a-0d46ce6f36b7">
    <codedType code="105-007" codingScheme="1.3.6.1.4.1.21367.100.1">Physician/Medical Oncology</codedType>
    <demographic>
        <name>
            <commonName>Banargee, Dev</commonName>
            <honorific>Dr.</honorific>
            <forename>Dev</forename>
            <surname>Banerjee</surname>
        </name>
        <contactPoint>
            <codedType code="BP" codingScheme="urn:ihe:iti:csd:2013:contactPoint">555-777-1111</codedType>
        </contactPoint>
        <contactPoint>
            <codedType code="BP" codingScheme="urn:ihe:iti:csd:2013:contactPoint">555-777-2222</codedType>
        </contactPoint>
        <gender>M</gender>
    </demographic>
</provider>
`

const csdProviderNoTel = `
<provider xmlns="urn:ihe:iti:csd:2013" entityID="urn:uuid:a97b9397-ce4e-4a57-b12a-0d46ce6f36b7">
    <codedType code="105-007" codingScheme="1.3.6.1.4.1.21367.100.1">Physician/Medical Oncology</codedType>
    <demographic>
        <name>
            <commonName>Banargee, Dev</commonName>
            <honorific>Dr.</honorific>
            <forename>Dev</forename>
            <surname>Banerjee</surname>
        </name>
        <gender>M</gender>
    </demographic>
</provider>
`

const csdProviderMultiName = `
<provider xmlns="urn:ihe:iti:csd:2013" entityID="urn:uuid:a97b9397-ce4e-4a57-b12a-0d46ce6f36b7">
    <codedType code="105-007" codingScheme="1.3.6.1.4.1.21367.100.1">Physician/Medical Oncology</codedType>
    <demographic>
        <name>
            <commonName>Banargee, Dev</commonName>
            <commonName>Dev Banargee</commonName>
            <honorific>Dr.</honorific>
            <forename>Dev</forename>
            <surname>Banerjee</surname>
        </name>
        <contactPoint>
            <codedType code="BP" codingScheme="urn:ihe:iti:csd:2013:contactPoint">555-777-1111</codedType>
        </contactPoint>
        <contactPoint>
            <codedType code="BP" codingScheme="urn:ihe:iti:csd:2013:contactPoint">555-777-2222</codedType>
        </contactPoint>
        <gender>M</gender>
    </demographic>
</provider>
`

tap.test('utils.convertCSDToContact() should convert a valid csd entity', (t) => {
  const actual = utils.convertCSDToContact(csdProvider)
  const expected = {
    name: 'Banargee, Dev',
    urns: [ 'tel:555-777-1111', 'tel:555-777-2222' ]
  }
  t.same(actual, expected, 'contact should be the same as the expected value')
  t.end()
})

tap.test('utils.convertCSDToContact() should throw an error if some required data is missing', (t) => {
  try {
    utils.convertCSDToContact(csdProviderNoTel)
  } catch (e) {
    t.ok(e, 'should throw an error')
    t.equal(e.message, 'couldn\'t find a telephone number, this is a required field for a contact', 'should return a readable message')
    t.end()
  }
})

tap.test('utils.convertCSDToContact() should choose the first common name if there are multiple', (t) => {
  const actual = utils.convertCSDToContact(csdProviderMultiName)
  const expected = {
    name: 'Banargee, Dev',
    urns: [ 'tel:555-777-1111', 'tel:555-777-2222' ]
  }
  t.same(actual, expected, 'contact should be the same as the expected value')
  t.end()
})

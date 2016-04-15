[![Build Status](https://travis-ci.org/jembi/openhim-mediator-mhero.svg?branch=master)](https://travis-ci.org/jembi/openhim-mediator-mhero) [![codecov.io](https://codecov.io/github/jembi/openhim-mediator-mhero/coverage.svg?branch=master)](https://codecov.io/github/jembi/openhim-mediator-mhero?branch=master)

mHero Mediator
==============

This mediator synchronises data between the mHero systems.

Getting started guide
---------------------

Clone this mediator and edit `config/config.json` with your OpenHIM server details.

To run this mediator, execute: `npm start` (add `NODE_TLS_REJECT_UNAUTHORIZED=0` before that command if your OpenHIM-core is running a self signed cert).

Send a request to the mediator using `curl localhost:8544 -v`

Dev guide
---------

```bash
npm test                  # runs tests
npm run cov               # runs tests and opens coverage report in your default browser
npm run test:unit         # runs only unit tests
npm run test:integration  # runs only integration tests
npm run test:watch        # runs tests whenever .js files are changed
```

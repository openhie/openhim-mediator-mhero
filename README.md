[![Build Status](https://travis-ci.org/jembi/openhim-mediator-mhero.svg?branch=master)](https://travis-ci.org/jembi/openhim-mediator-mhero) [![codecov.io](https://codecov.io/github/jembi/openhim-mediator-mhero/coverage.svg?branch=master)](https://codecov.io/github/jembi/openhim-mediator-mhero?branch=master)

mHero Mediator
==============

This mediator synchronises data between the mHero systems.

In particular, it pulls providers from an OpenInfoMan server and pushes those providers to RapidPro as contacts. Then, it queries RapidPro for contacts and loads those contacts into a new Document in the OpenInfoMan as providers. The providers now have a RapidPro contact ID attached so that the OpenInfoMan may be queried for uses where providers need to be linked to RapidPro contacts.

Getting started guide
---------------------

The easiest way to install this mediator is to use the debian package which will install the OpenHIM-core as well as the medaitor.

```sh
$ sudo add-apt-repository ppa:openhie/release
$ sudo apt-get update
$ sudo apt-get install openhim-mediator-mhero openhim-console
```

**Note**: If you change the root@openhim.org password (e.g. on first login) __after__ installing the mediator then the mediator config has to be changed here to reflect that: `/usr/share/openhim-mediator-mhero/config/config.json`

When the mediator starts, it registers itself with the OpenHIM-core. Once, this is done you may configure the mediator directly from the OpenHIM-console. Here you will need to setup the following:

* RapidPro Server
  * URL - The base URL of the RapidPro server
  * Slug - The unique identifying part of the assigning authority, this will be combined with the base URL
  * Authentication Token - The authentication token for the RapidPro API
  * Group Name - (optional) Restricts searching for RapidPro contacts to only this group
* OpenInfoMan Server
  * URL - The base URL of the OpenInfoMan server
  * Provider query document - The CSD document to query providers from in order to send to RapidPro
  * RapidPro contacts document - The CSD document to store contacts retrieved from RapidPro

The mediator will automatically install a default polling channel that will run the synchronisation at 2am everyday. Edit the channel to suit your needs.

You will also need to setup one of more polling channels to trigger data to be cached to the OpenInfoMan from other Provider Directories. For example if you wish to trigger the OpenHIM to trigger a sync from iHRIS, you could setup a channel with the following details. Note, you will need to have a remote service registered within the OpenInfoMan already.

* Basic Info
  * Name: 'AUTO - trigger cache update - iHRIS'
  * URL Pattern: /ihris-cache
  * Type: polling
  * Schedule: 30 01 * * *
* Access control
  * Allowed roles and clients: 'polling'
* Routes
  * Add new Routes
    * Name: 'iHRIS cache trigger'
    * Host and port: the host and port of your OpenInfoMan server
    * Route Path: e.g. /CSD/pollService/directory/<your_document>/update_cache

This will now trigger a cache update of the document from iHRIS every night at 1:30am.

Manual installation
-------------------

Clone this mediator and edit `config/config.json` with your OpenHIM server details.

To run this mediator, execute: `npm install` then, `npm start` (add `NODE_TLS_REJECT_UNAUTHORIZED=0` before that command if your OpenHIM-core is running a self signed cert).

Dev guide
---------

```bash
npm test                  # runs tests
npm run cov               # runs tests and opens coverage report in your default browser
npm run test:unit         # runs only unit tests
npm run test:integration  # runs only integration tests
npm run test:watch        # runs tests whenever .js files are changed
```

This mediator consists of 3 main modules and an entry point that ties all these modules together.

* `rapidpro.js` - is a module that controls communicatin with a RapidPro server.
* `openinfoman.js` - is a module that controls communication with an OpenInfoMan Server.
* `rapidproCSDAdapter.js` - is a module that helps adapt from RapidPro contacts to CSD entities and vice versa.
* `index.js` - this is the mediator entry point and it links the above modules together to the mHero synchronisation workflow.

**Packaging**

To build a new debian package execute the below shell script

```
cd packaging
./create-deb.sh
```

You will be asked if you wish to download the latest code from the repository as well as uploading it to launchpad.

(tra-la-la?)

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

When the mediator starts, it registers itself with the OpenHIM-core. Once, this is done you may configure the mediator directly from the OpenHIM-console by going to Mediator > mHero Mediator. Here you will need to setup the following:

* RapidPro Server
  * URL - The base URL of the RapidPro server
  * Slug - The unique identifying part of the assigning authority, this will be combined with the base URL
  * Authentication Token - The authentication token for the RapidPro API
  * Group Name - (optional) Restricts searching for RapidPro contacts to only this group
* OpenInfoMan Server
  * URL - The base URL of the OpenInfoMan server
  * Provider query document - The CSD document to query providers from in order to send to RapidPro
  * RapidPro contacts document - The CSD document to store contacts retrieved from RapidPro

The mediator will automatically install 3 polling channels to control the synchronisation, you must also configure these channels to suit your needs. In later versions of the OpenHIM (after 1.5.1) these will not be installed automatically, you will need to manually install these channels by navigating to Mediators > mHero Mediator and clikcing the little + button next to each channel listed under the 'Default channels' section. The channels are as follows:

* `AUTO - HWR and RapidPro Sync` - This channel will kick off the mediator to perform the the HWR to RapidPro synchronisation at 2am and 2pm everyday. You may edit the channel to change the schedule to suit your needs.
* `AUTO - trigger cache update in iHRIS` - This channel runs everyday at 1am and 1pm by default. This channel updates iHRIS's CSD documents so that they are ready to be queried. You will need to configure the iHRIS endpoint for this to work. Edit this channel then go to 'routes' and add the correct url, hostname and port for your iHRIS instance.
* `AUTO - update OpenInfoMan from iHRIS` - This channel runs everyday at 1:30am and 1:30pm. This channel updates the OpenInfoMan's cache of the iHRIS's Health Worker CSD document. You will need to configure the correcct OpenInfoMan document to fetch and ensure that the openInfoMan url is correct. Edit this channel then go to 'routes' and add the correct url, hostname and port for your OpenInfoMan instance. Replace `your_document` with the name of the health workers document in the url.

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

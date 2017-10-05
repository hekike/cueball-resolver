# cueball-resolver

[![Build Status](https://travis-ci.org/hekike/cueball-resolver.svg?branch=master)](https://travis-ci.org/hekike/cueball-resolver)  

Custom Resolver for https://joyent.github.io/node-cueball  
Static IP resolver with add and remove interface.  

## Install

```js
npm install cueball-resolver
```

## API

See for the complete API: https://joyent.github.io/node-cueball/#resolver

### new Resolver(options)

- `options` -- Object, with keys:
  * `defaultPort` -- optional Number (defaults to 80), fallback port to use for backends
    that only have an `address` property
  * `backends` -- Array of objects, each having properties (optional, defaults to []):
    ** `address` -- String, an IP address to emit as a backend
    ** `port` -- Number (optional, defaults to 80), a port number
        for this backend

### addBackend(backend)

Adds a new backend.

-  `backend` -- object
  * `address` -- String, an IP address to emit as a backend
  * `port` -- Number (optional, defaults to 80), a port number
      for this backend

Returns with the backend.

### removeBackend(backend)

Removes a backend.

-  `backend` -- object
  * `address` -- String, an IP address to emit as a backend
  * `port` -- Number (optional, defaults to 80), a port number
      for this backend

Returns with the backend.

### resetBackends([backends])

Clears all backends and add news if provided.

- `backends` -- Array of objects, each having properties (optional, defaults to []):
  * `address` -- String, an IP address to emit as a backend
  * `port` -- Number (optional, defaults to 80), a port number
      for this backend

## How to use

```js
const bunyan = require('bunyan')
const cueball = require('cueball')
const restifyClients = require('restify-clients')
const Resolver = require('cueball-resolver')

const agent = new cueball.HttpAgent({
  log: bunyan.createLogger({
    name: 'agent-test',
    level: process.env.LOG_LEVEL || 'error'
  }),
  spares: 2,
  maximum: 4,
  recovery: {
    default: {
      timeout: 50,
      retries: 2,
      delay: 5,
      maxDelay: 50
    }
  }
})

const client = restifyClients.createStringClient({
  url: 'http://test.host.com',
  agent
})

const resolver = new Resolver({
  backends: [
    {
      address: '127.0.0.1',
      port: 1234
    }
  ]
})

resolver.start()

agent.createPool('test.host.com', {
  resolver
})

client.get('/test', (err, req, res, data) => {}
```

## How it works

See: https://joyent.github.io/node-cueball/#resolver
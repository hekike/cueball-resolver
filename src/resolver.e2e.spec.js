'use strict'

const { assert } = require('chai')
const bunyan = require('bunyan')
const cueball = require('cueball')
const restify = require('restify')
const restifyClients = require('restify-clients')
const Resolver = require('./')

const log = bunyan.createLogger({
  name: 'agent-test',
  level: process.env.LOG_LEVEL || 'error'
})

describe('Resolver e2e', () => {
  let port
  let server
  let client
  let agent
  let resolver

  beforeEach((done) => {
    port = 1234

    agent = new cueball.HttpAgent({
      log,
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

    client = restifyClients.createStringClient({
      url: 'http://test.host.com',
      agent
    })

    resolver = new Resolver({
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

    server = restify.createServer()
    server.get('/test', (req, res, next) => {
      res.send('test response')
      server.lastVal = req.params.val
      next()
    })
    server.listen(port, done)
  })

  afterEach(() => {
    resolver.stop()
    agent.stop()
    client.close()
    server.close()
  })

  it('should use initial backends', (done) => {
    client.get('/test', (err, req, res, data) => {
      assert.isNotOk(err)
      assert.equal(data, 'test response')
      done(err)
    })
  })

  it('should timeout without backend', (done) => {
    setImmediate(() => {
      assert.equal(resolver.getState(), 'running')

      resolver.resetBackends()

      setTimeout(() => {
        done()
      }, 100)

      client.get('/test', (err) => {
        if (err) {
          assert.equal(err.message, 'error')
          done()
          return
        }

        done(new Error('Unhandled exception'))
      })
    })
  })

  it('should find new backend', (done) => {
    setImmediate(() => {
      assert.equal(resolver.getState(), 'running')

      resolver.resetBackends()
      resolver.addBackend({
        address: '127.0.0.1',
        port: 1234
      })

      client.get('/test', (err, req, res, data) => {
        assert.isNotOk(err)
        assert.equal(data, 'test response')
        done(err)
      })
    })
  })
})


'use strict'

const { assert } = require('chai')
const Resolver = require('./resolver')

describe('Resolver', () => {
  it('should throw error for bad arguments', () => {
    assert.throws(() => {
      new Resolver({
        defaultPort: null
      })
    }, 'options.defaultPort: expected null to be a number')

    assert.throws(() => {
      new Resolver({
        backends: [null]
      })
    }, /options.backends/)

    assert.throws(() => {
      new Resolver({
        backends: [
          {
            address: '127.0.0.1',
            port: 1234
          },
          {}
        ]
      })
    }, /options.backends\[1\].address/)

    assert.throws(() => {
      new Resolver({
        backends: [
          {
            address: '127.0.0.1',
            port: 1234
          },
          {
            address: 1234,
            port: 'foobar'
          }
        ]
      })
    }, /options.backends\[1\].address/)

    assert.throws(() => {
      new Resolver({
        backends: [
          {
            address: '127.0.0.1',
            port: 1234
          },
          {
            address: '127.0.0.1',
            port: 'foobar'
          }
        ]
      })
    }, /options.backends\[1\].port/)
  })

  describe('#start', () => {
    it('should start without backends', (done) => {
      const resolver = new Resolver()
      resolver.start()

      let addedEventCounter = 0

      resolver.on('added', () => {
        addedEventCounter += 1
      })
      resolver.on('stateChanged', (state) => {
        if (state === 'running') {
          assert.equal(addedEventCounter, 0)
          assert.deepEqual(resolver.list(), [])
          assert.equal(resolver.count(), 0)
          resolver.stop()
          done()
        }
      })
    })

    it('should hold backends', (done) => {
      const resolver = new Resolver({
        defaultPort: 2021,
        backends: [
          {
            address: '10.0.0.3',
            port: 2022
          },
          {
            address: '10.0.0.4'
          },
          {
            address: '10.0.0.5'
          }
        ]
      })

      resolver.start()

      const found = []
      resolver.on('added', (key, backend) => {
        found.push(backend)
      })
      resolver.on('stateChanged', (state) => {
        if (state === 'running') {
          assert.equal(resolver.count(), 3)
          assert.deepEqual(found, [
            {
              name: '10.0.0.3:2022',
              address: '10.0.0.3',
              port: 2022
            }, {
              name: '10.0.0.4:2021',
              address: '10.0.0.4',
              port: 2021
            }, {
              name: '10.0.0.5:2021',
              address: '10.0.0.5',
              port: 2021
            }
          ])

          const services = resolver.list().map((backend) => backend.service)

          assert.deepEqual(services, [
            { name: '10.0.0.3:2022', address: '10.0.0.3', port: 2022 },
            { name: '10.0.0.4:2021', address: '10.0.0.4', port: 2021 },
            { name: '10.0.0.5:2021', address: '10.0.0.5', port: 2021 }
          ])

          resolver.stop()
          done()
        }
      })
    })
  })

  describe('#stop', () => {
    it('should stop')
  })

  describe('#addBackend', () => {
    it('should add backend before "running" state')
    it('should add backend in "running" state')
  })

  describe('#removeBackend', () => {
    it('should remove backend before "running" state')
    it('should remove backend in "running" state')
  })

  describe('#resetBackends', () => {
    it('should set new backends', (done) => {
      const resolver = new Resolver({
        backends: [{
          address: '127.0.0.1'
        }]
      })

      resolver.resetBackends([{
        address: '127.0.0.2'
      }])

      resolver.start()

      resolver.on('stateChanged', (state) => {
        if (state === 'running') {
          assert.equal(resolver.list().length, 1, 'should hold one backend')
          assert.deepEqual(resolver.list()[0].service, {
            name: '127.0.0.2:80',
            address: '127.0.0.2',
            port: 80
          })
          done()
        }
      })
    })

    it('should empty backends', (done) => {
      const resolver = new Resolver({
        backends: [{
          address: '127.0.0.1'
        }]
      })

      resolver.start()

      resolver.on('stateChanged', (state) => {
        if (state === 'running') {
          assert.equal(resolver.list().length, 1, 'should hold one backend')
          resolver.resetBackends()
          setImmediate(() => {
            assert.equal(
              resolver.list().length, 0,
              'queue should hold zero backend'
            )
            done()
          })
        }
      })
    })

    it('should empty queue', () => {
      const resolver = new Resolver()

      resolver.addBackend({
        address: '127.0.0.1'
      })

      assert.equal(resolver._queue.length, 1, 'queue should hold one operation')
      resolver.resetBackends()
      assert.equal(
        resolver._queue.length, 0,
        'queue should hold zero operation'
      )
    })
  })

  describe('#getLastError', () => {
    it('should get last error')
  })
})


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

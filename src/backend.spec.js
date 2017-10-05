
'use strict'

const { assert } = require('chai')
const Backend = require('./backend')

describe('Backend', () => {
  it('should throw error for bad arguments', () => {
    assert.throws(() => {
      new Backend({
        address: undefined
      })
    }, 'address: expected undefined to be a string')

    assert.throws(() => {
      new Backend({
        address: 'invalid'
      })
    }, /address must be an IP address/)

    assert.throws(() => {
      new Backend({
        address: '127.0.0.1',
        port: undefined
      })
    }, 'backend.port: expected undefined to be a number')

    assert.throws(() => {
      new Backend({
        address: '127.0.0.1',
        port: 'invalid'
      })
    }, 'backend.port: expected \'invalid\' to be a number')
  })

  it('should have unique key', () => {
    const backend1 = new Backend({ address: '127.0.0.1', port: 80 })
    const backend2 = new Backend({ address: '127.0.0.1', port: 81 })
    const backend3 = new Backend({ address: '127.0.0.2', port: 80 })
    const backend4 = new Backend({ address: '127.0.0.2', port: 81 })

    assert.notEqual(backend1.key, backend2.key)
    assert.notEqual(backend2.key, backend3.key)
    assert.notEqual(backend3.key, backend4.key)
    assert.notEqual(backend1.key, backend3.key)
    assert.notEqual(backend1.key, backend4.key)
    assert.notEqual(backend2.key, backend4.key)
  })

  it('should be the same key with the same address and port', () => {
    const backend1 = new Backend({ address: '127.0.0.1', port: 80 })
    const backend2 = new Backend({ address: '127.0.0.1', port: 80 })

    assert.deepEqual(backend1, backend2)
  })
})

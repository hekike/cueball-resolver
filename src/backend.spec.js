
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
})

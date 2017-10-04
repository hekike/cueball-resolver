'use strict'

const crypto = require('crypto')
const net = require('net')
const { assert } = require('chai')
const ipaddr = require('ipaddr.js')

/**
 * @class Backend
 */
class Backend {
  /**
   * @static
   * @param {Backend} backend - Backend instance
   * @returns  {String}
   * @memberof Backend
   */
  static getKey (backend) {
    if (backend.key) {
      return backend.key
    }

    const hash = crypto.createHash('sha1')
    const ip = ipaddr.parse(backend.service.address)
    let addr

    if (ip.toNormalizedString) {
      addr = ip.toNormalizedString()
    } else {
      addr = ip.toString()
    }

    hash.update(backend.service.name)
    hash.update('||')
    hash.update(String(backend.service.port))
    hash.update('||')
    hash.update(addr)

    return hash.digest('base64')
  }

  /**
   * Creates an instance of Backend.
   * @param {Object} [{ address, port }={}] opts - Options
   * @memberof Backend
   */
  constructor ({ address, port } = {}) {
    assert.isString(address, 'address')
    assert.isOk(
      net.isIP(address),
      'address must be an IP address'
    )
    assert.isNumber(port, 'backend.port')

    this.service = {
      name: `${address}:${port}`,
      address,
      port
    }

    this.key = Backend.getKey(this)
  }
}

module.exports = Backend

'use strict'

const { FSM } = require('mooremachine')
const { assert } = require('chai')
const Backend = require('./backend')

const STATE = {
  stopped: 'stopped',
  starting: 'starting',
  running: 'running',
  stopping: 'stopping',
  failed: 'failed'
}
const EVENT = {
  startAsserted: 'startAsserted',
  stopAsserted: 'stopAsserted',
  added: 'added',
  removed: 'removed',
  updated: 'updated'
}

class Resolver extends FSM {
  /**
   * Creates an instance of Resolver.
   * @param {Object} [opts]
   * @param {Array.<Backend>} [opts.backends]
   * @param {Number} [opts.defaultPort]
   * @memberof Resolver
   */
  constructor ({
    defaultPort = 80,
    backends = []
  } = {}) {
    super(STATE.stopped)

    this.defaultPort = defaultPort
    this._backends = new Map()
    this._lastError = undefined

    assert.isNumber(defaultPort, 'options.defaultPort')
    assert.isArray(backends, 'options.backends')

    // Init with backends
    backends.forEach((backend, i) => {
      if (!(backend instanceof Backend)) {
        assert.isObject(backend, `options.backends[${i}]`)
        assert.isString(backend.address, `options.backends[${i}].address`)

        if (backend.port === undefined || backend.port === null) {
          backend.port = this.defaultPort
        }

        assert.isNumber(backend.port, `options.backends[${i}].port`)
      }

      this.addBackend(backend)
    })
  }

  /**
   * Adds a new backend
   * @method addBackend
   * @param {Backend|Object} backend
   * @param {String} backend.address
   * @param {Number} [backend.port]
   * @memberof Resolver
   */
  addBackend (backend) {
    if (!(backend instanceof Backend)) {
      if (backend.port === undefined || backend.port === null) {
        backend.port = this.defaultPort
      }
      backend = new Backend(backend)
    }

    this._backends.set(backend.key, backend)
    this.emit(EVENT.added, backend.key, backend.service)
  }

  /**
   * Removes a backend
   * @method removeBackend
   * @param {Backend|Object} backend
   * @param {String} backend.address
   * @param {Number} [backend.port]
   * @memberof Resolver
   */
  removeBackend (backend) {
    if (!(backend instanceof Backend)) {
      if (backend.port === undefined || backend.port === null) {
        backend.port = this.defaultPort
      }
      backend = new Backend(backend)
    }

    this._backends.delete(backend.key)
    this.emit(EVENT.removed, backend.key, backend.service)
  }

  /**
   * Removes a backend
   * @method list
   * @returns {Array.<Backend>}
   * @memberof Resolver
   */
  list () {
    return Array.from(this._backends.values())
  }

  /* *************** cueball required *************** */

  start () {
    assert.isOk(
      this.isInState(STATE.stopped),
      'Resolver must be stopped to call start()'
    )

    this.emit(EVENT.startAsserted)

    // Add backends
    setImmediate(() => {
      this._backends.forEach((backend) => this.addBackend(backend))
      this.emit(EVENT.updated)
    })
  }

  stop () {
    assert.isNotOk(
      this.isInState(STATE.stopped),
      'cannot call stop() again without calling start()'
    )

    this.emit(EVENT.stopAsserted)
  }

  getLastError () {
    return this._lastError
  }

  /* *************** FSM required *************** */
  count () {
    return this._backends.size
  }

  /* *************** STATES *************** */
  // eslint-disable-next-line  camelcase
  state_stopped (stateHandle) {
    stateHandle.on(this, EVENT.startAsserted, () => {
      stateHandle.gotoState(STATE.starting)
    })
  }

  // eslint-disable-next-line  camelcase
  state_starting (stateHandle) {
    stateHandle.on(this, EVENT.updated, () => {
      stateHandle.gotoState(STATE.running)
    })
  }

  // eslint-disable-next-line  camelcase
  state_running (stateHandle) {
    stateHandle.on(this, EVENT.stopAsserted, () => {
      stateHandle.gotoState(STATE.stopping)
    })
  }

  // eslint-disable-next-line  camelcase,class-methods-use-this
  state_stopping (stateHandle) {
    stateHandle.immediate(() => {
      stateHandle.gotoState(STATE.stopped)
    })
  }

  // eslint-disable-next-line  camelcase
  state_failed (stateHandle) {
    stateHandle.on(this, EVENT.updated, () => {
      stateHandle.gotoState(STATE.running)
    })
    stateHandle.on(this, EVENT.stopAsserted, () => {
      stateHandle.gotoState(STATE.stopping)
    })
  }
}

Resolver.EVENT = EVENT
Resolver.STATE = STATE

module.exports = Resolver

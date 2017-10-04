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

/**
 * Resolver for cueball
 * See: https://joyent.github.io/node-cueball/#resolver
 * @class Resolver
 * @extends {FSM}
 */
class Resolver extends FSM {
  /**
   * Creates an instance of Resolver.
   * @param {Object} [opts]
   * @param {Array.<Backend>} [opts.backends=[]]
   * @param {Number} [opts.defaultPort=80]
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
    this._queue = []

    assert.isNumber(defaultPort, 'options.defaultPort')
    assert.isArray(backends, 'options.backends')

    this._loadBackends(backends)

    this.on('error', (err) => {
      this._lastError = err
    })
  }

  /**
   * Create backend with default port
   * @method _createBackend
   * @private
   * @param {Backend|Object} backend
   * @param {String} backend.address
   * @param {Number} [backend.port]
   * @returns {Backend} backend
   * @memberof Resolver
   */
  _createBackend (backend) {
    if (!(backend instanceof Backend)) {
      if (backend.port === undefined || backend.port === null) {
        backend.port = this.defaultPort
      }
      backend = new Backend(backend)
    }

    return backend
  }

  /**
   * Adds a new backend
   * @method addBackend
   * @public
   * @param {Backend|Object} backend
   * @param {String} backend.address
   * @param {Number} [backend.port]
   * @returns {Backend}
   * @memberof Resolver
   */
  addBackend (backend) {
    backend = this._createBackend(backend)

    if (this.isInState(STATE.running)) {
      this._backends.set(backend.key, backend)
      this.emit(EVENT.added, backend.key, backend.service)
      this.emit(EVENT.updated)
    } else {
      this._queue.push({
        key: backend.key,
        operation: 'add',
        backend
      })
    }

    return backend
  }

  /**
   * Removes a backend
   * @method removeBackend
   * @public
   * @param {Backend|Object} backend
   * @param {String} backend.address
   * @param {Number} [backend.port]
   * @returns {Backend}
   * @memberof Resolver
   */
  removeBackend (backend) {
    backend = this._createBackend(backend)

    if (this.isInState(STATE.running)) {
      this._backends.delete(backend.key)
      this.emit(EVENT.removed, backend.key, backend.service)
      this.emit(EVENT.updated)
    } else {
      this._queue.push({
        key: backend.key,
        operation: 'remove',
        backend
      })
    }

    return backend
  }

  /**
   * Load backends
   * @method _loadBackends
   * @private
   * @param {Array.<Backend>} [opts.backends=[]]
   * @memberof Resolver
   */
  _loadBackends (backends = []) {
    backends.forEach((backend, i) => {
      // Validation
      if (!(backend instanceof Backend)) {
        assert.isObject(backend, `options.backends[${i}]`)
        assert.isString(backend.address, `options.backends[${i}].address`)

        if (backend.port !== undefined && backend.port !== null) {
          assert.isNumber(backend.port, `options.backends[${i}].port`)
        }
      }

      this.addBackend(backend)
    })
  }

  /**
   * Clears backends and loads with new one
   * @method resetBackends
   * @public
   * @param {Array.<Backend>} [opts.backends=[]]
   * @memberof Resolver
   */
  resetBackends (backends = []) {
    this._queue = []

    setImmediate(() => {
      // Clear backends
      this._backends.forEach((backend) =>
        this.removeBackend(backend))

      this._loadBackends(backends)

      // Do not sync in non running state
      this._backends.forEach((backend) => this.addBackend(backend))
    })
  }

  /**
   * Removes a backend
   * @method list
   * @public
   * @returns {Array.<Backend>}
   * @memberof Resolver
   */
  list () {
    return Array.from(this._backends.values())
  }

  /* *************** cueball required *************** */

  /**
   * Start resolver
   * @method start
   * @public
   * @memberof Resolver
   */
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

  /**
   * Stop resolver
   * @method stop
   * @public
   * @memberof Resolver
   */
  stop () {
    assert.isNotOk(
      this.isInState(STATE.stopped),
      'cannot call stop() again without calling start()'
    )

    this.emit(EVENT.stopAsserted)
  }

  /**
   * Get last error
   * @method getLastError
   * @public
   * @returns {Error|undefined} lastError
   * @memberof Resolver
   */
  getLastError () {
    return this._lastError
  }

  /* *************** FSM required *************** */

  /**
   * Number of backends
   * @method count
   * @public
   * @returns {Number} backendsCount
   * @memberof Resolver
   */
  count () {
    return this._backends.size
  }

  /* *************** STATES *************** */

  /**
   * From "stopped" state it goes to "starting" via start() call
   * @method state_stopped
   * @private
   * @param {FSMStateHandle} stateHandle
   * @memberof Resolver
   */
  // eslint-disable-next-line  camelcase
  state_stopped (stateHandle) {
    stateHandle.on(this, EVENT.startAsserted, () => {
      stateHandle.gotoState(STATE.starting)
    })
  }

  /**
   * From "starting" state it goes to "running" via "updated" event
   * @method state_starting
   * @private
   * @param {FSMStateHandle} stateHandle
   * @memberof Resolver
   */
  // eslint-disable-next-line  camelcase
  state_starting (stateHandle) {
    stateHandle.on(this, EVENT.updated, () => {
      stateHandle.gotoState(STATE.running)
    })
  }

  /**
   * From "running" state it goes to "stopping" via stop() call
   * @method state_running
   * @private
   * @param {FSMStateHandle} stateHandle
   * @memberof Resolver
   */
  // eslint-disable-next-line  camelcase
  state_running (stateHandle) {
    while (this._queue.length) {
      const item = this._queue.shift()

      if (item.operation === 'add') {
        this.addBackend(item.backend)
      } else if (item.operation === 'remove') {
        this.removeBackend(item.backend)
      }
    }

    stateHandle.on(this, EVENT.stopAsserted, () => {
      stateHandle.gotoState(STATE.stopping)
    })
  }

  /**
   * From "stopping" state it goes to "stopped" immediatly
   * @method state_stopping
   * @private
   * @param {FSMStateHandle} stateHandle
   * @memberof Resolver
   */
  // eslint-disable-next-line  camelcase,class-methods-use-this
  state_stopping (stateHandle) {
    stateHandle.immediate(() => {
      stateHandle.gotoState(STATE.stopped)
    })
  }

  /**
   * From "failed" state it goes to "running" via "updated" event
   * or to "stopping" via stop() call
   * @method state_failed
   * @private
   * @param {FSMStateHandle} stateHandle
   * @memberof Resolver
   */
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

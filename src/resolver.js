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
  removed: 'removed'
}

/**
 * Resolver for cueball
 * See: https://joyent.github.io/node-cueball/#resolver
 * Lifecycle:
 *                   .start()          error
 *         +-------+       +--------+       +------+
 * init -> |stopped| +---> |starting| +---> |failed|
 *         +---+---+       +---+----+       +------+
 *             ^               |               +
 *             |               | ok            |
 *             |               v               |
 *         +---+----+      +---+---+           |
 *         |stopping| <--+ |running|  <--------+
 *         +--------+      +-------+       retry success
 *                  .stop()
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

    this.on('error', function onError (err) {
      this._lastError = err
    })
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
   * Clears backends and loads with new one
   * @method resetBackends
   * @public
   * @param {Array.<Backend>} [opts.backends=[]]
   * @memberof Resolver
   */
  resetBackends (backends = []) {
    const _this = this
    _this._queue = []

    setImmediate(function setImmediate () {
      // Clear backends
      _this._backends.forEach(function removeBackend (backend) {
        return _this.removeBackend(backend)
      })

      _this._loadBackends(backends)
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

  /**
   * Load backends
   * @method _loadBackends
   * @private
   * @param {Array.<Backend>} [opts.backends=[]]
   * @memberof Resolver
   */
  _loadBackends (backends = []) {
    const _this = this

    backends.forEach(function loadBackend (backend, i) {
      // Validation
      if (!(backend instanceof Backend)) {
        assert.isObject(backend, `options.backends[${i}]`)
        assert.isString(backend.address, `options.backends[${i}].address`)

        if (backend.port !== undefined && backend.port !== null) {
          assert.isNumber(backend.port, `options.backends[${i}].port`)
        }
      }

      _this.addBackend(backend)
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
   * @method _processQueue
   * @memberof Resolver
   */
  _processQueue () {
    const _this = this

    // Process queue
    setImmediate(function setImmediate () {
      while (_this._queue.length) {
        const item = _this._queue.shift()

        if (item.operation === 'add') {
          _this.addBackend(item.backend)
        } else if (item.operation === 'remove') {
          _this.removeBackend(item.backend)
        }
      }
    })
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
    stateHandle.on(this, EVENT.startAsserted, function onStartAsserted () {
      stateHandle.gotoState(STATE.starting)
    })
  }

  /**
   * From "starting" state it goes to "running" immediately
   * @method state_starting
   * @private
   * @param {FSMStateHandle} stateHandle
   * @memberof Resolver
   */
  // eslint-disable-next-line camelcase,class-methods-use-this
  state_starting (stateHandle) {
    stateHandle.immediate(function immediate () {
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
  // eslint-disable-next-line camelcase
  state_running (stateHandle) {
    this._processQueue()

    stateHandle.on(this, EVENT.stopAsserted, function onStopAsserted () {
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
  // eslint-disable-next-line camelcase,class-methods-use-this
  state_stopping (stateHandle) {
    stateHandle.immediate(function immediate () {
      stateHandle.gotoState(STATE.stopped)
    })
  }

  /**
   * From "failed" state it goes to "running" via "added" event
   * or to "stopping" via stop() call
   * @method state_failed
   * @private
   * @param {FSMStateHandle} stateHandle
   * @memberof Resolver
   */
  // eslint-disable-next-line camelcase
  state_failed (stateHandle) {
    stateHandle.on(this, EVENT.added, function onAdded () {
      stateHandle.gotoState(STATE.running)
    })
    stateHandle.on(this, EVENT.stopAsserted, function onStopAsserted () {
      stateHandle.gotoState(STATE.stopping)
    })
  }
}

Resolver.EVENT = EVENT
Resolver.STATE = STATE

module.exports = Resolver

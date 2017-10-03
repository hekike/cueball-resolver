'use strict'

const Resolver = require('./resolver')
const Backend = require('./backend')

module.exports = Object.assign(Resolver, {
  Backend
})

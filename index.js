const local = require('./config/local.js')
const _ = require('lodash')
const launch = new Date()

/**
 * Blitz.js module builder
 */
class Blitz {
  constructor(options) {
    global.blitz = this
    blitz.hooks = {}
    blitz.config = {}
    blitz.nodes = {}
    blitz.log = new(require('./lib/logger.js'))()

    // Set up error handlers
    process.on('uncaughtException', err => {
      this.throwSafely(err)
    })
    process.on('unhandledRejection', err => {
      this.throwSafely(err)
    })

    // Set configuration
    let config = {
      local,
      provided: options || {}
    }
    if (config.provided.environment === 'production') {
      process.env.NODE_ENV = 'production'
      config.local.logLevel = 'monitor'
      config.local.skipAuthCheck = true
    }
    if (!config.provided.skipAuthCheck) {
      this.auth = require('./lib/auth.js')
    }
    this.setConfig('local', config)
  }

  /**
   * Attach module config to global blitz object
   */
  setConfig(id, config) {
    const merged = this.getConfig(config)
    blitz.config[id] = {}

    // Add each key to global blitz object
    for (var property in merged) {
      blitz.config[id][property] = merged[property]
    }
  }

  /**
   * Merge default config with provided options
   */
  getConfig(config) {
    let local = _.cloneDeep(config.local) // merge seems to mutate original
    return _.merge(local, config.provided)
  }

  /**
   * Throw errors only in development or if the error occured pre-boot
   */
  throwSafely(err) {
    if (blitz.config.local.environment.toLowerCase() === 'production') {
      console.error(err)
    } else {
      throw err
    }
  }

  /**
   * Hook functions to be executed before specific node is initialized while
   * making node config available to the Hook
   */
  hook(node, fn) {
    let id = typeof node === 'string' ? node : node.name.toLowerCase()
    let hooks = _.get(blitz.hooks, id)

    // Create empty array for given node if previously empty
    if (!hooks) {
      _.set(blitz.hooks, id, [])
      hooks = []
    }

    hooks.push(fn)
    _.set(blitz.hooks, id, hooks)
  }

  /**
   * Execute hooks for specific node
   */
  async runHooks(id) {
    let hooks = _.get(blitz.hooks, id)

    if (hooks) {
      hooks.forEach(async hook => {
        await hook()
        blitz.log.monitor(`Hooked ${hook.name} on ${id}`, true, `${new Date() - launch}ms`)
      })
      await Promise.all(hooks)
    }
  }

  /**
   * Let blitz handle framework modules
   */
  async use(node) {
    let id = node.constructor.name.toLowerCase() // Class name of entrypoint
    let group = node.config.provided.group

    // Ignore node if disabled
    if (node.config.provided.disable) {
      return
    }

    // Verify RSA keys being set in config and manage user credentials
    if (!blitz.config.local.skipAuthCheck) {
      await this.auth.verify(id, node.config)
    }

    // Only set initial config when no group is specified; group will already
    // have the config for sub-nodes set (also follows the same schema as
    // nodes, e.g. blitz.nodes.auth.api -> blitz.config.auth.api)
    if (!group) {
      this.setConfig(id, node.config)
    }
    // If sub-node does have group, we still have to merge the default config
    // with what's provided by the group node.
    else {
      blitz.config[group] = blitz.config[group] || {}
      blitz.config[group][id] = this.getConfig(node.config)
    }

    // Run hooks before initiating node
    await this.runHooks(`${group ? group + '.' : ''}${id}`)

    // Given node is a bigger one (not core or api): run init script and provide
    // empty object for other nodes to attach to
    if (id !== 'api' && id !== 'core') {
      blitz.nodes[id] = {}
      node.init()
    }
    // Actual node (blitz-js-core or blitz-js-api)
    else {
      // Assign node directly by name or as part of bigger node
      if (group) {
        blitz.nodes[group] = blitz.nodes[group] || {}
        blitz.nodes[group][id] = node
        blitz.nodes[group][id].init()
      } else {
        blitz.nodes[id] = node
        blitz.nodes[id].init()
      }
      let name = group ? `${group} ${id}` : id
      let port = id === 'api' ? ` (Listening on :${node.config.provided.port || node.config.local.port})` : ''
      blitz.log.monitor(`Loaded ${name} node${port}`, true, `${new Date() - launch}ms`)
    }
  }
}

/**
 * Pass options to constructor on require
 */
module.exports = (options) => {
  return new Blitz(options)
}

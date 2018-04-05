const local = require('./config/local.js')
const _ = require('lodash')
const launch = new Date()

/**
 * cubic.js module builder
 */
class cubic {
  constructor(options) {
    global.cubic = this
    cubic.hooks = {}
    cubic.config = {}
    cubic.nodes = {}
    cubic.log = new(require('./lib/logger.js'))()

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
   * Attach module config to global cubic object
   */
  setConfig(id, config) {
    const merged = this.getConfig(config)
    cubic.config[id] = {}

    // Add each key to global cubic object
    for (var property in merged) {
      cubic.config[id][property] = merged[property]
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
    if (cubic.config.local.environment.toLowerCase() === 'production') {
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
    let hooks = _.get(cubic.hooks, id)

    // Create empty array for given node if previously empty
    if (!hooks) {
      _.set(cubic.hooks, id, [])
      hooks = []
    }

    hooks.push(fn)
    _.set(cubic.hooks, id, hooks)
  }

  /**
   * Execute hooks for specific node
   */
  async runHooks(id) {
    let hooks = _.get(cubic.hooks, id)

    if (hooks) {
      hooks.forEach(async hook => {
        await hook()
        cubic.log.monitor(`Hooked ${hook.name} on ${id}`, true, `${new Date() - launch}ms`)
      })
      await Promise.all(hooks)
    }
  }

  /**
   * Let cubic handle framework modules
   */
  async use(node) {
    let id = node.constructor.name.toLowerCase() // Class name of entrypoint
    let group = node.config.provided.group

    // Ignore node if disabled
    if (node.config.provided.disable) {
      return
    }

    // Verify RSA keys being set in config and manage user credentials
    if (!cubic.config.local.skipAuthCheck) {
      await this.auth.verify(id, node.config)
    }

    // Only set initial config when no group is specified; group will already
    // have the config for sub-nodes set (also follows the same schema as
    // nodes, e.g. cubic.nodes.auth.api -> cubic.config.auth.api)
    if (!group) {
      this.setConfig(id, node.config)
    }
    // If sub-node does have group, we still have to merge the default config
    // with what's provided by the group node.
    else {
      cubic.config[group] = cubic.config[group] || {}
      cubic.config[group][id] = this.getConfig(node.config)
    }

    // Run hooks before initiating node
    await this.runHooks(`${group ? group + '.' : ''}${id}`)

    // Given node is a bigger one (not core or api): run init script and provide
    // empty object for other nodes to attach to
    if (id !== 'api' && id !== 'core') {
      cubic.nodes[id] = {}
      node.init()
    }
    // Actual node (cubic-core or cubic-api)
    else {
      // Assign node directly by name or as part of bigger node
      if (group) {
        cubic.nodes[group] = cubic.nodes[group] || {}
        cubic.nodes[group][id] = node
        cubic.nodes[group][id].init()
      } else {
        cubic.nodes[id] = node
        cubic.nodes[id].init()
      }
      let name = group ? `${group} ${id}` : id
      let port = id === 'api' ? ` (Listening on :${node.config.provided.port || node.config.local.port})` : ''
      cubic.log.monitor(`Loaded ${name} node${port}`, true, `${new Date() - launch}ms`)
    }
  }
}

/**
 * Pass options to constructor on require
 */
module.exports = (options) => {
  return new cubic(options)
}

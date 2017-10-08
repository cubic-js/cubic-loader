/**
 * Dependencies
 */
const CircularJSON = require('circular-json')
const chalk = require('chalk')

/**
 * Auxiliary Class for setting up blitz.js
 */
class Worker {
  /**
   * Set up uncaughtException listener for each worker
   */
  constructor () {
    process.on('uncaughtException', err => {
      this.throwSafely(err)
    })
    process.on('unhandledRejection', err => {
      this.throwSafely(err)
    })
  }

  /**
   * Throw errors only in development or if the error occured pre-boot
   */
  throwSafely(err) {
    try {
      if (blitz.config.local.environment.toLowerCase() === 'production') {
        console.error(err)
      } else {
        throw err
      }
    } catch (e) {
      throw err
    }
  }

  /**
   * Listen for global blitz config object
   */
  setGlobal () {
    return new Promise(resolve => {
      process.on('message', msg => {
        if (msg.type === 'setGlobal') {
          // Set global blitz from parent process
          global.blitz = this.deserialize(msg.body)

          // Create new logger from class
          blitz.log = new (require(blitz.log.path))()

          // Set process environment accordingly
          if (blitz.config.local.environment === 'production') {
            process.env.NODE_ENV = 'production'
          }

          resolve()
        }
      })
    })
  }

  /**
   * Create Interface for global blitz object on parent and child
   */
  expose (node) {
    process.on('message', async msg => {
      // Function is being called
      if (msg.type === 'call') {
        msg.body.args = this.deserialize(msg.body.args)
        let args = []

        // Convert args obj to array
        for (let i in msg.body.args) {
          args.push(msg.body.args[i])
        }

        // Call target function & return if function returns value
        process.send({
          type: 'return',
          body: {
            method: msg.body.method,
            value: await node[msg.body.method].apply(node, args)
          }
        })
      }

      // Respond to pings as soon as setup is complete
      // Function calls won't be transmitted before successful ping
      if (msg.type === 'ping') {
        await node.setup
        process.send({
          type: 'pong',
          body: {}
        })
      }
    })
  }

  /**
   * Deserialize objects received via stdin from parent
   */
  deserialize (obj) {
    return CircularJSON.parse(obj, (key, value) => {
      try {
        if (typeof value !== 'string') return value

        // Stringified function? (Not recommended)
        if (value.substring(0, 8) == 'function' || value.includes(' => ')) {
          return eval('(' + value + ')')
        }

        // Primitive datatype
        else {
          return value
        }
      } catch (err) {
        return undefined
      }
    })
  }
}

module.exports = new Worker()

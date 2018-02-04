/**
 * Automatic authentication setup for each loaded node. In short, this generates
 * unique RSA-and root user keys for each node. You wouldn't wanna do this
 * manually.
 * -
 * Generates RSA keys if none are available in the working directory, then
 * passes those keys to the relevant API node.
 * -
 * Generates a new user with `write_root` permissions for each type of core
 * node that has been loaded.
 * -
 * RSA keys are used for signing authorization tokens.
 * The keys can still be changed manually by putting them
 * in `${process.cwd()}/config/certs/auth.public|private.pem`
 */
const fs = require('fs')
const promisify = require('util').promisify
const fileExists = promisify(fs.lstat)
const mkdir = promisify(fs.mkdir)
const readFile = promisify(fs.readFile)
const writeFile = promisify(fs.writeFile)
const generateKeys = require('keypair')
const mongodb = require('mongodb').MongoClient
const bcrypt = require('bcryptjs')
const randtoken = require('rand-token')
const chalk = require('chalk')
const certDir = `${process.cwd()}/config/certs`

/**
 * Auth class managing keys and node credentials on load
 */
class Auth {

  constructor() {
    this.authUrl = new Promise(resolve => this.resolveUrl = resolve)
    this.certsReady = false
  }

  /**
   * See if RSA keys available in file system, if not: generate and save
   */
  async checkRSAKeys(resolve) {
    try {
      if (this.certsReady) {
        return resolve()
      }
      await fileExists(`${certDir}/auth.private.pem`)
      this.certPrivate = await readFile(`${certDir}/auth.private.pem`, 'utf-8')
      this.certPublic = await readFile(`${certDir}/auth.public.pem`, 'utf-8')
      this.certsReady = true
    } catch (err) {
      const keys = generateKeys()
      this.certPrivate = keys.private
      this.certPublic = keys.public

      // Save keys so we can use them next time
      try {
        await mkdir(`${process.cwd()}/config/`)
      } catch (err) {}
      try {
        await mkdir(certDir)
      } catch (err) {}
      await writeFile(`${certDir}/auth.public.pem`, this.certPublic)
      await writeFile(`${certDir}/auth.private.pem`, this.certPrivate)
      await writeFile(`${certDir}/.gitignore`, '*')
      this.certsReady = true
    }
    resolve()
  }

  /**
   * Verify that RSA keys are set in configs and validate/generate users
   */
  async verify(type, id, config) {
    await new Promise(resolve => this.checkRSAKeys(resolve))
    this.verifyKeys(type, id, config)
    await this.verifyUser(type, id, config)
  }

  /**
   * Assign RSA keys to api or auth node configs
   */
  verifyKeys(type, id, config) {
    if (type === 'api' || type === 'auth') {
      config.local.certPublic = this.certPublic
    }
    if (type === 'auth') {
      config.local.certPrivate = this.certPrivate
    }
  }

  /**
   * Generate root user credentials for each core node if none is given -
   * or load them from the generated credentials file
   */
  async verifyUser(type, id, config) {
    if (type === 'core' && !config.provided.userSecret) {
      if (id === 'auth_core') {
        this.resolveUrl(config.provided.mongoUrl || config.local.mongoUrl)
        this.authDb = config.provided.mongoDb || config.local.mongoDb
      }
      await this.checkUser(id, config)
    }
  }

  async checkUser(id, config) {
    let url = await this.authUrl
    let db = await mongodb.connect(url)
    let credentials = {}
    let user_key, user_secret

    // See if user credentials for id are available locally
    try {
      credentials = JSON.parse(await readFile(`${certDir}/credentials.json`, 'utf-8'))
    } catch (err) {}

    // Found user -> Get credentials from stored file
    if (credentials[id]) {
      user_key = credentials[id].user_key
      user_secret = credentials[id].user_secret
    }

    // User not found -> create new, save in db and locally
    else {
      blitz.log.silly(`${id} credentials not found - creating..`)
      user_key = randtoken.uid(64)
      user_secret = randtoken.uid(64)

      // Remove existing user with same id if present
      // This may happen in the case of users accidently losing credentials,
      // thus generating new ones for the same node.
      await db.db(this.authDb).collection('users').deleteOne({ user_id: id })

      // Save in db
      let user = {
        user_key,
        user_secret: await bcrypt.hash(user_secret, 8),
        user_id: id,
        last_ip: [],
        scope: 'write_root',
        refresh_token: user_key + randtoken.uid(256)
      }
      db.db(this.authDb).collection('users').insertOne(user)

      // Append to credentials file
      credentials[id] = {
        user_key,
        user_secret
      }
      await writeFile(`${certDir}/credentials.json`, JSON.stringify(credentials, null, 2))
    }

    config.local.userKey = user_key
    config.local.userSecret = user_secret
    db.close()
  }
}

module.exports = new Auth()

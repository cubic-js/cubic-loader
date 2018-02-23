module.exports = {

  /**
   * Environment options
   */
  environment: process.env.NODE_ENV || 'development',

  /**
   * Logger options
   */
  logLevel: 'verbose',

  /**
   * Security settings
   */
  skipAuthCheck: false // skip automatic user and RSA key creation
}

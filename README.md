[![cubic-loader](https://i.imgur.com/WmDobC0.png)](https://github.com/nexus-devs/cubic-loader)

<p align='center'>Loader for <a href='https://github.com/nexus-devs/cubic'>cubic</a> nodes. The 'magic' behind the framework.</p>

##

[![npm](https://img.shields.io/npm/v/cubic-loader.svg)](https://npmjs.org/cubic-loader)
[![build](https://ci.nexus-stats.com/api/badges/cubic-js/cubic-loader/status.svg)](https://ci.nexus-stats.com/cubic-js/cubic-loader)
[![dependencies](https://david-dm.org/cubic-js/cubic-loader.svg)](https://david-dm.org/cubic-js/cubic-loader)

<br>
<br>

## Usage

```javascript
const loader = require('cubic-loader')
const Auth = require('cubic-auth')
const API = require('cubic-api')
const Core = require('cubic-core')

loader(options) // Generates a global `cubic` object

cubic.use(new Auth()) // Auth server required to authorize the core node to respond to API requests
cubic.use(new API())  // Web API serving requests from core node below
cubic.use(new Core()) // Core node handling all API endpoints
```
This will load an API and Core node to the global cubic object. The nodes can
be accessed via `cubic.nodes.api` and `cubic.nodes.core`. Each node's final
config (i.e. provided options merged with defaults) is accessible via
`cubic.config[node]`.

If we wish to use multiple API/Core nodes for different purposes, we can pass
a group like `{ group: 'analytics' }` to the node constructors, making nodes
accessible via `cubic.nodes.analytics.api` and vice-versa for node configs.

<br>

## Hooks
Hooks allow you to execute functions right before a certain node launches. Within the function, you'll have access to `cubic.config[node]` with all the options you've set in `cubic.use()`.

### Example
```javascript
require('cubic-loader')()
const API = require('cubic-api')

const options = { ferret: 'tobi' }
const hookFn = () => console.log(cubic.config.api.ferret)

cubic.hook(API, hookFn) // Hooks function on provided node
cubic.use(new API(options)) // logs 'tobi', before node is loaded
```
The stack of hook functions will be saved in `cubic.hooks[node]`.

<br>

## Options
```javascript
require('cubic-loader')({ key: value })
```

| Key           | Value         | Description   |
|:------------- |:------------- |:------------- |
| environment   | development   | / |
| environment   | production    | / |
| logLevel      | info          | Default log level. Logs limited information about the node status. |
| logLevel      | error         | Error Log Level. Helpful for automated tests. |
| logLevel      | verbose       | Verbose log level. Includes Request Timestamps, Socket Connections, Config events, etc. |
| logLevel      | silly         | Silly log level. Includes internal information on which routes are being bound, diagnostics and lifecycle details. |

Configuration settings will be accessible via `cubic.config.local`. For configuration of individual nodes, check out their repositories below.

<br>

## Available Nodes
| RepositoryLink          | Description   |
|:------------- |:------------- |
| [cubic-api](https://github.com/nexus-devs/cubic-api) | RESTful API with WebSocket support which authorizes and distributes requests to core nodes. |
| [cubic-core](https://github.com/nexus-devs/cubic-core) | Resource Server for simple endpoint implementation to the API node. |
| [cubic-auth](https://github.com/nexus-devs/cubic-auth) | Authentication Server for creating users and providing JSON Web Tokens to grant authorization on the API node.
| [cubic-ui](https://github.com/nexus-devs/cubic-ui) | View node for rendering web pages.

<br>

## License
[MIT](/LICENSE)

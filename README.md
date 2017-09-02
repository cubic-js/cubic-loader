# blitz-js-loader

##

<br>

## Example

```javascript
require("blitz-js-loader")()

const Auth = require("blitz-js-auth")
blitz.use(new Auth()) // Authentication server which generates user tokens

const API = require("blitz-js-api")
blitz.use(new API()) // Public api node which will get data from the resource node below

const Core = require("blitz-js-core")
blitz.use(new Core()) // Resource node which processes your application logic
```
Now visit `localhost:3010/foo` to get your `bar`.

<br>

## Available Nodes
| RepositoryLink          | Description   |
|:------------- |:------------- |
| [blitz-js-api](https://github.com/nexus-devs/blitz-js-api) | RESTful API with WebSocket support which authorizes and distributes requests to the resource node. |
| [blitz-js-core](https://github.com/nexus-devs/blitz-js-core) | Resource Server for simple endpoint implementation to the API node. |
| [blitz-js-auth](https://github.com/nexus-devs/blitz-js-auth) | Authentication Server for creating users and providing JSON Web Tokens to grant authorization on the API node.
| [blitz-js-view](https://github.com/nexus-devs/blitz-js-view) | View node for rendering web pages.

<br>

## Configuration
```javascript
require("blitz-js")({ key: value })
```

| Key           | Value         | Description   |
|:------------- |:------------- |:------------- |
| environment   | development   | / |
| environment   | production    | / |
| logLevel      | info          | Default log level. Logs limited information about the node status. |
| logLevel      | error         | Error Log Level. Helpful for automated tests. |
| logLevel      | verbose       | Verbose log level. Includes Request Timestamps, Socket Connections, Config events, etc. |
| logLevel      | silly         | Silly log level. Includes internal information on which routes are being bound, diagnostics and lifecycle details. |

Configuration settings will be accessible via `blitz.config.local`. For configuration of individual nodes, check out their repositories below.

<br>

## Hooks
Hooks allow you to execute functions right before a certain node launches. Within the function, you'll have access to `blitz.config[node]` with all the options you've set in `blitz.use()`.

### Example
```javascript
require("blitz-js")()

let options = { ferret: "tobi" }
let hookFn = () => console.log(blitz.config.api.ferret)

let API = require("blitz-js-api")
blitz.hook(API, hookFn)
blitz.use(new API(options)) // logs "tobi"
```
The stack of hook functions will be saved in `blitz.nodes[node].hooks`.

<br>

## License
[MIT](/LICENSE)

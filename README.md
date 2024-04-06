Rialto Chat
===========================================

Rialto Chat is an Electron chat client for the LCC Rialto network. As well as being the current official Rialto client, it's a the reference which demonstrates Rialto RPC API usage.

Running it
--------------

You need a full Litecoin Cash node running, with RPC access details configured in litecoincash.conf.

You also need Node.js installed. In a Linux environment, we recommend using nvm, the Node Version Manager.

Clone this repo, then:

```
npm install
npm start
```

Configuring it
--------------

Edit settings.json in the Rialto application data directory to provide RPC details (username, password, IP, port) for the LCC wallet.

By default this directory is:

- %APPDATA% on Windows
- $XDG_CONFIG_HOME or ~/.config on Linux
- ~/Library/Application Support on macOS

Packaging it
--------------

Building on Windows, Linux or MacOS should produce installers for the platform you built on, in the /out directory.

To build, do:

```
npm make
```


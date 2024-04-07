// Rialto chat client
// Tanner, 2024

// Main app entrypoint and IPC handler

const { app } = require('electron');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const { ipcMain, BrowserWindow, Menu, Tray, Notification } = require('electron');
const path = require('node:path')
const rpc = require('node-json-rpc2');
const fs = require('fs');
const Alert = require("electron-alert");

// Globals
let alert = new Alert(), alert2 = new Alert(), alert3 = new Alert(); // electro-alert is handy but can't handle multiple chained alerts
let appWindow;
let appIcon;
let client;
let clientLongpoll;
let clientArgs = {};

// ****************************************************************
// Instantiators and entrypoint
// ****************************************************************

// App window creation
let focused = true;
const createWindow = () => {
    appWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        },
		frame: false,
		autoHideMenuBar: true,
		logo: path.join(__dirname, 'img/logo.png')
    });

	appWindow.on('focus', () => {
		focused = true;
	})

	appWindow.on('blur', () => {
		focused = false;
	})

	// Fix notification titles
	if (process.platform === 'win32') {
		app.setAppUserModelId(app.name);
	}

    appWindow.loadFile('index.html');
}

// App tray icon creation
const createAppIcon = () => {
	appIcon = new Tray(path.join(__dirname, 'img/logo.png'));
	const contextMenu = Menu.buildFromTemplate([
		{ 
			label: 'Show',
			click: function() {
				appWindow.show();
				appIcon.destroy();
			}
		},
		{
			label: 'Quit',
			click: function() {
				app.isQuiting = true;
				app.quit();
			}
		}
	]);
	appIcon.setToolTip('Rialto');
	appIcon.setContextMenu(contextMenu);
	appIcon.on('click', function() {
		appWindow.show();
		appIcon.destroy();
	});
}

// Entrypoint
app.whenReady().then(() => {
	// Don't run more than one instance
	if (!app.requestSingleInstanceLock())
		app.quit();

	// Create/load config	
	const settingsPath = path.join(app.getPath('userData'), 'settings.json');
	if (fs.existsSync(settingsPath)) {
		const settingsData = fs.readFileSync(settingsPath, 'utf8');
		clientArgs = JSON.parse(settingsData);
	} else {
		// Write default settings
		clientArgs = {
			host: "127.0.0.1",
			port: 9000,
			user: "rpctest",
			password: "rpctest"		
		};

		fs.writeFileSync(settingsPath, JSON.stringify(clientArgs));
	}
	
	// Create window
    createWindow();

	// Create RPC clients
	client = new rpc.Client(clientArgs);
	clientLongpoll = new rpc.Client(clientArgs);

	// If we're activated and there are no windows, create one (macos)
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    })
});

// ****************************************************************
// Window control
// ****************************************************************

// Handle window close
app.on('window-all-closed', () => {
    app.quit();
});

// Close 
ipcMain.on("close-app", (event) => {
    appWindow.close();
});

// Minimise to tray
ipcMain.on("minimise-app", (event) => {
	if (process.platform === 'darwin')
		appWindow.minimize();
	else {
		appWindow.hide();	// Minimise to tray: Hide the window and set context menu
		createAppIcon();
	}
});

// ****************************************************************
// Helpers
// ****************************************************************

// Show a cute call-to-action when no nick is registered
ipcMain.handle("no-nick-message", (e) => {
	return new Promise((resolve, reject) => {
		alert.fireFrameless({
			title: "No nick registered",
			text: "You don't have a registered nick yet. Register one to start chatting with others.",
			icon: 'info',
			buttons: ['OK']
		}, null, true, false).then(() => {
			resolve(true);
		});
	});
});

// Get window focused state
ipcMain.handle("is-window-focused", (e) => {
	return new Promise((resolve, reject) => {
		resolve(focused);
	});
});

// ****************************************************************
// Rialto Messaging API
//
// These calls match 1:1 with the Rialto API calls in the wallet.
// ****************************************************************

// Get all Rialto nicks that the connected wallet has privkeys for
ipcMain.handle("rialtogetmynicks", (e) => {
	return new Promise((resolve, reject) => {
		client.call({
			method: "rialtogetmynicks",
			params: [],
			id: 1
		}, (err, res) => {
			if (err) {
				console.log("** Error getting nicks: ", err);
				alert.fireFrameless({
					title: "Couldn't get local nicks",
					text: "Can't connect to the local LCC wallet; Rialto will exit.",
					icon: 'error',
					buttons: ['OK']
				}, null, true, false).then(() => {
					app.quit();
				});
			} else {
				resolve(res.result);
			}
		});
	});
});

// Send a Rialto message
ipcMain.handle("rialtoencrypt", (e, fromNick, toNick, message) => {
	return new Promise((resolve, reject) => {
		client.call({
			method: "rialtoencrypt",
			params: [fromNick, toNick, message],
			id: 1
		}, (err, res) => {
			if (err) {
				console.log("** Error sending message: ", err.message);
				alert.fireFrameless({
					title: "Error sending message",
					text: err.message,
					icon: 'error',
					buttons: ['OK']
				}, null, true, false);
				reject(err);
			} else {
				resolve(res.result);
			}
		});
	});
});

// Get all waiting Rialto messages via longpoll
ipcMain.handle("rialtogetincomingmessages", (e) => {
	return new Promise((resolve, reject) => {
		clientLongpoll.call({
			method: "rialtogetincomingmessages",
			params: [],
			id: 1
		}, (err, res) => {
			if (err) {
				console.log("** Error longpolling for messages: ", err);
				reject(err);
			} else {
				for (let m of res.result) {
					// Show notifications if app window hidden or not focused
					if (!appWindow.isVisible()) {
						const messageSummary = m.message.length > 40 ? m.message.slice(0, 40) + "..." : m.message;

						new Notification({
							title: m.from_nick,
							body: messageSummary,
							icon: path.join(__dirname, 'img/logo.png'),
							silent: true,	// Don't play sound (we're doing our own)
						}).show();
					}
				}

				resolve(res.result);
			}
		});
	});
});

// Check if a nick is registered (used when starting a new chat)
ipcMain.handle("rialtoisnickregistered", (e, nick) => {
	return new Promise((resolve, reject) => {
		client.call({
			method: "rialtoisnickregistered",
			params: [nick],
			id: 1
		}, (err, res) => {
			if (err) {
				console.log("** Error checking nick: ", err.message);
				alert.fireFrameless({
					title: "Error searching White Pages",
					text: err.message,
					icon: 'error',
					buttons: ['OK']
				}, null, true, false);
				reject(err);
			} else {
                if (!res.result) {
                    alert2.fireFrameless({
						title: 'Nick not registered',
                        text: nick + ' is not registered.',
                        icon: 'info',
                        buttons: ['OK']
                    }, null, true, false);
                }
				resolve(res.result);
			}
		});
	});
});

// Block a nick (with user confirmation)
ipcMain.handle("rialtoblocknick", (e, nick) => {
	return new Promise((resolve, reject) => {
		alert.fireFrameless({
			title: "Block " + nick + "?",
			text: "Do you really want to block this user?",
			icon: 'warning',
			showCancelButton: true,
		}, null, true, false).then((result) => {
			if (!result.isConfirmed) {
				resolve(false);
			} else {
				client.call({
					method: "rialtoblocknick",
					params: [nick],
					id: 1
				}, (err, res) => {
					if (err) {
						console.log("** Error blocking nick: ", err.message);
						alert2.fireFrameless({
							title: "Error blocking nick",
							text: err.message,
							icon: 'error',
							buttons: ['OK']
						}, null, true, false);
						reject(err);
					} else {				
						resolve(true);
					}
				});
			}
		});
	});
});

// Unlock wallet (with user input for the passphrase)
// Horrid flow is because electron-alert kinda sucks to not support preConfirm.
ipcMain.handle("walletpassphrase", (e) => {
	return new Promise((resolve, reject) => {
		// First form: Ask user to choose between full unlock and Rialto unlock
		alert.fireFrameless({
			title: "Unlock wallet",
			text: "Choose unlock type:",
			icon: 'info',
			input: 'radio',
			inputOptions: {
				'rialto': '<strong>Limited unlock</strong><br>(For Rialto messaging and Hive Mining only)',
				'full': '<strong>Full unlock</strong><br>(For nick registration and fund transfer, 2 mins only)'
			},
			inputValue: 'rialto',
			showCancelButton: true,
		}, null, true, false).then((result) => {
			if (!result.isConfirmed) {
				resolve(false);
			} else {
				const doFullUnlock = result.value === 'full';

				// Second form: Ask user for passphrase
				alert2.fireFrameless({
					title: "Unlock wallet",
					text: "Enter your wallet passphrase:",
					icon: 'info',
					input: 'password',
					inputPlaceholder: 'Passphrase',
					showCancelButton: true,
				}, null, true, false).then((result) => {
					if (!result.isConfirmed) {
						resolve(false);
					} else {
						const passphrase = result.value;
						let opts;
						if (doFullUnlock) {
							opts = {
								method: "walletpassphrase",
								params: [passphrase, 120],
								id: 1
							} 
						} else {
							opts = {
								method: "walletpassphrase_hive_rialto",
								params: [passphrase],
								id: 1
							};
						}
						
						client.call(opts, (err, res) => {
							if (err) {
								console.log("** Error unlocking wallet: ", err.message);
								alert3.fireFrameless({
									title: "Error unlocking wallet",
									text: err.message,
									icon: 'error',
									buttons: ['OK']
								}, null, true, false);
								reject(err);
							} else {
								alert3.fireFrameless({
									title: "Wallet unlocked",
									text: "Wallet unlocked successfully.",
									icon: 'info',
									buttons: ['OK']
								}, null, true, false);
								resolve(true);
							}
						});
					}
				});
			}
		});
	});
});

// Rebuild white pages (with user confirmation)
ipcMain.handle("rialtorebuildwhitepages", (e) => {
	return new Promise((resolve, reject) => {
		alert.fireFrameless({
			title: "Rebuild White Pages?",
			text: "Do you really want to rebuild the White Pages? This could take a few minutes.",
			icon: 'warning',
			showCancelButton: true,
		}, null, true, false).then((result) => {
			if (!result.isConfirmed) {
				resolve(false);
			} else {
				client.call({
					method: "rialtorebuildwhitepages",
					params: [],
					id: 1
				}, (err, res) => {
					if (err) {
						console.log("** Error rebuilding white pages: ", err.message);
						alert2.fireFrameless({
							title: "Error rebuilding White Pages",
							text: err.message,
							icon: 'error',
							buttons: ['OK']
						}, null, true, false).then(() => {
							reject(err);
						});
					} else {				
						alert2.fireFrameless({
							title: "White Pages rebuilt",
							text: "White Pages rebuilt successfully.",
							icon: 'info',
							buttons: ['OK']
						}, null, true, false).then(() => {
							resolve(true);
						});
					}
				});
			}
		});
	});
});

// Register a nick (asking user the nick they want)
ipcMain.handle("rialtoregisternick", (e) => {
	return new Promise((resolve, reject) => {
		alert.fireFrameless({
			title: "Register a nick",
			text: "Please enter the nick you want to register. If your wallet contains sufficient funds, the nick will be registered and available for use after 1 block.\n\nPlease note that 3 and 4-letter nicks cost more; check the prices before proceeding!",
			icon: 'info',
			input: 'text',
			inputPlaceholder: 'New nickname',
			showCancelButton: true,
		}, null, true, false).then((result) => {
			if (!result.isConfirmed) {
				resolve(false);
			} else {
				client.call({
					method: "rialtoregisternick",
					params: [result.value],
					id: 1
				}, (err, res) => {
					if (err) {
						console.log("** Error registering nick: ", err.message);
						alert2.fireFrameless({
							title: "Error registering nick",
							text: err.message,
							icon: 'error',
							buttons: ['OK']
						}, null, true, false).then(() => {
							reject(err);
						});
					} else {				
						alert2.fireFrameless({
							title: "Nick registered",
							text: "Nick registered successfully. After the next block, you can refresh your local nicks and start using it.",
							icon: 'info',
							buttons: ['OK']
						}, null, true, false).then(() => {
							resolve(true);
						});
					}
				});
			}
		});
	});
});

// Unblock a nick
ipcMain.handle("rialtounblocknick", (e, nick) => {
	return new Promise((resolve, reject) => {
		client.call({
			method: "rialtounblocknick",
			params: [nick],
			id: 1
		}, (err, res) => {
			if (err) {
				console.log("** Error unblocking nick: ", err.message);
				alert.fireFrameless({
					title: "Error unblocking nick",
					text: err.message,
					icon: 'error',
					buttons: ['OK']
				}, null, true, false);
				reject(err);
			} else {
				resolve(res.result);
			}
		});
	});
});

// Get blocked nicks
ipcMain.handle("rialtogetblockednicks", (e) => {
	return new Promise((resolve, reject) => {
		client.call({
			method: "rialtogetblockednicks",
			params: [],
			id: 1
		}, (err, res) => {
			if (err) {
				console.log("** Error getting blocked nicks: ", err.message);
				alert.fireFrameless({
					title: "Error getting blocked nicks",
					text: err.message,
					icon: 'error',
					buttons: ['OK']
				}, null, true, false);
				reject(err);
			} else {
				resolve(res.result);
			}
		});
	});
});

// Check if wallet's either unencrypted or unlocked for messaging
ipcMain.handle("walletcandecryptrialto", (e) => {
	return new Promise((resolve, reject) => {
		client.call({
			method: "walletcandecryptrialto",
			params: [],
			id: 1
		}, (err, res) => {
			if (err) {
				console.log("** Error checking wallet unlock: ", err.message);
				reject(err);
			} else {
				resolve(res.result);
			}
		});
	});
});
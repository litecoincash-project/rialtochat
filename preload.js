// Rialto chat client
// Tanner, 2024

// Bridge API calls made from init.js to main process

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
	// ****************************************************************
	// Window control
	// ****************************************************************
	closeApp: () => {
		return ipcRenderer.send("close-app");
	},
	minimiseWindow: () => {
		return ipcRenderer.send("minimise-app");
	},
	isWindowFocused: () => {
		return ipcRenderer.send("is-window-focused");
	},

	// ****************************************************************
	// Helpers
	// ****************************************************************
	showNoNickMessage: () => {
		return ipcRenderer.invoke("no-nick-message");
	},
	
	// ****************************************************************
	// Rialto Messaging API
	// ****************************************************************
	getMyNicks: () => {
		return ipcRenderer.invoke("rialtogetmynicks");
	},
	nickIsRegistered: (nick) => {
		return ipcRenderer.invoke("rialtoisnickregistered", nick);
	},
	sendMessage: (fromNick, toNick, message) => {
		return ipcRenderer.invoke("rialtoencrypt", fromNick, toNick, message);
	},
	getMessages: () => {
		return ipcRenderer.invoke("rialtogetincomingmessages");
	},
	getBlockedNicks: () => {
		return ipcRenderer.invoke("rialtogetblockednicks");
	},
	blockNick: (nick) => {
		return ipcRenderer.invoke("rialtoblocknick", nick);
	},
	unblockNick: (nick) => {
		return ipcRenderer.invoke("rialtounblocknick", nick);
	},
	rebuildWhitePages: () => {
		return ipcRenderer.invoke("rialtorebuildwhitepages");
	},
	registerNick: () => {
		return ipcRenderer.invoke("rialtoregisternick");
	},
	unlockWallet: () => {
		return ipcRenderer.invoke("walletpassphrase");
	},
	canDecrypt: () => {
		return ipcRenderer.invoke("walletcandecryptrialto");
	},
});

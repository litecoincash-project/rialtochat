// Rialto chat client
// Tanner, 2024

// Event listeners

// Nicks available for this node to send as
let myNicks = [];

// Handle unblock nick button click from the modal
document.addEventListener("click", async (e) => {
    if (!e.target.classList.contains("unblockNick"))
        return;

    const nick = e.target.getAttribute("data-nick");
    await window.api.unblockNick(nick).then((result) => {
        if (result == false)
            return;

        // Remove the nick from the modal
        e.target.closest(".blockListRow").remove();
    }).catch((err) => {
        console.log("** Error unblocking nick: ", err);
    });
});

// Handle close modal button
document.getElementById("blockListModalClose").addEventListener("click", async (e) => {
    document.getElementById("blockListModal").style.display = "none";
});

// Handle rebuild white pages button click
document.addEventListener("click", async (e) => {
    if (!e.target.classList.contains("rebuildWhitePages"))
        return;

    await window.api.rebuildWhitePages().catch((err) => {
        console.log("** Error rebuilding white pages: ", err);
    });
});

// Handle register nick button click
document.addEventListener("click", async (e) => {
    if (!e.target.classList.contains("registerNick"))
        return;

    await window.api.registerNick().then((result) => {
        if (result == false)
            return;

        RefreshNicks();
    }).catch((err) => {
        console.log("** Error registering nick: ", err);
    });
});

// Handle manageBlockList button click. Call the API to get the block list and display it in a modal
// with an unblock button next to each nick.
document.addEventListener("click", async (e) => {
    if (!e.target.classList.contains("manageBlocklist"))
        return;

    const blockedNicks = await window.api.getBlockedNicks().catch((err) => {
        console.log("** Error getting blocked nicks: ", err);
    });

    blockedNicks.sort();

    const modal = document.getElementById("blockListModal");
    const modalBody = modal.querySelector(".modal-body");
    modalBody.innerHTML = "";

    // Show empty message
    if (blockedNicks.length === 0) {
        const div = document.createElement("div");
        div.innerHTML = "No blocked nicks";
        modalBody.appendChild(div);
    } else {
        // List em out
        for (let nick of blockedNicks) {
            const div = document.createElement("div");
            div.classList.add("blockListRow");
            div.innerHTML = `
                <div class="nick">${nick}</div>
                <button class="btn btn-warning unblockNick" data-nick="${nick}">Unblock</button>
            `;
            modalBody.appendChild(div);
        }
    }

    // Show the modal
    modal.style.display = "block";
});

// Refresh nicks
const RefreshNicks = async () => {
    myNicks = await window.api.getMyNicks();
    //myNicks.sort();         // Don't sort, have them in the order they were added and autoselect the latest

    const select = document.getElementById("sendingNick");
    select.innerHTML = "";
    for (let nick of myNicks) {
        const option = document.createElement("option");
        option.value = nick;
        option.textContent = nick;
        select.appendChild(option);
    }

    // Autoset the bottom
    select.selectedIndex = myNicks.length - 1;
};

// Handle unlock wallet button click
document.addEventListener("click", async (e) => {
    if (!e.target.classList.contains("unlockWallet"))
        return;

    window.api.unlockWallet().then((result) => {
        if (result == false)
            return;

        document.getElementById("unlockWalletIcon").classList.remove("walletIsLocked");
    }).catch((err) => {
        console.log("** Error unlocking wallet: ", err);
    });
});

// Handle refresh nicks button click
document.addEventListener("click", async (e) => {
    if (!e.target.classList.contains("refreshMyNicks"))
        return;

    RefreshNicks();
});

// Close a chat
document.addEventListener("click", async (e) => {
    if (!e.target.classList.contains("chatClose"))
        return;

    const chatWindow = e.target.closest(".chatWindow");
    const chatSelector = document.getElementById(`li-${chatWindow.id}`);
    chatWindow.remove();
    chatSelector.remove();

    // If that was the last chat window, focus newChatNick
    const chatWindows = document.getElementsByClassName("chatWindow");
    if (chatWindows.length === 0)
        document.getElementById("newChatNick").focus();
});

// Block a contact
document.addEventListener("click", async (e) => {
    if (!e.target.classList.contains("chatBlock"))
        return;

    const nick = e.target.closest(".chatWindow").id;

    await window.api.blockNick(nick).then((result) => {
        if (result == false)
            return;

        const chatWindow = e.target.closest(".chatWindow");
        const chatSelector = document.getElementById(`li-${chatWindow.id}`);
        chatWindow.remove();
        chatSelector.remove();

        // If that was the last chat window, focus newChatNick
        const chatWindows = document.getElementsByClassName("chatWindow");
        if (chatWindows.length === 0)
            document.getElementById("newChatNick").focus();
    });
});

// Select a chat from LHS
document.addEventListener("click", async (e) => {
    if (!e.target.classList.contains("chatSelector"))
        return;

    // Hide all other chat windows
    const nick = e.target.id.split("-")[1];
    const chatWindows = document.getElementsByClassName("chatWindow");
    for (let i = 0; i < chatWindows.length; i++) {
        chatWindows[i].style.display = "none";
    }

    // Remove activeChat class from everything
    const chatSelectors = document.getElementsByClassName("chatSelector");
    for (let i = 0; i < chatSelectors.length; i++)
        chatSelectors[i].classList.remove("activeChat");

    // Show selected chat and focus the input
    const chatWindow = document.getElementById(nick);
    chatWindow.style.display = "block";
    chatWindow.querySelector("input").focus();

    // Add activeChat class to selected chat
    e.target.classList.add("activeChat");
    e.target.classList.remove("highlightedChat");
});

// Longpoll for incoming messages
const LongPoll = async () => {
    console.log("Longpolling for incoming messages...");

    window.api.getMessages().then((messages) => {
        if (messages.length > 0)
            for (let m of messages)
                IncomingMessage(m.from_nick, m.to_nick, m.message, m.timestamp);

        // Immediately start polling again (don't just call it though, not out here trying to bust the stack)
        setTimeout(LongPoll, 5);

    }).catch((err) => {
        console.log("** Error longpolling: ", err);
        console.log("** Will retry in 5 seconds");
        setTimeout(LongPoll, 5000);
    });
}

// Doc loaded handler
document.addEventListener("DOMContentLoaded", async () => {
    // Focus contact finder
    document.getElementById("newChatNick").focus();

    // Get our nicks
    RefreshNicks();

    // Check lock status
    const canDecrypt = await window.api.canDecrypt();
    if (!canDecrypt)
        document.getElementById("unlockWalletIcon").classList.add("walletIsLocked");

    // Start longpolling
    LongPoll();
});

// Handle message send
document.addEventListener("keyup", async (e) => {
    if (e.key !== "Enter" || !e.target.classList.contains("message-box"))
        return;
    
    const message = e.target.value;
    const chatWindow = e.target.closest(".chatWindow");
    const toNick = chatWindow.id;
    const sendingNick = document.getElementById("sendingNick").value;
    
    e.target.value = "";    // Clear it now -- we'll put it back if there was an error...
    await window.api.sendMessage(sendingNick, toNick, message).then((result) => {
        // Add message to chat window
        const timestamp = new Date(result * 1000).toLocaleTimeString();
        const chatMessages = chatWindow.querySelector(".chatMessages");
        const messageDiv = document.createElement("div");
        messageDiv.classList.add("sentMessage");
        messageDiv.innerHTML = `
            ${message}
            <br><span class="messageTimestamp">${timestamp}</span>
        `;
    
        chatMessages.appendChild(messageDiv);
    
        // Scroll to bottom of chat window
        chatMessages.scrollTop = chatMessages.scrollHeight;
    
        // Set lastMessage in chatselector to be a few words with an ellipsis
        const chatSelector = document.getElementById(`li-${toNick}`);
        const lastMessage = chatSelector.querySelector(".lastMessage");
        lastMessage.textContent = "(You) ";
        lastMessage.textContent += message.length > 20 ? message.slice(0, 20) + "..." : message;
    
        // Move chatSelector to the top of the list (but below the new chat input field)
        const chatList = document.getElementById("chatList");
        chatList.insertBefore(chatSelector, chatList.children[1]);
    }).catch((err) => {
        e.target.value = message;  // Put the message back in case they want to correct it
        console.log("** Error sending message: ", err);
    });
});

// Handle message receive
const IncomingMessage = async (fromNick, toNick, message, timestamp) => {
    // Find chatwindow
    let chatWindow = document.getElementById(fromNick);

    // If chatwindow doesn't exist, create it (but wait for user to click on it to show it)
    if (!chatWindow) {
        chatWindow = await MakeNewChatWindow(fromNick);
        chatWindow.style.display = "none";
    }

    // Add message to chat window
    timestamp = new Date(timestamp * 1000).toLocaleTimeString();
    const chatMessages = chatWindow.querySelector(".chatMessages");
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("receivedMessage");
    messageDiv.innerHTML = `
        ${message}
        <br><span class="messageTimestamp">${timestamp}</span>
    `;
    chatMessages.appendChild(messageDiv);

    // Scroll to bottom of chat window
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Set lastMessage in chatselector to be a few words with an ellipsis
    const chatSelector = document.getElementById(`li-${fromNick}`);
    const lastMessage = chatSelector.querySelector(".lastMessage");
    lastMessage.textContent = message.length > 30 ? message.slice(0, 30) + "..." : message;

    // Move chatSelector to the top of the list (but below the new chat input field)
    const chatList = document.getElementById("chatList");
    chatList.insertBefore(chatSelector, chatList.children[1]);

    // Bold the chatSelector unless it's the active chat
    if (!chatSelector.classList.contains("activeChat"))
        chatSelector.classList.add("highlightedChat");

    // Play a ding if either chat window is not focused, or this is not the active chat
    const windowFocused = await window.api.isWindowFocused();
    if (!windowFocused || !chatSelector.classList.contains("activeChat"))
        new Audio("sounds/ding.ogg").play();
}

// Make a new chat window, for chat initiated locally or by a received message
const MakeNewChatWindow = async (nick) => {
    // Add a new chat window to chatContainer div
    const chatContainer = document.getElementById("chatContainer");
    const chatWindow = document.createElement("div");
    chatWindow.classList.add("chatWindow");
    chatWindow.id = nick;

    const html = `
        <div class="chatHeader">
            <h3><minidenticon-svg username="${nick}" saturation="87" lightness="73" class="avatar img-circle media-object pull-left"></minidenticon-svg> ${nick}</h3>
        </div>
        <div class="chatButtonsContainer">
            <div class="btn-group">
                <button class="btn btn-large btn-default chatBlock" title="Block this user">
                    <span class="icon icon-block chatBlock"></span>
                </button>
                <button class="btn btn-large btn-default chatClose" title="Close this chat">
                    <span class="icon icon-cancel chatClose"></span>
                </button>
            </div>
        </div>
        <div class="chatMessages"></div>
        <div class="chatInputContainer">
            <input type="text" class="form-control message-box" placeholder="Message">
        </div>
    `;

    chatWindow.innerHTML = html;

    // Append to container
    chatContainer.appendChild(chatWindow);
    
    // Add li to chatlist
    const chatList = document.getElementById("chatList");
    const li = document.createElement("li");
    li.classList.add("list-group-item");
    li.classList.add("chatSelector");

    li.id = `li-${nick}`;
    const liHtml = `
        <minidenticon-svg username="${nick}" saturation="87" lightness="73" class="avatar img-circle media-object pull-left"></minidenticon-svg>
        <div class="media-body">
            <strong>${nick}</strong>
            <p class="lastMessage">(New chat)</p>
        </div>
    `;

    li.innerHTML = liHtml;
    chatList.appendChild(li);

    return chatWindow;
}

// Handle new chat
document.getElementById("newChatNick").addEventListener("keyup", async (e) => {
    if (e.key !== "Enter")
        return;
    
    if (myNicks.length === 0) {    
        await window.api.showNoNickMessage();
        return;
    }

    const nick = document.getElementById("newChatNick").value.toLowerCase().trim();

    // Already open? activate it
    let chatWindow = document.getElementById(nick);
    if (chatWindow) {
        // Hide others
        const chatWindows = document.getElementsByClassName("chatWindow");
        for (let i = 0; i < chatWindows.length; i++)
            chatWindows[i].style.display = "none";

        // Show this one
        chatWindow.style.display = "block";
        chatWindow.querySelector("input").focus();

        // Remove activeChat class from everything
        const chatSelectors = document.getElementsByClassName("chatSelector");
        for (let i = 0; i < chatSelectors.length; i++)
            chatSelectors[i].classList.remove("activeChat");

        // Put activeChat on the LHS chat selector
        const chatSelector = document.getElementById(`li-${nick}`);
        chatSelector.classList.add("activeChat");

        // Clear newChatNick input
        document.getElementById("newChatNick").value = "";

        return;
    }

    // Check if nick is registered
    const isRegistered = await window.api.nickIsRegistered(nick);
    if (!isRegistered)
        return;

    // Make a new chat window
    chatWindow = await MakeNewChatWindow(nick);

    // Hide all other chat windows
    const chatWindows = document.getElementsByClassName("chatWindow");
    for (let i = 0; i < chatWindows.length; i++)
        chatWindows[i].style.display = "none";

    // Show this one
    chatWindow.style.display = "block";

    // Remove activeChat class from everything
    const chatSelectors = document.getElementsByClassName("chatSelector");
    for (let i = 0; i < chatSelectors.length; i++)
        chatSelectors[i].classList.remove("activeChat");

    // Put activeChat on the LHS chat selector
    const chatSelector = document.getElementById(`li-${nick}`);
    chatSelector.classList.add("activeChat");

    // Clear newChatNick input
    document.getElementById("newChatNick").value = "";

    // Focus the input field on the new chat window
    chatWindow.querySelector("input").focus();
});

// Handle window control buttons
document.getElementById("closeWindow").addEventListener("click", async (e) => {
    window.api.closeApp();
});
document.getElementById("minimiseWindow").addEventListener("click", async (e) => {
    window.api.minimiseWindow();
});

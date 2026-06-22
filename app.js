import * as sdk from "https://esm.sh/matrix-js-sdk?bundle";

let client;
let currentRoomId = null;
let refreshInterval = null;

const trashIcon = `
        <svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24"  
        fill="#ffffff" viewBox="0 0 24 24" >
        <path d="M17 6V4c0-1.1-.9-2-2-2H9c-1.1 0-2 .9-2 2v2H2v2h2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8h2V6zM9 4h6v2H9zM6 20V8h12v12z"></path><path d="M9 10h2v8H9zm4 0h2v8h-2z"></path>
        </svg>
`;

const sendIcon = `
        <svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24"  
        fill="#ffffff" viewBox="0 0 24 24" >
        <path d="M20.56 3.17c-.29-.2-.67-.23-.99-.08l-17 8.01a.999.999 0 0 0 .03 1.82L8 15.28V22l5.84-4.17 4.76 2.08c.13.06.26.08.4.08.18 0 .36-.05.52-.15a.99.99 0 0 0 .48-.79l1-15c.02-.35-.14-.69-.43-.89Zm-2.47 14.34-5.21-2.28L16 9l-7.65 4.25-2.93-1.28 13.47-6.34-.79 11.89Z"></path>
        </svg>
`;

console.log(
    "%cDUR!\n\n" +
    "%cEğer birisi size buraya bir şey kopyalayıp yapıştırmanızı söylediyse,\n" +
    "%cdolandırılıyor olma olasılığınız yüksektir!\n\n" +
    "%cEğer ne yapacağınızdan eminseniz, devam edebilirsiniz.",

    "color: red; font-size: 22px; font-weight: bold;",

    "color: #ff3b30; font-size: 14px; font-weight: normal;",

    "color: #ff0000; font-size: 16px; font-weight: bold;",

    "color: gray; font-size: 12px; font-style: italic;"
);

function updateSendButton() {
    const input = document.getElementById("messageBox");
    const btn = document.getElementById("sendMessageBtn");

    console.log("INPUT:", input?.value, "BTN:", btn);

    if (!input || !btn) return;

    btn.disabled = input.value.trim() === "";
}

function startChatAutoRefresh() {

    if (refreshInterval) clearInterval(refreshInterval);

    refreshInterval = setInterval(() => {

        if (!client) return;

        loadChats();

    }, 5000); // 5 saniye

}

// --------------------
// RENDERING INPUT
// --------------------
function renderInput(room) {

    const inputBox = document.getElementById("inputBox");

    if (canSendMessage(room)) {

        inputBox.innerHTML = `
            <input id="messageBox" type="text" placeholder="Mesaj yaz...">
            <button id="sendMessageBtn" onclick="sendMessage()" disabled>Gönder</button>
        `;

        const input = document.getElementById("messageBox");

        input.addEventListener("input", updateSendButton);
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") sendMessage();
        });

        updateSendButton(); // ilk durum kontrolü

    } else {
        inputBox.innerHTML = `
            <div class="no-permission">
                Bu kullanıcıya mesaj gönderme izniniz yok
            </div>
        `;
    }
}

// --------------------
// LOGIN CHECK
// --------------------
if (!localStorage.getItem("mx_token")) {
    window.location.href = "login/";
}

// --------------------
// INIT CLIENT
// --------------------
function init() {

    client = sdk.createClient({
        baseUrl: "https://matrix.org",
        accessToken: localStorage.getItem("mx_token"),
        userId: "@" + localStorage.getItem("mx_user") + ":matrix.org"
    });

    window.client = client;

    client.startClient();

    // 🔥 İlk sync
    client.once("sync", (state) => {
        if (state === "PREPARED") {
            loadChats();
            startChatAutoRefresh();
        }
    });

    // 🔥 ODA GÜNCELLEME (EN ÖNEMLİ KISIM)
    client.on("Room", () => {
        loadChats();
    });

    // 🔥 LIVE MESAJ
    client.on("Room.timeline", (event, room) => {

        if (room.roomId !== currentRoomId) return;
        if (event.event.type !== "m.room.message") return;

        addMessage(event.event);
    });
}

// --------------------
// LOAD CHATS (ROOM LIST)
// --------------------
function loadChats() {

    const rooms = client.getRooms().filter(
        room => room.getMyMembership() !== "leave"
    );
    const chatList = document.getElementById("chatList");

    if (!chatList) return;

    chatList.innerHTML = "";

    rooms.forEach(room => {

        const isDM = room.getJoinedMembers().length === 2;

        const div = document.createElement("div");
        div.className = "chat-item";

        div.innerHTML = `
            <div class="chat-name">
                ${isDM ? "💬" : "👥"} ${room.name || room.roomId}
            </div>
            <div class="chat-sub">
                ${room.roomId}
            </div>
        `;

        div.onclick = () => openRoom(room.roomId);

        chatList.appendChild(div);
    });
}

// --------------------
// OPEN ROOM
// --------------------
function openRoom(roomId) {

    currentRoomId = roomId;

    const room = client.getRoom(roomId);

    if (!room || room.getMyMembership() !== "join") {
        document.getElementById("messages").innerHTML =
            "Bu odadan ayrıldınız.";
        return;
    }

    document.getElementById("roomTitle").innerText =
        room.name || room.roomId;

    // 🔥 BURASI YENİ
    renderInput(room);

    const messages = document.getElementById("messages");
    messages.innerHTML = "";

    room.timeline.forEach(event => {
        if (event.event.type === "m.room.message") {
            addMessage(event.event);
        }
    });
}

// --------------------
// SEND MESSAGE
// --------------------
async function sendMessage() {

    const input = document.getElementById("messageBox");

    if (!currentRoomId || !input.value.trim()) return;

    await client.sendEvent(currentRoomId, "m.room.message", {
        msgtype: "m.text",
        body: input.value
    });

    input.value = "";
}

// --------------------
// ADD MESSAGE UI
// --------------------
function addMessage(event) {

    const body = event?.content?.body;
    const sender = event?.sender;
    const time = new Date(event?.origin_server_ts)
        .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const myUserId = client.getUserId();

    const room = client.getRoom(currentRoomId);
    const member = room?.getMember(sender);

    const displayName = member?.name || sender;
    const avatarUrl = member?.getAvatarUrl?.(
        client.baseUrl,
        40,
        40,
        "crop"
    );

    const div = document.createElement("div");
    div.classList.add("message");

    // ⭐ BURASI KRİTİK
    const isMe = sender === myUserId;

    if (isMe) {
        div.classList.add("me");
    } else {
        div.classList.add("other");
    }

    if (!body) {

        div.classList.add("msg-deleted");

        div.innerHTML = `
            <div class="msg-header">
                <span class="time">${time}</span>
            </div>
            <div class="msg-body">
                🗑 Mesaj silindi
            </div>
        `;

    } else {

        div.innerHTML = `
            <div class="msg-header">
                <img class="avatar" src="${avatarUrl || ''}">
                <span class="username">${displayName}</span>
                <span class="time">${time}</span>
            </div>

            <div class="msg-body">
                ${body}
            </div>
        `;
    }

    const messages = document.getElementById("messages");
    messages.appendChild(div);

    messages.scrollTop = messages.scrollHeight;
}

// --------------------
// SEND MESSAGE PERMISSION CONTROL
// --------------------
function canSendMessage(room) {

    const myUserId = client.getUserId();

    const powerLevels = room.currentState.getStateEvents("m.room.power_levels", "");

    if (!powerLevels) return true;

    const data = powerLevels.getContent();

    const userLevel = data.users?.[myUserId] ?? data.users_default ?? 0;
    const sendLevel = data.events?.["m.room.message"] ?? data.events_default ?? 0;

    return userLevel >= sendLevel;
}

// --------------------
// ENTER SUPPORT
// --------------------
document.addEventListener("DOMContentLoaded", () => {

    const input = document.getElementById("messageBox");

    if (input) {
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") sendMessage();
        });
    }

    init();
});

// -------------------
// MODEL OPEN CLOSE
// -------------------
function openCreateModal() {
    document.getElementById("modal").classList.remove("hidden");
}

function closeModal() {
    document.getElementById("modal").classList.add("hidden");
}
// -------------------
// CREATE ROOM
// -------------------
async function createRoom() {

    const name = document.getElementById("roomName").value;
    const alias = document.getElementById("roomAlias").value
        .replace("#", "")
        .trim();

    try {

        await client.createRoom({
            name: name,
            visibility: "public",
            preset: "public_chat",
            room_alias_name: alias
        });

        closeModal();

    } catch (err) {

        console.error(err);

        if (
            err.errcode === "M_ROOM_IN_USE" ||
            err.message?.includes("room in use")
        ) {
            alert("Bu oda adresi zaten kullanılıyor.");
        } else {
            alert("Oda oluşturulamadı.");
        }
    }
}

// expose
window.sendMessage = sendMessage;
window.openRoom = openRoom;
window.openCreateModal = openCreateModal;
window.closeModal = closeModal;
window.createRoom = createRoom;

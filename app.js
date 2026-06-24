let client;
let currentRoomId = null;
let refreshInterval = null;
let selectedImage = null;

const trashIcon = `
        <svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24"  
        fill="#ffffff" viewBox="0 0 24 24" >
        <path d="M17 6V4c0-1.1-.9-2-2-2H9c-1.1 0-2 .9-2 2v2H2v2h2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8h2V6zM9 4h6v2H9zM6 20V8h12v12z"></path><path d="M9 10h2v8H9zm4 0h2v8h-2z"></path>
        </svg>
`;

const galleryIcon = `
        <svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24"  
        fill="#ffffff" viewBox="0 0 24 24" >
        <path d="M5 21h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2m0-2v-1.59l3-3 1.29 1.29c.39.39 1.02.39 1.41 0l5.29-5.29 3 3V19h-14ZM19 5v5.59L16.71 8.3a.996.996 0 0 0-1.41 0l-5.29 5.29-1.29-1.29a.996.996 0 0 0-1.41 0l-2.29 2.29V5h14Z"></path><path d="M8.5 7a1.5 1.5 0 1 0 0 3 1.5 1.5 0 1 0 0-3"></path>
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

    // DUR!
    "color: red; font-size: 22px; font-weight: bold;",

    // açıklama
    "color: #ff3b30; font-size: 14px; font-weight: normal;",

    // kritik satır
    "color: #ff0000; font-size: 16px; font-weight: bold;",

    // son satır
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

            <input type="file" id="imageInput" accept="image/*" hidden>

            <button onclick="document.getElementById('imageInput').click()">${galleryIcon}</button>

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
// LOADS MATRIX
// --------------------
function loadMatrixSDK() {
    return new Promise((resolve, reject) => {
        if (window.matrixcs) return resolve(window.matrixcs);

        const script = document.createElement("script");
        script.crossOrigin = "anonymous";
        
        // Doğrudan tarayıcı için derlenmiş resmi jsdelivr paketi (Sürüm 14.1.0)
        script.src = "https://unpkg.com/matrix-js-sdk@9.7.0/dist/browser-matrix.min.js";
        
        script.onload = () => {
            if (window.matrixcs) {
                resolve(window.matrixcs);
            } else {
                reject(new Error("Matrix SDK yüklendi ama global nesne bulunamadı."));
            }
        };
        script.onerror = () => reject(new Error("Matrix SDK yüklemesi başarısız oldu."));
        document.body.appendChild(script);
    });
}

// --------------------
// LOADS OLM
// --------------------
function loadOlm() {
    return new Promise((resolve, reject) => {
        if (window.Olm) return resolve(window.Olm);

        const script = document.createElement("script");
        // Herhangi bir CORS politikasına takılmaması için anonymous ekliyoruz
        script.crossOrigin = "anonymous";
        script.src = "https://cdn.jsdelivr.net/npm/@matrix-org/olm@3.2.15/olm.min.js";
        
        script.onload = () => {
            if (window.Olm) {
                resolve(window.Olm);
            } else {
                reject(new Error("Olm nesnesi window üzerinde bulunamadı."));
            }
        };
        script.onerror = () => reject(new Error("jsDelivr üzerinden olm.js yüklemesi başarısız oldu."));
        document.body.appendChild(script);
    });
}

// --------------------
// INIT CLIENT
// --------------------
async function init() {
    console.log("test");

    try {
        // 1. Önce Olm (Kripto motoru) yükle ve başlat
        const Olm = await loadOlm();
        await Olm.init();
        console.log("Olm başarıyla başlatıldı!");

        // 2. Sonra Matrix SDK kütüphanesini yükle
        const sdk = await loadMatrixSDK();
        console.log("Matrix SDK başarıyla yüklendi!");

        // 3. Cihaz kimliği kontrolü
        let deviceId = localStorage.getItem("mx_device_id");
        if (!deviceId) {
            deviceId = "BROWSER_" + Math.random().toString(36).substring(2, 10).toUpperCase();
            localStorage.setItem("mx_device_id", deviceId);
        }

        // 4. İstemciyi Kur (Bu sürümde IndexedDBCryptoStore ve WebStorageSessionStore mevcuttur)
        client = sdk.createClient({
            baseUrl: "https://matrix.org",
            accessToken: localStorage.getItem("mx_token"),
            userId: "@" + localStorage.getItem("mx_user") + ":matrix.org",
            cryptoStore: new sdk.IndexedDBCryptoStore(window.indexedDB, "matrix-crypto-store"),
            sessionStore: new sdk.WebStorageSessionStore(window.localStorage),
            deviceId: deviceId,
        });

        window.client = client;

        // Kripto mimarisini başlat ve senkronizasyona geç
        await client.initCrypto();
        
        await client.startClient({
            initialSyncLimit: 20
        });

        client.once("sync", async (state) => {
            if (state === "PREPARED") {
                console.log("Matrix Hazır!");

                // 🔐 DEVICE VERIFY (BURAYA)
                const userId = client.getUserId();

                let deviceId = localStorage.getItem("mx_device_id");

                await client.setDeviceVerified(userId, deviceId, true);
                console.log("Device verified!");

                loadChats();
                startChatAutoRefresh();
            }
        });

        client.on("Room", loadChats);

        client.on("Room.timeline", (event, room) => {
            if (room.roomId !== currentRoomId) return;
            if (event.event.type !== "m.room.message") return;
            addMessage(event.event);
        });

    } catch (error) {
        console.error("Başlatma sırasında hata oluştu:", error);
    }
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
                ${room.name || room.roomId}
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
    console.log(room.getMyMembership());

    if (!room || room.getMyMembership() == "leave") {
        document.getElementById("messages").innerHTML =
            "Bu odadan ayrıldınız.";
        return;
    }

    if (room.getMyMembership() == "invite") {
        document.getElementById("messages").innerHTML = `
            <div class="invite-box">
                Bu sohbete davet edildiniz.
                <br><br>
                <button onclick="joinCurrentRoom()">Daveti kabul et</button>
            </div>
        `;
        document.getElementById("inputBox").innerHTML = `
            <div class="no-permission">
                Bu sohbete dahil edilmediniz
            </div>
        `;
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
// RENDER IMAGE
// --------------------
function renderMatrixImage(mxcUrl, imgElementId) {

    const imageUrl = client.mxcUrlToHttp(
        mxcUrl,
        800,
        600,
        "scale"
    );

    if (!imageUrl) return;

    const imgElement = document.getElementById(imgElementId);

    if (imgElement) {
        imgElement.src = imageUrl;
    }
}

// --------------------
// SEND MESSAGE
// --------------------
async function sendMessage() {
    const input = document.getElementById("messageBox");

    if (!currentRoomId) return;

    // IMAGE SEND
    if (selectedImage) {
        try {
            const upload = await client.uploadContent(selectedImage);

            const mxcUrl = upload.content_uri || upload.content || upload;

            await client.sendEvent(currentRoomId, "m.room.message", {
                msgtype: "m.image",
                body: selectedImage.name,
                url: mxcUrl,
                info: {
                    mimetype: selectedImage.type,
                    size: selectedImage.size
                }
            });

            selectedImage = null;
            document.getElementById("imageInput").value = "";
            return;

        } catch (err) {
            console.error("Image upload error:", err);
            alert("Resim gönderilemedi");
            return;
        }
    }

    // TEXT
    if (!input.value.trim()) return;

    await client.sendEvent(currentRoomId, "m.room.message", {
        msgtype: "m.text",
        body: input.value
    });

    input.value = "";
}

// --------------------
// MXC TO URL
// --------------------
function mxcToHttp(mxcUrl) {
    if (!mxcUrl) return null;

    const parts = mxcUrl.replace("mxc://", "").split("/");
    const mediaId = parts[1];

    return `https://matrix.org/_matrix/client/v1/media/download/matrix.org/${mediaId}`;
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

    // 📷 IMAGE MESSAGE
    if (event?.content?.msgtype === "m.image") {

        const displayName = member?.name || sender;

        const div = document.createElement("div");
        div.classList.add("message");

        const isMe = sender === client.getUserId();
        if (isMe) div.classList.add("me");
        else div.classList.add("other");

        const mxc =
            event.content.file?.url ||
            event.content.url;
        // Genişlik ve yükseklik parametrelerini ekleyerek HTTP URL'sini alıyoruz
        const imageUrl = mxc ? mxcToHttp(mxc) : null;
        
        // Her resim mesajı için benzersiz bir ID oluşturuyoruz
        const uniqueImgId = `img-${event.event_id || Math.random().toString(36).substr(2, 9)}`;

        // img src kısmına yüklenene kadar duracak geçici koyu gri bir kutu koyduk
        div.innerHTML = `
            <div class="msg-header">
                <span class="username">${displayName}</span>
                <span class="time">${time}</span>
            </div>

            <img id="${uniqueImgId}" src="data:image/svg+xml;utf8,<svg xmlns='http://w3.org' width='800' height='600'><rect width='100%' height='100%' fill='%23222'/></svg>" class="chat-image">
        `;

        const messagesContainer = document.getElementById("messages");
        messagesContainer.appendChild(div);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // 🔐 RESMİ TOKEN İLE ARKA PLANDA ÇEKME ALANI
        if (imageUrl) {
            const mxToken = localStorage.getItem("mx_token");

            fetch(imageUrl, {
                headers: {
                    Authorization: `Bearer ${mxToken}`
                }
            })
            .then(res => {
                if (!res.ok) throw new Error("Görsel sunucudan çekilemedi");
                return res.blob();
            })
            .then(blob => {
                const localUrl = URL.createObjectURL(blob);
                const imgElement = document.getElementById(uniqueImgId);

                if (imgElement) {
                    imgElement.src = localUrl;
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }
            })
            .catch(err => console.error("Matrix görsel yükleme hatası:", err));
        }
        return;
    }

    const displayName = member?.name || sender;
    const avatarUrl = member?.getAvatarUrl?.(
        client.baseUrl,
        40,
        40,
        "crop"
    );
    const initial = (displayName || "?")
        .trim()
        .charAt(0)
        .toUpperCase();

    const div = document.createElement("div");
    div.classList.add("message");

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
                ${
                    avatarUrl
                        ? `<img class="avatar" src="${avatarUrl}">`
                        : `<div class="avatar-fallback">${initial}</div>`
                }
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

    console.log("content loaded");

    const input = document.getElementById("messageBox");

    if (input) {
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") sendMessage();
        });
    }

    console.log("DOM READY");

    init();
});

document.addEventListener("change", (e) => {
    if (e.target.id === "imageInput") {
        selectedImage = e.target.files[0];
    }
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

async function joinCurrentRoom() {
    if (!currentRoomId) return;

    await client.joinRoom(currentRoomId);

    // Odayı yeniden aç
    openRoom(currentRoomId);
}

function toggleRoomPanel() {
    const panel = document.getElementById("roomPanel");
    panel.classList.toggle("hidden");
}

// expose
window.joinCurrentRoom = joinCurrentRoom;
window.sendMessage = sendMessage;
window.openRoom = openRoom;
window.openCreateModal = openCreateModal;
window.closeModal = closeModal;
window.createRoom = createRoom;
window.toggleRoomPanel = toggleRoomPanel;
 // ✅ Google Login Handling
window.handleGoogleLogin = function (response) {
  const payload = JSON.parse(atob(response.credential.split('.')[1]));
  const { email, name, picture } = payload;
  localStorage.setItem('email', email);
  localStorage.setItem('username', name);
  localStorage.setItem('avatarUrl', picture);
  window.location.href = "chat.html";
};

// ✅ Utility: Truncate long names for UI display
function truncateName(name, maxLength = 16) {
  return name.length > maxLength ? name.slice(0, maxLength - 1) + "…" : name;
}

// ✅ Run everything after the page fully loads
window.addEventListener('DOMContentLoaded', () => {

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.clear();
      window.location.href = "index.html";
    });
  }
  // 🎯 Get elements and variables
  const socket = io('http://localhost:3000');        // Connect to server with Socket.IO
  const msgInput = document.getElementById('msgInput');
  const avatarEl = document.getElementById('avatar');
  const chatBox = document.getElementById('chat-box');
  const typingStatus = document.getElementById('typing-status');
  const emojiTrigger = document.getElementById('emoji-trigger');
  const mainEmojiPicker = document.getElementById('main-emoji-picker');
  const notifySound = new Audio("sound/3.mp3");
  const ringtone = new Audio('sound/4.mp3');
  ringtone.loop = true;

  const API_KEY = 'acc56e1682b109f605f261b6ac61ac26ab87479e';
  // 🎯 Get user info from browser storage
  const username = localStorage.getItem('username');
  const avatarUrl = localStorage.getItem('avatarUrl');
  const email = localStorage.getItem('email');
  const privateChats = {};
  let cachedEmojis = [];
   // ✅ Redirect back if user info is missing
  if (!username || !avatarUrl || !email) {
    window.location.href = "index.html";
    return;
  }

  avatarEl.src = avatarUrl;   // Show user avatar
  socket.emit('register user', { name: username, email, avatar: avatarUrl });   // Notify server
  // ========== 😂 FETCH EMOJIS FROM API ==========
  fetch(`https://emoji-api.com/emojis?access_key=${API_KEY}`)
    .then(res => res.json())
    .then(data => cachedEmojis = data)
    .catch(err => console.error("Emoji API fetch failed", err));
  // ========== 😀 CREATE AN EMOJI PICKER ==========
  function createEmojiPicker(containerId, inputElement) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
     // Top bar with title and close button
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';

    const title = document.createElement('strong');
    title.textContent = 'Pick Emoji';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✖';
    closeBtn.style.cursor = 'pointer';
    closeBtn.onclick = () => container.style.display = 'none';

    header.appendChild(title);
    header.appendChild(closeBtn);
    container.appendChild(header);
    // Search bar to filter emojis
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search emojis...';
    container.appendChild(searchInput);
    // Emoji result area
    const emojiList = document.createElement('div');
    emojiList.classList.add('emoji-list');
    container.appendChild(emojiList);
     // Renders emoji based on search
    const render = (filter = '') => {
      emojiList.innerHTML = '';
      cachedEmojis
        .filter(e => e.unicodeName.toLowerCase().includes(filter.toLowerCase()))
        .forEach(e => {
          const emojiItem = document.createElement('span');
          emojiItem.className = 'emoji-item';
          emojiItem.textContent = e.character;
          emojiItem.onclick = () => {
            inputElement.value += e.character;   // Add emoji to message
            inputElement.focus();
          };
          emojiList.appendChild(emojiItem);
        });
    };

    searchInput.addEventListener('input', () => render(searchInput.value));
    render();   // Initial render
  }
  // ========== 💬 TYPING INDICATOR ==========
  msgInput.addEventListener('input', () => {
    socket.emit('typing', username);
  });
   // ========== 😊 TOGGLE EMOJI PICKER ==========
  emojiTrigger.addEventListener('click', () => {
    mainEmojiPicker.style.display = mainEmojiPicker.style.display === 'none' ? 'block' : 'none';
    if (mainEmojiPicker.style.display === 'block') {
      createEmojiPicker('main-emoji-picker', msgInput);
    }
  });
   // ========== 📤 SEND CHAT MESSAGE ==========
  function sendMessage() {
    const msg = msgInput.value.trim();
    if (msg) {
      const timestamp = new Date().toISOString();
      socket.emit('chat message', { text: msg, username, avatar: avatarUrl, time: timestamp });
      msgInput.value = '';
    }
  }
  // ========== 📁 SEND FILE ==========
  function uploadFile() {
    const input = document.getElementById('fileInput');
    const file = input.files[0];
    if (file) {
      const formData = new FormData();
      formData.append('file', file);
      fetch('http://localhost:3000/upload', { method: 'POST', body: formData })
        .then(res => res.json())
        .then(data => {
          const timestamp = new Date().toISOString();
          socket.emit('image upload', { fileUrl: data.fileUrl, username, avatar: avatarUrl, time: timestamp });
        });
    }
  }
  // ========== 💌 APPEND TEXT MESSAGE ==========
  function appendMessage({ text, username, avatar, time }) {
    const div = document.createElement('div');
    div.classList.add('message');
    div.innerHTML = `
      <div class="message-header">
        <img src="${avatar}" class="chat-avatar" />
        <strong>${username}</strong>
        <span class="timestamp" title="${new Date(time).toLocaleString()}">${getRelativeTime(time)}</span>
      </div>
      <div class="message-body">${text}</div>
    `;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
    playSound();
  }
   // ========== 📎 APPEND FILE MESSAGE ==========
  function appendImageMessage({ fileUrl, username, avatar, time }) {
    const div = document.createElement('div');
    div.classList.add('message');
    div.innerHTML = `
      <div class="message-header">
        <img src="${avatar}" class="chat-avatar" />
        <strong>${username}</strong>
        <span class="timestamp" title="${new Date(time).toLocaleString()}">${getRelativeTime(time)}</span>
      </div>
      <div class="message-body"><a href="${fileUrl}" target="_blank">📎 File</a></div>
    `;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
    playSound();
  }
   // ========== 🔔 SOUND ALERT ==========
  function playSound() {
    notifySound.pause();
    notifySound.currentTime = 0;
    notifySound.play();
  }
   // ========== ⏱️ FRIENDLY TIMESTAMP ==========
  function getRelativeTime(iso) {
    const date = new Date(iso);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  }
  // ========== 👥 HANDLE USERS ==========
  socket.on('user list', (users) => {
    const userList = document.getElementById('user-list');
    userList.innerHTML = users.map(user => `
      <div class="user-entry" onclick="openPrivateChat('${user.name}')">
        <img src="${user.avatar}" class="chat-avatar" />
        <span>${user.name}</span>
        <span class="badge" id="badge-${user.name}"></span>
      </div>
    `).join('');
    window.users = new Map(users.map(u => [u.name, u]));
    playSound();
  });
  //🗨️ PRIVATE CHAT BOX CREATION

  
  window.openPrivateChat = (name) => {
    const shortName = truncateName(name);
    const chatId = `chat-${name}`;
    const u = window.users.get(name);
    if (privateChats[chatId]) {
      privateChats[chatId].box.style.display = 'block';
      return;
    }

    const box = document.createElement('div');
    box.className = 'private-chat-box';
    const offset = Object.keys(privateChats).length * 320;
    box.style.right = `${20 + offset}px`;
    box.style.left = 'auto'; // remove left alignment if present
    box.style.width = '450px';
    box.style.zIndex = 1000 + offset;


    box.innerHTML = `
      <div class="private-header" onmousedown="startDrag(event, this.parentNode)">
        <div class="private-header-left">
          <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" class="chat-logo" />
          <strong>${shortName}</strong>
        </div>
        <div>
          <button onclick="startCall('${chatId}', '${name}')">📞</button>
          <button onclick="startVideoCall('${chatId}', '${name}')">🎥</button>
          <button onclick="toggleMinimize('${chatId}')">_</button>
          <button onclick="closePrivateChat('${chatId}')">X</button>
        </div>
      </div>
      <div class="private-messages" id="pm-${chatId}"></div>
      <div class="call-overlay" id="call-${chatId}" style="display: none;">
        <div class="call-status">Calling ${name}...</div>
        <button onclick="toggleMute('${chatId}')">🔇</button>
        <button onclick="endCall('${chatId}')">❌</button>
        <div class="call-timer" id="timer-${chatId}">00:00</div>
      </div>

      <div class="private-typing" id="typing-chat-${shortName}"></div>
      
      <div class="input-row">
        <textarea id="pi-${chatId}" placeholder="Type message..." rows="1"></textarea>
        <div class="emoji-wrapper">
          <button class="emoji-trigger" onclick="togglePrivateEmoji('${chatId}')">😊</button>
          <div id="emoji-picker-${chatId}" class="emoji-picker-container" style="display:none;"></div>
        </div>
        <button onclick="sendPrivateMessage('${chatId}', '${name}')">Send</button>
      </div>
    `;

    document.body.appendChild(box);
    const input = box.querySelector(`#pi-${chatId}`);
    if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendPrivateMessage(chatId, name);
      }
    });
    input._attached = true;
  }

    privateChats[chatId] = { box, unread: 0 };
     // Load chat history if user found
    if (u?.email) {
      loadPrivateChatHistory(chatId, u.email, name);
    } else {
      socket.emit('find user by name', name, (foundUser) => {
        if (foundUser?.email) {
          loadPrivateChatHistory(chatId, foundUser.email, name);
        }
      });
    }
  };
  //🕘 LOAD PRIVATE CHAT HISTORY
  function loadPrivateChatHistory(chatId, otherEmail, name) {
    socket.emit('load private chat', { user1Email: email, user2Email: otherEmail }, (messages) => {
      const container = document.getElementById(`pm-${chatId}`);
      if (!container) return;
      container.innerHTML = '';
      messages.forEach(m => {
        const me = m.sender_name === username;
        const div = document.createElement('div');
        div.className = me ? 'private-message sender' : 'private-message receiver';
        div.innerHTML = `
          <div class="message-header">
            <img src="${me ? avatarUrl : m.sender_avatar}" class="chat-avatar" />
            <strong>${me ? "You" : m.sender_name}</strong>
            <span class="timestamp" title="${new Date(m.timestamp).toLocaleString()}">${getRelativeTime(m.timestamp)}</span>
          </div>
          <div class="message-body">${m.message}</div>
        `;
        container.appendChild(div);
      });
      container.scrollTop = container.scrollHeight;
    });
  }
  //📨 SEND PRIVATE MESSAGE
  window.sendPrivateMessage = (chatId, name) => {
    const input = document.getElementById(`pi-${chatId}`);
    const message = input.value.trim();
    if (message) {
      const user = window.users.get(name);
      socket.emit('private message', { toSocketId: user?.socketId, message });
      appendPrivateMessage(chatId, message, true);
      input.value = '';
      playSound();
    }
  };
  //💬 APPEND PRIVATE MESSAGE + BADGES
  function appendPrivateMessage(chatId, msg, isSender = true) {
    if (!privateChats[chatId]) return;
    const container = document.getElementById(`pm-${chatId}`);
    const div = document.createElement('div');
    div.className = isSender ? 'private-message sender' : 'private-message receiver';
    const avatar = isSender ? avatarUrl : window.users.get(chatId.split('-')[1])?.avatar || '';
    const senderName = isSender ? "You" : truncateName(chatId.split('-')[1]);
    const time = new Date().toISOString();

    div.innerHTML = `
      <div class="message-header">
        <img src="${avatar}" class="chat-avatar" />
        <strong>${senderName}</strong>
        <span class="timestamp" title="${new Date(time).toLocaleString()}">${getRelativeTime(time)}</span>
      </div>
      <div class="message-body">${msg}</div>
    `;

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;

    if (!isSender) {
      div.classList.add('shake');
      setTimeout(() => div.classList.remove('shake'), 400);
    }


    if (!isSender && privateChats[chatId].box.classList.contains('minimized')) {
      privateChats[chatId].unread++;
      const badge = document.getElementById(`badge-${chatId.split('-')[1]}`);
      if (badge) {
        badge.textContent = privateChats[chatId].unread;
        badge.classList.add('pulse'); // ✅ highlight pulse
      }
    }

  }
  //🔔 RECEIVE PRIVATE MESSAGE FROM SOCKET
  socket.on('private message', ({ from, message }) => {
    const chatId = `chat-${from}`;
    openPrivateChat(from);
    appendPrivateMessage(chatId, message, false);
    playSound();
  });
  //🗂️ MINIMIZE / CLOSE / TOGGLE EMOJI IN PRIVATE CHAT
  window.toggleMinimize = (chatId) => {
    const box = privateChats[chatId].box;
    box.classList.toggle('minimized');
    if (!box.classList.contains('minimized')) {
      privateChats[chatId].unread = 0;
      const badge = document.getElementById(`badge-${chatId.split('-')[1]}`);
      if (badge) { 
        badge.textContent = '';
        badge.classList.remove('pulse'); // ✅ stop pulsing when opened
      }
    }
  };

  window.closePrivateChat = (chatId) => {
    privateChats[chatId].box.remove();
    delete privateChats[chatId];
  };

  window.togglePrivateEmoji = (chatId) => {
    const pickerId = `emoji-picker-${chatId}`;
    const picker = document.getElementById(pickerId);
    const input = document.getElementById(`pi-${chatId}`);
    if (picker.style.display === 'none') {
      picker.style.display = 'block';
      createEmojiPicker(pickerId, input);
    } else {
      picker.style.display = 'none';
    }
  };
  //🖱️ MAKE PRIVATE CHAT WINDOW DRAGGABLE
  window.startDrag = (e, element) => {
    e.preventDefault();
    const shiftX = e.clientX - element.getBoundingClientRect().left;
    const shiftY = e.clientY - element.getBoundingClientRect().top;
    const moveAt = (pageX, pageY) => {
      element.style.left = `${pageX - shiftX}px`;
      element.style.top = `${pageY - shiftY}px`;
      element.style.position = 'fixed';
    };
    const onMouseMove = (event) => moveAt(event.pageX, event.pageY);
    document.addEventListener('mousemove', onMouseMove);
    element.onmouseup = () => {
      document.removeEventListener('mousemove', onMouseMove);
      element.onmouseup = null;
    };
  };

  socket.on('chat message', appendMessage);
  socket.on('image upload', appendImageMessage);
  socket.on('typing', (user) => {
    typingStatus.innerText = `${user} is typing...`;
    setTimeout(() => typingStatus.innerText = '', 2000);
  });
  socket.on('private typing', ({ from }) => {
  const typingEl = document.getElementById(`typing-chat-${from}`);
  if (typingEl) {
    typingEl.textContent = 'Typing...';
    clearTimeout(typingEl._timeout);
    typingEl._timeout = setTimeout(() => typingEl.textContent = '', 2000);
    }
  });

  const sendBtn = document.getElementById('send-btn');
  if (sendBtn) {
    sendBtn.addEventListener('click', sendMessage);
  }

  msgInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

    // 🎵 Sidebar Lottie animation + looping lounge music
  const animations = [
    "https://lottie.host/8b080c93-546e-43ca-96aa-56737112b2a3/WUt7LEpByT.lottie",
    "https://lottie.host/affe356b-8e4e-4425-b4d9-bf7fdcb9886c/9zTeN0cQm5.lottie",
    "https://lottie.host/8b080c93-546e-43ca-96aa-56737112b2a3/WUt7LEpByT.lottie"
  ];

  const musicTracks = [
    "music/lounge1.mp3",
    "music/lounge2.mp3",
    "music/lounge3.mp3"
  ];

  // Helper to pick a random item
  function getRandomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ----- 🎞️ Lottie Animation Switching -----
  const lottiePlayer = document.getElementById('lottie-avatar');
  let lastAnim = null;

  function switchLottie() {
    if (!lottiePlayer) return;

    let newAnim;
    do {
      newAnim = getRandomItem(animations);   // Pick new one different from last
    } while (newAnim === lastAnim);

    lottiePlayer.setAttribute('src', newAnim);
    lastAnim = newAnim;
  }

  // Initialize and switch every 10 seconds
  if (lottiePlayer) {
    lottiePlayer.style.width = '195px';
    lottiePlayer.style.height = '190px';
    switchLottie();
    setInterval(switchLottie, 10000); // Change every 10 seconds
  }

  // ----- 🎧 Lounge Music Loopback -----
  const sidebarMusic = document.getElementById('sidebar-music');
  let trackIndex = Math.floor(Math.random() * musicTracks.length);

  function playNextTrack() {
    if (!sidebarMusic) return;

    sidebarMusic.src = musicTracks[trackIndex];
    sidebarMusic.volume = 0.1; // Set volume to 10% 
    sidebarMusic.load();
    sidebarMusic.play().catch(err => {
      // If autoplay fails (browser block), wait for click
      console.warn("⚠️ Autoplay blocked. Waiting for user interaction...");
      document.body.addEventListener('click', () => sidebarMusic.play(), { once: true });
    });

    // Loop to the next track
    trackIndex = (trackIndex + 1) % musicTracks.length;
  }

  if (sidebarMusic) {
    playNextTrack();
    sidebarMusic.addEventListener('ended', playNextTrack);  // Loop songs
  }
  // ----- 📞 WebRTC Call Handling -----
 // ----- 📞 + 🎥 WebRTC Call Handling -----
const rtcPeers = {};
const callTimers = {};
const candidateQueue = {};
let videoPopupWindow = null; // globally track popup

// 🔊 AUDIO-ONLY CALL LOGIC
window.startCall = async function (chatId, name) {
  console.log(`[AUDIO] Starting audio call to ${name}`);
  const peer = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' } // Free STUN from Google
        ]
  });
  rtcPeers[chatId] = peer;

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach(track => peer.addTrack(track, stream));

  peer.ontrack = (e) => {
    const audio = new Audio();
    audio.srcObject = e.streams[0];
    audio.play();
  };

  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  socket.emit('call user', { to: name, offer });

  document.getElementById(`call-${chatId}`).style.display = 'block';
  startTimer(chatId);

  peer.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('ice-candidate', { to: name, candidate: event.candidate });
    }
  };
};

window.endCall = function (chatId) {
  const overlay = document.getElementById(`call-${chatId}`);
  if (overlay) overlay.style.display = 'none';
  if (rtcPeers[chatId]) {
    rtcPeers[chatId].close();
    delete rtcPeers[chatId];
  }
  stopTimer(chatId);
};

window.toggleMute = function (chatId) {
  const stream = rtcPeers[chatId]?.getSenders()[0]?.track;
  if (stream) stream.enabled = !stream.enabled;
};

window.startTimer = function (chatId) {
  let seconds = 0;
  callTimers[chatId] = setInterval(() => {
    seconds++;
    const min = String(Math.floor(seconds / 60)).padStart(2, '0');
    const sec = String(seconds % 60).padStart(2, '0');
    const timerEl = document.getElementById(`timer-${chatId}`);
    if (timerEl) timerEl.textContent = `${min}:${sec}`;
  }, 1000);
};

window.stopTimer = function (chatId) {
  clearInterval(callTimers[chatId]);
  const timerEl = document.getElementById(`timer-${chatId}`);
  if (timerEl) timerEl.textContent = '00:00';
};

// 🔔 Handle audio-only incoming call
socket.on('call user', ({ from }) => {
  const chatId = `chat-${from}`;
  openPrivateChat(from);
  ringtone.play();

  const accept = confirm(`📞 Incoming call from ${from}. Accept?`);
  if (accept) {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      ringtone.pause();
      ringtone.currentTime = 0;

      const peer = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' } // Free STUN from Google
        ]
      });

      rtcPeers[chatId] = peer;

      stream.getTracks().forEach(track => peer.addTrack(track, stream));

      peer.ontrack = (e) => {
        const audio = new Audio();
        audio.srcObject = e.streams[0];
        audio.play();
      };

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice-candidate', { to: from, candidate: event.candidate });
        }
      };

      rtcPeers[chatId].localStream = stream;
    });
  } else {
    ringtone.pause();
    ringtone.currentTime = 0;
    socket.emit('call declined', { to: from });
  }
});

// ✅ VIDEO + AUDIO CALL POPUP LOGIC
window.startVideoCall = async function (chatId, name) {
  const width = 720;
  const height = 540;
  
  const videoWin = window.open('', `video-${chatId}`, `width=${width},height=${height}`);
  videoPopupWindow = videoWin; // Store globally so other handlers can use it

  // ✅ Handle popup close to clean up peer
  videoWin.onbeforeunload = () => {
    console.log('[VIDEO] Video popup closed');
    rtcPeers[chatId]?.close();
    delete rtcPeers[chatId];
  };


  const html = `
  <html>
    <head>
      <title>Video Call with ${name}</title>
      <style>
        body {
          margin: 0;
          background: #121212;
          color: white;
          font-family: sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        h2 {
          margin: 10px;
          color: #00ffcc;
        }
        video {
          width: 320px;
          height: 240px;
          border-radius: 8px;
          margin: 10px;
          background: black;
        }
        .video-wrapper {
          display: flex;
          gap: 20px;
          justify-content: center;
        }
        .controls {
          margin-top: 15px;
        }
        button {
          margin: 5px;
          padding: 8px 14px;
          font-size: 14px;
          background-color: #1e1e1e;
          color: white;
          border: 1px solid #444;
          border-radius: 5px;
          cursor: pointer;
        }
        button:hover {
          background-color: #333;
        }
      </style>
    </head>
    <body>
      <h2>Video Call with ${name}</h2>
      <div class="video-wrapper">
        <video id="local" autoplay muted></video>
        <video id="remote" autoplay></video>
      </div>
      <div class="controls">
        <button id="toggle-mic">🎙️ Mute</button>
        <button id="toggle-cam">📷 Stop Camera</button>
        <button onclick="window.close()">❌ End Call</button>
      </div>
    </body>
  </html>`;

  videoWin.document.write(html);
  videoWin.document.close();

  const peer = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' } // Free STUN from Google
        ]
  });
  rtcPeers[chatId] = peer;

  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  stream.getTracks().forEach(track => peer.addTrack(track, stream));

  const localVideo = videoWin.document.getElementById('local');
  localVideo.srcObject = stream;
  let micEnabled = true;
  let camEnabled = true;

  const toggleMicBtn = videoWin.document.getElementById('toggle-mic');
  const toggleCamBtn = videoWin.document.getElementById('toggle-cam');

  toggleMicBtn.onclick = () => {
    micEnabled = !micEnabled;
    stream.getAudioTracks().forEach(track => track.enabled = micEnabled);
    toggleMicBtn.textContent = micEnabled ? '🎙️ Mute' : '🔇 Unmute';
    console.log(`[VIDEO] Microphone toggled: ${micEnabled}`);
  };

  toggleCamBtn.onclick = () => {
    camEnabled = !camEnabled;
    stream.getVideoTracks().forEach(track => track.enabled = camEnabled);
    toggleCamBtn.textContent = camEnabled ? '📷 Stop Camera' : '🎥 Start Camera';
    console.log(`[VIDEO] Camera toggled: ${camEnabled}`);
  };


  peer.ontrack = (e) => {
    const remoteVideo = videoWin.document.getElementById('remote');
    remoteVideo.srcObject = e.streams[0];
    remoteVideo.play().catch(err => {
      console.warn('[RTC] Autoplay failed for remote video:', err);
    });
  };

  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);

  socket.emit('call user', { to: name, offer });

  peer.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('ice-candidate', { to: name, candidate: event.candidate });
    }
  };
};

// 📩 Handle offer from caller
// 📩 Offer from caller
socket.on('offer', async ({ from, offer }) => {
  const chatId = `chat-${from}`;
  console.log(`[RTC] Received offer from ${from}`);
  const peer = rtcPeers[chatId] || new RTCPeerConnection();
  rtcPeers[chatId] = peer;

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
  stream.getTracks().forEach(track => peer.addTrack(track, stream));

  peer.ontrack = (e) => {
    const remoteVideo = videoPopupWindow?.document.getElementById('remoteVideo');
    if (remoteVideo) {
      remoteVideo.srcObject = e.streams[0];
      remoteVideo.play().catch(err => {
      console.warn('[RTC] Autoplay failed for remote video:', err);
      });
    }
  };

  peer.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('ice-candidate', { to: from, candidate: event.candidate });
    }
  };

  await peer.setRemoteDescription(new RTCSessionDescription(offer));
  console.log(`[RTC] Set remote description for ${from}`);

  // ✅ Apply any queued ICE candidates
  if (candidateQueue[chatId]) {
    for (const c of candidateQueue[chatId]) {
      await peer.addIceCandidate(new RTCIceCandidate(c));
      console.log(`[ICE] Applied queued candidate for ${from}`);
    }
    delete candidateQueue[chatId];
  }

  const answer = await peer.createAnswer();
  await peer.setLocalDescription(answer);
  console.log(`[RTC] Sending answer to ${from}`);
  socket.emit('answer', { to: from, answer });

  if (videoPopupWindow) {
    const localVideo = videoPopupWindow.document.getElementById('localVideo');
    if (localVideo) {
      localVideo.srcObject = stream;
    }
  }
});


// 📩 Handle answer
socket.on('answer', async ({ from, answer }) => {
  const chatId = `chat-${from}`;
  await rtcPeers[chatId]?.setRemoteDescription(new RTCSessionDescription(answer));
});

// 📩 Handle ICE
socket.on('ice-candidate', async ({ from, candidate }) => {
  const chatId = `chat-${from}`;
  const peer = rtcPeers[chatId];
  if (!peer) return;

  console.log(`[ICE] Candidate received from ${from}`, candidate); // 🔍 Debug incoming ICE

  if (peer.remoteDescription && peer.remoteDescription.type) {
    await peer.addIceCandidate(new RTCIceCandidate(candidate));
    console.log(`[ICE] Candidate applied immediately for ${from}`);
  } else {
    if (!candidateQueue[chatId]) candidateQueue[chatId] = [];
    candidateQueue[chatId].push(candidate);
    console.log(`[ICE] Queued candidate for ${from}`); // 🔄 Queued for later
  }
});



}); // 👈 End of DOMContentLoaded
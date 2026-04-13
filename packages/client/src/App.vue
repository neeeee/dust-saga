<template>
  <div id="app">
    <div v-if="!isAuthenticated" class="auth-container">
      <div class="auth-box">
        <h1>{{ isLoginMode ? 'Login' : 'Register' }}</h1>
        <form @submit.prevent="handleSubmit">
          <div v-if="!isLoginMode" class="form-group">
            <label>Email</label>
            <input
              v-model="email"
              type="email"
              placeholder="Enter your email"
              required
            />
          </div>
          <div class="form-group">
            <label>Username</label>
            <input
              v-model="username"
              type="text"
              placeholder="Enter your username"
              required
            />
          </div>
          <div class="form-group">
            <label>Password</label>
            <input
              v-model="password"
              type="password"
              placeholder="Enter your password"
              required
            />
          </div>
          <button type="submit" class="btn-primary">
            {{ isLoginMode ? 'Login' : 'Register' }}
          </button>
        </form>
        <p class="toggle-mode">
          {{ isLoginMode ? "Don't have an account?" : "Already have an account?" }}
          <a @click="toggleMode">{{ isLoginMode ? 'Register' : 'Login' }}</a>
        </p>
      </div>
    </div>

    <div v-else class="game-container">
      <canvas ref="gameCanvas"></canvas>
      <div class="hud">
        <div class="hud-panel">
          <h3>{{ username }}</h3>
          <p>Health: 100/100</p>
          <p>Level: 1</p>
        </div>
        <div class="hud-panel chat-panel">
          <div class="chat-messages" ref="chatMessages">
            <div v-for="(msg, index) in chatMessages" :key="index" class="chat-message">
              <span class="chat-sender">{{ msg.sender }}:</span>
              <span class="chat-text">{{ msg.message }}</span>
            </div>
          </div>
          <form @submit.prevent="sendChat" class="chat-input">
            <input
              v-model="chatInput"
              type="text"
              placeholder="Press Enter to chat..."
              maxlength="200"
            />
            <button type="submit">Send</button>
          </form>
        </div>
      </div>
      <div class="controls-hint">
        <p>Click to lock mouse | WASD to move | Shift to sprint | F to attack</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { GameClient } from './core/GameClient';
import { PacketType } from '@dust-saga/shared';

const isLoginMode = ref(true);
const username = ref('');
const email = ref('');
const password = ref('');
const isAuthenticated = ref(false);
const gameCanvas = ref<HTMLCanvasElement | null>(null);
const chatInput = ref('');
const chatMessages = ref<Array<{ sender: string; message: string }>>([]);
const chatMessagesRef = ref<HTMLElement | null>(null);

let gameClient: GameClient | null = null;

const toggleMode = () => {
  isLoginMode.value = !isLoginMode.value;
};

const handleSubmit = () => {
  if (!gameClient) return;

  if (isLoginMode.value) {
    gameClient.login(username.value, password.value);
  } else {
    gameClient.register(username.value, email.value, password.value);
  }
};

const sendChat = () => {
  if (!gameClient || !chatInput.value.trim()) return;

  gameClient.sendChatMessage(chatInput.value);
  chatInput.value = '';
};

const addChatMessage = (sender: string, message: string) => {
  chatMessages.value.push({ sender, message });
  if (chatMessages.value.length > 50) {
    chatMessages.value.shift();
  }
  
  setTimeout(() => {
    if (chatMessagesRef.value) {
      chatMessagesRef.value.scrollTop = chatMessagesRef.value.scrollHeight;
    }
  }, 100);
};

onMounted(async () => {
  if (gameCanvas.value) {
    gameClient = new GameClient(gameCanvas.value);
    
    await gameClient.initialize();
    
    const network = gameClient.getNetworkClient();
    
    network.onPacket(PacketType.AUTH_SUCCESS, () => {
      isAuthenticated.value = true;
    });
    
    network.onPacket(PacketType.CHAT_MESSAGE, (packet: any) => {
      addChatMessage(packet.data.sender, packet.data.message);
    });

    network.onPacket(PacketType.ENTITY_SPAWN, (packet: any) => {
      if (!isAuthenticated.value && packet.data.id === network.getSocketId()) {
        isAuthenticated.value = true;
      }
    });
  }
});

onUnmounted(() => {
  if (gameClient) {
    gameClient.dispose();
  }
});
</script>

<style scoped>
#app {
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

.auth-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.auth-box {
  background: white;
  padding: 2rem;
  border-radius: 10px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  width: 350px;
}

.auth-box h1 {
  margin-top: 0;
  color: #333;
  text-align: center;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  color: #555;
}

.form-group input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 5px;
  font-size: 1rem;
}

.btn-primary {
  width: 100%;
  padding: 0.75rem;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 5px;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.3s;
}

.btn-primary:hover {
  background: #5568d3;
}

.toggle-mode {
  text-align: center;
  margin-top: 1rem;
  color: #666;
}

.toggle-mode a {
  color: #667eea;
  cursor: pointer;
  text-decoration: underline;
}

.game-container {
  position: relative;
  width: 100vw;
  height: 100vh;
}

.game-container canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.hud {
  position: absolute;
  top: 20px;
  left: 20px;
  right: 20px;
  display: flex;
  justify-content: space-between;
  pointer-events: none;
}

.hud-panel {
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 1rem;
  border-radius: 10px;
  pointer-events: auto;
}

.hud-panel h3 {
  margin: 0 0 0.5rem 0;
}

.hud-panel p {
  margin: 0.25rem 0;
}

.chat-panel {
  width: 300px;
  max-height: 300px;
  display: flex;
  flex-direction: column;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 0.5rem;
  max-height: 200px;
}

.chat-message {
  margin-bottom: 0.25rem;
  font-size: 0.9rem;
}

.chat-sender {
  color: #667eea;
  font-weight: bold;
}

.chat-text {
  color: #ccc;
}

.chat-input {
  display: flex;
  gap: 0.5rem;
}

.chat-input input {
  flex: 1;
  padding: 0.5rem;
  border: none;
  border-radius: 5px;
  font-size: 0.9rem;
}

.chat-input button {
  padding: 0.5rem 1rem;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}

.controls-hint {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.9rem;
}
</style>
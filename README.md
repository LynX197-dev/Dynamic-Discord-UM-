# 🔌 Dynamic Discord UM+

**A Self-Contained, High-Performance Discord Status Bot for Minecraft**

Dynamic Discord UM+ is a modern **Spigot/Paper plugin** that seamlessly connects your Minecraft server to Discord **without any external bot hosting**. Instead of relying on limited Java-only Discord implementations, the plugin **automatically deploys and manages a full Node.js environment** directly inside your server directory, delivering a powerful, reliable, and feature-rich Discord status system.

---

## ✨ Key Features

### 📡 Real-Time Server Status
- Maintains **one persistent, pinned embed message** in a configured Discord channel  
- Updates automatically at a configurable interval *(default: 30 seconds)*  
- Displays live server data:
  - **Online Players / Max Players**
  - **Server Uptime**
  - **Latency (Ping)**
- Automatically fetches and displays:
  - **Minecraft Server Version**
  - **Server Country / Location**

---

### 🎨 Smart Embed System
- **Online Mode**
  - Customizable embed color *(default: green)*
  - Full real-time statistics
- **Offline Mode**
  - Instantly switches to **OFFLINE** *(red embed)*
  - Displays the exact time the server went down
- **Banner Support**
  - Optional custom server banner image displayed in the embed

---

### ⚡ Hybrid Technology (Java + Node.js)
- Powered by **discord.js** for a modern, responsive Discord bot experience  
- Uses **minecraft-server-util** for accurate external pings  
  - Supports both **Java Edition** and **Bedrock Edition** servers  

---

### 🚀 Zero-Hassle Installation
- **No manual Node.js setup required**
- Automatic OS detection *(Windows / Linux)*
- Downloads an isolated Node.js binary directly into the plugin folder
- Automatically installs all required npm packages on first startup
- Fully self-contained and portable

---

## ⚙️ Configuration

All settings are managed through a simple `config.yml` file:

### 🔐 Bot Settings
- Discord Bot Token
- Target Channel ID

### 🖥 Server Details
- Server IP
- Server Port
- Display Name

### 🎨 Visual Customization
- Custom **Hex colors** for Online and Offline states
- Toggle banner image on or off

### ⚡ Performance
- Adjustable update interval to balance real-time accuracy and Discord API usage

---

## 🛠 Technical Overview

### 🔄 Initialization
- On server startup, the plugin checks for a local `node` directory  
- If missing, it downloads a **portable Node.js runtime (v18.x)** compatible with the host OS  

### 🔗 Java ↔ Node Bridge
- Extracts the bundled `bot.js`
- Installs required npm dependencies automatically

### ▶ Execution
- Launches the Discord bot as a managed **Node.js sub-process**

### 🔔 Graceful Shutdown Handling
- When the Minecraft server stops or crashes:
  - The plugin signals the bot to update the Discord embed to **OFFLINE**
  - Ensures users always see the correct server state
  - Cleanly terminates the Node.js process afterward

---

**Dynamic Discord UM+** delivers a clean, powerful, and future-proof way to keep your Discord community informed — all from inside your Minecraft server.


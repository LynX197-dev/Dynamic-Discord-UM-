const { Client, EmbedBuilder, GatewayIntentBits } = require("discord.js");
const util = require("minecraft-server-util");

/* ================= ARGUMENTS ================= */
const [
  ,
  ,
  BOT_TOKEN,
  CHANNEL_ID,

  SERVER_NAME,
  SERVER_IP,
  SERVER_PORT,
  SERVER_TYPE,

  ONLINE_COLOR,
  OFFLINE_COLOR,
  SHOW_BANNER,
  BANNER_URL,
  SHOW_TITLE_IMAGE,
  TITLE_IMAGE_URL,

  UPDATE_INTERVAL,
  ONLINE_PING_ENABLED,
  ONLINE_PING_ROLE_ID,
  OFFLINE_PING_ENABLED,
  OFFLINE_PING_ROLE_ID,
  FOOTER_ENABLED,
  FOOTER_TEXT,
] = process.argv;

const PORT = Number(SERVER_PORT);
const INTERVAL = Number(UPDATE_INTERVAL) * 1000;
const SHOW_BANNER_BOOL = SHOW_BANNER === "true";
const SHOW_TITLE_IMAGE_BOOL = SHOW_TITLE_IMAGE === "true";
const FOOTER_ENABLED_BOOL = FOOTER_ENABLED === "true";

const ENABLE_ONLINE_PING = ONLINE_PING_ENABLED === "true";
const ENABLE_OFFLINE_PING = OFFLINE_PING_ENABLED === "true";
const ONLINE_COLOR_INT = parseInt(ONLINE_COLOR.replace("#", ""), 16);
const OFFLINE_COLOR_INT = parseInt(OFFLINE_COLOR.replace("#", ""), 16);
/* ============================================= */

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

let statusMessageId = null;
const botStartTime = Date.now();
let cachedCountry = null;
let lastDowntime = "N/A";
let lastOfflineTime = null;
let serverStartTime = null;
let lastUptime = "N/A";
let lastKnownStatus = null;
let lastPingMessageId = null;

/* ================= READY ================= */
client.once("clientReady", async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);

  const channel = await client.channels.fetch(CHANNEL_ID);
  console.log(`🔔 Pings: Online=${ENABLE_ONLINE_PING} (${ONLINE_PING_ROLE_ID}), Offline=${ENABLE_OFFLINE_PING} (${OFFLINE_PING_ROLE_ID})`);

  // Find last ping message to manage deletion (avoid spam)
  try {
    const messages = await channel.messages.fetch({ limit: 20 });
    const lastPing = messages.find(
      (m) =>
        m.author.id === client.user.id &&
        !m.pinned &&
        (m.content.includes("Server is now ONLINE") ||
          m.content.includes("Server is now OFFLINE")),
    );
    if (lastPing) {
      lastPingMessageId = lastPing.id;
    }
  } catch (e) {
    console.log("⚠️ Could not fetch recent messages:", e.message);
  }

  // Find pinned status message (if exists)
  const pinned = await channel.messages.fetchPinned();
  const old = pinned.find((m) => m.author.id === client.user.id);
  if (old) {
    statusMessageId = old.id;

    if (old.embeds.length > 0) {
      const embed = old.embeds[0];

      const downField = embed.fields.find(
        (f) => f.name === "⏱ Previous Downtime",
      );
      if (downField) lastDowntime = downField.value;

      const uptimeField = embed.fields.find(
        (f) => f.name === "⏱ Previous Uptime",
      );
      if (uptimeField) lastUptime = uptimeField.value;

      const statusField = embed.fields.find((f) => f.name === "🔴 Status");
      if (statusField && statusField.value === "OFFLINE" && embed.timestamp) {
        lastOfflineTime = new Date(embed.timestamp).getTime();
      }

      const statusFieldColor = embed.fields.find((f) => f.name === "🔴 Status" || f.name === "🟢 Status");
      if (statusFieldColor) lastKnownStatus = statusFieldColor.value;
    }
  }

  await updateStatus();
  setInterval(updateStatus, INTERVAL);
});
/* ========================================= */

/* ================= STATUS ================= */
async function updateStatus() {
  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    let embed;
    let isOnline = false;
    let status = null;

    try {
      // Try to ping the server
      status =
        SERVER_TYPE === "bedrock"
          ? await util.statusBedrock(SERVER_IP, PORT)
          : await util.status(SERVER_IP, PORT);
      isOnline = true;
    } catch (pingError) {
      isOnline = false;
    }

    const currentStatusStr = isOnline ? "ONLINE" : "OFFLINE";

    if (lastKnownStatus && lastKnownStatus !== currentStatusStr) {
      // 1. Delete previous ping if exists
      if (lastPingMessageId) {
        try {
          const oldPing = await channel.messages.fetch(lastPingMessageId);
          if (oldPing) await oldPing.delete();
        } catch (e) {
          // Message might already be deleted
        }
        lastPingMessageId = null;
      }

      // 2. Send new ping
      let pingContent = null;
      if (currentStatusStr === "ONLINE" && ENABLE_ONLINE_PING) pingContent = `<@&${ONLINE_PING_ROLE_ID}> Server is now ONLINE!`;
      else if (currentStatusStr === "OFFLINE" && ENABLE_OFFLINE_PING) pingContent = `<@&${OFFLINE_PING_ROLE_ID}> Server is now OFFLINE!`;

      if (pingContent) {
        const sentMsg = await channel.send({ content: pingContent });
        lastPingMessageId = sentMsg.id;
      }
    }
    lastKnownStatus = currentStatusStr;

    if (isOnline) {
      if (!serverStartTime) serverStartTime = Date.now();

      if (lastOfflineTime) {
        const diff = Date.now() - lastOfflineTime;
        lastDowntime = formatUptime(diff);
        lastOfflineTime = null;
      }
      embed = await buildOnlineEmbed(status);
    } else {
      if (serverStartTime) {
        const diff = Date.now() - serverStartTime;
        lastUptime = formatUptime(diff);
        serverStartTime = null;
      }

      if (!lastOfflineTime) lastOfflineTime = Date.now();
      embed = await buildOfflineEmbed();
    }

    if (statusMessageId) {
      const msg = await channel.messages.fetch(statusMessageId);
      await msg.edit({ embeds: [embed] });
    } else {
      const msg = await channel.send({ embeds: [embed] });
      await msg.pin();
      statusMessageId = msg.id;
    }
  } catch (err) {
    console.log("⚠️ Discord update failed:", err.message);
  }
}

async function buildOfflineEmbed() {
  const embed = new EmbedBuilder()
    .setColor(OFFLINE_COLOR_INT)
    .setTitle(`🌍 ${SERVER_NAME} — Server Status`)
    .addFields(
      { name: "🔴 Status", value: "OFFLINE", inline: false },
      { name: "🌐 Address", value: `${SERVER_IP}:${PORT}`, inline: false },
      { name: "👥 Players", value: `0/0`, inline: true },
      { name: "⏱ Previous Uptime", value: lastUptime, inline: true },
      { name: "⏱ Previous Downtime", value: lastDowntime, inline: true },
    )
    .setTimestamp(lastOfflineTime || Date.now())
    .setThumbnail(SHOW_TITLE_IMAGE_BOOL ? TITLE_IMAGE_URL : null)
    .setImage(SHOW_BANNER_BOOL ? BANNER_URL : null);

  if (FOOTER_ENABLED_BOOL && FOOTER_TEXT) {
    embed.setFooter({ text: FOOTER_TEXT });
  }

  return embed;
}

async function buildOnlineEmbed(status) {
  const uptime = formatUptime(Date.now() - (serverStartTime || Date.now()));

  if (!cachedCountry) {
    try {
      const res = await fetch(`http://ip-api.com/json/${SERVER_IP}`);
      if (res.ok) {
        const data = await res.json();
        cachedCountry = data.country || "Unknown";
      }
    } catch (err) {
      // Ignore errors, will try again next update
    }
  }

  const embed = new EmbedBuilder()
    .setColor(ONLINE_COLOR_INT)
    .setTitle(`🌍 ${SERVER_NAME} — Server Status`)
    .addFields(
      { name: "🟢 Status", value: "ONLINE", inline: false },
      { name: "🌐 Address", value: `${SERVER_IP}:${PORT}`, inline: false },
      { name: "🌍 Country", value: cachedCountry || "Unknown", inline: true },
      {
        name: "📦 Version",
        value: status.version.name || "Somewhere on Earth",
        inline: true,
      },
      { name: "📶 Ping", value: `${status.roundTripLatency}ms`, inline: true },
      {
        name: "👥 Players",
        value: `${status.players.online}/${status.players.max}`,
        inline: true,
      },
      { name: "⏱ Uptime", value: uptime, inline: true },
      { name: "⏱ Previous Downtime", value: lastDowntime, inline: true },
    )
    .setTimestamp()
    .setThumbnail(SHOW_TITLE_IMAGE_BOOL ? TITLE_IMAGE_URL : null)
    .setImage(SHOW_BANNER_BOOL ? BANNER_URL : null);

  if (FOOTER_ENABLED_BOOL && FOOTER_TEXT) {
    embed.setFooter({ text: FOOTER_TEXT });
  }

  return embed;
}
/* =========================================== */

/* ================= SHUTDOWN ================= */
async function shutdown(reason) {
  console.log(`🛑 Shutdown signal: ${reason}`);
  try {
    if (serverStartTime) {
      const diff = Date.now() - serverStartTime;
      lastUptime = formatUptime(diff);
      serverStartTime = null;
    }

    const channel = await client.channels.fetch(CHANNEL_ID);
    if (lastKnownStatus === "ONLINE" && ENABLE_OFFLINE_PING) {
      if (lastPingMessageId) {
        try {
          const oldPing = await channel.messages.fetch(lastPingMessageId);
          if (oldPing) await oldPing.delete();
        } catch (e) {}
      }
      await channel.send({ content: `<@&${OFFLINE_PING_ROLE_ID}> Server is now OFFLINE!` });
    }

    if (statusMessageId) {
      if (!lastOfflineTime) lastOfflineTime = Date.now();
      const offlineEmbed = await buildOfflineEmbed();
      const msg = await channel.messages.fetch(statusMessageId);
      // 'await' is critical here so the process doesn't die mid-upload
      await msg.edit({ embeds: [offlineEmbed] });
      console.log("✅ Final offline status sent.");
    }
  } catch (err) {
    console.error("❌ Shutdown update failed:", err.message);
  }
  process.exit(0);
}

// Listen for the signal sent by botProcess.destroy()
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Listen for STOP command from Java (Windows compatibility)
process.stdin.resume();
process.stdin.setEncoding("utf8");
process.stdin.on("data", (data) => {
  if (data.toString().includes("STOP")) shutdown("Command");
});
/* =========================================== */

/* ================= UTILS ================= */
function formatUptime(ms) {
  const sec = Math.floor(ms / 1000) % 60;
  const min = Math.floor(ms / 60000) % 60;
  const hrs = Math.floor(ms / 3600000) % 24;
  const days = Math.floor(ms / 86400000);
  return `${days}d ${hrs}h ${min}m ${sec}s`;
}
/* ========================================= */

client.login(BOT_TOKEN);

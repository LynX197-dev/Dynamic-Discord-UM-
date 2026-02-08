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
] = process.argv;

const PORT = Number(SERVER_PORT);
const INTERVAL = Number(UPDATE_INTERVAL) * 1000;
const SHOW_BANNER_BOOL = SHOW_BANNER === "true";
const SHOW_TITLE_IMAGE_BOOL = SHOW_TITLE_IMAGE === "true";

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

/* ================= READY ================= */
client.once("clientReady", async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);

  const channel = await client.channels.fetch(CHANNEL_ID);

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

      const statusField = embed.fields.find((f) => f.name === "🔴 Status");
      if (statusField && statusField.value === "OFFLINE" && embed.timestamp) {
        lastOfflineTime = new Date(embed.timestamp).getTime();
      }
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

    if (isOnline) {
      if (lastOfflineTime) {
        const diff = Date.now() - lastOfflineTime;
        lastDowntime = formatUptime(diff);
        lastOfflineTime = null;
      }
      embed = await buildOnlineEmbed(status);
    } else {
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
  return new EmbedBuilder()
    .setColor(OFFLINE_COLOR_INT)
    .setTitle(`🌍 ${SERVER_NAME} — Server Status`)
    .addFields(
      { name: "🔴 Status", value: "OFFLINE", inline: false },
      { name: "🌐 Address", value: `${SERVER_IP}:${PORT}`, inline: false },
      { name: "👥 Players", value: `0/0`, inline: true },
      { name: "⏱ Uptime", value: "Offline", inline: true },
      { name: "⏱ Previous Downtime", value: lastDowntime, inline: true },
    )
    .setTimestamp(lastOfflineTime || Date.now())
    .setThumbnail(SHOW_TITLE_IMAGE_BOOL ? TITLE_IMAGE_URL : null)
    .setImage(SHOW_BANNER_BOOL ? BANNER_URL : null);
}

async function buildOnlineEmbed(status) {
  const uptime = formatUptime(Date.now() - botStartTime);

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

  return new EmbedBuilder()
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
}
/* =========================================== */

/* ================= SHUTDOWN ================= */
async function shutdown(reason) {
  console.log(`🛑 Shutdown signal: ${reason}`);
  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
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

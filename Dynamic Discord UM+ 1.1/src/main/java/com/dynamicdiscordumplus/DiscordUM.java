package com.dynamicdiscordumplus;

import org.bukkit.plugin.java.JavaPlugin;
import org.apache.commons.compress.archivers.tar.*;
import org.apache.commons.compress.compressors.xz.XZCompressorInputStream;
import org.bukkit.Bukkit;
import org.zeroturnaround.zip.ZipUtil;

import java.io.*;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;

public class DiscordUM extends JavaPlugin {

    private Process botProcess;

    enum OS {
        WINDOWS, LINUX, UNKNOWN
    }

    @Override
    public void onEnable() {
        saveDefaultConfig();
        extractNodeFiles();

        if (!isNodePresent()) {
            getLogger().info("NodeJS not found. Downloading...");
            downloadNodeJS();
        }

        if (!isNodeModulesPresent()) {
            getLogger().info("node_modules not found. Running npm install...");
            runNpmInstall();
        }

        startBot();

        // ASCII
        Bukkit.getConsoleSender().sendMessage(AsciiBanner.DESIGN_CREDIT);
    }

    @Override
public void onDisable() {
    if (botProcess != null && botProcess.isAlive()) {
        getLogger().info("Updating Discord status to OFFLINE...");
        
        try (BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(botProcess.getOutputStream()))) {
            writer.write("STOP");
            writer.newLine();
            writer.flush();
        } catch (IOException e) {
            // Fallback if writing fails
            botProcess.destroy();
        }
        
        try {
            // This FORCES the Minecraft server to wait for the bot
            boolean cleanExit = botProcess.waitFor(10, java.util.concurrent.TimeUnit.SECONDS);
            
            if (cleanExit) {
                getLogger().info("Discord status updated and bot closed.");
            } else {
                getLogger().warning("Bot took too long to update; forcing close.");
                botProcess.destroyForcibly();
            }
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
    }
}

    /* ================= OS ================= */

    private OS detectOS() {
        String os = System.getProperty("os.name").toLowerCase();
        if (os.contains("win"))
            return OS.WINDOWS;
        if (os.contains("linux"))
            return OS.LINUX;
        return OS.UNKNOWN;
    }

    /* ================= EXTRACTION ================= */

    private void extractNodeFiles() {
        extract("bot/bot.js", "bot.js");
        extract("bot/package.json", "package.json");
    }

    private void extract(String internal, String out) {
        File outFile = new File(getDataFolder(), out);
        if (outFile.exists())
            return;
        outFile.getParentFile().mkdirs();

        try (InputStream in = getResource(internal)) {
            Files.copy(in, outFile.toPath());
        } catch (Exception e) {
            getLogger().severe("Failed to extract " + out);
        }
    }

    /* ================= NODE ================= */

    private boolean isNodePresent() {
        File nodeDir = new File(getDataFolder(), "node");
        if (!nodeDir.exists())
            return false;
        return detectOS() == OS.WINDOWS
                ? new File(nodeDir, "node.exe").exists()
                : new File(nodeDir, "bin/node").exists();
    }

    private void downloadNodeJS() {
        try {
            OS os = detectOS();
            String url;

            if (os == OS.WINDOWS)
                url = "https://nodejs.org/dist/v18.19.0/node-v18.19.0-win-x64.zip";
            else if (os == OS.LINUX)
                url = "https://nodejs.org/dist/v18.19.0/node-v18.19.0-linux-x64.tar.xz";
            else {
                getLogger().severe("Unsupported OS");
                return;
            }

            File archive = new File(getDataFolder(), "node.tmp");
            Files.copy(new URL(url).openStream(), archive.toPath(), StandardCopyOption.REPLACE_EXISTING);

            File nodeDir = new File(getDataFolder(), "node");
            nodeDir.mkdirs();

            if (os == OS.WINDOWS) {
                ZipUtil.unpack(archive, nodeDir);
            } else {
                extractTarXz(archive, nodeDir);
            }

            archive.delete();
            flatten(nodeDir);

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void extractTarXz(File archive, File out) throws IOException {
        try (
                FileInputStream fis = new FileInputStream(archive);
                XZCompressorInputStream xz = new XZCompressorInputStream(fis);
                TarArchiveInputStream tar = new TarArchiveInputStream(xz)) {
            TarArchiveEntry e;
            while ((e = tar.getNextTarEntry()) != null) {
                File f = new File(out, e.getName());
                if (e.isDirectory())
                    f.mkdirs();
                else {
                    f.getParentFile().mkdirs();
                    try (OutputStream o = new FileOutputStream(f)) {
                        tar.transferTo(o);
                    }
                    f.setExecutable((e.getMode() & 0100) != 0);
                }
            }
        }
    }

    private void flatten(File dir) {
        File[] inner = dir.listFiles(File::isDirectory);
        if (inner == null || inner.length == 0)
            return;
        for (File f : inner[0].listFiles()) {
            f.renameTo(new File(dir, f.getName()));
        }
        inner[0].delete();
    }

    private String nodeCmd() {
        return detectOS() == OS.WINDOWS
                ? new File(getDataFolder(), "node/node.exe").getAbsolutePath()
                : new File(getDataFolder(), "node/bin/node").getAbsolutePath();
    }

    /* ================= NPM ================= */

    private boolean isNodeModulesPresent() {
        return new File(getDataFolder(), "node_modules").exists();
    }

    private void runNpmInstall() {
        try {
            ProcessBuilder pb = new ProcessBuilder(
                    detectOS() == OS.WINDOWS ? "npm.cmd" : "npm",
                    "install");
            pb.directory(getDataFolder());
            pb.inheritIO();
            pb.start().waitFor();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    /* ================= BOT ================= */

    private void startBot() {
        try {
            ProcessBuilder pb = new ProcessBuilder(
                    nodeCmd(), "bot.js",

                    getConfig().getString("bot.token"),
                    getConfig().getString("bot.channel-id"),

                    getConfig().getString("server.name"),
                    getConfig().getString("server.ip"),
                    String.valueOf(getConfig().getInt("server.port")),
                    getConfig().getString("server.type"),

                    getConfig().getString("embed.online-color"),
                    getConfig().getString("embed.offline-color"),
                    String.valueOf(getConfig().getBoolean("embed.show-banner")),
                    getConfig().getString("embed.banner-url"),
                    String.valueOf(getConfig().getBoolean("embed.show-title-image")),
                    getConfig().getString("embed.title-image-url"),

                    String.valueOf(getConfig().getInt("update-interval")));

            pb.directory(getDataFolder());
            pb.redirectOutput(ProcessBuilder.Redirect.INHERIT);
            pb.redirectError(ProcessBuilder.Redirect.INHERIT);
            botProcess = pb.start();

        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}

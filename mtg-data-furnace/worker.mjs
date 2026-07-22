import { Client, GatewayIntentBits } from "discord.js";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const CONFIG = {
  token: process.env.DISCORD_TOKEN,
  supabaseKey: process.env.SUPABASE_KEY,
  supabaseUrl: process.env.SUPABASE_URL,
  channelId: process.env.CHANNEL_ID,
  logPath: "D:\\BrownEyeCortex\\logs\\mtg-furnace.log"
};

function log(obj) {
  const line = `[${new Date().toISOString()}] ${JSON.stringify(obj)}`;
  try { fs.appendFileSync(CONFIG.logPath, line + "\n"); } catch {}
  console.log(line);
}

function extractUrl(text) {
  const m = text.match(/https?:\/\/\S+/g);
  return m ? m[0] : null;
}

function isValidDeckUrl(url) {
  if (!url) return false;
  return url.includes("moxfield.com") ||
         url.includes("manabox") ||
         url.includes("mana.box");
}

function score(name) {
  const n = name.toLowerCase();
  let s = 1;
  if (n.includes("commander")) s += 3;
  if (n.includes("edh")) s += 3;
  if (n.includes("burn")) s += 2;
  if (n.includes("combo")) s += 3;
  if (n.includes("control")) s += 2;
  if (n.includes("mono")) s += 1;
  if (name.length > 20) s += 1;
  return s;
}

const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once("clientReady", () => {
  log({ event: "worker_ready", bot: client.user.tag });
});

client.on("messageCreate", async (msg) => {
  try {
    if (msg.channelId !== CONFIG.channelId) return;
    if (msg.author.bot) return;
    if (!msg.content.startsWith("!deck")) return;

    const deckName = msg.content.replace("!deck", "").trim();
    const url = extractUrl(msg.content);

    if (!url || !isValidDeckUrl(url)) {
      await msg.reply("DECK_REJECTED");
      log({ event: "rejected", deckName, reason: "invalid_url" });
      return;
    }

    const value_score = score(deckName);
    const sales_tier =
      value_score >= 6 ? "HIGH" :
      value_score >= 3 ? "MID" : "LOW";

    const payload = {
      name: deckName,
      url,
      value_score,
      sales_tier,
      silo: "mtg",
      listed_for_sale: false,
      source: "discord"
    };

    const { error } = await supabase.from("inventory_items").insert(payload);
    if (error) throw new Error(error.message);

    await msg.reply("DECK_ACCEPTED");

    log({
      event: "inserted",
      deckName,
      url,
      value_score,
      sales_tier
    });

  } catch (e) {
    log({ event: "fatal", message: e.message });
    await msg.reply("DECK_REJECTED");
  }
});

client.login(CONFIG.token);

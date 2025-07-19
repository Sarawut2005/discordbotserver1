import Discord, { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
const { InteractionResponseFlags } = Discord;
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const ALLOWED_CHANNEL_ID = process.env.CHANNEL_ID; // แก้ชื่อ env เป็น CHANNEL_ID
const FOLDER_ID = '1wJ6d1_TES5PDWnZ3y-c6j2nLNehAVjeM';

const LOG_CHANNELS = {
  member_join: '1394853692590657546',
  member_leave: '1394853752699097228',
  voice_state: '1394853832265171016',
  message_delete: '1394853892264689707',
  message_edit: '1394853963660263485',
  name_change: '1394854013723480126',
  invite_create: '1394854064524890202',
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

let db;

async function setupDatabase() {
  db = await open({
    filename: './logs.db',
    driver: sqlite3.Database,
  });
  await db.exec(`CREATE TABLE IF NOT EXISTS edits (
    user_id INTEGER,
    username TEXT,
    channel_id INTEGER,
    before TEXT,
    after TEXT,
    timestamp TEXT DEFAULT (datetime('now'))
  )`);
  await db.exec(`CREATE TABLE IF NOT EXISTS deletes (
    user_id INTEGER,
    username TEXT,
    channel_id INTEGER,
    content TEXT,
    timestamp TEXT DEFAULT (datetime('now'))
  )`);
}

// --- แก้ไขส่วน Google Drive API ให้โหลดจาก Environment Variable แทน keyFile ---

const googleKeyString = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
if (!googleKeyString) {
  console.error('Error: GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable is not set!');
  process.exit(1);
}

const googleKey = JSON.parse(googleKeyString);
const privateKey = googleKey.private_key.replace(/\\n/g, '\n');

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: ['https://www.googleapis.com/auth/drive']
})

const drive = google.drive({ version: 'v3', auth });

async function getFileLink(filename) {
  const res = await drive.files.list({
    q: `name='${filename}' and '${FOLDER_ID}' in parents and trashed=false`,
    fields: 'files(id, name)',
  });
  const files = res.data.files;
  if (!files || files.length === 0) return null;
  return `https://drive.google.com/file/d/${files[0].id}/view`;
}

// --- ส่วนที่เหลือของโค้ดยังคงเหมือนเดิม ---

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  await setupDatabase();
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'ping') {
    await interaction.reply('Pong!');
  }

  if (interaction.commandName === 'ส่งไฟล์') {
    const member = interaction.options.getMember('member');
    const filename = interaction.options.getString('filename');

    if (interaction.channel.id !== ALLOWED_CHANNEL_ID) {
      await interaction.reply({
        content: '❌ ใช้คำสั่งนี้ได้เฉพาะในช่องที่กำหนดเท่านั้น',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const link = await getFileLink(filename);
    if (!link) {
      await interaction.editReply(`❌ ไม่พบไฟล์ \`${filename}\` ใน Google Drive`);
      return;
    }

    try {
      await member.send(`📜 คุณได้รับหมายศาลจากศาลยุติธรรม\n🔗 ลิงก์ไฟล์: ${link}`);
      await interaction.editReply(`✅ ส่งลิงก์ไฟล์ \`${filename}\` ให้ ${member} เรียบร้อยแล้ว`);
    } catch {
      await interaction.editReply(`❌ ไม่สามารถส่ง DM ให้ ${member} ได้ (อาจปิด DM)`);
    }
  }
});

  // เพิ่มคำสั่งอื่น ๆ ได้ที่นี่
});

// Log member join
client.on(Events.GuildMemberAdd, async (member) => {
  const channel = await client.channels.fetch(LOG_CHANNELS.member_join).catch(() => null);
  if (channel?.isTextBased()) {
    channel.send(`🟢 สมาชิกใหม่: ${member} เข้าร่วมเซิร์ฟเวอร์แล้ว`);
  }
});

// Log member leave
client.on(Events.GuildMemberRemove, async (member) => {
  const channel = await client.channels.fetch(LOG_CHANNELS.member_leave).catch(() => null);
  if (channel?.isTextBased()) {
    channel.send(`🔴 สมาชิก: ${member.user.tag} ออกจากเซิร์ฟเวอร์`);
  }
});

// Log voice state updates
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  const channel = await client.channels.fetch(LOG_CHANNELS.voice_state).catch(() => null);
  if (!channel?.isTextBased()) return;

  if (oldState.channelId !== newState.channelId) {
    if (newState.channelId) {
      await channel.send(`🎧 ${newState.member.displayName} เข้าห้องเสียง: ${newState.channel.name}`);
    } else if (oldState.channelId) {
      await channel.send(`👋 ${oldState.member.displayName} ออกจากห้องเสียง: ${oldState.channel.name}`);
    }
  }
  if (oldState.selfMute !== newState.selfMute) {
    const status = newState.selfMute ? "🔇 ปิดไมค์" : "🎙️ เปิดไมค์";
    await channel.send(`${status}: ${newState.member.displayName}`);
  }
  if (oldState.selfDeaf !== newState.selfDeaf) {
    const status = newState.selfDeaf ? "🔈 ปิดหูฟัง" : "🎧 เปิดหูฟัง";
    await channel.send(`${status}: ${newState.member.displayName}`);
  }
});

// Log message delete
client.on(Events.MessageDelete, async (message) => {
  if (message.author?.bot) return;
  const channel = await client.channels.fetch(LOG_CHANNELS.message_delete).catch(() => null);
  if (channel?.isTextBased()) {
    channel.send(`🗑️ ข้อความถูกลบใน ${message.channel} โดย ${message.author}:\n\`\`\`${message.content}\`\`\``);
  }
  await db.run(
    `INSERT INTO deletes (user_id, username, channel_id, content) VALUES (?, ?, ?, ?)`,
    message.author.id,
    message.author.tag,
    message.channel.id,
    message.content
  );
});

// Log message edit
client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
  if (oldMessage.author?.bot) return;
  if (oldMessage.content === newMessage.content) return;
  const channel = await client.channels.fetch(LOG_CHANNELS.message_edit).catch(() => null);
  if (channel?.isTextBased()) {
    channel.send(
      `✏️ ข้อความถูกแก้ไขใน ${oldMessage.channel} โดย ${oldMessage.author}:\n` +
      `ก่อนหน้า:\n\`\`\`${oldMessage.content}\`\`\`\n` +
      `หลังจาก:\n\`\`\`${newMessage.content}\`\`\``
    );
  }
  await db.run(
    `INSERT INTO edits (user_id, username, channel_id, before, after) VALUES (?, ?, ?, ?, ?)`,
    oldMessage.author.id,
    oldMessage.author.tag,
    oldMessage.channel.id,
    oldMessage.content,
    newMessage.content
  );
});

// Log nickname change
client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  if (oldMember.nickname === newMember.nickname) return;
  const channel = await client.channels.fetch(LOG_CHANNELS.name_change).catch(() => null);
  if (channel?.isTextBased()) {
    const oldName = oldMember.nickname ?? oldMember.user.username;
    const newName = newMember.nickname ?? newMember.user.username;
    channel.send(`👥 ผู้ใช้เปลี่ยนชื่อเล่นในเซิร์ฟเวอร์: **${oldName}** ➡️ **${newName}** (ผู้ใช้: ${newMember})`);
  }
});

// Log invite create
client.on(Events.InviteCreate, async (invite) => {
  const channel = await client.channels.fetch(LOG_CHANNELS.invite_create).catch(() => null);
  if (channel?.isTextBased()) {
    channel.send(`🔗 มีการสร้าง Invite:\nลิงก์: ${invite.url}\nโดย: ${invite.inviter} ในห้อง ${invite.channel}`);
  }
});

client.login(process.env.TOKEN);

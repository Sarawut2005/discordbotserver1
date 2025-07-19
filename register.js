import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const commands = [
  {
    name: 'ping',
    description: 'Replies with Pong!',
  },
  {
    name: 'ส่งไฟล์',
    description: 'ส่งหมายศาลจาก Google Drive ทาง DM',
    options: [
      {
        name: 'member',
        description: 'ผู้รับ',
        type: 6, // USER
        required: true,
      },
      {
        name: 'filename',
        description: 'ชื่อไฟล์ PDF ใน Google Drive (ต้องระบุ .pdf)',
        type: 3, // STRING
        required: true,
      },
    ],
  },
  {
    name: 'ตรวจสอบย้อนหลัง',
    description: 'ตรวจสอบ log การลบหรือแก้ไขข้อความย้อนหลัง',
    options: [
      {
        name: 'log_type',
        description: "เลือกประเภท log: 'edit' หรือ 'delete'",
        type: 3,
        required: true,
        choices: [
          { name: 'edit', value: 'edit' },
          { name: 'delete', value: 'delete' },
        ],
      },
    ],
  },
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();

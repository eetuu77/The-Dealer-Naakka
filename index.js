require('dotenv').config();

const fs = require('fs');

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = "1505180304057569401";
const GUILD_ID = "1500881333348470846";
const CHANNEL_ID = "1505181511010488420";

const MONEY_FILE = './money.json';
if (!fs.existsSync(MONEY_FILE)) {
  fs.writeFileSync(MONEY_FILE, JSON.stringify({}));
}

function loadMoney() {
  return JSON.parse(fs.readFileSync(MONEY_FILE));
}

function saveMoney(data) {
  fs.writeFileSync(MONEY_FILE, JSON.stringify(data, null, 2));
}

function getMoney(userId) {
  const data = loadMoney();
  if (!data[userId]) { data[userId] = 0; saveMoney(data); }
  return data[userId];
}

function addMoney(userId, amount) {
  const data = loadMoney();
  if (!data[userId]) data[userId] = 0;
  data[userId] += amount;
  saveMoney(data);
}

const dealerReplies = [
  "toi näyttää scamilt",
  "w trade",
  "älä tee tota diiliä 😭",
  "ihan hyvä ehkä",
  "instant accept",
  "toi äijä yrittää kusettaa sua",
  "fair deal",
  "L trade ngl",
  "ottaisin ite",
  "vähä overpay",
  "älä koske toho",
  "toi on risky",
  "hyvä diili kyl",
  "toi voi olla legit",
  "en luottais toho"
];

const kumpiQuestions = [
  { question: "kumpi: varastettu puhelin vai varastettu lompakko? 👀", a: "puhelin", b: "lompakko" },
  { question: "kumpi: mystinen paketti vai suljettu laukku? 🎒", a: "paketti", b: "laukku" },
  { question: "kumpi: varastettu auto vai varastettu mopo? 🚗", a: "auto", b: "mopo" },
  { question: "kumpi: pimeä diili nyt vai odottaa huomiseen? ⏰", a: "nyt", b: "huominen" },
  { question: "kumpi: pieni paketti monella rahalla vai iso paketti vähällä rahalla? 📦", a: "pieni", b: "iso" },
  { question: "kumpi: tuntematon mies kadulla vai tuttu jälleenmyyjä? 🕵️", a: "tuntematon", b: "tuttu" },
  { question: "kumpi: nopea keikka vai turvallinen keikka? 💼", a: "nopea", b: "turvallinen" }
];

const activeKumpi = new Map();
const userMessages = new Map();
const warnedUsers = new Map();
// 0 = ei varoitettu, 1 = 2h timeout saatu, 2 = 24h timeout saatu

const commands = [
  new SlashCommandBuilder().setName('balance').setDescription('Näyttää sinun pankkitilin saldon'),
  new SlashCommandBuilder().setName('ping').setDescription('Hälyttää dealerin paikalle'),
  new SlashCommandBuilder().setName('rob').setDescription('Yritä ryöstää joku paikka')
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('Slash commands registered.');
  } catch (error) {
    console.log(error);
  }
})();

client.once('ready', () => {
  console.log(`${client.user.tag} online`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.channel.id !== CHANNEL_ID) return;

  const content = message.content.toLowerCase();

  // KUMPI VASTAUS
  if (activeKumpi.has(message.author.id)) {
    const kumpi = activeKumpi.get(message.author.id);
    const answer = content.trim();

    if (answer === kumpi.a || answer === kumpi.b) {
      activeKumpi.delete(message.author.id);
      const isGood = Math.random() > 0.5;
      const amount = isGood
        ? Math.floor(Math.random() * 800) + 400
        : Math.floor(Math.random() * 200) + 50;
      addMoney(message.author.id, amount);
      if (isGood) {
        return message.reply(`hyvä valinta 😏 dealer on tyytyväinen\n💸 sait **${amount}€**`);
      } else {
        return message.reply(`hmm... olisit voinu valita paremmin 😬\nsait vaan **${amount}€**`);
      }
    }
  }

  // RANDOM MONEY
  const randomMoneyChance = Math.floor(Math.random() * 80);
  if (randomMoneyChance === 7) {
    const amount = Math.floor(Math.random() * 500) + 100;
    addMoney(message.author.id, amount);
    message.reply(`löysin vähä ylimäärästä rahaa 💸 (+${amount}€)`);
  }

  // KUMPI KYSYMYS SATUNNAISESTI
  const kumpiChance = Math.floor(Math.random() * 10);
  if (kumpiChance === 3 && !activeKumpi.has(message.author.id)) {
    const q = kumpiQuestions[Math.floor(Math.random() * kumpiQuestions.length)];
    activeKumpi.set(message.author.id, q);
    return message.reply(`psst... ${q.question}\nkirjoita **${q.a}** tai **${q.b}**`);
  }

  // SPAM DETECTION
  if (content.includes("ostaks") || content.includes("kumpi") || content.includes("deal") || content.includes("trade") || content.includes("w/l")) {
    const now = Date.now();
    if (!userMessages.has(message.author.id)) userMessages.set(message.author.id, []);
    const timestamps = userMessages.get(message.author.id);
    timestamps.push(now);
    const filtered = timestamps.filter(t => now - t < 20000);
    userMessages.set(message.author.id, filtered);

    const warnLevel = warnedUsers.get(message.author.id) || 0;

    // ENSIMMÄINEN VAROITUS
    if (filtered.length >= 5 && warnLevel === 0) {
      warnedUsers.set(message.author.id, 1);
      try {
        const member = await message.guild.members.fetch(message.author.id);
        await member.timeout(2 * 60 * 60 * 1000, "Dealer spam - 1. timeout");
        return message.reply("älä spämmää 😭 sait **2h jäähyn**. jatka niin tulee pahempaa 👀");
      } catch (err) { console.log(err); }
    }

    // TOINEN VAROITUS
    else if (filtered.length >= 5 && warnLevel === 1) {
      warnedUsers.set(message.author.id, 2);
      try {
        const member = await message.guild.members.fetch(message.author.id);
        await member.timeout(24 * 60 * 60 * 1000, "Dealer spam - 2. timeout");
        return message.reply("varoitettiin kerran jo 💀 sait **24h jäähyn**. seuraava on ban 🚨");
      } catch (err) { console.log(err); }
    }

    // BAN
    else if (filtered.length >= 5 && warnLevel === 2) {
      try {
        const member = await message.guild.members.fetch(message.author.id);
        await message.reply("game over 🚨 **banned**");
        await member.ban({ reason: "Dealer spam - pysyvä ban" });
      } catch (err) { console.log(err); }
    }
  }

  // RANDOM DEALER REPLY
  const randomReplyChance = Math.floor(Math.random() * 7);
  if (randomReplyChance === 1) {
    const reply = dealerReplies[Math.floor(Math.random() * dealerReplies.length)];
    message.reply(reply);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'balance') {
    const money = getMoney(interaction.user.id);
    return interaction.reply({ content: `💰 **Pankkitili**\n\nSaldo: **${money}€**`, ephemeral: true });
  }

  if (interaction.commandName === 'ping') {
    const chance = Math.floor(Math.random() * 100);
    if (chance < 70) return interaction.reply("dealer ei vastaa...");
    if (chance >= 70 && chance < 95) return interaction.reply("dealer saapui paikalle 🚬 sano asias");
    const reward = Math.floor(Math.random() * 1000) + 500;
    addMoney(interaction.user.id, reward);
    return interaction.reply(`dealer arvosti sun uskollisuutta 💸 (+${reward}€)`);
  }

  if (interaction.commandName === 'rob') {
    const failChance = Math.floor(Math.random() * 100);
    const failMessages = ["jäit kiinni poliiseille 🚔", "kamera näki sut 😭", "vartija pysäytti sut", "epäonnistuit ryöstössä", "säikähdit ja juoksit pois"];
    const successMessages = ["ryöstit huoltoaseman", "murtauduit pikkukauppaan", "dealer antoi sulle keikan", "löysit piilotettua käteistä", "ryöstit automaatin 💀"];

    if (failChance < 45) {
      const msg = failMessages[Math.floor(Math.random() * failMessages.length)];
      return interaction.reply(`${msg}\n\net saanut rahaa`);
    }

    const amount = Math.floor(Math.random() * 999) + 1;
    addMoney(interaction.user.id, amount);
    const msg = successMessages[Math.floor(Math.random() * successMessages.length)];
    return interaction.reply(`${msg}\n\n💸 sait **${amount}€**`);
  }
});

client.login(TOKEN);

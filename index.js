require('dotenv').config();
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const contactsServer = require('./update-contacts');

const { Client } = require("whatsapp-web.js");
const client = new Client({ puppeteer: { headless: true,args: ['--no-sandbox', '--disable-setuid-sandbox']} });

const { Configuration, OpenAIApi } = require("openai");

let CHAT_CONTEXT = "context/chat - " + new Date().getTime() + ".json";
let CONTACTS_FILE = "contacts.json";
let context = {};

const configuration = new Configuration({
  apiKey: process.env.OPENAIA_API_KEY,
});

const openai = new OpenAIApi(configuration);

client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("Client is ready!");
});

client.on("message", async (message) => {
  const contacts = await contactsToAutoRespond(CONTACTS_FILE);
  const isContact = contacts.includes(message.from.split('@')[0]);

  // Auto reply if number is NOT in contacts.json
  if (!isContact) {
    try {
      askChatGPT(message.from, message.body).then(function (resp) {
        context[message.from] = context[message.from] + "\n" + resp;
        console.log("Replying: ", resp);
        client.sendMessage(
          message.from,
          resp.replace("AI:", "").replace("Robot:", "")
        );
        savetoFile(CHAT_CONTEXT, context);
      }, function(err) {
        console.log("Error: ", err);
      });
    } catch (e) {
      console.log("ERR: ", e);
    }
  }
});

client.initialize();
contactsServer;

async function askChatGPT(from, q) {
  context[from] = context[from] ? context[from] + "\nHuman: " + q : "Human: " + q;

  const completion = await openai.createCompletion({
    model: "text-davinci-003",
    temperature: 0.7,
    max_tokens: 150,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0.6,
    prompt: `Jibu meseji hii kwa lugha ya Kiswahili au Kiingereza kulingana na lugha ya mteja. Usijionyeshe kama AI. Jibu kwa sauti ya kirafiki ya Lawrence wa Moshi.\n${context[from]}`,
    stop: [" Human:", " AI:"]
  });

  console.log("Q: ", context[from]);
  return completion.data.choices[0].text.trim();
}

function savetoFile(file, data) {
  fs.writeFile(file, JSON.stringify(data), (err) => {
    if (err) console.log("Error saving file: ", err);
  });
}

async function contactsToAutoRespond() {
  return new Promise((resolve, reject) => {
    fs.readFile("contacts.json", "utf8", (err, data) => {
      if (err) reject(err);
      else resolve(JSON.parse(data));
    });
  });
}

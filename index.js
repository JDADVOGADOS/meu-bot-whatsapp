require("dotenv").config();

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  getContentType,
  makeCacheableSignalKeyStore,
} = require("@whiskeysockets/baileys");
const Anthropic = require("@anthropic-ai/sdk");
const qrcode = require("qrcode-terminal");
const QRCode = require("qrcode");
const http = require("http");
const pino = require("pino");

// ─── Configuração ─────────────────────────────────────────────────
const apiKey = process.env.ANTHROPIC_API_KEY;
console.log("🔑 Chave API detectada:", apiKey ? "SIM ✅" : "NÃO ❌");
console.log("🔑 Todas as variáveis:", Object.keys(process.env).filter(k => !k.includes("npm")).join(", "));

if (!apiKey) {
  console.error("❌ ANTHROPIC_API_KEY não encontrada! Verifique as variáveis de ambiente.");
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey });

const conversationHistory = new Map();
let currentQRUrl = null;
let botOnline = false;

const BOT_CONFIG = {
  businessName: "JD Advocacia",
  systemPrompt: `Você é o assistente virtual do escritório JD Advocacia, especializado em Direito Empresarial e Direito Tributário.

SOBRE O ESCRITÓRIO:
- Especialidades: Direito Empresarial e Direito Tributário
- Atendimento: de segunda a sexta, das 8h às 18h

COMO VOCÊ DEVE SE COMPORTAR:
- Seja cordial, profissional e objetivo
- Responda sempre em português do Brasil
- Use linguagem acessível, evite termos jurídicos complexos sem explicação
- Nunca dê pareceres jurídicos ou opiniões legais — apenas oriente o cliente a agendar uma consulta
- Mantenha respostas curtas, adequadas para WhatsApp (sem markdown excessivo)

O QUE VOCÊ PODE FAZER:
- Informar as áreas de atuação do escritório
- Explicar brevemente o que é Direito Empresarial e Tributário
- Agendar consultas (colete: nome completo, assunto e melhor horário)
- Responder dúvidas gerais sobre como funciona o atendimento
- Informar que consultas iniciais são realizadas presencialmente ou por videoconferência

O QUE VOCÊ NÃO DEVE FAZER:
- Dar opiniões sobre casos específicos
- Prometer resultados
- Falar sobre honorários (diga que isso é tratado diretamente com o advogado)

TRANSFERÊNCIA PARA HUMANO:
- Se o cliente insistir em detalhes de um caso específico, quiser falar com o advogado, ou você não souber responder, diga que vai transferir para um atendente e termine sua resposta com a palavra TRANSFERIR_HUMANO`,

  maxHistoryLength: 20,
  welcomeMessage: "Olá! 👋 Bem-vindo ao *JD Advocacia*.\n\nSou o assistente virtual do escritório, especializado em *Direito Empresarial* e *Direito Tributário*.\n\nComo posso te ajudar hoje?",
  advogadoNumero: process.env.ADVOGADO_NUMERO || "",
};

// ─── Servidor Web ──────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });

  if (botOnline) {
    res.end(`
      <html><head><meta charset="utf-8"><title>JD Advocacia Bot</title></head>
      <body style="display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f5f5;font-family:sans-serif">
        <div style="background:white;border-radius:16px;padding:2rem;box-shadow:0 4px 20px rgba(0,0,0,0.1);text-align:center;max-width:400px">
          <div style="font-size:4rem">✅</div>
          <h2 style="color:#128C7E">Bot Online!</h2>
          <p style="color:#666">O assistente virtual do JD Advocacia está ativo.</p>
        </div>
      </body></html>
    `);
    return;
  }

  if (currentQRUrl) {
    res.end(`
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta http-equiv="refresh" content="60">
        <title>QR Code - JD Advocacia Bot</title>
        <style>
          body { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; margin:0; background:#f5f5f5; font-family:sans-serif; }
          .card { background:white; border-radius:16px; padding:2rem; box-shadow:0 4px 20px rgba(0,0,0,0.1); text-align:center; max-width:400px; }
          h2 { color:#128C7E; margin-bottom:0.5rem; }
          p { color:#666; font-size:0.9rem; }
          .step { background:#f0f0f0; border-radius:8px; padding:0.8rem; margin-top:1rem; text-align:left; font-size:0.85rem; line-height:1.8; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>📱 JD Advocacia Bot</h2>
          <p>Escaneie o QR Code abaixo com o WhatsApp</p>
          <img src="${currentQRUrl}" width="280" height="280" style="border-radius:8px;margin:1rem 0" />
          <div class="step">
            <b>Como escanear:</b><br>
            1. Abra o WhatsApp no celular<br>
            2. Toque em Menu (⋮) → Aparelhos conectados<br>
            3. Toque em "Conectar um aparelho"<br>
            4. Aponte a câmera para o QR Code acima
          </div>
          <p style="margin-top:1rem;color:#999;font-size:0.8rem">Página atualiza a cada 60 segundos</p>
        </div>
      </body>
      </html>
    `);
    return;
  }

  res.end(`
    <html>
    <head><meta charset="utf-8"><meta http-equiv="refresh" content="5"><title>JD Advocacia Bot</title></head>
    <body style="display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f5f5;font-family:sans-serif">
      <div style="background:white;border-radius:16px;padding:2rem;box-shadow:0 4px 20px rgba(0,0,0,0.1);text-align:center;max-width:400px">
        <div style="font-size:3rem">⏳</div>
        <h2 style="color:#128C7E">Iniciando bot...</h2>
        <p style="color:#666">Aguarde, o QR Code aparecerá em instantes.<br>Esta página atualiza automaticamente.</p>
      </div>
    </body>
    </html>
  `);
});

server.listen(process.env.PORT || 8080, () => {
  console.log(`✅ Servidor web no ar na porta ${process.env.PORT || 8080}`);
});

// ─── Funções Auxiliares ────────────────────────────────────────────
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extrairTexto(message) {
  const m = message.message;
  if (!m) return "";

  if (m.conversation) return m.conversation;
  if (m.extendedTextMessage?.text) return m.extendedTextMessage.text;

  const tipos = [
    "imageMessage", "videoMessage", "documentMessage",
    "audioMessage", "buttonsResponseMessage", "listResponseMessage",
    "templateMessage",
  ];

  for (const tipo of tipos) {
    if (m[tipo]?.caption) return m[tipo].caption;
    if (m[tipo]?.text) return m[tipo].text;
  }

  try {
    const contentType = getContentType(m);
    if (contentType && m[contentType]) {
      return m[contentType]?.text || m[contentType]?.caption || m[contentType]?.conversation || "";
    }
  } catch (e) {}

  return "";
}

function obterRemetente(message) {
  if (message.key.remoteJid?.includes("@lid")) {
    return message.key.senderPn || message.key.remoteJid;
  }
  return message.key.remoteJid;
}

async function getAIResponse(customerId, customerMessage) {
  if (!conversationHistory.has(customerId)) {
    conversationHistory.set(customerId, []);
  }

  const history = conversationHistory.get(customerId);
  history.push({ role: "user", content: customerMessage });

  if (history.length > BOT_CONFIG.maxHistoryLength) {
    history.splice(0, history.length - BOT_CONFIG.maxHistoryLength);
  }

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: BOT_CONFIG.systemPrompt,
    messages: history,
  });

  const aiReply = response.content[0].text;
  history.push({ role: "assistant", content: aiReply });

  return aiReply;
}

// ─── Iniciar Bot ───────────────────────────────────────────────────
async function startBot() {
  console.log(`\n🤖 Iniciando Bot WhatsApp + Claude AI...`);
  console.log(`📋 Empresa: ${BOT_CONFIG.businessName}\n`);

  const { state, saveCreds } = await useMultiFileAuthState("auth_info");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
    },
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    syncFullHistory: true,
    markOnlineOnConnect: true,
    getMessage: async (key) => {
      console.log(`🔄 Buscando mensagem: ${key.id}`);
      return { conversation: "" };
    },
  });

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\n📱 QR Code gerado!\n");
      qrcode.generate(qr, { small: true });
      QRCode.toDataURL(qr, (err, url) => {
        if (!err) {
          currentQRUrl = url;
          console.log("✅ QR Code disponível.\n");
        }
      });
    }

    if (connection === "close") {
      botOnline = false;
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log("⚠️ Conexão encerrada. Reconectando:", shouldReconnect);
      if (shouldReconnect) {
        await delay(3000);
        startBot();
      } else {
        console.log("❌ Sessão encerrada. Delete a pasta auth_info e reinicie.");
      }
    }

    if (connection === "open") {
      botOnline = true;
      currentQRUrl = null;
      console.log(`\n✅ Bot "${BOT_CONFIG.businessName}" está online!\n`);
      console.log("Aguardando mensagens...\n");
    }
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    console.log(`📨 Evento - tipo: ${type}, qtd: ${messages.length}`);
    if (type !== "notify") return;

    for (const message of messages) {
      if (message.key.fromMe) continue;

      const remoteJid = message.key.remoteJid || "";
      if (remoteJid.includes("@g.us")) continue;
      if (remoteJid === "status@broadcast") continue;
      if (remoteJid.includes("@newsletter")) continue;
      if (remoteJid.includes("@broadcast")) continue;

      // // Ignorar mensagens de protocolo interno do WhatsApp
      if (message.message?.protocolMessage) continue;
      if (message.message?.reactionMessage) continue;
      if (message.messageStubType && message.messageStubType !== 2) {
        console.log(`⏭️ Ignorando stub tipo: ${message.messageStubType}`);
        continue;
      }

      const customerId = obterRemetente(message);
      console.log(`🔬 message.message: ${JSON.stringify(message.message)}`);
      const customerMessage = extrairTexto(message);

      console.log(`📝 Cliente: ${customerId} | Msg: "${customerMessage}"`);

      if (!customerMessage.trim()) continue;

      console.log(`\n📩 [${new Date().toLocaleTimeString()}] De: ${customerId}`);

      try {
        const isNewCustomer = !conversationHistory.has(customerId);
        if (isNewCustomer) {
          await sock.sendMessage(customerId, { text: BOT_CONFIG.welcomeMessage });
          await delay(800);
        }

        const aiReply = await getAIResponse(customerId, customerMessage);
        console.log(`   Resposta IA: "${aiReply.substring(0, 80)}..."`);

        if (aiReply.includes("TRANSFERIR_HUMANO")) {
          const cleanReply = aiReply.replace("TRANSFERIR_HUMANO", "").trim();
          await sock.sendMessage(customerId, { text: cleanReply });
          await handleHumanTransfer(sock, customerId, customerMessage);
          conversationHistory.delete(customerId);
          continue;
        }

        await sock.sendMessage(customerId, { text: aiReply });

      } catch (error) {
        console.error("❌ Erro:", error.message);
        await sock.sendMessage(customerId, {
          text: "Desculpe, tive um problema técnico. Tente novamente em instantes.",
        });
      }
    }
  });
}

// ─── Transferência para Humano ─────────────────────────────────────
async function handleHumanTransfer(sock, customerId, lastMessage) {
  console.log(`\n🔄 Transferindo ${customerId} para humano`);
  if (BOT_CONFIG.advogadoNumero) {
    await sock.sendMessage(BOT_CONFIG.advogadoNumero, {
      text:
        `🔔 *Novo atendimento solicitado*\n\n` +
        `📱 Cliente: ${customerId.replace("@s.whatsapp.net", "").replace("@lid", "")}\n` +
        `💬 Última mensagem: "${lastMessage}"\n\n` +
        `Acesse o WhatsApp para continuar o atendimento.`,
    });
  }
}

// ─── Limpeza de histórico ──────────────────────────────────────────
setInterval(() => {
  let cleaned = 0;
  conversationHistory.forEach((_, id) => {
    conversationHistory.delete(id);
    cleaned++;
  });
  if (cleaned > 0) console.log(`🧹 ${cleaned} conversas limpas`);
}, 2 * 60 * 60 * 1000);

// ─── Iniciar ───────────────────────────────────────────────────────
startBot().catch((err) => {
  console.error("❌ Erro fatal:", err);
  process.exit(1);
});

# 🤖 WhatsApp AI Bot com Claude

Bot de atendimento ao cliente para WhatsApp com integração à IA do Claude (Anthropic).

## ✅ Pré-requisitos

- Node.js 18+
- Conta Anthropic com chave de API
- Google Chrome ou Chromium instalado
- Um número de WhatsApp para o bot

## 🚀 Instalação

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variável de ambiente
cp .env.example .env
# Edite o .env e insira sua ANTHROPIC_API_KEY

# 3. Iniciar o bot
npm start
```

## 📱 Primeiro Uso

1. Ao iniciar, um QR Code aparecerá no terminal
2. Abra o WhatsApp no celular → Configurações → Aparelhos conectados
3. Escaneie o QR Code
4. O bot estará online!

## ⚙️ Personalização (`index.js`)

```js
const BOT_CONFIG = {
  businessName: "Minha Empresa",   // Nome do seu negócio
  systemPrompt: `...`,             // Instruções de comportamento da IA
  maxHistoryLength: 20,            // Máximo de mensagens no histórico
  welcomeMessage: "Olá! 👋 ...",   // Mensagem de boas-vindas
};
```

### Exemplos de System Prompt

**Loja de e-commerce:**
```
Você é o assistente da Loja XYZ. Ajude com pedidos, rastreamento e trocas.
Horário de atendimento: seg-sex 8h-18h.
```

**Clínica médica:**
```
Você é a recepcionista virtual da Clínica ABC. 
Ajude com agendamentos, informações sobre especialidades e localização.
Nunca dê diagnósticos médicos.
```

**Suporte técnico:**
```
Você é o suporte técnico da EmpresaTech.
Auxilie com problemas comuns, colete informações do problema e crie tickets.
```

## 🔄 Transferência para Humano

Quando a IA não conseguir resolver, ela retorna `TRANSFERIR_HUMANO` 
e você pode implementar em `handleHumanTransfer()`:

- Notificar número do atendente via WhatsApp
- Criar ticket no CRM (Salesforce, HubSpot, etc.)
- Enviar e-mail para a equipe
- Salvar em banco de dados

## 📦 Estrutura

```
whatsapp-ai-bot/
├── index.js          # Código principal
├── package.json      # Dependências
├── .env.example      # Exemplo de variáveis de ambiente
├── .env              # Suas variáveis (NÃO commitar!)
└── .wwebjs_auth/     # Sessão do WhatsApp (gerado automaticamente)
```

## ⚠️ Importante

- Use um número de WhatsApp **dedicado** ao bot (não seu número pessoal)
- A sessão fica salva em `.wwebjs_auth/` — guarde esse diretório
- Para produção, considere usar Docker para maior estabilidade
- Respeite os [Termos de Serviço do WhatsApp](https://www.whatsapp.com/legal/terms-of-service)

## 🐳 Docker (Produção)

```dockerfile
FROM node:18-slim
RUN apt-get update && apt-get install -y chromium
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
CMD ["node", "index.js"]
```

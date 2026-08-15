const express = require("express");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Delivery Facil</title>
    </head>
    <body>
      <h1>Delivery Facil</h1>
      <p>Pedidos rápidos e fáceis pelo WhatsApp.</p>
      <p>Entre em contato conosco para fazer seu pedido.</p>
    </body>
    </html>
  `);
});

app.get("/webhook", (req, res) => {
  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  res.sendStatus(403);
});


app.post("/webhook", (req, res) => {
  const entrada = req.body.entry?.[0];
  const mudanca = entrada?.changes?.[0];
  const valor = mudanca?.value;
  const mensagem = valor?.messages?.[0];

  if (mensagem) {
    const numero = mensagem.from;
    const tipo = mensagem.type;

    console.log("Mensagem recebida:");
    console.log("Número:", numero);
    console.log("Tipo:", tipo);

    if (tipo === "text") {
      console.log("Texto:", mensagem.text?.body);
    }
  }

  res.sendStatus(200);
});


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
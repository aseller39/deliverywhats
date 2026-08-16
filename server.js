const express = require("express");

const app = express();


app.use(express.json());



async function enviarMensagemWhatsApp(numero, texto) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  const resposta = await fetch(
    `https://graph.facebook.com/v26.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: numero,
        type: "text",
        text: {
          body: texto
        }
      })
    }
  );

  const dados = await resposta.json();

  console.log("Resposta da Meta:", JSON.stringify(dados, null, 2));

  return dados;
}


app.get("/teste-whatsapp", async (req, res) => {
  try {
    const resultado = await enviarMensagemWhatsApp(
      "5586988134359",
      "Olá! Teste do Delivery Facil funcionando."
    );

    res.json(resultado);
  } catch (erro) {
    console.error("Erro ao enviar WhatsApp:", erro);
    res.status(500).json({ erro: "Falha ao enviar mensagem" });
  }
});



app.get("/politica-privacidade", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Política de Privacidade - Delivery Fácil</title>
    </head>
    <body>
      <h1>Política de Privacidade</h1>

      <p>
        O Delivery Fácil respeita a privacidade dos seus usuários.
        As informações enviadas pelo WhatsApp são utilizadas para
        atendimento, processamento e acompanhamento dos pedidos.
      </p>

      <p>
        Podemos utilizar informações como nome, número de telefone,
        endereço de entrega e informações relacionadas ao pedido para
        prestar o serviço solicitado.
      </p>

      <p>
        Não vendemos informações pessoais dos usuários.
      </p>

      <p>
        As informações são utilizadas somente para as finalidades
        relacionadas ao funcionamento do serviço e atendimento dos clientes.
      </p>

      <p>
        Para dúvidas sobre privacidade, entre em contato pelo canal oficial
        do Delivery Fácil.
      </p>
    </body>
    </html>
  `);
});



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


app.post("/webhook", async (req, res) => {
  try {
    const entrada = req.body.entry?.[0];
    const mudanca = entrada?.changes?.[0];
    const valor = mudanca?.value;
    const mensagem = valor?.messages?.[0];

    if (mensagem?.type === "text") {
      const numero = mensagem.from;
      const texto = mensagem.text?.body;

      console.log("Mensagem recebida:");
      console.log("Número:", numero);
      console.log("Texto:", texto);

      await enviarMensagemWhatsApp(
        numero,
        "Olá! 👋 Bem-vindo ao Gustum!"
      );
    }

    res.sendStatus(200);
  } catch (erro) {
    console.error("Erro no webhook:", erro);
    res.sendStatus(500);
  }
});


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
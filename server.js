const express = require("express");
const app = express();
const pool = require("./config/database");


app.use(express.static("public"));

app.use(express.json());



app.get("/criar-tabela-restaurantes", async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS restaurantes (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(150) NOT NULL,
        telefone VARCHAR(20),
        ativo BOOLEAN DEFAULT TRUE,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    res.json({
      sucesso: true,
      mensagem: "Tabela restaurantes criada com sucesso."
    });

  } catch (erro) {
    console.error("Erro ao criar tabela restaurantes:", erro);

    res.status(500).json({
      sucesso: false,
      erro: erro.message
    });
  }
});



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


app.get("/teste-banco", async (req, res) => {
  try {
    const resultado = await pool.query("SELECT NOW()");
    
    res.json({
      conectado: true,
      data: resultado.rows[0]
    });
  } catch (erro) {
    console.error("Erro no banco:", erro);
    res.status(500).json({
      conectado: false,
      erro: "Não foi possível conectar ao banco."
    });
  }
});


app.get("/teste-restaurantes", async (req, res) => {
  try {
    const resultado = await pool.query(
      "SELECT * FROM restaurantes"
    );

    res.json({
      sucesso: true,
      restaurantes: resultado.rows
    });

  } catch (erro) {
    console.error("Erro ao consultar restaurantes:", erro);

    res.status(500).json({
      sucesso: false,
      erro: erro.message
    });
  }
});



app.get("/cadastrar-gustum", async (req, res) => {
  try {
    const resultado = await pool.query(`
      INSERT INTO restaurantes (nome, telefone)
      VALUES ($1, $2)
      RETURNING *
    `, ["Gustum", "5586988134359"]);

    res.json({
      sucesso: true,
      restaurante: resultado.rows[0]
    });

  } catch (erro) {
    console.error("Erro ao cadastrar restaurante:", erro);

    res.status(500).json({
      sucesso: false,
      erro: erro.message
    });
  }
});


app.get("/criar-tabela-pratos", async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pratos (
        id SERIAL PRIMARY KEY,
        restaurante_id INTEGER NOT NULL REFERENCES restaurantes(id),
        nome VARCHAR(150) NOT NULL,
        descricao TEXT,
        preco NUMERIC(10,2) NOT NULL,
        disponivel BOOLEAN DEFAULT TRUE,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    res.json({
      sucesso: true,
      mensagem: "Tabela pratos criada com sucesso."
    });

  } catch (erro) {
    console.error("Erro ao criar tabela pratos:", erro);

    res.status(500).json({
      sucesso: false,
      erro: erro.message
    });
  }
});

app.get("/teste-pratos", async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT *
      FROM pratos
      WHERE restaurante_id = 1
      ORDER BY id
    `);

    res.json({
      sucesso: true,
      pratos: resultado.rows
    });

  } catch (erro) {
    console.error("Erro ao consultar pratos:", erro);

    res.status(500).json({
      sucesso: false,
      erro: erro.message
    });
  }
});


app.get("/cadastrar-arrumadinho", async (req, res) => {
  try {
    const resultado = await pool.query(`
      INSERT INTO pratos (
        restaurante_id,
        nome,
        descricao,
        preco
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [
      1,
      "Arrumadinho",
      "Feijão, arroz, farofa, vinagrete e carne.",
      20.00
    ]);

    res.json({
      sucesso: true,
      prato: resultado.rows[0]
    });

  } catch (erro) {
    console.error("Erro ao cadastrar prato:", erro);

    res.status(500).json({
      sucesso: false,
      erro: erro.message
    });
  }
});



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



app.get("/exclusao-dados", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Exclusão de Dados - Delivery Fácil</title>
    </head>
    <body>
      <h1>Exclusão de Dados</h1>

      <p>
        O usuário pode solicitar a exclusão dos dados pessoais relacionados
        ao uso do Delivery Fácil.
      </p>

      <p>
        Para solicitar a exclusão dos dados, entre em contato com o
        estabelecimento pelos canais oficiais e informe a solicitação.
      </p>

      <p>
        Após a confirmação da solicitação, os dados serão tratados de acordo
        com as obrigações legais aplicáveis e as necessidades legítimas de
        funcionamento do serviço.
      </p>
    </body>
    </html>
  `);
});



app.get("/termos", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Termos de Serviço - Delivery Fácil</title>
    </head>
    <body>
      <h1>Termos de Serviço</h1>

      <p>
        O Delivery Fácil oferece atendimento e processamento de pedidos
        por meio do WhatsApp.
      </p>

      <p>
        Ao utilizar o serviço, o usuário concorda em fornecer informações
        corretas e necessárias para o processamento do pedido.
      </p>

      <p>
        Os pedidos estão sujeitos à disponibilidade dos produtos,
        confirmação do estabelecimento e condições informadas no momento
        da compra.
      </p>

      <p>
        O usuário é responsável pelas informações fornecidas durante o pedido.
      </p>

      <p>
        Para dúvidas ou solicitações, entre em contato com o estabelecimento
        pelos canais oficiais.
      </p>
    </body>
    </html>
  `);
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


app.get("/api/cardapio", async (req, res) => {
  try {
    const restauranteId = req.query.restaurante;

    const resultado = await pool.query(`
      SELECT id, nome, descricao, preco
      FROM pratos
      WHERE restaurante_id = $1
        AND disponivel = true
      ORDER BY id
    `, [restauranteId]);

    res.json({
      sucesso: true,
      pratos: resultado.rows
    });

  } catch (erro) {
    console.error("Erro ao consultar cardápio:", erro);

    res.status(500).json({
      sucesso: false,
      erro: "Erro ao consultar cardápio"
    });
  }
});


app.get("/cardapio", (req, res) => {
  res.redirect("/cardapio.html");
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
        `🍽️ Olá! Bem-vindo ao Gustum!

      Confira nosso cardápio:
      🔗 https://SEU-LINK-DO-CARDAPIO

      Escolha seu prato e faça seu pedido!`
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
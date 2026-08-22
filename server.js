const express = require("express");
const app = express();
const pool = require("./config/database");
const multer = require("multer");

const upload = multer({
  dest: "public/uploads/produtos/"
});


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



app.get("/criar-tabela-pedidos", async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pedidos (
        id SERIAL PRIMARY KEY,
        restaurante_id INTEGER NOT NULL,
        itens JSONB NOT NULL,
        observacao TEXT,
        telefone VARCHAR(20) NOT NULL,
        tipo_entrega VARCHAR(20) NOT NULL,
        endereco TEXT,
        forma_pagamento VARCHAR(30) NOT NULL,
        total NUMERIC(10,2) NOT NULL,
        status VARCHAR(30) DEFAULT 'novo',
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    res.json({
      sucesso: true,
      mensagem: "Tabela pedidos criada com sucesso."
    });

  } catch (erro) {
    console.error("Erro ao criar tabela pedidos:", erro);

    res.status(500).json({
      sucesso: false,
      erro: "Erro ao criar tabela pedidos."
    });
  }
});


app.get("/api/restaurantes/1", async (req, res) => {
  try {
    const resultado = await pool.query(
      "SELECT id, nome, telefone, ativo FROM restaurantes WHERE id = 1"
    );

    res.json({
      sucesso: true,
      restaurante: resultado.rows[0] || null
    });

  } catch (erro) {
    console.error("Erro ao buscar restaurante:", erro);

    res.status(500).json({
      sucesso: false,
      erro: "Erro ao buscar restaurante."
    });
  }
});


app.post("/api/pedidos", async (req, res) => {
  try {
    const {
      restaurante_id,
      itens,
      observacao,
      nome,
      telefone,
      tipo_entrega,
      endereco,
      forma_pagamento,
      total
    } = req.body;

    if (
      !restaurante_id ||
      !itens ||
      !telefone ||
      !tipo_entrega ||
      !forma_pagamento ||
      total === undefined
    ) {
      return res.status(400).json({
        sucesso: false,
        erro: "Dados do pedido incompletos."
      });
    }

    const resultado = await pool.query(
      `
      INSERT INTO pedidos (
          restaurante_id,
          itens,
          observacao,
          nome,
          telefone,
          tipo_entrega,
          endereco,
          forma_pagamento,
          total,
          status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, criado_em, status
      `,
      [
        restaurante_id,
        JSON.stringify(itens),
        observacao || null,
        nome || null,
        telefone,
        tipo_entrega,
        endereco
        ? JSON.stringify(endereco)
        : null,
        forma_pagamento,
        total,
        "aguardando"
      ]
    );

    const pedidoMensagem = {
      id: resultado.rows[0].id,
      itens,
      observacao,
      nome,
      telefone,
      tipo_entrega,
      endereco,
      forma_pagamento,
      total
    };

    const mensagemWhatsApp = montarMensagemPedido(pedidoMensagem);

    console.log("MENSAGEM DO PEDIDO:");
    console.log(mensagemWhatsApp);

    const restaurante = await pool.query(
      "SELECT telefone FROM restaurantes WHERE id = $1",
      [restaurante_id]
    );

    const numeroRestaurante = restaurante.rows[0]?.telefone;

    if (!numeroRestaurante) {
      throw new Error("Telefone do restaurante não cadastrado.");
    }

    await enviarMensagemWhatsApp(
      numeroRestaurante,
      mensagemWhatsApp
    );

    console.log("Pedido enviado para o WhatsApp do restaurante com sucesso.");

    const mensagemCliente =
  `🍽️ Pedido #${resultado.rows[0].id} recebido!\n\n` +
  `Obrigado, ${nome || "cliente"}, por comprar na Gustum! ❤️\n\n` +
  `Seu pedido já está sendo preparado. ` +
  `Acompanhe o andamento pelo link do seu pedido.`;

try {

  console.log(
    "ENVIANDO CONFIRMAÇÃO PARA O CLIENTE:",
    telefone
  );

  const respostaCliente =
    await enviarMensagemWhatsApp(
      telefone,
      mensagemCliente
    );

  console.log(
    "RESPOSTA WHATSAPP CLIENTE:",
    respostaCliente
  );

} catch (erroCliente) {

  console.error(
    "ERRO AO ENVIAR WHATSAPP PARA CLIENTE:",
    erroCliente
  );

}

console.log(
  "Confirmação enviada para o WhatsApp do cliente."
);

    res.status(201).json({
      sucesso: true,
      mensagem: "Pedido recebido com sucesso.",
      pedido: resultado.rows[0]
    });

  } catch (erro) {
    console.error("Erro ao salvar pedido:", erro);

    res.status(500).json({
      sucesso: false,
      erro: "Erro ao salvar pedido."
    });
  }
});


app.get("/api/pedidos/:id/status", async (req, res) => {
    try {

        const pedidoId = Number(req.params.id);

        if (!pedidoId) {
            return res.status(400).json({
                sucesso: false,
                erro: "ID do pedido inválido."
            });
        }

        const resultado = await pool.query(
            `
            SELECT
                id,
                status,
                tipo_entrega
            FROM pedidos
            WHERE id = $1
            `,
            [pedidoId]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                sucesso: false,
                erro: "Pedido não encontrado."
            });
        }

        const pedido = resultado.rows[0];

        let posicao = null;

        if (pedido.status === "aguardando") {

            const fila = await pool.query(
                `
                SELECT COUNT(*) AS quantidade
                FROM pedidos
                WHERE restaurante_id = (
                    SELECT restaurante_id
                    FROM pedidos
                    WHERE id = $1
                )
                AND status = 'aguardando'
                AND id <= $1
                `,
                [pedidoId]
            );

            posicao = Number(fila.rows[0].quantidade);
        }

        res.json({
            sucesso: true,
            pedido: {
                id: pedido.id,
                status: pedido.status,
                tipo_entrega: pedido.tipo_entrega,
                posicao: posicao
            }
        });

    } catch (erro) {

        console.error(
            "Erro ao consultar status do pedido:",
            erro
        );

        res.status(500).json({
            sucesso: false,
            erro: "Erro ao consultar status do pedido."
        });
    }
});


app.get("/api/pedidos", async (req, res) => {
  try {
    const restauranteId = req.query.restaurante;

    const resultado = await pool.query(
      `
      SELECT
        id,
        restaurante_id,
        itens,
        observacao,
        telefone,
        tipo_entrega,
        endereco,
        forma_pagamento,
        total,
        status,
        criado_em
      FROM pedidos
      WHERE restaurante_id = $1
      ORDER BY criado_em ASC
      `,
      [restauranteId]
    );

    res.json({
      sucesso: true,
      pedidos: resultado.rows
    });

  } catch (erro) {
    console.error("Erro ao buscar pedidos:", erro);

    res.status(500).json({
      sucesso: false,
      erro: "Erro ao buscar pedidos."
    });
  }
});


app.put("/api/pedidos/:id/iniciar-preparo", async (req, res) => {
  try {

    const pedidoId = req.params.id;

    const resultado = await pool.query(
      `
      UPDATE pedidos
      SET status = 'em_preparo'
      WHERE id = $1
        AND status = 'aguardando'
      RETURNING id, status
      `,
      [pedidoId]
    );

    if (resultado.rows.length === 0) {

      return res.status(400).json({
        sucesso: false,
        erro: "Este pedido não está aguardando preparo."
      });

    }

    res.json({
      sucesso: true,
      mensagem: "Preparo iniciado.",
      pedido: resultado.rows[0]
    });

  } catch (erro) {

    console.error(
      "Erro ao iniciar preparo:",
      erro
    );

    res.status(500).json({
      sucesso: false,
      erro: "Erro ao iniciar preparo."
    });
  }
});


app.put("/api/pedidos/:id/marcar-pronto", async (req, res) => {
  try {

    const pedidoId = req.params.id;

    const resultado = await pool.query(
      `
      UPDATE pedidos
      SET status = 'pronto'
      WHERE id = $1
        AND status = 'em_preparo'
      RETURNING id, status
      `,
      [pedidoId]
    );

    if (resultado.rows.length === 0) {

      return res.status(400).json({
        sucesso: false,
        erro: "Este pedido não está em preparo."
      });

    }

    res.json({
      sucesso: true,
      mensagem: "Pedido marcado como pronto.",
      pedido: resultado.rows[0]
    });

  } catch (erro) {

    console.error(
      "Erro ao marcar pedido como pronto:",
      erro
    );

    res.status(500).json({
      sucesso: false,
      erro: "Erro ao marcar pedido como pronto."
    });
  }
});


app.put("/api/pedidos/:id/finalizar", async (req, res) => {
  try {
    const pedidoId = req.params.id;

    const resultado = await pool.query(
      `
      UPDATE pedidos
      SET status = 'finalizado'
      WHERE id = $1
        AND status = 'pronto'
      RETURNING id, status
      `,
      [pedidoId]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        sucesso: false,
        erro: "Pedido não encontrado ou ainda não está pronto."
      });
    }

    res.json({
      sucesso: true,
      mensagem: "Pedido finalizado com sucesso.",
      pedido: resultado.rows[0]
    });

  } catch (erro) {
    console.error("Erro ao finalizar pedido:", erro);

    res.status(500).json({
      sucesso: false,
      erro: "Erro ao finalizar pedido."
    });
  }
});


app.put("/api/pedidos/:id/saiu-entrega", async (req, res) => {
  try {

    const pedidoId = req.params.id;

    const resultado = await pool.query(
      `
      UPDATE pedidos
      SET status = 'saiu_entrega'
      WHERE id = $1
        AND status = 'pronto'
        AND tipo_entrega = 'entrega'
      RETURNING id, status
      `,
      [pedidoId]
    );

    if (resultado.rows.length === 0) {

      return res.status(400).json({
        sucesso: false,
        erro: "Este pedido não está pronto para sair para entrega."
      });

    }

    res.json({
      sucesso: true,
      mensagem: "Pedido saiu para entrega.",
      pedido: resultado.rows[0]
    });

  } catch (erro) {

    console.error(
      "Erro ao marcar pedido como saiu para entrega:",
      erro
    );

    res.status(500).json({
      sucesso: false,
      erro: "Erro ao marcar pedido como saiu para entrega."
    });
  }
});


function montarMensagemPedido(pedido) {

  let mensagem = `🍽️ NOVO PEDIDO #${pedido.id}\n\n`;

  mensagem += `Itens:\n`;

  pedido.itens.forEach(item => {

    let subtotal = 0;
    let detalhes = "";

    if (item.tipo === "porcao") {

      subtotal = Number(item.subtotal);

      detalhes =
        item.gramas === 1000
          ? " - 1 kg"
          : ` - ${item.gramas} g`;

    } else {

      subtotal =
        Number(item.preco) * Number(item.quantidade);

      if (item.tamanho) {
        detalhes = ` - ${item.tamanho}`;
      }
    }

    mensagem +=
      `${item.quantidade}x ${item.nome}${detalhes} - R$ ${subtotal
        .toFixed(2)
        .replace(".", ",")}\n`;
  });

  mensagem +=
    `\n💰 Total: R$ ${Number(pedido.total)
      .toFixed(2)
      .replace(".", ",")}`;

  mensagem +=
    `\n\n📝 Observação: ${
      pedido.observacao || "Nenhuma"
    }`;

  mensagem +=
    `\n\n📱 Telefone: ${pedido.telefone}`;

  mensagem +=
    `\n📦 Recebimento: ${
      pedido.tipo_entrega === "entrega"
        ? "Entrega"
        : "Retirada no local"
    }`;

  if (pedido.tipo_entrega === "entrega") {
    mensagem +=
      `\n📍 Endereço: ${pedido.endereco}`;
  }

  mensagem +=
    `\n💳 Pagamento: ${pedido.forma_pagamento}`;

  return mensagem;
}



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


app.post(
  "/api/upload-produto",
  upload.single("foto"),
  (req, res) => {

    try {

      if (!req.file) {
        return res.status(400).json({
          sucesso: false,
          erro: "Nenhuma foto enviada."
        });
      }

      const fotoUrl =
        `/uploads/produtos/${req.file.filename}`;

      res.json({
        sucesso: true,
        foto_url: fotoUrl
      });

    } catch (erro) {

      console.error("Erro ao enviar foto:", erro);

      res.status(500).json({
        sucesso: false,
        erro: "Erro ao enviar foto."
      });

    }

  }
);


app.post("/api/pratos", async (req, res) => {
  try {

    const {
      restaurante_id,
      nome,
      descricao,
      categoria,
      preco,
      preco_pequena,
      preco_media,
      preco_grande,
      preco_kg,
      foto_url
    } = req.body;

    if (!restaurante_id || !nome || !categoria) {
      return res.status(400).json({
        sucesso: false,
        erro: "Restaurante, nome e categoria são obrigatórios."
      });
    }

    const resultado = await pool.query(
      `
      INSERT INTO pratos (
        restaurante_id,
        nome,
        descricao,
        preco,
        preco_pequena,
        preco_media,
        preco_grande,
        categoria,
        preco_kg,
        foto_url
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
      `,
      [
        restaurante_id,
        nome,
        descricao || null,
        preco || 0,
        preco_pequena || null,
        preco_media || null,
        preco_grande || null,
        categoria,
        preco_kg || null,
        foto_url || null
      ]
    );

    res.status(201).json({
      sucesso: true,
      prato: resultado.rows[0]
    });

  } catch (erro) {

    console.error("Erro ao cadastrar prato:", erro);

    res.status(500).json({
      sucesso: false,
      erro: "Erro ao cadastrar prato."
    });

  }
});


app.put("/api/pratos/:id/disponibilidade", async (req, res) => {
  try {

    const pratoId = req.params.id;
    const { disponivel } = req.body;

    await pool.query(
      `
      UPDATE pratos
      SET disponivel = $1
      WHERE id = $2
      `,
      [disponivel, pratoId]
    );

    res.json({
      sucesso: true,
      mensagem: "Disponibilidade do produto atualizada."
    });

  } catch (erro) {

    console.error(
      "Erro ao atualizar disponibilidade do prato:",
      erro
    );

    res.status(500).json({
      sucesso: false,
      erro: "Erro ao atualizar disponibilidade."
    });

  }
});


app.get("/api/pratos/:id/ingredientes", async (req, res) => {
  try {
    const pratoId = req.params.id;

    const resultado = await pool.query(`
      SELECT id, nome, disponivel
      FROM ingredientes
      WHERE prato_id = $1
      ORDER BY id
    `, [pratoId]);

    res.json({
      sucesso: true,
      ingredientes: resultado.rows
    });

  } catch (erro) {
    console.error("Erro ao consultar ingredientes:", erro);

    res.status(500).json({
      sucesso: false,
      erro: "Erro ao consultar ingredientes"
    });
  }
});



app.put("/api/ingredientes/:id/disponibilidade", async (req, res) => {
  try {
    const ingredienteId = req.params.id;
    const { disponivel } = req.body;

    await pool.query(
      `
      UPDATE ingredientes
      SET disponivel = $1
      WHERE id = $2
      `,
      [disponivel, ingredienteId]
    );

    res.json({
      sucesso: true,
      mensagem: "Disponibilidade do ingrediente atualizada."
    });

  } catch (erro) {
    console.error("Erro ao atualizar ingrediente:", erro);

    res.status(500).json({
      sucesso: false,
      erro: "Erro ao atualizar ingrediente"
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
      SELECT
        id,
        nome,
        descricao,
        preco,
        preco_pequena,
        preco_media,
        preco_grande,
        preco_kg,
        categoria,
        disponivel
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


app.get("/api/painel/produtos", async (req, res) => {
  try {

    const restauranteId = req.query.restaurante;

    const resultado = await pool.query(`
      SELECT
        id,
        restaurante_id,
        nome,
        descricao,
        preco,
        preco_pequena,
        preco_media,
        preco_grande,
        preco_kg,
        categoria,
        foto_url,
        disponivel,
        criado_em
      FROM pratos
      WHERE restaurante_id = $1
      ORDER BY id
    `, [restauranteId]);

    res.json({
      sucesso: true,
      pratos: resultado.rows
    });

  } catch (erro) {

    console.error(
      "Erro ao consultar produtos do painel:",
      erro
    );

    res.status(500).json({
      sucesso: false,
      erro: "Erro ao consultar produtos."
    });

  }
});


app.delete("/api/painel/produtos/:id", async (req, res) => {
  try {

    const produtoId = Number(req.params.id);

    if (!produtoId) {
      return res.status(400).json({
        sucesso: false,
        erro: "ID do produto inválido."
      });
    }

    const resultado = await pool.query(
      `
      DELETE FROM pratos
      WHERE id = $1
      RETURNING id
      `,
      [produtoId]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        sucesso: false,
        erro: "Produto não encontrado."
      });
    }

    res.json({
      sucesso: true,
      mensagem: "Produto excluído com sucesso."
    });

  } catch (erro) {

    console.error(
      "Erro ao excluir produto:",
      erro
    );

    res.status(500).json({
      sucesso: false,
      erro: "Erro ao excluir produto."
    });
  }
});


app.get("/api/pratos/:id", async (req, res) => {
  try {

    const pratoId = req.params.id;

    const resultado = await pool.query(`
      SELECT
        id,
        restaurante_id,
        nome,
        descricao,
        preco,
        preco_pequena,
        preco_media,
        preco_grande,
        preco_kg,
        categoria,
        disponivel
      FROM pratos
      WHERE id = $1
    `, [pratoId]);

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        sucesso: false,
        erro: "Produto não encontrado."
      });
    }

    res.json({
      sucesso: true,
      prato: resultado.rows[0]
    });

  } catch (erro) {

    console.error(
      "Erro ao consultar produto:",
      erro
    );

    res.status(500).json({
      sucesso: false,
      erro: "Erro ao consultar produto."
    });

  }
});


app.put("/api/pratos/:id", async (req, res) => {
  try {

    const pratoId = req.params.id;

    const {
      nome,
      descricao,
      categoria,
      preco,
      preco_pequena,
      preco_media,
      preco_grande,
      preco_kg
    } = req.body;

    if (!nome || !categoria) {
      return res.status(400).json({
        sucesso: false,
        erro: "Nome e categoria são obrigatórios."
      });
    }

    const resultado = await pool.query(`
      UPDATE pratos
      SET
        nome = $1,
        descricao = $2,
        categoria = $3,
        preco = $4,
        preco_pequena = $5,
        preco_media = $6,
        preco_grande = $7,
        preco_kg = $8
      WHERE id = $9
      RETURNING *
    `, [
      nome,
      descricao || null,
      categoria,
      preco || null,
      preco_pequena || null,
      preco_media || null,
      preco_grande || null,
      preco_kg || null,
      pratoId
    ]);

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        sucesso: false,
        erro: "Produto não encontrado."
      });
    }

    res.json({
      sucesso: true,
      mensagem: "Produto atualizado com sucesso.",
      prato: resultado.rows[0]
    });

  } catch (erro) {

    console.error(
      "Erro ao atualizar produto:",
      erro
    );

    res.status(500).json({
      sucesso: false,
      erro: "Erro ao atualizar produto."
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


app.get("/api/avisos", async (req, res) => {
  try {
    const restauranteId = req.query.restaurante;

    const resultado = await pool.query(`
      SELECT id, titulo, mensagem, ativo, data_inicio, data_fim, criado_em
      FROM avisos
      WHERE restaurante_id = $1
        AND ativo = true
        AND (data_inicio IS NULL OR data_inicio <= CURRENT_DATE)
        AND (data_fim IS NULL OR data_fim >= CURRENT_DATE)
      ORDER BY criado_em DESC
    `, [restauranteId]);

    res.json({
      sucesso: true,
      avisos: resultado.rows
    });

  } catch (erro) {
    console.error("Erro ao consultar avisos:", erro);

    res.status(500).json({
      sucesso: false,
      erro: "Erro ao consultar avisos"
    });
  }
});



app.post("/api/avisos", async (req, res) => {
  try {
    const { restaurante_id, titulo, mensagem, data_inicio, data_fim } = req.body;

    const avisoExistente = await pool.query(
      `
      SELECT id
      FROM avisos
      WHERE restaurante_id = $1
        AND titulo = $2
        AND mensagem = $3
        AND ativo = true
      LIMIT 1
      `,
      [restaurante_id, titulo.trim(), mensagem.trim()]
    );

    if (avisoExistente.rows.length > 0) {
      return res.status(409).json({
        sucesso: false,
        erro: "Este aviso já está publicado."
      });
    }

    const resultado = await pool.query(
      `
      INSERT INTO avisos (
      restaurante_id,
      titulo,
      mensagem,
      data_inicio,
      data_fim
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, restaurante_id, titulo, mensagem, ativo, data_inicio, data_fim, criado_em
      `,
      [restaurante_id, titulo, mensagem, data_inicio || null, data_fim || null]
    );

    res.json({
      sucesso: true,
      aviso: resultado.rows[0]
    });

  } catch (erro) {
    console.error("Erro ao cadastrar aviso:", erro);

    res.status(500).json({
      sucesso: false,
      erro: "Erro ao cadastrar aviso"
    });
  }
});


app.put("/api/avisos/:id/ativo", async (req, res) => {
  try {
    const avisoId = req.params.id;
    const { ativo } = req.body;

    const resultado = await pool.query(
      `
      UPDATE avisos
      SET ativo = $1
      WHERE id = $2
      RETURNING id, titulo, mensagem, ativo
      `,
      [ativo, avisoId]
    );

    res.json({
      sucesso: true,
      aviso: resultado.rows[0]
    });

  } catch (erro) {
    console.error("Erro ao atualizar aviso:", erro);

    res.status(500).json({
      sucesso: false,
      erro: "Erro ao atualizar aviso"
    });
  }
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
      🔗 https://deliverywhats.onrender.com/cardapio.html?restaurante=1

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

app.get("/atualizar-tabela-pratos-categoria", async (req, res) => {
  try {
    await pool.query(`
      ALTER TABLE pratos
      ADD COLUMN IF NOT EXISTS categoria VARCHAR(50) DEFAULT 'prato'
    `);

    res.json({
      sucesso: true,
      mensagem: "Categoria adicionada à tabela pratos."
    });

    await pool.query(`
      ALTER TABLE pratos
      ADD COLUMN IF NOT EXISTS foto_url TEXT
    `);

  } catch (erro) {
    console.error("Erro ao adicionar categoria:", erro);

    res.status(500).json({
      sucesso: false,
      erro: "Erro ao adicionar categoria."
    });
  }
});

app.get("/atualizar-tabela-porcoes", async (req, res) => {
  try {
    await pool.query(`
      ALTER TABLE pratos
      ADD COLUMN IF NOT EXISTS preco_kg NUMERIC(10,2)
    `);

    res.json({
      sucesso: true,
      mensagem: "Campo de preço por kg criado."
    });

  } catch (erro) {
    console.error("Erro ao atualizar tabela:", erro);

    res.status(500).json({
      sucesso: false,
      erro: "Erro ao atualizar tabela."
    });
  }
});


app.get("/criar-porcao-teste", async (req, res) => {
  try {
    const resultado = await pool.query(`
      INSERT INTO pratos (
        restaurante_id,
        nome,
        descricao,
        preco,
        preco_kg,
        categoria,
        disponivel
      )
      VALUES (
        1,
        'Carne assada',
        'Carne assada temperada',
        60.00,
        60.00,
        'porcao',
        true
      )
      RETURNING *
    `);

    res.json({
      sucesso: true,
      porcao: resultado.rows[0]
    });

  } catch (erro) {
    console.error("Erro ao criar porção:", erro);

    res.status(500).json({
      sucesso: false,
      erro: "Erro ao criar porção."
    });
  }
});


app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
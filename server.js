const express = require("express");
const app = express();


const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const cookieParser = require("cookie-parser");

app.use(cookieParser());

const pool = require("./config/database");


async function prepararBanco() {

    await pool.query(`
        ALTER TABLE pedidos
        ADD COLUMN IF NOT EXISTS inicio_entrega TIMESTAMP,
        ADD COLUMN IF NOT EXISTS tempo_entrega INTEGER
    `);

    await pool.query(`
        ALTER TABLE pedidos
        ADD COLUMN IF NOT EXISTS taxa_entrega NUMERIC(10,2)
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS estoque_carnes (
            id SERIAL PRIMARY KEY,
            restaurante_id INTEGER NOT NULL REFERENCES restaurantes(id),
            data DATE NOT NULL,
            nome VARCHAR(150) NOT NULL,
            quantidade_inicial INTEGER NOT NULL DEFAULT 0,
            quantidade_disponivel INTEGER NOT NULL DEFAULT 0,
            ativo BOOLEAN DEFAULT TRUE,
            criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (restaurante_id, data, nome)
        )
    `);

        await pool.query(`
        CREATE TABLE IF NOT EXISTS taxas_entrega (
            id SERIAL PRIMARY KEY,
            restaurante_id INTEGER NOT NULL
                REFERENCES restaurantes(id),
            cidade VARCHAR(100) NOT NULL,
            bairro VARCHAR(150) NOT NULL,
            taxa NUMERIC(10,2),
            entrega_disponivel BOOLEAN DEFAULT TRUE,
            criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (restaurante_id, cidade, bairro)
        )
    `);

        await pool.query(`
        INSERT INTO taxas_entrega
            (restaurante_id, cidade, bairro, taxa, entrega_disponivel)
        VALUES

            -- CAMPINA GRANDE DO SUL
            (1, 'Campina Grande do Sul', 'Centro / Sede', 18.00, TRUE),
            (1, 'Campina Grande do Sul', 'Jardim Graciosa', 4.00, TRUE),
            (1, 'Campina Grande do Sul', 'Jardim Paulista', 4.00, TRUE),
            (1, 'Campina Grande do Sul', 'Jardim Araçatuba', 9.00, TRUE),
            (1, 'Campina Grande do Sul', 'Jardim Eugênia Maria', 4.00, TRUE),
            (1, 'Campina Grande do Sul', 'Vila São Cosme', 4.00, TRUE),
            (1, 'Campina Grande do Sul', 'Jardim Santa Rosa', 8.00, TRUE),
            (1, 'Campina Grande do Sul', 'Jardim Florida', 4.00, TRUE),
            (1, 'Campina Grande do Sul', 'Jardim Ceccon', 4.00, TRUE),
            (1, 'Campina Grande do Sul', 'Joana Olímpia', 4.00, TRUE),
            (1, 'Campina Grande do Sul', 'Moradias Timbu', 4.00, TRUE),
            (1, 'Campina Grande do Sul', 'Jardim Nesita', 4.00, TRUE),
            (1, 'Campina Grande do Sul', 'Jardim Ipanema', 5.00, TRUE),
            (1, 'Campina Grande do Sul', 'Vila Santa Fé', 5.00, TRUE),
            (1, 'Campina Grande do Sul', 'Jardim Nossa Senhora das Graças', 4.00, TRUE),
            (1, 'Campina Grande do Sul', 'Jardim João Paulo II', 10.00, TRUE),
            (1, 'Campina Grande do Sul', 'Jardim Daher', 10.00, TRUE),
            (1, 'Campina Grande do Sul', 'Jardim da Campina', 18.00, TRUE),
            (1, 'Campina Grande do Sul', 'Recanto Verde', 9.00, TRUE),
            (1, 'Campina Grande do Sul', 'Área Industrial', 9.00, TRUE),
            (1, 'Campina Grande do Sul', 'Santa Rita de Cássia', 8.00, TRUE),
            (1, 'Campina Grande do Sul', 'Jardim Santa Angelina', 9.00, TRUE),
            (1, 'Campina Grande do Sul', 'Timbu', 4.00, TRUE),
            (1, 'Campina Grande do Sul', 'Timbu Velho', 4.00, TRUE),
            (1, 'Campina Grande do Sul', 'Roseira', NULL, FALSE),
            (1, 'Campina Grande do Sul', 'Bela Vista', NULL, FALSE),
            (1, 'Campina Grande do Sul', 'Paiol de Baixo', NULL, FALSE),
            (1, 'Campina Grande do Sul', 'Jaguatirica', NULL, FALSE),
            (1, 'Campina Grande do Sul', 'Mandassaia', NULL, FALSE),
            (1, 'Campina Grande do Sul', 'Barro Branco', NULL, FALSE),
            (1, 'Campina Grande do Sul', 'Terra Boa', NULL, FALSE),
            (1, 'Campina Grande do Sul', 'Ribeirão Grande', NULL, FALSE),
            (1, 'Campina Grande do Sul', 'Chácaras Olhos D''Água', 12.00, TRUE),
            (1, 'Campina Grande do Sul', 'Campo Fundo', NULL, FALSE),
            (1, 'Campina Grande do Sul', 'Cohab', 8.00, TRUE),

            -- QUATRO BARRAS
            (1, 'Quatro Barras', 'Nossa Senhora das Graças', 6.00, TRUE),
            (1, 'Quatro Barras', 'Jardim Graciosa', 8.00, TRUE),
            (1, 'Quatro Barras', 'Jardim Menino Deus', 5.00, TRUE),
            (1, 'Quatro Barras', 'Jardim Maria Alice Gema', 8.00, TRUE),
            (1, 'Quatro Barras', 'Jardim Patrícia', 8.00, TRUE),
            (1, 'Quatro Barras', 'Jardim Creplive', 8.00, TRUE),
            (1, 'Quatro Barras', 'Lot Bosque Merhy', 8.00, TRUE),
            (1, 'Quatro Barras', 'Centro', 9.00, TRUE),
            (1, 'Quatro Barras', 'Jardim Orestes Thá', 10.00, TRUE),
            (1, 'Quatro Barras', 'Itapira', 12.00, TRUE),
            (1, 'Quatro Barras', 'Granja das Acácias', 12.00, TRUE),

            -- COLOMBO
            (1, 'Colombo', 'Jardim Paraná', 9.00, TRUE),
            (1, 'Colombo', 'Canguiri', 9.00, TRUE),
            (1, 'Colombo', 'Colônia Faria', 9.00, TRUE)

        ON CONFLICT (restaurante_id, cidade, bairro)
        DO UPDATE SET
            taxa = EXCLUDED.taxa,
            entrega_disponivel = EXCLUDED.entrega_disponivel
    `);

    console.log("✅ Estrutura do banco verificada.");
}


const restauranteCoordenadas = {
    latitude: -25.350002702451427,
    longitude: -49.11049111577534
};

const multer = require("multer");

const storage = multer.diskStorage({
  destination: "public/uploads/produtos/",
  filename: (req, file, cb) => {
    const extensao = file.originalname
      .split(".")
      .pop();

    const nomeArquivo =
      Date.now() + "-" +
      Math.round(Math.random() * 1E9) +
      "." +
      extensao;

    cb(null, nomeArquivo);
  }
});

const upload = multer({
  storage: storage
});


app.use(express.static("public"));

app.use(express.json({ limit: "10mb" }));


function autenticarRestaurante(req, res, next) {

    try {

        const token =
            req.cookies?.tokenRestaurante;

        if (!token) {

            return res.status(401).json({
                sucesso: false,
                erro: "Acesso não autorizado."
            });

        }

        const dados =
            jwt.verify(
                token,
                process.env.JWT_SECRET
            );

        if (
            !dados.restauranteId ||
            dados.tipo !== "restaurante"
        ) {

            return res.status(401).json({
                sucesso: false,
                erro: "Token inválido."
            });

        }

        req.restauranteId =
            dados.restauranteId;

        next();

    } catch (erro) {

        console.error(
            "Erro na autenticação do restaurante:",
            erro
        );

        return res.status(401).json({
            sucesso: false,
            erro: "Sessão inválida ou expirada."
        });
    }
}



app.get("/api/restaurantes/:id", async (req, res) => {
  try {
    const restauranteId = req.params.id;

    const resultado = await pool.query(
      "SELECT id, nome, telefone, ativo FROM restaurantes WHERE id = $1",
      [restauranteId]
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


app.get("/api/carnes/:restauranteId", async (req, res) => {
  try {

    const restauranteId = req.params.restauranteId;

    const resultado = await pool.query(
      `
      SELECT
        id,
        nome,
        quantidade_disponivel
      FROM estoque_carnes
      WHERE restaurante_id = $1
      AND ativo = true
      AND quantidade_disponivel > 0
      AND data = CURRENT_DATE
      ORDER BY id
      `,
      [restauranteId]
    );

    res.json({
      sucesso: true,
      carnes: resultado.rows
    });

  } catch (erro) {

    console.error(
      "Erro ao consultar carnes:",
      erro
    );

    res.status(500).json({
      sucesso: false,
      erro: "Erro ao consultar carnes."
    });
  }
});


app.get("/teste-endereco", async (req, res) => {
    try {
        const endereco = req.query.endereco;

        if (!endereco) {
            return res.status(400).json({
                erro: "Informe um endereço."
            });
        }

        const resultado =
            await obterCoordenadas(endereco);

        if (!resultado) {
            return res.status(404).json({
                erro: "Endereço não encontrado."
            });
        }

        const componentes =
            resultado.componentes || [];

        const obterComponente = (tipo) => {
            const componente =
                componentes.find(c =>
                    c.types.includes(tipo)
                );

            return componente
                ? componente.long_name
                : null;
        };

        const cidade =
            obterComponente("locality") ||
            obterComponente("administrative_area_level_2");

        const bairro =
            obterComponente("sublocality") ||
            obterComponente("sublocality_level_1");

        console.log("🏙️ CIDADE:", cidade);
        console.log("📍 BAIRRO:", bairro);

        const taxaResult = await pool.query(
    `
    SELECT taxa, entrega_disponivel
    FROM taxas_entrega
    WHERE restaurante_id = $1
      AND LOWER(TRIM(cidade)) = LOWER(TRIM($2))
      AND LOWER(TRIM(bairro)) = LOWER(TRIM($3))
    LIMIT 1
    `,
    [1, cidade, bairro]
);

const taxaEntrega = taxaResult.rows[0] || null;

console.log("💰 TAXA ENCONTRADA:", taxaEntrega);

        res.json({
            cidade,
            bairro,
            endereco: resultado.enderecoFormatado,
            latitude: resultado.latitude,
            longitude: resultado.longitude,
            taxaEntrega
        });

    } catch (erro) {
        console.error("Erro no teste:", erro);

        res.status(500).json({
            erro: "Erro ao testar endereço."
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

      console.log("ITENS RECEBIDOS NO SERVIDOR:", itens);

      const enderecoCompleto =
          montarEnderecoCompleto(endereco);

          let tempoEstimado = null;
          let taxaEntrega = null;

      console.log(
          "📍 ENDEREÇO DO CLIENTE:",
          enderecoCompleto
      );

      if (enderecoCompleto && tipo_entrega === "entrega") {

      const coordenadasCliente =
          await obterCoordenadas(enderecoCompleto);

      console.log(
          "📍 COORDENADAS DO CLIENTE:",
          coordenadasCliente
      );

      if (coordenadasCliente) {

          const componentes =
              coordenadasCliente.componentes || [];

          const obterComponente = (tipo) => {
              const componente =
                  componentes.find(c =>
                      c.types.includes(tipo)
                  );

              return componente
                  ? componente.long_name
                  : null;
          };

          const cidade =
              obterComponente("locality");

          const bairro =
              obterComponente("sublocality") ||
              obterComponente("sublocality_level_1");

          console.log("🏙️ CIDADE IDENTIFICADA:", cidade);
          console.log("📍 BAIRRO IDENTIFICADO:", bairro);

          const taxaEntregaResult = await pool.query(
              `
              SELECT taxa, entrega_disponivel
              FROM taxas_entrega
              WHERE restaurante_id = $1
                AND LOWER(TRIM(cidade)) = LOWER(TRIM($2))
                AND LOWER(TRIM(bairro)) = LOWER(TRIM($3))
              LIMIT 1
              `,
              [
                  restaurante_id,
                  cidade,
                  bairro
              ]
          );

          taxaEntrega =
              taxaEntregaResult.rows[0] || null;

          console.log(
              "💰 TAXA DE ENTREGA:",
              taxaEntrega
          );

          if (
              tipo_entrega === "entrega" &&
              (!taxaEntrega || !taxaEntrega.entrega_disponivel)
          ) {
              return res.status(400).json({
                  sucesso: false,
                  erro: "Desculpe, não realizamos entregas neste bairro."
              });
          }

          const tempoEntrega =
              await calcularTempoEntrega(
                  coordenadasCliente.latitude,
                  coordenadasCliente.longitude
              );

          console.log(
              "🛵 TEMPO DE ENTREGA:",
              tempoEntrega
          );

      if (tempoEntrega) {
          tempoEstimado =
              Number(tempoEntrega.distanciaKm) <= 1
                  ? 30
                  : 40;
      }

      }

  }

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

      const taxaNumerica =
          tipo_entrega === "entrega"
              ? Number(taxaEntrega.taxa)
              : 0;

      const totalComEntrega =
          Number(total) + taxaNumerica;

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
            status,
            tempo_entrega,
            taxa_entrega
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id, criado_em, status, tempo_entrega, taxa_entrega, total
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
          totalComEntrega,
          "aguardando",
          tempoEstimado,
          tipo_entrega === "entrega"
            ? Number(taxaEntrega.taxa)
            : 0
        ]
      );

      console.log("INICIANDO BAIXA DE ESTOQUE");
      console.log("ITENS PARA BAIXAR:", itens);

          // BAIXAR CARNES DO ESTOQUE

      for (const item of itens) {

        if (
          item.tipo !== "cardapio_dia" ||
          !item.opcaoCarne
        ) {
          continue;
        }

        const quantidadePedido =
          Number(item.quantidade) || 1;
        console.log("ITEM PARA BAIXAR:", item);

        let quantidadeCarne1 = 0;
        let quantidadeCarne2 = 0;

        if (item.opcaoCarne === "2_carne_1") {

          quantidadeCarne1 =
            2 * quantidadePedido;

        }

        if (item.opcaoCarne === "2_carne_2") {

          quantidadeCarne2 =
            2 * quantidadePedido;

        }

        if (item.opcaoCarne === "1_cada") {

          quantidadeCarne1 =
            1 * quantidadePedido;

          quantidadeCarne2 =
            1 * quantidadePedido;
        }

        if (quantidadeCarne1 > 0) {

          console.log(
  "BAIXANDO CARNE 1:",
  item.carne1,
  "quantidade:",
  quantidadeCarne1,
  "restaurante:",
  restaurante_id
);

          const baixaCarne1 = await pool.query(
            `
            UPDATE estoque_carnes
            SET quantidade_disponivel =
                quantidade_disponivel - $1
            WHERE restaurante_id = $2
            AND LOWER(TRIM(nome)) = LOWER(TRIM($3))
            AND data = CURRENT_DATE
            AND quantidade_disponivel >= $1
            `,
            [
              quantidadeCarne1,
              restaurante_id,
              item.carne1
            ]
          );
          console.log(
            "RESULTADO BAIXA CARNE 1:",
            baixaCarne1.rowCount
          );

          const verificarEstoque1 = await pool.query(
            `
            SELECT id, nome, data, quantidade_disponivel
            FROM estoque_carnes
            WHERE restaurante_id = $1
              AND LOWER(TRIM(nome)) = LOWER(TRIM($2))
            `,
            [
              restaurante_id,
              item.carne1
            ]
          );

          console.log(
            "ESTOQUE APÓS BAIXA CARNE 1:",
            verificarEstoque1.rows
          );

        }

        if (quantidadeCarne2 > 0) {

          const baixaCarne2 = await pool.query(
            `
            UPDATE estoque_carnes
            SET quantidade_disponivel =
                quantidade_disponivel - $1
            WHERE restaurante_id = $2
            AND LOWER(TRIM(nome)) = LOWER(TRIM($3))
            AND data = CURRENT_DATE
            AND quantidade_disponivel >= $1
            `,
            [
              quantidadeCarne2,
              restaurante_id,
              item.carne2
            ]
          );
          console.log(
  "RESULTADO BAIXA CARNE 2:",
  baixaCarne2.rowCount
);
        }
      }

      const pedidoMensagem = {
        id: resultado.rows[0].id,
        itens,
        observacao,
        nome,
        telefone,
        tipo_entrega,
        endereco,
        forma_pagamento,
        total,
        taxa_entrega:
          tipo_entrega === "entrega"
              ? Number(taxaEntrega.taxa)
              : 0
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
                restaurante_id,
                status,
                tipo_entrega,
                inicio_preparo,
                inicio_entrega,
                tempo_entrega
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
        let carnesDisponiveis = [];

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
                restaurante_id: pedido.restaurante_id,
                status: pedido.status,
                tipo_entrega: pedido.tipo_entrega,
                inicio_preparo: pedido.inicio_preparo,
                inicio_entrega: pedido.inicio_entrega,
                tempo_entrega: pedido.tempo_entrega,
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


app.get(
    "/api/pedidos",
    autenticarRestaurante,
    async (req, res) => {
  try {
    const restauranteId = req.restauranteId;

    const resultado = await pool.query(
      `
      SELECT
        id,
        restaurante_id,
        itens,
        observacao,
        nome,
        telefone,
        tipo_entrega,
        endereco,
        forma_pagamento,
        total,
        status,
        inicio_preparo,
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



app.get(
  "/api/painel/estoque-carnes",
  autenticarRestaurante,
  async (req, res) => {
    try {

    const resultado = await pool.query(
      `
      SELECT
        e.id,
        e.nome,
        e.quantidade_inicial,
        e.quantidade_disponivel,
        e.ativo
      FROM estoque_carnes e
      INNER JOIN cardapio_semana c
        ON c.restaurante_id = e.restaurante_id
      AND c.dia_semana = EXTRACT(ISODOW FROM CURRENT_DATE)
      AND (
            LOWER(TRIM(e.nome)) = LOWER(TRIM(c.carne_1))
            OR
            LOWER(TRIM(e.nome)) = LOWER(TRIM(c.carne_2))
      )
      WHERE e.restaurante_id = $1
        AND e.data = CURRENT_DATE
      ORDER BY e.id
      `,
      [req.restauranteId]
    );

      res.json({
        sucesso: true,
        carnes: resultado.rows
      });

    } catch (erro) {

      console.error(
        "Erro ao consultar estoque de carnes:",
        erro
      );

      res.status(500).json({
        sucesso: false,
        erro: "Erro ao consultar estoque de carnes."
      });
    }
  }
);


app.post(
  "/api/painel/estoque-carnes",
  autenticarRestaurante,
  async (req, res) => {
    try {

      const { nome, quantidade } = req.body;

      if (!nome || quantidade === undefined) {
        return res.status(400).json({
          sucesso: false,
          erro: "Nome e quantidade são obrigatórios."
        });
      }

      const quantidadeNumero = Number(quantidade);

      if (
        !Number.isInteger(quantidadeNumero) ||
        quantidadeNumero < 0
      ) {
        return res.status(400).json({
          sucesso: false,
          erro: "A quantidade deve ser um número inteiro maior ou igual a zero."
        });
      }

      const resultado = await pool.query(
        `
        INSERT INTO estoque_carnes (
          restaurante_id,
          data,
          nome,
          quantidade_inicial,
          quantidade_disponivel,
          ativo
        )
        VALUES (
          $1,
          CURRENT_DATE,
          $2,
          $3,
          $3,
          true
        )
        RETURNING
          id,
          nome,
          quantidade_inicial,
          quantidade_disponivel,
          ativo
        `,
        [
          req.restauranteId,
          nome.trim(),
          quantidadeNumero
        ]
      );

      res.status(201).json({
        sucesso: true,
        mensagem: "Carne cadastrada com sucesso.",
        carne: resultado.rows[0]
      });

    } catch (erro) {

      console.error(
        "Erro ao cadastrar carne no estoque:",
        erro
      );

      if (erro.code === "23505") {
        return res.status(409).json({
          sucesso: false,
          erro: "Esta carne já está cadastrada para hoje."
        });
      }

      res.status(500).json({
        sucesso: false,
        erro: "Erro ao cadastrar carne."
      });
    }
  }
);


app.put(
  "/api/painel/estoque-carnes/:id",
  autenticarRestaurante,
  async (req, res) => {
    try {

      const carneId = req.params.id;

      const {
        nome,
        quantidade
      } = req.body;

      if (!nome || quantidade === undefined) {

        return res.status(400).json({
          sucesso: false,
          erro: "Nome e quantidade são obrigatórios."
        });

      }

      const quantidadeNumero =
        Number(quantidade);

      if (
        !Number.isInteger(quantidadeNumero) ||
        quantidadeNumero < 0
      ) {

        return res.status(400).json({
          sucesso: false,
          erro: "A quantidade deve ser um número inteiro maior ou igual a zero."
        });

      }

      const resultado =
        await pool.query(
          `
          UPDATE estoque_carnes
          SET
            nome = $1,
            quantidade_disponivel = $2
          WHERE id = $3
            AND restaurante_id = $4
          RETURNING
            id,
            nome,
            quantidade_inicial,
            quantidade_disponivel,
            ativo
          `,
          [
            nome.trim(),
            quantidadeNumero,
            carneId,
            req.restauranteId
          ]
        );

      if (resultado.rows.length === 0) {

        return res.status(404).json({
          sucesso: false,
          erro: "Carne não encontrada para hoje."
        });

      }

      res.json({
        sucesso: true,
        mensagem: "Carne atualizada com sucesso.",
        carne: resultado.rows[0]
      });

    } catch (erro) {

      console.error(
        "Erro ao atualizar carne:",
        erro
      );

      res.status(500).json({
        sucesso: false,
        erro: "Erro ao atualizar carne."
      });

    }
  }
);


app.put(
    "/api/pedidos/:id/iniciar-preparo",
    autenticarRestaurante,
    async (req, res) => {
  try {

    const pedidoId = req.params.id;

    const resultado = await pool.query(
      `
      UPDATE pedidos
      SET status = 'em_preparo',
          inicio_preparo = NOW()
      WHERE id = $1
      AND restaurante_id = $2
      AND status = 'aguardando'
      RETURNING id, status
      `,
      [
          pedidoId,
          req.restauranteId
      ]
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


app.put(
    "/api/pedidos/:id/marcar-pronto",
    autenticarRestaurante,
    async (req, res) => {
  try {

    const pedidoId = req.params.id;

    const resultado = await pool.query(
      `
      UPDATE pedidos
      SET status = 'pronto'
      WHERE id = $1
  AND restaurante_id = $2
  AND status = 'em_preparo'
      RETURNING id, status
      `,
      [
    pedidoId,
    req.restauranteId
]
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


app.put(
    "/api/pedidos/:id/finalizar",
    autenticarRestaurante,
    async (req, res) => {
  try {
    const pedidoId = req.params.id;

    const resultado = await pool.query(
      `
      UPDATE pedidos
      SET status = 'finalizado'
      WHERE id = $1
  AND restaurante_id = $2
  AND status = 'pronto'
      RETURNING id, status
      `,
      [
    pedidoId,
    req.restauranteId
]
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


app.put(
    "/api/pedidos/:id/saiu-entrega",
    autenticarRestaurante,
    async (req, res) => {
  try {

    const pedidoId = req.params.id;

    const pedido = await pool.query(
      `
      SELECT
        id,
        status,
        tipo_entrega,
        endereco
      FROM pedidos
      WHERE id = $1
  AND restaurante_id = $2
      `,
      [
    pedidoId,
    req.restauranteId
]
    );

    if (pedido.rows.length === 0) {

      return res.status(404).json({
        sucesso: false,
        erro: "Pedido não encontrado."
      });

    }

    const dadosPedido = pedido.rows[0];

    if (
      dadosPedido.status !== "pronto" ||
      dadosPedido.tipo_entrega !== "entrega"
    ) {

      return res.status(400).json({
        sucesso: false,
        erro: "Este pedido não está pronto para sair para entrega."
      });

    }

    const enderecoCompleto =
      montarEnderecoCompleto(dadosPedido.endereco);

    const coordenadasCliente =
      await obterCoordenadas(enderecoCompleto);

    if (!coordenadasCliente) {

      return res.status(400).json({
        sucesso: false,
        erro: "Não foi possível localizar o endereço do cliente."
      });

    }

    const tempoEntrega =
      await calcularTempoEntrega(
        coordenadasCliente.latitude,
        coordenadasCliente.longitude
      );

    if (!tempoEntrega) {

      return res.status(400).json({
        sucesso: false,
        erro: "Não foi possível calcular o tempo da entrega."
      });

    }

    console.log(
      "🛵 TEMPO DA ENTREGA:",
      tempoEntrega
    );

    const resultado = await pool.query(
      `
      UPDATE pedidos
      SET
        status = 'saiu_entrega',
        inicio_entrega = NOW(),
        tempo_entrega = $2
      WHERE id = $1
  AND restaurante_id = $3
  AND status = 'pronto'
  AND tipo_entrega = 'entrega'
      RETURNING
        id,
        status,
        inicio_entrega,
        tempo_entrega
      `,
      [
          pedidoId,
          tempoEntrega.minutos,
          req.restauranteId
      ]
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
      pedido: resultado.rows[0],
      tempoEntrega: tempoEntrega
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

      if (item.tipo === "cardapio_dia" && item.nomeCarne) {
        detalhes += ` - 🥩 ${item.nomeCarne}`;
      }
    }

    mensagem +=
      `${item.quantidade}x ${item.nome}${detalhes} - R$ ${subtotal
        .toFixed(2)
        .replace(".", ",")}\n`;
  });

  if (pedido.tipo_entrega === "entrega") {
    mensagem +=
      `\n\n🛵 Taxa de entrega: R$ ${Number(pedido.taxa_entrega)
        .toFixed(2)
        .replace(".", ",")}`;
  }

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


async function obterCoordenadas(endereco) {

    const url =
        "https://maps.googleapis.com/maps/api/geocode/json?" +
        new URLSearchParams({
            address: endereco,
            key: process.env.GOOGLE_MAPS_API_KEY
        });

    const resposta = await fetch(url);

    if (!resposta.ok) {
        throw new Error(
            "Erro ao consultar Google Maps."
        );
    }

    const dados = await resposta.json();

    if (dados.status !== "OK" || !dados.results.length) {

        console.log(
    "❌ ERRO GOOGLE MAPS:",
    dados.status,
    dados.error_message || "Sem detalhes"
);

        return null;
    }

    const localizacao =
        dados.results[0].geometry.location;

    return {
        latitude: localizacao.lat,
        longitude: localizacao.lng,
        enderecoFormatado: dados.results[0].formatted_address,
        componentes: dados.results[0].address_components
    };
}


async function calcularTempoEntrega(latitudeCliente, longitudeCliente) {

    const resposta = await fetch(
        "https://routes.googleapis.com/directions/v2:computeRoutes",
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key":
                    process.env.GOOGLE_MAPS_API_KEY,
                "X-Goog-FieldMask":
                    "routes.duration,routes.distanceMeters"
            },

            body: JSON.stringify({

                origin: {
                    location: {
                        latLng: {
                            latitude:
                                restauranteCoordenadas.latitude,
                            longitude:
                                restauranteCoordenadas.longitude
                        }
                    }
                },

                destination: {
                    location: {
                        latLng: {
                            latitude:
                                latitudeCliente,
                            longitude:
                                longitudeCliente
                        }
                    }
                },

                travelMode: "DRIVE",

                routingPreference:
                    "TRAFFIC_AWARE"

            })
        }
    );

    if (!resposta.ok) {

        const erro =
            await resposta.text();

        console.error(
            "❌ ERRO GOOGLE ROUTES:",
            erro
        );

        return null;
    }

    const dados =
        await resposta.json();

    if (
        !dados.routes ||
        !dados.routes.length
    ) {

        return null;
    }

    const rota =
        dados.routes[0];

    const segundos =
        parseInt(
            rota.duration.replace("s", "")
        );

    const minutos =
        Math.ceil(
            segundos / 60
        );

    return {
        minutos,
        distanciaKm:
            Number(
                rota.distanceMeters / 1000
            ).toFixed(2)
    };
}


function montarEnderecoCompleto(endereco) {

    if (!endereco) {
        return null;
    }

    return [
        endereco.rua,
        endereco.numero,
        endereco.bairro,
        "Campina Grande do Sul",
        "PR",
        "Brasil"
    ]
        .filter(Boolean)
        .join(", ");
}



app.post(
    "/api/cardapio-semana",
    autenticarRestaurante,
    async (req, res) => {
  try {

    const {
      dia_semana,
      titulo,
      descricao,
      preco_pequena,
      preco_media,
      preco_grande,
      foto_base64,
      carne_1,
      carne_2
    } = req.body;

    if (
      !dia_semana ||
      !titulo ||
      !descricao ||
      !preco_pequena ||
      !preco_media ||
      !preco_grande ||
      !carne_1 ||
      !carne_2
    ) {
      return res.status(400).json({
        sucesso: false,
        erro: "Preencha todos os campos do cardápio."
      });
    }

    const resultado = await pool.query(`
      INSERT INTO cardapio_semana (
        restaurante_id,
        dia_semana,
        titulo,
        descricao,
        preco_pequena,
        preco_media,
        preco_grande,
        foto_base64,
        carne_1,
        carne_2
      )
      VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,$9,$10
      )

      ON CONFLICT (restaurante_id, dia_semana)

      DO UPDATE SET
        titulo = EXCLUDED.titulo,
        descricao = EXCLUDED.descricao,
        preco_pequena = EXCLUDED.preco_pequena,
        preco_media = EXCLUDED.preco_media,
        preco_grande = EXCLUDED.preco_grande,
        foto_base64 = EXCLUDED.foto_base64,
        carne_1 = EXCLUDED.carne_1,
        carne_2 = EXCLUDED.carne_2

      RETURNING *
    `, [
      req.restauranteId,
      dia_semana,
      titulo,
      descricao,
      preco_pequena,
      preco_media,
      preco_grande,
      foto_base64 || null,
      carne_1,
      carne_2
    ]);

    res.json({
      sucesso: true,
      cardapio: resultado.rows[0]
    });

  } catch (erro) {

    console.error(
      "Erro ao salvar cardápio da semana:",
      erro
    );

    res.status(500).json({
      sucesso: false,
      erro: "Erro ao salvar cardápio da semana."
    });
  }
});


app.get("/api/cardapio-semana", async (req, res) => {
  try {

    const restauranteId = req.query.restaurante;
    const diaSemana = req.query.dia;

    if (!restauranteId || !diaSemana) {
      return res.status(400).json({
        sucesso: false,
        erro: "Restaurante e dia são obrigatórios."
      });
    }

    const resultado = await pool.query(`
      SELECT
        id,
        restaurante_id,
        dia_semana,
        titulo,
        descricao,
        preco_pequena,
        preco_media,
        preco_grande,
        foto_base64,
        carne_1,
        carne_2
      FROM cardapio_semana
      WHERE restaurante_id = $1
        AND dia_semana = $2
    `, [
      restauranteId,
      diaSemana
    ]);

    res.json({
      sucesso: true,
      cardapio: resultado.rows[0] || null
    });

  } catch (erro) {

    console.error(
      "Erro ao consultar cardápio da semana:",
      erro
    );

    res.status(500).json({
      sucesso: false,
      erro: "Erro ao consultar cardápio da semana."
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


app.post(
    "/api/pratos",
    autenticarRestaurante,
    async (req, res) => {
  try {

    const {
      nome,
      descricao,
      categoria,
      preco,
      preco_pequena,
      preco_media,
      preco_grande,
      preco_kg,
      foto_base64
    } = req.body;

    console.log(
  "SERVIDOR RECEBEU FOTO:",
  foto_base64 ? "SIM" : "NÃO"
);

    if (!nome || !categoria) {
      return res.status(400).json({
        sucesso: false,
        erro: "Nome e categoria são obrigatórios."
      });
    }

    console.log(
  "TAMANHO DA FOTO:",
  foto_base64 ? foto_base64.length : 0
);

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
        foto_base64
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
      `,
      [
        req.restauranteId,
        nome,
        descricao || null,
        preco || 0,
        preco_pequena || null,
        preco_media || null,
        preco_grande || null,
        categoria,
        preco_kg || null,
        foto_base64 || null
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


app.put(
    "/api/pratos/:id/disponibilidade",
    autenticarRestaurante,
    async (req, res) => {
  try {

    const pratoId = req.params.id;
    const { disponivel } = req.body;

    await pool.query(
      `
      UPDATE pratos
      SET disponivel = $1
      WHERE id = $2
  AND restaurante_id = $3
      `,
      [
    disponivel,
    pratoId,
    req.restauranteId
]
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



app.put(
    "/api/ingredientes/:id/disponibilidade",
    autenticarRestaurante,
    async (req, res) => {
  try {
    const ingredienteId = req.params.id;
    const { disponivel } = req.body;

    await pool.query(
      `
      UPDATE ingredientes
      SET disponivel = $1
      WHERE id = $2
        AND prato_id IN (
          SELECT id
          FROM pratos
          WHERE restaurante_id = $3
        )
      `,
      [
        disponivel,
        ingredienteId,
        req.restauranteId
      ]
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

    const hoje = new Date(
      new Date().toLocaleString("en-US", {
        timeZone: "America/Fortaleza"
      })
    );

    const diaSemana = hoje.getDay();

    const diaNaoTrabalhamos =
      diaSemana === 0 || diaSemana === 6;

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
        foto_base64,
        disponivel
      FROM pratos
      WHERE restaurante_id = $1
        AND disponivel = true
      ORDER BY id
    `, [restauranteId]);

    const resultadoCardapio = await pool.query(`
        SELECT
            id,
            dia_semana,
            titulo,
            descricao,
            preco_pequena,
            preco_media,
            preco_grande,
            foto_base64,
            carne_1,
            carne_2
        FROM cardapio_semana
        WHERE restaurante_id = $1
          AND dia_semana = $2
        LIMIT 1
    `, [
        restauranteId,
        diaSemana
    ]);

    res.json({
      sucesso: true,
      pratos: resultado.rows,
      cardapio_dia: resultadoCardapio.rows[0] || null,
      dia_nao_trabalhamos: diaNaoTrabalhamos
    });

  } catch (erro) {
    console.error("Erro ao consultar cardápio:", erro);

    res.status(500).json({
      sucesso: false,
      erro: "Erro ao consultar cardápio"
    });
  }
});


app.get(
  "/api/painel/produtos",
  autenticarRestaurante,
  async (req, res) => {
  try {

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
        foto_base64,
        disponivel,
        criado_em
      FROM pratos
      WHERE restaurante_id = $1
      ORDER BY id
        `, [req.restauranteId]);

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


app.delete("/api/cardapio-semana/:dia", async (req, res) => {

  try {

    const dia = Number(req.params.dia);

    if (!dia || dia < 1 || dia > 5) {

      return res.status(400).json({
        sucesso: false,
        erro: "Dia da semana inválido."
      });

    }

    const resultado = await pool.query(
      `
      DELETE FROM cardapio_semana
      WHERE restaurante_id = $1
        AND dia_semana = $2
      RETURNING id
      `,
      [1, dia]
    );

    if (resultado.rows.length === 0) {

      return res.status(404).json({
        sucesso: false,
        erro: "Cardápio do dia não encontrado."
      });

    }

    res.json({
      sucesso: true,
      mensagem: "Cardápio do dia excluído com sucesso."
    });

  } catch (erro) {

    console.error(
      "Erro ao excluir cardápio:",
      erro
    );

    res.status(500).json({
      sucesso: false,
      erro: "Erro ao excluir cardápio."
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


app.put(
    "/api/pratos/:id",
    autenticarRestaurante,
    async (req, res) => {
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
        AND restaurante_id = $10
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
      pratoId,
      req.restauranteId
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



app.post(
    "/api/avisos",
    autenticarRestaurante,
    async (req, res) => {
  try {
    const { titulo, mensagem, data_inicio, data_fim } = req.body;

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
      [req.restauranteId, titulo.trim(), mensagem.trim()]
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
      [req.restauranteId, titulo, mensagem, data_inicio || null, data_fim || null]
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


app.put(
    "/api/avisos/:id/ativo",
    autenticarRestaurante,
    async (req, res) => {


  try {
    const avisoId = req.params.id;
    const { ativo } = req.body;

    const resultado = await pool.query(
      `
      UPDATE avisos
      SET ativo = $1
      WHERE id = $2 
        AND restaurante_id = $3
      RETURNING id, titulo, mensagem, ativo
      `,
      [ 
        ativo, 
        avisoId, 
        req.restauranteId 

      ]
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



app.post("/api/login-restaurante", async (req, res) => {

    try {

        const { email, senha } = req.body;

        if (!email || !senha) {

            return res.status(400).json({
                sucesso: false,
                erro: "Informe e-mail e senha."
            });

        }

        const resultado = await pool.query(
            "SELECT id, nome, email, senha, ativo FROM restaurantes WHERE email = $1 LIMIT 1",
            [email]
        );

        if (resultado.rows.length === 0) {

            return res.status(401).json({
                sucesso: false,
                erro: "E-mail ou senha inválidos."
            });

        }

        const restaurante = resultado.rows[0];

        if (!restaurante.ativo) {

            return res.status(403).json({
                sucesso: false,
                erro: "Restaurante inativo."
            });

        }

        const senhaValida =
            await bcrypt.compare(
                senha,
                restaurante.senha
            );

        if (!senhaValida) {

            return res.status(401).json({
                sucesso: false,
                erro: "E-mail ou senha inválidos."
            });

        }

        const token = jwt.sign(
            {
                restauranteId: restaurante.id,
                tipo: "restaurante"
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "4h"
            }
        );

        res.cookie(
            "tokenRestaurante",
            token,
            {
                httpOnly: true,
                secure: true,
                sameSite: "lax",
                maxAge: 4 * 60 * 60 * 1000
            }
        );

        res.json({
            sucesso: true,
            restaurante: {
                id: restaurante.id,
                nome: restaurante.nome,
                email: restaurante.email
            }
        });

    } catch (erro) {

        console.error(
            "Erro no login do restaurante:",
            erro
        );

        res.status(500).json({
            sucesso: false,
            erro: "Erro ao realizar login."
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

prepararBanco()
    .then(() => {

        app.listen(PORT, () => {
            console.log(
                `Servidor rodando na porta ${PORT}`
            );
        });

    })
    .catch((erro) => {

        console.error(
            "❌ Erro ao preparar banco:",
            erro
        );

    });
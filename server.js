const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = 3000;

// Configuração do pool de conexões com o PostgreSQL
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'Livrariadb',
  password: '@Matheus10',
  port: 5433,
});

// Middleware para parsear o corpo das requisições
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware para servir arquivos estáticos (HTML, CSS, JS, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// Rota para servir a página de escolha de voto
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname,'index.html'));
});

// Rota para buscar os candidatos
app.get('/candidatos', async (req, res) => {
  try {
    const queryCandidatos = `
      SELECT c.candidato_id, c.nome, ca.nome AS cargo_nome, p.sigla AS partido_sigla
      FROM candidato c
      INNER JOIN cargo ca ON c.cargo_id = ca.cargo_id
      INNER JOIN partido p ON c.partido_id = p.partido_id
    `;
    const { rows: candidatos } = await pool.query(queryCandidatos);
    res.json(candidatos);
  } catch (err) {
    console.error('Erro ao buscar candidatos:', err);
    res.status(500).json({ message: 'Erro ao carregar candidatos. Por favor, tente novamente mais tarde.' });
  }
});

// Rota para registrar um novo eleitor e seu voto
app.post('/registrar-eleitor-voto', async (req, res) => {
  const { cpf, tituloEleitor, nome, sexo, dataNascimento, candidato_id } = req.body;
  let client; // Declare a variável client fora do bloco try-catch

  try {
    // Inicia uma transação
    client = await pool.connect();
    await client.query('BEGIN');

    // Insere os dados do eleitor na tabela 'eleitor'
    const queryEleitor = `
      INSERT INTO eleitor (cpf, titulo_eleitor, nome, sexo, data_nascimento)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING eleitor_id
    `;
    const valuesEleitor = [cpf, tituloEleitor, nome, sexo, dataNascimento];
    const resultEleitor = await client.query(queryEleitor, valuesEleitor);

    const idEleitor = resultEleitor.rows[0].eleitor_id;

    // Insere o voto na tabela 'voto'
    const queryVoto = `
      INSERT INTO voto (eleitor_id, candidato_id, data_hora_voto)
      VALUES ($1, $2, NOW())
    `;
    const valuesVoto = [idEleitor, candidato_id];
    await client.query(queryVoto, valuesVoto);

    // Finaliza a transação
    await client.query('COMMIT');
    client.release();

    res.status(200).json({ message: 'Eleitor e voto registrados com sucesso!' });
  } catch (err) {
    // Se houver erro, faz rollback da transação se o cliente estiver definido
    if (client) {
      await client.query('ROLLBACK');
      client.release();
    }

    console.error('Erro ao registrar eleitor e voto:', err);
    res.status(500).json({ message: 'Erro ao registrar eleitor e voto. Por favor, tente novamente mais tarde.' });
  }
});

// Inicia o servidor
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});

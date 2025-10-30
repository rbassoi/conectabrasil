const { google } = require('googleapis');

// --- CONFIGURAÇÕES ---
// Agora temos um objeto para guardar as informações de cada planilha
const planilhasConfig = {
  // 'default' será usado se nenhum parâmetro for passado na URL
  'default': {
    id: '1qbOpWkbaPRPW9rHuNIARPYFPoOUOdNBAxH3xw__n5Ao', // ID da sua primeira planilha
    range: 'Backhal!A:F' // O range da sua primeira planilha
  },
  'vendedores': {
    id: '1yFBZzAIehaza353em8rXcENJxvK-7tKLE8tD4vhCaj4', // <-- COLOQUE O ID DA NOVA PLANILHA AQUI
    range: 'datacenter!A:D' // <-- COLOQUE O RANGE DA NOVA PLANILHA AQUI
  },
  // Você pode adicionar quantas outras planilhas quiser aqui
  // 'clientes': {
  //   id: 'ID_DA_PLANILHA_DE_CLIENTES',
  //   range: 'Clientes!A:E'
  // }
};

const CACHE_DURATION_IN_SECONDS = 300; // 5 minutos

// O cache agora será um objeto para guardar dados de múltiplas fontes
const cache = {};

module.exports = async (req, res) => {
  try {
    // NOVO: Lê o parâmetro 'origem' da URL. Se não existir, usa 'default'.
    const origem = req.query.origem || 'default';

    // NOVO: Seleciona a configuração correta com base no parâmetro 'origem'
    const config = planilhasConfig[origem];

    // NOVO: Se a origem pedida não existir na nossa configuração, retorna um erro.
    if (!config) {
      return res.status(400).json({ error: 'Origem de dados inválida.' });
    }

    const now = Date.now();
    
    // NOVO: Verifica o cache para a origem específica
    if (cache[origem] && (now - cache[origem].lastFetch < CACHE_DURATION_IN_SECONDS * 1000)) {
      console.log(`Servindo dados do cache para a origem: ${origem}`);
      res.setHeader('X-Cache-Hit', 'true');
      return res.status(200).json(cache[origem].data);
    }

    console.log(`Cache expirado. Buscando dados do Google Sheets para a origem: ${origem}`);

    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.id, // USA O ID DINÂMICO
      range: config.range,     // USA O RANGE DINÂMICO
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Nenhum dado encontrado.' });
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);
    const formattedData = dataRows.map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || null;
      });
      return obj;
    });
    
    // NOVO: Atualiza o cache para a origem específica
    cache[origem] = {
      data: formattedData,
      lastFetch: now,
    };
    
    console.log(`Dados buscados e cache atualizado para a origem: ${origem}`);
    res.setHeader('X-Cache-Hit', 'false');
    return res.status(200).json(formattedData);

  } catch (error) {
    console.error('Erro ao buscar dados do Google Sheets:', error);
    return res.status(500).json({ error: 'Falha ao buscar dados da planilha.', details: error.message });
  }
};
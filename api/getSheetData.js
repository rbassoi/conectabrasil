// Importa a biblioteca do Google APIs
const { google } = require('googleapis');

// --- CONFIGURAÇÕES - Altere aqui! ---
// ID da sua planilha (pode ser encontrado na URL)
const SPREADSHEET_ID = '1qbOpWkbaPRPW9rHuNIARPYFPoOUOdNBAxH3xw__n5Ao'; 
// Intervalo de dados que você quer buscar (ex: 'Página1!A:C' para as colunas A, B e C)
const RANGE = 'Backhal!A:D';
// Duração do cache em segundos (300s = 5 minutos)
const CACHE_DURATION_IN_SECONDS = 300; 
// ------------------------------------

// Objeto de cache em memória para armazenar os dados e o tempo da última busca
const cache = {
  lastFetch: 0,
  data: null,
};

/**
 * Função principal que será executada pela Vercel
 * req: Objeto da requisição (request)
 * res: Objeto da resposta (response)
 */
module.exports = async (req, res) => {
  const now = Date.now();
  
  // 1. VERIFICA O CACHE
  // Se o cache existir e ainda for válido, retorna os dados cacheados imediatamente
  if (cache.data && (now - cache.lastFetch < CACHE_DURATION_IN_SECONDS * 1000)) {
    console.log('Servindo dados do cache.');
    // Define um header para indicar que a resposta veio do cache
    res.setHeader('X-Cache-Hit', 'true');
    return res.status(200).json(cache.data);
  }

  console.log('Cache expirado. Buscando dados do Google Sheets.');

  try {
    // 2. AUTENTICAÇÃO
    // Lê as credenciais da variável de ambiente (mais seguro!)
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // 3. BUSCA OS DADOS DA PLANILHA
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGE,
    });

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Nenhum dado encontrado.' });
    }

    // 4. TRANSFORMA OS DADOS EM UM JSON AMIGÁVEL
    // Pega a primeira linha como cabeçalho (chaves do JSON)
    const headers = rows[0];
    // Pega o restante das linhas como os dados
    const dataRows = rows.slice(1);

    const formattedData = dataRows.map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || null; // Garante que a chave exista mesmo se a célula for vazia
      });
      return obj;
    });
    
    // 5. ATUALIZA O CACHE
    cache.data = formattedData;
    cache.lastFetch = now;
    
    console.log('Dados buscados e cache atualizado.');
    res.setHeader('X-Cache-Hit', 'false');

    // 6. RETORNA A RESPOSTA
    return res.status(200).json(formattedData);

  } catch (error) {
    console.error('Erro ao buscar dados do Google Sheets:', error);
    return res.status(500).json({ error: 'Falha ao buscar dados da planilha.', details: error.message });
  }
};


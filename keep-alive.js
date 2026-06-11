const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Status</title>
      <style>
        body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f0f0f0; }
        .card { background: white; border-radius: 12px; padding: 40px; text-align: center; box-shadow: 0 2px 12px rgba(0,0,0,.1); }
        h1 { color: #5865F2; }
        p { color: #666; margin-top: 8px; }
        .dot { width: 12px; height: 12px; background: #43b581; border-radius: 50%; display: inline-block; margin-right: 6px; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>🎫 Ticket Bot</h1>
        <p><span class="dot"></span>Online e funcionando</p>
        <p style="margin-top:16px;font-size:13px;color:#999;">Uptime: ${process.uptime().toFixed(0)}s</p>
      </div>
    </body>
    </html>
  `);
});

app.get('/ping', (req, res) => res.send('pong'));

function keepAlive() {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`[Keep-Alive] Servidor rodando na porta ${port}`);
  });
}

module.exports = keepAlive;

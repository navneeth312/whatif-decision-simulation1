import { createServer as createHttpServer } from 'node:http';
import path from 'node:path';
import express, { NextFunction, Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import app from './src/server/agentApp';

async function start() {
  const isProduction = process.argv.includes('--production') || process.env.NODE_ENV === 'production';
  const port = Number(process.env.PORT || 3000);
  if (isProduction) {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath, { index: false, maxAge: '1h' }));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
    app.listen(port, '0.0.0.0', () => process.stdout.write(`WhatIf server listening on ${port}\n`));
    return;
  }

  const httpServer = createHttpServer(app);
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: { server: httpServer } },
    appType: 'spa'
  });
  app.use(vite.middlewares);
  app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (req.path.startsWith('/api/')) {
      res.status(400).json({ error: 'Invalid API request.' });
      return;
    }
    res.status(500).send('The WhatIf development server encountered an error.');
    void error;
  });
  httpServer.listen(port, '0.0.0.0', () => process.stdout.write(`WhatIf server listening on ${port}\n`));
}

void start();

import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import axios from 'axios';
import FormData from 'form-data';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Configure Multer for memory storage
  const upload = multer({ storage: multer.memoryStorage() });

  app.use(express.json({ limit: '10mb' }));
  
  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // API Proxy Route for File Upload
  app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const apiKey = process.env.FILE_STORAGE_API_KEY || 'eSxsmn7HXrAfvuL66V42PNPQrBzovp74';
      const baseUrl = process.env.FILE_STORAGE_BASE_URL || 'https://test-wp.param.club';

      const formData = new FormData();
      formData.append('file', req.file.buffer, {
        filename: req.file.originalname,
        contentType: req.file.mimetype,
      });

      console.log(`Forwarding upload to: ${baseUrl}/wp-json/file-api/v1/upload`);

      const response = await axios.post(`${baseUrl}/wp-json/file-api/v1/upload`, formData, {
        headers: {
          ...formData.getHeaders(),
          'X-CEV-API-Key': apiKey,
        },
      });

      res.json(response.data);
    } catch (error: any) {
      const errorData = error.response?.data;
      const errorMessage = typeof errorData === 'string' && errorData.startsWith('<html>') 
        ? 'Upstream server returned an HTML error page' 
        : (errorData || error.message);

      console.error('Proxy Upload Error:', errorMessage);
      
      res.status(error.response?.status || 500).json({
        error: 'Failed to upload via proxy',
        details: errorMessage,
      });
    }
  });

  // Calendly API Proxy
  app.get('/api/calendly/bookings', async (req, res) => {
    try {
      const token = req.headers.authorization;
      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }

      // 1. Get User URI
      const userResponse = await axios.get('https://api.calendly.com/users/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const userUri = userResponse.data.resource.uri;

      // 2. Get Scheduled Events
      const eventsResponse = await axios.get('https://api.calendly.com/scheduled_events', {
        headers: { 'Authorization': `Bearer ${token}` },
        params: { 
          user: userUri, 
          status: 'active', 
          count: 50,
          sort: 'start_time:desc'
        }
      });

      const events = eventsResponse.data.collection;
      console.log(`Found ${events.length} Calendly events for user ${userUri}`);
      const bookings = [];

      // 3. Get Invitees for each event
      for (const event of events) {
        const inviteesResponse = await axios.get(`${event.uri}/invitees`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        console.log(`Event ${event.uri} has ${inviteesResponse.data.collection.length} invitees`);
        for (const invitee of inviteesResponse.data.collection) {
          bookings.push({
            id: invitee.uri.split('/').pop(),
            invitee_name: invitee.name,
            invitee_email: invitee.email,
            start_time: event.start_time,
            event_uri: event.uri,
            status: invitee.status
          });
        }
      }

      res.json({ collection: bookings });
    } catch (error: any) {
      console.error('Calendly Proxy Error:', error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
    }
  });

  // JPC API Proxy
  app.all('/api/jpc/(.*)', async (req, res) => {
    try {
      const targetPath = req.params[0] || '';
      const baseUrl = process.env.API_BASE_URL || 'https://test-wp.param.club/wp-json/jpc/v1';
      const queryString = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
      const url = `${baseUrl}/${targetPath}${queryString}`;

      console.log(`Proxying ${req.method} request to: ${url}`);

      const headers = { ...req.headers } as any;
      delete headers.host;
      delete headers.origin;
      delete headers.referer;
      delete headers.connection;
      delete headers['content-length'];

      const response = await axios({
        method: req.method as any,
        url: url,
        data: req.body,
        headers: headers,
        validateStatus: () => true,
      });

      res.status(response.status).json(response.data);
    } catch (error: any) {
      console.error('JPC Proxy Error:', error.message);
      res.status(500).json({ 
        error: 'Proxy failed', 
        message: error.message,
        details: error.response?.data
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production, we might be running from the root or from within dist
    const possibleDistPath = path.join(process.cwd(), 'dist');
    const distPath = fs.existsSync(path.join(possibleDistPath, 'index.html')) 
      ? possibleDistPath 
      : process.cwd();
    
    console.log(`Production mode: serving static files from ${distPath}`);
    
    app.use(express.static(distPath));
    app.get('(.*)', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('index.html not found');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

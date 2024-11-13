import express from 'express';
import bodyParser from 'body-parser';
import { Actor } from './models/actor.js';
import { ActivityPubRouter } from './routes/activitypub.js';
import { UIRouter } from './routes/ui.js';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "https:", "data:"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'", "https:", "data:"],
    },
  },
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use(limiter);
app.use(cors());

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Body parsers
app.use(bodyParser.json({ 
  type: ['application/activity+json', 'application/json'],
  limit: '1mb'
}));
app.use(bodyParser.urlencoded({ extended: true }));

// Error handler middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Initialize routes
app.use('/', ActivityPubRouter);
app.use('/', UIRouter);

// WebFinger endpoint for actor discovery
app.get('/.well-known/webfinger', (req, res) => {
  const resource = req.query.resource;
  if (!resource || !resource.startsWith('acct:')) {
    return res.status(400).json({ error: 'Invalid resource query' });
  }

  const [username, host] = resource.substring(5).split('@');
  
  // Verify the host matches our server
  if (host && host !== req.hostname) {
    return res.status(404).json({ error: 'User not found' });
  }

  const actor = Actor.findByUsername(username);
  if (!actor) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({
    subject: resource,
    links: [{
      rel: 'self',
      type: 'application/activity+json',
      href: `https://${req.hostname}/users/${username}`
    }]
  });
});

// Handle 404
app.use((req, res) => {
  res.status(404).render('404', { error: 'Page not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 ActivityPub server running on port ${PORT}`);
});
require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const { sequelize } = require('./models');
const apiRoutes = require('./routes/api.routes');
const errorMiddleware = require('./middleware/error.middleware');
const socketService = require('./services/socket.service');
const { initCallBilling } = require('./cron/callBilling.cron');
const { verifySMTPConnection } = require('./services/email.service');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

socketService.init(io);

// ===============================
// Express CORS
// ===============================
app.use(cors({
  origin: '*'
}));

// ===============================
// Stripe webhook
// IMPORTANT: Must come before express.json()
// ===============================
const webhookHandler =
  require('./controller/wallet.controller').handleStripeWebhook;

app.post(
  '/api/v1/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  webhookHandler
);

app.post(
  '/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  webhookHandler
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/v1', apiRoutes);

app.use(errorMiddleware);


const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await sequelize.authenticate();

    console.log(
      'PostgreSQL Database connected successfully via Sequelize.'
    );

    try {
      await verifySMTPConnection();
    } catch (error) {
      console.warn(
        'SMTP verification failed, but server will continue:',
        error.message
      );
    }

    initCallBilling();

    server.listen(PORT, () => {
      console.log(
        `Server running in ${
          process.env.NODE_ENV || 'development'
        } mode on port ${PORT}`
      );

      console.log('CORS enabled for all origins: *');
    });
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
};
startServer();
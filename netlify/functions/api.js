const serverless = require('serverless-http');
const { app, ensureSchema } = require('../../backend-app');

const handler = serverless(app);

exports.handler = async (event, context) => {
  await ensureSchema();
  return handler(event, context);
};

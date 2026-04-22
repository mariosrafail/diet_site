const serverless = require('serverless-http');
const { app, ensureSchema } = require('../../backend-app');

const handler = serverless(app, {
  binary: ['image/*', 'application/octet-stream']
});

exports.handler = async (event, context) => {
  await ensureSchema();
  return handler(event, context);
};

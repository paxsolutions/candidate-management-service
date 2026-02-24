// Lambda handler for ALB integration
// Wraps the Express app using serverless-express

const serverlessExpress = require('@vendia/serverless-express');
const app = require('./server-export');

// Create the serverless Express handler
let serverlessExpressInstance;

async function setup(event, context) {
  serverlessExpressInstance = serverlessExpress({ app });
  return serverlessExpressInstance(event, context);
}

function handler(event, context) {
  if (serverlessExpressInstance) {
    return serverlessExpressInstance(event, context);
  }
  return setup(event, context);
}

exports.handler = handler;

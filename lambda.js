const serverless = require("@codegenie/serverless-express");
const  app  = require("./index");

exports.handler = serverless({ app });

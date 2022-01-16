"use strict";
const crypto = require('crypto');
const tls = require("tls");
const fs = require("fs");
const serverPort = 3000;

let DB_USERS = JSON.parse(fs.readFileSync('server/db.json'));

const options = {
  passphrase: "1234",
  key: fs.readFileSync("server/ssl/private_server_key.pem"),
  cert: fs.readFileSync("server/ssl/cert_signed_server.pem"),
  ca: fs.readFileSync("certificat/autorite.pem"),
  requestCert: true, // ask for a client cert
  ciphers:
    "TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384",
};

const activeSessions = {};

const serverSocket = tls.createServer(options, (clientSocket) => {
  if(!clientSocket.authorized){
    // End the communication instantly
    clientSocket.end();
    return;
  }
  console.log(`Authorized client connected`);
  clientSocket.setEncoding("utf8");
  clientSocket.on("data", (data) => {
    handleMessage(data,clientSocket);
  });

  clientSocket.on("error", (err) => {
    console.error("Client abruptly ended the connection");
  })
});

serverSocket.listen(serverPort, () => {
  console.log(`server listening on port ${serverPort}`);
});

const handleMessage = (message,clientSocket) => {
  const OPERATION = message.split(":")[0];
  switch(OPERATION){
    case "SIGNUP":
      handleSignup(message.split(":")[1],message.split(":")[2],clientSocket);
      break;
    case "LOGIN":
      handleLogin(message.split(":")[1],message.split(":")[2],clientSocket);
      break;
    case "LOGOUT":
      handleLogout(message.split(":")[1],message.split(":")[2],clientSocket);
      break;
    case "SECRET":
      handleSecretMessage(message,clientSocket);
      break;
  }
}

const handleSignup = (username,password,clientSocket) => {
  if(username in DB_USERS){
    clientSocket.write("SIGNUP_BAD");
  } else {
    const salt = crypto.randomBytes(15).toString('hex');
    const hashFunction = crypto.createHmac("sha512",salt);
    hashFunction.update(password);
    const digest = hashFunction.digest("hex");
    // Store the password in the database
    DB_USERS[username] = { digest, salt };
    fs.writeFileSync('server/db.json',JSON.stringify(DB_USERS));
    clientSocket.write("SIGNUP_OK");
    console.log(`Authorized user ${username} signed up`);
  }
}

const handleLogin = (username,password,clientSocket) => {
  if(username in DB_USERS){
    const { salt, digest : storedDigest } = DB_USERS[username];
    const hashFunction = crypto.createHmac("sha512",salt);
    hashFunction.update(password);
    const digest = hashFunction.digest("hex");
    if(storedDigest === digest){
      // We use the salt as the sessionId
      const sessionId = crypto.randomBytes(15).toString('hex');
      activeSessions[username] = sessionId;
      clientSocket.write(`LOGIN_OK:${username}:${sessionId}`);
      console.log(`Authenticated user ${username} logged in`);
    } else {
      clientSocket.write("LOGIN_BAD");
    }
  } else {
    clientSocket.write("LOGIN_BAD");
  }
}

const handleLogout = (username,sessionToken,clientSocket) => {
  if(activeSessions[username] === sessionToken){
    clientSocket.write("LOGOUT_OK");
    console.log(`Authenticated and authorized user ${username} logged out`);
  }
}

const handleSecretMessage = (message,clientSocket) => {
  const [,username,sessionToken,msg] = message.split(":");
  if(username in activeSessions){
    if(activeSessions[username] === sessionToken){
      console.log(`Authorized and authenticated user ${username} sent : ${msg}`);
      clientSocket.write("SECRET_OK");
      return;
    }
  }
  clientSocket.write("SECRET_BAD");
}

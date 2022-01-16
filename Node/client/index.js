"use strict";
const tls = require("tls");
const fs = require("fs");
const prompt = require("prompt-sync")({ sigint: true });

const { Resolver } = require('dns').promises;
const resolver = new Resolver();
resolver.setServers(['127.0.0.1:9000']); // Using our bind9 server as a DNS server
const zoneName = "gei761.cool.";

(async function() {
  const hostnames = await resolver.resolve4(zoneName);
  const hostname = hostnames[0];
  console.log(`Resolved A record value (Ipv4) "${hostname}" from zone "${zoneName}"`);
  console.log(`Connecting to ${hostname}`);
  const serverPort = 3000;
  const options = {
    passphrase: "1234",
    host: hostname === "127.0.0.1" ? 'localhost' : hostname,
    port: serverPort,
    key: fs.readFileSync("client/ssl/private_client_key.pem"),
    cert: fs.readFileSync("client/ssl/cert_signed_client.pem"),
    ca: fs.readFileSync("certificat/autorite.pem"),
    ciphers: "HIGH",
  };
  
  const SESSION = {loggedIn : false, username : "", sessionToken : ""};
  
  const clientSocket = tls.connect(options, () => {
    if(!clientSocket.authorized){
      clientSocket.end();
      return;
    }
    console.log(`You authorized and connected to the server`);
    ShowMainMenu();
  }).setEncoding("utf8");
  
  clientSocket.on("data", (data) => {
    handleServerMessage(data);
  });
  
  clientSocket.on("close", () => {
    console.log("Client connection closed");
  });
  
  clientSocket.on("error", (err) => {
    console.error(err);
    socket.destroy();
  });
  
  const ShowMainMenu = () => {
    let choice = "-1";
    while(choice !== "1" && choice !== "2" && choice !== "3"){
      if(SESSION.loggedIn){
        console.log("\nPick a choice \n 1 : Signup to the server \n 2 : Logout to the server \n 3 : Send a secret message to the server \n")
      } else {
        console.log("\nPick a choice \n 1 : Signup to the server \n 2 : Login from the server \n")
      }
      choice = prompt("Your choice : ");
    }
    if(choice === "1"){
      const username = prompt(`Enter a username : `);
      const password = prompt.hide(`Enter a password (Chars are invisible) : `);
      clientSocket.write(`SIGNUP:${username}:${password}`);
      console.log("Sent your signup information to the server, waiting for reply")
    } 
    if(choice === "2"){
      if(SESSION.loggedIn){
        clientSocket.write(`LOGOUT:${SESSION.username}:${SESSION.sessionToken}`);
        console.log("Sending logout request ");
      } else {
        const username = prompt(`Enter a username : `);
        const password = prompt.hide(`Enter a password (Chars are invisible) : `);
        clientSocket.write(`LOGIN:${username}:${password}`);
        console.log("Sent your login information to the server, waiting for reply");
      }
    }
    if(choice === "3"){
      const message = prompt(`Enter a secret message : `);
      clientSocket.write(`SECRET:${SESSION.username}:${SESSION.sessionToken}:${message}`);
      console.log("Sent your secret information to the server");
    }
  }
  
  const handleServerMessage = (message) => {
    const OPERATION = message.split(":")[0];
    switch(OPERATION){
      case "SIGNUP_OK" : 
        console.log("SERVER : You have succesfully been signed up to the site");
        break;
      case "SIGNUP_BAD" :
        console.log("SERVER : Username already exists");
        break;
      case "LOGIN_OK" : 
        console.log("SERVER : Succesfully logged in");
        SESSION.username = message.split(":")[1];
        SESSION.sessionToken = message.split(":")[2];
        SESSION.loggedIn = true;
        break;
      case "LOGIN_BAD" :
        console.log("SERVER : Username or password is invalid");
        break;
      case "LOGOUT_OK" :
        console.log("SERVER : Succesfully logged out");
        SESSION.loggedIn = false;
        SESSION.sessionToken = "";
        SESSION.username = "";
        break;
      case "SECRET_OK" : 
        console.log("SERVER : Received your secret message");
        break;
      case "SECRET_BAD" : 
        console.log("SERVER : Unauthenticated secret message rejected");
        break;
    }
    ShowMainMenu();
  }
})();
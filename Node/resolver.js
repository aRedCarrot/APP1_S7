const { Resolver } = require('dns').promises;
const resolver = new Resolver();
resolver.setServers(['127.0.0.1:9000']);

// Alternatively, the same code can be written using async-await style.
(async function() {
  const addresses = await resolver.resolve4('gei761.cool.');
  console.log("Found these addresses :" , addresses[0]);
})();
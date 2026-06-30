const keys = require("./keys");
const redis = require("redis");

const redisClient = redis.createClient({
  socket: {
    host: keys.redisHost,
    port: keys.redisPort,
    reconnectStrategy: () => 1000,
  },
});
redisClient.on("error", (err) => console.error("Redis Client Error", err));

const sub = redisClient.duplicate();
sub.on("error", (err) => console.error("Redis Sub Error", err));

function fib(index) {
  if (index < 2) return 1;
  return fib(index - 1) + fib(index - 2);
}

async function connectRedis() {
  await redisClient.connect();
  await sub.connect();

  await sub.subscribe("insert", async (message) => {
    try {
      await redisClient.hSet("values", message, fib(parseInt(message)));
    } catch (err) {
      console.error("Error setting value in Redis:", err);
    }
  });
}

connectRedis().catch(console.error);

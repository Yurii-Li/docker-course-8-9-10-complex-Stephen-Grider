const keys = require("./keys");
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const redis = require("redis");

// Express app setup
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// PG Client setup
const pgClient = new Pool({
  user: keys.pgUser,
  host: keys.pgHost,
  database: keys.pgDatabase,
  password: keys.pgPassword,
  port: keys.pgPort,
  ssl:
    process.env.NODE_ENV !== "production"
      ? false
      : { rejectUnauthorized: false },
});

pgClient.on("connect", (client) => {
  client
    .query("CREATE TABLE IF NOT EXISTS values (number INT)")
    .then(() => console.log("Connected to PostgreSQL"))
    .catch((err) => console.error(err));
});

// Redis setup
const redisClient = redis.createClient({
  socket: {
    host: keys.redisHost,
    port: keys.redisPort,
    reconnectStrategy: () => 1000,
  },
});
redisClient.on("error", (err) => console.error("Redis Client Error", err));

const redisPublisher = redisClient.duplicate();
redisPublisher.on("error", (err) => console.error("Redis Publisher Error", err));

async function connectRedis() {
  await redisClient.connect();
  await redisPublisher.connect();
}

connectRedis().catch(console.error);

// Express routes
app.get("/", (req, res) => {
  res.send("Hi");
});

app.get("/values/all", async (req, res) => {
  const values = await pgClient.query("SELECT * from values");
  res.send(values.rows);
});

app.get("/values/current", async (req, res) => {
  try {
    const values = await redisClient.hGetAll("values");
    res.send(values);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post("/values", async (req, res) => {
  const index = req.body.index;

  if (parseInt(index) > 40) {
    return res.status(422).send("Index too high");
  }

  try {
    await redisClient.hSet("values", index, "Nothing yet");
    await redisPublisher.publish("insert", index);

    await pgClient.query("INSERT INTO values(number) VALUES($1)", [index]);

    res.send({ working: true });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.listen(5000, (err) => {
  if (err) console.log(err);
  console.log("Server running on port 5000");
});

const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  // bearer token
  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_ID}:${process.env.DB_PASS}@cluster0.9vgoxb6.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const usersCollection = client.db("e-bazar-db").collection("users");
    const productsCollection = client.db("e-bazar-db").collection("products");
    const cartCollection = client.db("e-bazar-db").collection("cart");
    const ordersCollection = client.db("e-bazar-db").collection("orders");

    //   JWT Post
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });

      res.send({ token });
    });

    //   Add User to database
    app.post("/adduser", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: "user already exists" });
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    //   Get products from database
    app.get("/products", async (req, res) => {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      const cursor = productsCollection.find({}).skip(skip).limit(limit);
      const result = await cursor.toArray();
      res.send(result);
    });

    //   Get Total Products
    app.get("/totalProducts", async (req, res) => {
      const totalProducts = await productsCollection.countDocuments({});
      res.send({ totalProducts });
    });

    //   Get Single Product by Id
    app.get("/product/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productsCollection.findOne(query);
      res.send(result);
    });

    //   Add to cart
    app.post("/addtocart", async (req, res) => {
      const cart = req.body;
      const result = await cartCollection.insertOne(cart);
      res.send(result);
    });

    //   Get cart
    app.get("/cart", verifyJWT, async (req, res) => {
      const email = req.decoded.email;
      const userEmail = req.query.email;
      if (email !== userEmail) {
        return res
          .status(401)
          .send({ error: true, message: "unauthorized access" });
      }
      const query = { email: userEmail };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    //   Delete from cart
    app.delete("/cart/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    //   Check out
    app.post("/checkout", async (req, res) => {
      const order = req.body;
      order.status = "paid";
      // get cart id and delete from cart
      const cartId = order._id;
      const query = { _id: new ObjectId(cartId) };
      const deleteResult = await cartCollection.deleteOne(query);
      // add order to database
      const result = await ordersCollection.insertOne(order);
      res.send(result);
    });

    //   Get orders
    app.get("/orders/:email", verifyJWT, async (req, res) => {
      const email = req.decoded.email;
      const userEmail = req.params.email;
      if (email !== userEmail) {
        return res
          .status(401)
          .send({ error: true, message: "unauthorized access" });
      }
      const query = { email: userEmail };
      const sort = { orderTime: -1 };
      const result = await ordersCollection.find(query).sort(sort).toArray();
      res.send(result);
    });

    // Admin Routes
    // Get all orders
    app.get("/allorders", async (req, res) => {
      const sort = { orderTime: -1 };
      const result = await ordersCollection.find({}).sort(sort).toArray();
      res.send(result);
    });

    // Get all customers
    app.get("/customers", async (req, res) => {
      const query = { role: "customer" };
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("E-Bazar server is running");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

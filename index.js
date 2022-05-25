const express = require("express");
// https://lit-brushlands-20447.herokuapp.com/
const { MongoClient, ServerApiVersion } = require("mongodb");
const ObjectId = require("mongodb").ObjectId;

const jwt = require("jsonwebtoken");

const cors = require("cors");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);



//use middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://tooleroAdmin:MetIlph2lIN2QblY@cluster0.ls4bo.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});
function verifyJWT(req,res,next){
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({message: "unAuthorized access"});
  }
  const token = authHeader.split(' ')[1]
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function(err, decoded) {
      if (err) {
        return res.status(403).send({message: "Forbidden  Access"});
      }
      req.decoded = decoded;
      next()
  });
}
async function run() {
  try {
    await client.connect();
    const toolsCollection = client.db("toolero").collection("tools");
    const bookingCollection = client.db("toolero").collection("bookings");
    const ordersCollection = client.db("toolero").collection("orders");
    const usersCollection = client.db("toolero").collection("users");
    const reviewsCollection = client.db("toolero").collection("reviews");
    const profilesCollection = client.db("toolero").collection("profiles");
    const paymentsCollection = client.db("toolero").collection("payments");

    const verifyAdmin = async (req,res,next) => {
      const requester = req.decoded.email;
      const requesterAccount = await usersCollection.findOne({email:requester});
      if(requesterAccount.role === "admin"){
        next()
      }else{
        return res.status(403).send({message: "Forbidden access"});
      }
    }

     //get all users
     app.get("/users", verifyJWT, async (req, res) => {
      const users = await usersCollection.find({}).toArray();
      res.send(users);
    });

    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const service = req.body;
      const price = service.price
      const amount = price*100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount : amount,
        currency : "usd",
        payment_method_types : ['card']
      })
      res.send({clientSecret : paymentIntent.client_secret})
    })
   
    // get user by email who is admin?
    app.get("/admin/:email", verifyJWT ,async (req, res) => {
      const email = req.params.email;
     const user = await usersCollection.findOne({email : email});
     const isAdmin = user.role === "admin";
     res.send({admin:isAdmin});
   });

    app.get("/available", async (req, res) => {
      const date = req.query.date
      const services =  await toolsCollection.find().toArray();
      const query = {date: "May 18, 2022"};
      const bookings =  await bookingCollection.find(query).toArray();

      services.forEach(service => {
        const serviceBookings = bookings.filter(book => book.treatMentName === service.name)
        console.log(serviceBookings);
      })
      res.send(services);
    });
    //make admin
    app.put('/user/admin/:email', verifyJWT, async(req,res) => {
      const email = req.params.email;
      const requester = req.decoded.email;
      const requesterAccount = await usersCollection.findOne({email:requester});
      if(requesterAccount.role === "admin"){
        const filter = {email : email}
        const updateDoc = {
          $set : { role : "admin" }
        }
        const result = await usersCollection.updateOne(filter,updateDoc)
        return res.send(result)
      }else{
        return res.status(403).send({message: "Forbidden access"});
      }
      
  })

  app.put('/user/:email', async(req,res) => {
      const email = req.params.email;
      const user = req.body
      const filter = {email : email}
      const options = {upsert : true}
      const updateDoc = {
        $set : user
      }   
      const result = await usersCollection.updateOne(filter,updateDoc,options)
      const token = jwt.sign({email: email},process.env.ACCESS_TOKEN_SECRET,{ expiresIn: '1h' })
      res.send({result : result,token:token})
  })
  //set OR update userProfile
  app.put('/userProfile/:email', async(req,res) => {
      const email = req.params.email;
      const user = req.body
      const filter = {email : email}
      const options = {upsert : true}
      const updateDoc = {
        $set : user
      }   
      const result = await profilesCollection.updateOne(filter,updateDoc,options)
      res.send(result)
  })

    //get userProfile
    app.get("/getUserProfile/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const userProfile = await profilesCollection.findOne({email : email});
      res.send(userProfile);
    });


   //add booking
    app.post("/booking", async (req, res) => {
        const booking = req.body;
        const query = {treatMentName : booking.treatMentName, date : booking.date,patientName : booking.patientName}
        const exists = await bookingCollection.findOne(query)
        if (exists) {
          return res.send({success:false, booking : exists});
        }
        const result = await bookingCollection.insertOne(booking);
        return res.send({success:true, booking : result});
    });
    
    // Add Review
    app.post("/addReview", async (req, res) => {
        const review = req.body;
        const result = await reviewsCollection.insertOne(review);
        return res.send(result);
    });

    //get reviews
    app.get("/getReviews", async (req, res) => {
    const query = {}; //get all information
    const cursor = reviewsCollection.find(query).sort({ratting:-1});
    const result = await cursor.toArray();
    res.send(result);
  });


    //Add Order
    app.post("/addOrder", async (req, res) => {
      const order = req.body;
      const result = await ordersCollection.insertOne(order);
      return res.send(result);
    });
    //get all order
    app.get("/getOrders", verifyJWT, async (req, res) => {
        const cursor = ordersCollection.find({});
        const orders = await cursor.toArray();
        res.send(orders);
    });
    //get order by email--------------JWT
    app.get("/orders", verifyJWT, async (req, res) => {
        const userEmail = req.query.email;
        const decodedEmail = req.decoded.email
        if (userEmail === decodedEmail) {
          const query = {userEmail : userEmail}
          const cursor = ordersCollection.find(query);
          const orders = await cursor.toArray();
          return res.send(orders);
        }else{
          return res.status(403).send({message: "forbidden access"});
        }
    });

      //get a order by id
      app.get("/order/:id", verifyJWT, async (req, res) => {
        const id = req.params.id;
        const query = { _id: ObjectId(id) };
        const result = await ordersCollection.findOne(query);
        res.send(result);
      });
      
      //update a order by id on admin
      app.patch("/order/admin/:id", verifyJWT, async (req, res) => {
        const id = req.params.id;
        const filter = { _id: ObjectId(id) };
        const updateDoc = {
          $set : {
            status : true
          }
        }   
        const result = await ordersCollection.updateOne(filter,updateDoc)
        res.send(result);
      });
      
      //update a order by id
      app.patch("/order/:id", verifyJWT, async (req, res) => {
        const id = req.params.id;
        const payment = req.body
        const filter = { _id: ObjectId(id) };
        const updateDoc = {
          $set : {
            paid : true,
            status : false,
            tranSactionId : payment.tranSactionId
          }
        }   
        const ins = await paymentsCollection.insertOne(payment);
        const result = await ordersCollection.updateOne(filter,updateDoc)
        res.send(result);
      });
      
      //delete a order
      app.delete("/order/:id", verifyJWT, async (req, res) => {
        const id = req.params.id;
        const query = { _id: ObjectId(id) };
        const result = await ordersCollection.deleteOne(query);
        res.send(result);
      });
      //delete a tool
      app.delete("/deleteTool/:id", verifyJWT, async (req, res) => {
        const id = req.params.id;
        const query = { _id: ObjectId(id) };
        const result = await toolsCollection.deleteOne(query);
        res.send(result);
      });
      
       // add tools
       app.post("/addTools", async (req, res) => {
        const tools = req.body;
        const result = await toolsCollection.insertOne(tools);
        return res.send(result);
      });

      //get tools by admin
      app.get("/getToolsByAdmin",verifyJWT,verifyAdmin, async (req, res) => {
        const query = {}; //get all information
        const cursor = toolsCollection.find(query);
        const tools = await cursor.toArray();
        res.send(tools);
      });

      //get tools
      app.get("/tools", async (req, res) => {
        const query = {}; //get all information
        const cursor = toolsCollection.find(query);
        const tools = await cursor.toArray();
        res.send(tools);
      });
    
       //get single item by id
      app.get("/item/:id", async (req, res) => {
        const id = req.params.id;
        const query = { _id: ObjectId(id) };
        const result = await toolsCollection.findOne(query);
        res.send(result);
      });

  } finally {
    // await client.close();
  }
}
run().catch(console.dir);
//
app.get("/", (req, res) => {
  res.send("running my toolero server, port:" + port);
});
app.listen(port, () => {
  console.log("toolero server is running, port " + port);
});

const express = require("express");

const { MongoClient, ServerApiVersion } = require("mongodb");
const ObjectId = require("mongodb").ObjectId;

const jwt = require("jsonwebtoken");

const cors = require("cors");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

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
    const usersCollection = client.db("toolero").collection("users");


     //get all users
     app.get("/users", verifyJWT, async (req, res) => {
      const users = await usersCollection.find({}).toArray();
      res.send(users);
    });
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
      console.log(requesterAccount);
      if(requesterAccount.role === "admin"){
        const filter = {email : email}
        const updateDoc = {
          $set : { role : "admin" }
        }
        const result = await usersCollection.updateOne(filter,updateDoc)
        console.log(result);
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

      //get booking--------------JWT
      app.get("/booking", verifyJWT, async (req, res) => {
          const patientEmail = req.query.email;
          const decodedEmail = req.decoded.email
          if (patientEmail === decodedEmail) {
            const query = {patientEmail : patientEmail}
            const cursor = bookingCollection.find(query);
            const bookings = await cursor.toArray();
            return res.send(bookings);
          }else{
            return res.status(403).send({message: "forbidden access"});
          }
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

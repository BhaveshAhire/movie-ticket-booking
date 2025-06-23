import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import connectDB from './configs/db.js';
import { clerkClient, clerkMiddleware } from '@clerk/express'
import { serve } from "inngest/express";
import { inngest, functions } from "./inngest/index.js"
import showRouter from './routes/showRoutes.js';
import bookingRouter from './routes/bookingRoute.js';
import adminRouter from './routes/adminRoutes.js';
import userRouter from './routes/userRoutes.js';
import { clerk } from './utils/clerk.js';
import { stripeWebhooks } from './controllers/stripeWebhooks.js';



const app = express();
const port = 3000;

await connectDB()

// stripe Webhooks Route
app.use('/api/stripe',express.raw({type:'application/json'}),stripeWebhooks)

// middleware
app.use(express.json());
app.use(cors());
app.use(clerkMiddleware())

// API Routes
app.get('/',(req,res)=>res.send("Server is Live"));
app.use("/api/inngest", serve({ client: inngest, functions }));
app.use("/api/shows", showRouter);
app.use("/api/booking", bookingRouter );
app.use('/api/admin',adminRouter);
app.use('/api/user',userRouter);
app.get('/getUsers', async (req, res) => {
  try {
    const users = await clerk.users.getUserList({ limit: 10 });
    res.json(users);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Unable to fetch users" });
  }
});


app.listen(port,()=> console.log(`Server listening at http://locahost:${port}`));
import express, { Router } from 'express';
import { getFavorites, getUserBookings, updateFavourite } from '../controllers/userController.js';


const userRouter = express.Router();

userRouter.get('/bookings',getUserBookings);
userRouter.post('/update-favorite',updateFavourite);
userRouter.get('/favorites',getFavorites);

export default userRouter;
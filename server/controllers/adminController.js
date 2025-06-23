import Booking from "../modals/Bookings.js";
import Show from "../modals/Show.js";
import User from "../modals/User.js";

//api to check if user admin
export const isAdmin = async (req,res) =>{
    res.json({success:true,isAdmin: true });
}

// get Dashboard data
export const getDashboardData = async (req,res) =>{
    try {
        const bookings = await Booking.find({isPaid: true});
        const activeShows = await Show.find({showDateTime:{$gte: new Date()}}).populate('movie');

        const totalUser = await User.countDocuments();

        const dashboardData = {
            totalBookings: bookings.length,
            totalRevenue: bookings.reduce((acc,bookings)=>acc+booking.amount,0),
            activeShows,
            totalUser
        }
        res.json({success:true,dashboardData });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });  
    }
}

// Api to get all shows
export const getAllShow = async (req,res)=>{
    try {
        const shows = await Show.find({showDateTime:{$gte: new Date()}}).populate('movie').sort({showDateTime:1})
         res.json({success:true,shows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message }); 
    }
}

export const getAllBookings =async (req,res) =>{
    try {
        const bookings = await Booking.find({}).populate('user').populate({
            path:"show",
            populate:{path:'movie'}
        }).sort({createdAt: -1});
        res.json({success:true,bookings });
    } catch (error) {
         console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
}
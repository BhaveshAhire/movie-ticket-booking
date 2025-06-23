import { Inngest } from "inngest";
import User from "../modals/User.js";
import Booking from "../modals/Bookings.js";
import Show from "../modals/Show.js";
import { sendEmail } from "../configs/nodeMailer.js";
 
// Create a client to send and receive events
export const inngest = new Inngest({ id: "movie-ticket-booking" });

// Inngest function to save user data to a database
const syncUserCreation = inngest.createFunction(
    {id:'sync-user-from-clerk'},
    {event:'clerk/user.created'},
    async({event})=>{
        const {id,first_name,last_name,email_addresses,image_url} = event.data
        const userData = {
            _id: id,
            email: email_addresses[0].email_address,
            name: `${first_name} ${last_name}`,
            image: image_url,
        }
        await User.create(userData);
    }
)

// Inngest function to delete user from database
const syncUserDeletion = inngest.createFunction(
    {id:'delete-user-from-clerk'},
    {event:'clerk/user.deleted'},
    async({event})=>{
        const {id} = event.data
        await User.findByIdAndDelete(id);
    }
)

// Inngest function to update user data
const syncUserUpdation = inngest.createFunction(
    {id:'update-user-from-clerk'},
    {event:'clerk/user.updated'},
    async({event})=>{
        const {id,first_name,last_name,email_addresses,image_url} = event.data
        const userData = {
            _id: id,
            email: email_addresses[0].email_address,
            name: `${first_name} ${last_name}`,
            image: image_url,
        }
        await User.findByIdAndUpdate(id,userData);
    }
)

// Inngest function to cancel booking and release seats of show after 10 minutes of booking created if payment is not made
const releaseSeatsAndDeleteBooking =  inngest.createFunction(
    {id: 'release-seats-delete-bookings'},
    {event:'app/checkpayment'},
    async ({event,step})=>{
        const tenMinuteLater = new Date(Date.now() + 10 * 60 * 1000);
        await step.sleepUntil('wait-for-10-minutes',tenMinuteLater);

        await step.run('check-payment-status',async()=>{
            const bookingId = event.data.bookingId;
            const booking = await Booking.findById(bookingId);

            //if payment is not made, release seats and delete bookings
            if(!booking.isPaid){
                const show = await Show.findById(booking.show);
                booking.bookedSeats.forEach((seat)=>{
                    delete show.occupiedSeats[seat]
                });
                show.markModified('occupiedSeats')
                await show.save()
                await Booking.findByIdAndDelete(booking._id)
            }
        })
    }
)


// Inngest function to send email when user books a show
const sendBookingConfirmationEmail = inngest.createFunction(
    {id: "send-booking-confirmation-email"},
    {event: 'app/show.booked'},
    async ({event,step}) =>{
        const {bookingId} = event.data;

        const booking = await Booking.findById(bookingId).populate({
            path:'show',
            populate:{path:"movie",model:"Movie"}
        }).populate('user');

        await sendEmail({
            to: booking.user.email,
            subject: `Payment Confirmation: "${booking.show.movie.title}" booked!`,
            body:  `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
      <h2 style="color: #4CAF50;">🎟️ Booking Confirmed!</h2>
      <p>Hi ${booking.user.name},</p>
      <p>Thank you for booking with <strong>MovieMania</strong>! Here are your booking details:</p>
      
      <table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Movie</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${booking.show.movie.title}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Date & Time</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${new Date(booking.show.showDateTime).toLocaleString()}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Seats</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${booking.bookedSeats.join(', ')}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Total Amount</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">₹${booking.amount}</td>
        </tr>
      </table>

      <p>We hope you enjoy your movie! 🍿</p>
      <p style="margin-top: 30px;">Warm regards,<br><strong>MovieMania Team</strong></p>
      <hr />
      <p style="font-size: 12px; color: #999;">This is an automated email. Please do not reply.</p>
    </div>
  `
        })
    }
)

// Create an empty array where we'll export future Inngest functions
export const functions = [syncUserCreation,syncUserDeletion,syncUserUpdation,releaseSeatsAndDeleteBooking,sendBookingConfirmationEmail];

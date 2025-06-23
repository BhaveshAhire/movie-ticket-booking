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

// Inngest Function to send remainders
const sendShowReminders = inngest.createFunction(
    {id: "send-show-reminders"},
    {cron: "0 */8 * * *"},
    async({ step })=>{
        const now = new Date();
        const in8Hours = new Date(now.getTime() + 8 * 60 * 60 * 1000);
        const windowStart = new Date(in8Hours.getTime() - 10 * 60 * 1000);

        // prepare reminder tasks
        const remindersTasks = await step.run
        ('prepare-reminder-tasks',async()=>{
            const shows = await Show.find({
                showTime:{$gte: windowStart,$lte: in8Hours},
            }).populate('movie');

            const tasks = [];

            for(const show of shows){
                 if(!show.movie || !show.occupiedSeats) continue;

                 const userIds = [...new Set(Object.values(show.occupiedSeats))];
                 if(userIds.length===0) continue;

                 const users = await User.find({_id: {$in: userIds}}).select("name email");

                 for(const user of users){
                    tasks.push({
                        userEmail: user.email,
                        username: user.name,
                        movieTitle: show.movie.title,
                        showTime: show.showTime,
                    })
                 }
            }
            return tasks;
        })

        if(remindersTasks.length === 0){
            return {sent: 0,message:"No reminders to send"}
        }

        // send reminder emails
        const results = await step.run('send-all-reminders',async ()=>{
            return await Promise.allSettled(
                remindersTasks.map(task=>sendEmail({
                    to: task.userEmail,
                    subject:`Reminder: Your Movie "${task.movieTitle}" starts soon!`,
                    body: `
  <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
    <h2 style="color: #2196F3;">🎬 Movie Reminder</h2>
    <p>Hi ${task.username},</p>
    <p>This is a friendly reminder that your movie <strong>"${task.movieTitle}"</strong> is starting soon!</p>
    
    <table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Movie</strong></td>
        <td style="padding: 8px; border: 1px solid #ddd;">${task.movieTitle}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Show Time</strong></td>
        <td style="padding: 8px; border: 1px solid #ddd;">${new Date(task.showTime).toLocaleString()}</td>
      </tr>
    </table>

    <p>Don’t be late! 🎟️🍿</p>

    <p style="margin-top: 30px;">See you at the theater!<br><strong>MovieMania Team</strong></p>
    <hr />
    <p style="font-size: 12px; color: #999;">This is an automated email. Please do not reply.</p>
  </div>
`
 
                }))
            )
        })

        const sent = results.filter(r=>r.status === 'fulfilled').length;
        const failed = results.length - sent;

        return{
            sent,
            failed,
            message: `Sent ${sent} reminder(s), ${failed} failed.`
        }
    }
)

// Inngest function to send notifications when a new show is added
const sendNewShowNotifications = inngest.createFunction(
    {id: "send-new-show-notifications"},
    {event: "app/show.added"},
    async({event})=>{
        const {movieTitle,movieId} = event.data;

        const users = await User.find({});

        for(const user of users){
            const userEmail =  user.email;
            const userName = user.name;
            
            const subject = `New Show Added: ${movieTitle}`;
            const body = `
                    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                     <h2 style="color: #ff5722;">🍿 A New Movie Show Has Arrived!</h2>
                       <p>Hi ${userName},</p>
                       <p>We’ve just added a brand new show for <strong>${movieTitle}</strong>!</p>

                       <p>Don't miss your chance to grab the best seats before they're gone!</p>

                     <div style="text-align: center; margin: 30px 0;">
                          <a href="https://your-domain.com/movie/${movieId}" target="_blank" style="background-color: #ff5722; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                             View & Book Now
                          </a>
                     </div>

                     <p>Happy watching! 🎬</p>
                     <p style="margin-top: 30px;">Cheers,<br><strong>MovieMania Team</strong></p>
                     <hr />
                     <p style="font-size: 12px; color: #999;">You’re receiving this email because you’re subscribed to new show notifications.</p>
                    </div>
                    `;

                    await sendEmail({
                        to:userEmail,
                        subject,
                        body
                    })
        }

        return {message:"Notification Sent."}
    }
)

// Create an empty array where we'll export future Inngest functions
export const functions = [syncUserCreation,syncUserDeletion,syncUserUpdation,releaseSeatsAndDeleteBooking,sendBookingConfirmationEmail,sendShowReminders,sendNewShowNotifications];

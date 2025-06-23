import stripe from 'stripe'
import Booking from '../modals/Bookings.js';
import { inngest } from '../inngest/index.js';

export const stripeWebhooks = async(request,response) =>{
    const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY);
    const sig = request.headers['stripe-signature'];

    let event;

    try {
        event = stripeInstance.webhooks.constructEvent(request.body,sig,process.env.STRIPE_WEBHOOK_SECRET)
    } catch (error) {
        return response.status(400).send(`Webhooks Error: ${error.message}`);
    }

    try {
        switch (event.type) {
            case "payment_intent.succeeded":{
                const paymentIntent = event.data.object;
                const sesssionList = await stripeInstance.checkout.sessions.list({
                    payment_intent: paymentIntent.id
                })

                const session = sesssionList.data[0];
                const {bookingId} = session.metadata;

                await Booking.findByIdAndUpdate(bookingId,{
                    isPaid: true,
                    paymentLink:""
                })

                // send confirmation mail
                await inngest.send({
                    name:'app/show.booked',
                    data:{bookingId}
                })

                break;
            }
                
        
            default:
               console.log("Unhandled Event Type:",event.type)
        }
        response.json({received: true})
    } catch (error) {
        console.error("Webhooks processing error:",err);
        response.status(500).send("Internal Server Error");
    }
}
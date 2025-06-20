import { Inngest } from "inngest";
import User from "../modals/User.js";
 
// Create a client to send and receive events
export const inngest = new Inngest({ id: "movie-ticket-booking" });

// Inngest function to save user data to a database
const syncUserCreation = inngest.createFunction(
    {id:'sync-user-from-clerk'},
    {event:'clerk/user.created'},
    async({event})=>{
        console.log("EVENT",event);
        const {id,first_name,last_name,email_addresses,image_url} = event.data
        const userData = {
            _id: id,
            email: email_addresses[0].email_address,
            name: `${first_name} ${last_name}`,
            image: image_url,
        }
        console.log("USER DATA",userData);
        const newUser = await User.create(userData);
        if(!newUser){
            throw new Error('User not created');
        }
        console.log("NEW USER",newUser);
    }
)

// Inngest function to delete user from database
const syncUserDeletion = inngest.createFunction(
    {id:'delete-user-from-clerk'},
    {event:'clerk/user.deleted'},
    async({event})=>{
        console.log("EVENT deleted",event);
        const {id} = event.data
        console.log(" deleted ID",id);
        const deletedUser = await User.findByIdAndDelete(id);
        if(!deletedUser){
            console.log("USER NOT FOUND");
        }
        console.log("DELETED USER",deletedUser);
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

// Create an empty array where we'll export future Inngest functions
export const functions = [syncUserCreation,syncUserDeletion,syncUserUpdation];

import {clerkClient} from '@clerk/express';

export const protectAdmin = async(req,res,next)=>{
    try {
        const {userId} = req.auth();
        const user = await clerkClient.users.getUser(userId);
        if(user.privateMetadata.role !== 'admin'){
            res.status(401).json({ success: false, message: "Not Authorized" });
        }
        next();
        
    } catch (error) {
         res.status(500).json({ success: false, message: "Not Authorized" });
    }
}
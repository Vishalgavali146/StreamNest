import express from  "express"
import cors from "cors"
import cookieParser from "cookie-parser"//accept and set cookies

const app = express()

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    Credential: true
}))

app.use(express.json({limit: "16kb"}))
app.use(express.urlencoded({extende: true, limit: "16kb"}))
app.use(express.static("public"))//store public assets

app.use(cookieParser())


//routes import
import userRouter from './routes/user.routes.js' // make sure user.routers.js export as default
import videoRouter from './routes/video.routes.js'
import likeRouter from './routes/like.routes.js'
import commentRouter from './routes/commnet.routes.js'
import tweetRouter from './routes/tweet.routes.js'

//routes declaration
app.use("/api/v1/users", userRouter)
app.use("/api/v1/videos", videoRouter)
app.use("/api/v1/likes", likeRouter)
app.use("/api/v1/comments", commentRouter) 
app.use("/api/v1/tweets", tweetRouter)



export {app}














/*
import express from "express"
const app = express()

( async () => {// always start with ; in proff Backend
     try{
        await mongoose.connect(`${process.env.MONODB_URI}/${DB_NAME}`)
        app.on("errror", (error) => {
            console.log("ERRR: ", error);
            throw error
        })

        app.listen(process.env.PORT, ()=>{
            console.log(`App is listening on port ${process.env.PORT}`);
        })
     }catch(error){
        console.log("ERROR: ", error)
        throw err
     }
})()*/
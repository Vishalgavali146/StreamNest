import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";

import {ApiError} from "../utils/apiError.js"
// import { use } from "react";
import {User} from "../models/user.models.js"
import { Subscription } from "../models/subcription.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { v2 as cloudinary } from "cloudinary";
import { ApiResponse } from "../utils/ApiResponse.js";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken"

const generateAccessAndRefreshTokens = async(userId) => {
    try{
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
       await user.save({validateBeforeSave: false })

       return {accessToken, refreshToken}

    }catch(error) {
        throw new ApiError(500, "something went wrong while generating refresh and access tokens")
    }
}

const registerUser = asyncHandler( async(req, res) =>{
    // get user details from frontend
    //validation - not empty?; username, email
    //check user already exists
    //check for images
    //check for avtar
    //upload them to cloudinary, avatar
    //create user object - create entry in db
    //remove password and refresh token field from response
    //check for user creation
    //return response


    const {fullName, email, username, password} = req.body
    // console.log("email", email);
    // if(fullName == "") {
    //     throw new ApiError(400, "fullname is required")
    // }

    if(
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ){
            throw new ApiError(400, "All fields are required")
    }

    const existerUser = await User.findOne({
        $or: [{ username }, { email }]
    })
    
    if(existerUser){
        throw new ApiError(409, "User with email or username already exist")
    }
        
    //console.log(req.files)
    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }

        if(!avatarLocalPath) {
            throw new ApiError(400, "Avatar file is required")
        }

        const avatar = await uploadOnCloudinary(avatarLocalPath)
        const coverImage = await uploadOnCloudinary(coverImageLocalPath)

        if(!avatar) {
            throw new ApiError(400, "Avatar file is required")
        }

        const user = await User.create({
            fullName,
            avatar: avatar.url,
            coverImage: coverImage?.url || "",
            email,
            password,
            username: username.toLowerCase()
        })

        const createdUser = await User.findById(user._id).select(
            "-password -refreshToken"
        )

        if(!createdUser) {
            throw new ApiError(500, "something went wrong when registering user")
        }

        return res.status(201).json(
            new ApiResponse(200, createdUser, "User registerred Successfully")
        )

} )

const loginUser = asyncHandler ( async (req, res) => {
    //req -> body
    //username or email
    //find the user
    //password check
    //access and refresh token
    //send cookie
    
    const {email, username, password} = req.body
    if(!username && !email) {
        throw ApiError(400, "username or password is required")
    }
    // if(!(username || email)) {
    //     throw ApiError(400, "username or password is required")
    // }
    const user = await User.findOne({
        $or: [{ username }, { email }]
    })

    if(!user) {
        throw new ApiError(404, "user does not exist")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid) {
        throw new ApiError(401, "Invalid password credentials")
    }
    
   const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)


   const loggedInUser = await User.findById(user._id).select("-password -refreshToken" )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(200, 
            {
            user: loggedInUser, accessToken, refreshToken
            },
        "User logged in successfully"
      )
    )
})

const logoutUser = asyncHandler(async (req, res) => {
   await  User.findByIdAndUpdate(
        req.user._id,
        {
            // $set: {
            //     refreshToken: undefined \\ or you can use null
            // } or 
            $unset:{
                refreshToken: 1
                //this removes field from documents
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiError(200,
        {},
        "User logged Out"
    ))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
   const incomingRefreshToken =  req.cookies.refreshToken || req.body.refreshToken


   if(!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request")
   }
   
  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
     )
      const user = await User.findById(decodedToken?._id)
  
      if(!user) {
      throw new ApiError(401, "Invalis refresh token request")
     }
  
      if(incomingRefreshToken != user?.refreshToken) {
         throw new ApiError(401, "refresh token is expired or use") 
      }
  
      const options = {
          httpOnly: true,
          secure: true
      }
      const {accessToken, newRefreshToken} =  await generateAccessAndRefreshTokens(user._id)
  
      return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
          new ApiResponse(
              200,
              {accessToken, refreshToken: newRefreshToken},
              "Access token refreshed"
          )
      )
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token")
  }

})

const ChangeCurrentPassword = asyncHandler(async (req, res) => {
    const {oldPassword, newPassword} = req.body

    if (!oldPassword || !newPassword) {
  throw new ApiError(400, "Old and new password are required");
}
   const user =  await User.findById(req.user?._id)
    if (!user) {
        throw new ApiError(404, "User not found");
    }


   const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if (!isPasswordCorrect) {
        throw new ApiError(401, "Old password is incorrect");
    }
    user.password = newPassword
    
    if (oldPassword === newPassword) {
        throw new ApiError(400, "New password must be different from old password");
    }

    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(
        new ApiResponse(200,
             {}, "Password changed successfully"))

})

const getCurrentUser = asyncHandler(async (req, res) => {

    return res
    .status(200)
    .json(200, req.user, "Current user fetched successfully")

})


const updateAccountDetails = asyncHandler(async (req, res) => {
    const {fullName, email}  = req.body

    if(!fullName || !email) {
        throw new ApiError(400, "All fields are requiredd")
    }

    const existingUser = await User.findById(req.user?._id);
    if (!existingUser) {
        throw new ApiError(404, "User not found");
  }
    // Check if email is already used by another user
    const isSameFullName = existingUser.fullName === fullName;
  const isSameEmail = existingUser.email === email;

  if (isSameFullName && isSameEmail) {
    throw new ApiError(400, "New values cannot be the same as current details");
  }

    const updateUser = await User.findByIdAndUpdate(
        req.user?._id, 
        {
            $set: {
                fullName,
                email
            }
        },
        {
            new: true,
            runValidators: true // this will check for email and username uniqueness
         }

    ).select("-password")

        return res
        .status(200)
        .json(
            new ApiResponse(200, updateUser.toObject(), "Account details updated successfully")
        )
            
})

const updateUserAvatar = asyncHandler(async (req, res) => {
    
    const avatarLocalPath = req.file?.path
    if(!avatarLocalPath) {
        throw new ApiError(400," Avatar file is missing")
    }

 
    const existingUser = await User.findById(req.user?._id);
    if (!existingUser) {
        throw new ApiError(404, "User not found");
    }

    if(existingUser?.avatarPublicId) {
        await cloudinary.uploader.destroy(existingUser.avatarPublicId)
    }
    

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    if(!avatar.url || !avatar.public_id) {
        throw new ApiError(400," Error while uploading on avatar")
    }
    
   const user =  await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url,
                avatarPublicId: avatar.public_id
            }
        },
        {
            new: true
        }
    ).select("-password")

     return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Avatar image updated successfully")
    )
})

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path
    if(!coverImageLocalPath) {
        throw new ApiError(400," Cover image file is missing")
    }

    const existingUser = await User.findById(req.user._id);
    if (!existingUser) {
        throw new ApiError(404, "User not found");
  }

    if (existingUser.coverImagePublicId) {
    await cloudinary.uploader.destroy(existingUser.coverImagePublicId);
  }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if(!coverImage.url || !coverImage.public_id) {
        throw new ApiError(400," Error while uploading on cover image")
    }

    
    const user =  await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url,
                coverImagePublicId: coverImage.public_id
            }
        },
        {
            new: true
        }
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Cover image updated successfully")
    )
})

const getUserChanelProfile = asyncHandler(async (req, res) => {
    const {username} = req.params

    if(!username?.trim()) {
        throw new ApiError(400, "Username is missing")
    }
    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribed"
            }
        },
        {
            $addFields: {
                suscribersCount: {
                    $size: "$subscribers"
                },
                channelsSuscribedToCount: {
                    $size: "$subscribed"
                },
                isSuscribed: {
                    $cond: {
                    if: { 
                        $in: [new mongoose.Types.ObjectId(req.user._id), "$subscribers.subscriber"]
                    },
                    then: true,
                    else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                avatar: 1,
                coverImage: 1,
                suscribersCount: 1,
                channelsSuscribedToCount: 1,
                isSuscribed: 1,
                email: 1,
            }
        
        }
        

        ])  
        
        if(!channel?.length) {
            throw new ApiError(404, "Channel does not exists")

        }

        return res
        .status(200)
        .json(
            new ApiResponse(200, channel[0], "User channel fetched successfully")
        )


})

const getWatchHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistroy",
                foreignField: "_id",
                as: "watchHisttory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1,
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: { $first: "$owner"
                        }
                    },
                    }
                ]
                    
        }
     }
        
    ])
    
    return res
    .status(200)
    .json(
        new ApiResponse(200, user[0].watchHistroy, "Watch history fetched successfully")
    )

})


export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    ChangeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChanelProfile,
    getWatchHistory
}
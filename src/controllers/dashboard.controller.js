import mongoose from "mongoose"
import { Video } from "../models/video.model.js"
import { Subscription } from "../models/subscription.model.js"
import { Like } from "../models/like.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const getChannelStats = asyncHandler(async (req, res) => {
    const channelId = req.user._id

    const totalVideos = await Video.countDocuments({
        owner: channelId
    })

    const totalViewsAgg = await Video.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(channelId)
            }
        },
        {
            $group: {
                _id: null,
                totalViews: { $sum: "$views" }
            }
        }
    ])

    const totalViews = totalViewsAgg[0]?.totalViews || 0

    const totalSubscribers = await Subscription.countDocuments({
        channel: channelId
    })

    const videoIds = await Video.find(
        { owner: channelId },
        { _id: 1 }
    )

    const totalLikes = await Like.countDocuments({
        video: { $in: videoIds.map(v => v._id) }
    })

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {
                    totalVideos,
                    totalViews,
                    totalSubscribers,
                    totalLikes
                },
                "Channel stats fetched successfully"
            )
        )
})

const getChannelVideos = asyncHandler(async (req, res) => {
    const channelId = req.user._id

    const videos = await Video.find({
        owner: channelId
    }).sort({ createdAt: -1 })

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                videos,
                "Channel videos fetched successfully"
            )
        )
})

export {
    getChannelStats,
    getChannelVideos
}

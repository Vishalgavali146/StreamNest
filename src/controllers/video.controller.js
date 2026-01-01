import mongoose, {isValidObjectId} from 'mongoose';
import { Video } from '../models/video.models';
import {User} from '../models/user.models.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';

const getAllVideos = asyncHandler(async(req, res) => {
    const {page = 1, limit = 10, query, sortBy = 'createdAt', sortType = 'desc', userId} = req.query;

    const matchStage = {ispublished: true};

    if(query) {
        matchStage.title = { $regex: query, $options: 'i' };
    }

    if(userId && isValidObjected(userId)) {
        matchStage.owner = new mongoose.Types.ObjectId(userId);
    }

    const videos = await Video.aggregate(
        [
            {
                $match: matchStage
            },

            {
                $lookup: {
                    from: 'users',
                    localField: 'owner',
                    foreignField: '_id',
                    as: 'owner',
                    pipeline:[
                        {
                            $project: {
                                fullName: 1,
                                username: 1,
                                avatar: 1
                            }
                        }
                    ]
                }
            },

            {
                $addFields: {
                    owner: { $first: '$owner' }
                }
            },

            {
                $sort: {
                    [sortBy]: sortType === 'asc' ? 1 : -1
                }
            },
            
            {
                $skip: (Number(page) - 1) * Number(limit)
            },

            {
                $limit: Number(limit)
            }
        ]
    )
    return res
    .status(200)
    .jason(new ApiResponse(200, videos, "Videos fetched successfully"));

})

const publishAVideo = asyncHandler(async(req, res) => {
    const {title, description, duration} = req.body;

    if(!title || !description || !duration) {
        throw new ApiError(400, "Title, description and duration are required");
    }

    const videoLocalPath = req.files?.video?.[0]?.path;
    const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path; // ?. optional chaining

    if(!videoLocalPath || !thumbnailLocalPath) {
        throw new ApiError(400, "Video file and thumbnail are required")
    }

    const videoUpload = await uploadOnCloudinary(videoLocalPath)
    const thumbnailUpload = await uploadOnCloudinary(thumbnailLocalPath)

    if(!videoUpload?.url || !thumbnailUpload?.url) {
        throw new ApiError(500, "Failed to upload video or thumbnail");
    }

    const video = await Video.create({
        videoFile: videoUpload.url,
        thumbnail: thumbnailUpload.url,
        title,
        description,
        duration,
        owner: req.user._id,

    })
    return res
    .status(201)
    .json(new ApiResponse(201, video, "Video published successfully"));

})

const getVideoById = asyncHandler(async(req, res) => {
    const {videoId} = req.params // value sent in URL
    if(!isValidObjected(videoId)) {
        throw new ApiError(400, "Invalid video id");
    }

    const video = await Video.aggregate(
        [   
            {
                $match: {
                    _id: new mongoose.Types.ObjectId(videoId),
                    ispublished: true
                }
            },

            {
                $lookup: {
                    from: 'users',
                    localField: 'owner',
                    foreignField: '_id',
                    as: 'owner',
                    pipeline:[
                        {
                            $project: {
                                fullName: 1,
                                username: 1,
                                avatar: 1
                            }
                        }
                    ]
                }
            },

            {
                $addFields: {
                    owner: { $first: '$owner' }
                }
            }
            
        ]
    )

    if(!video.length) {
        throw new ApiError(404, "Video not found");
    }

    await video.findByIdAndUpdate(videoId, {
        $inc: {views: 1}
    })

    await User.findByIdAndUpdate(req.user._id, {
        $addToSet: {watchHistory: videoId}
    })

    return res
    .status(200)
    .json(new ApiResponse(200, video[0], "Video fetched successfully"));
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const { title, description } = req.body

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id")
    }

    const video = await Video.findById(videoId)

    if (!video) {
        throw new ApiError(404, "Video not found")
    }

    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "Not authorized to update this video")
    }

    if (req.file?.path) {
        const thumbnailUpload = await uploadOnCloudinary(req.file.path)
        if (thumbnailUpload?.url) {
            video.thumbnail = thumbnailUpload.url
        }
    }

    video.title = title || video.title
    video.description = description || video.description

    await video.save()

    return res
        .status(200)
        .json(new ApiResponse(200, video, "Video updated successfully"))
})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id")
    }

    const video = await Video.findById(videoId)

    if (!video) {
        throw new ApiError(404, "Video not found")
    }

    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "Not authorized to delete this video")
    }

    await video.deleteOne()

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Video deleted successfully"))
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id")
    }

    const video = await Video.findById(videoId)

    if (!video) {
        throw new ApiError(404, "Video not found")
    }

    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "Not authorized")
    }

    video.isPublished = !video.isPublished
    await video.save()

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { isPublished: video.isPublished },
                "Publish status updated"
            )
        )
})


export{
    getAllVideos,
    publishAVideo,
    getVideoById,   
    updateVideo,
    deleteVideo,
    togglePublishStatus
}
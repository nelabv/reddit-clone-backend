import { response } from "express";
import mongodb from "mongodb";
import Utility from "../api/utils.js";

const ObjectId = mongodb.ObjectID;
let threads;

export default class PostsDAO {
  static async initializeDB(conn) {
    if (threads) {
      return
    }
    try {
      threads = await conn.db(process.env.REDDITCLONE_NS).collection("posts");
      //threads.deleteMany({})

    } catch (e) {
      console.error(`Error in PostsDAO initializeDB: ${e}`);
    }
  }

  static async getPostsByCategory(_category) {
    let data;
    const query = { "category": { $eq: _category }}

    try {
      data = await threads.find(query);
      return await data.toArray();
    } catch(e) {
      console.error(`Error in PostsDAO getPostByID: ${e}`);
    }
  }

  static async getCategories() {
    let response = [];
    
    try {
      return await threads.distinct("category");
      //return response;
    } catch (e) {
      console.error(`Error in PostsDAO getCategories: ${e}`)
      return categories;
    }
  }

  static async fetchPosts({
    filters = null
  } = {}) {
    let query; 
    
    if (filters) {
      if ("flair" in filters) {
        query = { "flair": { $eq: filters["flair"] } }
      }
    }

    let cursor; 
    
    try {
      cursor = await threads.find(query);
      return await cursor.toArray();
    } catch (e) {
      console.error(`Error in PostsDAO fetchPosts: ${e}`);
    }
  }

  static async getPostByID(id){
    let data;
    const query = {
      _id : ObjectId(id)
    }

    try {
      data = await threads.find(query);
      const retrievedPost = await data.toArray();
      return { retrievedPost };
    } catch(e) {
      console.error(`Error in PostsDAO getPostByID: ${e}`);
    }
  }

  static async castVote(postID, username, vote) {
    let array; 

    try {
      if (vote === true) {
        array = "upvotes";
      } else if (vote === false) {
        array = "downvotes";
      }
    } catch (error) {
      console.log(`Error in PostsDAO castVote: Unable to assign variable: ${error}`);
    }


    let upvotesSearch;
    let downvotesSearch;

    try {
      upvotesSearch = await threads.find({ 
        _id: ObjectId(postID),
        "votes.upvotes": username 
      }).toArray();
  
      downvotesSearch = await threads.find({ 
        _id: ObjectId(postID),
        "votes.downvotes": username 
      }).toArray();
    } catch (err) {
      console.log(`Error in PostsDAO castVote: ${err}`);
    }

    let response;
    // Check if user has voted the same vote already
    if ((upvotesSearch.length > 0 && vote === true) || (downvotesSearch.length > 0 && vote === false)) { 
      response = {
        status: "duplicate",
        message: "DUPLICATE: User has voted the same vote on the same post. No changes were made."
      }
      return response;
    } else if (upvotesSearch.length > 0 && vote !== true) {
      threads.updateOne(
        { _id: ObjectId(postID)}, 
        { 
          $pull: { "votes.upvotes" : username },
          $push: { "votes.downvotes" : username }
        }
      ) 
      response = {
        status: "change vote",
        message: "VOTE CHANGE ( + to - ): User has existing record but requested to change vote."
      }
      return response;
    } 
    
    
    else if (downvotesSearch.length > 0 && vote !== false) {
      threads.updateOne(
        { _id: ObjectId(postID)}, 
        { 
          $pull: { "votes.downvotes" : username },
          $push: { "votes.upvotes" : username }
        }
      )  
      response = {
        status: "change vote",
        message: "VOTE CHANGE ( - to + ): User has existing record but requested to change vote."
      }
      return response;
    } else {
      threads.updateOne(
        { _id: ObjectId(postID)}, 
        { 
          $push: { [`votes.${array}`] : username },
          $inc: {[`votes.totalVoteCount`]: 1}
        }
      )
      response = {
        status: "added record",
        message: "RECORD ADDED: User has no existing record on this post. Added user to votes array successfully."
      }
      return response;
    }
    
  
  }

  static async addPost(newPost) {
    function handleSubmit(_newPost) {
      return new Promise (function(resolve, reject) {
        threads.insertOne(newPost, function(error, result) {
          if (error) {
            reject();
          } else {
            const postId = result.ops[0]._id;
            const author = result.ops[0].author;

            threads.updateOne(
              { _id: ObjectId(postId)}, 
              { $inc : {"votes.totalVoteCount" : 1},
              $push: { "votes.upvotes" : author } }
            );
            resolve(postId);
          }
        })
      })
    }

    const id = await handleSubmit(newPost);
    return id;
  }

  static async upvoteDownvote(rate, id) {
    let retrievedPost;
    const query = {
      _id: ObjectId(id)
    };

    try {
      let data = await threads.find(query);
      retrievedPost = await data.toArray();

      if (rate === true) {
        const update = await threads.updateOne(query, {
          $inc: { rating: 1}
        })
      } if (rate === false) {
        const update = await threads.updateOne(query, {
          $inc: { rating: -1}
        })
      }
    } catch (e) {
      console.error(`Error in PostsDAO upvoteDownvote: ${e}`);
    }

  }

  static async deletePost(postId, userId) {
    try {
      const deletePost = await threads.deleteOne({
        _id: ObjectId(postId),
        user: userId
      })
      return deletePost;
    } catch(e) {
      console.error(`Error in PostsDAO deletePost: ${e}`);
    }
  }

  static async addComment(commentDoc, postId) {
    try {
      const addCommentReq = await threads.updateOne(
        { _id: ObjectId(postId) },
        { $push: { comments: commentDoc } }
      )

      return addCommentReq;
    } catch(e) {
      console.error(`Error in PostsDAO addComment: ${e}`);
    }
  }
}
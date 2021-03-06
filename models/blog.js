var mongoose = require('mongoose');

var blogSchema = new mongoose.Schema({
	title: String,
    image: String,
    imageId: String,    
    body: String,
    author: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        username: String
    },
	comments: [
         {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Comments"
        }
    ],
	created: {type: Date, default: Date.now}
});

module.exports = mongoose.model("Blog", blogSchema);
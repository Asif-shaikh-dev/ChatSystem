const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  room: { type: String, required: true, index: true },
  user: { type: String, required: true },
  mediaUrl: { type: String, default: null },
  mediaType: { type: String, enum: ['image', 'video', null], default: null },
  text: { type: String, required: false, default: null },

  time: { type: Date, default: Date.now },
  replyTo: {
    user: String,
    text: String
  },
  deletedFor: { type: [String], default: [] },  // array of users who deleted for themselves
  deletedForEveryone: { type: Boolean, default: false } 
}, { timestamps: true });


module.exports = mongoose.model('Message', messageSchema);

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  room: { type: String, required: true, index: true },
  user: { type: String, required: true },
  text: { type: String, required: true },
  time: { type: Date, default: Date.now },
  replyTo: {
    user: String,
    text: String
  }
}, { timestamps: true });


module.exports = mongoose.model('Message', messageSchema);

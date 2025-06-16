const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const Message = require('./models/Message.models');  
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log(err));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      'http://192.168.161.103:5173',
      'http://localhost:5173',
      'https://chatsystem-frontend.onrender.com'
    ],
    methods: ['GET', 'POST'],
  },
});
app.set('io', io);


// SOCKET.IO EVENTS
io.on('connection', (socket) => {
  socket.on('join_room', (room) => {
    socket.join(room);
  });

  socket.on('send_message', async (data) => {
    const { room, message } = data;

    const newMessage = new Message({
      room,
      user: message.user,
      text: message.text,
      replyTo: message.replyTo || null,
      time: message.time || new Date()
    });

    const savedMessage = await newMessage.save();

    io.to(room).emit('receive_message', savedMessage);
  });

  socket.on('typing', ({ room, user }) => {
    socket.to(room).emit('typing', user);
  });

  socket.on('stop_typing', (room) => {
    socket.to(room).emit('stop_typing');
  });

  socket.on('get_previous_messages', async ({ room, username }) => {
    const messages = await Message.find({
      room,
      $nor: [{ deletedFor: username }]
    }).sort({ createdAt: 1 });

    const modifiedMessages = messages.map(msg => {
      if (msg.deletedForEveryone) {
        return {
          ...msg._doc,
          text: 'This message was deleted.',
          deletedForEveryone: true
        };
      }
      return msg;
    });

    socket.emit('previous_messages', modifiedMessages);
  });

  socket.on('disconnect', () => {});
});

// ========== NORMAL HTTP API (For DELETE functionality) ==========

// GET previous messages for initial fetch (called from frontend)
app.get('/api/messages/:room', async (req, res) => {
  try {
    const { room } = req.params;
    const username = req.query.username;  // now coming as query param

    const messages = await Message.find({
      room,
      $nor: username ? [{ deletedFor: username }] : []
    }).sort({ createdAt: 1 });

    const modifiedMessages = messages.map(msg => {
      if (msg.deletedForEveryone) {
        return {
          ...msg._doc,
          text: 'This message was deleted.',
          deletedForEveryone: true
        };
      }
      return msg;
    });

    res.json(modifiedMessages);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE FOR ME
app.post('/api/delete-for-me', async (req, res) => {
  const { messageId, username } = req.body;

  try {
    await Message.findByIdAndUpdate(messageId, {
      $addToSet: { deletedFor: username }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error deleting for me' });
  }
});

// DELETE FOR EVERYONE
app.post('/api/delete-for-everyone', async (req, res) => {
  const { messageId,room } = req.body;

  try {
    await Message.findByIdAndUpdate(messageId, { deletedForEveryone: true });
    const io = req.app.get('io');
    io.to(room).emit('refresh_messages');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error deleting for everyone' });
  }
});

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

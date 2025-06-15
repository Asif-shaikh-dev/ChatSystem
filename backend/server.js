const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const Message = require('./models/Message.models');  // assuming models folder
require('dotenv').config();
const app = express();
app.use(cors());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI).then(() => console.log('MongoDB Connected'))
  .catch(err => console.log(err));

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: ['http://192.168.161.103:5173', 'http://localhost:5173','https://chatsystem-frontend.onrender.com'], // replace with your frontend URLs
        methods: ['GET', 'POST'],
    },
});

io.on('connection', (socket) => {
    socket.on('join_room', (room) => {
        socket.join(room);
        // console.log(`User ${socket.id} joined room ${room}`);
    });

    // Handle sending message and save to DB
    socket.on('send_message', async (data) => {
        const { room, message } = data;
    
        const newMessage = new Message({
            room,
            user: message.user,
            text: message.text,
            replyTo: message.replyTo || null  // <-- ADD THIS
        });
    
        const savedMessage = await newMessage.save();
    
        io.to(room).emit('receive_message', savedMessage);
    });
    

    // Handle typing event
    socket.on('typing', ({ room, user }) => {
        socket.to(room).emit('typing', user);
      });
      

    // Handle stop typing event
    socket.on('stop_typing', (room) => {
        socket.to(room).emit('stop_typing');
    });

    // Handle loading previous messages
    socket.on('get_previous_messages', async (room) => {
        const messages = await Message.find({ room: room }).sort({ createdAt: 1 }).limit(50);
        socket.emit('previous_messages', messages);
    });

    socket.on('disconnect', () => {
        // console.log('User disconnected:', socket.id);
    });
});

app.get('/api/messages/:room', async (req, res) => {
    try {
      const messages = await Message.find({ room: req.params.room }).sort({ createdAt: 1 }).limit(50);
      res.json(messages);
    } catch (err) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });


const PORT = 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

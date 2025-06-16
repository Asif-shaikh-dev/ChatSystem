import React, { useState, useRef, useEffect } from 'react';
import io from 'socket.io-client';
import { AnimatePresence, motion } from "framer-motion";
import ChatHeader from './ChatHeader';
// Replace with your backend URL/
const backendUrl = 'https://chatsystem-backend-qxla.onrender.com'; // Update with your backend URL
// const backendUrl = 'http://192.168.161.103:5000'; // For local development
const socket = io(backendUrl);

const Chat = () => {
  const [username, setUsername] = useState('');
  const [room, setRoom] = useState('');
  const [joined, setJoined] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState('');
  const typingTimeout = useRef(null);
  const [loading, setLoading] = useState(false);
  const [startLoading, setStartLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchEndX, setTouchEndX] = useState(0);
  const [swipeOffsets, setSwipeOffsets] = useState({});


  const joinRoom = async () => {
    if (room.trim() !== '' && username.trim() !== '') {
      socket.emit('join_room', room);
      setStartLoading(true);
      try {
        const response = await fetch(`${backendUrl}/api/messages/${room}?username=${username}`);

        const data = await response.json();
        setMessages(data);
      } catch (error) {
        console.error('Error fetching previous messages:', error);
      } finally {
        setJoined(true);
        setStartLoading(false);
      }
    }
  };

  const handleSend = () => {
    if (input.trim() === '') return;

    const messageData = {
      user: username,
      text: input,
      time: new Date(),
      replyTo: replyingTo ? {
        user: replyingTo.user,
        text: replyingTo.text,
      } : null
    };

    socket.emit('send_message', { room, message: messageData });
    setInput('');
    setReplyingTo(null);  // clear after send
    socket.emit('stop_typing', room);
  };

  const handleEnter = (e) => {
    if (e.key === 'Enter') handleSend();
  };

  const handleTyping = (e) => {
    setInput(e.target.value);
    if (!isTyping) {
      setIsTyping(true);
      socket.emit('typing', { room, user: username });
    }
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit('stop_typing', room);
    }, 1000);
  };

  const handleTouchStart = (e, msg) => {
    setTouchStartX(e.changedTouches[0].clientX);
  };
  const MAX_SWIPE_DISTANCE = 50;  // limit swipe movement
  const REPLY_THRESHOLD = 30;     // when to trigger reply

  const handleTouchMove = (e, msg) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX;

    // Allow swipe only in valid direction based on sender
    const validDelta = (msg.user === username)
      ? Math.min(0, deltaX)   // sender: swipe left only
      : Math.max(0, deltaX);  // receiver: swipe right only

    // Limit distance
    const limitedDelta = Math.max(-MAX_SWIPE_DISTANCE, Math.min(validDelta, MAX_SWIPE_DISTANCE));

    setSwipeOffsets((prev) => ({ ...prev, [msg._id || msg.text]: limitedDelta }));
  };

  const handleTouchEnd = (msg) => {
    const deltaX = swipeOffsets[msg._id || msg.text] || 0;

    if (
      (msg.user === username && deltaX <= -REPLY_THRESHOLD) ||
      (msg.user !== username && deltaX >= REPLY_THRESHOLD)
    ) {
      setReplyingTo(msg);
    }

    // Reset swipe after release
    setSwipeOffsets((prev) => ({ ...prev, [msg._id || msg.text]: 0 }));
  };


  const handleReply = (msg) => setReplyingTo(msg);

  useEffect(() => {
    socket.on('receive_message', (data) => setMessages((prev) => [...prev, data]));
    socket.on('previous_messages', (data) => setMessages(data));
    socket.on('typing', (user) => { if (user !== username) setOtherUserTyping(user); });
    socket.on('stop_typing', () => setOtherUserTyping(''));

    return () => {
      socket.off('receive_message');
      socket.off('previous_messages');
      socket.off('typing');
      socket.off('stop_typing');
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, otherUserTyping]);

  const capitalizeFirstLetter = (str) => (!str ? '' : str.charAt(0).toUpperCase() + str.slice(1));

  // ... your existing functions unchanged ...

  const handleDeleteForMe = async (msg) => {
    setLoading(true);
    await fetch(`${backendUrl}/api/delete-for-me`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: msg._id, username })
    });
    setMessages((prev) => prev.filter((m) => m._id !== msg._id)); // remove from local state
    setDeleteTarget(null); // clear delete target
    setLoading(false);
  };

  const handleDeleteForEveryone = async (msg) => {
    setLoading(true);

    await fetch(`${backendUrl}/api/delete-for-everyone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: msg._id, room })
    });
    setMessages((prev) => prev.filter((m) => m._id !== msg._id));
    // mark as deleted
    setDeleteTarget(null); // clear delete target
    setLoading(false);

  };

  // Refresh messages listener
  useEffect(() => {
    socket.on('refresh_messages', () => {
      socket.emit('get_previous_messages', { room, username });
    });

    return () => {
      socket.off('refresh_messages');
    };
  }, [room, username]);

  // Get previous messages on join
  useEffect(() => {
    if (joined) {
      socket.emit('get_previous_messages', { room, username });
    }
  }, [joined, room, username]);

  const [deleteTarget, setDeleteTarget] = useState(null);  // stores message to delete
  const [showDeleteOptions, setShowDeleteOptions] = useState(false);


  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-300 to-blue-400 relative">
      <div className="bg-white w-full max-w-md shadow-lg rounded-lg p-4 flex flex-col h-[100vh] relative">
        <ChatHeader />
        {loading && <div className="absolute inset-0 bg-gray-100 bg-opacity-10 flex items-center justify-center z-50 rounded-lg"><div className="h-16 w-16 rounded-full border-[8px] border-blue-500 border-t-blue-700 animate-spin shadow-xl"></div>
        </div>}
        {startLoading && <div className="absolute inset-0 bg-gray-100 bg-opacity-10 flex items-center justify-center z-50 rounded-lg"><div className="w-24 h-24 border-8 border-blue-500 border-t-blue-900 rounded-full animate-spin shadow-2xl"></div>

        </div>}
        

        {!joined ? (
          <div className="flex flex-col items-center gap-4 w-full">
            <input className="border p-2 rounded w-full" placeholder="Enter your name" value={username} onChange={(e) => setUsername(e.target.value)} />
            <input className="border p-2 rounded w-full" placeholder="Enter Room ID" value={room} onChange={(e) => setRoom(e.target.value)} />
            <button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 w-full" onClick={joinRoom}>Join Room</button>
          </div>
        ) : (
          <>



            <div className="flex-1 overflow-y-auto mb-2 border-2 border-gray-300 rounded-lg p-4  overflow-hidden">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`mb-2 flex ${msg.user === username ? 'justify-end' : 'justify-start'}`}
                  onTouchStart={(e) => handleTouchStart(e, msg)}
                  onTouchMove={(e) => handleTouchMove(e, msg)}
                  onTouchEnd={() => handleTouchEnd(msg)}
                  onClick={() => handleReply(msg)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setDeleteTarget(msg);
                    setShowDeleteOptions(true);
                  }}
                  style={{
                    transform: `translateX(${swipeOffsets[msg._id || msg.text] || 0}px)`,
                    transition: 'transform 0.2s ease'
                  }}
                >


                  <div className={`rounded-lg px-4 py-2 
                    ${msg.user === username ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-800'}
                    break-all whitespace-pre-wrap max-w-[98%] mb-1.5`}
                    style={{
                      transform: `translateX(${swipeOffsets[msg._id || msg.text] || 0}px)`,
                      transition: 'transform 0.2s ease',
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      msUserSelect: 'none',
                    }}
                  >


                    {msg.replyToText && (
                      <div className="text-xs italic text-gray-500 border-l-4 border-blue-400 pl-2 mb-1">
                        Replying to: {msg.replyToText}
                      </div>
                    )}

                    {msg.replyTo && (
                      <div className="mb-1 px-2 py-1 border-l-4 border-blue-400 bg-blue-100 rounded text-xs text-gray-700">
                        <div className="font-semibold">{msg.replyTo.user === username ? 'Me' : capitalizeFirstLetter(msg.replyTo.user)}</div>
                        <div className="italic">{msg.replyTo.text}</div>
                      </div>
                    )}

                    <div className="font-bold">{msg.user === username ? 'Me' : capitalizeFirstLetter(msg.user.split(' ')[0])}</div>
                    <div className="flex gap-2  items-center ">
                      {msg.text}
                      <div className="text-[0.65rem]  text-right  self-end flex-shrink-0">
                        {new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>


                  </div>
                </div>
              ))}

              <div ref={messagesEndRef}></div>

              <AnimatePresence>
                {otherUserTyping && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="text-sm text-gray-500 font-semibold mb-2 text-left"
                  >
                    {capitalizeFirstLetter(otherUserTyping.split(' ')[0])} is typing...
                  </motion.div>
                )}
              </AnimatePresence>
            </div>




            <div className="border-t border-gray-300 rounded-lg p-2 bg-white">
              {replyingTo && (
                <div className="p-2 bg-gray-100 border-l-4 border-blue-500 mb-2">
                  Replying to: <strong>{replyingTo.text}</strong>
                  <button className="float-right text-red-500" onClick={() => setReplyingTo(null)}>X</button>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center gap-2">


                <input type="text" className="flex-1 border rounded px-4 py-2 focus:outline-none w-full" placeholder="Type a message..." value={input} onChange={handleTyping} onKeyDown={handleEnter} />
                <button className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 w-full sm:w-auto" onClick={handleSend}>Send</button>
              </div>
            </div>
          </>
        )}
      </div>
      {showDeleteOptions && (
        <div style={{
          userSelect: 'none',
          WebkitUserSelect: 'none',
          msUserSelect: 'none',
        }}
          className="fixed inset-0 backdrop-blur-md bg-black bg-opacity-10 flex items-center justify-center z-50 transition-all duration-300
">
          <div className="bg-white p-8 rounded-2xl shadow-2xl w-80 text-center">
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Delete Message</h2>
            <p className="text-gray-600 mb-6">Are you sure you want to delete this message?</p>

            <div className="flex flex-col gap-3">
              <button
                // disable if not the sender
                className={`${deleteTarget.user != username ? 'hidden' : ' '}  bg-red-500 hover:bg-red-600 text-white py-2 rounded-xl shadow transition`}
                onClick={() => {
                  handleDeleteForEveryone(deleteTarget);
                  setShowDeleteOptions(false);
                }}
              >
                Delete for Everyone
              </button>

              <button
                className="bg-yellow-400 hover:bg-yellow-500 text-white py-2 rounded-xl shadow transition"
                onClick={() => {
                  handleDeleteForMe(deleteTarget);
                  setShowDeleteOptions(false);
                }}
              >
                Delete for Me
              </button>

              <button
                className="text-gray-500 mt-2 hover:text-gray-700 transition underline"
                onClick={() => setShowDeleteOptions(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Chat;

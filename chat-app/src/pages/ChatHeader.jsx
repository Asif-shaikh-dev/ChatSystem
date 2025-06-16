import { motion } from 'framer-motion';

const ChatHeader = () => {
  return (
    <div className="flex justify-center mb-6">

      <div className="relative flex items-center gap-2 text-3xl font-extrabold bg-gradient-to-r from-purple-500 via-indigo-600 to-fuchsia-500 bg-clip-text text-transparent drop-shadow-lg overflow-hidden">
        👋 AChat
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-white/20 to-white/0 w-full h-full"
          animate={{ x: ["-100%", "100%"] }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        />
      </div>





    </div>
  );
};

export default ChatHeader;

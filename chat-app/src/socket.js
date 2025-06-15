import { io } from "socket.io-client";
const socket = io("http://192.168.161.103:5173/");
export default socket;

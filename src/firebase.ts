import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBHC6mNndUGUMIgHaVKSEJj2Kug8qiDJGg",
  authDomain: "drone-536b2.firebaseapp.com",
  databaseURL: "https://drone-536b2-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "drone-536b2",
  storageBucket: "drone-536b2.appspot.com",
  messagingSenderId: "367375685827",
  appId: "1:367375685827:web:9f7d8c7d7e7e7e7e7e7e7e" // placeholder if not provided, but mostly databaseURL is enough for RTDB
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

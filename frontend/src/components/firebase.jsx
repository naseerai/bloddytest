// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database"; // Add this import

const firebaseConfig = {
  apiKey: "AIzaSyCxTSX9q9TC8DtpG0en7z3mbxNZWIrxi_k",
  authDomain: "my-access-aae3e.firebaseapp.com",
  projectId: "my-access-aae3e",
  storageBucket: "my-access-aae3e.firebasestorage.app",
  messagingSenderId: "721058490251",
  appId: "1:721058490251:web:c9651f83f34fd5fbe2f18e"
};


const app = initializeApp(firebaseConfig);
const db = getFirestore(app); // For Firestore (users collection)
const realtimeDb = getDatabase(app); // For Realtime Database (projects)
const auth = getAuth(app);

export { db, realtimeDb, auth };
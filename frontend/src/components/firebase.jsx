// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database"; // Add this import

const firebaseConfig = {
  apiKey: "AIzaSyAgXHgw3bH2pbGCyMrJMQnRAsTrfHvy0zg",
  authDomain: "myaccess-95907.firebaseapp.com",
  databaseURL: "https://myaccess-95907-default-rtdb.firebaseio.com",
  projectId: "myaccess-95907",
  storageBucket: "myaccess-95907.firebasestorage.app",
  messagingSenderId: "628681723345",
  appId: "1:628681723345:web:2a9adcdc67525d827b64f0"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app); // For Firestore (users collection)
const realtimeDb = getDatabase(app); // For Realtime Database (projects)
const auth = getAuth(app);

export { db, realtimeDb, auth };
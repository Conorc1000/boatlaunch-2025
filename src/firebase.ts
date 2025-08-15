// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyCjgMvefIiKOgRjTXrTiGIUPSoVHqo5fQE",
    authDomain: "boatlaunch.firebaseapp.com",
    databaseURL: "https://boatlaunch.firebaseio.com",
    projectId: "firebase-boatlaunch",
    storageBucket: "firebase-boatlaunch.appspot.com",
    messagingSenderId: "6821003494",
    appId: "1:6821003494:web:b4c72dee5872408f583b27",
    measurementId: "G-38EW5FJYXJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database
export const database = getDatabase(app);

// Initialize Firebase Authentication
export const auth = getAuth(app);

export default app;

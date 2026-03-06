import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore/lite";

const firebaseConfig = {
    apiKey: "AIzaSyCEOzvWTFtacoY070pTTDvIZNNeQqVaeFI",
    authDomain: "john-idea-6494f.firebaseapp.com",
    projectId: "john-idea-6494f",
    storageBucket: "john-idea-6494f.firebasestorage.app",
    messagingSenderId: "727987634087",
    appId: "1:727987634087:web:bd9de6d42aea40bfac8082",
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app);

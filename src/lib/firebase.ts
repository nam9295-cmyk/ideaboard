import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore/lite";

const DEFAULT_AUTH_DOMAIN = "john-idea-6494f.firebaseapp.com";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);
const resolvedAuthDomain = (() => {
    if (typeof window === "undefined") return DEFAULT_AUTH_DOMAIN;
    return LOCAL_HOSTS.has(window.location.hostname) ? DEFAULT_AUTH_DOMAIN : window.location.host;
})();

const firebaseConfig = {
    apiKey: "AIzaSyCEOzvWTFtacoY070pTTDvIZNNeQqVaeFI",
    authDomain: resolvedAuthDomain,
    projectId: "john-idea-6494f",
    storageBucket: "john-idea-6494f.firebasestorage.app",
    messagingSenderId: "727987634087",
    appId: "1:727987634087:web:bd9de6d42aea40bfac8082",
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

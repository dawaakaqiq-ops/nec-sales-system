// =========================================================
// Firebase Configuration
// firebase-config.js
// =========================================================

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
    getFirestore
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
    getAuth
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    getFunctions
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js";


// =========================================================
// بيانات مشروع Firebase
// =========================================================

const firebaseConfig = {

    apiKey:
        "AIzaSyBsKAzSYOkH2sIWnSU6T8wuPuW4Qg26bSw",

    authDomain:
        "nec-sales.firebaseapp.com",

    projectId:
        "nec-sales",

    storageBucket:
        "nec-sales.firebasestorage.app",

    messagingSenderId:
        "79843142306",

    appId:
        "1:79843142306:web:ed6078fc4ef18746c405fb"

};


// =========================================================
// تهيئة Firebase
// =========================================================

const firebaseApp =
    initializeApp(firebaseConfig);


// =========================================================
// Firestore
// =========================================================

const db =
    getFirestore(firebaseApp);


// =========================================================
// Authentication
// =========================================================

const auth =
    getAuth(firebaseApp);


// =========================================================
// Cloud Functions
// =========================================================

const functions =
    getFunctions(firebaseApp);


// =========================================================
// تصدير الخدمات
// =========================================================

export {

    firebaseApp,

    db,

    auth,

    functions

};
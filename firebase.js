// Configuração central do Firebase — usada pelo painel e pela vitrine
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDVqWjoWI8xrrBkXnYf4k4bZXeX8V24mk0",
  authDomain: "achei-c6dc8.firebaseapp.com",
  databaseURL: "https://achei-c6dc8-default-rtdb.firebaseio.com",
  projectId: "achei-c6dc8",
  storageBucket: "achei-c6dc8.firebasestorage.app",
  messagingSenderId: "886491161097",
  appId: "1:886491161097:web:fa287d59b10b68d6d34ed8"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);

// UID do usuário administrador (o mesmo usado nas regras do banco)
export const ADMIN_UID = "tmxD6UAt9WhwMmXRmX14fWccecN2";

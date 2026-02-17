import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyCXA8pqsLUjVKXr1ltz5gN7VaD-saqlF-g',
  authDomain: 'box-elite.firebaseapp.com',
  projectId: 'box-elite',
  storageBucket: 'box-elite.firebasestorage.app',
  messagingSenderId: '133574833722',
  appId: '1:133574833722:web:310d172ecb6dc3a5bae703',
}

export const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)

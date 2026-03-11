import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  orderBy,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)

// ── Cards ──────────────────────────────────────────────

export async function addCard(data) {
  const docRef = await addDoc(collection(db, 'cards'), {
    ...data,
    created_at: serverTimestamp(),
  })
  return docRef.id
}

export async function getCards() {
  const q = query(collection(db, 'cards'), orderBy('created_at', 'desc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function getCard(id) {
  const docRef = doc(db, 'cards', id)
  const snapshot = await getDoc(docRef)
  if (!snapshot.exists()) return null
  return { id: snapshot.id, ...snapshot.data() }
}

export async function updateCard(id, data) {
  const docRef = doc(db, 'cards', id)
  await updateDoc(docRef, data)
}

export async function deleteCard(id) {
  // 연결된 connections도 함께 삭제
  const connsA = await getDocs(query(collection(db, 'connections'), where('card_id_a', '==', id)))
  const connsB = await getDocs(query(collection(db, 'connections'), where('card_id_b', '==', id)))
  const deletePromises = [
    ...connsA.docs.map((d) => deleteDoc(d.ref)),
    ...connsB.docs.map((d) => deleteDoc(d.ref)),
    deleteDoc(doc(db, 'cards', id)),
  ]
  await Promise.all(deletePromises)
}

// ── Connections ────────────────────────────────────────

export async function addConnection(data) {
  const docRef = await addDoc(collection(db, 'connections'), {
    ...data,
    created_at: serverTimestamp(),
  })
  return docRef.id
}

export async function getConnections(cardId) {
  const [snapA, snapB] = await Promise.all([
    getDocs(query(collection(db, 'connections'), where('card_id_a', '==', cardId))),
    getDocs(query(collection(db, 'connections'), where('card_id_b', '==', cardId))),
  ])
  return [
    ...snapA.docs.map((d) => ({ id: d.id, ...d.data() })),
    ...snapB.docs.map((d) => ({ id: d.id, ...d.data() })),
  ]
}

export async function deleteConnection(connectionId) {
  await deleteDoc(doc(db, 'connections', connectionId))
}

export async function getAllConnections() {
  const snapshot = await getDocs(collection(db, 'connections'))
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
}

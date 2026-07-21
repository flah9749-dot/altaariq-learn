// Public Firebase Web SDK config — safe to expose in client bundles.
// The actual security boundary is the FCM service account (server-only).
export const firebaseConfig = {
  apiKey: "AIzaSyDdummy_replace_via_env_if_ever_rotated",
  authDomain: "al-tariq-education-hub.firebaseapp.com",
  projectId: "al-tariq-education-hub",
  storageBucket: "al-tariq-education-hub.firebasestorage.app",
  messagingSenderId: "34455474408",
  appId: "1:34455474408:web:d0e5a217e75f2bdedcb95d",
  measurementId: "G-5LSML7EXHX",
} as const;

export const VAPID_KEY =
  "BFyZM7qi0Y06niKfbN7EpVHCA3-QIaRW3hf0Lo80g3mh8JBM9xij4vQKhUe6jQ2WWEj0T4ayp7DQf9NWhW9PUXs";

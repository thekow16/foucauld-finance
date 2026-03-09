// ──────────────────────────────────────────────
// Système d'authentification localStorage
// ──────────────────────────────────────────────

const USERS_KEY = "ff_users";
const SESSION_KEY = "ff_session";

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "foucauld-salt-2024");
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function getUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export async function registerUser(email, password, displayName) {
  const em = email.trim().toLowerCase();
  if (!em || !password) throw new Error("Email et mot de passe requis.");
  if (password.length < 6) throw new Error("Le mot de passe doit contenir au moins 6 caractères.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) throw new Error("Adresse email invalide.");

  const users = getUsers();
  if (users[em]) throw new Error("Un compte existe déjà avec cet email.");

  const hashed = await hashPassword(password);
  const user = {
    email: em,
    displayName: displayName?.trim() || em.split("@")[0],
    passwordHash: hashed,
    createdAt: Date.now(),
  };
  users[em] = user;
  saveUsers(users);

  const session = { email: user.email, displayName: user.displayName };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function loginUser(email, password) {
  const em = email.trim().toLowerCase();
  if (!em || !password) throw new Error("Email et mot de passe requis.");

  const users = getUsers();
  const user = users[em];
  if (!user) throw new Error("Aucun compte trouvé avec cet email.");

  const hashed = await hashPassword(password);
  if (hashed !== user.passwordHash) throw new Error("Mot de passe incorrect.");

  const session = { email: user.email, displayName: user.displayName };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function logoutUser() {
  localStorage.removeItem(SESSION_KEY);
}

export function getCurrentUser() {
  try {
    const session = localStorage.getItem(SESSION_KEY);
    return session ? JSON.parse(session) : null;
  } catch {
    return null;
  }
}

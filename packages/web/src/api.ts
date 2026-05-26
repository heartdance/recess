const API_BASE = '/api';

export async function guestLogin() {
  const res = await fetch(`${API_BASE}/auth/guest`, { method: 'POST' });
  return res.json();
}

export async function getGames() {
  const res = await fetch(`${API_BASE}/games`);
  return res.json();
}

export async function getRooms(gameId: number) {
  const res = await fetch(`${API_BASE}/rooms?gameId=${gameId}`);
  return res.json();
}

export async function getMyRoom(userId: number) {
  const res = await fetch(`${API_BASE}/rooms/my-room?userId=${userId}`);
  return res.json();
}

export async function createRoom(data: { gameId: number; creatorId: number }) {
  const res = await fetch(`${API_BASE}/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function joinRoom(roomId: number, userId: number) {
  const res = await fetch(`${API_BASE}/rooms/${roomId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  return res.json();
}

export async function leaveRoom(roomId: number, userId: number) {
  const res = await fetch(`${API_BASE}/rooms/${roomId}/leave`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  return res.json();
}

export function getToken(): string | null {
  return localStorage.getItem('token');
}

export function getUser(): { id: number; nickname: string; avatarUrl?: string } | null {
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

export function setAuth(token: string, user: { id: number; nickname: string; avatarUrl?: string }) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

export async function validateUser(userId: number): Promise<{ valid: boolean; user?: { id: number; nickname: string; avatarUrl?: string } }> {
  const res = await fetch(`${API_BASE}/auth/validate?userId=${userId}`);
  return res.json();
}

export async function uploadAvatar(userId: number, file: File): Promise<{ avatarUrl?: string }> {
  const formData = new FormData();
  formData.append('userId', String(userId));
  formData.append('avatar', file);
  const res = await fetch(`${API_BASE}/auth/avatar`, {
    method: 'PATCH',
    body: formData,
  });
  return res.json();
}

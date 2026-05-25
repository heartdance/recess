import Taro from '@tarojs/taro';

const API_BASE = 'http://localhost:3000';

export async function guestLogin() {
  const res = await Taro.request({
    url: `${API_BASE}/auth/guest`,
    method: 'POST',
  });
  return res.data;
}

export async function getGames() {
  const res = await Taro.request({ url: `${API_BASE}/games` });
  return res.data;
}

export async function getRooms(gameId: number) {
  const res = await Taro.request({ url: `${API_BASE}/rooms?gameId=${gameId}` });
  return res.data;
}

export async function createRoom(data: { gameId: number; name: string; creatorId: number }) {
  const res = await Taro.request({
    url: `${API_BASE}/rooms`,
    method: 'POST',
    data,
  });
  return res.data;
}

export async function joinRoom(roomId: number, userId: number) {
  const res = await Taro.request({
    url: `${API_BASE}/rooms/${roomId}/join`,
    method: 'POST',
    data: { userId },
  });
  return res.data;
}

export function getToken(): string | null {
  return Taro.getStorageSync('token') || null;
}

export function getUser(): { id: number; nickname: string } | null {
  const raw = Taro.getStorageSync('user');
  return raw ? JSON.parse(raw) : null;
}

export function setAuth(token: string, user: { id: number; nickname: string }) {
  Taro.setStorageSync('token', token);
  Taro.setStorageSync('user', JSON.stringify(user));
}

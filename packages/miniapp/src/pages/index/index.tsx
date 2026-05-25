import { useState, useEffect } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { getGames, getRooms, createRoom, joinRoom, guestLogin, getToken, setAuth, getUser } from '../../services/api';

import './index.css';

interface GameInfo {
  id: number;
  name: string;
  slug: string;
  description: string;
}

interface RoomInfo {
  id: number;
  name: string;
  status: string;
  maxPlayers: number;
  players: Array<{
    userId: number;
    nickname: string;
    ready: boolean;
  }>;
}

export default function Index() {
  const [games, setGames] = useState<GameInfo[]>([]);
  const [selectedGame, setSelectedGame] = useState<number>(0);
  const [rooms, setRooms] = useState<RoomInfo[]>([]);

  useEffect(() => {
    if (!getToken()) {
      guestLogin().then((data) => {
        setAuth(data.token, data.user);
        loadGames();
      });
    } else {
      loadGames();
    }
  }, []);

  useEffect(() => {
    if (selectedGame) loadRooms(selectedGame);
  }, [selectedGame]);

  async function loadGames() {
    const data = await getGames();
    setGames(data);
    if (data.length > 0) setSelectedGame(data[0].id);
  }

  async function loadRooms(gameId: number) {
    const data = await getRooms(gameId);
    setRooms(data);
  }

  async function handleCreateRoom() {
    const user = getUser();
    if (!user || !selectedGame) return;
    await createRoom({ gameId: selectedGame, name: `${user.nickname}的房间`, creatorId: user.id });
    loadRooms(selectedGame);
  }

  async function handleJoinRoom(roomId: number) {
    const user = getUser();
    if (!user) return;
    await joinRoom(roomId, user.id);
    Taro.navigateTo({ url: `/pages/room/index?roomId=${roomId}` });
  }

  const statusText: Record<string, string> = {
    waiting: '等待中',
    playing: '游戏中',
    finished: '已结束',
  };

  return (
    <View className="lobby">
      <View className="lobby-header">
        <Text className="lobby-title">童年游戏合集</Text>
        <Text className="lobby-user">{getUser()?.nickname || ''}</Text>
      </View>

      <View className="lobby-body">
        <ScrollView className="game-list" scrollY>
          {games.map((game) => (
            <View
              key={game.id}
              className={`game-card ${selectedGame === game.id ? 'active' : ''}`}
              onClick={() => setSelectedGame(game.id)}
            >
              <Text className="game-name">{game.name}</Text>
            </View>
          ))}
        </ScrollView>

        <View className="room-section">
          <View className="room-header">
            <Text className="room-title">房间列表</Text>
            <View className="create-btn" onClick={handleCreateRoom}>
              <Text>创建房间</Text>
            </View>
          </View>

          <ScrollView className="room-list" scrollY>
            {rooms.map((room) => (
              <View key={room.id} className="room-card" onClick={() => handleJoinRoom(room.id)}>
                <Text className="room-name">{room.name}</Text>
                <Text className="room-info">
                  {room.players?.length || 0}/{room.maxPlayers} · {statusText[room.status] || room.status}
                </Text>
              </View>
            ))}
            {rooms.length === 0 && <Text className="empty-text">暂无房间</Text>}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

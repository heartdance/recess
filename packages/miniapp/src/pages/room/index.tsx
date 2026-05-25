import { useState, useEffect } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/core';
import Board from '../../components/Board';
import { getUser } from '../../services/api';
import { socketService } from '../../services/socket';

import './index.css';

export default function Room() {
  const [roomId, setRoomId] = useState<number>(0);
  const [phase, setPhase] = useState<string>('waiting');
  const [players, setPlayers] = useState<any[]>([]);
  const [myBoard, setMyBoard] = useState<string[][]>([]);
  const [opponentBoard, setOpponentBoard] = useState<string[][]>([]);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [winnerId, setWinnerId] = useState<number | null>(null);
  const [amIReady, setAmIReady] = useState(false);
  const user = getUser();

  useEffect(() => {
    const params = Taro.getCurrentInstance().router?.params;
    if (params?.roomId) {
      const rid = Number(params.roomId);
      setRoomId(rid);
      socketService.emit('room:join', { roomId: rid });
    }

    socketService.on('room:update', (data) => {
      setPlayers(data.players);
    });

    socketService.on('game:state', (data) => {
      setPhase(data.phase);
      if (data.myBoard) setMyBoard(data.myBoard);
      if (data.opponentBoard) setOpponentBoard(data.opponentBoard);
      setIsMyTurn(data.currentTurnUserId === user?.id);
      setWinnerId(data.winnerUserId);
    });

    socketService.on('game:turn', (data) => {
      setIsMyTurn(data.userId === user?.id);
    });

    socketService.on('game:attack-result', (data) => {
      if (data.attackerUserId === user?.id) {
        setOpponentBoard((prev) => {
          const next = prev.map((row) => [...row]);
          next[data.position.row][data.position.col] = data.result;
          return next;
        });
      }
    });

    socketService.on('game:over', (data) => {
      setPhase('finished');
      setWinnerId(data.winnerUserId);
    });

    return () => {
      socketService.off('room:update');
      socketService.off('game:state');
      socketService.off('game:turn');
      socketService.off('game:attack-result');
      socketService.off('game:over');
    };
  }, []);

  const handleReady = () => {
    socketService.emit('game:ready', { roomId, userId: user?.id });
    setAmIReady(true);
  };

  const handleAttack = (row: number, col: number) => {
    if (!isMyTurn || phase !== 'playing') return;
    socketService.emit('game:attack', { roomId, userId: user?.id, position: { row, col } });
  };

  if (!myBoard.length) {
    return (
      <View className="room-waiting">
        <Text className="room-title">房间 {roomId}</Text>
        {players.map((p) => (
          <View key={p.userId} className="player-row">
            <Text>{p.nickname}</Text>
            <Text className={p.ready ? 'ready-tag' : 'not-ready-tag'}>
              {p.ready ? '已准备' : '未准备'}
            </Text>
          </View>
        ))}
        <View className="ready-btn" onClick={handleReady}>
          <Text>{amIReady ? '已准备，等待对手...' : '准备'}</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="room-game">
      <View className="game-header">
        <Text className="phase-tag">{phase === 'placing' ? '部署' : phase === 'playing' ? '对战' : '结束'}</Text>
        {phase === 'playing' && (
          <Text className={isMyTurn ? 'my-turn' : 'opponent-turn'}>
            {isMyTurn ? '你的回合' : '对手回合'}
          </Text>
        )}
      </View>

      <View className="boards">
        <View className="board-section">
          <Text className="board-label">我的棋盘</Text>
          <Board board={myBoard} onClick={() => {}} />
        </View>
        <View className="board-section">
          <Text className="board-label">对手棋盘</Text>
          <Board board={opponentBoard} onClick={handleAttack} />
        </View>
      </View>
    </View>
  );
}

import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Typography, Tag, message } from 'antd';
import { useSocket } from '../hooks/useSocket';
import { getUser, leaveRoom } from '../api';
import Board from '../components/Board';
import Avatar from '../components/Avatar';

const { Text } = Typography;

type GamePhase = 'waiting' | 'placing' | 'playing' | 'finished';
type CellState = 'empty' | 'body' | 'head';
type CellView = 'unknown' | 'miss' | 'hit' | 'headshot';
type Direction = 'up' | 'down' | 'left' | 'right';

interface RoomPlayer {
  userId: number;
  nickname: string;
  avatarUrl: string | null;
  ready: boolean;
  seatIndex: number;
}

interface PlanePlacement {
  head: { row: number; col: number };
  direction: Direction;
}

const PLANE_OFFSETS: Record<Direction, Array<{ dr: number; dc: number }>> = {
  up: [
    { dr: 0, dc: 0 }, { dr: 1, dc: -2 }, { dr: 1, dc: -1 }, { dr: 1, dc: 0 },
    { dr: 1, dc: 1 }, { dr: 1, dc: 2 }, { dr: 2, dc: 0 }, { dr: 3, dc: 0 },
    { dr: 4, dc: -1 }, { dr: 4, dc: 0 }, { dr: 4, dc: 1 },
  ],
  down: [
    { dr: 0, dc: 0 }, { dr: -1, dc: -2 }, { dr: -1, dc: -1 }, { dr: -1, dc: 0 },
    { dr: -1, dc: 1 }, { dr: -1, dc: 2 }, { dr: -2, dc: 0 }, { dr: -3, dc: 0 },
    { dr: -4, dc: -1 }, { dr: -4, dc: 0 }, { dr: -4, dc: 1 },
  ],
  left: [
    { dr: 0, dc: 0 }, { dr: -2, dc: -1 }, { dr: -1, dc: -1 }, { dr: 0, dc: -1 },
    { dr: 1, dc: -1 }, { dr: 2, dc: -1 }, { dr: 0, dc: -2 }, { dr: 0, dc: -3 },
    { dr: -1, dc: -4 }, { dr: 0, dc: -4 }, { dr: 1, dc: -4 },
  ],
  right: [
    { dr: 0, dc: 0 }, { dr: -2, dc: 1 }, { dr: -1, dc: 1 }, { dr: 0, dc: 1 },
    { dr: 1, dc: 1 }, { dr: 2, dc: 1 }, { dr: 0, dc: 2 }, { dr: 0, dc: 3 },
    { dr: -1, dc: 4 }, { dr: 0, dc: 4 }, { dr: 1, dc: 4 },
  ],
};

function getPlaneCells(head: { row: number; col: number }, direction: Direction) {
  return PLANE_OFFSETS[direction].map((o) => ({ row: head.row + o.dr, col: head.col + o.dc }));
}

function isInBounds(cells: Array<{ row: number; col: number }>) {
  return cells.every((c) => c.row >= 0 && c.row < 10 && c.col >= 0 && c.col < 10);
}

const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right'];

function generateRandomPlanes(count: number): PlanePlacement[] {
  const maxAttempts = 1000;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const planes: PlanePlacement[] = [];
    const occupied = new Set<string>();
    let valid = true;
    for (let i = 0; i < count; i++) {
      let placed = false;
      for (let j = 0; j < 200; j++) {
        const head = { row: Math.floor(Math.random() * 10), col: Math.floor(Math.random() * 10) };
        const direction = DIRECTIONS[Math.floor(Math.random() * 4)];
        const cells = getPlaneCells(head, direction);
        if (!isInBounds(cells)) continue;
        if (cells.some((c) => occupied.has(`${c.row},${c.col}`))) continue;
        planes.push({ head, direction });
        for (const c of cells) occupied.add(`${c.row},${c.col}`);
        placed = true;
        break;
      }
      if (!placed) { valid = false; break; }
    }
    if (valid) return planes;
  }
  return [];
}

function buildPreviewBoard(planes: PlanePlacement[]): CellState[][] {
  const board: CellState[][] = Array.from({ length: 10 }, () => Array<CellState>(10).fill('empty'));
  for (const plane of planes) {
    const cells = getPlaneCells(plane.head, plane.direction);
    for (const cell of cells) {
      if (cell.row === plane.head.row && cell.col === plane.head.col) {
        board[cell.row][cell.col] = 'head';
      } else {
        board[cell.row][cell.col] = 'body';
      }
    }
  }
  return board;
}

function createEmptyBoard(): CellView[][] {
  return Array.from({ length: 10 }, () => Array<CellView>(10).fill('unknown'));
}

function PlayerStatusBar({
  player,
  isMe,
  isCreator,
  phase,
  ready,
  planeCount,
  planesConfirmed,
  destroyedPlanes,
  isWinner,
  isFinished,
  playAgainReady,
  onKick,
}: {
  player: RoomPlayer | null;
  isMe: boolean;
  isCreator: boolean;
  phase: GamePhase;
  ready: boolean;
  planeCount: number;
  planesConfirmed: boolean;
  destroyedPlanes: number;
  isWinner: boolean | null;
  isFinished: boolean;
  playAgainReady?: boolean;
  onKick?: () => void;
}) {
  if (!player) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#fafafa', borderRadius: 8, marginBottom: 4, minHeight: 44 }}>
        <Text type="secondary">等待玩家加入...</Text>
      </div>
    );
  }

  // Reusable mini-tag style for consistent sizing
  const miniTag = {
    fontSize: 11,
    lineHeight: '16px',
    padding: '0 5px',
    borderRadius: 3,
    verticalAlign: 'middle' as const,
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: '#fafafa', borderRadius: 8, marginBottom: 4 }}>
      <Avatar avatarUrl={player.avatarUrl} size={28} />
      <Text strong={isMe} style={{ fontSize: 13 }}>{player.nickname}</Text>
      {isMe && <Tag color="blue" style={miniTag}>我</Tag>}
      {isCreator && <Tag color="gold" style={miniTag}>房主</Tag>}

      {phase === 'waiting' && (
        <Tag color={ready ? 'green' : 'default'} style={miniTag}>{ready ? '已准备' : '未准备'}</Tag>
      )}
      {phase === 'placing' && (
        planesConfirmed
          ? <Tag color="green" style={miniTag}>部署完成</Tag>
          : <Tag color="orange" style={miniTag}>已放置 {planeCount}/3 架</Tag>
      )}
      {(phase === 'playing' || isFinished) && (
        <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {[0, 1, 2].map((i) => {
            const destroyed = i < destroyedPlanes;
            return (
              <span key={i} style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 22,
                height: 22,
                fontSize: 16,
                lineHeight: 1,
                transition: 'all 0.3s',
              }}>
                <span style={{
                  opacity: destroyed ? 0.25 : 1,
                  color: destroyed ? '#999' : '#1677ff',
                  textShadow: destroyed ? 'none' : '0 1px 2px rgba(22,119,255,0.3)',
                }}>✈</span>
                {destroyed && (
                  <span style={{
                    position: 'absolute',
                    color: '#ff4d4f',
                    fontSize: 14,
                    fontWeight: 'bold',
                    lineHeight: 1,
                    textShadow: '0 1px 1px rgba(0,0,0,0.2)',
                  }}>✕</span>
                )}
              </span>
            );
          })}
        </div>
      )}
      {isFinished && (
        <Tag color={isWinner ? 'green' : 'red'} style={miniTag}>{isWinner ? '胜利' : '失败'}</Tag>
      )}
      {isFinished && playAgainReady && (
        <Tag color="green" style={miniTag}>已准备</Tag>
      )}

      {onKick && phase === 'waiting' && (
        <Button size="small" danger onClick={onKick} style={{ marginLeft: 'auto', fontSize: 11, padding: '0 6px', height: 20 }}>踢出</Button>
      )}
    </div>
  );
}

export default function Room() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const user = getUser();

  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [roomName, setRoomName] = useState('');
  const [creatorId, setCreatorId] = useState<number | null>(null);
  const [phase, setPhase] = useState<GamePhase>('waiting');
  const [myBoard, setMyBoard] = useState<CellState[][]>([]);
  const [opponentBoard, setOpponentBoard] = useState<CellView[][]>([]);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [winnerId, setWinnerId] = useState<number | null>(null);
  const [amIReady, setAmIReady] = useState(false);
  const [myDestroyedPlanes, setMyDestroyedPlanes] = useState(0);
  const [opponentDestroyedPlanes, setOpponentDestroyedPlanes] = useState(0);

  const [planes, setPlanes] = useState<PlanePlacement[]>([]);
  const [currentDirection, setCurrentDirection] = useState<Direction>('up');
  const [hoverPos, setHoverPos] = useState<{ row: number; col: number } | null>(null);
  const [planesConfirmed, setPlanesConfirmed] = useState(false);
  const [playAgainPending, setPlayAgainPending] = useState(false);
  const [opponentWantsPlayAgain, setOpponentWantsPlayAgain] = useState(false);

  const canPlace = phase === 'placing';

  const opponent = players.find((p) => p.userId !== user?.id);
  const me = players.find((p) => p.userId === user?.id);

  const hoverCells = useCallback(() => {
    if (!canPlace || planes.length >= 3 || !hoverPos) return undefined;
    const cells = getPlaneCells(hoverPos, currentDirection);
    const inBounds = isInBounds(cells);
    const occupied = new Set<string>();
    for (const p of planes) {
      for (const c of getPlaneCells(p.head, p.direction)) {
        occupied.add(`${c.row},${c.col}`);
      }
    }
    const valid = inBounds && !cells.some((c) => occupied.has(`${c.row},${c.col}`));
    return cells.map((c) => ({
      row: c.row,
      col: c.col,
      type: (c.row === hoverPos.row && c.col === hoverPos.col) ? 'head' as const : 'body' as const,
      valid,
    }));
  }, [canPlace, planes, hoverPos, currentDirection]);

  const handleHover = useCallback((row: number | null, col: number | null) => {
    if (row !== null && col !== null) {
      setHoverPos({ row, col });
    } else {
      setHoverPos(null);
    }
  }, []);

  useEffect(() => {
    if (!socket || !id) return;

    socket.emit('room:join', { roomId: Number(id), userId: user?.id });

    socket.on('room:update', (data) => {
      setPlayers(data.players);
      if (data.name) setRoomName(data.name);
      if (data.creatorId) setCreatorId(data.creatorId);
      if (data.status === 'playing') {
        setPhase('placing');
      }
    });

    socket.on('game:state', (data) => {
      if (data.phase === 'waiting') {
        setPhase('waiting');
        setIsMyTurn(false);
        setWinnerId(null);
        setPlanesConfirmed(false);
        setAmIReady(false);
        setPlanes([]);
        setMyDestroyedPlanes(0);
        setOpponentDestroyedPlanes(0);
        setPlayAgainPending(false);
        setOpponentWantsPlayAgain(false);
        setHoverPos(null);
        setCurrentDirection('up');
        setOpponentBoard([]);
        setMyBoard([]);
        return;
      }
      if (data.phase === 'placing') {
        setPlayAgainPending(false);
        setOpponentWantsPlayAgain(false);
        setMyDestroyedPlanes(0);
        setOpponentDestroyedPlanes(0);
        setWinnerId(null);
        setPlanesConfirmed(false);
        setPlanes([]);
        setHoverPos(null);
        setCurrentDirection('up');
        setOpponentBoard([]);
      }
      setPhase(data.phase);
      if (data.phase === 'placing') {
        if (data.myBoard) setMyBoard(data.myBoard);
      } else {
        if (data.myBoard) setMyBoard(data.myBoard);
      }
      if (data.opponentBoard) setOpponentBoard(data.opponentBoard);
      setIsMyTurn(data.currentTurnUserId === user?.id);
      setWinnerId(data.winnerUserId);
    });

    socket.on('game:turn', (data) => {
      setIsMyTurn(data.userId === user?.id);
    });

    socket.on('game:attack-result', (data) => {
      const isAttacker = data.attackerUserId === user?.id;
      if (isAttacker) {
        setOpponentBoard((prev) => {
          const next = prev.map((row) => [...row]);
          next[data.position.row][data.position.col] = data.result;
          return next;
        });
      }
      if (data.destroyedPlanes) {
        setMyDestroyedPlanes(isAttacker ? data.destroyedPlanes.defender : data.destroyedPlanes.attacker);
        setOpponentDestroyedPlanes(isAttacker ? data.destroyedPlanes.attacker : data.destroyedPlanes.defender);
      }
    });

    socket.on('game:over', (data) => {
      setPhase('finished');
      setWinnerId(data.winnerUserId);
    });

    socket.on('game:play-again-pending', () => {
      setPlayAgainPending(true);
    });

    socket.on('game:play-again-voted', () => {
      setOpponentWantsPlayAgain(true);
    });

    socket.on('error', (data) => {
      message.error(data.message);
    });

    socket.on('kicked', () => {
      message.warning('你已被房主踢出房间');
      navigate('/');
    });

    return () => {
      socket.off('room:update');
      socket.off('game:state');
      socket.off('game:turn');
      socket.off('game:attack-result');
      socket.off('game:over');
      socket.off('game:play-again-pending');
      socket.off('game:play-again-voted');
      socket.off('error');
      socket.off('kicked');
    };
  }, [socket, id]);

  const handleRotate = useCallback(() => {
    const dirs: Direction[] = ['up', 'right', 'down', 'left'];
    const idx = dirs.indexOf(currentDirection);
    setCurrentDirection(dirs[(idx + 1) % 4]);
  }, [currentDirection]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!canPlace || planesConfirmed) return;
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleRotate();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canPlace, planesConfirmed, handleRotate]);

  const handleReady = useCallback(() => {
    if (!socket || !id || amIReady) return;
    socket.emit('game:ready', { roomId: Number(id), userId: user?.id });
    setAmIReady(true);
  }, [socket, id, user, amIReady]);

  const handlePlaceCell = useCallback((row: number, col: number) => {
    if (!canPlace || planes.length >= 3) return;

    const newPlane: PlanePlacement = { head: { row, col }, direction: currentDirection };
    const cells = getPlaneCells(newPlane.head, newPlane.direction);
    if (!isInBounds(cells)) {
      message.warning('飞机超出棋盘范围');
      return;
    }

    const occupied = new Set<string>();
    for (const p of planes) {
      for (const c of getPlaneCells(p.head, p.direction)) {
        occupied.add(`${c.row},${c.col}`);
      }
    }
    if (cells.some((c) => occupied.has(`${c.row},${c.col}`))) {
      message.warning('飞机与已放置的飞机重叠');
      return;
    }

    const newPlanes = [...planes, newPlane];
    setPlanes(newPlanes);
    setMyBoard(buildPreviewBoard(newPlanes));
  }, [canPlace, planes, currentDirection]);

  const handleUndoPlane = useCallback(() => {
    if (planes.length === 0) return;
    const newPlanes = planes.slice(0, -1);
    setPlanes(newPlanes);
    setMyBoard(buildPreviewBoard(newPlanes));
  }, [planes]);

  const handleRandomPlace = useCallback(() => {
    if (!canPlace || planesConfirmed) return;
    const randomPlanes = generateRandomPlanes(3);
    setPlanes(randomPlanes);
    setMyBoard(buildPreviewBoard(randomPlanes));
  }, [canPlace, planesConfirmed]);

  const handleConfirmPlanes = useCallback(() => {
    if (!socket || !id || planes.length !== 3 || planesConfirmed) return;
    socket.emit('game:place-planes', {
      roomId: Number(id),
      userId: user?.id,
      planes,
    });
    setPlanesConfirmed(true);
  }, [socket, id, planes, user, planesConfirmed]);

  const handleAttack = useCallback((row: number, col: number) => {
    if (!socket || !id || !isMyTurn || phase !== 'playing') return;
    socket.emit('game:attack', {
      roomId: Number(id),
      userId: user?.id,
      position: { row, col },
    });
  }, [socket, id, isMyTurn, phase, user]);

  const goBackToLobby = useCallback(async () => {
    if (id && user) {
      try { await leaveRoom(Number(id), user.id); } catch { /* ignore */ }
    }
    navigate('/');
  }, [id, user, navigate]);

  const handlePlayAgain = useCallback(() => {
    if (!socket || !id || !user) return;
    socket.emit('game:play-again', { roomId: Number(id), userId: user.id });
    setPlayAgainPending(true);
  }, [socket, id, user]);

  const displayMyBoard = phase === 'waiting' && planes.length === 0 && myBoard.length === 0
    ? Array.from({ length: 10 }, () => Array(10).fill('empty'))
    : planes.length > 0 ? myBoard
    : myBoard.length > 0 ? myBoard
    : Array.from({ length: 10 }, () => Array(10).fill('empty'));

  const displayOpponentBoard = phase === 'playing' || phase === 'finished'
    ? (opponentBoard.length > 0 ? opponentBoard : createEmptyBoard())
    : createEmptyBoard();

  const isFinished = phase === 'finished';
  const opponentReady = opponent?.ready ?? false;

  return (
    <div style={{ minHeight: '100vh', padding: '16px 24px', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button onClick={goBackToLobby}>返回大厅</Button>
          <span style={{ fontSize: 18, fontWeight: 600 }}>炸飞机 - 房间 {roomName || id}</span>
        </div>
        {phase === 'playing' && (
          <Tag color={isMyTurn ? 'green' : 'red'} style={{ fontSize: 14, padding: '4px 12px' }}>
            {isMyTurn ? '你的回合 - 点击对方棋盘攻击' : '对手回合'}
          </Tag>
        )}
      </div>

      {/* Two boards side by side */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 32, flex: 1 }}>
        {/* Left: My board */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <PlayerStatusBar
            player={me || null}
            isMe={true}
            isCreator={creatorId === user?.id}
            phase={phase}
            ready={amIReady}
            planeCount={planes.length}
            planesConfirmed={planesConfirmed}
            destroyedPlanes={myDestroyedPlanes}
            isWinner={winnerId === user?.id}
            isFinished={isFinished}
            playAgainReady={playAgainPending}
          />
          <Board
            board={displayMyBoard}
            onClick={canPlace && !planesConfirmed ? handlePlaceCell : () => {}}
            onHover={canPlace && !planesConfirmed ? handleHover : undefined}
            hoverCells={canPlace && !planesConfirmed ? hoverCells() : undefined}
            isOwnBoard={true}
            disabled={!canPlace || planesConfirmed}
          />
        </div>

        {/* Right: Opponent board */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <PlayerStatusBar
            player={opponent || null}
            isMe={false}
            isCreator={creatorId === opponent?.userId}
            phase={phase}
            ready={opponentReady}
            planeCount={0}
            planesConfirmed={false}
            destroyedPlanes={opponentDestroyedPlanes}
            isWinner={winnerId !== null && winnerId !== user?.id}
            isFinished={isFinished}
            playAgainReady={opponentWantsPlayAgain}
            onKick={creatorId === user?.id && opponent ? () => {
              socket?.emit('room:kick', { roomId: Number(id), creatorUserId: user?.id, targetUserId: opponent.userId });
            } : undefined}
          />
          <Board
            board={displayOpponentBoard}
            onClick={phase === 'playing' && isMyTurn ? handleAttack : () => {}}
            isOwnBoard={false}
            disabled={phase !== 'playing' || !isMyTurn}
          />
        </div>
      </div>

      {/* Action bar */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
        {phase === 'waiting' && !amIReady && (
          <Button type="primary" size="large" onClick={handleReady}>准备</Button>
        )}
        {phase === 'waiting' && amIReady && (
          <span style={{ color: '#999', fontSize: 14 }}>已准备，等待对手...</span>
        )}
        {canPlace && !planesConfirmed && (
          <>
            <Button onClick={handleRotate}>旋转方向 (R)</Button>
            <Button onClick={handleUndoPlane} disabled={planes.length === 0}>撤销上一架</Button>
            <Button onClick={handleRandomPlace}>随机放置</Button>
            <Button
              type="primary"
              onClick={handleConfirmPlanes}
              disabled={planes.length !== 3}
              size="large"
            >
              {planes.length < 3 ? `还需放置 ${3 - planes.length} 架` : '确认部署'}
            </Button>
          </>
        )}
        {canPlace && planesConfirmed && (
          <span style={{ color: '#52c41a', fontSize: 14, fontWeight: 500 }}>部署完成，等待对手...</span>
        )}
        {isFinished && !playAgainPending && (
          <>
            <Button type="primary" size="large" onClick={handlePlayAgain}>再来一局</Button>
            <Button size="large" onClick={goBackToLobby}>返回大厅</Button>
          </>
        )}
        {isFinished && playAgainPending && (
          <Button size="large" onClick={goBackToLobby}>返回大厅</Button>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 12, fontSize: 12, color: '#666', flexWrap: 'wrap' }}>
        <span><b style={{ color: '#ff4d4f' }}>★ 机头</b></span>
        <span><b style={{ color: '#1677ff' }}>■ 机身</b></span>
        <span><b style={{ color: '#95de64' }}>○ 空</b></span>
        <span><b style={{ color: '#d48806' }}>× 伤</b></span>
        <span><b style={{ color: '#ff4d4f' }}>✈ 落</b></span>
      </div>
    </div>
  );
}

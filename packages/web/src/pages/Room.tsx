import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout, Button, Typography, Card, Row, Col, Tag, message, Space, Divider } from 'antd';
import { useSocket } from '../hooks/useSocket';
import { getUser, leaveRoom } from '../api';
import Board from '../components/Board';

const { Title, Text } = Typography;

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

// Plane shape offsets from head (direction = 'up')
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

export default function Room() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const user = getUser();

  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [phase, setPhase] = useState<GamePhase>('waiting');
  const [myBoard, setMyBoard] = useState<CellState[][]>([]);
  const [opponentBoard, setOpponentBoard] = useState<CellView[][]>([]);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [winnerId, setWinnerId] = useState<number | null>(null);
  const [amIReady, setAmIReady] = useState(false);

  // Plane placement state
  const [planes, setPlanes] = useState<PlanePlacement[]>([]);
  const [currentDirection, setCurrentDirection] = useState<Direction>('up');
  const [hoverPos, setHoverPos] = useState<{ row: number; col: number } | null>(null);
  const [planesConfirmed, setPlanesConfirmed] = useState(false);

  const canPlace = phase === 'placing';

  // Compute hover preview cells for plane placement
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
      if (data.status === 'playing' && phase === 'waiting') {
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
        return;
      }
      setPhase(data.phase);
      if (data.phase === 'placing') {
        // Never overwrite board/planes if player already placed some
        if (planes.length === 0 && data.myBoard) {
          setMyBoard(data.myBoard);
        }
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
      if (data.attackerUserId === user?.id) {
        setOpponentBoard((prev) => {
          const next = prev.map((row) => [...row]);
          next[data.position.row][data.position.col] = data.result;
          return next;
        });
      }
    });

    socket.on('game:over', (data) => {
      setPhase('finished');
      setWinnerId(data.winnerUserId);
    });

    socket.on('error', (data) => {
      message.error(data.message);
    });

    return () => {
      socket.off('room:update');
      socket.off('game:state');
      socket.off('game:turn');
      socket.off('game:attack-result');
      socket.off('game:over');
      socket.off('error');
    };
  }, [socket, id]);

  const handleRotate = useCallback(() => {
    const dirs: Direction[] = ['up', 'right', 'down', 'left'];
    const idx = dirs.indexOf(currentDirection);
    setCurrentDirection(dirs[(idx + 1) % 4]);
  }, [currentDirection]);

  // Keyboard shortcuts for placing phase
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
    if (!socket || !id) return;
    socket.emit('game:play-again', { roomId: Number(id) });
    setAmIReady(false);
    setPlanes([]);
    setHoverPos(null);
    setCurrentDirection('up');
    setPlanesConfirmed(false);
  }, [socket, id]);

  // Playing / Finished phase
  if (phase === 'playing' || phase === 'finished') {
    return (
      <Layout style={{ minHeight: '100vh', padding: 24 }}>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Title level={3}>
              炸飞机 - 房间 {id}
              <Tag color={phase === 'playing' ? 'blue' : 'default'} style={{ marginLeft: 8 }}>
                {phase === 'playing' ? '对战阶段' : '已结束'}
              </Tag>
            </Title>
          </Col>
          <Col>
            <Space>
              {phase === 'playing' && (
                <Tag color={isMyTurn ? 'green' : 'red'}>
                  {isMyTurn ? '你的回合 - 点击对方棋盘攻击' : '对手回合'}
                </Tag>
              )}
              {phase === 'finished' && (
                <>
                  <Tag color={winnerId === user?.id ? 'green' : 'red'}>
                    {winnerId === user?.id ? '你赢了！' : '你输了'}
                  </Tag>
                  <Button type="primary" onClick={handlePlayAgain}>再来一局</Button>
                </>
              )}
              <Button onClick={goBackToLobby}>返回大厅</Button>
            </Space>
          </Col>
        </Row>

        <Row gutter={24} justify="center">
          <Col xs={24} md={11}>
            <Card title="我的棋盘" size="small">
              <Board board={myBoard} onClick={() => {}} isOwnBoard />
            </Card>
          </Col>
          <Col xs={24} md={11}>
            <Card title="对手棋盘（点击攻击）" size="small">
              <Board
                board={opponentBoard}
                onClick={handleAttack}
                isOwnBoard={false}
                disabled={phase !== 'playing' || !isMyTurn}
              />
            </Card>
            <div style={{ marginTop: 8, display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: '#666' }}>
              <span><b style={{ color: '#95de64' }}>○ 空</b></span>
              <span><b style={{ color: '#d48806' }}>× 伤</b></span>
              <span><b style={{ color: '#ff4d4f' }}>✈ 落</b></span>
              <span><b>★ 机头</b></span>
              <span><b style={{ color: '#1677ff' }}>■ 机身</b></span>
            </div>
          </Col>
        </Row>
      </Layout>
    );
  }

  // Waiting + Placing phase (combined)
  const hasPreviousGame = phase === 'waiting' && myBoard.length > 0 && planes.length === 0;
  const previewBoard = hasPreviousGame ? myBoard
    : planes.length > 0 ? myBoard
    : Array.from({ length: 10 }, () => Array(10).fill('empty'));
  const showReadyButton = phase === 'waiting' && !amIReady;

  return (
    <Layout style={{ minHeight: '100vh', padding: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={3}>
            炸飞机 - 房间 {id}
            {phase === 'placing' && (
              <Tag color="orange" style={{ marginLeft: 8 }}>部署阶段</Tag>
            )}
            {hasPreviousGame && winnerId !== null && (
              <Tag color={winnerId === user?.id ? 'green' : 'red'} style={{ marginLeft: 8 }}>
                {winnerId === user?.id ? '上局你赢了！' : '上局你输了'}
              </Tag>
            )}
          </Title>
        </Col>
        <Col>
          <Space>
            {canPlace && (
              <>
                <Tag>已放置 {planes.length}/3 架</Tag>
                <Tag>朝向: {currentDirection === 'up' ? '↑' : currentDirection === 'down' ? '↓' : currentDirection === 'left' ? '←' : '→'}</Tag>
              </>
            )}
            <Button onClick={goBackToLobby}>返回大厅</Button>
          </Space>
        </Col>
      </Row>

      <Row gutter={24}>
        <Col>
          <Card
            title={hasPreviousGame ? '上局棋盘' : planesConfirmed ? '部署完成 - 你的飞机布局' : canPlace ? '点击棋盘放置飞机' : amIReady ? '已准备，等待对手...' : '先点击右侧「准备」按钮'}
            size="small"
          >
            <Board
              board={previewBoard}
              onClick={canPlace && !planesConfirmed ? handlePlaceCell : () => {}}
              onHover={canPlace && !planesConfirmed ? handleHover : undefined}
              hoverCells={canPlace && !planesConfirmed ? hoverCells() : undefined}
              isOwnBoard={hasPreviousGame || planesConfirmed}
              disabled={!canPlace || planesConfirmed}
            />
          </Card>
        </Col>
        <Col>
          <Space direction="vertical" size="middle">
            {/* Player list */}
            <Card size="small" title="玩家" style={{ maxWidth: 220 }}>
              {players.map((p) => (
                <div key={p.userId} style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text>{p.nickname}</Text>
                  <Tag color={p.ready ? 'green' : 'default'}>
                    {p.ready ? '已准备' : '未准备'}
                  </Tag>
                </div>
              ))}
              {players.length < 2 && (
                <Text type="secondary">等待其他玩家加入...</Text>
              )}
            </Card>

            {/* Ready button (only when not ready yet) */}
            {showReadyButton && (
              <Button type="primary" size="large" block onClick={handleReady}>
                准备
              </Button>
            )}
            {phase === 'waiting' && amIReady && (
              <Card size="small" style={{ maxWidth: 220, textAlign: 'center' }}>
                <Text type="secondary">已准备，等待对手...</Text>
              </Card>
            )}

            {/* Placement controls */}
            {canPlace && !planesConfirmed && (
              <>
                <Divider style={{ margin: '4px 0' }} />
                <Button onClick={handleRotate} block>旋转方向 (R)</Button>
                <Button onClick={handleUndoPlane} disabled={planes.length === 0} block>撤销上一架</Button>
                <Button onClick={handleRandomPlace} block>随机放置</Button>
                <Button
                  type="primary"
                  onClick={handleConfirmPlanes}
                  disabled={planes.length !== 3}
                  block
                  size="large"
                >
                  {planes.length < 3 ? `还需放置 ${3 - planes.length} 架` : '确认部署'}
                </Button>
              </>
            )}
            {planesConfirmed && (
              <Card size="small" style={{ maxWidth: 220, textAlign: 'center' }}>
                <Title level={4} style={{ color: '#52c41a', marginBottom: 8 }}>部署完成!</Title>
                <Text type="secondary">等待对手完成部署...</Text>
              </Card>
            )}

            {/* Legend */}
            <Card size="small" title="图标说明" style={{ maxWidth: 220 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                <div><span style={{ display: 'inline-block', width: 18, height: 18, backgroundColor: '#ff4d4f', borderRadius: 2, textAlign: 'center', color: '#fff', fontWeight: 'bold', marginRight: 6 }}>★</span> 机头（被命中即击落）</div>
                <div><span style={{ display: 'inline-block', width: 18, height: 18, backgroundColor: '#1677ff', borderRadius: 2, textAlign: 'center', color: '#fff', fontWeight: 'bold', marginRight: 6 }}>■</span> 机身</div>
                <div><span style={{ display: 'inline-block', width: 18, height: 18, backgroundColor: '#95de64', borderRadius: 2, textAlign: 'center', color: '#389e0d', fontWeight: 'bold', marginRight: 6 }}>○</span> 攻击未命中（空）</div>
                <div><span style={{ display: 'inline-block', width: 18, height: 18, backgroundColor: '#ffec3d', borderRadius: 2, textAlign: 'center', fontWeight: 'bold', marginRight: 6 }}>×</span> 命中机身（伤）</div>
                <div><span style={{ display: 'inline-block', width: 18, height: 18, backgroundColor: '#ff4d4f', borderRadius: 2, textAlign: 'center', color: '#fff', fontWeight: 'bold', marginRight: 6 }}>✈</span> 命中机头（击落）</div>
                <div><span style={{ display: 'inline-block', width: 18, height: 18, backgroundColor: '#d9d9d9', borderRadius: 2, textAlign: 'center', fontWeight: 'bold', marginRight: 6, fontSize: 10 }}>?</span> 未探索区域</div>
              </div>
            </Card>
          </Space>
        </Col>
      </Row>
    </Layout>
  );
}

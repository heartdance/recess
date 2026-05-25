import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout, Card, Table, Button, Modal, Input, Form, Tag, Typography, Row, Col, message } from 'antd';
import { getGames, getRooms, createRoom, joinRoom, guestLogin, getToken, setAuth, getUser, getMyRoom } from '../api';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;

interface GameInfo {
  id: number;
  name: string;
  slug: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  iconUrl: string | null;
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
    seatIndex: number;
  }>;
}

export default function Lobby() {
  const navigate = useNavigate();
  const [games, setGames] = useState<GameInfo[]>([]);
  const [selectedGame, setSelectedGame] = useState<number | null>(null);
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    async function init() {
      if (!getToken()) {
        const data = await guestLogin();
        setAuth(data.token, data.user);
      }
      const user = getUser();

      // Check if user is already in a room (for page refresh auto-redirect)
      if (user) {
        try {
          const myRoom = await getMyRoom(user.id);
          if (myRoom.roomId && myRoom.status === 'waiting') {
            navigate(`/room/${myRoom.roomId}`, { replace: true });
            return;
          }
        } catch { /* ignore */ }
      }

      loadGames();
    }
    init();
  }, []);

  // Refresh rooms when page gains focus (returning from room)
  useEffect(() => {
    const onFocus = () => { if (selectedGame) loadRooms(selectedGame); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [selectedGame]);

  useEffect(() => {
    if (selectedGame) {
      loadRooms(selectedGame);
    }
  }, [selectedGame]);

  async function loadGames() {
    const data = await getGames();
    setGames(data);
    if (data.length > 0 && !selectedGame) {
      setSelectedGame(data[0].id);
    }
  }

  const loadRooms = useCallback(async (gameId: number) => {
    const data = await getRooms(gameId);
    setRooms(data);
  }, []);

  async function handleCreateRoom(values: { name: string }) {
    const user = getUser();
    if (!user || !selectedGame) return;
    const room = await createRoom({ gameId: selectedGame, name: values.name, creatorId: user.id });
    setCreateModalOpen(false);
    form.resetFields();
    navigate(`/room/${room.id}`);
  }

  async function handleJoinRoom(roomId: number) {
    const user = getUser();
    if (!user) return;
    await joinRoom(roomId, user.id);
    navigate(`/room/${roomId}`);
  }

  const statusMap: Record<string, { color: string; text: string }> = {
    waiting: { color: 'green', text: '等待中' },
    playing: { color: 'blue', text: '游戏中' },
    finished: { color: 'default', text: '已结束' },
  };

  const columns = [
    {
      title: '房间名',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '人数',
      key: 'players',
      render: (_: unknown, record: RoomInfo) => `${record.players?.length || 0}/${record.maxPlayers}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const s = statusMap[status] || { color: 'default', text: status };
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: RoomInfo) => (
        <Button
          type="primary"
          size="small"
          disabled={record.status !== 'waiting' || (record.players?.length || 0) >= record.maxPlayers}
          onClick={() => handleJoinRoom(record.id)}
        >
          加入
        </Button>
      ),
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Header style={{ display: 'flex', alignItems: 'center', background: '#001529' }}>
        <Title level={3} style={{ color: '#fff', margin: 0 }}>
          童年游戏合集
        </Title>
        <Text style={{ color: '#aaa', marginLeft: 16 }}>
          {getUser()?.nickname || '加载中...'}
        </Text>
      </Layout.Header>
      <Layout>
        <Sider width={240} style={{ background: '#fff', padding: 16 }} breakpoint="md" collapsedWidth={0}>
          <Title level={4} style={{ marginBottom: 16 }}>游戏列表</Title>
          {games.map((game) => (
            <Card
              key={game.id}
              hoverable
              size="small"
              style={{
                marginBottom: 8,
                border: selectedGame === game.id ? '2px solid #1677ff' : undefined,
              }}
              onClick={() => setSelectedGame(game.id)}
            >
              <Text strong>{game.name}</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {game.description?.slice(0, 40)}...
              </Text>
            </Card>
          ))}
        </Sider>
        <Content style={{ padding: 24 }}>
          <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
            <Col>
              <Title level={4}>
                {games.find((g) => g.id === selectedGame)?.name || '选择游戏'} - 房间列表
              </Title>
            </Col>
            <Col>
              <Button type="primary" onClick={() => setCreateModalOpen(true)}>
                创建房间
              </Button>
            </Col>
          </Row>
          <Table
            columns={columns}
            dataSource={rooms}
            rowKey="id"
            pagination={false}
            locale={{ emptyText: '暂无房间，点击"创建房间"开始游戏' }}
          />
        </Content>
      </Layout>

      <Modal
        title="创建房间"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} onFinish={handleCreateRoom}>
          <Form.Item name="name" label="房间名" rules={[{ required: true, message: '请输入房间名' }]}>
            <Input placeholder="给你的房间起个名字" />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}

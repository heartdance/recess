import Taro from '@tarojs/taro';

type EventHandler = (data: any) => void;

class SocketService {
  private socketTask: Taro.SocketTask | null = null;
  private handlers: Map<string, EventHandler[]> = new Map();
  private url: string;
  private token: string;

  constructor() {
    this.url = 'ws://localhost:3000/socket.io/?EIO=4&transport=websocket';
    this.token = '';
  }

  setToken(token: string) {
    this.token = token;
  }

  connect() {
    this.socketTask = Taro.connectSocket({
      url: this.url,
      header: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    this.socketTask.onMessage((res) => {
      // Parse Socket.IO protocol messages
      const data = res.data as string;
      if (data.startsWith('42')) {
        try {
          const parsed = JSON.parse(data.slice(2));
          const event = parsed[0];
          const payload = parsed[1];
          const handlers = this.handlers.get(event) || [];
          handlers.forEach((h) => h(payload));
        } catch (e) {
          // ignore parse errors
        }
      }
    });

    this.socketTask.onOpen(() => {
      console.log('WebSocket connected');
    });

    this.socketTask.onClose(() => {
      console.log('WebSocket closed');
    });
  }

  on(event: string, handler: EventHandler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
  }

  off(event: string, handler?: EventHandler) {
    if (!handler) {
      this.handlers.delete(event);
    } else {
      const handlers = this.handlers.get(event) || [];
      this.handlers.set(event, handlers.filter((h) => h !== handler));
    }
  }

  emit(event: string, data: any) {
    if (this.socketTask) {
      const message = `42${JSON.stringify([event, data])}`;
      this.socketTask.send({ data: message });
    }
  }

  disconnect() {
    if (this.socketTask) {
      this.socketTask.close({});
      this.socketTask = null;
    }
  }
}

export const socketService = new SocketService();

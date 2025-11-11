import { io, Socket } from 'socket.io-client';
import { Storage } from './storage';

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  async connect(token?: string | null): Promise<Socket> {
    if (this.socket?.connected) {
      return this.socket;
    }

    // If a token isn't passed, try to get it from storage.
    const authToken = token || await Storage.get<string>('authToken', '');
    console.log('Socket connecting with token present:', !!authToken);

    // For React Native development, use environment variable or default
    // iOS Simulator: 'http://localhost:3000'
    // Android Emulator: 'http://10.0.2.2:3000'
    // Physical Device: Your computer's IP (e.g., 'http://192.168.1.100:3000')
    const socketUrl = __DEV__ 
      ? (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000')
      : 'https://api.raved.com';
    console.log('Socket connecting to URL:', socketUrl);

    this.socket = io(socketUrl, {
      auth: {
        token: authToken || undefined,
      },
      transports: ['websocket', 'polling'],
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      // Add CORS configuration for development
      ...(process.env.NODE_ENV === 'development' && {
        extraHeaders: {
          'Access-Control-Allow-Origin': '*',
        }
      }),
    });

    this.socket.on('connect', () => {
      console.log('Connected to socket server');
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from socket server:', reason);
      if (reason === 'io server disconnect') {
        // Server disconnected, try to reconnect
        this.reconnect();
      }
    });

    this.socket.on('connect_error', (error: any) => {
      console.error('Socket connection error:', error);
      console.error('Socket connection error details:', {
        message: error.message,
        description: error.description,
        context: error.context,
        type: error.type
      });
      this.handleReconnect();
    });

    return this.socket;
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000); // Exponential backoff with max 30s
      setTimeout(() => {
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) with ${delay}ms delay`);
        this.socket?.connect();
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  private reconnect() {
    if (this.socket) {
      this.socket.connect();
    }
  }

  updateAuthToken(token: string) {
    if (this.socket) {
      this.socket.auth = { token };
      if (this.socket.disconnected) {
        console.log('Socket is disconnected, attempting to connect with new token.');
        this.socket.connect();
      }
      console.log('Socket auth token updated.');
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Post-related socket events
  onPostLike(callback: (data: { postId: string; userId: string; liked: boolean }) => void) {
    this.socket?.on('post_like', callback);
  }

  onPostComment(callback: (data: { postId: string; commentId: string; userId: string; text: string }) => void) {
    this.socket?.on('post_comment', callback);
  }

  onNewPost(callback: (data: { post: any }) => void) {
    this.socket?.on('new_post', callback);
  }

  // Store-related socket events
  onNewStoreItem(callback: (data: { item: any }) => void) {
    this.socket?.on('new_store_item', callback);
  }

  onStoreItemSold(callback: (data: { itemId: string; buyerId: string }) => void) {
    this.socket?.on('store_item_sold', callback);
  }

  // Connection-related socket events
  onNewConnection(callback: (data: { connectionId: string; userId: string; connectedUserId: string }) => void) {
    this.socket?.on('new_connection', callback);
  }

  onConnectionRequest(callback: (data: { requestId: string; fromUserId: string; fromUsername: string }) => void) {
    this.socket?.on('connection_request', callback);
  }

  // Notification events
  onNotification(callback: (data: any) => void) {
    this.socket?.on('notification', callback);
  }

  // Chat events
  joinChat(chatId: string) {
    this.socket?.emit('join_chat', chatId);
  }

  leaveChat(chatId: string) {
    this.socket?.emit('leave_chat', chatId);
  }

  sendMessage(chatId: string, content: string, type: string = 'text') {
    this.socket?.emit('send_message', { chatId, content, type });
  }

  onNewMessage(callback: (data: any) => void) {
    this.socket?.on('new_message', callback);
  }

  onTypingStart(callback: (data: { userId: string; username: string; chatId: string }) => void) {
    this.socket?.on('user_typing', callback);
  }

  onTypingStop(callback: (data: { userId: string; username: string; chatId: string }) => void) {
    this.socket?.on('user_stopped_typing', callback);
  }

  // Generic event listener
  on(event: string, callback: (...args: any[]) => void) {
    this.socket?.on(event, callback);
  }

  off(event: string, callback?: (...args: any[]) => void) {
    if (callback) {
      this.socket?.off(event, callback);
    } else {
      this.socket?.off(event);
    }
  }

  emit(event: string, data?: any) {
    this.socket?.emit(event, data);
  }

  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();
export default socketService;
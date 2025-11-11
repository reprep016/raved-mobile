import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';
import { Avatar } from '../../components/ui/Avatar';
import { ErrorState } from '../../components/ui/ErrorState';
import api from '../../services/api';
import socketService from '../../services/socket';
import { useAuth } from '../../hooks/useAuth';

interface Message {
  id: string;
  conversationId: string;
  sender: {
    id: string;
    username: string;
    name: string;
    avatarUrl: string;
  };
  content: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  timeAgo: string;
}

interface ChatParticipant {
  id: string;
  username: string;
  name: string;
  avatarUrl: string;
}

export default function ChatDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatParticipant, setChatParticipant] = useState<ChatParticipant | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    const fetchChatData = async () => {
      if (!id || !user) return;

      try {
        // Fetch chat details
        const chatResponse = await api.get(`/chats/${id}`);
        setChatParticipant(chatResponse.data.chat.otherParticipant);

        // Fetch messages
        const messagesResponse = await api.get(`/chats/${id}/messages`);
        setMessages(messagesResponse.data.messages);

        // Connect to socket and join chat room
        await socketService.connect();
        socketService.joinChat(id);

        // Listen for new messages
        socketService.onNewMessage((data: any) => {
          if (data.conversationId === id) {
            setMessages(prev => [...prev, {
              id: data.id,
              conversationId: data.conversationId,
              sender: data.sender,
              content: data.content,
              type: data.type,
              isRead: data.isRead,
              createdAt: data.createdAt,
              timeAgo: data.timeAgo
            }]);
          }
        });
      } catch (error) {
        console.error('Failed to fetch chat data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchChatData();

    // Cleanup
    return () => {
      if (id) {
        socketService.leaveChat(id);
      }
    };
  }, [id, user]);

  useEffect(() => {
    // Auto-scroll to bottom when messages change
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim() || !id || sending) return;

    const messageText = message.trim();
    setMessage('');
    setSending(true);

    try {
      // Use offline queue service for offline support
      const { offlineQueueService } = await import('../../services/offlineQueue');
      
      // Add optimistic message
      const tempMessage: Message = {
        id: `temp_${Date.now()}`,
        conversationId: id,
        sender: {
          id: user?.id || '',
          name: user?.name || 'You',
          avatar: user?.avatar || '',
        },
        content: messageText,
        type: 'text',
        isRead: false,
        createdAt: new Date().toISOString(),
        timeAgo: 'now',
      };
      setMessages(prev => [...prev, tempMessage]);

      // Queue the message (will sync when online)
      await offlineQueueService.queueRequest(
        'POST',
        `/chats/${id}/messages`,
        {
          content: messageText,
          type: 'text'
        },
        {
          priority: 10, // High priority for messages
          tags: ['message', 'chat']
        }
      );

      // If online, process immediately
      if (offlineQueueService.isOnline) {
        await offlineQueueService.processQueue();
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => !m.id.startsWith('temp_')));
      setMessage(messageText); // Restore message text
      Alert.alert('Error', 'Failed to send message. It will be sent when you\'re back online.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading chat...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!chatParticipant) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ErrorState
          title="Chat not found"
          message="The conversation you're looking for doesn't exist or has been removed."
          onRetry={() => router.back()}
          retryLabel="Go Back"
        />
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => router.back()} style={styles.headerBackButton}>
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </TouchableOpacity>
            <View style={styles.avatarContainer}>
              <Avatar uri={chatParticipant.avatarUrl || ''} size={48} />
              <View style={styles.statusDotOffline} />
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{chatParticipant.name}</Text>
              <Text style={styles.userStatus}>Offline</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={24} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg) => {
            const isMe = msg.sender.id === user?.id;
            return (
              <View
                key={msg.id}
                style={[
                  styles.messageWrapper,
                  isMe ? styles.messageWrapperMe : styles.messageWrapperOther,
                ]}
              >
                <View
                  style={[
                    styles.messageBubble,
                    isMe ? styles.messageBubbleMe : styles.messageBubbleOther,
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      isMe ? styles.messageTextMe : styles.messageTextOther,
                    ]}
                  >
                    {msg.content}
                  </Text>
                  <Text
                    style={[
                      styles.messageTime,
                      isMe ? styles.messageTimeMe : styles.messageTimeOther,
                    ]}
                  >
                    {msg.timeAgo}
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <TouchableOpacity style={styles.attachButton}>
            <Ionicons name="add" size={24} color="#6B7280" />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={message}
            onChangeText={setMessage}
            placeholder="Type a message..."
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendButton, !message.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!message.trim()}
          >
            <Ionicons
              name="send"
              size={20}
              color={message.trim() ? 'white' : '#9CA3AF'}
            />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
    flex: 1,
  },
  headerBackButton: {
    padding: theme.spacing[1],
  },
  avatarContainer: {
    position: 'relative',
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  statusDotOnline: {
    backgroundColor: '#10B981',
  },
  statusDotOffline: {
    backgroundColor: '#9CA3AF',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: theme.typography.fontSize[18],
    fontWeight: theme.typography.fontWeight.bold,
    color: '#111827',
  },
  userStatus: {
    fontSize: theme.typography.fontSize[14],
    color: '#6B7280',
    marginTop: 2,
  },
  closeButton: {
    padding: theme.spacing[1],
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: theme.spacing[4],
    gap: theme.spacing[4],
  },
  messageWrapper: {
    flexDirection: 'row',
  },
  messageWrapperMe: {
    justifyContent: 'flex-end',
  },
  messageWrapperOther: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '78%',
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[2],
    borderRadius: theme.borderRadius['2xl'],
  },
  messageBubbleMe: {
    backgroundColor: theme.colors.primary,
  },
  messageBubbleOther: {
    backgroundColor: '#F3F4F6',
  },
  messageText: {
    fontSize: theme.typography.fontSize[14],
  },
  messageTextMe: {
    color: '#FFFFFF',
  },
  messageTextOther: {
    color: '#111827',
  },
  messageTime: {
    fontSize: theme.typography.fontSize[10],
    marginTop: 4,
    opacity: 0.7,
  },
  messageTimeMe: {
    color: '#FFFFFF',
  },
  messageTimeOther: {
    color: '#6B7280',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.spacing[3],
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  attachButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
    fontSize: theme.typography.fontSize[14],
    color: '#111827',
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#F3F4F6',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing[4],
    gap: theme.spacing[4],
  },
  errorText: {
    fontSize: theme.typography.fontSize[16],
    color: '#6B7280',
  },
  backButton: {
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[2],
    borderRadius: theme.borderRadius.xl,
    backgroundColor: theme.colors.primary,
    marginTop: theme.spacing[2],
  },
  backButtonText: {
    color: 'white',
    fontSize: theme.typography.fontSize[14],
    fontWeight: theme.typography.fontWeight.semibold,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing[12],
  },
  loadingText: {
    fontSize: theme.typography.fontSize[16],
    color: '#6B7280',
  },
});


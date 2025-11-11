import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

const faqCategories = [
  { id: 'all', label: 'All Questions' },
  { id: 'getting-started', label: 'Getting Started' },
  { id: 'posts', label: 'Posts & Content' },
  { id: 'store', label: 'Store & Marketplace' },
  { id: 'subscription', label: 'Subscription & Premium' },
  { id: 'account', label: 'Account & Settings' },
  { id: 'safety', label: 'Safety & Privacy' },
];

const faqs: FAQItem[] = [
  {
    id: '1',
    category: 'getting-started',
    question: 'How do I create an account?',
    answer: 'To create an account, tap the "Sign Up" button on the login screen. You can sign up using your email address or phone number. You\'ll need to verify your email or phone to complete registration.',
  },
  {
    id: '2',
    category: 'getting-started',
    question: 'How do I verify my account?',
    answer: 'After signing up, you\'ll receive a verification code via email or SMS. Enter this code in the verification screen to activate your account. Verified accounts have a blue checkmark badge.',
  },
  {
    id: '3',
    category: 'posts',
    question: 'How do I create a post?',
    answer: 'Tap the "+" button in the bottom navigation bar, then select "New Post". You can add photos, videos, or text. Add a caption, location, and tags to make your post more discoverable.',
  },
  {
    id: '4',
    category: 'posts',
    question: 'Can I edit or delete my posts?',
    answer: 'Yes! Tap the three dots menu on any of your posts to edit or delete it. You can edit captions, tags, and visibility settings. Deleted posts cannot be recovered.',
  },
  {
    id: '5',
    category: 'posts',
    question: 'What are post visibility settings?',
    answer: 'You can set posts to be visible to: Everyone (public), Your connections only, or Your faculty only. This helps you control who sees your content.',
  },
  {
    id: '6',
    category: 'store',
    question: 'How do I sell items on Raved?',
    answer: 'Premium members can access the Seller Dashboard. Create a listing by adding photos, description, price, and condition. Buyers can contact you directly through the app.',
  },
  {
    id: '7',
    category: 'store',
    question: 'How do I buy items?',
    answer: 'Browse the Store tab, find items you like, and tap to view details. Add items to your cart or contact the seller directly. Payment methods include Mobile Money and Cash.',
  },
  {
    id: '8',
    category: 'subscription',
    question: 'What is Premium?',
    answer: 'Premium unlocks advanced features including Seller Dashboard, exclusive themes, priority support, advanced analytics, and more. You can start with a free trial.',
  },
  {
    id: '9',
    category: 'subscription',
    question: 'How does the free trial work?',
    answer: 'New users get a 7-day free trial of Premium features. After the trial, you can choose to subscribe or continue with the free tier. No charges during the trial period.',
  },
  {
    id: '10',
    category: 'subscription',
    question: 'How do I cancel my subscription?',
    answer: 'Go to Settings > Subscription > Manage Subscription. You can cancel anytime. You\'ll retain Premium access until the end of your current billing period.',
  },
  {
    id: '11',
    category: 'account',
    question: 'How do I change my profile picture?',
    answer: 'Go to your Profile > Settings > Change Avatar. You can take a new photo or choose from your gallery. Premium members can use animated avatars.',
  },
  {
    id: '12',
    category: 'account',
    question: 'How do I change my password?',
    answer: 'Go to Settings > Privacy Settings > Change Password. You\'ll need to enter your current password and choose a new one. Make sure it\'s strong and unique.',
  },
  {
    id: '13',
    category: 'account',
    question: 'Can I delete my account?',
    answer: 'Yes, but this action is permanent. Go to Settings > Account Actions > Delete Account. All your data, posts, and messages will be permanently deleted.',
  },
  {
    id: '14',
    category: 'safety',
    question: 'How do I report inappropriate content?',
    answer: 'Tap the three dots menu on any post, comment, or user profile, then select "Report". Our moderation team reviews all reports and takes appropriate action.',
  },
  {
    id: '15',
    category: 'safety',
    question: 'How do I block a user?',
    answer: 'Go to the user\'s profile, tap the three dots menu, and select "Block User". Blocked users cannot see your posts, send you messages, or interact with you.',
  },
  {
    id: '16',
    category: 'safety',
    question: 'Is my data safe?',
    answer: 'Yes! We use industry-standard encryption and security measures. Your personal information is never shared with third parties. Read our Privacy Policy for details.',
  },
  {
    id: '17',
    category: 'posts',
    question: 'What are Stories?',
    answer: 'Stories are temporary posts that disappear after 24 hours. They\'re perfect for sharing quick updates, behind-the-scenes content, or daily fashion looks.',
  },
  {
    id: '18',
    category: 'posts',
    question: 'How do I save posts?',
    answer: 'Tap the bookmark icon on any post to save it. Saved posts are private and can be accessed from your Profile > Saved tab.',
  },
  {
    id: '19',
    category: 'account',
    question: 'How do I change my language?',
    answer: 'Go to Settings > Appearance > Language. Choose from English, Twi, Hausa, or French. The app will update immediately.',
  },
  {
    id: '20',
    category: 'account',
    question: 'How do I enable dark mode?',
    answer: 'Go to Settings > Appearance > Dark Mode. Toggle it on or off. You can also set it to follow your system settings.',
  },
];

export default function FAQScreen() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState('all');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const filteredFAQs = activeCategory === 'all'
    ? faqs
    : faqs.filter(faq => faq.category === activeCategory);

  const toggleItem = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.handle} />
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Frequently Asked Questions</Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={24} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Categories */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesScroll}
        contentContainerStyle={styles.categoriesContent}
      >
        {faqCategories.map(category => (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.categoryButton,
              activeCategory === category.id && styles.categoryButtonActive,
            ]}
            onPress={() => setActiveCategory(category.id)}
          >
            <Text
              style={[
                styles.categoryText,
                activeCategory === category.id && styles.categoryTextActive,
              ]}
            >
              {category.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* FAQ List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredFAQs.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="help-circle-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>No questions in this category</Text>
          </View>
        ) : (
          filteredFAQs.map(faq => {
            const isExpanded = expandedItems.has(faq.id);
            return (
              <View key={faq.id} style={styles.faqItem}>
                <TouchableOpacity
                  style={styles.faqQuestion}
                  onPress={() => toggleItem(faq.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.faqQuestionText}>{faq.question}</Text>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#6B7280"
                  />
                </TouchableOpacity>
                {isExpanded && (
                  <View style={styles.faqAnswer}>
                    <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingTop: theme.spacing[2],
    paddingBottom: theme.spacing[3],
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: theme.spacing[2],
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing[4],
  },
  headerTitle: {
    fontSize: theme.typography.fontSize[20],
    fontWeight: theme.typography.fontWeight.bold,
    color: '#111827',
  },
  closeButton: {
    padding: theme.spacing[1],
  },
  categoriesScroll: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  categoriesContent: {
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
    gap: theme.spacing[2],
  },
  categoryButton: {
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[2],
    borderRadius: theme.borderRadius.full,
    backgroundColor: '#F3F4F6',
    marginRight: theme.spacing[2],
  },
  categoryButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  categoryText: {
    fontSize: theme.typography.fontSize[14],
    fontWeight: theme.typography.fontWeight.medium,
    color: '#374151',
  },
  categoryTextActive: {
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing[4],
    gap: theme.spacing[3],
  },
  faqItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing[4],
  },
  faqQuestionText: {
    flex: 1,
    fontSize: theme.typography.fontSize[16],
    fontWeight: theme.typography.fontWeight.semibold,
    color: '#111827',
    marginRight: theme.spacing[2],
  },
  faqAnswer: {
    paddingHorizontal: theme.spacing[4],
    paddingBottom: theme.spacing[4],
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  faqAnswerText: {
    fontSize: theme.typography.fontSize[14],
    color: '#6B7280',
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: theme.spacing[12],
    gap: theme.spacing[3],
  },
  emptyText: {
    fontSize: theme.typography.fontSize[14],
    color: '#6B7280',
  },
});


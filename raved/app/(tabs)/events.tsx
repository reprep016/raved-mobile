import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { eventsApi, Event } from '../../services/eventsApi';

const eventTypeFilters = [
  { id: 'all', label: 'All' },
  { id: 'fashion', label: 'Fashion Shows' },
  { id: 'workshop', label: 'Workshops' },
  { id: 'networking', label: 'Networking' },
  { id: 'my-events', label: 'My Events' },
];

const audienceFilters = [
  { id: 'all', label: 'All Students' },
  { id: 'undergraduate', label: 'Undergraduate' },
  { id: 'graduate', label: 'Graduate' },
  { id: 'faculty', label: 'Faculty' },
  { id: 'alumni', label: 'Alumni' },
  { id: 'public', label: 'Public' },
];

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
};

export default function EventsScreen() {
  const router = useRouter();
  const [eventTypeFilter, setEventTypeFilter] = useState('all');
  const [audienceFilter, setAudienceFilter] = useState('all');
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadEvents();
  }, [eventTypeFilter, audienceFilter]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const filters: any = {};
      if (eventTypeFilter !== 'all' && eventTypeFilter !== 'my-events') {
        filters.category = eventTypeFilter;
      }
      if (audienceFilter !== 'all') {
        filters.audience = audienceFilter;
      }
      if (eventTypeFilter === 'my-events') {
        // Filter client-side for "my events"
        const data = await eventsApi.getEvents();
        const myEvents = data.events?.filter((e: Event) => e.attending) || [];
        setEvents(myEvents);
      } else {
        const data = await eventsApi.getEvents(filters);
        setEvents(data.events || []);
      }
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  };

  const handleJoinEvent = async (eventId: string) => {
    try {
      await eventsApi.toggleAttendance(eventId);
      // Reload events to get updated attendance status
      await loadEvents();
    } catch (error) {
      console.error('Failed to toggle attendance:', error);
    }
  };

  const renderEventCard = ({ item }: { item: Event }) => {
    const isFull = item.maxAttendees ? item.attendees >= item.maxAttendees : false;
    const dateParts = item.date.split('-');
    const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][parseInt(dateParts[1]) - 1];
    const day = parseInt(dateParts[2]);

    return (
      <TouchableOpacity
        style={styles.eventCard}
        onPress={() => router.push(`/event/${item.id}` as any)}
        activeOpacity={0.9}
      >
        {/* Event Image */}
        <View style={styles.eventImageContainer}>
          {item.image ? (
            <Image source={{ uri: item.image }} style={styles.eventImage} />
          ) : (
            <View style={[styles.eventImage, { backgroundColor: theme.colors.primary + '20', justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="calendar" size={48} color={theme.colors.primary} />
            </View>
          )}
          
          {/* Date Badge */}
          <View style={styles.dateBadge}>
            <Text style={styles.dateMonth}>{month}</Text>
            <Text style={styles.dateDay}>{day}</Text>
          </View>

          {/* Category Badge */}
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>
              {item.category === 'fashion' ? 'Fashion' : 
               item.category === 'workshop' ? 'Workshop' : 
               item.category === 'networking' ? 'Networking' : 'Event'}
            </Text>
          </View>

          {isFull && (
            <View style={styles.fullBadge}>
              <Text style={styles.fullBadgeText}>Full</Text>
            </View>
          )}
        </View>

        {/* Event Info */}
        <View style={styles.eventInfo}>
          <Text style={styles.eventTitle} numberOfLines={2}>
            {item.title}
          </Text>

          {/* Organizer */}
          <View style={styles.organizerRow}>
            <Avatar uri={item.organizer?.avatar || ''} size={20} />
            <Text style={styles.organizerName} numberOfLines={1}>
              {item.organizer?.name || 'Unknown Organizer'}
            </Text>
          </View>

          {/* Location */}
          <View style={styles.locationRow}>
            <Ionicons name="location" size={14} color="#6B7280" />
            <Text style={styles.locationText} numberOfLines={1}>
              {item.location}
            </Text>
          </View>

          {/* Description */}
          <Text style={styles.eventDescription} numberOfLines={2}>
            {item.description}
          </Text>

          {/* Tags */}
          {item.tags && item.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {item.tags.slice(0, 3).map((tag, index) => (
                <View key={index} style={styles.tagBadge}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Footer */}
          <View style={styles.eventFooter}>
            <View style={styles.attendeeInfo}>
              <Ionicons name="people" size={14} color="#6B7280" />
              <Text style={styles.attendeeText}>
                {item.attendees}{item.maxAttendees ? `/${item.maxAttendees}` : ''} attending
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.joinButtonTouchable,
                item.attending && styles.joinButtonAttending,
                (isFull && !item.attending) && styles.joinButtonDisabled,
              ]}
              onPress={() => handleJoinEvent(item.id)}
              disabled={(isFull && !item.attending) || loading}
            >
              <Text style={[
                styles.joinButtonText,
                item.attending && styles.joinButtonTextAttending,
                (isFull && !item.attending) && styles.joinButtonTextDisabled,
              ]}>
                {item.attending ? 'Attending' : 'Join'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Create Event Button */}
      <View style={styles.header}>
        <Button
          title="Create Event"
          onPress={() => router.push('/create-event' as any)}
          variant="primary"
          size="large"
          leftIcon={<Ionicons name="add" size={16} color="white" />}
          style={styles.createButton}
        />
      </View>

      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Event Type Filters */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Event Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            {eventTypeFilters.map(filter => (
              <TouchableOpacity
                key={filter.id}
                style={[
                  styles.filterPill,
                  eventTypeFilter === filter.id && styles.filterPillActive,
                ]}
                onPress={() => setEventTypeFilter(filter.id)}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    eventTypeFilter === filter.id && styles.filterPillTextActive,
                  ]}
                >
                  {filter.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Audience Filters */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Audience</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            {audienceFilters.map(filter => (
              <TouchableOpacity
                key={filter.id}
                style={[
                  styles.filterPill,
                  styles.filterPillSmall,
                  audienceFilter === filter.id && styles.filterPillActive,
                ]}
                onPress={() => setAudienceFilter(filter.id)}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    styles.filterPillTextSmall,
                    audienceFilter === filter.id && styles.filterPillTextActive,
                  ]}
                >
                  {filter.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Events List */}
        <View style={styles.eventsList}>
          {loading && events.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          ) : events.length > 0 ? (
            <FlatList
              data={events}
              renderItem={renderEventCard}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={{ height: theme.spacing[4] }} />}
            />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>No events found</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    padding: theme.spacing[4],
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  createButton: {
    width: '100%',
  },
  scrollView: {
    flex: 1,
  },
  filterSection: {
    paddingHorizontal: theme.spacing[4],
    paddingTop: theme.spacing[3],
    paddingBottom: theme.spacing[2],
  },
  filterLabel: {
    fontSize: theme.typography.fontSize[12],
    fontWeight: theme.typography.fontWeight.semibold,
    color: '#6B7280',
    marginBottom: theme.spacing[2],
  },
  filterScroll: {
    marginHorizontal: -theme.spacing[4],
    paddingHorizontal: theme.spacing[4],
  },
  filterPill: {
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[2],
    borderRadius: theme.borderRadius.full,
    backgroundColor: '#F3F4F6',
    marginRight: theme.spacing[2],
  },
  filterPillSmall: {
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[1.5],
  },
  filterPillActive: {
    backgroundColor: theme.colors.primary,
  },
  filterPillText: {
    fontSize: theme.typography.fontSize[14],
    fontWeight: theme.typography.fontWeight.medium,
    color: '#374151',
  },
  filterPillTextSmall: {
    fontSize: theme.typography.fontSize[12],
  },
  filterPillTextActive: {
    color: 'white',
  },
  eventsList: {
    padding: theme.spacing[4],
  },
  eventCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.borderRadius['2xl'],
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  eventImageContainer: {
    position: 'relative',
    height: 160,
  },
  eventImage: {
    width: '100%',
    height: '100%',
  },
  dateBadge: {
    position: 'absolute',
    top: theme.spacing[2],
    left: theme.spacing[2],
    backgroundColor: 'white',
    paddingHorizontal: theme.spacing[2],
    paddingVertical: theme.spacing[1],
    borderRadius: theme.borderRadius.base,
    alignItems: 'center',
    minWidth: 50,
  },
  dateMonth: {
    fontSize: theme.typography.fontSize[10],
    fontWeight: theme.typography.fontWeight.semibold,
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  dateDay: {
    fontSize: theme.typography.fontSize[16],
    fontWeight: theme.typography.fontWeight.bold,
    color: '#111827',
  },
  categoryBadge: {
    position: 'absolute',
    top: theme.spacing[2],
    right: theme.spacing[2],
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing[2],
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
  },
  categoryText: {
    fontSize: theme.typography.fontSize[10],
    fontWeight: theme.typography.fontWeight.semibold,
    color: 'white',
  },
  fullBadge: {
    position: 'absolute',
    bottom: theme.spacing[2],
    right: theme.spacing[2],
    backgroundColor: '#EF4444',
    paddingHorizontal: theme.spacing[2],
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
  },
  fullBadgeText: {
    fontSize: theme.typography.fontSize[10],
    fontWeight: theme.typography.fontWeight.semibold,
    color: 'white',
  },
  eventInfo: {
    padding: theme.spacing[4],
    gap: theme.spacing[2],
  },
  eventTitle: {
    fontSize: theme.typography.fontSize[18],
    fontWeight: theme.typography.fontWeight.bold,
    color: '#111827',
  },
  organizerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[1.5],
  },
  organizerName: {
    fontSize: theme.typography.fontSize[12],
    color: '#6B7280',
    flex: 1,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[1],
  },
  locationText: {
    fontSize: theme.typography.fontSize[12],
    color: '#6B7280',
    flex: 1,
  },
  eventDescription: {
    fontSize: theme.typography.fontSize[14],
    color: '#6B7280',
    lineHeight: 20,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing[1.5],
  },
  tagBadge: {
    paddingHorizontal: theme.spacing[2],
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
    backgroundColor: '#F3F4F6',
  },
  tagText: {
    fontSize: theme.typography.fontSize[10],
    fontWeight: theme.typography.fontWeight.medium,
    color: '#374151',
  },
  eventFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing[2],
  },
  attendeeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[1],
  },
  attendeeText: {
    fontSize: theme.typography.fontSize[12],
    color: '#6B7280',
  },
  joinButtonTouchable: {
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[2],
    borderRadius: theme.borderRadius.base,
    backgroundColor: theme.colors.primary,
    minWidth: 100,
    alignItems: 'center',
  },
  joinButtonAttending: {
    backgroundColor: '#F3F4F6',
  },
  joinButtonDisabled: {
    backgroundColor: '#E5E7EB',
    opacity: 0.5,
  },
  joinButtonText: {
    fontSize: theme.typography.fontSize[12],
    fontWeight: theme.typography.fontWeight.semibold,
    color: 'white',
  },
  joinButtonTextAttending: {
    color: '#374151',
  },
  joinButtonTextDisabled: {
    color: '#9CA3AF',
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
  loadingContainer: {
    paddingVertical: theme.spacing[12],
    alignItems: 'center',
  },
});

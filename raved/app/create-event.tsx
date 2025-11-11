import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';
import { Input } from '../components/ui/Input';
import { Toggle } from '../components/ui/Toggle';
import { useAuth } from '../hooks/useAuth';
import { Event } from '../types';
import { mockImages } from '../utils/mockData';
import { eventsApi } from '../services/eventsApi';

export default function CreateEventScreen() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('fashion');
  const [audience, setAudience] = useState('all');
  const [capacity, setCapacity] = useState('50');
  const [fee, setFee] = useState('0');
  const [description, setDescription] = useState('');
  const [requireRegistration, setRequireRegistration] = useState(true);
  const [allowWaitlist, setAllowWaitlist] = useState(true);
  const [sendReminders, setSendReminders] = useState(true);
  const [loading, setLoading] = useState(false);

  const categoryOptions = [
    { value: 'fashion', label: 'Fashion Show' },
    { value: 'workshop', label: 'Workshop' },
    { value: 'networking', label: 'Networking' },
  ];

  const audienceOptions = [
    { value: 'all', label: 'All Students' },
    { value: 'undergraduate', label: 'Undergraduate Students' },
    { value: 'graduate', label: 'Graduate Students' },
    { value: 'faculty', label: 'Faculty & Staff' },
    { value: 'alumni', label: 'Alumni' },
    { value: 'public', label: 'Open to Public' },
  ];

  const handleCreate = async () => {
    if (!title.trim() || !date || !time || !category || !location.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      
      // Format date and time
      const eventDate = new Date(date);
      const [hours, minutes] = time.split(':');
      eventDate.setHours(parseInt(hours), parseInt(minutes));

      const eventData = new FormData();
      eventData.append('title', title.trim());
      eventData.append('description', description.trim() || '');
      eventData.append('date', eventDate.toISOString().split('T')[0]);
      eventData.append('time', time);
      eventData.append('location', location.trim());
      eventData.append('category', category);
      eventData.append('audience', audience);
      if (capacity) {
        eventData.append('maxAttendees', capacity);
      }
      if (fee) {
        eventData.append('registrationFee', fee);
      }

      await eventsApi.createEvent(eventData);
      
      Alert.alert('Success', 'Event created successfully!');
      router.back();
    } catch (error: any) {
      console.error('Failed to create event:', error);
      Alert.alert('Error', error.message || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Create Event</Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={24} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Basic Event Info */}
        <View style={styles.section}>
          <Input
            label="Event Title"
            value={title}
            onChangeText={setTitle}
            placeholder="Enter event title..."
            style={styles.input}
          />

          <View style={styles.row}>
            <View style={[styles.halfWidth, styles.halfWidthLeft]}>
              <Input
                label="Date"
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                style={styles.input}
              />
            </View>
            <View style={[styles.halfWidth, styles.halfWidthRight]}>
              <Input
                label="Time"
                value={time}
                onChangeText={setTime}
                placeholder="HH:MM"
                style={styles.input}
              />
            </View>
          </View>

          <Input
            value={location}
            onChangeText={setLocation}
            placeholder="Event location..."
            style={styles.input}
          />
        </View>

        {/* Event Category */}
        <View style={styles.section}>
          <Text style={styles.label}>Event Type</Text>
          <View style={styles.selectContainer}>
            {categoryOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.selectOption,
                  category === option.value && styles.selectOptionActive,
                ]}
                onPress={() => setCategory(option.value)}
              >
                <Text
                  style={[
                    styles.selectOptionText,
                    category === option.value && styles.selectOptionTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Target Audience */}
        <View style={styles.section}>
          <Text style={styles.label}>Target Audience</Text>
          <View style={styles.selectContainer}>
            {audienceOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.selectOption,
                  styles.selectOptionSmall,
                  audience === option.value && styles.selectOptionActive,
                ]}
                onPress={() => setAudience(option.value)}
              >
                <Text
                  style={[
                    styles.selectOptionText,
                    styles.selectOptionTextSmall,
                    audience === option.value && styles.selectOptionTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Capacity & Fee */}
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={[styles.halfWidth, styles.halfWidthLeft]}>
              <Input
                label="Max Attendees"
                value={capacity}
                onChangeText={setCapacity}
                keyboardType="numeric"
                style={styles.input}
              />
            </View>
            <View style={[styles.halfWidth, styles.halfWidthRight]}>
              <Input
                label="Registration Fee"
                value={fee}
                onChangeText={setFee}
                keyboardType="decimal-pad"
                placeholder="0.00"
                style={styles.input}
              />
            </View>
          </View>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Input
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="Describe your event..."
            multiline
            numberOfLines={4}
            style={styles.input}
          />
        </View>

        {/* Event Settings */}
        <View style={styles.section}>
          <Text style={styles.label}>Event Settings</Text>
          <View style={styles.settingsContainer}>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Require registration</Text>
              <Toggle
                value={requireRegistration}
                onValueChange={setRequireRegistration}
              />
            </View>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Allow waitlist</Text>
              <Toggle
                value={allowWaitlist}
                onValueChange={setAllowWaitlist}
              />
            </View>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Send reminders</Text>
              <Toggle
                value={sendReminders}
                onValueChange={setSendReminders}
              />
            </View>
          </View>
        </View>

        {/* Create Button */}
        <TouchableOpacity
          onPress={handleCreate}
          style={styles.createButton}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[theme.colors.primary, '#9333EA']} // primary to purple-600
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.createButtonGradient}
          >
            <Ionicons name="calendar" size={20} color="white" style={styles.createButtonIcon} />
            <Text style={styles.createButtonText}>Create Event</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC', // gray-50
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: theme.spacing[4],
    paddingTop: theme.spacing[2],
    paddingBottom: theme.spacing[3],
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: theme.typography.fontSize[20],
    fontWeight: theme.typography.fontWeight.bold,
    color: '#111827',
  },
  closeButton: {
    padding: theme.spacing[2],
    borderRadius: theme.borderRadius.full,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing[4],
    gap: theme.spacing[4],
  },
  section: {
    gap: theme.spacing[2],
  },
  input: {
    marginBottom: 0,
  },
  row: {
    flexDirection: 'row',
    gap: theme.spacing[4],
  },
  halfWidth: {
    flex: 1,
  },
  halfWidthLeft: {
    marginRight: theme.spacing[2],
  },
  halfWidthRight: {
    marginLeft: theme.spacing[2],
  },
  label: {
    fontSize: theme.typography.fontSize[14],
    fontWeight: theme.typography.fontWeight.medium,
    color: '#374151', // gray-700
    marginBottom: theme.spacing[2],
  },
  selectContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing[2],
  },
  selectOption: {
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[2],
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: '#E5E7EB', // gray-200
    backgroundColor: '#FFFFFF',
  },
  selectOptionSmall: {
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[1.5],
  },
  selectOptionActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  selectOptionText: {
    fontSize: theme.typography.fontSize[14],
    fontWeight: theme.typography.fontWeight.medium,
    color: '#374151', // gray-700
  },
  selectOptionTextSmall: {
    fontSize: theme.typography.fontSize[12],
  },
  selectOptionTextActive: {
    color: '#FFFFFF',
  },
  settingsContainer: {
    gap: theme.spacing[3],
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingLabel: {
    fontSize: theme.typography.fontSize[14],
    color: '#374151', // gray-700
  },
  createButton: {
    borderRadius: theme.borderRadius['2xl'],
    overflow: 'hidden',
    marginTop: theme.spacing[2],
    marginBottom: theme.spacing[4],
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  createButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing[4],
    paddingHorizontal: theme.spacing[4],
  },
  createButtonIcon: {
    marginRight: theme.spacing[2],
  },
  createButtonText: {
    fontSize: theme.typography.fontSize[18],
    fontWeight: theme.typography.fontWeight.bold,
    color: '#FFFFFF',
  },
});


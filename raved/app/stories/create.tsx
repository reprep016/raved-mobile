import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';
import { Button } from '../../components/ui/Button';
import * as ImagePicker from 'expo-image-picker';

export default function CreateStoryScreen() {
  const router = useRouter();
  const [storyMedia, setStoryMedia] = useState<any>(null);
  const [storyText, setStoryText] = useState('');
  const [allowReplies, setAllowReplies] = useState(true);
  const [addToHighlights, setAddToHighlights] = useState(false);

  const pickMedia = async (type: 'camera' | 'gallery' | 'video' | 'text') => {
    if (type === 'text') {
      setStoryMedia({ type: 'text', text: storyText || "Today's Fit 👗" });
      return;
    }

    try {
      let result;
      if (type === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission required', 'Sorry, we need camera permissions!');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.All,
          quality: 0.8,
          aspect: [9, 16],
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission required', 'Sorry, we need camera roll permissions!');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: type === 'video' 
            ? ImagePicker.MediaTypeOptions.Videos 
            : ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
          aspect: [9, 16],
        });
      }

      if (!result.canceled && result.assets[0]) {
        setStoryMedia({
          type: result.assets[0].type,
          uri: result.assets[0].uri,
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to capture media');
    }
  };

  const useTemplate = (template: string) => {
    const templates: Record<string, { background: string[]; text: string }> = {
      ootd: { background: ['#EC4899', '#8B5CF6'], text: "Today's Fit 👗" },
      mood: { background: ['#3B82F6', '#06B6D4'], text: "Current Mood ✨" },
      study: { background: ['#10B981', '#059669'], text: "Study Vibes 📚" },
      event: { background: ['#F59E0B', '#D97706'], text: "Event Ready! 🎉" },
    };
    
    const selected = templates[template];
    if (selected) {
      setStoryMedia({
        type: 'template',
        background: selected.background,
        text: selected.text,
      });
      setStoryText(selected.text);
    }
  };

  const publishStory = () => {
    if (!storyMedia) {
      Alert.alert('Error', 'Please add media or text to your story');
      return;
    }
    
    Alert.alert('Success', 'Your story has been published!');
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Story</Text>
        <TouchableOpacity 
          style={[
            styles.publishButton,
            { backgroundColor: storyMedia ? theme.colors.primary : '#D1D5DB' }
          ]}
          onPress={publishStory}
          disabled={!storyMedia}
        >
          <Text style={styles.publishButtonText}>Publish</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Story Preview */}
        <View style={styles.previewSection}>
          <View 
            style={[
              styles.storyPreview,
              storyMedia?.background && {
                backgroundColor: storyMedia.background[0]
              }
            ]}
          >
            {storyMedia?.type === 'image' && (
              <Image source={{ uri: storyMedia.uri }} style={styles.storyMedia} />
            )}
            {storyMedia?.type === 'video' && (
              <View style={styles.videoContainer}>
                <Image source={{ uri: storyMedia.uri }} style={styles.storyMedia} />
                <Ionicons name="play" size={48} color="white" style={styles.playIcon} />
              </View>
            )}
            {storyMedia?.text && (
              <View style={styles.textOverlay}>
                <Text style={styles.storyText}>{storyMedia.text}</Text>
              </View>
            )}
            
            {!storyMedia && (
              <View style={styles.placeholder}>
                <Ionicons name="camera" size={48} color="#9CA3AF" />
                <Text style={styles.placeholderTitle}>
                  Tap to add photo or video
                </Text>
                <Text style={styles.placeholderSubtitle}>
                  Or choose from templates below
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Media Options */}
        <View style={styles.optionsSection}>
          <Text style={styles.sectionTitle}>Add Media</Text>
          <View style={styles.mediaOptions}>
            <TouchableOpacity 
              style={[styles.mediaOption, { backgroundColor: '#DBEAFE' }]}
              onPress={() => pickMedia('camera')}
            >
              <Ionicons name="camera" size={32} color="#3B82F6" />
              <Text style={[styles.mediaOptionText, { color: '#1E40AF' }]}>Camera</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.mediaOption, { backgroundColor: '#D1FAE5' }]}
              onPress={() => pickMedia('gallery')}
            >
              <Ionicons name="images" size={32} color="#10B981" />
              <Text style={[styles.mediaOptionText, { color: '#065F46' }]}>Gallery</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.mediaOption, { backgroundColor: '#EDE9FE' }]}
              onPress={() => pickMedia('video')}
            >
              <Ionicons name="videocam" size={32} color="#8B5CF6" />
              <Text style={[styles.mediaOptionText, { color: '#6D28D9' }]}>Video</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.mediaOption, { backgroundColor: '#FEF3C7' }]}
              onPress={() => pickMedia('text')}
            >
              <Ionicons name="text" size={32} color="#F59E0B" />
              <Text style={[styles.mediaOptionText, { color: '#92400E' }]}>Text Only</Text>
            </TouchableOpacity>
          </View>

          {/* Templates */}
          <Text style={styles.sectionTitle}>Quick Templates</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.templatesScroll}>
            <View style={styles.templates}>
              <TouchableOpacity 
                style={[styles.template, { backgroundColor: '#EC4899' }]}
                onPress={() => useTemplate('ootd')}
              >
                <Ionicons name="shirt" size={24} color="white" />
                <Text style={styles.templateText}>OOTD</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.template, { backgroundColor: '#3B82F6' }]}
                onPress={() => useTemplate('mood')}
              >
                <Ionicons name="heart" size={24} color="white" />
                <Text style={styles.templateText}>Mood</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.template, { backgroundColor: '#10B981' }]}
                onPress={() => useTemplate('study')}
              >
                <Ionicons name="book" size={24} color="white" />
                <Text style={styles.templateText}>Study</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.template, { backgroundColor: '#F59E0B' }]}
                onPress={() => useTemplate('event')}
              >
                <Ionicons name="calendar" size={24} color="white" />
                <Text style={styles.templateText}>Event</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.template, { backgroundColor: '#EF4444' }]}
                onPress={() => useTemplate('workout')}
              >
                <Ionicons name="fitness" size={24} color="white" />
                <Text style={styles.templateText}>Workout</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.template, { backgroundColor: '#EAB308' }]}
                onPress={() => useTemplate('food')}
              >
                <Ionicons name="restaurant" size={24} color="white" />
                <Text style={styles.templateText}>Food</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.template, { backgroundColor: '#06B6D4' }]}
                onPress={() => useTemplate('travel')}
              >
                <Ionicons name="airplane" size={24} color="white" />
                <Text style={styles.templateText}>Travel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.template, { backgroundColor: '#A855F7' }]}
                onPress={() => useTemplate('party')}
              >
                <Ionicons name="musical-notes" size={24} color="white" />
                <Text style={styles.templateText}>Party</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.template, { backgroundColor: '#14B8A6' }]}
                onPress={() => useTemplate('chill')}
              >
                <Ionicons name="leaf" size={24} color="white" />
                <Text style={styles.templateText}>Chill</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.template, { backgroundColor: '#6366F1' }]}
                onPress={() => useTemplate('motivation')}
              >
                <Ionicons name="flame" size={24} color="white" />
                <Text style={styles.templateText}>Motivation</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Story Settings */}
          <Text style={styles.sectionTitle}>Story Settings</Text>
          <View style={styles.settings}>
            <View style={styles.setting}>
              <Text style={styles.settingText}>Allow replies</Text>
              <Switch
                value={allowReplies}
                onValueChange={setAllowReplies}
                trackColor={{ false: '#D1D5DB', true: theme.colors.primary }}
              />
            </View>
            <View style={styles.setting}>
              <Text style={styles.settingText}>Add to highlights</Text>
              <Switch
                value={addToHighlights}
                onValueChange={setAddToHighlights}
                trackColor={{ false: '#D1D5DB', true: theme.colors.primary }}
              />
            </View>
          </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: theme.spacing[2],
  },
  headerTitle: {
    fontSize: theme.typography.fontSize[20],
    fontWeight: theme.typography.fontWeight.bold,
    color: '#111827',
  },
  publishButton: {
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[2],
    borderRadius: theme.borderRadius.xl,
  },
  publishButtonText: {
    color: 'white',
    fontSize: theme.typography.fontSize[14],
    fontWeight: theme.typography.fontWeight.semibold,
  },
  content: {
    flex: 1,
  },
  previewSection: {
    padding: theme.spacing[4],
  },
  storyPreview: {
    width: '100%',
    height: 300,
    borderRadius: theme.borderRadius['2xl'],
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E5E7EB',
  },
  storyMedia: {
    width: '100%',
    height: '100%',
  },
  videoContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  playIcon: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -24 }, { translateY: -24 }],
  },
  textOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyText: {
    color: 'white',
    fontSize: theme.typography.fontSize[32],
    fontWeight: theme.typography.fontWeight.bold,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  placeholder: {
    alignItems: 'center',
    gap: theme.spacing[3],
  },
  placeholderTitle: {
    fontSize: theme.typography.fontSize[18],
    fontWeight: theme.typography.fontWeight.semibold,
    color: '#111827',
  },
  placeholderSubtitle: {
    fontSize: theme.typography.fontSize[14],
    color: '#6B7280',
  },
  optionsSection: {
    padding: theme.spacing[4],
    gap: theme.spacing[6],
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize[18],
    fontWeight: theme.typography.fontWeight.bold,
    color: '#111827',
  },
  mediaOptions: {
    flexDirection: 'row',
    gap: theme.spacing[3],
  },
  mediaOption: {
    flex: 1,
    alignItems: 'center',
    padding: theme.spacing[4],
    borderRadius: theme.borderRadius.xl,
    gap: theme.spacing[2],
  },
  mediaOptionText: {
    fontSize: theme.typography.fontSize[12],
    fontWeight: theme.typography.fontWeight.semibold,
  },
  templatesScroll: {
    marginVertical: theme.spacing[2],
  },
  templates: {
    flexDirection: 'row',
    gap: theme.spacing[3],
    paddingHorizontal: theme.spacing[2],
  },
  template: {
    minWidth: 80,
    alignItems: 'center',
    padding: theme.spacing[3],
    borderRadius: theme.borderRadius.xl,
    gap: theme.spacing[2],
  },
  templateText: {
    color: 'white',
    fontSize: theme.typography.fontSize[12],
    fontWeight: theme.typography.fontWeight.semibold,
  },
  settings: {
    gap: theme.spacing[4],
  },
  setting: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingText: {
    fontSize: theme.typography.fontSize[14],
    fontWeight: theme.typography.fontWeight.medium,
    color: '#111827',
  },
});


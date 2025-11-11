import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';
import { Input } from '../components/ui/Input';
import { useAuth } from '../hooks/useAuth';

const languages = [
  { value: 'en', label: 'English', flag: '🇺🇸', subtitle: 'Default' },
  { value: 'tw', label: 'Twi', flag: '🇬🇭', subtitle: 'Akan' },
  { value: 'ha', label: 'Hausa', flag: '🇬🇭', subtitle: 'Northern Ghana' },
  { value: 'fr', label: 'Français', flag: '🇫🇷', subtitle: 'French' },
];

const dateFormats = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (31/12/2024)' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (12/31/2024)' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2024-12-31)' },
];

const currencies = [
  { value: 'GHS', label: 'Ghana Cedi (₵)' },
  { value: 'USD', label: 'US Dollar ($)' },
  { value: 'EUR', label: 'Euro (€)' },
  { value: 'GBP', label: 'British Pound (£)' },
];

export default function LanguageSettingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t, i18n } = useTranslation();

  const [language, setLanguage] = useState(user?.language || 'en');
  const [dateFormat, setDateFormat] = useState(user?.dateFormat || 'DD/MM/YYYY');
  const [currency, setCurrency] = useState(user?.currency || 'GHS');

  const savePreferences = async () => {
    try {
      const api = (await import('../services/api')).default;
      await api.put('/auth/language-preferences', {
        language,
        dateFormat,
        currency,
      });
      Alert.alert('Success', 'Preferences saved successfully');
    } catch (error) {
      console.error('Failed to save preferences:', error);
      Alert.alert('Error', 'Failed to save preferences');
    }
  };

  const handleLanguageChange = async (lang: string) => {
    setLanguage(lang as any);
    await i18n.changeLanguage(lang);
    
    // Update user language preference in backend
    try {
      const api = (await import('../services/api')).default;
      await api.put('/auth/language-preferences', { language: lang });
    } catch (error) {
      console.error('Failed to sync language preference:', error);
    }
  };

  const SettingSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{t('language')}</Text>
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
        <SettingSection title="App Language">
          {languages.map((lang) => (
            <TouchableOpacity
              key={lang.value}
              style={[
                styles.languageItem,
                language === lang.value && styles.languageItemActive,
              ]}
              onPress={() => handleLanguageChange(lang.value)}
            >
              <View style={styles.languageItemLeft}>
                <Text style={styles.flag}>{lang.flag}</Text>
                <View style={styles.languageItemText}>
                  <Text style={styles.languageItemLabel}>{lang.label}</Text>
                  <Text style={styles.languageItemSubtitle}>{lang.subtitle}</Text>
                </View>
              </View>
              {language === lang.value && (
                <Ionicons name="checkmark-circle" size={24} color={theme.colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </SettingSection>

        <SettingSection title="Regional Settings">
          <View style={styles.selectContainer}>
            <Text style={styles.selectLabel}>Date Format</Text>
            <View style={styles.selectWrapper}>
              {dateFormats.map((format) => (
                <TouchableOpacity
                  key={format.value}
                  style={[
                    styles.selectOption,
                    dateFormat === format.value && styles.selectOptionActive,
                  ]}
                  onPress={() => {
                    setDateFormat(format.value as any);
                    savePreferences();
                  }}
                >
                  <Text
                    style={[
                      styles.selectOptionText,
                      dateFormat === format.value && styles.selectOptionTextActive,
                    ]}
                  >
                    {format.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.selectContainer}>
            <Text style={styles.selectLabel}>Currency</Text>
            <View style={styles.selectWrapper}>
              {currencies.map((curr) => (
                <TouchableOpacity
                  key={curr.value}
                  style={[
                    styles.selectOption,
                    currency === curr.value && styles.selectOptionActive,
                  ]}
                  onPress={() => {
                    setCurrency(curr.value as any);
                    savePreferences();
                  }}
                >
                  <Text
                    style={[
                      styles.selectOptionText,
                      currency === curr.value && styles.selectOptionTextActive,
                    ]}
                  >
                    {curr.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </SettingSection>
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
    padding: theme.spacing[1],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing[4],
    gap: theme.spacing[4],
  },
  section: {
    backgroundColor: '#F9FAFB',
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing[4],
    gap: theme.spacing[2],
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize[16],
    fontWeight: theme.typography.fontWeight.semibold,
    color: '#374151',
    marginBottom: theme.spacing[1],
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing[3],
    backgroundColor: '#FFFFFF',
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing[1],
  },
  languageItemActive: {
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  languageItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
    flex: 1,
  },
  flag: {
    fontSize: 24,
  },
  languageItemText: {
    flex: 1,
  },
  languageItemLabel: {
    fontSize: theme.typography.fontSize[14],
    fontWeight: theme.typography.fontWeight.medium,
    color: '#374151',
  },
  languageItemSubtitle: {
    fontSize: theme.typography.fontSize[12],
    color: '#6B7280',
    marginTop: 2,
  },
  selectContainer: {
    marginBottom: theme.spacing[3],
  },
  selectLabel: {
    fontSize: theme.typography.fontSize[14],
    fontWeight: theme.typography.fontWeight.medium,
    color: '#374151',
    marginBottom: theme.spacing[2],
  },
  selectWrapper: {
    gap: theme.spacing[2],
  },
  selectOption: {
    padding: theme.spacing[3],
    backgroundColor: '#FFFFFF',
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectOptionActive: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
    backgroundColor: '#EFF6FF',
  },
  selectOptionText: {
    fontSize: theme.typography.fontSize[14],
    color: '#374151',
  },
  selectOptionTextActive: {
    color: theme.colors.primary,
    fontWeight: theme.typography.fontWeight.medium,
  },
});


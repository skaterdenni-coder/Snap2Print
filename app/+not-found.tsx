import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Nicht gefunden' }} />
      <View style={styles.container}>
        <Text style={styles.title}>Diese Seite existiert nicht.</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Zurück zur Startseite</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#0A0A0C',
  },
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#F0F0F2',
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 14,
    color: '#00D4AA',
  },
});

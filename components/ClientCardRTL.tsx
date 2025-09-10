import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image } from 'react-native';
import { Client } from '@/constants/clients';
import Colors from '@/constants/colors';
import Card from './Card';
import { Phone, Calendar } from 'lucide-react-native';

interface ClientCardRTLProps {
  client: Client;
  onPress: (client: Client) => void;
}

export default function ClientCardRTL({ client, onPress }: ClientCardRTLProps) {
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'לא ביקרה עדיין';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL');
  };
  
  return (
    <TouchableOpacity 
      onPress={() => onPress(client)}
      activeOpacity={0.7}
    >
      <Card style={styles.card}>
        <View style={styles.content}>
          <Text style={styles.name}>{client.name}</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoText}>{client.phone}</Text>
            <Phone size={14} color={Colors.subtext} style={styles.icon} />
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoText}>ביקור אחרון: {formatDate(client.lastVisit)}</Text>
            <Calendar size={14} color={Colors.subtext} style={styles.icon} />
          </View>
        </View>
        
        <Image 
          source={{ uri: client.image || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330' }} 
          style={styles.image} 
        />
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    padding: 12,
    marginVertical: 6,
    alignItems: 'center',
  },
  image: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginLeft: 12,
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
    textAlign: 'right',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: Colors.subtext,
    textAlign: 'right',
  },
  icon: {
    marginLeft: 6,
  },
});
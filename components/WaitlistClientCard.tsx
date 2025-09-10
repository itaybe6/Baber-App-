import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

interface WaitlistClientCardProps {
  name: string;
  image: string;
  time: string;
  type: string;
  tag?: string;
}

export default function WaitlistClientCard({
  name,
  image,
  time,
  type,
  tag = 'המתנה',
}: WaitlistClientCardProps) {
  const hasImage = Boolean(image && image.trim().length > 0);
  const placeholder = require('@/assets/images/user.png');
  const separatorChar = time?.includes('|') ? ' ' : '|';
  return (
    <View style={styles.card}>
      <Image source={hasImage ? { uri: image } : placeholder} style={styles.avatar} />
      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">{name}</Text>
        <View style={styles.infoRow}>
          <Text style={styles.time}>{time}</Text>
          <Text style={styles.separator}>{separatorChar}</Text>
          <Text style={styles.type} numberOfLines={2} ellipsizeMode="tail">{type}</Text>
        </View>
        <View style={styles.tag}>
          <Text style={styles.tagText}>{tag}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ECECEC',
    minHeight: 80,
    gap: 12,
    overflow: 'hidden',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#eee',
  },
  content: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'flex-end',
    minWidth: 0,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222',
    textAlign: 'right',
    writingDirection: 'rtl',
    flexShrink: 1,
  },
  infoRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginTop: 4,
    flexWrap: 'wrap',
    maxWidth: '100%',
    minWidth: 0,
  },
  time: {
    fontSize: 14,
    color: '#7B61FF',
    textAlign: 'right',
    writingDirection: 'rtl',
    flexShrink: 0,
  },
  separator: {
    color: '#bbb',
    marginHorizontal: 6,
    fontSize: 14,
    flexShrink: 0,
  },
  type: {
    fontSize: 14,
    color: '#888',
    textAlign: 'right',
    writingDirection: 'rtl',
    flexShrink: 1,
    maxWidth: '100%',
  },
  tag: {
    backgroundColor: '#EAF3FF',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 2,
    alignSelf: 'flex-end',
    borderWidth: 1,
    borderColor: '#D6EBFF',
    marginTop: 6,
  },
  tagText: {
    color: '#2196F3',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});

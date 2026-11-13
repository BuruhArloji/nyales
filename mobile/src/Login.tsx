import React from 'react';
import { Pressable, Text, View } from 'react-native';
export default function Login({ onClose }: { onClose: () => void }) {
  return <View><Text>Login native tersedia pada build Android.</Text><Pressable onPress={onClose}><Text>Kembali</Text></Pressable></View>;
}

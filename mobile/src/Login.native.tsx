import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { MobileSession } from './mobile-session';
import { NyalesApiError, type Identity } from './api';
import { signInWithGoogle, signOutGoogle } from './google-auth.native';
import { readDeviceSession, saveDeviceSession, clearDeviceSession } from './session-store';

const DEVICE_KEY = 'nyales.device_id.v1';
const extra = Constants.expoConfig?.extra;
const origin = typeof extra?.apiOrigin === 'string' ? extra.apiOrigin : '';
const clientId = typeof extra?.googleWebClientId === 'string' ? extra.googleWebClientId : '';

async function deviceId() {
  let id = await SecureStore.getItemAsync(DEVICE_KEY);
  if (!id) {
    id = Crypto.randomUUID();
    await SecureStore.setItemAsync(DEVICE_KEY, id, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  }
  return id;
}
function errorText(error: unknown) {
  if (error instanceof NyalesApiError) {
    if (error.code === 'PORTFOLIO_ACCESS_EXPIRED') return 'Waktu akses akun ini telah berakhir.';
    if (error.code === 'REAUTH_REQUIRED' || error.code === 'DEVICE_SESSION_INVALID') return 'Sesi berakhir. Silakan masuk kembali.';
    if (error.status === 403) return 'Akun ini belum memiliki akses ke NYALES.';
  }
  return 'Belum bisa masuk. Periksa koneksi dan coba lagi.';
}

export default function Login({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [message, setMessage] = useState('');
  const session = useRef<MobileSession | null>(null);
  const login = async () => {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      if (!origin || !clientId) throw new Error('CONFIGURATION_REQUIRED');
      const account = await signInWithGoogle(clientId);
      if (!account) return;
      const current = new MobileSession(origin, { read: readDeviceSession, save: saveDeviceSession, clear: clearDeviceSession });
      session.current = current;
      setIdentity(await current.open(account, await deviceId()));
    } catch (error) {
      if (error instanceof NyalesApiError && (error.code === 'DEVICE_SESSION_INVALID' || error.code === 'REAUTH_REQUIRED')) {
        try { await session.current?.clearLocal(); await signOutGoogle(); } catch { /* A fresh login remains necessary. */ }
        session.current = null;
      }
      setMessage(errorText(error));
    } finally { setBusy(false); }
  };
  const logout = async () => {
    if (busy) return;
    setBusy(true); setMessage('');
    try { await session.current?.clearLocal(); await signOutGoogle(); setIdentity(null); session.current = null; }
    catch { setMessage('Belum bisa keluar sepenuhnya. Coba lagi.'); }
    finally { setBusy(false); }
  };
  return <View style={s.screen}>
    <Text style={s.brand}>NYALES</Text>
    <Text style={s.title}>{identity ? 'Akun terhubung' : 'Masuk ke NYALES'}</Text>
    {identity ? <><Text style={s.body}>{identity.name || 'Pengguna NYALES'}</Text><Text style={s.body}>Peran: {identity.role || 'belum tersedia'}</Text><Text style={s.note}>Login terhubung ke staging. Halaman operasional masih dalam pengembangan.</Text></> : <Text style={s.body}>Gunakan akun Google untuk menghubungkan perangkat ke NYALES staging.</Text>}
    {!!message && <Text accessibilityRole="alert" style={s.error}>{message}</Text>}
    {busy && <ActivityIndicator color="#087c71" style={s.spinner}/>}
    <Pressable disabled={busy} accessibilityRole="button" onPress={identity ? logout : login} style={s.button}><Text style={s.buttonText}>{identity ? 'Keluar' : 'Masuk dengan Google'}</Text></Pressable>
    {!identity && <Pressable disabled={busy} accessibilityRole="button" onPress={onClose} style={s.secondary}><Text style={s.secondaryText}>Kembali</Text></Pressable>}
  </View>;
}
const s = StyleSheet.create({screen:{flex:1,backgroundColor:'#e0eee8',justifyContent:'center',padding:28},brand:{fontSize:12,letterSpacing:2,color:'#087c71',fontWeight:'700',marginBottom:20},title:{fontSize:32,color:'#242625',letterSpacing:-1,marginBottom:14},body:{fontSize:16,lineHeight:24,color:'#51665e',marginBottom:8},note:{fontSize:13,lineHeight:20,color:'#657a71',marginTop:12},error:{color:'#a82735',marginTop:16},spinner:{marginTop:18},button:{backgroundColor:'#242625',borderRadius:28,minHeight:54,alignItems:'center',justifyContent:'center',marginTop:26},buttonText:{color:'#fff',fontSize:15,fontWeight:'600'},secondary:{minHeight:48,alignItems:'center',justifyContent:'center',marginTop:10},secondaryText:{color:'#405b52'}});

import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text as NativeText, TextInput, View } from 'react-native';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { MobileSession } from './mobile-session';
import { NyalesApiError, type Customer, type CustomerPage, type Identity } from './api';
import { signInWithGoogle, signOutGoogle } from './google-auth.native';
import { readDeviceSession, saveDeviceSession, clearDeviceSession } from './session-store';
import ConnectedModules from './ConnectedModules';
import DailyGenerator from './DailyGenerator';

function Text(props: React.ComponentProps<typeof NativeText>) {
  const weight = StyleSheet.flatten(props.style)?.fontWeight;
  return <NativeText {...props} style={[props.style, { fontFamily: weight === '700' || weight === 'bold' ? 'Inter_700Bold' : weight === '600' ? 'Inter_600SemiBold' : weight === '500' ? 'Inter_500Medium' : 'Inter_400Regular', fontWeight: 'normal' }]} />;
}

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
  return 'Permintaan belum berhasil. Periksa koneksi dan coba lagi.';
}

export default function Login({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [message, setMessage] = useState('');
  const [page, setPage] = useState<CustomerPage | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [listOpen, setListOpen] = useState(false);
  const listGeneration = useRef(0);
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
    listGeneration.current++;
    setBusy(true); setMessage('');
    try { await session.current?.clearLocal(); await signOutGoogle(); setIdentity(null); setPage(null); setCustomer(null); setListOpen(false); session.current = null; }
    catch { setMessage('Belum bisa keluar sepenuhnya. Coba lagi.'); }
    finally { setBusy(false); }
  };
  const loadCustomers = async (offset: number, query: string) => {
    if (!session.current || !identity || busy) return;
    const generation = ++listGeneration.current;
    setBusy(true); setMessage('');
    try {
      const result = await session.current.api.customers(offset, query, identity.channel === 'telesales' ? 'telesales' : 'field');
      if (generation === listGeneration.current) { setPage(result); setAppliedSearch(query); setListOpen(true); }
    } catch (error) { if (generation === listGeneration.current) setMessage(errorText(error)); }
    finally { if (generation === listGeneration.current) setBusy(false); }
  };
  const loadCustomer = async (id: string) => {
    if (!session.current || busy) return;
    const generation = ++listGeneration.current;
    setBusy(true); setMessage('');
    try { const result = await session.current.api.customer(id); if (generation === listGeneration.current) setCustomer(result); }
    catch (error) { if (generation === listGeneration.current) setMessage(errorText(error)); }
    finally { if (generation === listGeneration.current) setBusy(false); }
  };
  return <ScrollView contentContainerStyle={s.screen} keyboardShouldPersistTaps="handled">
    <Text style={s.brand}>NYALES</Text>
    <Text style={s.title}>{identity ? 'Akun terhubung' : 'Masuk ke NYALES'}</Text>
    {identity ? <><Text style={s.body}>{identity.name || 'Pengguna NYALES'}</Text><Text style={s.body}>Peran: {identity.role || 'belum tersedia'}</Text><Text style={s.note}>Terhubung ke NYALES staging. Fitur operasional lainnya masih dalam pengembangan.</Text>
      {session.current && identity.role === 'SALES_REP' && <DailyGenerator api={session.current.api} identity={identity} />}
      {session.current && <ConnectedModules api={session.current.api} />}
      {!listOpen ? <Pressable disabled={busy} accessibilityRole="button" onPress={() => loadCustomers(0, '')} style={s.secondary}><Text style={s.secondaryText}>Lihat pelanggan</Text></Pressable> : customer ? <><Pressable accessibilityRole="button" onPress={() => setCustomer(null)} style={s.secondary}><Text style={s.secondaryText}>‹ Kembali ke pelanggan</Text></Pressable><Text style={s.listHeading}>{customer.name}</Text><View style={s.customer}><Text style={s.customerName}>Alamat</Text><Text style={s.customerAddress}>{customer.address || 'Belum tersedia'}</Text></View><View style={s.customer}><Text style={s.customerName}>Status pelanggan</Text><Text style={s.customerAddress}>{customer.status || 'Belum tersedia'}</Text></View></> : <>
        <Text style={s.listHeading}>Pelanggan</Text><View style={s.searchRow}><TextInput accessibilityLabel="Cari pelanggan" style={s.input} value={search} onChangeText={setSearch} placeholder="Cari nama atau alamat" maxLength={200} returnKeyType="search" onSubmitEditing={() => loadCustomers(0, search)} /><Pressable disabled={busy} accessibilityRole="button" onPress={() => loadCustomers(0, search)} style={s.searchButton}><Text>Cari</Text></Pressable></View>
        {page && <><Text style={s.note}>{page.total.toLocaleString('id-ID')} pelanggan · {page.total ? page.offset + 1 : 0}–{page.offset + page.rows.length}</Text>
          {page.rows.map(customer => <Pressable disabled={busy} accessibilityRole="button" accessibilityLabel={'Lihat pelanggan '+customer.name} onPress={() => loadCustomer(customer.id)} key={customer.id} style={s.customer}><Text style={s.customerName}>{customer.name}</Text>{!!customer.address && <Text style={s.customerAddress}>{customer.address}</Text>}</Pressable>)}
          {!page.rows.length && <Text style={s.note}>Tidak ada pelanggan yang cocok.</Text>}
          <View style={s.paging}><Pressable disabled={busy || page.offset === 0} accessibilityRole="button" onPress={() => loadCustomers(Math.max(0, page.offset - page.limit), appliedSearch)}><Text style={[s.secondaryText, page.offset === 0 && s.disabled]}>Sebelumnya</Text></Pressable><Pressable disabled={busy || page.offset + page.rows.length >= page.total} accessibilityRole="button" onPress={() => loadCustomers(page.offset + page.limit, appliedSearch)}><Text style={[s.secondaryText, page.offset + page.rows.length >= page.total && s.disabled]}>Berikutnya</Text></Pressable></View></>}
      </>}</> : <Text style={s.body}>Gunakan akun Google untuk menghubungkan perangkat ke NYALES staging.</Text>}
    {!!message && <Text accessibilityRole="alert" style={s.error}>{message}</Text>}
    {busy && <ActivityIndicator color="#087c71" style={s.spinner}/>}
    <Pressable disabled={busy} accessibilityRole="button" onPress={identity ? logout : login} style={s.button}><Text style={s.buttonText}>{identity ? 'Keluar' : 'Masuk dengan Google'}</Text></Pressable>
    {!identity && <Pressable disabled={busy} accessibilityRole="button" onPress={onClose} style={s.secondary}><Text style={s.secondaryText}>Kembali</Text></Pressable>}
  </ScrollView>;
}
const s = StyleSheet.create({screen:{flexGrow:1,backgroundColor:'#e0eee8',justifyContent:'center',padding:28},brand:{fontSize:12,letterSpacing:2,color:'#087c71',fontWeight:'700',marginBottom:20},title:{fontSize:32,color:'#242625',letterSpacing:-1,marginBottom:14},body:{fontSize:16,lineHeight:24,color:'#51665e',marginBottom:8},note:{fontSize:13,lineHeight:20,color:'#657a71',marginTop:12},error:{color:'#a82735',marginTop:16},spinner:{marginTop:18},button:{backgroundColor:'#242625',borderRadius:28,minHeight:54,alignItems:'center',justifyContent:'center',marginTop:26},buttonText:{color:'#fff',fontSize:15,fontWeight:'600'},secondary:{minHeight:48,alignItems:'center',justifyContent:'center',marginTop:10},secondaryText:{color:'#405b52'},listHeading:{fontSize:23,color:'#242625',marginTop:24},searchRow:{flexDirection:'row',gap:8,marginTop:12},input:{flex:1,backgroundColor:'#fff',borderRadius:16,paddingHorizontal:14,minHeight:48,color:'#242625'},searchButton:{paddingHorizontal:15,justifyContent:'center',backgroundColor:'#fff',borderRadius:16},customer:{backgroundColor:'#f8faf9',borderRadius:16,padding:15,marginTop:8},customerName:{fontSize:15,color:'#242625',fontWeight:'600'},customerAddress:{fontSize:12,lineHeight:18,color:'#657a71',marginTop:5},paging:{flexDirection:'row',justifyContent:'space-between',paddingVertical:20},disabled:{opacity:0.35}});

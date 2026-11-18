import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, ActivityIndicator, Easing, Pressable, ScrollView, StyleSheet, Text as NativeText, TextInput, View } from 'react-native';
import Constants from 'expo-constants';
import {LinearGradient} from 'expo-linear-gradient';
import {BlurView} from 'expo-blur';
import Svg, {Circle,Path,Rect} from 'react-native-svg';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { MobileSession } from './mobile-session';
import { NyalesApiError, type Customer, type CustomerPage, type Identity } from './api';
import { signInWithGoogle, signOutGoogle } from './google-auth.native';
import { readDeviceSession, saveDeviceSession, clearDeviceSession } from './session-store';
import ConnectedModules from './ConnectedModules';
import DailyGenerator from './DailyGenerator';
import FieldVisits from './FieldVisits';
import VisitOffDays from './VisitOffDays';
import Team from './Team';
import VisitSettings from './VisitSettings';
import CustomerMap from './CustomerMap';
import TrackingControl,{stopTrackingForAccountChange,stopTrackingForLogout} from './TrackingControl';

function Text(props: React.ComponentProps<typeof NativeText>) {
  const weight = StyleSheet.flatten(props.style)?.fontWeight;
  return <NativeText {...props} style={[props.style, { fontFamily: weight === '700' || weight === 'bold' ? 'Inter_700Bold' : weight === '600' ? 'Inter_600SemiBold' : weight === '500' ? 'Inter_500Medium' : 'Inter_400Regular', fontWeight: 'normal' }]} />;
}

type NavName='Overview'|'Pelanggan'|'Aktivitas'|'Tim'|'Akun';
function NavIcon({name,active}:{name:NavName;active:boolean}) {
 const color=active?'#fff':'#53655e';const props={stroke:color,strokeWidth:1.8,strokeLinecap:'round' as const,strokeLinejoin:'round' as const,fill:'none'};
 return <Svg width={20} height={20} viewBox="0 0 24 24">{name==='Overview'?<><Rect x="3" y="3" width="8" height="8" rx="2" {...props}/><Rect x="14" y="3" width="7" height="8" rx="2" {...props}/><Rect x="3" y="14" width="8" height="7" rx="2" {...props}/><Rect x="14" y="14" width="7" height="7" rx="2" {...props}/></>:name==='Pelanggan'||name==='Tim'?<><Circle cx="9" cy="8" r="3" {...props}/><Path d="M3 20v-1a6 6 0 0 1 12 0v1M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5v1" {...props}/></>:name==='Aktivitas'?<><Rect x="3" y="5" width="18" height="16" rx="3" {...props}/><Path d="M7 3v4m10-4v4M3 10h18M8 15h3m2 0h3" {...props}/></>:<><Circle cx="12" cy="8" r="4" {...props}/><Path d="M4 21a8 8 0 0 1 16 0" {...props}/></>}</Svg>;
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
  const [customerView,setCustomerView]=useState<'list'|'map'>('list');
  const [nav, setNav] = useState<NavName>('Overview');
  const reveal = useRef(new Animated.Value(1)).current;
  const [reduceMotion,setReduceMotion] = useState(false);
  useEffect(()=>{AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);const listener=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduceMotion);return ()=>listener.remove()},[]);
  useEffect(()=>{reveal.stopAnimation();if(reduceMotion){reveal.setValue(1);return}reveal.setValue(0);Animated.timing(reveal,{toValue:1,duration:280,easing:Easing.out(Easing.cubic),useNativeDriver:true}).start()},[nav,reduceMotion,reveal]);
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
      const authenticated=await current.open(account, await deviceId());
      await stopTrackingForAccountChange(authenticated);
      setIdentity(authenticated);
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
    try { if(identity&&session.current)await stopTrackingForLogout(identity,session.current.api);await session.current?.clearLocal(); await signOutGoogle(); setIdentity(null); setPage(null); setCustomer(null); setListOpen(false); session.current = null; }
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
  useEffect(()=>{if(nav==='Pelanggan' && identity && !listOpen && !busy)void loadCustomers(0,'')},[nav,identity]);
  const loadCustomer = async (id: string) => {
    if (!session.current || busy) return;
    const generation = ++listGeneration.current;
    setBusy(true); setMessage('');
    try { const result = await session.current.api.customer(id); if (generation === listGeneration.current) setCustomer(result); }
    catch (error) { if (generation === listGeneration.current) setMessage(errorText(error)); }
    finally { if (generation === listGeneration.current) setBusy(false); }
  };
  return <LinearGradient colors={['#bce2d2','#e7e9e8','#d8e7df']} style={s.root}><ScrollView contentContainerStyle={s.screen} keyboardShouldPersistTaps="handled">
    {identity ? <View style={s.topbar}><Text style={s.brand}>NYALES</Text><Pressable accessibilityRole="button" accessibilityLabel="Buka akun" onPress={()=>setNav('Akun')}><Text style={s.avatar}>{(identity.name || 'N').slice(0,1).toUpperCase()}</Text></Pressable></View> : <><Text style={s.brand}>NYALES</Text><Text style={s.title}>Masuk ke NYALES</Text></>}
    <Animated.View style={{opacity:reveal,transform:[{translateY:reveal.interpolate({inputRange:[0,1],outputRange:[12,0]})}]}}>{identity ? <>{nav==='Akun'&&<><Text style={s.title}>Akun</Text><View style={s.customer}><Text style={s.customerName}>{identity.name || 'Pengguna NYALES'}</Text><Text style={s.customerAddress}>{identity.role || 'Peran belum tersedia'}</Text><Text style={s.note}>Terhubung ke staging</Text></View>{session.current && <VisitSettings api={session.current.api} identity={identity}/>} </>}
      {nav==='Aktivitas'&&<Text style={s.title}>Aktivitas lapangan</Text>}
      {nav==='Aktivitas' && identity.role !== 'SALES_REP' && identity.role !== 'TELESALES' && session.current && <VisitOffDays api={session.current.api} identity={identity}/>}
      {nav==='Aktivitas' && identity.role !== 'SALES_REP' && session.current && <ConnectedModules api={session.current.api} identity={identity} initialSection="Aktivitas" readOnly={identity.portfolio_read_only} />}
      {nav==='Aktivitas' && session.current && ['SALES_REP','SUPERVISOR','AREA_MANAGER','REGIONAL_MANAGER','NSM','MANAGEMENT'].includes(identity.role||'') && identity.channel!=='telesales' && <DailyGenerator api={session.current.api} identity={identity} />}
      {session.current && identity.role === 'SALES_REP' && !identity.portfolio_read_only && <View style={{display:nav==='Aktivitas'?'flex':'none'}}><TrackingControl api={session.current.api} identity={identity}/></View>}
      {nav==='Aktivitas' && session.current && identity.role === 'SALES_REP' && !identity.portfolio_read_only && <FieldVisits api={session.current.api} identity={identity} />}
      {nav==='Overview' && session.current && <ConnectedModules api={session.current.api} identity={identity} readOnly={identity.portfolio_read_only} />}
      {nav==='Tim' && session.current && <Team api={session.current.api} />}
      {nav==='Pelanggan' && <View style={s.customerViews}>{(['list','map'] as const).map(item=><Pressable key={item} accessibilityRole="button" accessibilityState={{selected:customerView===item}} onPress={()=>setCustomerView(item)} style={[s.customerView,customerView===item&&s.customerViewActive]}><Text style={[s.navText,customerView===item&&s.navTextSelected]}>{item==='list'?'Pelanggan':'Peta'}</Text></Pressable>)}</View>}
      {nav==='Pelanggan' && customerView==='map' && session.current && <CustomerMap api={session.current.api}/>}
      {nav==='Pelanggan' && customerView==='list' && (!listOpen ? <Pressable disabled={busy} accessibilityRole="button" onPress={() => loadCustomers(0, '')} style={s.secondary}><Text style={s.secondaryText}>Lihat pelanggan</Text></Pressable> : customer ? <><Pressable accessibilityRole="button" onPress={() => setCustomer(null)} style={s.secondary}><Text style={s.secondaryText}>‹ Kembali ke pelanggan</Text></Pressable><Text style={s.listHeading}>{customer.name}</Text><View style={s.customer}><Text style={s.customerName}>Alamat</Text><Text style={s.customerAddress}>{customer.address || 'Belum tersedia'}</Text></View><View style={s.customer}><Text style={s.customerName}>Status pelanggan</Text><Text style={s.customerAddress}>{customer.status || 'Belum tersedia'}</Text></View></> : <>
        <Text style={s.listHeading}>Pelanggan</Text><View style={s.searchRow}><TextInput accessibilityLabel="Cari pelanggan" style={s.input} value={search} onChangeText={setSearch} placeholder="Cari nama atau alamat" maxLength={200} returnKeyType="search" onSubmitEditing={() => loadCustomers(0, search)} /><Pressable disabled={busy} accessibilityRole="button" onPress={() => loadCustomers(0, search)} style={s.searchButton}><Text>Cari</Text></Pressable></View>
        {page && <><Text style={s.note}>{page.total.toLocaleString('id-ID')} pelanggan · {page.total ? page.offset + 1 : 0}–{page.offset + page.rows.length}</Text>
          {page.rows.map(customer => <Pressable disabled={busy} accessibilityRole="button" accessibilityLabel={'Lihat pelanggan '+customer.name} onPress={() => loadCustomer(customer.id)} key={customer.id} style={s.customer}><Text style={s.customerName}>{customer.name}</Text>{!!customer.address && <Text style={s.customerAddress}>{customer.address}</Text>}</Pressable>)}
          {!page.rows.length && <Text style={s.note}>Tidak ada pelanggan yang cocok.</Text>}
          <View style={s.paging}><Pressable disabled={busy || page.offset === 0} accessibilityRole="button" onPress={() => loadCustomers(Math.max(0, page.offset - page.limit), appliedSearch)}><Text style={[s.secondaryText, page.offset === 0 && s.disabled]}>Sebelumnya</Text></Pressable><Pressable disabled={busy || page.offset + page.rows.length >= page.total} accessibilityRole="button" onPress={() => loadCustomers(page.offset + page.limit, appliedSearch)}><Text style={[s.secondaryText, page.offset + page.rows.length >= page.total && s.disabled]}>Berikutnya</Text></Pressable></View></>}
      </> )}</> : <Text style={s.body}>Gunakan akun Google untuk menghubungkan perangkat ke NYALES staging.</Text>}
    </Animated.View>
    {!!message && <Text accessibilityRole="alert" style={s.error}>{message}</Text>}
    {busy && <ActivityIndicator color="#087c71" style={s.spinner}/>}
    {(!identity || nav==='Akun') && <Pressable disabled={busy} accessibilityRole="button" onPress={identity ? logout : login} style={s.button}><Text style={s.buttonText}>{identity ? 'Keluar' : 'Masuk dengan Google'}</Text></Pressable>}
    {!identity && <Pressable disabled={busy} accessibilityRole="button" onPress={onClose} style={s.secondary}><Text style={s.secondaryText}>Kembali</Text></Pressable>}
  </ScrollView>{identity&&<BlurView intensity={48} tint="light" experimentalBlurMethod="dimezisBlurView" style={s.nav}>{(['Overview','Pelanggan','Aktivitas','Tim','Akun'] as const).map(item=><Pressable key={item} accessibilityRole="button" accessibilityLabel={item} accessibilityState={{selected:nav===item}} onPress={()=>setNav(item)} style={[s.navItem,nav===item&&s.navSelected]}><NavIcon name={item} active={nav===item}/><Text numberOfLines={1} style={[s.navText,nav===item&&s.navTextSelected]}>{item}</Text></Pressable>)}</BlurView>}</LinearGradient>;
}
const s = StyleSheet.create({customerViews:{flexDirection:'row',alignSelf:'flex-start',padding:5,backgroundColor:'rgba(255,255,255,.45)',borderRadius:25,gap:4},customerView:{minHeight:42,paddingHorizontal:18,borderRadius:22,justifyContent:'center'},customerViewActive:{backgroundColor:'#242625'},root:{flex:1},screen:{flexGrow:1,paddingHorizontal:20,paddingTop:50,paddingBottom:120},topbar:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:18},avatar:{overflow:'hidden',backgroundColor:'rgba(255,255,255,.55)',borderRadius:24,padding:12,color:'#20695d'},nav:{position:'absolute',bottom:16,left:16,right:16,flexDirection:'row',borderRadius:30,overflow:'hidden',padding:5,borderWidth:1,borderColor:'rgba(255,255,255,.7)',backgroundColor:'rgba(255,255,255,.35)'},navItem:{flex:1,borderRadius:24,minHeight:54,justifyContent:'center',alignItems:'center',gap:2},navSelected:{backgroundColor:'#242625'},navText:{fontSize:10,color:'#4e5e57'},navTextSelected:{color:'#fff',fontWeight:'600'},brand:{fontSize:12,letterSpacing:2,color:'#087c71',fontWeight:'700',marginBottom:20},title:{fontSize:32,color:'#242625',letterSpacing:-1,marginBottom:14},body:{fontSize:16,lineHeight:24,color:'#51665e',marginBottom:8},note:{fontSize:13,lineHeight:20,color:'#657a71',marginTop:12},error:{color:'#a82735',marginTop:16},spinner:{marginTop:18},button:{backgroundColor:'#242625',borderRadius:28,minHeight:54,alignItems:'center',justifyContent:'center',marginTop:26},buttonText:{color:'#fff',fontSize:15,fontWeight:'600'},secondary:{minHeight:48,alignItems:'center',justifyContent:'center',marginTop:10},secondaryText:{color:'#405b52'},listHeading:{fontSize:23,color:'#242625',marginTop:24},searchRow:{flexDirection:'row',gap:8,marginTop:12},input:{flex:1,backgroundColor:'#fff',borderRadius:16,paddingHorizontal:14,minHeight:48,color:'#242625'},searchButton:{paddingHorizontal:15,justifyContent:'center',backgroundColor:'#fff',borderRadius:16},customer:{backgroundColor:'#f8faf9',borderRadius:16,padding:15,marginTop:8},customerName:{fontSize:15,color:'#242625',fontWeight:'600'},customerAddress:{fontSize:12,lineHeight:18,color:'#657a71',marginTop:5},paging:{flexDirection:'row',justifyContent:'space-between',paddingVertical:20},disabled:{opacity:0.35}});

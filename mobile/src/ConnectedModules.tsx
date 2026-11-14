import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text as NativeText, View } from 'react-native';
import { NyalesApi, type Overview, type WorkKind, type WorkPage } from './api';

function Text(props: React.ComponentProps<typeof NativeText>) {
 const weight=StyleSheet.flatten(props.style)?.fontWeight;
 return <NativeText {...props} style={[props.style,{fontFamily:weight==='700'||weight==='bold'?'Inter_700Bold':weight==='600'?'Inter_600SemiBold':weight==='500'?'Inter_500Medium':'Inter_400Regular',fontWeight:'normal'}]}/>;
}

type WorkSection = 'Agenda' | 'Aktivitas' | 'Tugas' | 'Invoice';
type Section = 'Ringkasan' | WorkSection | 'Target' | 'Insentif';
const sections: Section[] = ['Ringkasan', 'Agenda', 'Aktivitas', 'Tugas', 'Invoice', 'Target', 'Insentif'];
const kinds: Record<WorkSection, WorkKind> = { Agenda: 'work-plans', Aktivitas: 'activities', Tugas: 'tasks', Invoice: 'invoices' };
function money(value: number | null) { return value === null ? 'Belum tersedia' : 'Rp' + value.toLocaleString('id-ID'); }
function label(row: Record<string, unknown>, key: string) { return typeof row[key] === 'string' ? row[key] as string : ''; }
function textFor(section: Exclude<Section, 'Ringkasan'>, row: Record<string, unknown>) {
  if (section === 'Target' || section === 'Insentif') {
    const title = section === 'Target' ? label(row,'name') : label(row,'user_name');
    const value = section === 'Target' ? row.target_minor : row.entitlement_minor;
    const actual = section === 'Target' && typeof row.actual_minor === 'number' ? 'Actual '+money(row.actual_minor) : '';
    return { title: title || 'Data tanpa nama', subtitle: [label(row,'customer_name') || label(row,'plan_name'), label(row,'period_start'), label(row,'status'), typeof value === 'number' ? money(value) : '', actual].filter(Boolean).join(' · ') };
  }
  const title = section === 'Tugas' ? label(row,'title') : section === 'Invoice' ? label(row,'source_invoice_id') : label(row,'customer_name');
  const customer = label(row,'customer_name');
  const date = section === 'Agenda' ? label(row,'scheduled_at') : section === 'Aktivitas' ? label(row,'occurred_at') : section === 'Tugas' ? label(row,'due_at') : label(row,'invoice_date');
  const amount = section === 'Invoice' && typeof row.net_minor === 'number' ? money(row.net_minor) : '';
  return { title: title || customer || 'Data tanpa nama', subtitle: [section === 'Invoice' ? customer : '', date, label(row,'status'), amount].filter(Boolean).join(' · ') };
}
export default function ConnectedModules({ api }: { api: NyalesApi }) {
 const [section,setSection]=useState<Section | null>(null), [overview,setOverview]=useState<Overview | null>(null), [page,setPage]=useState<WorkPage | null>(null);
 const [busy,setBusy]=useState(false), [error,setError]=useState('');
 const load = async (next: Section, offset=0) => {
  if(busy)return; setBusy(true);setError('');setSection(next);setOverview(null);setPage(null);
  try { if(next==='Ringkasan') setOverview(await api.overview()); else if(next==='Target') { const summary=await api.overview();setPage(await api.performance('targets',summary.period,offset)); } else if(next==='Insentif') setPage(await api.performance('incentive-statements',undefined,offset)); else setPage(await api.workPage(kinds[next],offset)); }
  catch { setError('Data belum dapat dimuat. Periksa koneksi atau akses akun, lalu coba lagi.'); }
  finally { setBusy(false); }
 };
 return <View style={s.wrap}>
  <Text style={s.heading}>Data NYALES</Text>
  <View style={s.tabs}>{sections.map(item=><Pressable key={item} disabled={busy} accessibilityRole="button" accessibilityState={{selected:section===item}} onPress={()=>load(item)} style={[s.tab,section===item&&s.active]}><Text style={[s.tabText,section===item&&s.activeText]}>{item}</Text></Pressable>)}</View>
  {busy && <ActivityIndicator color="#087c71" style={s.loading}/>}
  {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
  {overview && <View style={s.panel}><Text style={s.muted}>Periode {overview.period}</Text><Text style={s.label}>Actual penjualan</Text><Text style={s.value}>{money(overview.actual_net_minor)}</Text><Text style={s.line}>Target: {money(overview.target_net_minor)}</Text><Text style={s.line}>Pencapaian: {overview.achievement === null ? 'Belum tersedia' : overview.achievement.toLocaleString('id-ID',{maximumFractionDigits:2})+'%'}</Text><Text style={s.line}>Pelanggan aktif: {overview.active_customer_count.toLocaleString('id-ID')}</Text><Text style={s.line}>Sales bertransaksi: {overview.sales_rep_count.toLocaleString('id-ID')}</Text></View>}
  {page && section && section!=='Ringkasan' && <><Text style={s.muted}>Data {page.rows.length ? page.offset+1 : 0}–{page.offset+page.rows.length}</Text>{page.rows.map(row=>{const item=textFor(section,row);return <View key={String(row.id)} style={s.row}><Text style={s.rowTitle}>{item.title}</Text><Text style={s.muted}>{item.subtitle}</Text></View>})}{page.rows.length===0&&<Text style={s.muted}>Tidak ada data untuk ditampilkan.</Text>}<View style={s.paging}><Pressable disabled={busy||page.offset===0} accessibilityRole="button" onPress={()=>load(section,Math.max(0,page.offset-50))}><Text style={[s.link,page.offset===0&&s.disabled]}>Sebelumnya</Text></Pressable><Pressable disabled={busy||!page.hasMore} accessibilityRole="button" onPress={()=>load(section,page.offset+50)}><Text style={[s.link,!page.hasMore&&s.disabled]}>Berikutnya</Text></Pressable></View></>}

 </View>;
}
const s=StyleSheet.create({wrap:{marginTop:25},heading:{fontSize:22,color:'#242625',marginBottom:10},tabs:{flexDirection:'row',flexWrap:'wrap',gap:7,marginBottom:14},tab:{borderRadius:24,backgroundColor:'rgba(255,255,255,0.65)',paddingVertical:10,paddingHorizontal:14},active:{backgroundColor:'#242625'},tabText:{fontSize:12,color:'#405b52'},activeText:{color:'#fff'},loading:{marginVertical:16},error:{color:'#a82735',marginVertical:12},panel:{borderRadius:20,backgroundColor:'#f8faf9',padding:18},muted:{fontSize:12,lineHeight:18,color:'#657a71'},label:{fontSize:13,color:'#657a71',marginTop:14},value:{fontSize:27,color:'#242625',marginTop:6},line:{fontSize:14,color:'#405b52',marginTop:10},row:{backgroundColor:'#f8faf9',borderRadius:16,padding:15,marginTop:8},rowTitle:{fontSize:15,color:'#242625',fontWeight:'600',marginBottom:5},paging:{flexDirection:'row',justifyContent:'space-between',paddingVertical:20},link:{color:'#236b5a'},disabled:{opacity:0.35}});

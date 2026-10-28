import React from'react';
import {createRoot}from'react-dom/client';
import {AuthGate,useIdentity}from'../../src/client/auth';
function Protected(){const {identity,logout}=useIdentity();return <main><h1>Contoh data terlindungi</h1><p>{identity.name}</p><button onClick={()=>void logout()}>Keluar dari aplikasi</button></main>}
createRoot(document.getElementById('root')!).render(<React.StrictMode><AuthGate><Protected/></AuthGate></React.StrictMode>);

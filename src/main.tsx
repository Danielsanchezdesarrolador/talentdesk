import {createRoot} from 'react-dom/client';
import {App} from './App.js';
import {RecoveryScreen} from './BackupPanel.js';
import {RESTORE_MARKER} from './backup.js';
function Root(){try{if(localStorage.getItem(RESTORE_MARKER)!==null)return <RecoveryScreen/>;}catch{/* Existing panels handle storage errors. */}return <App storage={localStorage}/>;}
createRoot(document.getElementById('root')!).render(<Root/>);
if('serviceWorker' in navigator&&window.isSecureContext){window.addEventListener('load',()=>{void navigator.serviceWorker.register('./sw.js').catch(()=>{});});}

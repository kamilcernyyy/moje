import { createRoot } from 'react-dom/client';
import Lanyard from './Lanyard.jsx';

createRoot(document.getElementById('root')).render(
  <div style={{ width: '100%', height: '100%' }}>
    <Lanyard />
  </div>
);
